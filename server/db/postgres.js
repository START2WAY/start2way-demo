const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
let pool;

async function initDB(dbUrl) {
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required for PostgreSQL');
  }
  pool = new Pool({ connectionString: dbUrl });
  
  const client = await pool.connect();
  try {
    await client.query(`
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
        version BIGINT,
        payload TEXT,
        company_id TEXT,
        user_id TEXT,
        updated_at TEXT,
        PRIMARY KEY (entity, entity_id)
      );

      CREATE TABLE IF NOT EXISTS changelog (
        sequence SERIAL PRIMARY KEY,
        id TEXT,
        operation_id TEXT,
        entity TEXT,
        entity_id TEXT,
        operation TEXT,
        version BIGINT,
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
        version BIGINT,
        sequence BIGINT,
        timestamp TEXT,
        request_fingerprint TEXT
      );

      CREATE TABLE IF NOT EXISTS failed_operations (
        sequence SERIAL PRIMARY KEY,
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

      CREATE TABLE IF NOT EXISTS sync_conflicts (
        conflict_id TEXT PRIMARY KEY,
        operation_id TEXT UNIQUE,
        entity TEXT,
        entity_id TEXT,
        client_base_version BIGINT,
        server_version_at_conflict BIGINT,
        client_payload TEXT,
        server_payload TEXT,
        actor_type TEXT,
        actor_id TEXT,
        user_id TEXT,
        company_id TEXT,
        employment_id TEXT,
        status TEXT,
        reason TEXT,
        request_fingerprint TEXT,
        resolved_at TEXT,
        resolution_type TEXT,
        resolution_operation_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      
    `);
  } finally {
    client.release();
  }
}


function getClient() {
  const store = als.getStore();
  if (store && store.client) return store.client;
  return pool;
}

function runInTransaction(fn) {
  return async function(...args) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await als.run({ client }, async () => {
        return await fn(...args);
      });
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };
}

async function queryOne(sql, params) {
  const res = await getClient().query(sql, params);
  return res.rows[0];
}

async function queryAll(sql, params) {
  const res = await getClient().query(sql, params);
  return res.rows;
}

async function execute(sql, params) {
  const res = await getClient().query(sql, params);
  return res.rowCount;
}

