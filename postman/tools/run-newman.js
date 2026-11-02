const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const newman = path.join(root, 'node_modules/newman/bin/newman.js');
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [newman, 'run', path.join(root, 'postman/Student-CRUD-API.postman_collection.json'), '-e', path.join(root, 'postman/Student-API-Local.postman_environment.json'), ...args], { cwd: root, stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
