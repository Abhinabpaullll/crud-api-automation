'use strict';
/**
 * smoke-http.js
 *
 * Item 5: Real HTTP smoke test using Node's http module.
 * Performs one full CREATE → GET → UPDATE → DELETE → 404 cycle
 * and prints raw status lines + Content-Type headers (Invoke-WebRequest
 * style evidence, but from Node so it works without curl on Windows).
 *
 * Run:   node smoke-http.js
 * Requires the server to be running on PORT (default 5000).
 */

const http = require('http');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BASE = `http://localhost:${PORT}`;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'localhost', port: PORT, path,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, statusMessage: res.statusMessage, headers: res.headers, body: json, raw: data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function printResponse(label, r) {
  console.log(`\n>>> ${label}`);
  console.log(`HTTP/1.1 ${r.status} ${r.statusMessage || ''}`);
  console.log(`Content-Type: ${r.headers['content-type'] || '(none)'}`);
  console.log(`Content-Length: ${r.headers['content-length'] || r.raw.length}`);
  if (r.raw === '') {
    console.log('Body: (empty)');
  } else {
    console.log(`Body: ${JSON.stringify(r.body, null, 2)}`);
  }
}

(async () => {
  const TS = Date.now();
  const email = `smoke${TS}@example.com`;
  let id;

  console.log('='.repeat(70));
  console.log(`  SMOKE TEST  —  ${BASE}`);
  console.log('='.repeat(70));

  // 1) CREATE
  {
    const r = await req('POST', '/api/students', {
      name: 'Smoke Student', email, course: 'CSE', year: 2, cgpa: 8.5,
    });
    printResponse('POST /api/students  (expect 201)', r);
    id = r.body?.data?.id;
    console.log(`\n  → captured id: ${id}`);
  }

  // 2) GET
  {
    const r = await req('GET', `/api/students/${id}`);
    printResponse(`GET /api/students/${id}  (expect 200)`, r);
  }

  // 3) UPDATE
  {
    const r = await req('PUT', `/api/students/${id}`, {
      name: 'Smoke Updated', email, course: 'ECE', year: 3, cgpa: 9.0,
    });
    printResponse(`PUT /api/students/${id}  (expect 200)`, r);
  }

  // 4) DELETE
  {
    const r = await req('DELETE', `/api/students/${id}`);
    printResponse(`DELETE /api/students/${id}  (expect 204)`, r);
  }

  // 5) GET after delete → 404
  {
    const r = await req('GET', `/api/students/${id}`);
    printResponse(`GET /api/students/${id}  (expect 404 NOT_FOUND)`, r);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  SMOKE TEST DONE');
  console.log('='.repeat(70) + '\n');
})();

