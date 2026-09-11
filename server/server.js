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

const dbConfig = process.env.DATABASE_URL;
const dbPromise = initDB(dbConfig);



// Deterministic JSON stringify
const stableStringify = require('./shared/stableStringify.js');

// Fingerprint calculation


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

const hashSecret = require('./modules/auth/services/hashSecret.js');

const getUserAuth = require('./shared/auth/getUserAuth.js');
const uuidv4 = require('./shared/uuidv4.js');

// UUID helper

// Sanitization functions

// Apply mutation

// Endpoints
app.get('/health', (req, res) => res.send('OK'));

// ==========================================
// EMPLOYEE LICENSE PLATE SCANNER V1
// ==========================================
const licensePlateRoutes = require('./modules/license-plate/routes');
app.use(licensePlateRoutes);

// ==========================================
// AI CHAT ENDPOINTS
// ==========================================----------------------------------------------------
app.use('/api/auth', require('./modules/auth/routes.js'));


// ----------------------------------------------------
// DOCUMENTS
// ----------------------------------------------------
const documentsRoutes = require('./modules/documents/routes.js');
app.use('/api/documents', documentsRoutes);
// ----------------------------------------------------



// ----------------------------------------------------






app.use('/api/fleet', require('./modules/fleet/routes'));






const syncRoutes = require('./modules/sync/routes.js');
app.use(syncRoutes);
const techRoutes = require('./modules/tech/routes.js');
app.use(techRoutes);

// ----------------------------------------------------------------------------
const circuitRoutes = require('./modules/circuit/routes.js');
app.use(circuitRoutes);

const port = process.env.PORT || 8080;

dbPromise.then(() => {
  app.listen(port, () => console.log(`Recovery server running on port ${port}`));
}).catch(err => {
  console.error('Failed to init DB', err);
  process.exit(1);
});
