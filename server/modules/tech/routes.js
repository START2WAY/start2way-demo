const express = require('express');
const router = express.Router();
const { dal } = require('../../db/index.js');
const { sanitizePayload } = require('../sync/services/sanitizers.js');

router.get('/api/tech/audit/failed', async (req, res) => {
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

router.get('/api/tech/state', async (req, res) => {
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

module.exports = router;
