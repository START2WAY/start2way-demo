const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const CircuitAgentWrapper = require('./services/CircuitAgentWrapper.js');
const CircuitGeocodingProvider = require('./services/CircuitGeocodingProvider.js');
const CircuitOCRProvider = require('./services/CircuitOCRProvider.js');
const CircuitOptimizationProvider = require('./services/CircuitOptimizationProvider.js');
const CircuitRouteMatrixProvider = require('./services/CircuitRouteMatrixProvider.js');
const CircuitSpeechProvider = require('./services/CircuitSpeechProvider.js');
const CircuitPipeline = require('./CircuitPipeline.js');

// CIRCUIT API
// ----------------------------------------------------------------------------
router.post('/api/circuits/resolve', async (req, res) => {
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



router.post('/api/circuit/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const result = await CircuitOCRProvider.extract(req.file.buffer);
  res.json(result);
});

router.post('/api/circuit/speech', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio provided' });
  const result = await CircuitSpeechProvider.transcribe(req.file.buffer);
  res.json(result);
});

router.post('/api/circuit/quality-control', async (req, res) => {
  const result = await CircuitAgentWrapper.auditInput(req.body.rows, req.body.input_method);
  res.json(result);
});

router.post('/api/circuit/geocode', async (req, res) => {
  const result = await CircuitGeocodingProvider.geocode(req.body.address);
  res.json(result);
});

router.post('/api/circuit/route-matrix', async (req, res) => {
  const result = await CircuitRouteMatrixProvider.computeMatrix(req.body.origins, req.body.destinations);
  res.json(result);
});

router.post('/api/circuit/optimize', async (req, res) => {
  const result = await CircuitOptimizationProvider.optimize(req.body.stops, req.body.constraints);
  res.json(result);
});

router.post('/api/circuit/audit-optimization', async (req, res) => {
  const result = await CircuitAgentWrapper.auditOptimization(req.body.stops, req.body.optimizedOrder);
  res.json(result);
});

router.post('/api/circuit/run', async (req, res) => {
  const result = await CircuitPipeline.run(req.body);
  res.json(result);
});

// --- END CIRCUIT V1 COMMERCIAL ENDPOINTS ---

module.exports = router;
