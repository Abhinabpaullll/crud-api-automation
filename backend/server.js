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
const { isValidId } = require('./src/utils/idCheck');

const app = express();

// ---------- global middleware ----------
app.use(cors());

// Check the path id before parsing JSON. Express router params run after
// application middleware, so router.param alone cannot enforce D-08 ordering.
app.use('/api/students', (req, res, next) => {
  const match = req.path.match(/^\/([^/]+)$/);
  if (match && ['GET', 'PUT', 'DELETE'].includes(req.method) && !isValidId(match[1])) {
    return error(res, 400, 'INVALID_ID', 'id must be a 24-character lowercase hex string');
  }
  next();
});

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

