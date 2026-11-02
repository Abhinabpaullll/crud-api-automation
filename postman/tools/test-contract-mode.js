const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { MongoMemoryServer } = require(path.resolve(__dirname, '../../backend/node_modules/mongodb-memory-server'));
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2] || 'memory';

function health(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/health`, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', part => body += part);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(body) }); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null)); req.setTimeout(1000, () => { req.destroy(); resolve(null); });
  });
}

(async () => {
  if (!['memory', 'mongo'].includes(mode)) throw new Error('Usage: node test-contract-mode.js memory|mongo');
  const port = mode === 'mongo' ? '5211' : '5210';
  const mongo = mode === 'mongo' ? await MongoMemoryServer.create({ instance: { port: 27020 } }) : null;
  const backend = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
    cwd: root,
    env: { ...process.env, PORT: port, MONGODB_URI: mongo ? mongo.getUri('contract_test') : '', ENABLE_TEST_ROUTES: 'true' },
    stdio: 'inherit'
  });
  try {
    console.log(`CONTRACT_TEST_MODE=${mode.toUpperCase()} PORT=${port}`);
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      if (backend.exitCode !== null) throw new Error('Backend exited before health check');
      const result = await health(Number(port));
      ready = result?.status === 200 && result.body?.data?.storage === mode;
      if (!ready) await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('Backend did not become ready in requested storage mode');
    const child = spawnSync(process.execPath, [path.join(root, 'backend/test-contract.js')], {
      cwd: root,
      env: { ...process.env, PORT: port, CONTRACT_STORAGE_MODE: mode },
      stdio: 'inherit'
    });
    process.exitCode = child.status === null ? 1 : child.status;
    console.log(`CONTRACT_TEST_${mode.toUpperCase()}_EXIT_CODE=${process.exitCode}`);
  } finally {
    backend.kill();
    if (mongo) await mongo.stop();
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
