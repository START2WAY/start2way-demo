const { runInTransaction, dal } = require('../../../db/index.js');
const hashSecret = require('../../../shared/hashSecret.js');
const uuidv4 = require('../../../shared/uuidv4.js');
const { recordFailedOperation } = require('./syncHelpers.js');

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
    
  }

  return { status: 'ack', sequence, version: newVersion };
});

module.exports = { applyMutation };
