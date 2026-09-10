const crypto = require('crypto');

const SALT_SIZE = 16;
const KEY_LEN = 64;

function hashSecret(secret) {
  if (!secret) return null;
  if (secret.startsWith('$scrypt$')) return secret; // already hashed
  const salt = crypto.randomBytes(SALT_SIZE).toString('hex');
  const derivedKey = crypto.scryptSync(secret, salt, KEY_LEN).toString('hex');
  return `$scrypt$${salt}$${derivedKey}`;
}

module.exports = hashSecret;
