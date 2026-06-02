import type { SQLiteDatabase } from 'expo-sqlite';

export interface CommuneRow {
    id: number;
    remote_id: string | null;
    name: string;
}

/**
 * Get all communes
 */
export async function getCommunes(db: SQLiteDatabase): Promise<CommuneRow[]> {
    return db.getAllAsync<CommuneRow>('SELECT * FROM communes ORDER BY name');
}

/**
 * Upsert communes from server
 */
export async function upsertCommunesFromServer(
    db: SQLiteDatabase,
    communes: { id: string; name: string }[]
): Promise<void> {
    for (const commune of communes) {
        await db.runAsync(
            `INSERT INTO communes (remote_id, name) VALUES (?, ?)
       ON CONFLICT(remote_id) DO UPDATE SET name = excluded.name`,
            [commune.id, commune.name]
        );
    }
}
