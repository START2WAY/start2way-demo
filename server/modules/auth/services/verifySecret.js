const crypto = require('crypto');

const KEY_LEN = 64;

function verifySecret(secret, hashStr) {
  if (!secret || !hashStr) return false;
  if (!hashStr.startsWith('$scrypt$')) {
    // Legacy plaintext support during transition
    return secret === hashStr;
  }
  const parts = hashStr.split('$');
  const salt = parts[2];
  const storedKey = parts[3];
  const derivedKey = crypto.scryptSync(secret, salt, KEY_LEN).toString('hex');
  return derivedKey === storedKey;
}

module.exports = verifySecret;
