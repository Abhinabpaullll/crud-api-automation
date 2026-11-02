'use strict';
/**
 * verify.js — starts the server in-process, runs the full 106-assertion suite.
 *
 * Usage:
 *   node verify.js                 # in-memory mode (default)
 *   node verify.js --mode=memory   # explicit in-memory
 *   node verify.js --mode=mongo    # uses mongodb-memory-server
 *
 * In mongo mode the script spins up an isolated MongoMemoryServer instance,
 * sets MONGODB_URI, requires the app fresh, runs all assertions, then tears down.
 */

const http = require('http');

// ── parse --mode flag ─────────────────────────────────────────────────────────
const modeArg = process.argv.find(a => a.startsWith('--mode='));
const MODE    = modeArg ? modeArg.split('=')[1] : 'memory';
if (MODE !== 'memory' && MODE !== 'mongo') {
  console.error(`Unknown mode "${MODE}". Use --mode=memory or --mode=mongo`);
  process.exit(1);
}

// ── helpers ───────────────────────────────────────────────────────────────────
function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const PORT = process.env.PORT || 5000;
    const opts = {
      method, hostname: 'localhost', port: PORT, path: urlPath,
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
    const PORT = process.env.PORT || 5000;
    const opts = {
      method, hostname: 'localhost', port: PORT, path: urlPath,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rawBody) },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
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

// ── setup & teardown ──────────────────────────────────────────────────────────
async function setup() {
  let mms = null;

  if (MODE === 'mongo') {
    console.log('[setup] mongo mode — starting MongoMemoryServer...');
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = require('mongodb-memory-server'));
    } catch (e) {
      console.error('[setup] mongodb-memory-server not installed. Run: npm install --save-dev mongodb-memory-server');
      process.exit(1);
    }
    mms = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mms.getUri();
    console.log(`[setup] MongoMemoryServer URI: ${process.env.MONGODB_URI}`);
  } else {
    delete process.env.MONGODB_URI;
    console.log('[setup] memory mode — MONGODB_URI unset');
  }

  process.env.ENABLE_TEST_ROUTES = 'true';

  // Fresh require to pick up new MONGODB_URI
  // Clear any cached modules so the db module re-initialises
  for (const key of Object.keys(require.cache)) {
    if (key.includes('crud-api-automation\\backend') || key.includes('crud-api-automation/backend')) {
      delete require.cache[key];
    }
  }

  const { connect } = require('./src/config/db');
  await connect();
  require('./server'); // starts listener
  await new Promise(r => setTimeout(r, 300));

  return mms;
}

async function teardown(mms) {
  if (mms) await mms.stop();
}

