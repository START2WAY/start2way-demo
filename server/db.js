const Database = require('better-sqlite3');

let db;

function initDB(dbPath) {
  if (process.env.NODE_ENV === 'production' && !dbPath) {
    console.error("FATAL: DB_PATH must be provided in production.");
    process.exit(1);
  }
  if (!dbPath) {
    dbPath = 's2w_recovery.db';
  }
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Schema setup
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT,
      company_id TEXT,
      role TEXT,
      created_at TEXT,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS entities (
      entity TEXT,
      entity_id TEXT,
      version INTEGER,
      payload TEXT,
      company_id TEXT,
      user_id TEXT,
      updated_at TEXT,
      PRIMARY KEY (entity, entity_id)
    );

    CREATE TABLE IF NOT EXISTS changelog (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT,
      operation_id TEXT,
      entity TEXT,
      entity_id TEXT,
      operation TEXT,
      version INTEGER,
      occurred_at TEXT,
      actor_type TEXT,
      actor_id TEXT,
      user_id TEXT,
      company_id TEXT,
      payload TEXT
    );

    CREATE TABLE IF NOT EXISTS processed_operations (
      operation_id TEXT PRIMARY KEY,
      status TEXT,
      entity TEXT,
      entity_id TEXT,
      version INTEGER,
      sequence INTEGER,
      timestamp TEXT,
      request_fingerprint TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_conflicts (
      conflict_id TEXT PRIMARY KEY,
      operation_id TEXT UNIQUE,
      entity TEXT,
      entity_id TEXT,
      client_base_version INTEGER,
      server_version_at_conflict INTEGER,
      client_payload TEXT,
      server_payload TEXT,
      actor_type TEXT,
      actor_id TEXT,
      user_id TEXT,
      company_id TEXT,
      employment_id TEXT,
      status TEXT,
      reason TEXT,
      created_at TEXT,
      updated_at TEXT,
      resolved_at TEXT,
      resolution_type TEXT,
      resolution_operation_id TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_conflicts_op_id ON sync_conflicts(operation_id);

    CREATE TABLE IF NOT EXISTS failed_operations (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT,
      entity TEXT,
      entity_id TEXT,
      reason TEXT,
      occurred_at TEXT,
      actor_type TEXT,
      actor_id TEXT,
      user_id TEXT,
      company_id TEXT,
      payload TEXT
    );

    CREATE TABLE IF NOT EXISTS airtable_mirror_status (
      entity TEXT,
      entity_id TEXT,
      central_version INTEGER,
      status TEXT,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      next_attempt_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (entity, entity_id)
    );
  `);

  // Migrations
  const migrations = [
    "ALTER TABLE sync_conflicts ADD COLUMN company_id TEXT;",
    "ALTER TABLE sync_conflicts ADD COLUMN employment_id TEXT;",
    "ALTER TABLE sync_conflicts ADD COLUMN status TEXT;",
    "ALTER TABLE sync_conflicts ADD COLUMN reason TEXT;",
    "ALTER TABLE sync_conflicts ADD COLUMN request_fingerprint TEXT;"
  ];
  for (let sql of migrations) {
    try { db.exec(sql); } catch (e) { /* ignore if column exists */ }
  }
}

// Transaction wrapper
function runInTransaction(fn) {
  return db.transaction(fn);
}

// DAL Methods
const dal = {
  entities: {
    get: (entity, id) => db.prepare('SELECT * FROM entities WHERE entity = ? AND entity_id = ?').get(entity, id),
    insert: (entity, id, version, payload, companyId, userId, updatedAt) => 
      db.prepare('INSERT INTO entities (entity, entity_id, version, payload, company_id, user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(entity, id, version, payload, companyId, userId, updatedAt),
    update: (entity, id, version, payload, companyId, userId, updatedAt) =>
      db.prepare('UPDATE entities SET version = ?, payload = ?, company_id = ?, user_id = ?, updated_at = ? WHERE entity = ? AND entity_id = ?')
        .run(version, payload, companyId, userId, updatedAt, entity, id),
    updatePayload: (entity, id, payload) =>
      db.prepare('UPDATE entities SET payload = ? WHERE entity = ? AND entity_id = ?').run(payload, entity, id),
    getAll: (entity) => {
      if (entity) {
        return db.prepare('SELECT * FROM entities WHERE entity = ?').all(entity);
      }
      return db.prepare('SELECT * FROM entities').all();
    },
    getAllPayloads: (entity) => db.prepare('SELECT payload FROM entities WHERE entity = ?').all(entity),
    getAllEntityIdAndPayloads: (entity) => db.prepare('SELECT entity_id, payload FROM entities WHERE entity = ?').all(entity),
    getPayload: (entity, id) => db.prepare('SELECT payload FROM entities WHERE entity = ? AND entity_id = ?').get(entity, id),
    getPayloadAndCompany: (entity, id) => db.prepare('SELECT payload, company_id FROM entities WHERE entity=? AND entity_id=?').get(entity, id),
    getVersion: (entity, id) => db.prepare('SELECT version FROM entities WHERE entity = ? AND entity_id = ?').get(entity, id),
    getActiveUsagesByVehicle: (vehicleId) => db.prepare("SELECT entity_id FROM entities WHERE entity = ? AND json_extract(payload, '$.vehicle_id') = ? AND json_extract(payload, '$.ended_at') IS NULL").all('vehicle_usages', vehicleId),
    getActiveUsagesByUser: (userId) => db.prepare("SELECT entity_id FROM entities WHERE entity = ? AND json_extract(payload, '$.user_id') = ? AND json_extract(payload, '$.ended_at') IS NULL").all('vehicle_usages', userId),
  },
  
  changelog: {
    insert: (id, opId, entity, entityId, operation, version, occurredAt, actorType, actorId, userId, companyId, payload) =>
      db.prepare('INSERT INTO changelog (id, operation_id, entity, entity_id, operation, version, occurred_at, actor_type, actor_id, user_id, company_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, opId, entity, entityId, operation, version, occurredAt, actorType, actorId, userId, companyId, payload),
    getAfterSequence: (after, limit) => db.prepare('SELECT * FROM changelog WHERE sequence > ? ORDER BY sequence ASC LIMIT ?').all(after, limit)
  },

  operations: {
    getProcessed: (opId) => db.prepare('SELECT * FROM processed_operations WHERE operation_id = ?').get(opId),
    insertProcessed: (opId, status, entity, entityId, version, sequence, timestamp, fingerprint) =>
      db.prepare('INSERT INTO processed_operations (operation_id, status, entity, entity_id, version, sequence, timestamp, request_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(opId, status, entity, entityId, version, sequence, timestamp, fingerprint),
    insertFailed: (opId, entity, entityId, reason, occurredAt, actorType, actorId, userId, companyId, payload) =>
      db.prepare('INSERT INTO failed_operations (operation_id, entity, entity_id, reason, occurred_at, actor_type, actor_id, user_id, company_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(opId, entity, entityId, reason, occurredAt, actorType, actorId, userId, companyId, payload),
    getRecentFailed: () => db.prepare('SELECT * FROM failed_operations ORDER BY sequence DESC LIMIT 100').all()
  },

  conflicts: {
    insert: (conflictId, opId, entity, entityId, clientVersion, serverVersion, clientPayload, serverPayload, actorType, actorId, userId, companyId, employmentId, status, reason, requestFingerprint, createdAt, updatedAt) =>
      db.prepare('INSERT INTO sync_conflicts (conflict_id, operation_id, entity, entity_id, client_base_version, server_version_at_conflict, client_payload, server_payload, actor_type, actor_id, user_id, company_id, employment_id, status, reason, request_fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(conflictId, opId, entity, entityId, clientVersion, serverVersion, clientPayload, serverPayload, actorType, actorId, userId, companyId, employmentId, status, reason, requestFingerprint, createdAt, updatedAt),
    getByOpId: (opId) => db.prepare('SELECT * FROM sync_conflicts WHERE operation_id = ?').get(opId),
    getById: (id) => db.prepare('SELECT * FROM sync_conflicts WHERE conflict_id = ?').get(id),
    queryAll: (query, params) => db.prepare(query).all(...params)
  },

  sessions: {
    getValidSession: (token, nowStr) => db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, nowStr),
    createForUser: (token, userId, role, createdAt, expiresAt) => db.prepare('INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(token, userId, role, createdAt, expiresAt),
    createForCompany: (token, companyId, role, createdAt, expiresAt) => db.prepare('INSERT INTO sessions (token, company_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(token, companyId, role, createdAt, expiresAt)
  },

  airtable: {
    upsertStatus: (entity, entityId, centralVersion, status, updatedAt) =>
      db.prepare(`
        INSERT INTO airtable_mirror_status (entity, entity_id, central_version, status, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(entity, entity_id) DO UPDATE SET
        central_version = excluded.central_version,
        status = excluded.status,
        updated_at = excluded.updated_at,
        retry_count = 0,
        last_error = NULL
      `).run(entity, entityId, centralVersion, status, updatedAt),

    insertStatus: (entity, entityId, centralVersion, status, updatedAt) =>
      db.prepare('INSERT INTO airtable_mirror_status (entity, entity_id, central_version, status, updated_at) VALUES (?, ?, ?, ?, ?)').run(entity, entityId, centralVersion, status, updatedAt),
    updateStatus: (status, entity, entityId, centralVersion) =>
      db.prepare('UPDATE airtable_mirror_status SET status = ? WHERE entity = ? AND entity_id = ? AND central_version = ?').run(status, entity, entityId, centralVersion),
    updateStatusError: (status, lastError, entity, entityId, centralVersion) =>
      db.prepare('UPDATE airtable_mirror_status SET status = ?, last_error = ?, retry_count = retry_count + 1 WHERE entity = ? AND entity_id = ? AND central_version = ?').run(status, lastError, entity, entityId, centralVersion),
    getPendingQueue: (now) => db.prepare(`SELECT * FROM airtable_mirror_status WHERE status IN ('PENDING', 'FAILED_RETRYABLE') AND (next_attempt_at IS NULL OR next_attempt_at <= ?) LIMIT 10`).all(now)
  }
};

module.exports = {
  initDB,
  runInTransaction,
  dal
};
