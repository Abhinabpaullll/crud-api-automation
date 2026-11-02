# OpenAPI schema generation

Run `npm run collection:generate` from the repository root. It writes the v2.1 collection and runs the OpenAPI schema generator. `npm run schemas:generate` reads `docs/contract/openapi.yaml`, resolves component `$ref`s, compiles the response schemas with Ajv, writes `postman/tools/openapi-response-schemas.json`, and places the schemas in collection variables used by the Postman tests (tv4, available in Postman and Newman).

The schema generator uses the YAML, Ajv, and ajv-formats packages installed by `npm ci` in `backend/`. The GitHub Actions workflow installs backend dependencies before generating schemas. The test:all command runs folders 00–04, the data-driven folder, then starts a separate server with test routes disabled and asserts its 404 behavior.
