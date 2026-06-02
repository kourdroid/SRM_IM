import type { SQLiteDatabase } from 'expo-sqlite';
import { upsertCommunesFromServer } from '../db/communes';
import {
    deleteStaleSyncedIncidents,
    deleteInvalidIncidents,
    getIncidentByLocalId,
    markIncidentSyncedWithRemoteId,
    markIncidentSyncFailed,
    markIncidentSyncing,
    updateIncidentMediaUrls,
    upsertIncidentsFromServer,
    type IncidentRow,
} from '../db/incidents';
import {
    enqueueAttachMedia,
    getRunnableSyncOperations,
    markSyncOperationDone,
    markSyncOperationFailed,
    markSyncOperationRunning,
    recoverMissingMediaUploadOperations,
    resetRunningSyncOperations,
    type SyncOperationRow,
} from '../db/syncOperations';
import { getSyncMetadata, setSyncMetadata } from '../db/syncMetadata';
import { uploadToSupabase } from './imageUtils';
import { isSupabaseNetworkError, supabase } from './supabase';

interface RemoteIncident {
    id: string;
    client_id?: string | null;
    status?: 'open' | 'closed' | null;
    media_urls?: string[] | null;
}

type PullIncident = RemoteIncident & {
    type?: 'BT' | 'MT' | null;
    date?: string | null;
    village?: string | null;
    incident_type?: string | null;
    commune_id?: string | null;
    equipment_used?: string | null;
    description?: string | null;
    reclamation?: boolean | null;
    reclamation_name?: string | null;
    created_by?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    gps_accuracy?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
};

interface UploadPayload {
    localUri: string;
    clientMediaId?: string;
}

interface AttachMediaPayload {
    remoteUrl: string;
    storagePath?: string;
    clientMediaId?: string;
}

interface StatusPayload {
    status: 'open' | 'closed';
}

export interface SyncOptions {
    reason?: 'startup' | 'foreground' | 'manual' | 'network' | 'post-create';
    forcePull?: boolean;
    forceReferenceData?: boolean;
    operationBatchSize?: number;
}

interface SyncProcessResult {
    affectedRemoteIncidentIds: string[];
    remoteWriteCount: number;
}

const INCIDENT_PULL_COLUMNS = [
    'id',
    'client_id',
    'type',
    'date',
    'village',
    'status',
    'incident_type',
    'commune_id',
    'equipment_used',
    'description',
    'reclamation',
    'reclamation_name',
    'created_by',
    'latitude',
    'longitude',
    'gps_accuracy',
    'media_urls',
    'created_at',
    'updated_at',
].join(', ');

const INCIDENT_PULL_PAGE_SIZE = 100;
const COMMUNE_PULL_INTERVAL_MS = 12 * 60 * 60 * 1000;

export async function syncAll(db: SQLiteDatabase, userId?: string, options: SyncOptions = {}): Promise<void> {
    debugLog('Sync: Starting...', options.reason || 'unknown');

    try {
        await resetRunningSyncOperations(db);
        await recoverMissingMediaUploadOperations(db);

        const invalidCount = await deleteInvalidIncidents(db);
        if (invalidCount > 0) {
            console.warn(`Sync: Marked ${invalidCount} incident(s) as failed because commune_id is invalid`);
        }

        await pullCommunes(db, options);
        await pullIncidents(db, userId, options);
        const result = await processSyncOperations(db, options.operationBatchSize ?? 20);
        if (result.affectedRemoteIncidentIds.length > 0) {
            await pullIncidentsByIds(db, result.affectedRemoteIncidentIds);
        } else if (result.remoteWriteCount > 0) {
            await pullIncidents(db, userId, { ...options, forcePull: true });
        }

        debugLog('Sync: Complete');
    } catch (error) {
        if (isSupabaseNetworkError(error)) {
            console.warn('Sync: Deferred because Supabase is unreachable');
        } else {
            console.error('Sync: Error', error);
        }
        throw error;
    }
}

export async function sync(db: SQLiteDatabase, userId?: string): Promise<void> {
    return syncAll(db, userId);
}

