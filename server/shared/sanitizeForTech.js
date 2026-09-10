function sanitizeForTech(entityType, payload) {
  // Tech sees most things, but strip purely secret keys if any
  if (!payload) return payload;
  let p = { ...payload };
  delete p.secret_token;
  delete p.password;
  delete p.pin_code;
  
  if (entityType === 'users') {
    delete p.password;
    delete p.pin_code;
    return p;
  }
  if (entityType === 'companies') {
    delete p.password;
    return p;
  }

  return p;
}

module.exports = sanitizeForTech;
