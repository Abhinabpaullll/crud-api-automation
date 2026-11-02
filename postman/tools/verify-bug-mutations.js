const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const targets = [
  { id: 'B01', bug: 'delete-returns-200', folder: '01 CRUD Lifecycle', expected: ['TC05'] },
  { id: 'B02', bug: 'skip-email-validation', folder: '02 Validation (Negative)', expected: ['TC09'] },
  { id: 'B03', bug: 'skip-unique-email', folder: '03 Uniqueness', expected: ['TC12', 'TC23', 'TC24'] },
  { id: 'B04', bug: 'year-upper-bound-5', folder: '02 Validation (Negative)', expected: ['TC10', 'TC21'] },
  { id: 'B09', bug: 'wrong-content-type', folder: '04 Errors and Routing', expected: ['TC15', 'TC18'] },
];

function waitForHealth(port, server) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (server.exitCode !== null) return reject(new Error(`Backend exited (${server.exitCode})`));
      const request = http.get(`http://127.0.0.1:${port}/health`, response => {
        let body = ''; response.setEncoding('utf8'); response.on('data', part => body += part);
        response.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (response.statusCode === 200 && json.data.storage === 'memory') return resolve();
          } catch {}
          retry();
        });
      });
      request.on('error', retry);
      request.setTimeout(500, () => { request.destroy(); });
      function retry() {
        if (Date.now() - started > 10000) return reject(new Error(`Timed out waiting for port ${port}`));
        setTimeout(poll, 100);
      }
    };
    poll();
  });
}

async function runCase(target, index) {
  const port = 5220 + index * 3;
  const baseEnv = { ...process.env, PORT: String(port), MONGODB_URI: '', ENABLE_TEST_ROUTES: 'true', INJECT_BUG: '' };
  const report = path.join(root, 'reports/api');

  // Record a complete normal test:all baseline immediately before each mutation.
  const baselineServer = spawn(process.execPath, [path.join(root, 'backend/server.js')], { cwd: root, env: baseEnv, stdio: 'ignore' });
  const environmentPath = path.join(root, 'postman/Student-API-Local.postman_environment.json');
  const originalEnvironment = fs.readFileSync(environmentPath, 'utf8');
  try {
    await waitForHealth(port, baselineServer);
    const environment = JSON.parse(originalEnvironment);
    environment.values.find(v => v.key === 'base_url').value = `http://127.0.0.1:${port}`;
    fs.writeFileSync(environmentPath, JSON.stringify(environment, null, 2));
    const baseline = spawnSync('npm.cmd', ['run', 'test:all'], {
      cwd: root, encoding: 'utf8', env: baseEnv, shell: true
    });
    const baselineOutput = (baseline.stdout || '') + (baseline.stderr || '');
    fs.writeFileSync(path.join(report, `baseline-${target.id}.log`), baselineOutput);
    if (baseline.status !== 0) throw new Error(`${target.id}: normal baseline failed with exit ${baseline.status}`);
    const baselineSummaries = baselineOutput.split(/\r?\n/).filter(line => /\brequests\s+│|\bassertions\s+│/.test(line));
    console.log(`\n${target.id} normal baseline exit=${baseline.status}`);
    console.log(baselineSummaries.join('\n'));
  } finally {
    fs.writeFileSync(environmentPath, originalEnvironment);
    baselineServer.kill();
  }

  const bugPort = port + 1;
  const bugEnv = { ...baseEnv, PORT: String(bugPort), INJECT_BUG: target.bug };
  const server = spawn(process.execPath, [path.join(root, 'backend/server.js')], { cwd: root, env: bugEnv, stdio: 'ignore' });
  try {
    await waitForHealth(bugPort, server);
    const bugRun = spawnSync(process.execPath, [
      path.join(root, 'postman/tools/run-newman.js'), '--folder', target.folder,
      '--env-var', `base_url=http://127.0.0.1:${bugPort}`, '-r', 'cli'
    ], { cwd: root, encoding: 'utf8', env: { ...process.env, INJECT_BUG: '' } });
    const bugOutput = (bugRun.stdout || '') + (bugRun.stderr || '');
    fs.writeFileSync(path.join(report, `mutation-${target.id}.log`), bugOutput);
    const failureLines = bugOutput.split(/\r?\n/).filter(line =>
      /^\s*\d+\.\s+(?:AssertionError|JSONError|TypeError|Error)\s+/.test(line)
    );
    const failures = failureLines.join('\n');
    const actual = [...new Set([...failures.matchAll(/\bTC\d{2}\b/g)].map(m => m[0]))].sort();
    const missing = target.expected.filter(id => !actual.includes(id));
    const unrelated = actual.filter(id => !target.expected.includes(id));
    console.log(`\n${target.id} (${target.bug}) mutation exit=${bugRun.status}; expected=${target.expected.join(',')}; actual=${actual.join(',') || '(none)'}; unrelated=${unrelated.join(',') || '(none)'}`);
    if (bugRun.status === 0 || missing.length || unrelated.length) throw new Error(`${target.id}: mutation was not isolated (missing ${missing.join(',') || 'none'}; unrelated ${unrelated.join(',') || 'none'})`);
    console.log(failures);
  } finally {
    server.kill();
  }

  const restorePort = port + 2;
  const normalServer = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
    cwd: root, env: { ...baseEnv, PORT: String(restorePort) }, stdio: 'ignore'
  });
  try {
    await waitForHealth(restorePort, normalServer);
    const restored = spawnSync(process.execPath, [
      path.join(root, 'postman/tools/run-newman.js'), '--folder', target.folder,
      '--env-var', `base_url=http://127.0.0.1:${restorePort}`, '-r', 'cli'
    ], { cwd: root, encoding: 'utf8', env: { ...process.env, INJECT_BUG: '' } });
    const restoredOutput = (restored.stdout || '') + (restored.stderr || '');
    fs.writeFileSync(path.join(report, `restored-${target.id}.log`), restoredOutput);
    if (restored.status !== 0) throw new Error(`${target.id}: restored test folder failed with exit ${restored.status}`);
    console.log(`${target.id} restored folder exit=${restored.status} (all assertions passed)`);
  } finally {
    normalServer.kill();
  }
}

(async () => {
  for (let i = 0; i < targets.length; i++) await runCase(targets[i], i);
  console.log('\nBUG_MUTATION_VERIFICATION PASS');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
