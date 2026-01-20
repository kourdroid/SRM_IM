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
        const result = await this.db.runAsync(
            `INSERT INTO incidents (
        type, date, village, incident_type, commune_id, equipment_used,
        description, reclamation, reclamation_name, reclamation_by, 
        created_by, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                input.type,
                input.date,
                input.village,
                input.incident_type,
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
            'UPDATE incidents SET status = ?, synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, id]
        );
    }

    async markSynced(ids: number[]): Promise<void> {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        await this.db.runAsync(
            `UPDATE incidents SET synced = 1 WHERE id IN (${placeholders})`,
            ids
        );
    }

    async upsertFromServer(incidents: IncidentFromServer[]): Promise<void> {
        // Filter out incidents with null commune_id (cannot store due to NOT NULL constraint)
        const validIncidents = incidents.filter((inc) => {
            if (!inc.commune_id) {
                console.warn(`Sync: Skipping server incident ${inc.id} - null commune_id`);
                return false;
            }
            return true;
        });

        for (const inc of validIncidents) {
            await this.db.runAsync(
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
                    inc.incident_type || 'General',
                    inc.commune_id,
                    inc.equipment_used || '',
                    inc.description || null,
                    inc.reclamation ? 1 : 0,
                    inc.reclamation_name || null,
                    inc.created_by,
                    inc.latitude ?? null,
                    inc.longitude ?? null,
                    inc.created_at,
                    inc.updated_at || inc.created_at,
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

        console.log('Deleting invalid incidents:', invalidRows.map(r => ({ id: r.id, commune_id: r.commune_id })));

        const ids = invalidRows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        await this.db.runAsync(
            `DELETE FROM incidents WHERE id IN (${placeholders})`,
            ids
        );

        return invalidRows.length;
    }
}
