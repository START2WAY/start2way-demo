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
