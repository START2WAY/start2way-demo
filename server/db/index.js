const engine = process.env.DB_ENGINE || 'sqlite';

let dbImpl;
if (engine === 'postgres') {
  dbImpl = require('./postgres');
} else {
  dbImpl = require('./sqlite');
}

module.exports = {
  initDB: dbImpl.initDB,
  runInTransaction: dbImpl.runInTransaction,
  dal: dbImpl.dal,
  engine
};
