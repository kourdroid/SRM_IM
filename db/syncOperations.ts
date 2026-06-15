import type { SQLiteDatabase } from 'expo-sqlite';

export type SyncOperationType =
  | 'create_incident'
  | 'update_incident_status'
  | 'upload_media'
  | 'attach_media'
  | 'sync_materials';

export type SyncOperationStatus = 'pending' | 'running' | 'failed' | 'done';

export interface SyncOperationRow {
  id: number;
  operation_key: string;
  operation_type: SyncOperationType;
  local_incident_id: number;
  remote_incident_id: string | null;
  payload_json: string;
  status: SyncOperationStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  error_code: string | null;
  is_terminal: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function enqueueSyncOperation(
  db: SQLiteDatabase,
  operationType: SyncOperationType,
  localIncidentId: number,
  payload: Record<string, unknown>,
  remoteIncidentId?: string | null,
  operationKey?: string
): Promise<void> {
  const key = operationKey || buildOperationKey(operationType, localIncidentId, payload, remoteIncidentId);
  await db.runAsync(
    `INSERT INTO sync_operations (
      operation_key, operation_type, local_incident_id, remote_incident_id, payload_json, status
    ) VALUES (?, ?, ?, ?, ?, 'pending')
    ON CONFLICT(operation_key) DO UPDATE SET
      status = CASE WHEN sync_operations.status = 'done' THEN 'done' ELSE 'pending' END,
      payload_json = excluded.payload_json,
      remote_incident_id = COALESCE(excluded.remote_incident_id, sync_operations.remote_incident_id),
      is_terminal = 0,
      next_attempt_at = NULL,
      updated_at = CURRENT_TIMESTAMP`,
    [key, operationType, localIncidentId, remoteIncidentId ?? null, JSON.stringify(payload)]
  );
}

export async function enqueueCreateIncident(
  db: SQLiteDatabase,
  localIncidentId: number,
  clientId?: string
): Promise<void> {
  await enqueueSyncOperation(
    db,
    'create_incident',
    localIncidentId,
    clientId ? { clientId } : {},
    null,
    clientId ? `create_incident:${clientId}` : undefined
  );
}

export async function enqueueStatusUpdate(
  db: SQLiteDatabase,
  localIncidentId: number,
  status: 'open' | 'closed',
  clientEventId = `status-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
): Promise<void> {
  await enqueueSyncOperation(
    db,
    'update_incident_status',
    localIncidentId,
    { status, clientEventId },
    null,
    `update_status:${localIncidentId}:${status}:${clientEventId}`
  );
}

export async function enqueueMediaUpload(
  db: SQLiteDatabase,
  localIncidentId: number,
  localUri: string,
  clientMediaId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
): Promise<void> {
  await enqueueSyncOperation(
    db,
    'upload_media',
    localIncidentId,
    { localUri, clientMediaId },
    null,
    `upload_media:${localIncidentId}:${clientMediaId}`
  );
}

export async function enqueueSyncMaterials(
  db: SQLiteDatabase,
  localIncidentId: number
): Promise<void> {
  await enqueueSyncOperation(
    db,
    'sync_materials',
    localIncidentId,
    {},
    null,
    `sync_materials:${localIncidentId}`
  );
}

export async function enqueueAttachMedia(
  db: SQLiteDatabase,
  localIncidentId: number,
  remoteIncidentId: string,
  remoteUrl: string,
  clientMediaId: string,
  storagePath: string,
  localUri?: string
): Promise<void> {
  await enqueueSyncOperation(
    db,
    'attach_media',
    localIncidentId,
    { remoteUrl, clientMediaId, storagePath, localUri },
    remoteIncidentId,
    `attach_media:${remoteIncidentId}:${clientMediaId}`
  );
}

export async function getRunnableSyncOperations(
  db: SQLiteDatabase,
  limit = 20
): Promise<SyncOperationRow[]> {
  return db.getAllAsync<SyncOperationRow>(
    `SELECT * FROM sync_operations
     WHERE is_terminal = 0
       AND (
        status = 'pending'
        OR (status = 'failed' AND COALESCE(next_attempt_at, updated_at) <= CURRENT_TIMESTAMP)
       )
     ORDER BY
       CASE operation_type
         WHEN 'create_incident' THEN 0
         WHEN 'sync_materials' THEN 1
         WHEN 'update_incident_status' THEN 2
         WHEN 'upload_media' THEN 3
         WHEN 'attach_media' THEN 4
         ELSE 4
       END,
       id ASC
     LIMIT ?`,
    [limit]
  );
}

export async function resetRunningSyncOperations(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `UPDATE sync_operations
     SET status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'running'`
  );
}

export async function resetRetryableFailedSyncOperations(db: SQLiteDatabase): Promise<number> {
  const result = await db.runAsync(
    `UPDATE sync_operations
     SET status = 'pending',
         next_attempt_at = NULL,
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE status = 'failed'
       AND is_terminal = 0`
  );
  return result.changes;
}

export async function hasPendingSyncOperations(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM sync_operations
     WHERE is_terminal = 0
       AND status != 'done'`
  );
  return (row?.count ?? 0) > 0;
}

