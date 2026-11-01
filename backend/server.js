'use strict';

const express = require('express');
const cors    = require('cors');

const { ENABLE_TEST_ROUTES } = require('./src/config/env');
const { connect }            = require('./src/config/db');
const { PORT }               = require('./src/config/env');

const healthRoutes  = require('./src/routes/health');
const studentRoutes = require('./src/routes/students');
const testRoutes    = require('./src/routes/test');

const { jsonSyntaxErrorHandler, internalErrorHandler } = require('./src/middleware/errorHandler');
const { error } = require('./src/utils/response');

const app = express();

// ---------- global middleware ----------
app.use(cors());

// Parse JSON bodies; malformed JSON triggers jsonSyntaxErrorHandler below
app.use(express.json());

// ---------- routes ----------
app.use(healthRoutes);                     // GET /health
app.use('/api/students', studentRoutes);   // CRUD /api/students[/:id]

if (ENABLE_TEST_ROUTES) {
  console.log('[test-routes] POST /api/test/reset is ENABLED');
  app.use('/api/test', testRoutes);
}

// ---------- 404 catch-all (must be after all routes) ----------
app.use((req, res) => {
  return error(res, 404, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.path}`);
});

// ---------- error handlers ----------
app.use(jsonSyntaxErrorHandler);
app.use(internalErrorHandler);

// ---------- start ----------
(async () => {
  await connect();
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
})();

module.exports = app; // export for testing
