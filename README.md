# Student CRUD API Automation and Validation Framework

This academic project builds a small Student Management REST API and checks it with Postman and Newman. The API has no frontend. Its OpenAPI document is the frozen contract; the automated tests compare real responses with that contract.

## What is included

- Express API for student create, list, get, replace, and delete operations.
- MongoDB/Mongoose storage with a matching in-memory repository when MongoDB is unset or unreachable.
- Strict input validation, normalized email addresses, stable public IDs, and contract-shaped errors.
- A Postman v2.1 collection for TC01–TC35, plus a CSV-driven lifecycle and cleanup.
- Newman CLI, HTML and JUnit reports, generated response schemas, and a GitHub Actions workflow.
- An independent Restful-Booker proof collection in `postman/proof/`.

## Architecture

```text
Postman collection / CSV
          │
          ▼
        Newman ───── HTML + JUnit reports
          │
          ▼ HTTP
   Express Student API ───── /health and optional /api/test/reset
          │
          ├── Mongoose repository ── MongoDB
          └── memory repository (fallback)

OpenAPI contract ── Ajv schema generator ── Postman response checks
GitHub Actions ── installs, starts memory API, runs test:all, uploads reports
```

## Technology choices

| Technology | Purpose |
|---|---|
| Node.js and Express | Run the HTTP API and middleware. |
| Mongoose and MongoDB | Persistent storage with a unique email index. |
| Memory repository | Fast, isolated local/CI fallback with the same repository interface. |
| OpenAPI 3.0 | Describe endpoints, statuses, request fields, and response schemas. |
| Postman and Newman | Author and execute repeatable API checks in the GUI or CLI. |
| CSV | Exercise multiple valid records while giving each one a unique runtime email. |
| GitHub Actions | Run the suite on pushes and pull requests to `main`. |

## Prerequisites

- Windows PowerShell (commands below use PowerShell syntax).
- Node.js 24 and npm. The verification session used Node `v24.19.0` and npm `11.17.0`.
- Postman for manually importing/running the collection.
- MongoDB only if you want to connect to a persistent database. The `test:mongo` command uses `mongodb-memory-server` and downloads a MongoDB binary on its first uncached run.

## Install

From the repository root:

```powershell
npm ci
npm --prefix backend ci
```

Do not commit `.env` files. Both root and backend `.env.example` files contain placeholders only.

## Start the API

For the usual in-memory store, open a PowerShell window:

```powershell
$env:PORT = '5000'
$env:MONGODB_URI = ''
$env:ENABLE_TEST_ROUTES = 'true'
npm --prefix backend start
```

`ENABLE_TEST_ROUTES=true` is needed by the normal test suite because it verifies the enabled reset route. A separate test starts a second server with the route disabled and expects `404 ROUTE_NOT_FOUND`.

Check readiness in another PowerShell window:

```powershell
(Invoke-WebRequest http://127.0.0.1:5000/health).Content
```

The response reports `data.storage` as `memory` or `mongo`.

## Run Postman and Newman

Import these files into Postman:

- `postman/Student-CRUD-API.postman_collection.json`
- `postman/Student-API-Local.postman_environment.json`

Choose the `Student-API-Local` environment. Its default `base_url` is `http://localhost:5000`.

From the repository root:

```powershell
npm run test:api
npm run test:data
npm run test:all
```

`test:api` covers folders 00–04. `test:data` runs folder 05 once per CSV row. `test:all` runs both, then verifies reset-route-disabled behavior. Newman returns a nonzero exit code when an assertion fails.

## Reports

The API runs write HTML and JUnit output beneath `reports/api/`; the Restful-Booker proof command writes to `reports/proof/`:

```powershell
npm run test:proof
```

Generated reports and logs are ignored by `.gitignore` so they do not get committed accidentally. GitHub Actions uploads `reports/` as an artifact even when tests fail.

## In-memory, MongoDB, and contract checks

Run the 106-assertion backend verification directly:

```powershell
node backend/verify.js --mode=memory
node backend/verify.js --mode=mongo
```

Run the complete Newman suite against a temporary MongoDB server:

```powershell
npm run test:mongo
```

The temporary MongoDB instance and backend are stopped when the command exits. Its binary may need to be downloaded once.

Run the OpenAPI/Ajv validator against a live memory or Mongo backend; these helpers start their own server:

```powershell
npm run test:contract:memory
npm run test:contract:mongo
```

To test fallback for an unreachable Mongo URI:

```powershell
node backend/verify-fallback.js
```

## Fault-injection demonstrations

Fault injection is disabled unless `INJECT_BUG` is set when the backend starts. Normal CI never sets it. The reproducible mutation suite starts a fresh in-memory server for each of the five project bugs, checks which TC IDs fail, then reruns each affected folder without the fault:

```powershell
npm run test:mutations
```

The mutation is for demonstration only. In particular, B03 skips application-level uniqueness in the memory repository; MongoDB’s unique index remains an independent protection. See `docs/project-report.md` for observed mutation results and `docs/test-matrix.md` for the bug catalogue.

## GitHub Actions

The workflow is `.github/workflows/api-tests.yml`. It installs root and backend lockfiles, starts the in-memory API with test routes enabled, waits for `/health`, runs `npm run test:all`, and uploads reports. No workflow run could be inspected because this checkout has no Git remote configured.

See `docs/github-actions-guide.md` for creating a remote and inspecting successful and failed runs.

## Repository layout

```text
backend/       Express app, repositories, verification scripts
docs/          frozen contract, test matrix, project and learning documents
postman/       Student collection, environment, CSV, tools, proof exercise
reports/       generated HTML/JUnit outputs and logs (ignored by Git)
.github/       GitHub Actions workflow
```

## Known limits

- There is no frontend.
- TC31 measures local API response time against the project’s 500 ms threshold; it is not a public-host SLA.
- GitHub Actions configuration was audited locally, but no hosted run was available to inspect because there is no configured remote.
- Newman prints a deprecation warning for Postman’s built-in `tv4` validator; the schema assertions pass in Newman, and this avoids a runtime dependency unavailable inside the Postman app.

## Documentation

- [Requirements](docs/requirements.md)
- [API reference](docs/api-documentation.md)
- [Test strategy](docs/test-strategy.md)
- [Test cases](docs/test-cases.md)
- [Project report and audit](docs/project-report.md)
- [Learning guide](docs/learning-guide.md)
- [Viva questions](docs/viva-questions.md)
- [Demo script](docs/demo-script.md)
- [Screenshot checklist](docs/screenshot-checklist.md)
- [GitHub Actions guide](docs/github-actions-guide.md)
