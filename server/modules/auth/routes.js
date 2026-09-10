const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { dal } = require('../../db/index.js');
const verifySecret = require('./services/verifySecret.js');
const getUserAuth = require('../../shared/auth/getUserAuth.js');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'MISSING_CREDENTIALS' });

  const users = dal.entities.getAllEntityIdAndPayloads('users');
  let foundUser = null;
  let userPayload = null;

  for (const u of users) {
    try {
      const p = JSON.parse(u.payload);
      if (p.email === email && verifySecret(password, p.password)) {
        foundUser = u.entity_id;
        userPayload = p;
        break;
      }
    } catch(e) {}
  }

  // Also check companies for legacy/simple company login
  let foundCompany = null;
  let companyPayload = null;
  if (!foundUser) {
    const companies = dal.entities.getAllEntityIdAndPayloads('companies');
    for (const c of companies) {
      try {
        const p = JSON.parse(c.payload);
        if (p.email === email && verifySecret(password, p.password)) {
          foundCompany = c.entity_id;
          companyPayload = p;
          break;
        }
      } catch(e) {}
    }
  }

  if (!foundUser && !foundCompany) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  if (foundUser) {
    // If it's a tech user
    const role = userPayload.role === 'tech' ? 'tech' : 'salarie';
    dal.sessions.createForUser(token, user.entity_id, 'user', now, expiresAt);
    return res.json({ token, company: sanitizeForCompany('companies', companyPayload) });
  }
});

router.post('/verify-pin', async (req, res) => {
  const auth = await getUserAuth(req);
  if (!auth || !auth.user_id) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'MISSING_PIN' });

  const userEnt = dal.entities.getPayload('users', auth.user_id);
  if (!userEnt) return res.status(404).json({ error: 'NOT_FOUND' });

  const p = JSON.parse(userEnt.payload);
  if (!verifySecret(pin, p.pin_code)) {
    return res.status(401).json({ error: 'INVALID_PIN' });
  }

  res.json({ success: true });
});

module.exports = router;
