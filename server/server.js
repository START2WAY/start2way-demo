const express = require('express');
const cors = require('cors');
const { initDB } = require('./db/index.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const dbConfig = process.env.DATABASE_URL;
const dbPromise = initDB(dbConfig);

// Deterministic JSON stringify

// Fingerprint calculation

// ----------------------------------------------------
// AUTH & HASHING
// ----------------------------------------------------
const SALT_SIZE = 16;
const KEY_LEN = 64;

// UUID helper

// Sanitization functions

// Apply mutation

// Endpoints
app.get('/health', (req, res) => res.send('OK'));

// ==========================================
// EMPLOYEE LICENSE PLATE SCANNER V1
// ==========================================
const licensePlateRoutes = require('./modules/license-plate/routes');
app.use(licensePlateRoutes);

// ==========================================
// AI CHAT ENDPOINTS
// ==========================================----------------------------------------------------
app.use('/api/auth', require('./modules/auth/routes.js'));


// ----------------------------------------------------
// DOCUMENTS
// ----------------------------------------------------
const documentsRoutes = require('./modules/documents/routes.js');
app.use('/api/documents', documentsRoutes);
// ----------------------------------------------------



// ----------------------------------------------------






app.use('/api/fleet', require('./modules/fleet/routes'));






const syncRoutes = require('./modules/sync/routes.js');
app.use(syncRoutes);
const techRoutes = require('./modules/tech/routes.js');
app.use(techRoutes);

// ----------------------------------------------------------------------------
const circuitRoutes = require('./modules/circuit/routes.js');
app.use(circuitRoutes);

const port = process.env.PORT || 8080;

dbPromise.then(() => {
  app.listen(port, () => console.log(`Recovery server running on port ${port}`));
}).catch(err => {
  console.error('Failed to init DB', err);
  process.exit(1);
});
