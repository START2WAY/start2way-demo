const sqliteImpl = require('./sqlite');
const postgresImpl = require('./postgres');

const engine = process.env.DB_ENGINE || 'sqlite';

let dbImpl;
if (engine === 'postgres') {
  dbImpl = postgresImpl;
} else {
  dbImpl = sqliteImpl;
}

module.exports = {
  initDB: dbImpl.initDB,
  runInTransaction: dbImpl.runInTransaction,
  dal: dbImpl.dal,
  engine
};
