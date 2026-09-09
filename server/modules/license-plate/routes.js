const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { dal } = require('../../db/index.js');

const PlateOCRService = require('./services/PlateOCRService');
const LicensePlateAgentService = require('./services/LicensePlateAgentService');

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

const scanRateLimits = new Map();

router.post('/api/employee/plate-scan', async (req, res) => {
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

router.post('/api/employee/plate-confirm', async (req, res) => {
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

module.exports = router;
