const express = require('express');
const router = express.Router();
const getUserAuth = require('../../shared/auth/getUserAuth.js');
const { dal } = require('../../db/index.js');
const { sanitizePayload, ALLOWED_ENTITIES } = require('./services/sanitizers.js');
const { calculateFingerprint } = require('./services/syncHelpers.js');
const { applyMutation } = require('./services/mutations.js');

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

router.post('/api/sync/conflicts/:id/recheck', mutateHandler);
router.post('/api/sync/mutate', mutateHandler);

router.get('/api/sync/changes', async (req, res) => {
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

router.get('/api/sync/conflicts', async (req, res) => {
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

router.get('/api/sync/conflicts/:id', async (req, res) => {
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


module.exports = router;
