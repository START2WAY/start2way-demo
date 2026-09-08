const fs = require("fs");
const path = require("path");
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const { initDB, runInTransaction, dal } = require('./db/index.js');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const engine = process.env.DB_ENGINE || 'sqlite';
const dbConfig = engine === 'postgres' ? process.env.DATABASE_URL : (process.env.DB_PATH || 's2w_recovery.db');
const dbPromise = initDB(dbConfig);

async function recordFailedOperation(reqData, reason) {
  const { operation_id, entity, entity_id, payload, clientType, actorId, userId, companyId } = reqData;
  const now = new Date().toISOString();
  let sanitized = sanitizePayload(entity, payload, clientType);
  
  if (sanitized) {
    sanitized = { ...sanitized };
    delete sanitized.secret_token;
    delete sanitized.password;
    delete sanitized.pin_code;
  }
  
  await dal.operations.insertFailed(
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

async function getUserAuth(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token) {
    token = req.query.token;
  }
  
  if (token) {
    const session = dal.sessions.getValidSession(token, new Date().toISOString());
    if (session) return session;
  }
  return null;
}

// UUID helper
function uuidv4() {
  return crypto.randomUUID();
}

// Sanitization functions
const ALLOWED_ENTITIES = ['employments', 'feuillets', 'segments', 'vehicle_usages', 'event_logs', 'day_declarations', 'documents', 'vehicles', 'vehicle_maintenance_events', 'sessions'];

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
const applyMutation = runInTransaction(async (reqData) => {
  let { operation_id, entity, entity_id, version, operation, payload, clientType, actorId, userId, companyId, requestFingerprint } = reqData;

  // Acquire transaction-level advisory locks for concurrency (serialization)
  await dal.locks.acquireXactLock('operation', operation_id);
  await dal.locks.acquireXactLock('entity', entity + ':' + entity_id);

  // 1. Idempotency Check
  const existingOp = await dal.operations.getProcessed(operation_id);
  if (existingOp) {
    if (!existingOp.request_fingerprint) {
      await recordFailedOperation(reqData, 'LEGACY_OPERATION_FINGERPRINT_MISSING');
      return { error: 'LEGACY_OPERATION_FINGERPRINT_MISSING', status: 409 };
    }
    if (existingOp.request_fingerprint !== requestFingerprint) {
      await recordFailedOperation(reqData, 'OPERATION_ID_REUSE_MISMATCH');
      return { error: 'OPERATION_ID_REUSE_MISMATCH', status: 409 };
    }
    return { status: 'ack', sequence: existingOp.sequence, version: existingOp.version };
  }

  const existingConflictGlobal = await dal.conflicts.getByOpId(operation_id);
  if (existingConflictGlobal) {
    if (!existingConflictGlobal.request_fingerprint) {
      await recordFailedOperation(reqData, 'LEGACY_CONFLICT_FINGERPRINT_MISSING');
      return { error: 'LEGACY_CONFLICT_FINGERPRINT_MISSING', status: 409 };
    }
    if (existingConflictGlobal.request_fingerprint !== requestFingerprint) {
      await recordFailedOperation(reqData, 'OPERATION_ID_REUSE_MISMATCH');
      return { error: 'OPERATION_ID_REUSE_MISMATCH', status: 409 };
    }
  }


  // 1.5 Security & Scope Checks
  const existingEntity = await dal.entities.get(entity, entity_id);

  if (clientType === 'START2WAY_TECH_PANEL') {
    if (entity === 'vehicle_usages') {
      await recordFailedOperation(reqData, 'TECH_VEHICLE_USAGE_MUTATION_FORBIDDEN');
      return { error: 'TECH_VEHICLE_USAGE_MUTATION_FORBIDDEN', status: 403 };
    }
  }

  if (clientType === 'COMPANY_PANEL') {
    if (entity === 'employments') {
      if (!existingEntity) {
        await recordFailedOperation(reqData, 'COMPANY_EMPLOYMENT_CREATE_FORBIDDEN');
        return { error: 'COMPANY_EMPLOYMENT_CREATE_FORBIDDEN', status: 403 };
      }
      if (existingEntity.company_id !== companyId) {
        await recordFailedOperation(reqData, 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH');
        return { error: 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH', status: 403 };
      }
      if (payload && payload.company_id && payload.company_id !== existingEntity.company_id) {
        await recordFailedOperation(reqData, 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH');
        return { error: 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH', status: 403 };
      }
      if (payload && payload.user_id && payload.user_id !== existingEntity.user_id) {
        await recordFailedOperation(reqData, 'EMPLOYMENT_USER_SCOPE_MISMATCH');
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
      await recordFailedOperation(reqData, 'COMPANY_FEUILLET_MUTATION_FORBIDDEN');
      return { error: 'COMPANY_FEUILLET_MUTATION_FORBIDDEN', status: 403 };
    } else if (entity === 'vehicle_usages') {
      await recordFailedOperation(reqData, 'COMPANY_VEHICLE_USAGE_MUTATION_FORBIDDEN');
      return { error: 'COMPANY_VEHICLE_USAGE_MUTATION_FORBIDDEN', status: 403 };
    }
  }

  if (entity === 'vehicles') {
    if (!reqData.companyId) {
      await recordFailedOperation(reqData, 'COMPANY_AUTH_REQUIRED_FOR_VEHICLE');
      return { error: 'COMPANY_AUTH_REQUIRED_FOR_VEHICLE', status: 403 };
    }

    if (payload && payload.status) {
      payload.status = payload.status.toUpperCase();
    }
    
    // SECURITY — VEHICLE MUTATE COMPANY AUTHORITY
    if (payload && payload.company_id && reqData.companyId && payload.company_id !== reqData.companyId) {
      payload.company_id = reqData.companyId;
    } else if (payload && !payload.company_id && reqData.companyId) {
      payload.company_id = reqData.companyId;
    }
    
    if (existingEntity && existingEntity.company_id && reqData.companyId && existingEntity.company_id !== reqData.companyId) {
      await recordFailedOperation(reqData, 'VEHICLE_COMPANY_SCOPE_MISMATCH');
      return { error: 'VEHICLE_COMPANY_SCOPE_MISMATCH', status: 403 };
    }
    
    // SECURITY — ARCHIVE ACTIVE VEHICLE SERVER-SIDE
    if (payload && payload.status && payload.status.toUpperCase() === 'ARCHIVED') {
      const activeUsages = dal.entities.getActiveUsagesByVehicle(entity_id);
      console.log('VEHICLE ARCHIVE CHECK:', entity_id, 'Active usages found:', activeUsages.length, activeUsages);
      if (activeUsages.length > 0) {
        await recordFailedOperation(reqData, 'VEHICLE_ARCHIVE_FORBIDDEN_ACTIVE_USAGE');
        return { error: 'VEHICLE_ARCHIVE_FORBIDDEN_ACTIVE_USAGE', status: 403 };
      }
    }
  }

  if (entity === 'feuillets' || entity === 'segments' || entity === 'vehicle_usages' || entity === 'event_logs' || entity === 'sessions' || entity === 'day_declarations') {
    if (!payload || !payload.employment_id) {
      await recordFailedOperation(reqData, 'MISSING_EMPLOYMENT_ID');
      return { error: 'MISSING_EMPLOYMENT_ID', status: 403 };
    }
    const employment = await dal.entities.get('employments', payload.employment_id);
    if (!employment) {
      await recordFailedOperation(reqData, 'EMPLOYMENT_NOT_FOUND');
      return { error: 'EMPLOYMENT_NOT_FOUND', status: 403 };
    }
    if (payload.company_id && payload.company_id !== employment.company_id) {
      await recordFailedOperation(reqData, 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH');
      return { error: 'EMPLOYMENT_COMPANY_SCOPE_MISMATCH', status: 403 };
    }
    if (payload.user_id && payload.user_id !== employment.user_id) {
      console.log(`EMPLOYMENT_USER_SCOPE_MISMATCH: payload.user_id=${payload.user_id}, employment.user_id=${employment.user_id}`);
      await recordFailedOperation(reqData, 'EMPLOYMENT_USER_SCOPE_MISMATCH');
      return { error: 'EMPLOYMENT_USER_SCOPE_MISMATCH', status: 403 };
    }
    if (clientType === 'EMPLOYEE_APP' && employment.user_id !== userId) {
      await recordFailedOperation(reqData, 'USER_SCOPE_FORBIDDEN');
      return { error: 'USER_SCOPE_FORBIDDEN', status: 403 };
    }
    
    if (entity === 'segments') {
      const startedAt = new Date(payload.started_at).getTime();
      const endedAt = new Date(payload.ended_at).getTime();
      if (isNaN(startedAt) || isNaN(endedAt) || endedAt <= startedAt) {
        await recordFailedOperation(reqData, 'INVALID_SEGMENT_TIMESTAMPS');
        return { error: 'INVALID_SEGMENT_TIMESTAMPS', status: 400 };
      }
      if (!['A', 'B', 'C', 'D'].includes(payload.category)) {
        await recordFailedOperation(reqData, 'INVALID_SEGMENT_CATEGORY');
        return { error: 'INVALID_SEGMENT_CATEGORY', status: 400 };
      }
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: payload.business_timezone });
      } catch (e) {
        await recordFailedOperation(reqData, 'INVALID_SEGMENT_TIMEZONE');
        return { error: 'INVALID_SEGMENT_TIMEZONE', status: 400 };
      }
      
      const diffSecs = Math.round((endedAt - startedAt) / 1000);
      if (Math.abs(diffSecs - payload.duration_sec) > 5) {
        await recordFailedOperation(reqData, 'INVALID_SEGMENT_DURATION');
        return { error: 'INVALID_SEGMENT_DURATION', status: 400 };
      }
      if (!payload.business_date) {
        await recordFailedOperation(reqData, 'MISSING_SEGMENT_BUSINESS_DATE');
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
        await recordFailedOperation(reqData, 'INVALID_SEGMENT_BUSINESS_DATE');
        return { error: 'INVALID_SEGMENT_BUSINESS_DATE', status: 400 };
      }
    }
    
    if (entity === 'vehicle_usages') {
      console.log(`[applyMutation] Inside vehicle_usages for entity_id=${entity_id}`);
      if (!existingEntity && payload.ended_at == null) {
        if (payload.user_id !== reqData.userId) {
          await recordFailedOperation(reqData, 'USER_ID_MISMATCH');
          return { error: 'USER_ID_MISMATCH', status: 403 };
        }
        const emp = await dal.entities.get('employments', payload.employment_id);
        if (emp) {
          let empPayload = {};
          try { empPayload = JSON.parse(emp.payload); } catch(e){}
          if (empPayload.status !== 'active' || emp.user_id !== reqData.userId) {
            await recordFailedOperation(reqData, 'EMPLOYMENT_NOT_ACTIVE_OR_UNOWNED');
            return { error: 'EMPLOYMENT_NOT_ACTIVE_OR_UNOWNED', status: 403 };
          }
          const veh = await dal.entities.get('vehicles', payload.vehicle_id);
          if (!veh) {
            await recordFailedOperation(reqData, 'VEHICLE_NOT_FOUND');
            return { error: 'VEHICLE_NOT_FOUND', status: 403 };
          }
          let vehPayload = {};
          try { vehPayload = JSON.parse(veh.payload); } catch(e){}
          console.log(`CHECKING VEHICLE ${veh.entity_id}: veh.company_id=${veh.company_id}, emp.company_id=${emp.company_id}, vehPayload.status=${vehPayload.status}`);
          if (veh.company_id !== emp.company_id) {
            await recordFailedOperation(reqData, 'VEHICLE_COMPANY_SCOPE_MISMATCH');
            return { error: 'VEHICLE_COMPANY_SCOPE_MISMATCH', status: 403 };
          }
          if (vehPayload.status !== 'ACTIVE' && vehPayload.status !== 'active') {
            await recordFailedOperation(reqData, 'VEHICLE_STATUS_NOT_ACTIVE');
            return { error: 'VEHICLE_STATUS_NOT_ACTIVE', status: 403 };
          }
          const activeUsages = dal.entities.getActiveUsagesByVehicle(payload.vehicle_id);
          if (activeUsages.length > 0) {
            await recordFailedOperation(reqData, 'VEHICLE_ALREADY_IN_USE');
            return { error: 'VEHICLE_ALREADY_IN_USE', status: 403 };
          }
          const userActiveUsages = dal.entities.getActiveUsagesByUser(payload.user_id);
          if (userActiveUsages.length > 0) {
            await recordFailedOperation(reqData, 'USER_ALREADY_USING_VEHICLE');
            return { error: 'USER_ALREADY_USING_VEHICLE', status: 403 };
          }
        }
      }

      if (existingEntity) {
        let currentPayload = null;
        try { currentPayload = JSON.parse(existingEntity.payload); } catch(e){}
        
        if (currentPayload) {
          if (currentPayload.ended_at && currentPayload.odometer_end != null) {
            await recordFailedOperation(reqData, 'CLOSED_VEHICLE_USAGE_IMMUTABLE');
            return { error: 'CLOSED_VEHICLE_USAGE_IMMUTABLE', status: 403 };
          }
          
          const immutableFields = ['id', 'user_id', 'employment_id', 'vehicle_id', 'plate_snapshot', 'business_date', 'business_timezone', 'started_at', 'odometer_start'];
          for (let field of immutableFields) {
            if (payload[field] !== undefined && payload[field] !== currentPayload[field]) {
              console.log(`IMMUTABLE FAIL on ${field}: payload=${payload[field]}, current=${currentPayload[field]}`);
              await recordFailedOperation(reqData, 'VEHICLE_USAGE_IMMUTABLE_FIELD');
              return { error: 'VEHICLE_USAGE_IMMUTABLE_FIELD', status: 403 };
            }
          }
        }
      }
      
      if (payload.ended_at != null || payload.odometer_end != null || payload.rollover_type === 'MIDNIGHT') {
        if (!payload.ended_at || (payload.odometer_end == null && payload.rollover_type !== 'MIDNIGHT')) {
          await recordFailedOperation(reqData, 'INVALID_VEHICLE_USAGE_CLOSURE');
          return { error: 'INVALID_VEHICLE_USAGE_CLOSURE', status: 400 };
        }
        
        const startedAt = new Date(payload.started_at).getTime();
        const endedAt = new Date(payload.ended_at).getTime();
        if (isNaN(startedAt) || isNaN(endedAt) || endedAt < startedAt) {
          await recordFailedOperation(reqData, 'INVALID_VEHICLE_USAGE_TIMESTAMPS');
          return { error: 'INVALID_VEHICLE_USAGE_TIMESTAMPS', status: 400 };
        }
        if (payload.odometer_end != null && payload.odometer_start != null && payload.odometer_end < payload.odometer_start) {
          await recordFailedOperation(reqData, 'INVALID_VEHICLE_USAGE_ODOMETER');
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
              await recordFailedOperation(reqData, 'FEUILLET_SNAPSHOT_IMMUTABLE');
              return { error: 'FEUILLET_SNAPSHOT_IMMUTABLE', status: 403 };
            }
          }
          if (currentPayload.company_snapshot && payload.company_snapshot) {
            const curr = currentPayload.company_snapshot;
            const next = payload.company_snapshot;
            if (curr.company_id !== next.company_id || curr.name !== next.name) {
              console.log(`IMMUTABLE FAIL on feuillets company_snapshot`);
              await recordFailedOperation(reqData, 'FEUILLET_SNAPSHOT_IMMUTABLE');
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
              await recordFailedOperation(reqData, 'EVENT_LOG_GPS_IMMUTABLE');
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
    const existingConflict = await dal.conflicts.getByOpId(operation_id);

    let conflictId = existingConflict ? existingConflict.conflict_id : uuidv4();
    
    if (!existingConflict) {
      const now = new Date().toISOString();
      const employmentId = payload ? payload.employment_id : null;
      await dal.conflicts.insert(
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
    await dal.entities.update(newVersion, payloadStr, companyId, userId, now, entity, entity_id);
  } else {
    await dal.entities.insert(entity, entity_id, newVersion, payloadStr, companyId, userId, now);
  }

  const logId = uuidv4();
  const info = await dal.changelog.insert(logId, operation_id, entity, entity_id, operation, newVersion, now, clientType, actorId, userId, companyId, payloadStr);
  const sequence = info.lastInsertRowid;

  // 5. Write processed_operations
  await dal.operations.insertProcessed(operation_id, 'COMPLETED', entity, entity_id, newVersion, sequence, now, requestFingerprint);

  if (entity === 'employments' || entity === 'feuillets' || entity === 'segments') {
    dal.airtable.upsertStatus(entity, entity_id, newVersion, 'PENDING', now);
  }

  return { status: 'ack', sequence, version: newVersion };
});

// Endpoints
app.get('/health', (req, res) => res.send('OK'));

// ==========================================
// EMPLOYEE LICENSE PLATE SCANNER V1
// ==========================================
const scanRateLimits = new Map();
app.post('/api/employee/plate-scan', async (req, res) => {
  try {
    const auth = await getUserAuth(req);
    if (!auth || !auth.user_id) return res.status(401).json({ error: 'UNAUTHORIZED' });
    req.user = { id: auth.user_id };

    // Basic rate limit (max 5 requests per minute per user)
    const now = Date.now();
    const userLimit = scanRateLimits.get(req.user.id) || { count: 0, resetTime: now + 60000 };
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + 60000;
    }
    if (userLimit.count >= 5) {
      return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many scans. Try again in 1 minute.' });
    }
    userLimit.count++;
    scanRateLimits.set(req.user.id, userLimit);

    const { image, employment_id } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image" });
    if (!employment_id) return res.status(400).json({ error: "Missing employment_id" });

    // Verify employment
    const empRow = await dal.entities.get('employments', employment_id);
    if (!empRow) return res.status(404).json({ error: "Employment not found" });
    const employment = JSON.parse(empRow.payload);
    
    if (employment.user_id !== req.user.id || employment.status !== 'ACTIVE') {
      return res.status(403).json({ error: "Invalid employment" });
    }

    // Call OCR
    const ocrResult = await PlateOCRService.recognize(image);
    
    // Call AI Agent
    const agentResult = await LicensePlateAgentService.analyze(image, ocrResult);

    // Safety: don't store raw image permanently
    // Return structured candidate
    res.json(agentResult);
  } catch (error) {
    console.error("[PlateScan] Error:", error);
    res.status(500).json({ error: "Internal server error during plate scan" });
  }
});

app.post('/api/employee/plate-confirm', async (req, res) => {
  try {
    const auth = await getUserAuth(req);
    if (!auth || !auth.user_id) return res.status(401).json({ error: 'UNAUTHORIZED' });
    req.user = { id: auth.user_id };

    const { employment_id, normalized_plate, plate_country } = req.body;
    
    if (!employment_id || !normalized_plate || !plate_country) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify employment
    const empRow = await dal.entities.get('employments', employment_id);
    if (!empRow) return res.status(404).json({ error: "Employment not found" });
    const employment = JSON.parse(empRow.payload);
    
    if (employment.user_id !== req.user.id || employment.status !== 'ACTIVE') {
      return res.status(403).json({ error: "Invalid employment" });
    }

    const companyId = employment.company_id;

    // Search existing vehicle in the active company
    const allVehiclesRows = dal.entities.getAllPayloads('vehicles');
    let existingVehicle = null;
    for (const r of allVehiclesRows) {
      const v = JSON.parse(r.payload);
      if (v.company_id === companyId && v.plate_normalized === normalized_plate) {
        existingVehicle = v;
        break;
      }
    }

    if (existingVehicle) {
      return res.json({ vehicle: existingVehicle, is_new: false });
    }

    // Create minimal vehicle
    const vehicleId = 'veh_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const now = new Date().toISOString();
    
    const newVehicle = {
      id: vehicleId,
      company_id: companyId, // Strictly scoped to employment's company
      plate: normalized_plate,
      plate_normalized: normalized_plate,
      plate_country: plate_country,
      status: 'ACTIVE', // Operational
      profile_completion_status: 'PENDING_COMPANY_REVIEW', // Administrative
      creation_source: 'EMPLOYEE_PLATE_SCAN',
      created_by_user_id: req.user.id,
      created_via_employment_id: employment_id,
      created_at: now,
      updated_at: now
    };

    // Insert entity
    await dal.entities.insert(
      'vehicles',
      vehicleId,
      1,
      JSON.stringify(newVehicle),
      companyId,
      req.user.id,
      now
    );

    // Add to changelog
    await dal.changelog.insert(
      'op_' + Date.now(),
      'op_' + Date.now(),
      'vehicles',
      vehicleId,
      'CREATE',
      1,
      now,
      'user',
      req.user.id,
      req.user.id,
      companyId,
      JSON.stringify(newVehicle)
    );

    return res.json({ vehicle: newVehicle, is_new: true });
  } catch (error) {
    console.error("[PlateConfirm] Error:", error);
    res.status(500).json({ error: "Internal server error during plate confirmation" });
  }
});

// ==========================================
// AI CHAT ENDPOINTS
// ==========================================----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'MISSING_CREDENTIALS' });

  const users = dal.entities.getAllEntityIdAndPayloads('users');
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
    const companies = dal.entities.getAllEntityIdAndPayloads('companies');
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
    dal.sessions.createForUser(token, user.entity_id, 'user', now, expiresAt);
    return res.json({ token, company: sanitizeForCompany('companies', companyPayload) });
  }
});


// ----------------------------------------------------
// BINARY DOCUMENT STORAGE
// ----------------------------------------------------
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.post('/api/documents/:id/file', async (req, res) => {
  const auth = await getUserAuth(req);
  if (!auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const documentId = req.params.id;
  const { fileData, ext } = req.body;
  if (!fileData || !ext) return res.status(400).json({ error: 'MISSING_FILE_DATA' });

  if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext.toLowerCase())) {
    return res.status(400).json({ error: 'INVALID_EXTENSION' });
  }

  // The client must have created the document entity in the database first
  // Verify authorization: the user or company uploading must be the owner or authorized
  const docEnt = dal.entities.getPayload('documents', documentId);
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
  dal.entities.updatePayload('documents', documentId, JSON.stringify(payload));

  res.json({ success: true });
});

app.get('/api/documents/:id/file', async (req, res) => {
  const auth = await getUserAuth(req);
  if (!auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const documentId = req.params.id;
  const docEnt = dal.entities.getPayload('documents', documentId);
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
      const emp = dal.entities.getPayload('employments', payload.employment_id);
      if (emp) {
        const empData = JSON.parse(emp.payload);
        if (empData.company_id === auth.company_id) allowed = true;
      }
    } else if (payload.scope === 'PROFESSIONAL' && payload.user_id) {
      // Allow company if they have an active employment with this user
      const emps = dal.entities.getAllPayloads('employments');
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

app.post('/api/auth/verify-pin', async (req, res) => {
  const auth = await getUserAuth(req);
  if (!auth || !auth.user_id) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'MISSING_PIN' });

  const userEnt = dal.entities.getPayload('users', auth.user_id);
  if (!userEnt) return res.status(404).json({ error: 'NOT_FOUND' });

  const p = JSON.parse(userEnt.payload);
  if (!verifySecret(pin, p.pin_code)) {
    return res.status(401).json({ error: 'INVALID_PIN' });
  }

  res.json({ success: true });
});

// ----------------------------------------------------





const mutateHandler = async (req, res) => {
  const auth = await getUserAuth(req);
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (clientType === 'START2WAY_TECH_PANEL') {
    return res.status(403).json({ error: 'TECH_PANEL_READONLY' });
  }

  const { operation_id, entity, entity_id, version, operation, payload, company_id, user_id } = req.body;
  console.log(`[mutateHandler] Received request for entity: ${entity}, entity_id: ${entity_id}`);
  
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
    const result = await applyMutation({
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

    res.json({ status: 'ack', sequence: result.sequence, version: result.version });
  } catch (err) {
    console.error('Mutate error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
};

app.post('/api/sync/conflicts/:id/recheck', mutateHandler);
app.post('/api/sync/mutate', mutateHandler);

// --- FLEET AI SERVICE ---

const FleetAIService = {
  getSystemPrompt() {
    try {
      const agentsDir = path.join(__dirname, 'agents', 'fleet');
      const identity = fs.readFileSync(path.join(agentsDir, 'IDENTITY.md'), 'utf-8');
      const scope = fs.readFileSync(path.join(agentsDir, 'SCOPE.md'), 'utf-8');
      const dataAccess = fs.readFileSync(path.join(agentsDir, 'DATA_ACCESS.md'), 'utf-8');
      
      let emailRules = '';
      try {
        emailRules = fs.readFileSync(path.join(agentsDir, 'EMAIL_RULES.md'), 'utf-8');
      } catch(e) {}
      
      let safety = '';
      try {
        safety = fs.readFileSync(path.join(agentsDir, 'SAFETY.md'), 'utf-8');
      } catch(e) {}

      return `${identity}\n\n${scope}\n\n${dataAccess}\n\n${emailRules}\n\n${safety}`;
    } catch (e) {
      console.warn('Failed to load AI config from .md files:', e);
      return "Tu es l'Assistant Flotte de START2WAY. Tu ne dois jamais inventer d'informations. Tu ne peux faire que de la LECTURE.";
    }
  },

  async handleChat(req, res) {
    try {
      const auth = await getUserAuth(req);
      if (!auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

      // FORCE COMPANY ID FROM AUTHENTICATION - NO CLIENT TRUST
      const company_id = auth.company_id; 
      
      const { message, history, vehicle_id } = req.body;
      
      if (!company_id || !vehicle_id) {
        return res.status(400).json({ error: 'Missing company_id or vehicle_id context' });
      }

      // 1. Get vehicle data and verify company isolation strictly
      const vehicle = getFleetVehicle(company_id, vehicle_id);
      if (!vehicle) {
        return res.status(403).json({ error: 'Vehicle not found or cross-company access denied' });
      }

      // Format vehicle context
      const vehicleContext = `
Contexte du véhicule sélectionné (STRICTEMENT RÉEL) :
- ID: ${vehicle.id || 'N/A'}
- Immatriculation : ${vehicle.plate_number || 'Non renseignée'}
- Marque/Modèle : ${vehicle.brand || ''} ${vehicle.model || ''}
- VIN : ${vehicle.vin || 'Non renseigné'}
- Kilométrage initial entreprise : ${vehicle.initial_company_odometer || 'Inconnu'} km
- Kilométrage actuel : ${vehicle.last_known_km || 'Inconnu'} km
- Date CT : ${vehicle.technical_inspection_date || 'Inconnue'} (Expire le ${vehicle.technical_inspection_expiry_date || 'Inconnue'})
- Assurance : Du ${vehicle.insurance_start_date || 'Inconnue'} au ${vehicle.insurance_expiry_date || 'Inconnue'}
- En location : ${vehicle.is_leased ? 'OUI (' + (vehicle.lessor_name || '') + ')' : 'NON'}

Historique de maintenance récent :
${(vehicle.maintenance_history || []).slice(-3).map(m => `- ${m.date}: ${m.type} à ${m.odometer}km (${m.description || ''})`).join('\n')}

IMPORTANT : Si l'utilisateur demande à rédiger un email, réponds TOUJOURS en terminant par :
"Voici l'e-mail que vous pouvez envoyer avec votre propre service de messagerie."
Suivi du brouillon avec "Objet : ..." et "Message : ...".
`;

      const systemPrompt = FleetAIService.getSystemPrompt() + '\n\n' + vehicleContext;

      // 3. Call Cloud AI API 
      const apiKey = process.env.FLEET_AI_API_KEY;
      if (!apiKey) {
        // En prod, si la clé est absente, on ne fake pas le succès
        return res.status(503).json({ error: 'AI_KEY_MISSING' });
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.2
        })
      });

      if (!aiRes.ok) {
        throw new Error('AI Provider error');
      }

      const aiData = await aiRes.json();
      const aiReply = aiData.choices[0].message.content;

      // 4. Audit Log
      dal.changelog.insert(docEnt.id, `upload_doc_${docEnt.id}_${Date.now()}`, 'documents', documentId, 'UPDATE', payload.version, new Date().toISOString(), auth.role === 'company' ? 'COMPANY' : 'USER', auth.company_id || auth.user_id, null, payload.company_id, JSON.stringify(payload));

      return res.json({ reply: aiReply });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'AI Assistant temporarily unavailable' });
    }
  }
};

function getFleetVehicle(companyId, vehicleId) {
  const row = dal.entities.getPayloadAndCompany('vehicles', vehicleId);
  if (!row) return null;
  if (row.company_id !== companyId) {
    return null; 
  }
  return JSON.parse(row.payload);
}
// --- END FLEET AI SERVICE ---

app.post('/api/fleet/ai/chat', FleetAIService.handleChat);


app.get('/api/sync/changes', async (req, res) => {
  const after = parseInt(req.query.after) || 0;
  const limit = parseInt(req.query.limit) || 100;
  const auth = await getUserAuth(req);
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
    const rawChanges = dal.changelog.getAfterSequence(after, limit);
    
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

app.get('/api/sync/conflicts', async (req, res) => {
  const auth = await getUserAuth(req);
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
    const conflicts = await dal.conflicts.queryAll(query, params);
    
    const formatted = await Promise.all(conflicts.map(async c => {
      let clientPayload = null;
      let serverPayloadAtConflict = null;
      try { clientPayload = JSON.parse(c.client_payload); } catch(e){}
      try { serverPayloadAtConflict = JSON.parse(c.server_payload); } catch(e){}

      const currentEntity = await dal.entities.get(c.entity, c.entity_id);
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
    }));

    res.json({ conflicts: formatted });
  } catch (err) {
    console.error('Conflicts error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/sync/conflicts/:id', async (req, res) => {
  const auth = await getUserAuth(req);
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
    const c = dal.conflicts.getById(req.params.id);
    if (!c) return res.status(404).json({ error: 'NOT_FOUND' });

    if (clientType === 'EMPLOYEE_APP' && c.user_id !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (clientType === 'COMPANY_PANEL' && c.company_id !== companyId) return res.status(403).json({ error: 'FORBIDDEN' });

    let clientPayload = null;
    let serverPayloadAtConflict = null;
    try { clientPayload = JSON.parse(c.client_payload); } catch(e){}
    try { serverPayloadAtConflict = JSON.parse(c.server_payload); } catch(e){}

    const currentEntity = await dal.entities.get(c.entity, c.entity_id);
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

app.get('/api/tech/audit/failed', async (req, res) => {
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (clientType !== 'START2WAY_TECH_PANEL') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  try {
    const failedOps = dal.operations.getRecentFailed();
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

app.get('/api/tech/state', async (req, res) => {
  const clientType = req.headers['x-client-type'] || 'UNKNOWN';
  if (clientType !== 'START2WAY_TECH_PANEL') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  try {
    const entities = dal.entities.getAll();
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


// ----------------------------------------------------------------------------
// CIRCUIT API
// ----------------------------------------------------------------------------
app.post('/api/circuits/resolve', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'INVALID_TOKEN' });
  }

  const normalizedCode = code.trim().toUpperCase();
  
  try {
    // 1. Check if token is already used in service_entitlements
    const existingEntitlements = dal.entities.getAll('service_entitlements');
    let foundEntitlement = null;
    
    for (const ent of existingEntitlements) {
      let p;
      try { p = JSON.parse(ent.payload); } catch(e) {}
      if (p && p.activation_token_id === normalizedCode) {
        foundEntitlement = p;
        break;
      }
    }

    if (foundEntitlement) {
      if (foundEntitlement.user_id !== userId) {
        return res.status(403).json({ error: 'BLOCKED' }); // Cross-user reuse blocked
      }
      // Idempotent retry: return existing
      return res.json({
        success: true,
        message: 'Abonnement Circuit déjà actif.',
        entitlement: foundEntitlement
      });
    }

    // 2. Migration Check: is it in legacy invitations?
    const existingInvitations = dal.entities.getAll('invitations');
    let legacyInv = null;
    for (const inv of existingInvitations) {
      let p;
      try { p = JSON.parse(inv.payload); } catch(e) {}
      if (p && (p.id === normalizedCode || p.code === normalizedCode)) {
        legacyInv = p;
        break;
      }
    }

    if (legacyInv) {
      if (legacyInv.used_by_user_id && legacyInv.used_by_user_id !== userId) {
        return res.status(403).json({ error: 'BLOCKED' });
      }
    } else {
      // If it's a completely new token, we just check format (e.g. CIR-XXXX)
      if (!normalizedCode.startsWith('CIR-')) {
        return res.status(400).json({ error: 'INVALID_TOKEN' });
      }
    }

    // 3. Token is valid and unused. Create new entitlement.
    const activatedAt = new Date();
    // Calculate calendar month duration
    const year = activatedAt.getUTCFullYear();
    const month = activatedAt.getUTCMonth() + 1; // 1-12
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const expiresAt = new Date(activatedAt.getTime() + (daysInMonth * 24 * 60 * 60 * 1000));

    const entitlementId = 'ent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    const entitlementPayload = {
      id: entitlementId,
      user_id: userId,
      service_code: 'CIRCUIT',
      status: 'ACTIVE',
      activated_at: activatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      activation_token_id: normalizedCode,
      activation_source: legacyInv ? 'LEGACY_INVITATION' : 'TOKEN',
      activation_duration_days: daysInMonth,
      created_at: activatedAt.toISOString(),
      updated_at: activatedAt.toISOString()
    };

    // Insert into DB
    dal.entities.insert(
      'service_entitlements', 
      entitlementId, 
      1, 
      JSON.stringify(entitlementPayload), 
      null,
      userId, 
      entitlementPayload.updated_at
    );

    return res.json({
      success: true,
      message: 'Abonnement Circuit activé avec succès.',
      entitlement: entitlementPayload
    });

  } catch (err) {
    console.error('Circuit resolve error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
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
    dal.airtable.updateStatusError('FAILED_RETRYABLE', 'AIRTABLE_NOT_CONFIGURED', row.entity, row.entity_id, row.central_version);
    return;
  }
  
  const entityRow = dal.entities.get(row.entity, row.entity_id);
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
      const currentEntity = dal.entities.getVersion(row.entity, row.entity_id);
      if (currentEntity && currentEntity.version === row.central_version) {
        dal.airtable.updateStatus('COMPLETED', row.entity, row.entity_id, row.central_version);
      }
    } else {
      const isRetryable = res.status >= 500 || res.status === 429;
      const newStatus = isRetryable ? 'FAILED_RETRYABLE' : 'FAILED_BLOCKED';
      dal.airtable.updateStatusError(newStatus, `HTTP ${res.status}`, row.entity, row.entity_id, row.central_version);
    }
  } catch (err) {
      dal.airtable.updateStatusError('FAILED_RETRYABLE', err.message, row.entity, row.entity_id, row.central_version);
  }
}

setInterval(() => {
  try {
    const now = new Date().toISOString();
    const pending = dal.airtable.getPendingQueue(now);
    for (const row of pending) {
      syncToAirtableMirror(row).catch(e => console.error(e));
    }
  } catch (e) {
    console.error('Mirror sync error', e);
  }
}, 5000);

const port = process.env.PORT || 3000;

// --- CIRCUIT V1 COMMERCIAL ENDPOINTS ---

app.post('/api/circuit/parse-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    
    let rows = [];
    if (req.file.originalname.endsWith('.csv')) {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = lines[i].split(',').map(v => v.trim());
        rows.push({
          source_row_id: 'row_' + i,
          recipient_raw: vals[0] || '',
          address_raw: vals[1] || '',
          other_raw_text: lines[i]
        });
      }
    } else if (req.file.originalname.endsWith('.xlsx')) {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 1; i < data.length; i++) {
        if (!data[i] || data[i].length === 0) continue;
        rows.push({
          source_row_id: 'row_' + i,
          recipient_raw: data[i][0] || '',
          address_raw: data[i][1] || '',
          other_raw_text: data[i].join(',')
        });
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Use CSV or XLSX.' });
    }
    
    res.json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/circuit/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const result = await CircuitOCRProvider.extract(req.file.buffer);
  res.json(result);
});

app.post('/api/circuit/speech', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio provided' });
  const result = await CircuitSpeechProvider.transcribe(req.file.buffer);
  res.json(result);
});

app.post('/api/circuit/quality-control', async (req, res) => {
  const result = await CircuitAgentWrapper.auditInput(req.body.rows, req.body.input_method);
  res.json(result);
});

app.post('/api/circuit/geocode', async (req, res) => {
  const result = await CircuitGeocodingProvider.geocode(req.body.address);
  res.json(result);
});

app.post('/api/circuit/route-matrix', async (req, res) => {
  const result = await CircuitRouteMatrixProvider.computeMatrix(req.body.origins, req.body.destinations);
  res.json(result);
});

app.post('/api/circuit/optimize', async (req, res) => {
  const result = await CircuitOptimizationProvider.optimize(req.body.stops, req.body.constraints);
  res.json(result);
});

app.post('/api/circuit/audit-optimization', async (req, res) => {
  const result = await CircuitAgentWrapper.auditOptimization(req.body.stops, req.body.optimizedOrder);
  res.json(result);
});

// --- END CIRCUIT V1 COMMERCIAL ENDPOINTS ---

dbPromise.then(() => {
  app.listen(port, () => console.log(`Recovery server running on port ${port}`));
}).catch(err => {
  console.error('Failed to init DB', err);
  process.exit(1);
});
