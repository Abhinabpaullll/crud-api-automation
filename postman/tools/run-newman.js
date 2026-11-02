const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const newman = path.join(root, 'node_modules/newman/bin/newman.js');
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [newman, 'run', path.join(root, 'postman/Student-CRUD-API.postman_collection.json'), '-e', path.join(root, 'postman/Student-API-Local.postman_environment.json'), '--timeout-request', '10000', '--timeout', '180000', ...args], { cwd: root, stdio: 'inherit', timeout: 190000 });
if (result.error) {
  console.error(`[newman] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
