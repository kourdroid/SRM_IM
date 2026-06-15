import type { SQLiteDatabase } from 'expo-sqlite';

// Types for incidents
export interface IncidentRow {
    id: number;
    client_id: string;
    remote_id: string | null;
    type: 'BT' | 'MT';
    date: string;
    village: string;
    status: 'open' | 'closed';
    incident_type: string;
    depart_hta: string | null;
    commune_id: string;
    equipment_used: string;
    description: string | null;
    reclamation: number;
    reclamation_name: string | null;
    reclamation_by: string | null;
    created_by: string;
    latitude: number | null;
    longitude: number | null;
    gps_accuracy: number | null;
    media_urls: string | null;
    sync_status: 'pending' | 'syncing' | 'synced' | 'failed';
    sync_error: string | null;
    archived_at: string | null;
    synced: number;
    created_at: string;
    updated_at: string;
}

export interface CreateIncidentInput {
    client_id: string;
    type: 'BT' | 'MT';
    date: string;
    village: string;
    incident_type: string;
    depart_hta?: string | null;
    commune_id: string;
    equipment_used: string;
    description?: string;
    reclamation: boolean;
    reclamation_name?: string;
    reclamation_by?: string;
    created_by: string;
    latitude?: number;
    longitude?: number;
    gps_accuracy?: number | null;
    media_urls?: string[];
}

/**
 * Get all incidents ordered by creation date (newest first)
 */
export async function getIncidents(db: SQLiteDatabase): Promise<IncidentRow[]> {
    return db.getAllAsync<IncidentRow>(
        'SELECT * FROM incidents ORDER BY created_at DESC'
    );
}

/**
 * Get incidents by status
 */
export async function getIncidentsByStatus(
    db: SQLiteDatabase,
    status: 'open' | 'closed'
): Promise<IncidentRow[]> {
    return db.getAllAsync<IncidentRow>(
        'SELECT * FROM incidents WHERE status = ? ORDER BY created_at DESC',
        [status]
    );
}

/**
 * Get unsynced incidents for push to server
 */
export async function getUnsyncedIncidents(db: SQLiteDatabase): Promise<IncidentRow[]> {
    return db.getAllAsync<IncidentRow>(
        'SELECT * FROM incidents WHERE synced = 0'
    );
}

/**
 * Create a new incident
 */
export async function createIncident(
    db: SQLiteDatabase,
    incident: CreateIncidentInput
): Promise<number> {
    const result = await db.runAsync(
        `INSERT INTO incidents (
      client_id, type, date, village, incident_type, depart_hta, commune_id, equipment_used,
      description, reclamation, reclamation_name, reclamation_by, created_by,
      latitude, longitude, gps_accuracy, media_urls, sync_status, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
        [
            incident.client_id,
            incident.type,
            incident.date,
            incident.village,
            incident.incident_type,
            incident.depart_hta ?? null,
            incident.commune_id,
            incident.equipment_used,
            incident.description || null,
            incident.reclamation ? 1 : 0,
            incident.reclamation_name || null,
            incident.reclamation_by || null,
            incident.created_by,
            incident.latitude || null,
            incident.longitude || null,
            incident.gps_accuracy ?? null,
            JSON.stringify(incident.media_urls || []),
        ]
    );
    return result.lastInsertRowId;
}

/**
 * Update incident status
 */
export async function updateIncidentStatus(
    db: SQLiteDatabase,
    id: number,
    status: 'open' | 'closed'
): Promise<void> {
    await db.runAsync(
        `UPDATE incidents
         SET status = ?, synced = 0, sync_status = 'pending', sync_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, id]
    );
}

/**
 * Mark incidents as synced after successful push
 */
export async function markIncidentsSynced(
    db: SQLiteDatabase,
    ids: number[]
): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
        `UPDATE incidents SET synced = 1, sync_status = 'synced', sync_error = NULL WHERE id IN (${placeholders})`,
        ids
    );
}

export async function getIncidentByLocalId(
    db: SQLiteDatabase,
    id: number
): Promise<IncidentRow | null> {
    return db.getFirstAsync<IncidentRow>('SELECT * FROM incidents WHERE id = ?', [id]);
}