async function pullCommunes(db: SQLiteDatabase, options: SyncOptions): Promise<void> {
    const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM communes');
    const lastPulledAt = await getSyncMetadata(db, 'communes:lastPulledAt');
    const isStale = !lastPulledAt || Date.now() - new Date(lastPulledAt).getTime() > COMMUNE_PULL_INTERVAL_MS;
    const shouldPull = options.forceReferenceData || options.reason === 'manual' || isStale || (count?.count ?? 0) === 0;

    if (!shouldPull) {
        return;
    }

    const { data, error } = await supabase.from('communes').select('id, name').order('name');

    if (error) {
        if (isSupabaseNetworkError(error)) {
            console.warn('Sync: Failed to pull communes because Supabase is unreachable');
        } else {
            console.error('Sync: Failed to pull communes', error);
        }
        return;
    }

    if (data && data.length > 0) {
        await upsertCommunesFromServer(db, data);
        await setSyncMetadata(db, 'communes:lastPulledAt', new Date().toISOString());
        debugLog(`Sync: Pulled ${data.length} communes`);
    }
}

async function pullIncidents(db: SQLiteDatabase, userId?: string, options: SyncOptions = {}): Promise<void> {
    const cursorKey = `incidents:lastPulledAt:${userId || 'all'}`;
    const shouldFullPull = options.forcePull === true || options.reason === 'manual' || options.reason === 'startup';
    const lastPulledAt = shouldFullPull ? null : await getSyncMetadata(db, cursorKey);
    let maxUpdatedAt = lastPulledAt;
    let offset = 0;
    const pulledRemoteIds: string[] = [];

    while (true) {
        let query = supabase
            .from('incidents')
            .select(INCIDENT_PULL_COLUMNS)
            .order(lastPulledAt ? 'updated_at' : 'created_at', { ascending: Boolean(lastPulledAt) })
            .range(offset, offset + INCIDENT_PULL_PAGE_SIZE - 1);

        if (lastPulledAt) {
            query = query.gt('updated_at', lastPulledAt);
        }

        if (userId) {
            query = query.eq('created_by', userId);
        }

        const { data, error } = await query;

        if (error) {
            if (isSupabaseNetworkError(error)) {
                console.warn('Sync: Failed to pull incidents because Supabase is unreachable');
            } else {
                console.error('Sync: Failed to pull incidents', error);
            }
            return;
        }

        if (!data || data.length === 0) {
            break;
        }

        const incidents = mapPulledIncidents(data as unknown as PullIncident[]);
        if (shouldFullPull && userId) {
            pulledRemoteIds.push(...incidents.map(incident => incident.id));
        }
        await upsertIncidentsFromServer(db, incidents);
        maxUpdatedAt = getMaxUpdatedAt(maxUpdatedAt, incidents.map(incident => incident.updated_at));
        debugLog(`Sync: Pulled ${data.length} incidents`);

        if (data.length < INCIDENT_PULL_PAGE_SIZE) {
            break;
        }
        offset += INCIDENT_PULL_PAGE_SIZE;
    }

    if (shouldFullPull && userId) {
        const deletedCount = await deleteStaleSyncedIncidents(db, userId, pulledRemoteIds);
        if (deletedCount > 0) {
            debugLog(`Sync: Removed ${deletedCount} stale local incident(s) missing from Supabase`);
        }
    }

    if (maxUpdatedAt) {
        await setSyncMetadata(db, cursorKey, maxUpdatedAt);
    }
}

