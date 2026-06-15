import type { SQLiteDatabase } from 'expo-sqlite';

export type NetworkType = 'BT' | 'MT';

export interface IncidentTypeOptionRow {
  id: number;
  remote_id: string;
  network_type: NetworkType;
  name: string;
  active: number;
  sort_order: number;
  updated_at: string | null;
}

export interface DepartHtaOptionRow {
  id: number;
  remote_id: string;
  name: string;
  active: number;
  sort_order: number;
  updated_at: string | null;
}

export interface RemoteIncidentTypeOption {
  id: string;
  network_type: NetworkType;
  name: string;
  active?: boolean | null;
  sort_order?: number | null;
  updated_at?: string | null;
}

export interface RemoteDepartHtaOption {
  id: string;
  name: string;
  active?: boolean | null;
  sort_order?: number | null;
  updated_at?: string | null;
}

export async function getActiveIncidentTypesByNetwork(
  db: SQLiteDatabase,
  networkType: NetworkType
): Promise<IncidentTypeOptionRow[]> {
  return db.getAllAsync<IncidentTypeOptionRow>(
    `SELECT *
     FROM incident_type_options
     WHERE active = 1 AND network_type = ?
     ORDER BY sort_order ASC, name ASC`,
    [networkType]
  );
}

export async function getAllActiveIncidentTypes(db: SQLiteDatabase): Promise<IncidentTypeOptionRow[]> {
  return db.getAllAsync<IncidentTypeOptionRow>(
    `SELECT *
     FROM incident_type_options
     WHERE active = 1
     ORDER BY network_type ASC, sort_order ASC, name ASC`
  );
}

export async function getActiveDepartHtaOptions(db: SQLiteDatabase): Promise<DepartHtaOptionRow[]> {
  return db.getAllAsync<DepartHtaOptionRow>(
    `SELECT *
     FROM depart_hta_options
     WHERE active = 1
     ORDER BY sort_order ASC, name ASC`
  );
}

export async function upsertIncidentTypeOptionsFromServer(
  db: SQLiteDatabase,
  options: RemoteIncidentTypeOption[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE incident_type_options SET active = 0');
    for (const option of options) {
      await db.runAsync(
        `INSERT INTO incident_type_options (
          remote_id, network_type, name, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(remote_id) DO UPDATE SET
          network_type = excluded.network_type,
          name = excluded.name,
          active = excluded.active,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at`,
        [
          option.id,
          option.network_type,
          option.name,
          option.active === false ? 0 : 1,
          option.sort_order ?? 0,
          option.updated_at ?? null,
        ]
      );
    }
  });
}

export async function upsertDepartHtaOptionsFromServer(
  db: SQLiteDatabase,
  options: RemoteDepartHtaOption[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE depart_hta_options SET active = 0');
    for (const option of options) {
      await db.runAsync(
        `INSERT INTO depart_hta_options (
          remote_id, name, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(remote_id) DO UPDATE SET
          name = excluded.name,
          active = excluded.active,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at`,
        [
          option.id,
          option.name,
          option.active === false ? 0 : 1,
          option.sort_order ?? 0,
          option.updated_at ?? null,
        ]
      );
    }
  });
}
