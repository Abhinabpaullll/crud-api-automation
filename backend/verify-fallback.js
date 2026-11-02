'use strict';
/**
 * Verify that an unreachable MongoDB URI falls back to memory and that the
 * server becomes ready within five seconds.
 *
 * Run: node verify-fallback.js
 */

const http = require('http');

process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/x';
process.env.ENABLE_TEST_ROUTES = 'false';
process.env.PORT = '5099';

const startedAt = Date.now();
const deadline = startedAt + 5000;

console.log(`\n[test] MONGODB_URI = ${process.env.MONGODB_URI}`);
console.log('[test] Starting server — expecting memory fallback and /health within 5000 ms ...\n');

// Let server.js own the single Mongo connection attempt and start listening
// after it selects the memory fallback.
require('./server');

function readHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: 5099, path: '/health' }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
  });
}

async function waitForHealth() {
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await readHealth();
    } catch (err) {
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  throw lastError || new Error('Timed out waiting for /health');
}

(async () => {
  try {
    const response = await waitForHealth();
    const elapsed = Date.now() - startedAt;
    console.log(`[test] GET /health → HTTP ${response.status}`);
    console.log(`[test] body: ${JSON.stringify(response.body)}`);
    console.log(`[timing] startup-to-health = ${elapsed} ms (limit 5000 ms)`);

    const ok = response.status === 200 &&
      response.body?.data?.status === 'ok' &&
      response.body?.data?.storage === 'memory' &&
      elapsed <= 5000;
    console.log(`[result] ${ok ? 'PASS ✓' : 'FAIL ✗'}`);
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('[result] FAIL ✗', err);
    process.exit(1);
  }
})();
