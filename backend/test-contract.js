'use strict';
/**
 * test-contract.js  —  lightweight smoke-test that validates live API responses
 * against the OpenAPI 3.0 schema using Ajv.
 *
 * Run:   node test-contract.js
 * Requires the server to be running on PORT (default 5000).
 */

const http  = require('http');
const Ajv   = require('ajv');
const addFormats = require('ajv-formats');

const BASE = `http://localhost:${process.env.PORT || 5000}`;

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// ---- inline schema fragments copied from openapi.yaml ----
const Student = {
  type: 'object',
  required: ['id', 'name', 'email', 'course', 'year', 'cgpa', 'createdAt', 'updatedAt'],
  additionalProperties: false,
  properties: {
    id:        { type: 'string', pattern: '^[a-f0-9]{24}$' },
    name:      { type: 'string', minLength: 1, maxLength: 100 },
    email:     { type: 'string', format: 'email', maxLength: 254 },
    course:    { type: 'string', minLength: 1, maxLength: 100 },
    year:      { type: 'integer', minimum: 1, maximum: 4 },
    cgpa:      { type: 'number', minimum: 0, maximum: 10 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const StudentResponse     = { type: 'object', required: ['success', 'data'], additionalProperties: false, properties: { success: { type: 'boolean', enum: [true] }, data: Student } };
const StudentListResponse = { type: 'object', required: ['success', 'count', 'total', 'page', 'limit', 'data'], additionalProperties: false, properties: { success: { type: 'boolean', enum: [true] }, count: { type: 'integer', minimum: 0 }, total: { type: 'integer', minimum: 0 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 }, data: { type: 'array', items: Student } } };
const HealthResponse      = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', enum: [true] }, data: { type: 'object', required: ['status', 'storage'], properties: { status: { type: 'string', enum: ['ok'] }, storage: { type: 'string', enum: ['mongo', 'memory'] } } } } };
const ErrorResponse       = { type: 'object', required: ['success', 'error'], additionalProperties: false, properties: { success: { type: 'boolean', enum: [false] }, error: { type: 'object', required: ['code', 'message'], additionalProperties: false, properties: { code: { type: 'string', enum: ['VALIDATION_ERROR', 'INVALID_ID', 'INVALID_JSON', 'NOT_FOUND', 'DUPLICATE_EMAIL', 'ROUTE_NOT_FOUND', 'INTERNAL_ERROR'] }, message: { type: 'string' }, details: { type: 'array', items: { type: 'object', required: ['field', 'message'], properties: { field: { type: 'string' }, message: { type: 'string' } } } } } } } };

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const opts = {
      method,
      hostname: 'localhost',
      port: process.env.PORT || 5000,
      path,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { /* 204 or plain */ }
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function validate(schema, data, label) {
  const fn = ajv.compile(schema);
  const ok = fn(data);
  if (!ok) {
    console.error(`  ✗ Schema mismatch in [${label}]:`, fn.errors);
    return false;
  }
  return true;
}

let passed = 0;
let failed = 0;

function check(label, result) {
  if (result) { console.log(`  ✓ ${label}`); passed++; }
  else        { console.error(`  ✗ ${label}`); failed++; }
}

(async () => {
  console.log('\n=== Contract validation against live server ===\n');

  // Health
  {
    const r = await req('GET', '/health');
    check('GET /health -> 200', r.status === 200);
    check('GET /health schema', validate(HealthResponse, r.body, 'HealthResponse'));
    check('GET /health content-type json', r.headers['content-type'].includes('application/json'));
  }

  // Create student
  const student = { name: 'Contract Test', email: `contract${Date.now()}@example.com`, course: 'CSE', year: 2, cgpa: 8.5 };
  let id;
  {
    const r = await req('POST', '/api/students', student);
    check('POST /api/students -> 201', r.status === 201);
    check('POST /api/students schema', validate(StudentResponse, r.body, 'StudentResponse'));
    check('POST /api/students has id', r.body && r.body.data && typeof r.body.data.id === 'string');
    check('POST /api/students email lower-cased', r.body && r.body.data && r.body.data.email === student.email.toLowerCase());
    check('POST /api/students no _id or __v', r.body && r.body.data && !('_id' in r.body.data) && !('__v' in r.body.data));
    id = r.body && r.body.data && r.body.data.id;
  }

  // List students
  {
    const r = await req('GET', '/api/students');
    check('GET /api/students -> 200', r.status === 200);
    check('GET /api/students schema', validate(StudentListResponse, r.body, 'StudentListResponse'));
  }

  // Get student
  {
    const r = await req('GET', `/api/students/${id}`);
    check('GET /api/students/:id -> 200', r.status === 200);
    check('GET /api/students/:id schema', validate(StudentResponse, r.body, 'StudentResponse'));
  }

  // Update student
  {
    const r = await req('PUT', `/api/students/${id}`, { name: 'Updated', email: student.email, course: 'ECE', year: 3, cgpa: 9.0 });
    check('PUT /api/students/:id -> 200', r.status === 200);
    check('PUT /api/students/:id schema', validate(StudentResponse, r.body, 'StudentResponse'));
    check('PUT /api/students/:id updatedAt changed', r.body && r.body.data && r.body.data.updatedAt !== r.body.data.createdAt);
  }

  // Delete student
  {
    const r = await req('DELETE', `/api/students/${id}`);
    check('DELETE /api/students/:id -> 204', r.status === 204);
    check('DELETE /api/students/:id empty body', r.raw === '');
  }

  // 404 after delete
  {
    const r = await req('GET', `/api/students/${id}`);
    check('GET deleted student -> 404', r.status === 404);
    check('GET deleted student -> NOT_FOUND code', r.body && r.body.error && r.body.error.code === 'NOT_FOUND');
    check('GET deleted student error schema', validate(ErrorResponse, r.body, 'ErrorResponse'));
  }

  // INVALID_ID
  {
    const r = await req('GET', '/api/students/abc123');
    check('GET /api/students/abc123 -> 400 INVALID_ID', r.status === 400 && r.body && r.body.error && r.body.error.code === 'INVALID_ID');
    check('INVALID_ID error schema', validate(ErrorResponse, r.body, 'ErrorResponse'));
  }

  // INVALID_JSON
  {
    const r = await new Promise((resolve, reject) => {
      const payload = '{bad json';
      const opts = { method: 'POST', hostname: 'localhost', port: process.env.PORT || 5000, path: '/api/students', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };
      const rq = http.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      rq.on('error', reject);
      rq.write(payload);
      rq.end();
    });
    check('POST malformed JSON -> 400 INVALID_JSON', r.status === 400 && r.body.error.code === 'INVALID_JSON');
    check('INVALID_JSON error schema', validate(ErrorResponse, r.body, 'ErrorResponse'));
  }

  // ROUTE_NOT_FOUND
  {
    const r = await req('GET', '/api/unknown');
    check('GET /api/unknown -> 404 ROUTE_NOT_FOUND', r.status === 404 && r.body && r.body.error && r.body.error.code === 'ROUTE_NOT_FOUND');
    check('ROUTE_NOT_FOUND content-type json', r.headers['content-type'].includes('application/json'));
    check('ROUTE_NOT_FOUND error schema', validate(ErrorResponse, r.body, 'ErrorResponse'));
  }

  // VALIDATION_ERROR - missing name
  {
    const r = await req('POST', '/api/students', { email: 'a@b.com', course: 'CSE', year: 2, cgpa: 8.0 });
    check('Missing name -> 400 VALIDATION_ERROR', r.status === 400 && r.body.error.code === 'VALIDATION_ERROR');
    check('Missing name -> details has name field', r.body.error.details && r.body.error.details.some(d => d.field === 'name'));
  }

  // DUPLICATE_EMAIL
  {
    const em = `duptest${Date.now()}@example.com`;
    await req('POST', '/api/students', { name: 'Dup1', email: em, course: 'CSE', year: 1, cgpa: 7.0 });
    const r = await req('POST', '/api/students', { name: 'Dup2', email: em, course: 'ECE', year: 2, cgpa: 8.0 });
    check('Duplicate email -> 409 DUPLICATE_EMAIL', r.status === 409 && r.body.error.code === 'DUPLICATE_EMAIL');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