export async function markIncidentSyncedWithRemoteId(
    db: SQLiteDatabase,
    localId: number,
    remoteId: string
): Promise<void> {
    await db.runAsync(
        `UPDATE incidents
         SET remote_id = ?, synced = 1, sync_status = 'synced', sync_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [remoteId, localId]
    );
}

export async function markIncidentSyncing(
    db: SQLiteDatabase,
    localId: number
): Promise<void> {
    await db.runAsync(
        `UPDATE incidents
         SET sync_status = 'syncing', sync_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [localId]
    );
}

export async function markIncidentSyncFailed(
    db: SQLiteDatabase,
    localId: number,
    message: string
): Promise<void> {
    await db.runAsync(
        `UPDATE incidents
         SET sync_status = 'failed', sync_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [message, localId]
    );
}

export async function markIncidentSyncPending(
    db: SQLiteDatabase,
    localId: number
): Promise<void> {
    await db.runAsync(
        `UPDATE incidents
         SET sync_status = 'pending', sync_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND sync_status IN ('syncing', 'failed')`,
        [localId]
    );
}

export async function resetRetryableIncidentSyncFailures(db: SQLiteDatabase): Promise<number> {
    const result = await db.runAsync(
        `UPDATE incidents
         SET sync_status = 'pending',
             sync_error = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE sync_status = 'failed'
           AND EXISTS (
             SELECT 1
             FROM sync_operations so
             WHERE so.local_incident_id = incidents.id
               AND so.is_terminal = 0
               AND so.status != 'done'
           )`
    );
    return result.changes;
}

export async function updateIncidentMediaUrls(
    db: SQLiteDatabase,
    localId: number,
    mediaUrls: string[]
): Promise<void> {
    await db.runAsync(
        'UPDATE incidents SET media_urls = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(mediaUrls), localId]
    );
}

/**
 * Upsert incidents from server (for pull sync)
 */
export async function upsertIncidentsFromServer(
    db: SQLiteDatabase,
    incidents: {
        id: string;
        client_id?: string | null;
        type: 'BT' | 'MT';
        date: string;
        village: string;
        status: 'open' | 'closed';
        incident_type: string;
        depart_hta?: string | null;
        commune_id: string | null;
        equipment_used: string;
        description?: string;
        reclamation: boolean;
        reclamation_name?: string;
        created_by: string;
        latitude?: number;
        longitude?: number;
        gps_accuracy?: number | null;
        media_urls?: string[];
        created_at: string;
        updated_at?: string;
        archived_at?: string | null;
    }[]
): Promise<void> {
    for (const inc of incidents) {
        // Fallbacks for NOT NULL constraints
        const safeClientId = inc.client_id || `remote-${inc.id}`;
        const safeCommuneId = inc.commune_id || '00000000-0000-0000-0000-000000000000';
        const safeType = (inc.type === 'BT' || inc.type === 'MT') ? inc.type : 'BT';
        
        const mediaUrls = JSON.stringify(inc.media_urls || []);
        const existing = await db.getFirstAsync<{ id: number; media_urls: string | null; sync_status: string | null }>(
            `SELECT id, media_urls, sync_status FROM incidents
             WHERE remote_id = ? OR (client_id IS NOT NULL AND client_id = ?)`,
            [inc.id, safeClientId]
        );

        if (existing) {
            const shouldKeepLocalMedia = existing.media_urls?.includes('file:') === true;
            await db.runAsync(
                `UPDATE incidents SET
                    client_id = COALESCE(client_id, ?),
                    remote_id = ?,
                    type = ?,
                    date = ?,
                    village = ?,
                    status = ?,
                    incident_type = ?,
                    depart_hta = ?,
                    commune_id = ?,
                    equipment_used = ?,
                    description = ?,
                    reclamation = ?,
                    reclamation_name = ?,
                    created_by = ?,
                    latitude = COALESCE(?, latitude),
                    longitude = COALESCE(?, longitude),
                    gps_accuracy = COALESCE(?, gps_accuracy),
                    media_urls = ?,
                    archived_at = ?,
                    sync_status = CASE WHEN sync_status = 'failed' THEN sync_status ELSE 'synced' END,
                    synced = 1,
                    created_at = ?,
                    updated_at = ?
                 WHERE id = ?`,
                [
                    safeClientId,
                    inc.id,
                    safeType,
                    inc.date || new Date().toISOString(),
                    inc.village || 'Unknown',
                    inc.status || 'open',
                    inc.incident_type || 'General',
                    inc.depart_hta || null,
                    safeCommuneId,
                    inc.equipment_used || '',
                    inc.description || null,
                    inc.reclamation ? 1 : 0,
                    inc.reclamation_name || null,
                    inc.created_by || 'system',
                    inc.latitude || null,
                    inc.longitude || null,
                    inc.gps_accuracy ?? null,
                    shouldKeepLocalMedia ? existing.media_urls : mediaUrls,
                    inc.archived_at || null,
                    inc.created_at || new Date().toISOString(),
                    inc.updated_at || inc.created_at || new Date().toISOString(),
                    existing.id,
                ]
            );
            continue;
        }

        await db.runAsync(
            `INSERT INTO incidents (
        client_id, remote_id, type, date, village, status, incident_type, depart_hta, commune_id,
        equipment_used, description, reclamation, reclamation_name,
        created_by, latitude, longitude, gps_accuracy, media_urls, archived_at, sync_status, synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 1, ?, ?)
      `,
            [
                safeClientId,
                inc.id,
                safeType,
                inc.date || new Date().toISOString(),
                inc.village || 'Unknown',
                inc.status || 'open',
                inc.incident_type || 'General',
                inc.depart_hta || null,
                safeCommuneId,
                inc.equipment_used || '',
                inc.description || null,
                inc.reclamation ? 1 : 0,
                inc.reclamation_name || null,
                inc.created_by || 'system',
                inc.latitude || null,
                inc.longitude || null,
                inc.gps_accuracy ?? null,
                mediaUrls,
                inc.archived_at || null,
                inc.created_at || new Date().toISOString(),
                inc.updated_at || inc.created_at || new Date().toISOString(),
            ]
        );
    }
}

export async function archiveStaleSyncedIncidents(
    db: SQLiteDatabase,
    userId: string,
    remoteIds: string[]
): Promise<number> {
    const uniqueRemoteIds = Array.from(new Set(remoteIds.filter(Boolean)));
    const remoteFilter = uniqueRemoteIds.length > 0
        ? `AND remote_id NOT IN (${uniqueRemoteIds.map(() => '?').join(',')})`
        : '';
    const params = uniqueRemoteIds.length > 0 ? [userId, ...uniqueRemoteIds] : [userId];

    const staleRows = await db.getAllAsync<{ id: number }>(
        `SELECT id FROM incidents
         WHERE created_by = ?
           AND remote_id IS NOT NULL
           AND synced = 1
           AND sync_status = 'synced'
           ${remoteFilter}
           AND NOT EXISTS (
             SELECT 1 FROM sync_operations so
             WHERE so.local_incident_id = incidents.id
               AND so.status != 'done'
           )`,
        params
    );

    if (staleRows.length === 0) {
        return 0;
    }

    const placeholders = staleRows.map(() => '?').join(',');
    await db.runAsync(
        `UPDATE incidents
         SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})`,
        staleRows.map(row => row.id)
    );

    return staleRows.length;
}

/**
 * Mark incidents with invalid commune_id as failed instead of deleting field data.
 * Returns the count of affected incidents.
 */
export async function deleteInvalidIncidents(db: SQLiteDatabase): Promise<number> {
    const invalidRows = await db.getAllAsync<{ id: number; commune_id: string }>(
        `SELECT id, commune_id FROM incidents WHERE synced = 0 AND (commune_id IS NULL OR commune_id NOT GLOB '[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-*')`
    );

    if (invalidRows.length === 0) {
        return 0;
    }

    for (const row of invalidRows) {
        await markIncidentSyncFailed(
            db,
            row.id,
            `Commune invalide: ${row.commune_id || 'vide'}`
        );
    }

    return invalidRows.length;
}
