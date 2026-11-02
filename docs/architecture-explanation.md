# Architecture explanation

## The pieces

```text
OpenAPI contract ── schema generator ── Postman collection variables
       │                                      │
       └── live Ajv contract test              └── Newman / Postman
                                                    │ HTTP
                                                    ▼
                                           Express Student API
                                                    │
                                      controller → repository interface
                                              ┌─────┴─────┐
                                              ▼           ▼
                                         MongoDB       memory store
                                                    │
                                                    ▼
                                             HTML / JUnit
                                                    ▲
                                           GitHub Actions
```

## Request flow

1. The Postman collection or a client sends an HTTP method, URL, headers, and optional JSON body.
2. `backend/server.js` configures Express middleware, including CORS for browser clients, and mounts the health, student, and optional test routes.
3. A route calls a controller in `backend/src/controllers/`. Controllers validate or normalize data as needed and ask the repository for the operation.
4. `backend/src/config/db.js` selects the Mongo repository after a successful Mongoose connection. With no usable Mongo URI, it logs the fallback and selects the memory repository. Both repositories expose the same operations to controllers.
5. The controller returns the established success or error envelope. The Mongo model maps its database identifier to the public `id`; responses do not expose `_id` or `__v`.
6. Postman tests inspect status, headers, body fields, error codes, and OpenAPI-derived response schemas. `backend/test-contract.js` independently loads the frozen OpenAPI YAML and validates live responses using Ajv.
7. Newman runs the imported collection without the Postman GUI. Its reporters write HTML for people and JUnit XML for CI tools.

## Test orchestration

`npm run test:all` reads the local environment's `base_url` and checks `/health` on the local loopback addresses. It reuses a healthy API. If no listener is present, it starts `backend/server.js` with the test reset route enabled, waits up to ten seconds for health, runs the API, CSV, and reset-disabled suites in order, then stops only the child process it started. A listener that accepts connections but does not answer health causes a diagnostic failure; it is not killed or replaced. Newman requests have a ten-second limit and a collection run has a three-minute limit.

`npm run test:mongo` creates a temporary MongoDB with `mongodb-memory-server`, starts the API in Mongo mode, runs `test:all`, and stops both. The memory and Mongo contract commands each start a separate live backend and compare actual responses to the contract. The mutation runner starts isolated servers with `INJECT_BUG` set to one known fault at a time.

## Continuous integration

`.github/workflows/api-tests.yml` installs root and backend dependencies, starts the memory-mode backend, waits for `/health`, and runs `npm run test:all`. It uploads the generated `reports/` directory even when tests fail. The local workflow definition is not evidence of a hosted run; a run must be triggered in a connected GitHub repository.