// ── test suite ────────────────────────────────────────────────────────────────
async function runSuite() {
  async function reset() { await req('POST', '/api/test/reset'); }

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log(`║  BACKEND VERIFICATION — MODE: ${MODE.toUpperCase().padEnd(38)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // ── TC30 GET /health ────────────────────────────────────────────────────────
  section('TC30 — GET /health');
  {
    const r = await req('GET', '/health');
    printRes(r);
    check('status 200', r.status === 200);
    check('data.status = "ok"', r.body?.data?.status === 'ok');
    check(`data.storage = "${MODE}"`, r.body?.data?.storage === MODE);
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ── TC01 POST /api/students ─────────────────────────────────────────────────
  section('TC01 — POST /api/students (201 create)');
  await reset();
  let studentId, createdAt1;
  {
    const r = await req('POST', '/api/students', {
      name: 'John Doe', email: 'john@example.com', course: 'CSE', year: 2, cgpa: 8.5,
    });
    printRes(r);
    check('status 201', r.status === 201);
    check('success: true', r.body?.success === true);
    check('data.id is 24-hex', /^[a-f0-9]{24}$/.test(r.body?.data?.id));
    check('email lower-cased', r.body?.data?.email === 'john@example.com');
    check('no _id in response', !('_id' in (r.body?.data ?? {})));
    check('no __v in response', !('__v' in (r.body?.data ?? {})));
    check('has createdAt (ISO 8601)', !!r.body?.data?.createdAt);
    check('has updatedAt (ISO 8601)', !!r.body?.data?.updatedAt);
    studentId = r.body?.data?.id;
    createdAt1 = r.body?.data?.createdAt;
  }

  // ── TC19 Client-supplied id/timestamps are ignored ──────────────────────────
  section('TC19 — Client-supplied id/timestamps are ignored');
  {
    const fakeId = 'aabbccddeeff001122334455';
    const r = await req('POST', '/api/students', {
      id: fakeId, createdAt: '2000-01-01T00:00:00.000Z',
      name: 'Override', email: 'override@example.com', course: 'ECE', year: 1, cgpa: 7.0,
    });
    printRes(r);
    check('status 201', r.status === 201);
    check('returned id differs from supplied', r.body?.data?.id !== fakeId);
    check('createdAt is NOT 2000-01-01', r.body?.data?.createdAt !== '2000-01-01T00:00:00.000Z');
  }

  // ── TC34 Email normalisation ─────────────────────────────────────────────────
  section('TC34 — Email normalisation (trim + lower-case)');
  {
    const r = await req('POST', '/api/students', {
      name: 'Mixed Case', email: ' Mixed@Case.COM ', course: 'ME', year: 3, cgpa: 6.5,
    });
    printRes(r);
    check('status 201', r.status === 201);
    check('stored as mixed@case.com', r.body?.data?.email === 'mixed@case.com');
  }

  // ── TC02 GET /api/students with course filter ────────────────────────────────
  section('TC02 — GET /api/students?course=CSE');
  {
    const r = await req('GET', '/api/students?course=CSE');
    printRes(r);
    check('status 200', r.status === 200);
    check('success: true', r.body?.success === true);
    check('data is array', Array.isArray(r.body?.data));
    check('count >= 1', r.body?.count >= 1);
    check('contains created id', r.body?.data?.some(s => s.id === studentId));
    check('has total/page/limit', r.body?.total !== undefined && r.body?.page !== undefined);
  }

  // ── TC15 Content-Type ────────────────────────────────────────────────────────
  section('TC15 — Response Content-Type is application/json');
  {
    const r = await req('GET', '/api/students');
    check('Content-Type includes application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ── TC03 GET /:id ────────────────────────────────────────────────────────────
  section('TC03 — GET /api/students/:id');
  {
    const r = await req('GET', `/api/students/${studentId}`);
    printRes(r);
    check('status 200', r.status === 200);
    check('data.id matches', r.body?.data?.id === studentId);
    check('name matches', r.body?.data?.name === 'John Doe');
    check('no _id', !('_id' in (r.body?.data ?? {})));
    check('no __v', !('__v' in (r.body?.data ?? {})));
  }

  // ── TC04 PUT + TC26 timestamps ───────────────────────────────────────────────
  section('TC04 — PUT /api/students/:id  +  TC26 timestamp behaviour');
  let updatedAt2;
  {
    await new Promise(r => setTimeout(r, 50));
    const r = await req('PUT', `/api/students/${studentId}`, {
      name: 'Jane Doe', email: 'john@example.com', course: 'ECE', year: 3, cgpa: 9.0,
    });
    printRes(r);
    check('status 200', r.status === 200);
    check('name updated', r.body?.data?.name === 'Jane Doe');
    check('id unchanged', r.body?.data?.id === studentId);
    check('no _id after PUT', !('_id' in (r.body?.data ?? {})));
    check('TC26 createdAt unchanged (D-12)', r.body?.data?.createdAt === createdAt1);
    check('TC26 updatedAt >= createdAt', new Date(r.body?.data?.updatedAt) >= new Date(r.body?.data?.createdAt));
    updatedAt2 = r.body?.data?.updatedAt;
  }

  // ── TC27 GET after update ────────────────────────────────────────────────────
  section('TC27 — GET after update shows new values');
  {
    const r = await req('GET', `/api/students/${studentId}`);
    printRes(r);
    check('status 200', r.status === 200);
    check('name is Jane Doe', r.body?.data?.name === 'Jane Doe');
    check('course is ECE', r.body?.data?.course === 'ECE');
    check('updatedAt persisted', r.body?.data?.updatedAt === updatedAt2);
  }

  // ── TC05 DELETE 204 ──────────────────────────────────────────────────────────
  section('TC05 — DELETE /api/students/:id → 204 empty body');
  {
    const r = await req('DELETE', `/api/students/${studentId}`);
    console.log(`  HTTP ${r.status}  raw body: "${r.raw}"`);
    check('status 204', r.status === 204);
    check('body is empty (D-06)', r.raw === '');
  }

  // ── TC06 GET deleted → 404 ───────────────────────────────────────────────────
  section('TC06 — GET deleted → 404 NOT_FOUND');
  {
    const r = await req('GET', `/api/students/${studentId}`);
    printRes(r);
    check('status 404', r.status === 404);
    check('code NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ── TC32 DELETE twice → 404 ──────────────────────────────────────────────────
  section('TC32 — DELETE twice → 404 NOT_FOUND');
  {
    const r = await req('DELETE', `/api/students/${studentId}`);
    printRes(r);
    check('status 404', r.status === 404);
    check('code NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ── TC07 GET non-existing well-formed id ─────────────────────────────────────
  section('TC07 — GET non-existing (well-formed id) → 404 NOT_FOUND');
  {
    const r = await req('GET', '/api/students/000000000000000000000001');
    printRes(r);
    check('status 404', r.status === 404);
    check('code NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ── TC16 Malformed id → 400 INVALID_ID ───────────────────────────────────────
  section('TC16 — Malformed id → 400 INVALID_ID (GET, PUT, DELETE)');
  {
    const rg = await req('GET', '/api/students/abc123');
    printRes(rg);
    check('GET bad id → 400 INVALID_ID', rg.status === 400 && rg.body?.error?.code === 'INVALID_ID');

    const rp = await req('PUT', '/api/students/ZZZ', { name:'x', email:'x@x.com', course:'X', year:1, cgpa:5 });
    check('PUT bad id → 400 INVALID_ID', rp.status === 400 && rp.body?.error?.code === 'INVALID_ID');

    const rd = await req('DELETE', '/api/students/notanid');
    check('DELETE bad id → 400 INVALID_ID', rd.status === 400 && rd.body?.error?.code === 'INVALID_ID');
  }

  // ── D-08 EDGE CASE: bad id + malformed JSON → INVALID_ID (not INVALID_JSON) ──
  section('D-08 — PUT bad-id + malformed JSON → INVALID_ID (id checked first)');
  {
    const r = await rawReq('PUT', '/api/students/notvalid', '{bad json');
    printRes(r);
    check('status 400', r.status === 400);
    check('code INVALID_ID (not INVALID_JSON)', r.body?.error?.code === 'INVALID_ID');
  }

  // ── D-08: good id + malformed JSON → INVALID_JSON ────────────────────────────
  section('D-08 — PUT good-id + malformed JSON → INVALID_JSON (JSON checked before body rules)');
  {
    const r = await rawReq('PUT', '/api/students/000000000000000000000004', '{bad json');
    printRes(r);
    check('status 400', r.status === 400);
    check('code INVALID_JSON', r.body?.error?.code === 'INVALID_JSON');
  }

  // ── TC08 Missing name ────────────────────────────────────────────────────────
  section('TC08 — Missing name → 400 VALIDATION_ERROR');
  {
    const r = await req('POST', '/api/students', { email: 'a@b.com', course: 'CSE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 400', r.status === 400);
    check('code VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names "name"', r.body?.error?.details?.some(d => d.field === 'name'));
  }

  // ── TC35 Whitespace-only name ────────────────────────────────────────────────
  section('TC35 — Whitespace-only name → 400 VALIDATION_ERROR');
  {
    const r = await req('POST', '/api/students', { name: '   ', email: 'ws@b.com', course: 'CSE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 400', r.status === 400);
    check('code VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names "name"', r.body?.error?.details?.some(d => d.field === 'name'));
  }

  // ── TC09 Invalid email ───────────────────────────────────────────────────────
  section('TC09 — Invalid email → 400 VALIDATION_ERROR');
  {
    const r = await req('POST', '/api/students', { name: 'T', email: 'not-an-email', course: 'CSE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 400', r.status === 400);
    check('code VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names "email"', r.body?.error?.details?.some(d => d.field === 'email'));
  }

  // ── TC10/TC21 year boundaries ────────────────────────────────────────────────
  section('TC10/TC21 — year boundaries (0 rej, 1 acc, 4 acc, 5 rej)');
  {
    const base = { name: 'Y', course: 'CSE', cgpa: 5.0 };
    const TS = Date.now();
    const r0 = await req('POST', '/api/students', { ...base, year: 0, email: `y0_${TS}@x.com` });
    check('year 0 → 400', r0.status === 400);
    const r1 = await req('POST', '/api/students', { ...base, year: 1, email: `y1_${TS}@x.com` });
    check('year 1 → 201', r1.status === 201);
    const r4 = await req('POST', '/api/students', { ...base, year: 4, email: `y4_${TS}@x.com` });
    check('year 4 → 201', r4.status === 201);
    const r5 = await req('POST', '/api/students', { ...base, year: 5, email: `y5_${TS}@x.com` });
    check('year 5 → 400', r5.status === 400);
    console.log(`  year0:${r0.status} year1:${r1.status} year4:${r4.status} year5:${r5.status}`);
  }

  // ── TC11/TC21 cgpa boundaries ────────────────────────────────────────────────
  section('TC11/TC21 — cgpa boundaries (-0.1 rej, 0 acc, 10 acc, 10.1 rej)');
  {
    const base = { name: 'C', course: 'EE', year: 2 };
    const TS2 = Date.now() + 1;
    const rn  = await req('POST', '/api/students', { ...base, cgpa: -0.1, email: `cn_${TS2}@x.com` });
    check('cgpa -0.1 → 400', rn.status === 400);
    const r0  = await req('POST', '/api/students', { ...base, cgpa: 0,    email: `c0_${TS2}@x.com` });
    check('cgpa 0 → 201',    r0.status === 201);
    const r10 = await req('POST', '/api/students', { ...base, cgpa: 10,   email: `c10_${TS2}@x.com` });
    check('cgpa 10 → 201',   r10.status === 201);
    const r11 = await req('POST', '/api/students', { ...base, cgpa: 10.1, email: `c101_${TS2}@x.com` });
    check('cgpa 10.1 → 400', r11.status === 400);
    console.log(`  cgpa-0.1:${rn.status} cgpa0:${r0.status} cgpa10:${r10.status} cgpa10.1:${r11.status}`);
  }

  // ── TC22 Wrong types ─────────────────────────────────────────────────────────
  section('TC22 — Wrong types (year:"3", cgpa:"8.1", name:123)');
  {
    const base = { course: 'IT', year: 2, cgpa: 7.0 };
    const TS3 = Date.now() + 2;
    const ry = await req('POST', '/api/students', { name: 'T', ...base, year: '3',  email: `ty_${TS3}@x.com` });
    check('year:"3" → 400 VALIDATION_ERROR', ry.status === 400 && ry.body?.error?.code === 'VALIDATION_ERROR');
    const rc = await req('POST', '/api/students', { name: 'T', ...base, cgpa: '8.1', email: `tc_${TS3}@x.com` });
    check('cgpa:"8.1" → 400 VALIDATION_ERROR', rc.status === 400 && rc.body?.error?.code === 'VALIDATION_ERROR');
    const rn = await req('POST', '/api/students', { name: 123, ...base, email: `tn_${TS3}@x.com` });
    check('name:123 → 400 VALIDATION_ERROR', rn.status === 400 && rn.body?.error?.code === 'VALIDATION_ERROR');
    console.log(`  year-str:${ry.status} cgpa-str:${rc.status} name-int:${rn.status}`);
  }

  // ── TC12 Duplicate email ─────────────────────────────────────────────────────
  section('TC12 — Duplicate email → 409 DUPLICATE_EMAIL');
  {
    await reset();
    const race = await Promise.all([
      req('POST', '/api/students', { name: 'First', email: 'dup@example.com', course: 'CSE', year: 1, cgpa: 7.0 }),
      req('POST', '/api/students', { name: 'Second', email: 'dup@example.com', course: 'ECE', year: 2, cgpa: 8.0 }),
    ]);
    race.forEach(printRes);
    const duplicate = race.find(r => r.status === 409);
    check('concurrent duplicate: one 201 and one 409', race.filter(r => r.status === 201).length === 1 && !!duplicate);
    check('duplicate response code DUPLICATE_EMAIL', duplicate?.body?.error?.code === 'DUPLICATE_EMAIL');
  }

  // ── TC23 Duplicate email different case ──────────────────────────────────────
  section('TC23 — Duplicate email different case → 409');
  {
    await reset();
    await req('POST', '/api/students', { name: 'First', email: 'john@example.com', course: 'CSE', year: 1, cgpa: 7.0 });
    const r = await req('POST', '/api/students', { name: 'Second', email: 'JOHN@EXAMPLE.COM', course: 'ECE', year: 2, cgpa: 8.0 });
    printRes(r);
    check('status 409', r.status === 409);
    check('code DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
  }

  // ── TC24 PUT with another student's email ────────────────────────────────────
  section('TC24 — PUT with another student\'s email → 409 DUPLICATE_EMAIL');
  {
    await reset();
    await req('POST', '/api/students', { name: 'A', email: 'a@example.com', course: 'CSE', year: 1, cgpa: 7.0 });
    const s2 = await req('POST', '/api/students', { name: 'B', email: 'b@example.com', course: 'ECE', year: 2, cgpa: 8.0 });
    const sid2 = s2.body?.data?.id;
    const r = await req('PUT', `/api/students/${sid2}`, { name: 'B2', email: 'a@example.com', course: 'ME', year: 3, cgpa: 9.0 });
    printRes(r);
    check('status 409', r.status === 409);
    check('code DUPLICATE_EMAIL', r.body?.error?.code === 'DUPLICATE_EMAIL');
    // PUT keeping own email must succeed
    const rOk = await req('PUT', `/api/students/${sid2}`, { name: 'B2', email: 'b@example.com', course: 'ME', year: 3, cgpa: 9.0 });
    check('PUT own email → 200', rOk.status === 200);
    check('no _id after PUT own email', !('_id' in (rOk.body?.data ?? {})));
  }

  // ── TC13 PUT non-existing ────────────────────────────────────────────────────
  section('TC13 — PUT non-existing → 404 NOT_FOUND');
  {
    const r = await req('PUT', '/api/students/000000000000000000000002', {
      name: 'Ghost', email: 'ghost@x.com', course: 'CSE', year: 1, cgpa: 5.0,
    });
    printRes(r);
    check('status 404', r.status === 404);
    check('code NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ── TC14 DELETE non-existing ─────────────────────────────────────────────────
  section('TC14 — DELETE non-existing → 404 NOT_FOUND');
  {
    const r = await req('DELETE', '/api/students/000000000000000000000003');
    printRes(r);
    check('status 404', r.status === 404);
    check('code NOT_FOUND', r.body?.error?.code === 'NOT_FOUND');
  }

  // ── TC25 PUT missing required field ──────────────────────────────────────────
  section('TC25 — PUT missing required field → 400 VALIDATION_ERROR');
  {
    await reset();
    const s = await req('POST', '/api/students', { name: 'A', email: 'miss@x.com', course: 'CSE', year: 1, cgpa: 7.0 });
    const sid = s.body?.data?.id;
    const r = await req('PUT', `/api/students/${sid}`, { name: 'A2', email: 'miss@x.com', course: 'CSE', year: 1 /* no cgpa */ });
    printRes(r);
    check('status 400', r.status === 400);
    check('code VALIDATION_ERROR', r.body?.error?.code === 'VALIDATION_ERROR');
    check('details names cgpa', r.body?.error?.details?.some(d => d.field === 'cgpa'));
  }

  // ── TC17 Malformed JSON body ──────────────────────────────────────────────────
  section('TC17 — Malformed JSON body → 400 INVALID_JSON');
  {
    const r = await rawReq('POST', '/api/students', '{bad json');
    printRes(r);
    check('status 400', r.status === 400);
    check('code INVALID_JSON', r.body?.error?.code === 'INVALID_JSON');
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ── TC18 Unknown route ───────────────────────────────────────────────────────
  section('TC18 — Unknown route → 404 ROUTE_NOT_FOUND');
  {
    const r = await req('GET', '/api/unknown');
    printRes(r);
    check('status 404', r.status === 404);
    check('code ROUTE_NOT_FOUND', r.body?.error?.code === 'ROUTE_NOT_FOUND');
    check('Content-Type application/json', r.headers['content-type']?.includes('application/json'));
  }

  // ── TC28 Filter by course (case-insensitive) ──────────────────────────────────
  section('TC28 — Filter by course (case-insensitive)');
  {
    await reset();
    const TS4 = Date.now() + 3;
    await req('POST', '/api/students', { name: 'A', email: `fa_${TS4}@x.com`, course: 'FILTER_X', year: 1, cgpa: 7.0 });
    await req('POST', '/api/students', { name: 'B', email: `fb_${TS4}@x.com`, course: 'OTHER',    year: 2, cgpa: 8.0 });
    const r = await req('GET', '/api/students?course=filter_x');
    printRes(r);
    check('status 200', r.status === 200);
    check('count = 1', r.body?.count === 1);
    check('all match FILTER_X', r.body?.data?.every(s => s.course.toUpperCase() === 'FILTER_X'));
  }

  // ── TC29 Invalid pagination ───────────────────────────────────────────────────
  section('TC29 — Invalid pagination → 400 VALIDATION_ERROR');
  {
    const r0   = await req('GET', '/api/students?limit=0');
    const r101 = await req('GET', '/api/students?limit=101');
    const rp0  = await req('GET', '/api/students?page=0');
    check('limit=0 → 400', r0.status === 400 && r0.body?.error?.code === 'VALIDATION_ERROR');
    check('limit=101 → 400', r101.status === 400 && r101.body?.error?.code === 'VALIDATION_ERROR');
    check('page=0 → 400', rp0.status === 400 && rp0.body?.error?.code === 'VALIDATION_ERROR');
    console.log(`  limit=0:${r0.status} limit=101:${r101.status} page=0:${rp0.status}`);
  }

  // ── D-17 POST /api/test/reset ─────────────────────────────────────────────────
  section('D-17 — POST /api/test/reset (ENABLE_TEST_ROUTES=true)');
  {
    const r = await req('POST', '/api/test/reset');
    console.log(`  HTTP ${r.status}  raw: "${r.raw}"`);
    check('status 204', r.status === 204);
    check('body empty', r.raw === '');
    const list = await req('GET', '/api/students');
    check('store cleared (total=0)', list.body?.total === 0);
  }

  // ── TC20 Valid boundaries ────────────────────────────────────────────────────
  section('TC20 — Valid boundaries (year 1/4, cgpa 0/10)');
  {
    const TS5 = Date.now() + 4;
    const [r1, r2] = await Promise.all([
      req('POST', '/api/students', { name: 'B1', email: `bnd1_${TS5}@x.com`, course: 'CSE', year: 1, cgpa: 0  }),
      req('POST', '/api/students', { name: 'B2', email: `bnd2_${TS5}@x.com`, course: 'CSE', year: 4, cgpa: 10 }),
    ]);
    check('year:1 cgpa:0 → 201',  r1.status === 201);
    check('year:4 cgpa:10 → 201', r2.status === 201);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(`  MODE: ${MODE.toUpperCase()}   RESULTS: ${pass} passed   ${fail} failed`);
  console.log('═'.repeat(70) + '\n');

  return fail;
}

// ── entry point ───────────────────────────────────────────────────────────────
(async () => {
  let mms;
  try {
    mms = await setup();
    const failures = await runSuite();
    await teardown(mms);
    process.exit(failures > 0 ? 1 : 0);
  } catch (e) {
    console.error('[fatal]', e);
    if (mms) await teardown(mms).catch(() => {});
    process.exit(1);
  }
})();
