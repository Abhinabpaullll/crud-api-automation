const fs = require('fs');
const path = require('path');
const yaml = require(path.resolve(__dirname, '../../backend/node_modules/yaml'));
const Ajv = require(path.resolve(__dirname, '../../backend/node_modules/ajv'));
const addFormats = require(path.resolve(__dirname, '../../backend/node_modules/ajv-formats'));
const root = path.resolve(__dirname, '../..');
const spec = yaml.parse(fs.readFileSync(path.join(root, 'docs/contract/openapi.yaml'), 'utf8'));
function resolve(value) {
  if (Array.isArray(value)) return value.map(resolve);
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) {
    const target = value.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], spec);
    return resolve(target);
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
}
const schemas = Object.fromEntries(Object.entries(spec.components.schemas).map(([k, v]) => [k, resolve(v)]));
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
for (const [name, schema] of Object.entries(schemas)) ajv.compile(schema);
const out = path.join(root, 'postman/tools/openapi-response-schemas.json');
fs.writeFileSync(out, JSON.stringify(schemas, null, 2) + '\n');
const collectionPath = path.join(root, 'postman/Student-CRUD-API.postman_collection.json');
if (fs.existsSync(collectionPath)) {
  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  collection.variable = (collection.variable || []).filter(v => !v.key.startsWith('openapi_'));
  for (const [name, schema] of Object.entries(schemas)) collection.variable.push({ key: `openapi_${name}`, value: JSON.stringify(schema), type: 'string' });
  fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + '\n');
}
console.log(`OpenAPI schemas validated with Ajv: ${Object.keys(schemas).join(', ')}`);