const dal = {
  entities: {
    get: async (entity, id) => queryOne('SELECT * FROM entities WHERE entity = $1 AND entity_id = $2 FOR UPDATE', [entity, id]),
    insert: async (entity, id, version, payload, companyId, userId, updatedAt) => 
      execute('INSERT INTO entities (entity, entity_id, version, payload, company_id, user_id, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [entity, id, version, payload, companyId, userId, updatedAt]),
    update: async (entity, id, version, payload, companyId, userId, updatedAt) =>
      execute('UPDATE entities SET version = $1, payload = $2, company_id = $3, user_id = $4, updated_at = $5 WHERE entity = $6 AND entity_id = $7', [version, payload, companyId, userId, updatedAt, entity, id]),
    updatePayload: async (entity, id, payload) =>
      execute('UPDATE entities SET payload = $1 WHERE entity = $2 AND entity_id = $3', [payload, entity, id]),
    getAll: async (entity) => {
      if (entity) return queryAll('SELECT * FROM entities WHERE entity = $1', [entity]);
      return queryAll('SELECT * FROM entities');
    },
    getAllPayloads: async (entity) => queryAll('SELECT payload FROM entities WHERE entity = $1', [entity]),
    getAllEntityIdAndPayloads: async (entity) => queryAll('SELECT entity_id, payload FROM entities WHERE entity = $1', [entity]),
    getPayload: async (entity, id) => queryOne('SELECT payload FROM entities WHERE entity = $1 AND entity_id = $2', [entity, id]),
    getPayloadAndCompany: async (entity, id) => queryOne('SELECT payload, company_id FROM entities WHERE entity = $1 AND entity_id = $2', [entity, id]),
    getVersion: async (entity, id) => queryOne('SELECT version FROM entities WHERE entity = $1 AND entity_id = $2', [entity, id]),
    getActiveUsagesByVehicle: async (vehicleId) => queryAll("SELECT entity_id FROM entities WHERE entity = $1 AND payload::jsonb->>'vehicle_id' = $2 AND payload::jsonb->>'ended_at' IS NULL", ['vehicle_usages', vehicleId]),
    getActiveUsagesByUser: async (userId) => queryAll("SELECT entity_id FROM entities WHERE entity = $1 AND payload::jsonb->>'user_id' = $2 AND payload::jsonb->>'ended_at' IS NULL", ['vehicle_usages', userId]),
  },
  
  changelog: {
    insert: async (id, opId, entity, entityId, operation, version, occurredAt, actorType, actorId, userId, companyId, payload) => {
      const res = await getClient().query('INSERT INTO changelog (id, operation_id, entity, entity_id, operation, version, occurred_at, actor_type, actor_id, user_id, company_id, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING sequence', [id, opId, entity, entityId, operation, version, occurredAt, actorType, actorId, userId, companyId, payload]);
      return { lastInsertRowid: res.rows[0].sequence };
    },
    getAfterSequence: async (after, limit) => queryAll('SELECT * FROM changelog WHERE sequence > $1 ORDER BY sequence ASC LIMIT $2', [after, limit])
  },

  locks: {
    acquireXactLock: async (namespace, key) => getClient().query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [namespace, key])
  },
  operations: {
    getProcessed: async (opId) => queryOne('SELECT * FROM processed_operations WHERE operation_id = $1', [opId]),
    insertProcessed: async (opId, status, entity, entityId, version, sequence, timestamp, fingerprint) =>
      execute('INSERT INTO processed_operations (operation_id, status, entity, entity_id, version, sequence, timestamp, request_fingerprint) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
      [opId, status, entity, entityId, version, sequence, timestamp, fingerprint]),
    insertFailed: async (opId, entity, entityId, reason, occurredAt, actorType, actorId, userId, companyId, payload) =>
      execute('INSERT INTO failed_operations (operation_id, entity, entity_id, reason, occurred_at, actor_type, actor_id, user_id, company_id, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', 
      [opId, entity, entityId, reason, occurredAt, actorType, actorId, userId, companyId, payload]),
    getRecentFailed: async () => queryAll('SELECT * FROM failed_operations ORDER BY sequence DESC LIMIT 100')
  },

  conflicts: {
    insert: async (conflictId, opId, entity, entityId, clientVersion, serverVersion, clientPayload, serverPayload, actorType, actorId, userId, companyId, employmentId, status, reason, requestFingerprint, createdAt, updatedAt) =>
      execute('INSERT INTO sync_conflicts (conflict_id, operation_id, entity, entity_id, client_base_version, server_version_at_conflict, client_payload, server_payload, actor_type, actor_id, user_id, company_id, employment_id, status, reason, request_fingerprint, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)', 
      [conflictId, opId, entity, entityId, clientVersion, serverVersion, clientPayload, serverPayload, actorType, actorId, userId, companyId, employmentId, status, reason, requestFingerprint, createdAt, updatedAt]),
    getByOpId: async (opId) => queryOne('SELECT * FROM sync_conflicts WHERE operation_id = $1', [opId]),
    getById: async (id) => queryOne('SELECT * FROM sync_conflicts WHERE conflict_id = $1', [id]),
    queryAll: async (query, params) => {
      let pq = query;
      params = params || [];
      for (let i = 1; i <= params.length; i++) {
        pq = pq.replace('?', `$${i}`);
      }
      return queryAll(pq, params);
    }
  },

  sessions: {
    getValidSession: async (token, nowStr) => queryOne('SELECT * FROM sessions WHERE token = $1 AND expires_at > $2', [token, nowStr]),
    createForUser: async (token, userId, role, createdAt, expiresAt) => execute('INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)', [token, userId, role, createdAt, expiresAt]),
    createForCompany: async (token, companyId, role, createdAt, expiresAt) => execute('INSERT INTO sessions (token, company_id, role, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)', [token, companyId, role, createdAt, expiresAt])
  },

  
};

module.exports = {
  initDB,
  runInTransaction,
  dal,
  getRawPool: () => pool
};
