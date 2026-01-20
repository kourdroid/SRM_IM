import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Initialize the SQLite database schema
 */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('BT', 'MT')),
      date TEXT NOT NULL,
      village TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      incident_type TEXT NOT NULL,
      commune_id TEXT NOT NULL,
      equipment_used TEXT NOT NULL,
      description TEXT,
      reclamation INTEGER DEFAULT 0,
      reclamation_name TEXT,
      reclamation_by TEXT,
      created_by TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS communes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id TEXT UNIQUE,
      name TEXT NOT NULL,
      region TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_synced ON incidents(synced);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_remote_id ON incidents(remote_id);
  `);

  // Migration: Add reclamation_by column if missing (for existing installs)
  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN reclamation_by TEXT');
  } catch (e) {
    // Column already exists - ignore
  }

  // Migration: Add region column to communes if missing
  try {
    await db.runAsync('ALTER TABLE communes ADD COLUMN region TEXT');
  } catch (e) {
    // Column already exists - ignore
  }

  // NOTE: Do NOT seed communes with fake IDs (c1, c2, c3, c4).
  // Communes MUST be synced from Supabase to get correct UUIDs.
  // The sync.ts pullCommunes() function handles this on first launch.
}

