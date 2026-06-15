import type { SQLiteDatabase } from 'expo-sqlite';
import type { IncidentMaterialInput } from '../lib/materials';

export interface IncidentMaterialRow {
  id: number;
  local_incident_id: number;
  remote_incident_id: string | null;
  client_material_id: string;
  material_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export async function insertIncidentMaterials(
  db: SQLiteDatabase,
  localIncidentId: number,
  materials: IncidentMaterialInput[]
): Promise<void> {
  for (const material of materials) {
    await db.runAsync(
      `INSERT INTO incident_materials (
        local_incident_id, client_material_id, material_name, quantity
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(client_material_id) DO UPDATE SET
        material_name = excluded.material_name,
        quantity = excluded.quantity,
        updated_at = CURRENT_TIMESTAMP`,
      [localIncidentId, material.client_material_id, material.material_name, material.quantity]
    );
  }
}

export async function getIncidentMaterialsByLocalId(
  db: SQLiteDatabase,
  localIncidentId: number
): Promise<IncidentMaterialRow[]> {
  return db.getAllAsync<IncidentMaterialRow>(
    `SELECT * FROM incident_materials
     WHERE local_incident_id = ?
     ORDER BY id ASC`,
    [localIncidentId]
  );
}

export async function markIncidentMaterialsSynced(
  db: SQLiteDatabase,
  localIncidentId: number,
  remoteIncidentId: string
): Promise<void> {
  await db.runAsync(
    `UPDATE incident_materials
     SET remote_incident_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE local_incident_id = ?`,
    [remoteIncidentId, localIncidentId]
  );
}
