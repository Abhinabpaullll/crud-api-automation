const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const env = { ...process.env, PORT: '5001', MONGODB_URI: '', ENABLE_TEST_ROUTES: 'false' };
const server = spawn(process.execPath, [path.join(root, 'backend/server.js')], { cwd: root, env, stdio: 'inherit' });
const ready = () => new Promise(resolve => {
  const req = http.get('http://127.0.0.1:5001/health', res => { res.resume(); resolve(res.statusCode === 200); });
  req.on('error', () => resolve(false)); req.setTimeout(700, () => { req.destroy(); resolve(false); });
});
(async () => {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { if (server.exitCode !== null) throw new Error('Backend exited before readiness'); up = await ready(); if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('Disabled-route backend did not become ready');
  const run = spawnSync(process.execPath, [path.join(root, 'node_modules/newman/bin/newman.js'), 'run', path.join(root, 'postman/Student-CRUD-API.postman_collection.json'), '-e', path.join(root, 'postman/Student-API-Local.postman_environment.json'), '--folder', '04 Errors and Routing', '--env-var', 'base_url=http://127.0.0.1:5001', '--env-var', 'reset_routes_mode=disabled', '--timeout-request', '10000', '--timeout', '120000', '-r', 'cli'], { cwd: root, stdio: 'inherit', timeout: 130000 });
  if (run.error) throw run.error;
  process.exitCode = run.status === null ? 1 : run.status;
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(() => new Promise(resolve => {
  if (server.exitCode !== null) return resolve();
  const timer = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 3000);
  server.once('exit', () => { clearTimeout(timer); resolve(); });
  server.kill();
}));
