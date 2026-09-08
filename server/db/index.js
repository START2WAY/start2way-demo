const dbImpl = require('./postgres');

module.exports = {
  initDB: dbImpl.initDB,
  runInTransaction: dbImpl.runInTransaction,
  dal: dbImpl.dal,
  engine: 'postgres'
};
