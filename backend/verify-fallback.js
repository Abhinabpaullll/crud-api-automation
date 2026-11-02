'use strict';
/**
 * verify-fallback.js
 *
 * Tests item 4: unreachable MongoDB → falls back to in-memory within ~5 s.
 *
 * Run:  node verify-fallback.js
 *
 * Sets MONGODB_URI to a definitely-unreachable URI, starts the server
 * in-process, measures startup time, then confirms /health reports storage:"memory".
 */

const http = require('http');

process.env.MONGODB_URI      = 'mongodb://127.0.0.1:1/none';  // port 1 → unreachable
process.env.ENABLE_TEST_ROUTES = 'false';
process.env.PORT              = '5099'; // avoid conflict with other instances

const t0 = Date.now();
console.log(`\n[test] MONGODB_URI = ${process.env.MONGODB_URI}`);
console.log('[test] Starting server — expecting fallback to memory within ~5 s ...\n');

(async () => {
  // Clear module cache so db.js re-runs connect() with the new URI
  for (const key of Object.keys(require.cache)) {
    if (key.includes('crud-api-automation\\backend') || key.includes('crud-api-automation/backend')) {
      delete require.cache[key];
    }
  }

  const { connect } = require('./src/config/db');
  await connect();
  const elapsed = Date.now() - t0;
  console.log(`\n[test] connect() resolved in ${elapsed} ms`);

  require('./server');
  await new Promise(r => setTimeout(r, 300));

  // Check /health
  const r = await new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'localhost', port: 5099, path: '/health' };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end();
  });

  console.log(`\n[test] GET /health → HTTP ${r.status}`);
  console.log(`[test] body: ${JSON.stringify(r.body)}`);

  const ok =
    r.status === 200 &&
    r.body?.data?.status === 'ok' &&
    r.body?.data?.storage === 'memory' &&
    elapsed < 8000;

  console.log(`\n[result] Fallback within 8 s: ${elapsed} ms   /health storage: "${r.body?.data?.storage}"`);
  console.log(`[result] ${ok ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(ok ? 0 : 1);
})();