export async function markSyncOperationRunning(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_operations
     SET status = 'running', attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

export async function markSyncOperationDone(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_operations
     SET status = 'done', last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

export async function pruneCompletedSyncOperations(
  db: SQLiteDatabase,
  retentionDays = 30
): Promise<number> {
  const result = await db.runAsync(
    `DELETE FROM sync_operations
     WHERE status = 'done'
       AND updated_at < datetime('now', '-' || ? || ' days')`,
    [retentionDays]
  );
  return result.changes;
}

export async function markSyncOperationFailed(
  db: SQLiteDatabase,
  id: number,
  message: string,
  errorCode = 'UNKNOWN',
  isTerminal = false
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_operations
     SET status = 'failed',
         last_error = ?,
         error_code = ?,
         is_terminal = ?,
         next_attempt_at = CASE
           WHEN ? = 1 THEN NULL
           ELSE datetime('now', '+' || MIN(60, MAX(1, attempt_count * 2)) || ' minutes')
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [message, errorCode, isTerminal ? 1 : 0, isTerminal ? 1 : 0, id]
  );
}

export async function recoverMissingMediaUploadOperations(db: SQLiteDatabase): Promise<void> {
  const incidents = await db.getAllAsync<{ id: number; media_urls: string | null }>(
    `SELECT id, media_urls FROM incidents
     WHERE media_urls IS NOT NULL
       AND media_urls LIKE '%file:%'`
  );
  const existingUploads = await db.getAllAsync<{ local_incident_id: number; payload_json: string }>(
    `SELECT local_incident_id, payload_json
     FROM sync_operations
     WHERE operation_type = 'upload_media'`
  );
  const existingKeys = new Set(existingUploads.flatMap((operation) => {
    const localUri = parseUploadLocalUri(operation.payload_json);
    return localUri ? [`${operation.local_incident_id}:${localUri}`] : [];
  }));

  for (const incident of incidents) {
    const localUris = parseLocalMediaUrls(incident.media_urls);
    for (const localUri of localUris) {
      if (existingKeys.has(`${incident.id}:${localUri}`)) continue;

      const clientMediaId = `recovered-${hashString(localUri)}`;
      await enqueueMediaUpload(db, incident.id, localUri, clientMediaId);
      existingKeys.add(`${incident.id}:${localUri}`);
    }
  }
}

function parseUploadLocalUri(payloadJson: string): string | null {
  try {
    const payload = JSON.parse(payloadJson) as { localUri?: unknown };
    return typeof payload.localUri === 'string' ? payload.localUri : null;
  } catch {
    return null;
  }
}

function buildOperationKey(
  operationType: SyncOperationType,
  localIncidentId: number,
  payload: Record<string, unknown>,
  remoteIncidentId?: string | null
): string {
  if (operationType === 'create_incident' && typeof payload.clientId === 'string') {
    return `create_incident:${payload.clientId}`;
  }
  if (operationType === 'upload_media' && typeof payload.clientMediaId === 'string') {
    return `upload_media:${localIncidentId}:${payload.clientMediaId}`;
  }
  if (operationType === 'attach_media' && typeof payload.clientMediaId === 'string') {
    return `attach_media:${remoteIncidentId || 'pending'}:${payload.clientMediaId}`;
  }
  if (operationType === 'sync_materials') {
    return `sync_materials:${localIncidentId}`;
  }
  if (operationType === 'update_incident_status' && typeof payload.clientEventId === 'string') {
    return `update_status:${localIncidentId}:${payload.status || 'unknown'}:${payload.clientEventId}`;
  }
  return `${operationType}:${localIncidentId}:${hashString(JSON.stringify(payload))}`;
}

function parseLocalMediaUrls(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((url): url is string => typeof url === 'string' && url.startsWith('file:'))
      : [];
  } catch {
    return [];
  }
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
