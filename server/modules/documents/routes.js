const express = require('express');
const fs = require('fs');
const path = require('path');
const { dal } = require('../../db/index.js');
const getUserAuth = require('../../shared/auth/getUserAuth.js');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post('/:id/file', async (req, res) => {
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

router.get('/:id/file', async (req, res) => {
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

module.exports = router;
