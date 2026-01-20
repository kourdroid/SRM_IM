import type { SQLiteDatabase } from 'expo-sqlite';

// Types for incidents
export interface IncidentRow {
    id: number;
    remote_id: string | null;
    type: 'BT' | 'MT';
    date: string;
    village: string;
    status: 'open' | 'closed';
    incident_type: string;
    commune_id: string;
    equipment_used: string;
    description: string | null;
    reclamation: number;
    reclamation_name: string | null;
    reclamation_by: string | null;
    created_by: string;
    latitude: number | null;
    longitude: number | null;
    synced: number;
    created_at: string;
    updated_at: string;
}

export interface CreateIncidentInput {
    type: 'BT' | 'MT';
    date: string;
    village: string;
    incident_type: string;
    commune_id: string;
    equipment_used: string;
    description?: string;
    reclamation: boolean;
    reclamation_name?: string;
    reclamation_by?: string;
    created_by: string;
    latitude?: number;
    longitude?: number;
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
      type, date, village, incident_type, commune_id, equipment_used,
      description, reclamation, reclamation_name, reclamation_by, created_by, latitude, longitude, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
            incident.type,
            incident.date,
            incident.village,
            incident.incident_type,
            incident.commune_id,
            incident.equipment_used,
            incident.description || null,
            incident.reclamation ? 1 : 0,
            incident.reclamation_name || null,
            incident.reclamation_by || null,
            incident.created_by,
            incident.latitude || null,
            incident.longitude || null,
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
        'UPDATE incidents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
        `UPDATE incidents SET synced = 1 WHERE id IN (${placeholders})`,
        ids
    );
}

/**
 * Upsert incidents from server (for pull sync)
 */
export async function upsertIncidentsFromServer(
    db: SQLiteDatabase,
    incidents: Array<{
        id: string;
        type: 'BT' | 'MT';
        date: string;
        village: string;
        status: 'open' | 'closed';
        incident_type: string;
        commune_id: string | null;
        equipment_used: string;
        description?: string;
        reclamation: boolean;
        reclamation_name?: string;
        created_by: string;
        latitude?: number;
        longitude?: number;
        created_at: string;
        updated_at?: string;
    }>
): Promise<void> {
    // Filter out incidents with null/empty commune_id (SQLite has NOT NULL constraint)
    const validIncidents = incidents.filter((inc) => {
        if (!inc.commune_id) {
            console.warn(`Sync: Skipping server incident ${inc.id} - null commune_id`);
            return false;
        }
        return true;
    });

    for (const inc of validIncidents) {
        await db.runAsync(
            `INSERT INTO incidents (
        remote_id, type, date, village, status, incident_type, commune_id,
        equipment_used, description, reclamation, reclamation_name,
        created_by, latitude, longitude, synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(remote_id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at`,
            [
                inc.id,
                inc.type,
                inc.date,
                inc.village,
                inc.status,
                inc.incident_type,
                inc.commune_id,
                inc.equipment_used,
                inc.description || null,
                inc.reclamation ? 1 : 0,
                inc.reclamation_name || null,
                inc.created_by,
                inc.latitude || null,
                inc.longitude || null,
                inc.created_at,
                inc.updated_at || inc.created_at,
            ]
        );
    }
}

/**
 * Delete incidents with invalid commune_id (cannot be synced to Supabase)
 * Returns the count of deleted incidents
 */
export async function deleteInvalidIncidents(db: SQLiteDatabase): Promise<number> {
    // UUID validation pattern
    const uuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

    // First get the count
    const invalidRows = await db.getAllAsync<{ id: number; commune_id: string }>(
        `SELECT id, commune_id FROM incidents WHERE synced = 0 AND (commune_id IS NULL OR commune_id NOT GLOB '[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-*')`
    );

    if (invalidRows.length === 0) {
        return 0;
    }

    console.log('Deleting invalid incidents:', invalidRows.map(r => ({ id: r.id, commune_id: r.commune_id })));

    // Delete them
    const ids = invalidRows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
        `DELETE FROM incidents WHERE id IN (${placeholders})`,
        ids
    );

    return invalidRows.length;
}
