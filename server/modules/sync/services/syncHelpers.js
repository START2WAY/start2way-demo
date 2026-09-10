const crypto = require('crypto');
const { dal } = require('../../../db/index.js');
const stableStringify = require('../../../shared/stableStringify.js');
const { sanitizePayload } = require('./sanitizers.js');

async function recordFailedOperation(reqData, reason) {
  const { operation_id, entity, entity_id, payload, clientType, actorId, userId, companyId } = reqData;
  const now = new Date().toISOString();
  let sanitized = sanitizePayload(entity, payload, clientType);
  
  if (sanitized) {
    sanitized = { ...sanitized };
    delete sanitized.secret_token;
    delete sanitized.password;
    delete sanitized.pin_code;
  }
  
  await dal.operations.insertFailed(
    operation_id || 'UNKNOWN',
    entity || 'UNKNOWN',
    entity_id || 'UNKNOWN',
    reason,
    now,
    clientType,
    actorId,
    userId || null,
    companyId || null,
    JSON.stringify(sanitized)
  );
}

function calculateFingerprint(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

module.exports = {
  recordFailedOperation,
  calculateFingerprint
};
