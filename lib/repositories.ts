/**
 * SQLite Incident Repository Implementation
 * 
 * This is an INFRASTRUCTURE layer adapter that implements the domain interface.
 * All SQLite-specific logic is encapsulated here.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { IIncidentRepository, IncidentEntity } from './domain';
import type { CreateIncidentInput, IncidentFromServer, IncidentStatus } from './schemas';

interface IncidentRow {
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
    synced: number;
    created_at: string;
    updated_at: string;
}

/**
 * Map database row to domain entity
 */
function mapRowToEntity(row: IncidentRow): IncidentEntity {
    return {
        id: row.id,
        remoteId: row.remote_id,
        type: row.type,
        date: new Date(row.date),
        village: row.village,
        status: row.status,
        incidentType: row.incident_type,
        departHta: row.depart_hta,
        communeId: row.commune_id,
        equipmentUsed: row.equipment_used,
        description: row.description,
        reclamation: row.reclamation === 1,
        reclamationName: row.reclamation_name,
        reclamationBy: row.reclamation_by,
        createdBy: row.created_by,
        latitude: row.latitude,
        longitude: row.longitude,
        synced: row.synced === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

export class SQLiteIncidentRepository implements IIncidentRepository {
    constructor(private readonly db: SQLiteDatabase) { }

    async findAll(): Promise<IncidentEntity[]> {
        const rows = await this.db.getAllAsync<IncidentRow>(
            'SELECT * FROM incidents ORDER BY created_at DESC'
        );
        return rows.map(mapRowToEntity);
    }

    async findByStatus(status: IncidentStatus): Promise<IncidentEntity[]> {
        const rows = await this.db.getAllAsync<IncidentRow>(
            'SELECT * FROM incidents WHERE status = ? ORDER BY created_at DESC',
            [status]
        );
        return rows.map(mapRowToEntity);
    }

    async findUnsynced(): Promise<IncidentEntity[]> {
        const rows = await this.db.getAllAsync<IncidentRow>(
            'SELECT * FROM incidents WHERE synced = 0'
        );
        return rows.map(mapRowToEntity);
    }

    async create(input: CreateIncidentInput, createdBy: string): Promise<number> {
        const clientId = `incident-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const result = await this.db.runAsync(
            `INSERT INTO incidents (
        client_id, type, date, village, incident_type, depart_hta, commune_id, equipment_used,
        description, reclamation, reclamation_name, reclamation_by, 
        created_by, media_urls, sync_status, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'pending', 0)`,
            [
                clientId,
                input.type,
                input.date,
                input.village,
                input.incident_type,
                input.depart_hta ?? null,
                input.commune_id,
                input.equipment_used,
                input.description || null,
                input.reclamation ? 1 : 0,
                input.reclamation_name || null,
                input.reclamation_by || null,
                createdBy,
            ]
        );
        return result.lastInsertRowId;
    }

    async updateStatus(id: number, status: IncidentStatus): Promise<void> {
        await this.db.runAsync(
            `UPDATE incidents
             SET status = ?, synced = 0, sync_status = 'pending', sync_error = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, id]
        );
    }

    async markSynced(ids: number[]): Promise<void> {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        await this.db.runAsync(
            `UPDATE incidents SET synced = 1, sync_status = 'synced', sync_error = NULL WHERE id IN (${placeholders})`,
            ids
        );
    }

    async upsertFromServer(incidents: IncidentFromServer[]): Promise<void> {
        for (const inc of incidents) {
            const safeClientId = inc.client_id || `remote-${inc.id}`;
            const safeCommuneId = inc.commune_id || '00000000-0000-0000-0000-000000000000';
            const safeType = (inc.type === 'BT' || inc.type === 'MT') ? inc.type : 'BT';
            const mediaUrls = JSON.stringify(inc.media_urls || []);

            await this.db.runAsync(
                `INSERT INTO incidents (
          client_id, remote_id, type, date, village, status, incident_type, depart_hta, commune_id,
          equipment_used, description, reclamation, reclamation_name,
          created_by, latitude, longitude, gps_accuracy, media_urls, sync_status, synced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 1, ?, ?)
        ON CONFLICT(remote_id) DO UPDATE SET
          client_id = COALESCE(incidents.client_id, excluded.client_id),
          depart_hta = excluded.depart_hta,
          status = excluded.status,
          media_urls = excluded.media_urls,
          sync_status = 'synced',
          sync_error = NULL,
          updated_at = excluded.updated_at`,
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
                    inc.latitude ?? null,
                    inc.longitude ?? null,
                    inc.gps_accuracy ?? null,
                    mediaUrls,
                    inc.created_at || new Date().toISOString(),
                    inc.updated_at || inc.created_at || new Date().toISOString(),
                ]
            );
        }
    }

    async deleteInvalid(): Promise<number> {
        // Get incidents with non-UUID commune_id
        const invalidRows = await this.db.getAllAsync<{ id: number; commune_id: string }>(
            `SELECT id, commune_id FROM incidents WHERE synced = 0 AND (
        commune_id IS NULL OR 
        commune_id NOT GLOB '[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-*'
      )`
        );

        if (invalidRows.length === 0) return 0;

        const ids = invalidRows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        await this.db.runAsync(
            `UPDATE incidents
             SET sync_status = 'failed', sync_error = 'Commune invalide', updated_at = CURRENT_TIMESTAMP
             WHERE id IN (${placeholders})`,
            ids
        );

        return invalidRows.length;
    }
}
