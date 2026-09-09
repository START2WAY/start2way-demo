const { dal } = require('../../db/index.js');

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

module.exports = getUserAuth;
