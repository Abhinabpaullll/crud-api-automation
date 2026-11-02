'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const envPath = path.join(root, 'postman/Student-API-Local.postman_environment.json');
const envJson = JSON.parse(fs.readFileSync(envPath, 'utf8'));
const baseUrl = new URL(envJson.values.find(value => value.key === 'base_url').value);
const local = ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname);
const port = Number(baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80));
const startupTimeoutMs = 10000;
const scripts = ['test:api', 'test:data', 'test:reset-disabled'];
let ownedServer = null;

function probeHealth(url) {
  return new Promise(resolve => {
    const transport = url.protocol === 'https:' ? https : http;
    let connected = false;
    const request = transport.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const health = response.statusCode === 200 && parsed.success === true && parsed.data?.status === 'ok'
            ? parsed.data : null;
          resolve({ health, occupied: true });
        } catch {
          resolve({ health: null, occupied: true });
        }
      });
    });
    request.on('socket', socket => socket.once('connect', () => { connected = true; }));
    request.setTimeout(1500, () => request.destroy());
    request.on('error', error => resolve({
      health: null,
      occupied: connected || !['ECONNREFUSED', 'EHOSTUNREACH'].includes(error.code),
    }));
  });
}

async function getHealth() {
  const urls = [new URL('/health', baseUrl)];
  if (baseUrl.hostname === 'localhost') {
    urls.push(new URL(`${baseUrl.protocol}//127.0.0.1:${port}/health`));
    urls.push(new URL(`${baseUrl.protocol}//[::1]:${port}/health`));
  }
  const outcomes = await Promise.all(urls.map(probeHealth));
  const failedListeners = outcomes.filter(outcome => outcome.occupied && !outcome.health);
  if (failedListeners.length) {
    throw new Error(`A local listener on ${baseUrl.hostname}:${port} did not return the API health response; refusing to start a duplicate server`);
  }
  return outcomes.find(outcome => outcome.health)?.health || null;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForHealth(server, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`API server exited during startup (code ${server.exitCode})`);
    const health = await getHealth();
    if (health) return health;
    await delay(200);
  }
  throw new Error(`API did not return a valid /health response within ${timeoutMs} ms at ${baseUrl.origin}`);
}

function runNpmScript(script) {
  const npmCli = process.env.npm_execpath;
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, 'run', script], { cwd: root, stdio: 'inherit', timeout: 180000 })
    : spawnSync('npm.cmd', ['run', script], { cwd: root, stdio: 'inherit', shell: true, timeout: 180000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed${result.signal ? ` (${result.signal})` : ` (exit ${result.status})`}`);
}

async function stopOwnedServer() {
  if (!ownedServer || ownedServer.exitCode !== null) return;
  const child = ownedServer;
  ownedServer = null;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}

async function main() {
  if (!local || !['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new Error(`test:all needs a localhost base_url so it can verify/start its API; found ${baseUrl.origin}`);
  }

  let health = await getHealth();
  if (health) {
    console.log(`[test:all] Reusing ready API at ${baseUrl.origin} (storage=${health.storage})`);
  } else {
    console.log(`[test:all] No ready API at ${baseUrl.origin}; starting backend/server.js`);
    ownedServer = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
      cwd: root,
      env: { ...process.env, PORT: String(port), ENABLE_TEST_ROUTES: 'true' },
      stdio: 'inherit',
    });
    health = await waitForHealth(ownedServer, startupTimeoutMs);
    console.log(`[test:all] API ready (storage=${health.storage})`);
  }

  for (const script of scripts) runNpmScript(script);
}

main()
  .catch(error => {
    console.error(`[test:all] ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(stopOwnedServer);
