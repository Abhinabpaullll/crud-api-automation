'use strict';
/**
 * test-contract.js
 *
 * Loads docs/contract/openapi.yaml, compiles the schemas with Ajv+ajv-formats,
 * then validates real API responses for every endpoint and every documented
 * status code: 200, 201, 204, 400, 404, 409.
 *
 * Run (server must already be listening):
 *   node test-contract.js
 *   PORT=5000 node test-contract.js
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const YAML  = require('yaml');
const Ajv   = require('ajv');
const addFormats = require('ajv-formats');

// ── load schema from the real contract ────────────────────────────────────────
const CONTRACT_PATH = path.resolve(__dirname, '../docs/contract/openapi.yaml');
console.log(`\n[contract] Loading schema from: ${CONTRACT_PATH}`);
const raw = fs.readFileSync(CONTRACT_PATH, 'utf8');
const spec = YAML.parse(raw);

// Pull component schemas
const schemas = spec.components.schemas;

// ── build Ajv instance ────────────────────────────────────────────────────────
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// Inline $ref resolver — replace '#/components/schemas/X' refs with the actual schema
function resolve(schema) {
  if (!schema) return schema;
  if (typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(resolve);

  if (schema.$ref) {
    const name = schema.$ref.replace('#/components/schemas/', '');
    return resolve(schemas[name]);
  }
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    out[k] = resolve(v);
  }
  return out;
}

const Student             = resolve(schemas.Student);
const StudentInput        = resolve(schemas.StudentInput);
const StudentResponse     = resolve(schemas.StudentResponse);
const StudentListResponse = resolve(schemas.StudentListResponse);
const HealthResponse      = resolve(schemas.HealthResponse);
const ErrorResponse       = resolve(schemas.ErrorResponse);

console.log('[contract] Schemas loaded and $refs resolved\n');

// ── helpers ────────────────────────────────────────────────────────────────────
function httpReq(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const opts = {
      method,
      hostname: 'localhost',
      port: process.env.PORT || 5000,
      path: urlPath,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function rawReq(method, urlPath, rawBody) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      hostname: 'localhost',
      port: process.env.PORT || 5000,
      path: urlPath,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rawBody) },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });
    r.on('error', reject);
    r.write(rawBody);
    r.end();
  });
}

let passed = 0;
let failed = 0;

function check(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}`); failed++; }
}

function validateSchema(schema, data, label) {
  const validate = ajv.compile(schema);
  const ok = validate(data);
  if (!ok) {
    console.error(`  ✗ Schema [${label}] errors:`, JSON.stringify(validate.errors, null, 2));
    failed++;
    return false;
  }
  console.log(`  ✓ Schema [${label}] valid`);
  passed++;
  return true;
}

function section(title) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(70));
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  const TS = Date.now();

  // ── GET /health → 200 HealthResponse ────────────────────────────────────────
  section('GET /health → 200');
  {
    const r = await httpReq('GET', '/health');
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    console.log(`  Content-Type: ${r.headers['content-type']}`);
    check('status 200', r.status === 200);
    validateSchema(HealthResponse, r.body, 'HealthResponse');
    check('storage is mongo or memory',
      r.body?.data?.storage === 'mongo' || r.body?.data?.storage === 'memory');
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ── POST /api/students → 201 StudentResponse ────────────────────────────────
  section('POST /api/students → 201');
  const studentPayload = { name: 'Contract Tester', email: `ct${TS}@example.com`, course: 'CSE', year: 2, cgpa: 8.5 };
  let createdId, createdAt;
  {
    const r = await httpReq('POST', '/api/students', studentPayload);
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 201', r.status === 201);
    validateSchema(StudentResponse, r.body, 'StudentResponse (201)');
    check('id is 24-char hex', /^[a-f0-9]{24}$/.test(r.body?.data?.id));
    check('email lower-cased', r.body?.data?.email === studentPayload.email.toLowerCase());
    check('no _id in response', !('_id' in (r.body?.data ?? {})));
    check('no __v in response', !('__v' in (r.body?.data ?? {})));
    check('createdAt present (ISO 8601)', !!r.body?.data?.createdAt);
    check('updatedAt present (ISO 8601)', !!r.body?.data?.updatedAt);
    createdId  = r.body?.data?.id;
    createdAt  = r.body?.data?.createdAt;
  }

  // ── POST → 400 VALIDATION_ERROR (missing name) ──────────────────────────────
  section('POST /api/students → 400 VALIDATION_ERROR (missing name)');
  {
    const r = await httpReq('POST', '/api/students', { email: 'x@x.com', course: 'EE', year: 1, cgpa: 5 });
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 400', r.status === 400);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (400 VALIDATION_ERROR)');
    check('code VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details array present', Array.isArray(r.body?.error?.details));
    check('details contains "name"', r.body?.error?.details?.some(d => d.field === 'name'));
  }

  // ── POST → 400 INVALID_JSON (malformed body) ─────────────────────────────────
  section('POST /api/students → 400 INVALID_JSON');
  {
    const r = await rawReq('POST', '/api/students', '{bad json');
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 400', r.status === 400);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (400 INVALID_JSON)');
    check('code INVALID_JSON', r.body?.error?.code === 'INVALID_JSON');
  }

  // ── GET /api/students → 200 StudentListResponse ─────────────────────────────
  section('GET /api/students → 200');
  {
    const r = await httpReq('GET', '/api/students');
    console.log(`  Raw response: HTTP ${r.status} | body (abbrev): success=${r.body?.success} count=${r.body?.count} total=${r.body?.total}`);
    check('status 200', r.status === 200);
    validateSchema(StudentListResponse, r.body, 'StudentListResponse (200)');
    check('data is array', Array.isArray(r.body?.data));
    check('all items pass Student schema', r.body?.data?.every(item => {
      const v = ajv.compile(Student);
      return v(item);
    }));
  }

  // ── GET /api/students?page=0 → 400 VALIDATION_ERROR ─────────────────────────
  section('GET /api/students?page=0 → 400 VALIDATION_ERROR');
  {
    const r = await httpReq('GET', '/api/students?page=0');
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 400', r.status === 400);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (400 pagination)');
    check('code VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
  }

  // ── GET /api/students/:id → 200 StudentResponse ──────────────────────────────
  section(`GET /api/students/${createdId} → 200`);
  {
    const r = await httpReq('GET', `/api/students/${createdId}`);
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 200', r.status === 200);
    validateSchema(StudentResponse, r.body, 'StudentResponse (GET 200)');
    check('data.id matches', r.body?.data?.id === createdId);
  }

  // ── GET /:id → 400 INVALID_ID (malformed id) ─────────────────────────────────
  section('GET /api/students/abc123 → 400 INVALID_ID');
  {
    const r = await httpReq('GET', '/api/students/abc123');
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 400', r.status === 400);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (400 INVALID_ID)');
    check('code INVALID_ID', r.body?.error?.code === 'INVALID_ID');
  }

  // ── D-08 edge case: PUT /bad-id + malformed JSON → INVALID_ID (not INVALID_JSON)
  section('PUT /api/students/bad-id + malformed JSON → 400 INVALID_ID (D-08 order)');
  {
    const r = await rawReq('PUT', '/api/students/notvalid', '{bad json');
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 400', r.status === 400);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (D-08 INVALID_ID first)');
    check('code INVALID_ID (not INVALID_JSON)', r.body?.error?.code === 'INVALID_ID');
  }

  // ── PUT /api/students/:id → 200 StudentResponse ──────────────────────────────
  section(`PUT /api/students/${createdId} → 200`);
  let updatedAt;
  {
    await new Promise(r => setTimeout(r, 50)); // ensure updatedAt differs
    const r = await httpReq('PUT', `/api/students/${createdId}`, {
      name: 'Updated Name', email: studentPayload.email, course: 'ECE', year: 3, cgpa: 9.0,
    });
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 200', r.status === 200);
    validateSchema(StudentResponse, r.body, 'StudentResponse (PUT 200)');
    check('createdAt unchanged (D-12)', r.body?.data?.createdAt === createdAt);
    check('updatedAt changed (D-12)', r.body?.data?.updatedAt !== createdAt);
    updatedAt = r.body?.data?.updatedAt;
  }

  // ── PUT with another student's email → 409 DUPLICATE_EMAIL ──────────────────
  section('PUT with another student\'s email → 409 DUPLICATE_EMAIL');
  {
    const s2 = await httpReq('POST', '/api/students', {
      name: 'Second', email: `s2${TS}@example.com`, course: 'ME', year: 1, cgpa: 6.0,
    });
    const sid2 = s2.body?.data?.id;
    const r = await httpReq('PUT', `/api/students/${sid2}`, {
      name: 'Second', email: studentPayload.email, course: 'ME', year: 1, cgpa: 6.0,
    });
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 409', r.status === 409);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (409 DUPLICATE_EMAIL via PUT)');
    check('code DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
  }

  // ── POST duplicate email → 409 DUPLICATE_EMAIL ───────────────────────────────
  section('POST duplicate email → 409');
  {
    const r = await httpReq('POST', '/api/students', studentPayload);
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 409', r.status === 409);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (409 DUPLICATE_EMAIL via POST)');
    check('code DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
  }

  // ── POST duplicate email different case → 409 ────────────────────────────────
  section('POST duplicate email different case → 409');
  {
    const r = await httpReq('POST', '/api/students', {
      ...studentPayload, email: studentPayload.email.toUpperCase(),
    });
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 409', r.status === 409);
    check('code DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
  }

  // ── PUT → 400 VALIDATION_ERROR (missing field) ───────────────────────────────
  section(`PUT /api/students/${createdId} → 400 VALIDATION_ERROR (missing cgpa)`);
  {
    const r = await httpReq('PUT', `/api/students/${createdId}`, {
      name: 'X', email: studentPayload.email, course: 'CSE', year: 2, /* cgpa missing */
    });
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 400', r.status === 400);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (PUT 400 VALIDATION_ERROR)');
    check('code VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
  }

  // ── DELETE /api/students/:id → 204 empty body ────────────────────────────────
  section(`DELETE /api/students/${createdId} → 204`);
  {
    const r = await httpReq('DELETE', `/api/students/${createdId}`);
    console.log(`  Raw response: HTTP ${r.status} | raw body: "${r.raw}"`);
    check('status 204', r.status === 204);
    check('body is empty (D-06)', r.raw === '');
  }

  // ── GET deleted → 404 NOT_FOUND ──────────────────────────────────────────────
  section(`GET /api/students/${createdId} → 404 (after delete)`);
  {
    const r = await httpReq('GET', `/api/students/${createdId}`);
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 404', r.status === 404);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (404 NOT_FOUND)');
    check('code NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ── PUT non-existing → 404 NOT_FOUND ─────────────────────────────────────────
  section('PUT /api/students/000000000000000000000001 → 404 NOT_FOUND');
  {
    const r = await httpReq('PUT', '/api/students/000000000000000000000001', {
      name: 'Ghost', email: `ghost${TS}@x.com`, course: 'CSE', year: 1, cgpa: 5.0,
    });
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 404', r.status === 404);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (PUT 404 NOT_FOUND)');
    check('code NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ── DELETE invalid id → 400 INVALID_ID ───────────────────────────────────────
  section('DELETE /api/students/BADID → 400 INVALID_ID');
  {
    const r = await httpReq('DELETE', '/api/students/BADID');
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 400', r.status === 400);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (DELETE 400 INVALID_ID)');
    check('code INVALID_ID', r.body?.error?.code === 'INVALID_ID');
  }

  // ── Unknown route → 404 ROUTE_NOT_FOUND ──────────────────────────────────────
  section('GET /api/unknown → 404 ROUTE_NOT_FOUND');
  {
    const r = await httpReq('GET', '/api/unknown');
    console.log(`  Raw response: HTTP ${r.status} | body: ${JSON.stringify(r.body)}`);
    check('status 404', r.status === 404);
    validateSchema(ErrorResponse, r.body, 'ErrorResponse (404 ROUTE_NOT_FOUND)');
    check('code ROUTE_NOT_FOUND', r.body?.error?.code === 'ROUTE_NOT_FOUND');
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  CONTRACT VALIDATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(70) + '\n');
  process.exit(failed > 0 ? 1 : 0);
})();
