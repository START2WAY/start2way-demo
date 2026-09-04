const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database initialization
let dbPath = process.env.DB_PATH;
if (process.env.NODE_ENV === 'production' && !dbPath) {
  console.error("FATAL: DB_PATH must be provided in production.");
  process.exit(1);
}
if (!dbPath) {
  dbPath = 's2w_recovery.db';
}
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 1. Schema setup
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

// 2. Idempotent Migrations
const migrations = [
  "ALTER TABLE sync_conflicts ADD COLUMN company_id TEXT;",
  "ALTER TABLE sync_conflicts ADD COLUMN employment_id TEXT;",
  "ALTER TABLE sync_conflicts ADD COLUMN status TEXT;",
  "ALTER TABLE sync_conflicts ADD COLUMN reason TEXT;",
  "ALTER TABLE sync_conflicts ADD COLUMN request_fingerprint TEXT;",
  "ALTER TABLE sync_conflicts ADD COLUMN resolution_from_server_version INTEGER;",
  "ALTER TABLE sync_conflicts ADD COLUMN resolution_to_server_version INTEGER;"
];
for (let sql of migrations) {
  try { db.exec(sql); } catch (e) { /* ignore if column exists */ }
}

// Prepared statements
const getEntityStmt = db.prepare('SELECT * FROM entities WHERE entity = ? AND entity_id = ?');
const insertEntityStmt = db.prepare('INSERT INTO entities (entity, entity_id, version, payload, company_id, user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
const updateEntityStmt = db.prepare('UPDATE entities SET version = ?, payload = ?, company_id = ?, user_id = ?, updated_at = ? WHERE entity = ? AND entity_id = ?');
const insertChangelogStmt = db.prepare(`
  INSERT INTO changelog (id, operation_id, entity, entity_id, operation, version, occurred_at, actor_type, actor_id, user_id, company_id, payload)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getOpStmt = db.prepare('SELECT * FROM processed_operations WHERE operation_id = ?');
const insertOpStmt = db.prepare('INSERT INTO processed_operations (operation_id, status, entity, entity_id, version, sequence, timestamp, request_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const insertConflictStmt = db.prepare(`
  INSERT INTO sync_conflicts (conflict_id, operation_id, entity, entity_id, client_base_version, server_version_at_conflict, client_payload, server_payload, actor_type, actor_id, user_id, company_id, employment_id, status, reason, request_fingerprint, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getConflictByOpStmt = db.prepare('SELECT * FROM sync_conflicts WHERE operation_id = ?');

const insertFailedOpStmt = db.prepare(`
  INSERT INTO failed_operations (operation_id, entity, entity_id, reason, occurred_at, actor_type, actor_id, user_id, company_id, payload)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function recordFailedOperation(reqData, reason) {
  const { operation_id, entity, entity_id, payload, clientType, actorId, userId, companyId } = reqData;
  const now = new Date().toISOString();
  let sanitized = sanitizePayload(entity, payload, clientType);
  
  if (sanitized) {
    sanitized = { ...sanitized };
    delete sanitized.secret_token;
    delete sanitized.password;
    delete sanitized.pin_code;
  }
  
  insertFailedOpStmt.run(
    operation_id || 'UNKNOWN',
    entity || 'UNKNOWN',
    entity_id || 'UNKNOWN',
    reason,
    now,
    clientType,
    actorId,
    userId || null,
    companyId || null,
    JSON.stringify(sanitized)
  );
}


// Deterministic JSON stringify
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// Fingerprint calculation
function calculateFingerprint(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}


function isConflictAlreadyApplied(conflict, currentEntity) {
  if (!currentEntity || !currentEntity.payload) return false;
  
  let clientPayload = {};
  try { clientPayload = JSON.parse(conflict.client_payload); } catch(e) {}
  let currentPayload = {};
  try { currentPayload = JSON.parse(currentEntity.payload); } catch(e) {}

  let comparedFieldCount = 0;

  if (conflict.entity === 'employments') {
    const fieldsToCheck = ['status', 'depart_at'];
    for (const f of fieldsToCheck) {
      if (clientPayload[f] !== undefined) {
        if (clientPayload[f] !== currentPayload[f]) return false;
        comparedFieldCount++;
      }
    }
    return comparedFieldCount > 0;
  }
  
  if (conflict.entity === 'feuillets') {
    const isSignatureIntention = clientPayload.signature_method !== undefined || 
                                 clientPayload.integrity_hash !== undefined || 
                                 clientPayload.signed_at !== undefined;
    
    if (isSignatureIntention) {
      if (clientPayload.signature_method !== undefined && currentPayload.signature_method !== clientPayload.signature_method) return false;
      if (clientPayload.integrity_hash !== undefined && currentPayload.integrity_hash !== clientPayload.integrity_hash) return false;
      if (clientPayload.signed_at !== undefined && currentPayload.signed_at !== clientPayload.signed_at) return false;
      
      if (currentPayload.status !== 'SIGNED' && currentPayload.status !== 'SEALED_CONFIRMED') return false;
      comparedFieldCount++;
    } else {
      const fieldsToCheck = ['status', 'hours', 'description', 'company_notes'];
      for (const f of fieldsToCheck) {
        if (clientPayload[f] !== undefined) {
          if (clientPayload[f] !== currentPayload[f]) return false;
          comparedFieldCount++;
        }
      }
    }
    return comparedFieldCount > 0;
  }
  
  return false;
}


// ----------------------------------------------------
// AUTH & HASHING
// ----------------------------------------------------
const SALT_SIZE = 16;
const KEY_LEN = 64;

function hashSecret(secret) {
  if (!secret) return null;
  if (secret.startsWith('$scrypt$')) return secret; // already hashed
  const salt = crypto.randomBytes(SALT_SIZE).toString('hex');
  const derivedKey = crypto.scryptSync(secret, salt, KEY_LEN).toString('hex');
  return `$scrypt$${salt}$${derivedKey}`;
}

function verifySecret(secret, hashStr) {
  if (!secret || !hashStr) return false;
  if (!hashStr.startsWith('$scrypt$')) {
    // Legacy plaintext support during transition
    return secret === hashStr;
  }
  const parts = hashStr.split('$');
  const salt = parts[2];
  const storedKey = parts[3];
  const derivedKey = crypto.scryptSync(secret, salt, KEY_LEN).toString('hex');
  return derivedKey === storedKey;
}

function getUserAuth(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token) {
    token = req.query.token;
  }
  
  if (token) {
    const session = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, new Date().toISOString());
    if (session) return session;
  }
  return null;
}

// UUID helper
function uuidv4() {
  return crypto.randomUUID();
}

// Sanitization functions
const ALLOWED_ENTITIES = ['employments', 'feuillets', 'segments', 'vehicle_usages', 'event_logs', 'day_declarations', 'documents'];

function sanitizeForEmployee(entityType, payload) {
  if (!payload) return payload;
  let p = { ...payload };
  // Keep only employee-safe fields
  if (entityType === 'employments') {
    return {
      id: p.id,
      company_id: p.company_id,
      user_id: p.user_id,
      status: p.status,
      title: p.title,
      start_date: p.start_date,
      end_date: p.end_date
    };
  }
  if (entityType === 'feuillets') {
    return {
      id: p.id,
      session_id: p.session_id,
      user_id: p.user_id,
      company_id: p.company_id,
      employment_id: p.employment_id,
      date: p.date,
      month_str: p.month_str,
      signature_method: p.signature_method,
      signature_path: p.signature_path,
      pin_code: p.pin_code,
      total_a_sec: p.total_a_sec,
      total_b_sec: p.total_b_sec,
      total_c_sec: p.total_c_sec,
      total_d_sec: p.total_d_sec,
      total_a: p.total_a,
      total_b: p.total_b,
      total_c: p.total_c,
      total_d: p.total_d,
      status: p.status,
      status_sync: p.status_sync,
      integrity_hash: p.integrity_hash,
      generated_at: p.generated_at,
      signed_at: p.signed_at,
      signature_data: p.signature_data,
      employee_snapshot: p.employee_snapshot,
      company_snapshot: p.company_snapshot
    };
  }
  if (entityType === 'segments') {
    return {
      id: p.id,
      session_id: p.session_id,
      user_id: p.user_id,
      employment_id: p.employment_id,
      category: p.category,
      started_at: p.started_at,
      ended_at: p.ended_at,
      duration_sec: p.duration_sec,
      business_timezone: p.business_timezone,
      business_date: p.business_date,
      company_id: p.company_id
    };
  }
  if (entityType === 'vehicle_usages') {
    return {
      id: p.id,
      user_id: p.user_id,
      employment_id: p.employment_id,
      business_date: p.business_date,
      business_timezone: p.business_timezone,
      vehicle_id: p.vehicle_id,
      plate_snapshot: p.plate_snapshot,
      started_at: p.started_at,
      ended_at: p.ended_at,
      odometer_start: p.odometer_start,
      odometer_end: p.odometer_end
    };
  }
  if (entityType === 'event_logs') {
    return {
      id: p.id,
      session_id: p.session_id,
      user_id: p.user_id,
      employment_id: p.employment_id,
      event_type: p.event_type,
      business_date: p.business_date,
      business_timezone: p.business_timezone,
      client_timestamp: p.client_timestamp,
      gps_status: p.gps_status,
      gps_latitude: p.gps_latitude,
      gps_longitude: p.gps_longitude,
      gps_accuracy: p.gps_accuracy,
      gps_captured_at: p.gps_captured_at,
      gps_position_timestamp: p.gps_position_timestamp,
      gps_source: p.gps_source,
      gps_error_code: p.gps_error_code
    };
  }
  if (entityType === 'day_declarations') {
    return {
      id: p.id,
      user_id: p.user_id,
      employment_id: p.employment_id,
      business_date: p.business_date,
      day_type: p.day_type,
      declared_at: p.declared_at,
      declared_by: p.declared_by,
      reason_note: p.reason_note
    };
  }
  
  if (entityType === 'users') {
    delete p.password;
    delete p.pin_code;
    return p;
  }
  if (entityType === 'companies') {
    delete p.password;
    return p;
  }

  return p; // fallback
}

function sanitizeForCompany(entityType, payload) {
  if (!payload) return payload;
  let p = { ...payload };
  if (entityType === 'employments') {
    return {
      id: p.id,
      company_id: p.company_id,
      user_id: p.user_id,
      status: p.status,
      title: p.title,
      start_date: p.start_date,
      end_date: p.end_date,
      hourly_rate: p.hourly_rate // company can see rate
    };
  }
  if (entityType === 'feuillets') {
    return {
      id: p.id,
      employment_id: p.employment_id,
      date: p.date,
      hours: p.hours,
      status: p.status,
      description: p.description,
      company_notes: p.company_notes // company specific
    };
  }
  if (entityType === 'segments') {
    return {
      id: p.id,
      session_id: p.session_id,
      user_id: p.user_id,
      employment_id: p.employment_id,
      category: p.category,
      started_at: p.started_at,
      ended_at: p.ended_at,
      duration_sec: p.duration_sec,
      business_timezone: p.business_timezone,
      business_date: p.business_date,
      business_date: p.business_date,
      company_id: p.company_id
    };
  }
  if (entityType === 'event_logs') {
    return {
      id: p.id,
      session_id: p.session_id,
      user_id: p.user_id,
      employment_id: p.employment_id,
      event_type: p.event_type,
      client_timestamp: p.client_timestamp,
      gps_status: p.gps_status,
      gps_latitude: p.gps_latitude,
      gps_longitude: p.gps_longitude,
      gps_accuracy: p.gps_accuracy,
      gps_captured_at: p.gps_captured_at,
      gps_position_timestamp: p.gps_position_timestamp,
      gps_source: p.gps_source,
      gps_error_code: p.gps_error_code
    };
  }
  if (entityType === 'day_declarations') {
    return {
      id: p.id,
      user_id: p.user_id,
      employment_id: p.employment_id,
      business_date: p.business_date,
      day_type: p.day_type,
      declared_at: p.declared_at,
      declared_by: p.declared_by,
      reason_note: p.reason_note
    };
  }
  
  if (entityType === 'users') {
    delete p.password;
    delete p.pin_code;
    return p;
  }
  if (entityType === 'companies') {
    delete p.password;
    return p;
  }

  return p;
}

function sanitizeForTech(entityType, payload) {
  // Tech sees most things, but strip purely secret keys if any
  if (!payload) return payload;
  let p = { ...payload };
  delete p.secret_token;
  delete p.password;
  delete p.pin_code;
  
  if (entityType === 'users') {
    delete p.password;
    delete p.pin_code;
    return p;
  }
  if (entityType === 'companies') {
    delete p.password;
    return p;
  }

  return p;
}

function sanitizePayload(entityType, payload, clientType) {
  if (clientType === 'EMPLOYEE_APP') return sanitizeForEmployee(entityType, payload);
  if (clientType === 'COMPANY_PANEL') return sanitizeForCompany(entityType, payload);
  if (clientType === 'START2WAY_TECH_PANEL') return sanitizeForTech(entityType, payload);
  return payload;
}

// Apply mutation
const applyMutation = db.transaction((reqData) => {
  let { operation_id, entity, entity_id, version, operation, payload, clientType, actorId, userId, companyId, requestFingerprint } = reqData;

  // 1. Idempotency Check
  const existingOp = getOpStmt.get(operation_id);
  if (existingOp) {
    if (!existingOp.request_fingerprint) {
      recordFailedOperation(reqData, 'LEGACY_OPERATION_FINGERPRINT_MISSING');
      return { error: 'LEGACY_OPERATION_FINGERPRINT_MISSING', status: 409 };
    }
    if (existingOp.request_fingerprint !== requestFingerprint) {
      recordFailedOperation(reqData, 'OPERATION_ID_REUSE_MISMATCH');
      return { error: 'OPERATION_ID_REUSE_MISMATCH', status: 409 };
    }
    return { status: 'ack', sequence: existingOp.sequence, version: existingOp.version };
  }

  const existingConflictGlobal = getConflictByOpStmt.get(operation_id);
  if (existingConflictGlobal) {
    if (!existingConflictGlobal.request_fingerprint) {
      recordFailedOperation(reqData, 'LEGACY_CONFLICT_FINGERPRINT_MISSING');
      return { error: 'LEGACY_CONFLICT_FINGERPRINT_MISSING', status: 409 };
    }
    if (existingConflictGlobal.request_fingerprint !== requestFingerprint) {
      recordFailedOperation(reqData, 'OPERATION_ID_REUSE_MISMATCH');
      return { error: 'OPERATION_ID_REUSE_MISMATCH', status: 409 };
    }
  }


  // 1.5 Security & Scope Checks
  const existingEntity = getEntityStmt.get(entity, entity_id);

  if (clientType === 'START2WAY_TECH_PANEL') {
    if (entity === 'vehicle_usages') {
      recordFailedOperation(reqData, 'TECH_VEHICLE_USAGE_MUTATION_FORBIDDEN');
      return { error: 'TECH_VEHICLE_USAGE_MUTATION_FORBIDDEN', status: 403 };
    }
  }

  if (clientType === 'COMPANY_PANEL') {
    if (entity === 'employments') {
      if (!existingEntity) {
        recordFailedOperation(reqData, 'COMPANY_EMPLOYMENT_CREATE_FORBIDDEN');
        return { error: 'COMPANY_EMPLOYMENT_CREATE_FORBIDDEN', status: 403 };
      }
      if (existingEntity.company_id !== companyId) {
        recordFailedOperation(reqData, 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH');
        return { error: 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH', status: 403 };
      }
      if (payload && payload.company_id && payload.company_id !== existingEntity.company_id) {
        recordFailedOperation(reqData, 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH');
        return { error: 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH', status: 403 };
      }
      if (payload && payload.user_id && payload.user_id !== existingEntity.user_id) {
        recordFailedOperation(reqData, 'EMPLOYMENT_USER_SCOPE_MISMATCH');
        return { error: 'EMPLOYMENT_USER_SCOPE_MISMATCH', status: 403 };
      }
      
      // Strict allowlist: merge only allowed fields
      if (payload) {
        let currentPayload = null;
        try { currentPayload = JSON.parse(existingEntity.payload); } catch(e){ currentPayload = {}; }
        if (payload.status !== undefined) currentPayload.status = payload.status;
        if (payload.depart_at !== undefined) currentPayload.depart_at = payload.depart_at;
        payload = currentPayload;
        reqData.payload = payload;
      }
      
      userId = existingEntity.user_id;
      companyId = existingEntity.company_id;
    } else if (entity === 'feuillets') {
      recordFailedOperation(reqData, 'COMPANY_FEUILLET_MUTATION_FORBIDDEN');
      return { error: 'COMPANY_FEUILLET_MUTATION_FORBIDDEN', status: 403 };
    } else if (entity === 'vehicle_usages') {
      recordFailedOperation(reqData, 'COMPANY_VEHICLE_USAGE_MUTATION_FORBIDDEN');
      return { error: 'COMPANY_VEHICLE_USAGE_MUTATION_FORBIDDEN', status: 403 };
    }
  }

  if (entity === 'feuillets' || entity === 'segments' || entity === 'vehicle_usages' || entity === 'event_logs') {
    if (!payload || !payload.employment_id) {
      recordFailedOperation(reqData, 'MISSING_EMPLOYMENT_ID');
      return { error: 'MISSING_EMPLOYMENT_ID', status: 403 };
    }
    const employment = getEntityStmt.get('employments', payload.employment_id);
    if (!employment) {
      recordFailedOperation(reqData, 'EMPLOYMENT_NOT_FOUND');
      return { error: 'EMPLOYMENT_NOT_FOUND', status: 403 };
    }
    if (payload.company_id && payload.company_id !== employment.company_id) {
      recordFailedOperation(reqData, 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH');
      return { error: 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH', status: 403 };
    }
    if (payload.user_id && payload.user_id !== employment.user_id) {
      recordFailedOperation(reqData, 'EMPLOYMENT_USER_SCOPE_MISMATCH');
      return { error: 'EMPLOYMENT_USER_SCOPE_MISMATCH', status: 403 };
    }
    if (clientType === 'EMPLOYEE_APP' && employment.user_id !== userId) {
      recordFailedOperation(reqData, 'USER_SCOPE_FORBIDDEN');
      return { error: 'USER_SCOPE_FORBIDDEN', status: 403 };
    }
    
    if (entity === 'segments') {
      const startedAt = new Date(payload.started_at).getTime();
      const endedAt = new Date(payload.ended_at).getTime();
      if (isNaN(startedAt) || isNaN(endedAt) || endedAt <= startedAt) {
        recordFailedOperation(reqData, 'INVALID_SEGMENT_TIMESTAMPS');
        return { error: 'INVALID_SEGMENT_TIMESTAMPS', status: 400 };
      }
      if (!['A', 'B', 'C', 'D'].includes(payload.category)) {
        recordFailedOperation(reqData, 'INVALID_SEGMENT_CATEGORY');
        return { error: 'INVALID_SEGMENT_CATEGORY', status: 400 };
      }
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: payload.business_timezone });
      } catch (e) {
        recordFailedOperation(reqData, 'INVALID_SEGMENT_TIMEZONE');
        return { error: 'INVALID_SEGMENT_TIMEZONE', status: 400 };
      }
      
      const diffSecs = Math.round((endedAt - startedAt) / 1000);
      if (Math.abs(diffSecs - payload.duration_sec) > 5) {
        recordFailedOperation(reqData, 'INVALID_SEGMENT_DURATION');
        return { error: 'INVALID_SEGMENT_DURATION', status: 400 };
      }
      if (!payload.business_date) {
        recordFailedOperation(reqData, 'MISSING_SEGMENT_BUSINESS_DATE');
        return { error: 'MISSING_SEGMENT_BUSINESS_DATE', status: 400 };
      }

      // Check business_date against business_timezone
      const startedDateObj = new Date(startedAt);
      const formatter = new Intl.DateTimeFormat('en-CA', { // 'en-CA' outputs YYYY-MM-DD format
        timeZone: payload.business_timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const expectedBusinessDate = formatter.format(startedDateObj);
      if (payload.business_date !== expectedBusinessDate) {
        recordFailedOperation(reqData, 'INVALID_SEGMENT_BUSINESS_DATE');
        return { error: 'INVALID_SEGMENT_BUSINESS_DATE', status: 400 };
      }
    }
    
    if (entity === 'vehicle_usages') {
      if (existingEntity) {
        let currentPayload = null;
        try { currentPayload = JSON.parse(existingEntity.payload); } catch(e){}
        
        if (currentPayload) {
          if (currentPayload.ended_at && currentPayload.odometer_end != null) {
            recordFailedOperation(reqData, 'CLOSED_VEHICLE_USAGE_IMMUTABLE');
            return { error: 'CLOSED_VEHICLE_USAGE_IMMUTABLE', status: 403 };
          }
          
          const immutableFields = ['id', 'user_id', 'employment_id', 'vehicle_id', 'plate_snapshot', 'business_date', 'business_timezone', 'started_at', 'odometer_start'];
          for (let field of immutableFields) {
            if (payload[field] !== undefined && payload[field] !== currentPayload[field]) {
              console.log(`IMMUTABLE FAIL on ${field}: payload=${payload[field]}, current=${currentPayload[field]}`);
              recordFailedOperation(reqData, 'VEHICLE_USAGE_IMMUTABLE_FIELD');
              return { error: 'VEHICLE_USAGE_IMMUTABLE_FIELD', status: 403 };
            }
          }
        }
      }
      
      if (payload.ended_at != null || payload.odometer_end != null) {
        if (!payload.ended_at || payload.odometer_end == null) {
          recordFailedOperation(reqData, 'INVALID_VEHICLE_USAGE_CLOSURE');
          return { error: 'INVALID_VEHICLE_USAGE_CLOSURE', status: 400 };
        }
        
        const startedAt = new Date(payload.started_at).getTime();
        const endedAt = new Date(payload.ended_at).getTime();
        if (isNaN(startedAt) || isNaN(endedAt) || endedAt < startedAt) {
          recordFailedOperation(reqData, 'INVALID_VEHICLE_USAGE_TIMESTAMPS');
          return { error: 'INVALID_VEHICLE_USAGE_TIMESTAMPS', status: 400 };
        }
        if (payload.odometer_end < payload.odometer_start) {
          recordFailedOperation(reqData, 'INVALID_VEHICLE_USAGE_ODOMETER');
          return { error: 'INVALID_VEHICLE_USAGE_ODOMETER', status: 400 };
        }
      }
    }
    // F4 Feuillet Snapshot Immutability Check
    if (entity === 'feuillets' && existingEntity) {
      if (operation === 'UPDATE') {
        let currentPayload = null;
        try { currentPayload = JSON.parse(existingEntity.payload); } catch(e){}
        
        if (currentPayload) {
          if (currentPayload.employee_snapshot && payload.employee_snapshot) {
            const curr = currentPayload.employee_snapshot;
            const next = payload.employee_snapshot;
            if (curr.user_id !== next.user_id || curr.first_name !== next.first_name || curr.last_name !== next.last_name) {
              console.log(`IMMUTABLE FAIL on feuillets employee_snapshot`);
              recordFailedOperation(reqData, 'FEUILLET_SNAPSHOT_IMMUTABLE');
              return { error: 'FEUILLET_SNAPSHOT_IMMUTABLE', status: 403 };
            }
          }
          if (currentPayload.company_snapshot && payload.company_snapshot) {
            const curr = currentPayload.company_snapshot;
            const next = payload.company_snapshot;
            if (curr.company_id !== next.company_id || curr.name !== next.name) {
              console.log(`IMMUTABLE FAIL on feuillets company_snapshot`);
              recordFailedOperation(reqData, 'FEUILLET_SNAPSHOT_IMMUTABLE');
              return { error: 'FEUILLET_SNAPSHOT_IMMUTABLE', status: 403 };
            }
          }
        }
      }
    }
    
    // F3 GPS Immutability Check
    if (entity === 'event_logs' && existingEntity) {
      if (operation === 'UPDATE') {
        let currentPayload = null;
        try { currentPayload = JSON.parse(existingEntity.payload); } catch(e){}
        
        if (currentPayload && currentPayload.gps_status === 'CAPTURED') {
          const immutableFields = ['business_date', 'business_timezone', 'gps_status', 'gps_latitude', 'gps_longitude', 'gps_accuracy', 'gps_captured_at', 'gps_position_timestamp', 'gps_source'];
          for (let field of immutableFields) {
            // Un champ GPS "CAPTURED" ne peut pas être modifié s'il est différent, 
            // mais on accepte les envois idempotents (strictement identiques)
            if (payload[field] !== undefined && payload[field] !== currentPayload[field]) {
              console.log(`IMMUTABLE FAIL on event_logs ${field}: payload=${payload[field]}, current=${currentPayload[field]}`);
              recordFailedOperation(reqData, 'EVENT_LOG_GPS_IMMUTABLE');
              return { error: 'EVENT_LOG_GPS_IMMUTABLE', status: 403 };
            }
          }
        }
      }
    }
    
    // Derive central authority
    userId = employment.user_id;
    companyId = employment.company_id;
    payload.user_id = userId;
    payload.company_id = companyId;
  }

  if (existingEntity && entity === 'employments') {
    userId = existingEntity.user_id;
    companyId = existingEntity.company_id;
  }

  // 2. Version Check
  let currentServerVersion = 0;
  
  if (existingEntity) {
    currentServerVersion = existingEntity.version;
  }

  const clientBaseVersion = version !== undefined && version !== null ? version : (entity === 'segments' ? 0 : 1);
  console.log(`[DEBUG] entity=${entity} entity_id=${entity_id} clientBaseVersion=${clientBaseVersion} currentServerVersion=${currentServerVersion}`);

  if (existingEntity && clientBaseVersion !== currentServerVersion) {
    // VERSION CONFLICT
    const existingConflict = getConflictByOpStmt.get(operation_id);

    let conflictId = existingConflict ? existingConflict.conflict_id : uuidv4();
    
    if (!existingConflict) {
      const now = new Date().toISOString();
      const employmentId = payload ? payload.employment_id : null;
      insertConflictStmt.run(
        conflictId, operation_id, entity, entity_id, clientBaseVersion, currentServerVersion,
        JSON.stringify(payload), existingEntity.payload, clientType, actorId, userId, companyId, employmentId,
        'OPEN', 'VERSION_CONFLICT', requestFingerprint, now, now
      );
    }

    return { 
      error: 'VERSION_CONFLICT', 
      status: 409, 
      conflict_id: conflictId,
      entity,
      entity_id,
      client_base_version: clientBaseVersion,
      server_version: currentServerVersion
    };
  }

  // 3 & 4. Write entity and changelog
  const newVersion = existingEntity ? currentServerVersion + 1 : 1;
  const now = new Date().toISOString();
  
  // Hash secrets for users
  if (entity === 'users' && payload) {
    if (payload.password && !payload.password.startsWith('$scrypt$')) {
      payload.password = hashSecret(payload.password);
    }
    if (payload.pin_code && !payload.pin_code.startsWith('$scrypt$')) {
      payload.pin_code = hashSecret(payload.pin_code);
    }
  }

  const payloadStr = JSON.stringify(payload);

  if (existingEntity) {
    updateEntityStmt.run(newVersion, payloadStr, companyId, userId, now, entity, entity_id);
  } else {
    insertEntityStmt.run(entity, entity_id, newVersion, payloadStr, companyId, userId, now);
  }

  const logId = uuidv4();
  const info = insertChangelogStmt.run(logId, operation_id, entity, entity_id, operation, newVersion, now, clientType, actorId, userId, companyId, payloadStr);
  const sequence = info.lastInsertRowid;

  // 5. Write processed_operations
  insertOpStmt.run(operation_id, 'COMPLETED', entity, entity_id, newVersion, sequence, now, requestFingerprint);

  if (entity === 'employments' || entity === 'feuillets' || entity === 'segments') {
    db.prepare(`
      INSERT INTO airtable_mirror_status (entity, entity_id, central_version, status, updated_at)
      VALUES (?, ?, ?, 'PENDING', ?)
      ON CONFLICT(entity, entity_id) DO UPDATE SET 
        central_version = excluded.central_version,
        status = 'PENDING',
        retry_count = 0,
        last_error = NULL,
        next_attempt_at = NULL,
        updated_at = excluded.updated_at
    `).run(entity, entity_id, newVersion, now);
  }

  return { status: 'ack', sequence, version: newVersion };
});

// Endpoints
app.get('/health', (req, res) => res.send('OK'));

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'MISSING_CREDENTIALS' });

  const users = db.prepare("SELECT entity_id, payload FROM entities WHERE entity = 'users'").all();
  let foundUser = null;
  let userPayload = null;

  for (const u of users) {
    try {
      const p = JSON.parse(u.payload);
      if (p.email === email && verifySecret(password, p.password)) {
        foundUser = u.entity_id;
        userPayload = p;
        break;
      }
    } catch(e) {}
  }

  // Also check companies for legacy/simple company login
  let foundCompany = null;
  let companyPayload = null;
  if (!foundUser) {
    const companies = db.prepare("SELECT entity_id, payload FROM entities WHERE entity = 'companies'").all();
    for (const c of companies) {
      try {
        const p = JSON.parse(c.payload);
        if (p.email === email && verifySecret(password, p.password)) {
          foundCompany = c.entity_id;
          companyPayload = p;
          break;
        }
      } catch(e) {}
    }
  }

  if (!foundUser && !foundCompany) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  if (foundUser) {
    // If it's a tech user
    const role = userPayload.role === 'tech' ? 'tech' : 'salarie';
    db.prepare('INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      token, foundUser, role, new Date().toISOString(), expiresAt.toISOString()
    );
    return res.json({ token, user: sanitizeForEmployee('users', userPayload) });
  } else {
    db.prepare('INSERT INTO sessions (token, company_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      token, foundCompany, 'company', new Date().toISOString(), expiresAt.toISOString()
    );
    return res.json({ token, company: sanitizeForCompany('companies', companyPayload) });
  }
});


// ----------------------------------------------------
// BINARY DOCUMENT STORAGE
// ----------------------------------------------------
const fs = require('fs');
const path = require('path');
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.post('/api/documents/:id/file', (req, res) => {
  const auth = getUserAuth(req);
  if (!auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const documentId = req.params.id;
  const { fileData, ext } = req.body;
  if (!fileData || !ext) return res.status(400).json({ error: 'MISSING_FILE_DATA' });

  if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext.toLowerCase())) {
    return res.status(400).json({ error: 'INVALID_EXTENSION' });
  }

  // The client must have created the document entity in the database first
  // Verify authorization: the user or company uploading must be the owner or authorized
  const docEnt = db.prepare("SELECT payload FROM entities WHERE entity = 'documents' AND entity_id = ?").get(documentId);
  if (!docEnt) return res.status(404).json({ error: 'DOCUMENT_METADATA_NOT_FOUND' });
  
  const payload = JSON.parse(docEnt.payload);
  if (auth.user_id && payload.owner_user_id !== auth.user_id && payload.user_id !== auth.user_id) return res.status(403).json({ error: 'FORBIDDEN' });
  if (auth.company_id && payload.company_id !== auth.company_id && !payload.employment_id) return res.status(403).json({ error: 'FORBIDDEN' });

  const buffer = Buffer.from(fileData.split(',')[1] || fileData, 'base64');
  if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'FILE_TOO_LARGE' });

  const filePath = path.join(UPLOADS_DIR, documentId + '.' + ext);
  fs.writeFileSync(filePath, buffer);

  // Mark as uploaded in DB
  payload.file_status = 'UPLOADED';
  payload.file_ext = ext;
  db.prepare("UPDATE entities SET payload = ? WHERE entity = 'documents' AND entity_id = ?").run(JSON.stringify(payload), documentId);

  res.json({ success: true });
});

app.get('/api/documents/:id/file', (req, res) => {
  const auth = getUserAuth(req);
  if (!auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const documentId = req.params.id;
  const docEnt = db.prepare("SELECT payload FROM entities WHERE entity = 'documents' AND entity_id = ?").get(documentId);
  if (!docEnt) return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });

  const payload = JSON.parse(docEnt.payload);
  const ext = payload.file_ext || 'pdf';
  const filePath = path.join(UPLOADS_DIR, documentId + '.' + ext);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND' });
  }

  // Authorisation logic : must map to scoping logic (PERSONAL, PROFESSIONAL, EMPLOYMENT_SCOPED, COMPANY)
  let allowed = false;
  if (auth.role === 'tech') allowed = true;
  else if (auth.user_id) {
    if (payload.user_id === auth.user_id || payload.owner_user_id === auth.user_id) allowed = true;
  }
  else if (auth.company_id) {
    if (payload.company_id === auth.company_id) allowed = true;
    else if (payload.scope === 'EMPLOYMENT_SCOPED' && payload.employment_id) {
      const emp = db.prepare("SELECT payload FROM entities WHERE entity = 'employments' AND entity_id = ?").get(payload.employment_id);
      if (emp) {
        const empData = JSON.parse(emp.payload);
        if (empData.company_id === auth.company_id) allowed = true;
      }
    } else if (payload.scope === 'PROFESSIONAL' && payload.user_id) {
      // Allow company if they have an active employment with this user
      const emps = db.prepare("SELECT payload FROM entities WHERE entity = 'employments'").all();
      for (const e of emps) {
        const eData = JSON.parse(e.payload);
        if (eData.user_id === payload.user_id && eData.company_id === auth.company_id && eData.status === 'ACTIVE') {
          allowed = true;
          break;
        }
      }
    }
  }

  if (!allowed) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  res.sendFile(filePath);
});
// ----------------------------------------------------

app.post('/api/auth/verify-pin', (req, res) => {
  const auth = getUserAuth(req);
  if (!auth || !auth.user_id) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'MISSING_PIN' });

  const userEnt = db.prepare("SELECT payload FROM entities WHERE entity = 'users' AND entity_id = ?").get(auth.user_id);
  if (!userEnt) return res.status(404).json({ error: 'NOT_FOUND' });

  const p = JSON.parse(userEnt.payload);
  if (!verifySecret(pin, p.pin_code)) {
    return res.status(401).json({ error: 'INVALID_PIN' });
  }

  res.json({ success: true });
});

// ----------------------------------------------------



const getConflictStmt = db.prepare('SELECT * FROM sync_conflicts WHERE conflict_id = ?');

app.post('/api/sync/conflicts/:id/recheck', (req, res) => {
  const auth = getUserAuth(req);
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (clientType === 'START2WAY_TECH_PANEL') {
    return res.status(403).json({ error: 'TECH_PANEL_READONLY' });
  }

  const { operation_id, entity, entity_id, version, operation, payload, company_id, user_id } = req.body;
  const actorId = auth ? auth.user_id || auth.company_id : 'UNKNOWN';
  
  // Verify that the requested identity matches the session
  const reqUserId = auth ? auth.user_id : undefined;
  const reqCompanyId = auth ? auth.company_id : undefined;
  
  if (!auth && entity !== 'users') {
     // Allow users creation without auth for signup V1
     return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  if (!operation_id || !entity || !entity_id) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  if (!ALLOWED_ENTITIES.includes(entity)) {
    return res.status(400).json({ error: 'UNSUPPORTED_ENTITY' });
  }

  const opType = operation || 'UPDATE';

  const fingerprintPayload = {
    entity,
    entity_id,
    operation: opType,
    version: version || null,
    payload,
    actor_scope: `${clientType}:${actorId}`
  };
  const requestFingerprint = calculateFingerprint(fingerprintPayload);

  try {
    const result = applyMutation({
      operation_id, entity, entity_id, version, operation: opType, payload,
      clientType, actorId, userId: reqUserId, companyId: reqCompanyId, requestFingerprint
    });

    if (result.error) {
      if (result.error === 'VERSION_CONFLICT') {
        return res.status(result.status).json({
          error: result.error,
          conflict_id: result.conflict_id,
          operation_id,
          entity,
          entity_id,
          client_base_version: result.client_base_version,
          server_version: result.server_version
        });
      }
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ status: 'ok', sequence: result.sequence, version: result.version });
  } catch (err) {
    console.error('Mutate error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/sync/changes', (req, res) => {
  const after = parseInt(req.query.after) || 0;
  const limit = parseInt(req.query.limit) || 100;
  const auth = getUserAuth(req);
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (!auth) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const userId = auth.user_id;
  const companyId = auth.company_id;
  
  // For TECH, we might need a role check, but V1 says TECH access only via policy
  if (clientType === 'START2WAY_TECH_PANEL' && auth.role !== 'tech') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  try {
    const rawChanges = db.prepare('SELECT * FROM changelog WHERE sequence > ? ORDER BY sequence ASC LIMIT ?').all(after, limit);
    
    let maxSeq = after;
    if (rawChanges.length > 0) {
      maxSeq = rawChanges[rawChanges.length - 1].sequence;
    }

    const filtered = rawChanges.filter(ch => {
      if (clientType === 'EMPLOYEE_APP') {
        return ch.user_id === userId;
      }
      if (clientType === 'COMPANY_PANEL') {
        return ch.company_id === companyId;
      }
      if (clientType === 'START2WAY_TECH_PANEL') {
        return true;
      }
      return false;
    }).map(ch => {
      let parsedPayload = null;
      if (ch.payload) {
        try { parsedPayload = JSON.parse(ch.payload); } catch(e){}
      }
      return {
        sequence: ch.sequence,
        id: ch.id,
        operation_id: ch.operation_id,
        entity: ch.entity,
        entity_id: ch.entity_id,
        operation: ch.operation,
        version: ch.version,
        occurred_at: ch.occurred_at,
        payload: sanitizePayload(ch.entity, parsedPayload, clientType)
      };
    });

    res.json({
      changes: filtered,
      new_cursor: maxSeq,
      has_more: rawChanges.length === limit
    });
  } catch (err) {
    console.error('Changes error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/sync/conflicts', (req, res) => {
  const auth = getUserAuth(req);
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (!auth) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const userId = auth.user_id;
  const companyId = auth.company_id;
  
  // For TECH, we might need a role check, but V1 says TECH access only via policy
  if (clientType === 'START2WAY_TECH_PANEL' && auth.role !== 'tech') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  let query = 'SELECT * FROM sync_conflicts WHERE 1=1';
  const params = [];

  if (clientType === 'EMPLOYEE_APP') {
    query += ' AND user_id = ?';
    params.push(userId);
  } else if (clientType === 'COMPANY_PANEL') {
    query += ' AND company_id = ?';
    params.push(companyId);
  }

  try {
    const conflicts = db.prepare(query).all(...params);
    
    const formatted = conflicts.map(c => {
      let clientPayload = null;
      let serverPayloadAtConflict = null;
      try { clientPayload = JSON.parse(c.client_payload); } catch(e){}
      try { serverPayloadAtConflict = JSON.parse(c.server_payload); } catch(e){}

      const currentEntity = getEntityStmt.get(c.entity, c.entity_id);
      let currentPayload = null;
      if (currentEntity && currentEntity.payload) {
        try { currentPayload = JSON.parse(currentEntity.payload); } catch(e){}
      }

      return {
        conflict_id: c.conflict_id,
        operation_id: c.operation_id,
        entity: c.entity,
        entity_id: c.entity_id,
        status: c.status,
        reason: c.reason,
        client_base_version: c.client_base_version,
        server_version_at_conflict: c.server_version_at_conflict,
        current_server_state: {
          version: currentEntity ? currentEntity.version : null,
          payload: sanitizePayload(c.entity, currentPayload, clientType)
        },
        client_payload: sanitizePayload(c.entity, clientPayload, clientType),
        server_payload: sanitizePayload(c.entity, serverPayloadAtConflict, clientType)
      };
    });

    res.json({ conflicts: formatted });
  } catch (err) {
    console.error('Conflicts error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/sync/conflicts/:id', (req, res) => {
  const auth = getUserAuth(req);
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (!auth) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const userId = auth.user_id;
  const companyId = auth.company_id;
  
  // For TECH, we might need a role check, but V1 says TECH access only via policy
  if (clientType === 'START2WAY_TECH_PANEL' && auth.role !== 'tech') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  try {
    const c = db.prepare('SELECT * FROM sync_conflicts WHERE conflict_id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'NOT_FOUND' });

    if (clientType === 'EMPLOYEE_APP' && c.user_id !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (clientType === 'COMPANY_PANEL' && c.company_id !== companyId) return res.status(403).json({ error: 'FORBIDDEN' });

    let clientPayload = null;
    let serverPayloadAtConflict = null;
    try { clientPayload = JSON.parse(c.client_payload); } catch(e){}
    try { serverPayloadAtConflict = JSON.parse(c.server_payload); } catch(e){}

    const currentEntity = getEntityStmt.get(c.entity, c.entity_id);
    let currentPayload = null;
    if (currentEntity && currentEntity.payload) {
      try { currentPayload = JSON.parse(currentEntity.payload); } catch(e){}
    }

    res.json({
      conflict_id: c.conflict_id,
      operation_id: c.operation_id,
      entity: c.entity,
      entity_id: c.entity_id,
      status: c.status,
      reason: c.reason,
      client_base_version: c.client_base_version,
      server_version_at_conflict: c.server_version_at_conflict,
      current_server_state: {
        version: currentEntity ? currentEntity.version : null,
        payload: sanitizePayload(c.entity, currentPayload, clientType)
      },
      client_payload: sanitizePayload(c.entity, clientPayload, clientType),
      server_payload: sanitizePayload(c.entity, serverPayloadAtConflict, clientType)
    });
  } catch (err) {
    console.error('Conflicts error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/tech/audit/failed', (req, res) => {
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (clientType !== 'START2WAY_TECH_PANEL') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  try {
    const failedOps = db.prepare('SELECT * FROM failed_operations ORDER BY sequence DESC LIMIT 100').all();
    const formatted = failedOps.map(f => {
      let parsedPayload = null;
      if (f.payload) {
        try { parsedPayload = JSON.parse(f.payload); } catch(e){}
      }
      return {
        sequence: f.sequence,
        operation_id: f.operation_id,
        entity: f.entity,
        entity_id: f.entity_id,
        reason: f.reason,
        occurred_at: f.occurred_at,
        actor_type: f.actor_type,
        actor_id: f.actor_id,
        user_id: f.user_id,
        company_id: f.company_id,
        payload: parsedPayload // Already sanitized at insertion
      };
    });
    res.json({ failed_operations: formatted });
  } catch (err) {
    console.error('Audit failed error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/tech/state', (req, res) => {
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (clientType !== 'START2WAY_TECH_PANEL') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  try {
    const entities = db.prepare('SELECT * FROM entities').all();
    const employments = entities.filter(e => e.entity === 'employments').map(e => {
      let p = null;
      try { p = JSON.parse(e.payload); } catch(err){}
      return { ...e, payload: sanitizePayload(e.entity, p, clientType) };
    });
    const feuillets = entities.filter(e => e.entity === 'feuillets').map(e => {
      let p = null;
      try { p = JSON.parse(e.payload); } catch(err){}
      return { ...e, payload: sanitizePayload(e.entity, p, clientType) };
    });
    
    res.json({
      employments,
      feuillets,
      // the others can be fetched by their respective endpoints if needed, but the spec says "voir: employments, feuillets, conflicts, failed operations, changelog"
      // to keep it simple and performant for a debug endpoint, we can just return entities, or all of them.
      // Let's just return entities for state. The requirement was "Restaurer si utile un endpoint global read-only..."
      status: 'ok'
    });
  } catch (err) {
    console.error('State error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/legacy/consume_token', async (req, res) => {
  const { code, target_entity, target_id } = req.body;
  if (!code) return res.status(400).json({ error: 'MISSING_CODE' });

  let expectedType = '';
  if (code.startsWith('INV-')) expectedType = 'invitation';
  else if (code.startsWith('CIR-')) expectedType = 'circuit';
  else if (code.startsWith('REP-')) expectedType = 'reprise';
  else return res.status(400).json({ error: 'UNKNOWN_PREFIX' });

  if (expectedType === 'reprise') {
    return res.status(403).json({ error: 'REPRISE_NOT_ALLOWED_HERE' }); 
  }

  if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
    return res.status(503).json({ error: 'AIRTABLE_NOT_CONFIGURED' });
  }

  try {
    const airtableApiUrl = process.env.AIRTABLE_API_URL || 'https://api.airtable.com/v0';
    const searchUrl = `${airtableApiUrl}/${process.env.AIRTABLE_BASE_ID}/invitations?filterByFormula={code}='${code}'`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_PAT}` }
    });
    const searchData = await searchRes.json();
    if (!searchData.records || searchData.records.length === 0) {
      return res.status(404).json({ error: 'TOKEN_NOT_FOUND' });
    }

    const record = searchData.records[0];
    const airtableId = record.id;
    const tokenType = record.fields.type || 'invitation';

    if (tokenType !== expectedType) {
      return res.status(403).json({ error: 'TOKEN_TYPE_MISMATCH' });
    }

    const now = new Date().toISOString();
    const patchFields = {
      status: 'used',
      used_at: now
    };


    const patchRes = await fetch(`${airtableApiUrl}/${process.env.AIRTABLE_BASE_ID}/invitations/${airtableId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: patchFields })
    });

    if (expectedType === 'circuit') {
       return res.json({ status: 'ok', type: 'circuit', message: 'Token consumed, no employment created.' });
    } else if (expectedType === 'invitation') {
       const empId = 'emp_auto_' + Math.random().toString(36).substr(2, 9);
       const payloadStr = JSON.stringify({
         id: empId,
         company_id: record.fields.company_id || 'unknown',
         user_id: target_id || 'unknown',
         status: 'active'
       });
       insertEntityStmt.run('employments', empId, 1, payloadStr, record.fields.company_id || 'unknown', target_id || 'unknown', now);
       return res.json({ status: 'ok', type: 'invitation', employment_id: empId });
    }
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.use('/api/legacy', async (req, res) => {
  const fullPath = req.path || ''; // Starts with /
  const parts = fullPath.split('/').filter(p => p);
  const table = parts[0];
  const pathRemaining = parts.length > 1 ? '/' + parts.slice(1).join('/') : '';
  
  console.log('Legacy Proxy Hit:', req.method, req.path, 'Table:', table);

  if (!table) return res.status(400).json({ error: 'MISSING_TABLE' });
  
  if (table === 'employments' || table === 'feuillets') {
    return res.status(403).json({ error: 'LEGACY_EMPLOYMENTS_BLOCKED' });
  }

  if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
    return res.status(503).json({ error: 'AIRTABLE_NOT_CONFIGURED' });
  }

  const allowlist = ['companies', 'users', 'sessions', 'messages', 'alerts', 'reprise_codes', 'event_logs', 'reopen_logs', 'vehicles', 'documents', 'invitations', 'reports', 'documents'];
  if (!allowlist.includes(table)) {
    return res.status(403).json({ error: 'FORBIDDEN_TABLE' });
  }

  const airtableApiUrl = process.env.AIRTABLE_API_URL || 'https://api.airtable.com/v0';
  const baseUrl = `${airtableApiUrl}/${process.env.AIRTABLE_BASE_ID}/${table}${pathRemaining}`;
  const urlObj = new URL(baseUrl);
  
  for (const [k, v] of Object.entries(req.query)) {
    urlObj.searchParams.append(k, v);
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(urlObj.toString(), fetchOptions);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Legacy proxy error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Background Sync Task
async function syncToAirtableMirror(row) {
  if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
    db.prepare('UPDATE airtable_mirror_status SET status = ?, last_error = ?, retry_count = retry_count + 1 WHERE entity = ? AND entity_id = ? AND central_version = ?')
      .run('FAILED_RETRYABLE', 'AIRTABLE_NOT_CONFIGURED', row.entity, row.entity_id, row.central_version);
    return;
  }
  
  const entityRow = db.prepare('SELECT * FROM entities WHERE entity = ? AND entity_id = ?').get(row.entity, row.entity_id);
  if (!entityRow || entityRow.version !== row.central_version) return;

  let payload;
  try {
    payload = JSON.parse(entityRow.payload);
  } catch (e) {
    return;
  }
  
  const fields = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k.startsWith('_')) continue;
    if (v === null || v === undefined) continue;
    fields[k] = typeof v === 'object' ? JSON.stringify(v) : v;
  }

  let method = 'POST';
  const airtableApiUrl = process.env.AIRTABLE_API_URL || 'https://api.airtable.com/v0';
  let url = `${airtableApiUrl}/${process.env.AIRTABLE_BASE_ID}/${row.entity}`;
  
  try {
    const searchRes = await fetch(`${url}?filterByFormula={id}='${payload.id}'`, {
      headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_PAT}` }
    });
    if (!searchRes.ok) throw new Error('Search failed: ' + searchRes.status);
    const searchData = await searchRes.json();
    
    if (searchData.records && searchData.records.length > 0) {
      const airtableId = searchData.records[0].id;
      method = 'PATCH';
      url = `${url}/${airtableId}`;
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (res.ok) {
      const currentEntity = db.prepare('SELECT version FROM entities WHERE entity = ? AND entity_id = ?').get(row.entity, row.entity_id);
      if (currentEntity && currentEntity.version === row.central_version) {
        db.prepare('UPDATE airtable_mirror_status SET status = ? WHERE entity = ? AND entity_id = ? AND central_version = ?')
          .run('COMPLETED', row.entity, row.entity_id, row.central_version);
      }
    } else {
      const isRetryable = res.status >= 500 || res.status === 429;
      const newStatus = isRetryable ? 'FAILED_RETRYABLE' : 'FAILED_BLOCKED';
      db.prepare('UPDATE airtable_mirror_status SET status = ?, last_error = ?, retry_count = retry_count + 1 WHERE entity = ? AND entity_id = ? AND central_version = ?')
        .run(newStatus, `HTTP ${res.status}`, row.entity, row.entity_id, row.central_version);
    }
  } catch (err) {
    db.prepare('UPDATE airtable_mirror_status SET status = ?, last_error = ?, retry_count = retry_count + 1 WHERE entity = ? AND entity_id = ? AND central_version = ?')
      .run('FAILED_RETRYABLE', err.message, row.entity, row.entity_id, row.central_version);
  }
}

setInterval(() => {
  try {
    const now = new Date().toISOString();
    const pending = db.prepare(`SELECT * FROM airtable_mirror_status WHERE status IN ('PENDING', 'FAILED_RETRYABLE') AND (next_attempt_at IS NULL OR next_attempt_at <= ?) LIMIT 10`).all(now);
    for (const row of pending) {
      syncToAirtableMirror(row).catch(e => console.error(e));
    }
  } catch (e) {
    console.error('Mirror sync error', e);
  }
}, 5000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Recovery server running on port ${port}`));
