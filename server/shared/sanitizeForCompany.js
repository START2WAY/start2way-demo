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

module.exports = sanitizeForCompany;
