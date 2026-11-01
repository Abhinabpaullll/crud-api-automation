'use strict';
/**
 * verify.js — starts the server, runs every curl-equivalent check in-process,
 * prints results as if they were curl outputs, then kills the server.
 * 
 * Usage: node verify.js
 */

process.env.ENABLE_TEST_ROUTES = 'true'; // so we can reset between groups

const http = require('http');
const { connect, getMode } = require('./src/config/db');
const { PORT } = require('./src/config/env');

// ── helpers ──────────────────────────────────────────────────────────────────

function req(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const opts = {
      method,
      hostname: 'localhost',
      port: PORT,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...extraHeaders,
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

// Send raw (possibly malformed) body
function rawReq(method, path, rawBody, contentType) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      hostname: 'localhost',
      port: PORT,
      path,
      headers: {
        'Content-Type': contentType || 'application/json',
        'Content-Length': Buffer.byteLength(rawBody),
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
    r.write(rawBody);
    r.end();
  });
}

let pass = 0;
let fail = 0;

function check(label, cond) {
  if (cond) { console.log(`  ✓  ${label}`); pass++; }
  else       { console.error(`  ✗  ${label}`); fail++; }
}

function section(title) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(70));
}

function printRes(r) {
  console.log(`  HTTP ${r.status}  body: ${JSON.stringify(r.body)}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  // 1) connect storage
  await connect();
  
  // 2) create express app (reuse same app module)
  const app = require('./server');  // server starts its own listener; we reuse PORT

  // Give the server a moment to bind
  await new Promise(r => setTimeout(r, 500));

  // Reset between test groups helper
  async function reset() { await req('POST', '/api/test/reset'); }

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         BACKEND VERIFICATION — in-memory mode                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // ──────────────────────────────────────────────────────────────────────────
  section('TC30 — GET /health');
  {
    const r = await req('GET', '/health');
    printRes(r);
    check('status 200', r.status === 200);
    check('success: true', r.body?.success === true);
    check('data.status = "ok"', r.body?.data?.status === 'ok');
    check('data.storage = "memory"', r.body?.data?.storage === 'memory');
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC01 — POST /api/students (201 create)');
  await reset();
  let studentId, createdAt1;
  {
    const r = await req('POST', '/api/students', {
      name: 'John Doe', email: 'john@example.com', course: 'CSE', year: 2, cgpa: 8.5
    });
    printRes(r);
    check('status 201', r.status === 201);
    check('success: true', r.body?.success === true);
    check('data.id is 24-hex', /^[a-f0-9]{24}$/.test(r.body?.data?.id));
    check('email lower-cased', r.body?.data?.email === 'john@example.com');
    check('no _id in response', !('_id' in (r.body?.data ?? {})));
    check('no __v in response', !('__v' in (r.body?.data ?? {})));
    check('has createdAt', !!r.body?.data?.createdAt);
    check('has updatedAt', !!r.body?.data?.updatedAt);
    studentId = r.body?.data?.id;
    createdAt1 = r.body?.data?.createdAt;
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC19 — Client-supplied id/timestamps are ignored');
  {
    const fakeId = 'aabbccddeeff001122334455';
    const r = await req('POST', '/api/students', {
      id: fakeId, createdAt: '2000-01-01T00:00:00.000Z',
      name: 'Override Test', email: 'override@example.com', course: 'ECE', year: 1, cgpa: 7.0
    });
    printRes(r);
    check('status 201', r.status === 201);
    check('returned id differs from supplied id', r.body?.data?.id !== fakeId);
    check('createdAt is NOT 2000-01-01', r.body?.data?.createdAt !== '2000-01-01T00:00:00.000Z');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC34 — Email normalisation (trim + lower-case)');
  {
    const r = await req('POST', '/api/students', {
      name: 'Mixed Case', email: ' Mixed@Case.COM ', course: 'ME', year: 3, cgpa: 6.5
    });
    printRes(r);
    check('status 201', r.status === 201);
    check('email stored as mixed@case.com', r.body?.data?.email === 'mixed@case.com');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC02 — GET /api/students with course filter');
  {
    const r = await req('GET', '/api/students?course=CSE');
    printRes(r);
    check('status 200', r.status === 200);
    check('success: true', r.body?.success === true);
    check('data is array', Array.isArray(r.body?.data));
    check('count >= 1', r.body?.count >= 1);
    check('contains created id', r.body?.data?.some(s => s.id === studentId));
    check('has total/page/limit', r.body?.total !== undefined && r.body?.page !== undefined && r.body?.limit !== undefined);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC15 — Response Content-Type is application/json');
  {
    const r = await req('GET', '/api/students');
    check('Content-Type includes application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC03 — GET /api/students/:id');
  {
    const r = await req('GET', `/api/students/${studentId}`);
    printRes(r);
    check('status 200', r.status === 200);
    check('data.id matches', r.body?.data?.id === studentId);
    check('name matches', r.body?.data?.name === 'John Doe');
    check('course matches', r.body?.data?.course === 'CSE');
    check('year matches', r.body?.data?.year === 2);
    check('cgpa matches', r.body?.data?.cgpa === 8.5);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC04 — PUT /api/students/:id  +  TC26 timestamp behaviour');
  let updatedAt2;
  {
    // Small delay to ensure updatedAt will differ from createdAt
    await new Promise(r => setTimeout(r, 50));
    const r = await req('PUT', `/api/students/${studentId}`, {
      name: 'Jane Doe', email: 'john@example.com', course: 'ECE', year: 3, cgpa: 9.0
    });
    printRes(r);
    check('status 200', r.status === 200);
    check('name updated', r.body?.data?.name === 'Jane Doe');
    check('id unchanged', r.body?.data?.id === studentId);
    check('course updated', r.body?.data?.course === 'ECE');
    // TC26 — createdAt unchanged, updatedAt later
    check('TC26 createdAt unchanged', r.body?.data?.createdAt === createdAt1);
    check('TC26 updatedAt >= createdAt', new Date(r.body?.data?.updatedAt) >= new Date(r.body?.data?.createdAt));
    updatedAt2 = r.body?.data?.updatedAt;
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC27 — GET after update shows new values');
  {
    const r = await req('GET', `/api/students/${studentId}`);
    printRes(r);
    check('status 200', r.status === 200);
    check('name is Jane Doe', r.body?.data?.name === 'Jane Doe');
    check('course is ECE', r.body?.data?.course === 'ECE');
    check('updatedAt persisted', r.body?.data?.updatedAt === updatedAt2);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC05 — DELETE /api/students/:id -> 204 empty body');
  {
    const r = await req('DELETE', `/api/students/${studentId}`);
    console.log(`  HTTP ${r.status}  raw body: "${r.raw}"`);
    check('status 204', r.status === 204);
    check('body is empty', r.raw === '');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC06 — GET deleted student -> 404 NOT_FOUND');
  {
    const r = await req('GET', `/api/students/${studentId}`);
    printRes(r);
    check('status 404', r.status === 404);
    check('error.code = NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC32 — DELETE twice -> 404 NOT_FOUND');
  {
    const r = await req('DELETE', `/api/students/${studentId}`);
    printRes(r);
    check('status 404', r.status === 404);
    check('error.code = NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC07 — GET non-existing well-formed id -> 404 NOT_FOUND');
  {
    const r = await req('GET', '/api/students/000000000000000000000001');
    printRes(r);
    check('status 404', r.status === 404);
    check('error.code = NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC16 — Malformed id -> 400 INVALID_ID');
  {
    const r = await req('GET', '/api/students/abc123');
    printRes(r);
    check('status 400', r.status === 400);
    check('error.code = INVALID_ID', r.body?.error?.code === 'INVALID_ID');
    // Also test PUT and DELETE with bad id
    const r2 = await req('PUT', '/api/students/ZZZ', { name:'x', email:'x@x.com', course:'X', year:1, cgpa:5 });
    check('PUT bad id -> 400 INVALID_ID', r2.status === 400 && r2.body?.error?.code === 'INVALID_ID');
    const r3 = await req('DELETE', '/api/students/notanid');
    check('DELETE bad id -> 400 INVALID_ID', r3.status === 400 && r3.body?.error?.code === 'INVALID_ID');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC08 — Missing name -> 400 VALIDATION_ERROR');
  {
    const r = await req('POST', '/api/students', { email: 'a@b.com', course: 'CSE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 400', r.status === 400);
    check('error.code = VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names "name" field', r.body?.error?.details?.some(d => d.field === 'name'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC35 — Whitespace-only name -> 400 VALIDATION_ERROR');
  {
    const r = await req('POST', '/api/students', { name: '   ', email: 'ws@b.com', course: 'CSE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 400', r.status === 400);
    check('error.code = VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names "name"', r.body?.error?.details?.some(d => d.field === 'name'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC09 — Invalid email -> 400 VALIDATION_ERROR');
  {
    const r = await req('POST', '/api/students', { name: 'Test', email: 'not-an-email', course: 'CSE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 400', r.status === 400);
    check('error.code = VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names "email"', r.body?.error?.details?.some(d => d.field === 'email'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC10/TC21 — year boundaries (0 rejected, 1 accepted, 4 accepted, 5 rejected)');
  {
    const base = { name: 'Y', email: `ybnd${Date.now()}@x.com`, course: 'CSE', cgpa: 5.0 };
    const r0 = await req('POST', '/api/students', { ...base, year: 0 });
    check('year 0 -> 400', r0.status === 400 && r0.body?.error?.code === 'VALIDATION_ERROR');
    const r1 = await req('POST', '/api/students', { ...base, year: 1, email: `ybnd1${Date.now()}@x.com` });
    check('year 1 -> 201', r1.status === 201);
    const r4 = await req('POST', '/api/students', { ...base, year: 4, email: `ybnd4${Date.now()}@x.com` });
    check('year 4 -> 201', r4.status === 201);
    const r5 = await req('POST', '/api/students', { ...base, year: 5, email: `ybnd5${Date.now()}@x.com` });
    check('year 5 -> 400', r5.status === 400 && r5.body?.error?.code === 'VALIDATION_ERROR');
    console.log(`  year 0: HTTP ${r0.status} ${r0.body?.error?.code}`);
    console.log(`  year 1: HTTP ${r1.status}`);
    console.log(`  year 4: HTTP ${r4.status}`);
    console.log(`  year 5: HTTP ${r5.status} ${r5.body?.error?.code}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC11/TC21 — cgpa boundaries (-0.1 rej, 0 acc, 10 acc, 10.1 rej)');
  {
    const base = { name: 'C', email: `cgpabnd${Date.now()}@x.com`, course: 'EE', year: 2 };
    const rn = await req('POST', '/api/students', { ...base, cgpa: -0.1, email: `cgpan${Date.now()}@x.com` });
    check('cgpa -0.1 -> 400', rn.status === 400);
    const r0 = await req('POST', '/api/students', { ...base, cgpa: 0, email: `cgpa0${Date.now()}@x.com` });
    check('cgpa 0 -> 201', r0.status === 201);
    const r10 = await req('POST', '/api/students', { ...base, cgpa: 10, email: `cgpa10${Date.now()}@x.com` });
    check('cgpa 10 -> 201', r10.status === 201);
    const r101 = await req('POST', '/api/students', { ...base, cgpa: 10.1, email: `cgpa101${Date.now()}@x.com` });
    check('cgpa 10.1 -> 400', r101.status === 400);
    console.log(`  cgpa -0.1: HTTP ${rn.status}  cgpa 0: HTTP ${r0.status}  cgpa 10: HTTP ${r10.status}  cgpa 10.1: HTTP ${r101.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC22 — Wrong types (year:"3", cgpa:"8.1", name:123)');
  {
    const base = { email: `types${Date.now()}@x.com`, course: 'IT', year: 2, cgpa: 7.0 };
    const ry = await req('POST', '/api/students', { name: 'T', ...base, year: '3' });
    check('year:"3" -> 400 VALIDATION_ERROR', ry.status === 400 && ry.body?.error?.code === 'VALIDATION_ERROR');
    const rc = await req('POST', '/api/students', { name: 'T', ...base, cgpa: '8.1' });
    check('cgpa:"8.1" -> 400 VALIDATION_ERROR', rc.status === 400 && rc.body?.error?.code === 'VALIDATION_ERROR');
    const rn = await req('POST', '/api/students', { name: 123, ...base });
    check('name:123 -> 400 VALIDATION_ERROR', rn.status === 400 && rn.body?.error?.code === 'VALIDATION_ERROR');
    console.log(`  year string: HTTP ${ry.status}, cgpa string: HTTP ${rc.status}, name int: HTTP ${rn.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC12 — Duplicate email -> 409 DUPLICATE_EMAIL');
  {
    await reset();
    await req('POST', '/api/students', { name: 'First', email: 'dup@example.com', course: 'CSE', year: 1, cgpa: 7.0 });
    const r = await req('POST', '/api/students', { name: 'Second', email: 'dup@example.com', course: 'ECE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 409', r.status === 409);
    check('error.code = DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC23 — Duplicate email different case -> 409');
  {
    await reset();
    await req('POST', '/api/students', { name: 'First', email: 'john@example.com', course: 'CSE', year: 1, cgpa: 7.0 });
    const r = await req('POST', '/api/students', { name: 'Second', email: 'JOHN@EXAMPLE.COM', course: 'ECE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 409', r.status === 409);
    check('error.code = DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC24 — PUT with another student\'s email -> 409');
  {
    await reset();
    const s1 = await req('POST', '/api/students', { name: 'A', email: 'a@example.com', course: 'CSE', year: 1, cgpa: 7.0 });
    const s2 = await req('POST', '/api/students', { name: 'B', email: 'b@example.com', course: 'ECE', year: 2, cgpa: 8.0 });
    const sid2 = s2.body?.data?.id;
    const r = await req('PUT', `/api/students/${sid2}`, { name: 'B2', email: 'a@example.com', course: 'ME', year: 3, cgpa: 9.0 });
    printRes(r);
    check('status 409', r.status === 409);
    check('error.code = DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
    // Also: PUT keeping own email should succeed
    const rOk = await req('PUT', `/api/students/${sid2}`, { name: 'B2', email: 'b@example.com', course: 'ME', year: 3, cgpa: 9.0 });
    check('PUT with own email -> 200', rOk.status === 200);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC13 — PUT non-existing student -> 404 NOT_FOUND');
  {
    const r = await req('PUT', '/api/students/000000000000000000000002', {
      name: 'Ghost', email: 'ghost@x.com', course: 'CSE', year: 1, cgpa: 5.0
    });
    printRes(r);
    check('status 404', r.status === 404);
    check('error.code = NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC14 — DELETE non-existing -> 404 NOT_FOUND');
  {
    const r = await req('DELETE', '/api/students/000000000000000000000003');
    printRes(r);
    check('status 404', r.status === 404);
    check('error.code = NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC25 — PUT missing required field -> 400 VALIDATION_ERROR');
  {
    await reset();
    const s = await req('POST', '/api/students', { name: 'A', email: 'miss@x.com', course: 'CSE', year: 1, cgpa: 7.0 });
    const sid = s.body?.data?.id;
    const r = await req('PUT', `/api/students/${sid}`, { name: 'A2', email: 'miss@x.com', course: 'CSE', year: 1 /* missing cgpa */ });
    printRes(r);
    check('status 400', r.status === 400);
    check('error.code = VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names cgpa', r.body?.error?.details?.some(d => d.field === 'cgpa'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC17 — Malformed JSON body -> 400 INVALID_JSON');
  {
    const r = await rawReq('POST', '/api/students', '{bad json');
    printRes(r);
    check('status 400', r.status === 400);
    check('error.code = INVALID_JSON', r.body?.error?.code === 'INVALID_JSON');
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC18 — Unknown route -> 404 ROUTE_NOT_FOUND');
  {
    const r = await req('GET', '/api/unknown');
    printRes(r);
    check('status 404', r.status === 404);
    check('error.code = ROUTE_NOT_FOUND', r.body?.error?.code === 'ROUTE_NOT_FOUND');
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC28 — Filter by course (case-insensitive)');
  {
    await reset();
    await req('POST', '/api/students', { name: 'A', email: `fa${Date.now()}@x.com`, course: 'FILTER_COURSE_X', year: 1, cgpa: 7.0 });
    await req('POST', '/api/students', { name: 'B', email: `fb${Date.now()}@x.com`, course: 'OTHER', year: 2, cgpa: 8.0 });
    const r = await req('GET', '/api/students?course=filter_course_x');
    printRes(r);
    check('status 200', r.status === 200);
    check('count = 1 (only matching)', r.body?.count === 1);
    check('all results have matching course', r.body?.data?.every(s => s.course.toUpperCase() === 'FILTER_COURSE_X'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC29 — Invalid pagination -> 400 VALIDATION_ERROR');
  {
    const r0 = await req('GET', '/api/students?limit=0');
    check('limit=0 -> 400', r0.status === 400 && r0.body?.error?.code === 'VALIDATION_ERROR');
    const r101 = await req('GET', '/api/students?limit=101');
    check('limit=101 -> 400', r101.status === 400 && r101.body?.error?.code === 'VALIDATION_ERROR');
    const rp0 = await req('GET', '/api/students?page=0');
    check('page=0 -> 400', rp0.status === 400 && rp0.body?.error?.code === 'VALIDATION_ERROR');
    console.log(`  limit=0: HTTP ${r0.status}  limit=101: HTTP ${r101.status}  page=0: HTTP ${rp0.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('D-08 Check order — id format checked before body validation');
  {
    // Bad id + bad body: should get INVALID_ID (not VALIDATION_ERROR)
    const r = await req('PUT', '/api/students/BADID', { name: 123, email: 'bad', course: '', year: 99, cgpa: -5 });
    printRes(r);
    check('bad id + bad body -> INVALID_ID (id checked first)', r.body?.error?.code === 'INVALID_ID');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC17 D-08 — JSON syntax before body validation');
  {
    // Good id format, malformed JSON -> INVALID_JSON (not VALIDATION_ERROR)
    const r = await rawReq('PUT', `/api/students/000000000000000000000004`, '{bad');
    printRes(r);
    check('malformed JSON -> INVALID_JSON (checked before body rules)', r.body?.error?.code === 'INVALID_JSON');
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('D-17 — POST /api/test/reset enabled (ENABLE_TEST_ROUTES=true)');
  {
    const r = await req('POST', '/api/test/reset');
    console.log(`  HTTP ${r.status}  raw: "${r.raw}"`);
    check('status 204', r.status === 204);
    check('body empty', r.raw === '');
    const list = await req('GET', '/api/students');
    check('store cleared (total=0)', list.body?.total === 0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  section('TC20 — Valid boundaries (year 1,4 and cgpa 0,10)');
  {
    const ts = Date.now();
    const results = await Promise.all([
      req('POST', '/api/students', { name: 'Bnd1', email: `bnd1y1${ts}@x.com`, course: 'CSE', year: 1, cgpa: 0 }),
      req('POST', '/api/students', { name: 'Bnd2', email: `bnd2y4${ts}@x.com`, course: 'CSE', year: 4, cgpa: 10 }),
    ]);
    check('year:1 cgpa:0 -> 201', results[0].status === 201);
    check('year:4 cgpa:10 -> 201', results[1].status === 201);
  }

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(`  RESULTS:  ${pass} passed   ${fail} failed`);
  console.log('═'.repeat(70) + '\n');

  process.exit(fail > 0 ? 1 : 0);
})();
