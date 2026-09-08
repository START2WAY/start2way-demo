CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS entities (
  entity TEXT,
  entity_id TEXT,
  version INTEGER,
  payload JSONB,
  company_id TEXT,
  user_id TEXT,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (entity, entity_id)
);

CREATE TABLE IF NOT EXISTS changelog (
  sequence BIGSERIAL PRIMARY KEY,
  id TEXT,
  operation_id TEXT,
  entity TEXT,
  entity_id TEXT,
  operation TEXT,
  version INTEGER,
  occurred_at TIMESTAMPTZ,
  actor_type TEXT,
  actor_id TEXT,
  user_id TEXT,
  company_id TEXT,
  payload JSONB
);

CREATE TABLE IF NOT EXISTS processed_operations (
  operation_id TEXT PRIMARY KEY,
  status TEXT,
  entity TEXT,
  entity_id TEXT,
  version INTEGER,
  sequence INTEGER,
  timestamp TIMESTAMPTZ,
  request_fingerprint TEXT
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  conflict_id TEXT PRIMARY KEY,
  operation_id TEXT UNIQUE,
  entity TEXT,
  entity_id TEXT,
  client_base_version INTEGER,
  server_version_at_conflict INTEGER,
  client_payload JSONB,
  server_payload JSONB,
  actor_type TEXT,
  actor_id TEXT,
  user_id TEXT,
  company_id TEXT,
  employment_id TEXT,
  status TEXT,
  reason TEXT,
  request_fingerprint TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_type TEXT,
  resolution_operation_id TEXT
);

CREATE TABLE IF NOT EXISTS failed_operations (
  sequence BIGSERIAL PRIMARY KEY,
  operation_id TEXT,
  entity TEXT,
  entity_id TEXT,
  reason TEXT,
  occurred_at TIMESTAMPTZ,
  actor_type TEXT,
  actor_id TEXT,
  user_id TEXT,
  company_id TEXT,
  payload JSONB
);

CREATE TABLE IF NOT EXISTS airtable_mirror_status (
  entity TEXT,
  entity_id TEXT,
  central_version INTEGER,
  status TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (entity, entity_id)
);
