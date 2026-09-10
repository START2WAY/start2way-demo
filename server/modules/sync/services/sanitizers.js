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

const sanitizeForCompany = require('../../../shared/sanitizeForCompany.js');

const sanitizeForTech = require('../../../shared/sanitizeForTech.js');

function sanitizePayload(entityType, payload, clientType) {
  if (clientType === 'EMPLOYEE_APP') return sanitizeForEmployee(entityType, payload);
  if (clientType === 'COMPANY_PANEL') return sanitizeForCompany(entityType, payload);
  if (clientType === 'START2WAY_TECH_PANEL') return sanitizeForTech(entityType, payload);
  return payload;
}

module.exports = {
  ALLOWED_ENTITIES,
  sanitizeForEmployee,
  sanitizeForCompany,
  sanitizeForTech,
  sanitizePayload
};
