const crypto = require('crypto');

function uuidv4() {
  return crypto.randomUUID();
}

module.exports = uuidv4;
