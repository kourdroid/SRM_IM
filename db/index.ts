import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Initialize the SQLite database schema
 */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL UNIQUE,
      remote_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('BT', 'MT')),
      date TEXT NOT NULL,
      village TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      incident_type TEXT NOT NULL,
      depart_hta TEXT,
      commune_id TEXT NOT NULL,
      equipment_used TEXT NOT NULL,
      description TEXT,
      reclamation INTEGER DEFAULT 0,
      reclamation_name TEXT,
      reclamation_by TEXT,
      created_by TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      gps_accuracy REAL,
      media_urls TEXT DEFAULT '[]',
      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')),
      sync_error TEXT,
      archived_at TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pending_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_incident_id INTEGER NOT NULL,
      local_uri TEXT NOT NULL,
      remote_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'uploaded', 'failed')),
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(local_incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_key TEXT NOT NULL UNIQUE,
      operation_type TEXT NOT NULL CHECK(operation_type IN ('create_incident', 'update_incident_status', 'upload_media', 'attach_media', 'sync_materials')),
      local_incident_id INTEGER NOT NULL,
      remote_incident_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'failed', 'done')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      error_code TEXT,
      is_terminal INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(local_incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incident_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_incident_id INTEGER NOT NULL,
      remote_incident_id TEXT,
      client_material_id TEXT NOT NULL UNIQUE,
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL CHECK(quantity > 0),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(local_incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS communes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id TEXT UNIQUE,
      name TEXT NOT NULL,
      region TEXT
    );

    CREATE TABLE IF NOT EXISTS incident_type_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id TEXT NOT NULL UNIQUE,
      network_type TEXT NOT NULL CHECK(network_type IN ('BT', 'MT')),
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS depart_hta_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_synced ON incidents(synced);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_by_date ON incidents(created_by, date DESC);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_by_created_at ON incidents(created_by, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_incidents_commune_id ON incidents(commune_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_status_created_at ON incidents(status, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_remote_id ON incidents(remote_id);
    CREATE INDEX IF NOT EXISTS idx_pending_uploads_status ON pending_uploads(status);
    CREATE INDEX IF NOT EXISTS idx_pending_uploads_incident ON pending_uploads(local_incident_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_operations_key ON sync_operations(operation_key);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_incident ON sync_operations(local_incident_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_runnable
      ON sync_operations(is_terminal, status, next_attempt_at, id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_type_incident
      ON sync_operations(operation_type, local_incident_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_status_updated_at
      ON sync_operations(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_incident_materials_local_incident ON incident_materials(local_incident_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_materials_client_id ON incident_materials(client_material_id);
    CREATE INDEX IF NOT EXISTS idx_incident_type_options_active_network_sort
      ON incident_type_options(active, network_type, sort_order, name);
    CREATE INDEX IF NOT EXISTS idx_depart_hta_options_active_sort
      ON depart_hta_options(active, sort_order, name);
  `);

  // Migration: Add reclamation_by column if missing (for existing installs)
  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN reclamation_by TEXT');
  } catch {
    // Column already exists - ignore
  }

  // Migration: Add region column to communes if missing
  try {
    await db.runAsync('ALTER TABLE communes ADD COLUMN region TEXT');
  } catch {
    // Column already exists - ignore
  }

  // Migration: Add GPS/media columns if missing
  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN latitude REAL');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN longitude REAL');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync("ALTER TABLE incidents ADD COLUMN media_urls TEXT DEFAULT '[]'");
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN client_id TEXT');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN gps_accuracy REAL');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync("ALTER TABLE incidents ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'");
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN sync_error TEXT');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN archived_at TEXT');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE incidents ADD COLUMN depart_hta TEXT');
  } catch {
    // Column already exists - ignore
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS incident_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_incident_id INTEGER NOT NULL,
      remote_incident_id TEXT,
      client_material_id TEXT NOT NULL UNIQUE,
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL CHECK(quantity > 0),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(local_incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );
  `);

  try {
    await db.runAsync('ALTER TABLE sync_operations ADD COLUMN operation_key TEXT');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE sync_operations ADD COLUMN next_attempt_at TEXT');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE sync_operations ADD COLUMN error_code TEXT');
  } catch {
    // Column already exists - ignore
  }

  try {
    await db.runAsync('ALTER TABLE sync_operations ADD COLUMN is_terminal INTEGER NOT NULL DEFAULT 0');
  } catch {
    // Column already exists - ignore
  }

  await migrateSyncOperationsForMaterials(db);

  await db.runAsync(`
    UPDATE incidents
    SET client_id = 'legacy-' || id || '-' || strftime('%s', COALESCE(created_at, CURRENT_TIMESTAMP))
    WHERE client_id IS NULL OR client_id = ''
  `);

  await db.withTransactionAsync(async () => {
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_client_id ON incidents(client_id)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incidents_sync_status ON incidents(sync_status)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incidents_created_by_archived_date ON incidents(created_by, archived_at, date DESC)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incidents_created_by_date ON incidents(created_by, date DESC)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incidents_created_by_created_at ON incidents(created_by, created_at DESC)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incidents_commune_id ON incidents(commune_id)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incidents_status_created_at ON incidents(status, created_at DESC)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incidents_depart_hta_created_at ON incidents(depart_hta, created_at DESC)');

    await db.runAsync(`
      UPDATE incidents
      SET sync_status = CASE WHEN synced = 1 THEN 'synced' ELSE sync_status END
      WHERE sync_status IS NULL OR sync_status = 'pending'
    `);

    await db.runAsync(`
      UPDATE sync_operations
      SET operation_key = operation_type || ':' || local_incident_id || ':' || id
      WHERE operation_key IS NULL OR operation_key = ''
    `);

    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_operations_key ON sync_operations(operation_key)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_sync_operations_next_attempt ON sync_operations(next_attempt_at)');
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_sync_operations_runnable
      ON sync_operations(is_terminal, status, next_attempt_at, id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_sync_operations_type_incident
      ON sync_operations(operation_type, local_incident_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_sync_operations_status_updated_at
      ON sync_operations(status, updated_at)`);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_incident_materials_local_incident ON incident_materials(local_incident_id)');
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_materials_client_id ON incident_materials(client_material_id)');
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_incident_type_options_active_network_sort
      ON incident_type_options(active, network_type, sort_order, name)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_depart_hta_options_active_sort
      ON depart_hta_options(active, sort_order, name)`);

    await db.runAsync(`
      INSERT INTO sync_operations (operation_key, operation_type, local_incident_id, payload_json, status, last_error)
      SELECT 'create_incident:' || client_id, 'create_incident', id, json_object('clientId', client_id), 'pending', sync_error
      FROM incidents
      WHERE synced = 0
        AND NOT EXISTS (
          SELECT 1 FROM sync_operations
          WHERE sync_operations.operation_key = 'create_incident:' || incidents.client_id
        )
    `);

    await db.runAsync(`
      INSERT INTO sync_operations (operation_key, operation_type, local_incident_id, payload_json, status, last_error)
      SELECT
        'upload_media:' || local_incident_id || ':legacy-' || abs(random()),
        'upload_media',
        local_incident_id,
        json_object('localUri', local_uri, 'clientMediaId', 'legacy-' || abs(random())),
        status,
        error_message
      FROM pending_uploads
      WHERE status IN ('pending', 'failed')
        AND NOT EXISTS (
          SELECT 1 FROM sync_operations
          WHERE sync_operations.local_incident_id = pending_uploads.local_incident_id
            AND sync_operations.operation_type = 'upload_media'
            AND sync_operations.payload_json LIKE '%' || pending_uploads.local_uri || '%'
        )
    `);
  });

  // NOTE: Do NOT seed communes with fake IDs (c1, c2, c3, c4).
  // Communes MUST be synced from Supabase to get correct UUIDs.
  // The sync.ts pullCommunes() function handles this on first launch.
}

async function migrateSyncOperationsForMaterials(db: SQLiteDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sync_operations'"
  );
  if (!table?.sql || table.sql.includes("'sync_materials'")) {
    return;
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_operations_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_key TEXT NOT NULL UNIQUE,
        operation_type TEXT NOT NULL CHECK(operation_type IN ('create_incident', 'update_incident_status', 'upload_media', 'attach_media', 'sync_materials')),
        local_incident_id INTEGER NOT NULL,
        remote_incident_id TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'failed', 'done')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        error_code TEXT,
        is_terminal INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(local_incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      );
    `);
    await db.runAsync(`
      INSERT OR IGNORE INTO sync_operations_next (
        id, operation_key, operation_type, local_incident_id, remote_incident_id,
        payload_json, status, attempt_count, next_attempt_at, error_code,
        is_terminal, last_error, created_at, updated_at
      )
      SELECT
        id,
        COALESCE(NULLIF(operation_key, ''), operation_type || ':' || local_incident_id || ':' || id),
        operation_type,
        local_incident_id,
        remote_incident_id,
        COALESCE(payload_json, '{}'),
        COALESCE(status, 'pending'),
        COALESCE(attempt_count, 0),
        next_attempt_at,
        error_code,
        COALESCE(is_terminal, 0),
        last_error,
        COALESCE(created_at, CURRENT_TIMESTAMP),
        COALESCE(updated_at, CURRENT_TIMESTAMP)
      FROM sync_operations
    `);
    await db.runAsync('DROP TABLE sync_operations');
    await db.runAsync('ALTER TABLE sync_operations_next RENAME TO sync_operations');
  });
}
