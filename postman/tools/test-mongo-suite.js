const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { MongoMemoryServer } = require(path.resolve(__dirname, '../../backend/node_modules/mongodb-memory-server'));
const root = path.resolve(__dirname, '../..');
const envPath = path.join(root, 'postman/Student-API-Local.postman_environment.json');

function health(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/health`, res => {
      let data = ''; res.setEncoding('utf8'); res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null)); req.setTimeout(1000, () => { req.destroy(); resolve(null); });
  });
}

(async () => {
  const mongo = await MongoMemoryServer.create({ instance: { port: 27019 } });
  const port = '5056';
  const backend = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
    cwd: root,
    env: { ...process.env, PORT: port, MONGODB_URI: mongo.getUri('student_api'), ENABLE_TEST_ROUTES: 'true' },
    stdio: 'inherit'
  });
  const original = fs.readFileSync(envPath, 'utf8');
  try {
    console.log(`MONGO_MODE_URI=${mongo.getUri('student_api')}`);
    let ready = null;
    for (let i = 0; i < 60 && !ready; i++) {
      if (backend.exitCode !== null) throw new Error('Mongo backend exited before health check');
      const h = await health(Number(port));
      if (h && h.status === 200 && h.body.data.storage === 'mongo') ready = h;
      else await new Promise(r => setTimeout(r, 500));
    }
    if (!ready) throw new Error('Mongo backend did not report storage=mongo within 30 seconds');
    console.log(`MONGO_HEALTH=${JSON.stringify(ready.body)}`);
    const environment = JSON.parse(original);
    environment.values.find(v => v.key === 'base_url').value = `http://127.0.0.1:${port}`;
    fs.writeFileSync(envPath, JSON.stringify(environment, null, 2) + '\n');
    const run = spawnSync('npm.cmd', ['run', 'test:all'], { cwd: root, stdio: 'inherit', shell: true });
    process.exitCode = run.status === null ? 1 : run.status;
    console.log(`MONGO_TEST_ALL_EXIT_CODE=${process.exitCode}`);
  } finally {
    fs.writeFileSync(envPath, original);
    backend.kill();
    await mongo.stop();
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
