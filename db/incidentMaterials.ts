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

export async function upsertIncidentMaterialsFromServer(db: SQLiteDatabase, materials: {
  incident_id: string; client_material_id: string; material_name: string; quantity: number;
}[]): Promise<void> {
  for (const material of materials) {
    const incident = await db.getFirstAsync<{ id: number }>('SELECT id FROM incidents WHERE remote_id = ?', [material.incident_id]);
    if (!incident) continue;
    const pending = await db.getFirstAsync<{ id: number }>(`SELECT id FROM sync_operations
      WHERE local_incident_id = ? AND operation_type = 'sync_materials' AND status != 'done'`, [incident.id]);
    if (pending) continue;
    const existing = await db.getFirstAsync<{ local_incident_id: number }>(
      'SELECT local_incident_id FROM incident_materials WHERE client_material_id = ?', [material.client_material_id]);
    if (existing && existing.local_incident_id !== incident.id) throw new Error('Conflicting material identity; local records preserved');
    await db.runAsync(`INSERT INTO incident_materials
      (local_incident_id,remote_incident_id,client_material_id,material_name,quantity)
      SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM sync_operations
        WHERE local_incident_id = ? AND operation_type = 'sync_materials' AND status != 'done')
      ON CONFLICT(client_material_id) DO UPDATE SET
      remote_incident_id=excluded.remote_incident_id, material_name=excluded.material_name,
      quantity=excluded.quantity, updated_at=CURRENT_TIMESTAMP
      WHERE incident_materials.local_incident_id = excluded.local_incident_id`,
    [incident.id,material.incident_id,material.client_material_id,material.material_name,material.quantity,incident.id]);
  }
}