async function pullIncidentsByIds(db: SQLiteDatabase, remoteIncidentIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(remoteIncidentIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const { data, error } = await supabase
        .from('incidents')
        .select(INCIDENT_PULL_COLUMNS)
        .in('id', uniqueIds);

    if (error) {
        if (isSupabaseNetworkError(error)) {
            console.warn('Sync: Failed to refresh changed incidents because Supabase is unreachable');
        } else {
            console.error('Sync: Failed to refresh changed incidents', error);
        }
        return;
    }

    if (data && data.length > 0) {
        await upsertIncidentsFromServer(db, mapPulledIncidents(data as unknown as PullIncident[]));
        debugLog(`Sync: Refreshed ${data.length} changed incidents`);
    }
}

function mapPulledIncidents(data: PullIncident[]) {
    return data.map((incident) => ({
        id: incident.id,
        client_id: incident.client_id,
        type: incident.type === 'MT' ? 'MT' as const : 'BT' as const,
        date: incident.date || new Date().toISOString(),
        village: incident.village || 'Unknown',
        status: incident.status === 'closed' ? 'closed' as const : 'open' as const,
        incident_type: incident.incident_type || 'General',
        commune_id: incident.commune_id || null,
        equipment_used: incident.equipment_used || '',
        description: incident.description || undefined,
        reclamation: incident.reclamation === true,
        reclamation_name: incident.reclamation_name || undefined,
        created_by: incident.created_by || 'system',
        latitude: incident.latitude ?? undefined,
        longitude: incident.longitude ?? undefined,
        gps_accuracy: incident.gps_accuracy ?? null,
        media_urls: Array.isArray(incident.media_urls) ? incident.media_urls : [],
        created_at: incident.created_at || new Date().toISOString(),
        updated_at: incident.updated_at || undefined,
    }));
}

function getMaxUpdatedAt(current: string | null, values: (string | undefined)[]): string | null {
    return values.reduce<string | null>((max, value) => {
        if (!value) return max;
        if (!max) return value;
        return new Date(value).getTime() > new Date(max).getTime() ? value : max;
    }, current);
}

async function processSyncOperations(db: SQLiteDatabase, batchSize: number): Promise<SyncProcessResult> {
    const result: SyncProcessResult = { affectedRemoteIncidentIds: [], remoteWriteCount: 0 };

    for (let pass = 0; pass < 4; pass += 1) {
        const operations = await getRunnableSyncOperations(db, batchSize);
        if (operations.length === 0) {
            if (pass === 0) debugLog('Sync: No queued operations');
            return result;
        }

        debugLog(`Sync: Processing ${operations.length} queued operation(s)`);

        for (const operation of operations) {
            if (await shouldDeferOperationUntilIncidentExists(db, operation)) {
                continue;
            }

            await markSyncOperationRunning(db, operation.id);

            try {
                const remoteIncidentId = await processSyncOperation(db, operation);
                if (remoteIncidentId) {
                    result.affectedRemoteIncidentIds.push(remoteIncidentId);
                    result.remoteWriteCount += 1;
                }
                await markSyncOperationDone(db, operation.id);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown sync error';
                const failure = classifySyncError(message);
                await markSyncOperationFailed(db, operation.id, message, failure.errorCode, failure.isTerminal);
                await markIncidentFailureForOperation(db, operation, message);
                if (isSupabaseNetworkError(error)) {
                    console.warn(`Sync: Operation ${operation.id} deferred`, message);
                } else {
                    console.error(`Sync: Operation ${operation.id} failed`, message);
                }
            }
        }
    }

    return result;
}

async function processSyncOperation(
    db: SQLiteDatabase,
    operation: SyncOperationRow
): Promise<string | null> {
    if (operation.operation_type === 'create_incident') {
        return processCreateIncident(db, operation);
    }
    if (operation.operation_type === 'upload_media') {
        return processMediaUpload(db, operation);
    }
    if (operation.operation_type === 'attach_media') {
        return processAttachMedia(db, operation);
    }
    if (operation.operation_type === 'update_incident_status') {
        return processStatusUpdate(db, operation);
    }

    return null;
}

async function shouldDeferOperationUntilIncidentExists(
    db: SQLiteDatabase,
    operation: SyncOperationRow
): Promise<boolean> {
    if (
        operation.operation_type !== 'upload_media' &&
        operation.operation_type !== 'attach_media' &&
        operation.operation_type !== 'update_incident_status'
    ) {
        return false;
    }

    const incident = await getIncidentByLocalId(db, operation.local_incident_id);
    if (!incident) {
        return false;
    }

    if (operation.remote_incident_id || incident.remote_id) {
        return false;
    }

    debugLog(`Sync: Deferring ${operation.operation_type} until incident ${incident.id} has remote_id`);
    return true;
}

async function markIncidentFailureForOperation(
    db: SQLiteDatabase,
    operation: SyncOperationRow,
    message: string
): Promise<void> {
    if (operation.operation_type !== 'upload_media' && operation.operation_type !== 'attach_media') {
        await markIncidentSyncFailed(db, operation.local_incident_id, message);
        return;
    }

    const incident = await getIncidentByLocalId(db, operation.local_incident_id);
    if (!incident?.remote_id) {
        await markIncidentSyncFailed(db, operation.local_incident_id, message);
        return;
    }

    await db.runAsync(
        `UPDATE incidents
         SET synced = 1, sync_status = 'synced', sync_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [message, operation.local_incident_id]
    );
}

async function processCreateIncident(
    db: SQLiteDatabase,
    operation: SyncOperationRow
): Promise<string> {
    const incident = await requireIncident(db, operation.local_incident_id);
    await markIncidentSyncing(db, incident.id);

    if (!isValidUUID(incident.commune_id)) {
        throw new Error(`Commune invalide: ${incident.commune_id || 'vide'}`);
    }

    const existing = await findRemoteByClientId(incident.client_id);
    if (existing) {
        await markIncidentSyncedWithRemoteId(db, incident.id, existing.id);
        return existing.id;
    }

    const { data, error } = await supabase
        .from('incidents')
        .insert(toRemoteInsert(incident))
        .select('id')
        .single();

    if (error || !data?.id) {
        throw new Error(error?.message || 'Incident creation returned no remote id');
    }

    await markIncidentSyncedWithRemoteId(db, incident.id, data.id);
    return data.id;
}

async function processMediaUpload(
    db: SQLiteDatabase,
    operation: SyncOperationRow
): Promise<string> {
    const incident = await requireIncident(db, operation.local_incident_id);
    const payload = parsePayload<UploadPayload>(operation.payload_json);

    if (!payload.localUri) {
        throw new Error('Media upload payload is missing localUri');
    }

    if (!incident.remote_id) {
        throw new Error('Cannot upload media before incident has remote_id');
    }

    const clientMediaId = payload.clientMediaId || `media-${operation.id}`;
    const upload = await uploadToSupabase(payload.localUri, incident.remote_id, `${clientMediaId}.jpg`);
    await enqueueAttachMedia(
        db,
        incident.id,
        incident.remote_id,
        upload.publicUrl,
        clientMediaId,
        upload.storagePath
    );
    return incident.remote_id;
}

async function processAttachMedia(
    db: SQLiteDatabase,
    operation: SyncOperationRow
): Promise<string> {
    const incident = await requireIncident(db, operation.local_incident_id);
    const payload = parsePayload<AttachMediaPayload>(operation.payload_json);
    const remoteIncidentId = operation.remote_incident_id || incident.remote_id;

    if (!payload.remoteUrl) {
        throw new Error('Attach media payload is missing remoteUrl');
    }

    if (!remoteIncidentId) {
        throw new Error('Cannot attach media before incident has remote_id');
    }

    await appendRemoteMedia(remoteIncidentId, payload);

    const nextLocalUrls = uniqueUrls([...parseMediaUrls(incident.media_urls), payload.remoteUrl]);
    await updateIncidentMediaUrls(db, incident.id, nextLocalUrls);
    await markIncidentSyncedWithRemoteId(db, incident.id, remoteIncidentId);
    return remoteIncidentId;
}

async function processStatusUpdate(
    db: SQLiteDatabase,
    operation: SyncOperationRow
): Promise<string> {
    const incident = await requireIncident(db, operation.local_incident_id);
    const payload = parsePayload<StatusPayload>(operation.payload_json);

    if (!incident.remote_id) {
        throw new Error('Cannot update status before incident has remote_id');
    }

    const { data, error } = await supabase
        .from('incidents')
        .select('status')
        .eq('id', incident.remote_id)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    const remote = data as RemoteIncident;
    if (remote.status === 'closed') {
        await db.runAsync(
            `UPDATE incidents
             SET status = 'closed', synced = 1, sync_status = 'synced', sync_error = NULL
             WHERE id = ?`,
            [incident.id]
        );
        return incident.remote_id;
    }

    const { error: updateError } = await supabase
        .from('incidents')
        .update({ status: payload.status })
        .eq('id', incident.remote_id);

    if (updateError) {
        throw new Error(updateError.message);
    }

    await markIncidentSyncedWithRemoteId(db, incident.id, incident.remote_id);
    return incident.remote_id;
}

async function requireIncident(
    db: SQLiteDatabase,
    localIncidentId: number
): Promise<IncidentRow> {
    const incident = await getIncidentByLocalId(db, localIncidentId);
    if (!incident) {
        throw new Error(`Local incident ${localIncidentId} was not found`);
    }
    return incident;
}

async function findRemoteByClientId(clientId: string): Promise<RemoteIncident | null> {
    const { data, error } = await supabase
        .from('incidents')
        .select('id, client_id, status, media_urls')
        .eq('client_id', clientId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data as RemoteIncident | null;
}

function toRemoteInsert(incident: IncidentRow) {
    return {
        client_id: incident.client_id,
        type: incident.type,
        date: incident.date,
        village: incident.village,
        status: incident.status,
        incident_type: incident.incident_type,
        commune_id: incident.commune_id,
        equipment_used: incident.equipment_used,
        description: incident.description,
        reclamation: incident.reclamation === 1,
        reclamation_name: incident.reclamation_name,
        reclamation_by: incident.reclamation_by,
        latitude: incident.latitude,
        longitude: incident.longitude,
        gps_accuracy: incident.gps_accuracy,
    };
}

function parsePayload<T>(payloadJson: string): T {
    try {
        return JSON.parse(payloadJson) as T;
    } catch {
        throw new Error('Invalid sync operation payload');
    }
}

function parseMediaUrls(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string') : [];
    } catch {
        return [];
    }
}

function uniqueUrls(urls: string[]): string[] {
    return Array.from(new Set(urls.filter(Boolean)));
}

function isValidUUID(str: string | null): boolean {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

async function appendRemoteMedia(
    remoteIncidentId: string,
    payload: AttachMediaPayload
): Promise<void> {
    const { error: rpcError } = await supabase.rpc('append_incident_media', {
        p_incident_id: remoteIncidentId,
        p_client_media_id: payload.clientMediaId || `media-${Date.now()}`,
        p_storage_path: payload.storagePath || '',
        p_public_url: payload.remoteUrl,
    });

    if (!rpcError) {
        return;
    }

    const { data, error } = await supabase
        .from('incidents')
        .select('media_urls')
        .eq('id', remoteIncidentId)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    const remoteMediaUrls = Array.isArray(data?.media_urls) ? data.media_urls : [];
    const nextRemoteUrls = uniqueUrls([...remoteMediaUrls, payload.remoteUrl]);

    const { error: updateError } = await supabase
        .from('incidents')
        .update({ media_urls: nextRemoteUrls })
        .eq('id', remoteIncidentId);

    if (updateError) {
        throw new Error(updateError.message);
    }
}

function classifySyncError(message: string): { errorCode: string; isTerminal: boolean } {
    const lower = message.toLowerCase();
    if (lower.includes('commune invalide') || lower.includes('invalid commune')) {
        return { errorCode: 'INVALID_COMMUNE', isTerminal: true };
    }
    if (lower.includes('local incident') && lower.includes('not found')) {
        return { errorCode: 'LOCAL_INCIDENT_MISSING', isTerminal: true };
    }
    if (lower.includes('no such file') || lower.includes('file') && lower.includes('not found')) {
        return { errorCode: 'LOCAL_MEDIA_MISSING', isTerminal: true };
    }
    if (lower.includes('jwt') || lower.includes('auth') || lower.includes('permission')) {
        return { errorCode: 'AUTH_OR_PERMISSION', isTerminal: false };
    }
    return { errorCode: 'NETWORK_OR_REMOTE', isTerminal: false };
}

function debugLog(...args: unknown[]): void {
    if (__DEV__) {
        console.log(...args);
    }
}
