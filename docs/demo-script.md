# Seven-minute examiner demonstration

## Before the demonstration

Open PowerShell at the repository root. Ensure dependencies are installed with `npm ci` and `npm --prefix backend ci`. Open Postman and import `postman/Student-CRUD-API.postman_collection.json` and `postman/Student-API-Local.postman_environment.json`. Select the `Student-API-Local` environment. The walkthrough uses the memory store; no MongoDB service is required.

## Timed walkthrough

### 0:00–0:35 — Introduce the project

**Say:** “This is a Student CRUD API and an automated validation framework. The OpenAPI contract defines expected responses, Postman contains the reusable requests and assertions, and Newman runs those same checks in a terminal or CI. My project focus is repeatable API validation; it does not include a frontend.”

### 0:35–1:15 — Start and check readiness

Run:

```powershell
$env:PORT = '5000'
$env:MONGODB_URI = ''
$env:ENABLE_TEST_ROUTES = 'true'
npm start
```

In a second PowerShell window, run:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/health
```

**Show:** startup says `using IN-MEMORY store`; health returns `status: ok` and `storage: memory`.

**Say:** “The health endpoint tells me the server is ready and which repository it selected. The test-only reset route is enabled only for this demo session.”

### 1:15–2:00 — Explain the contract and architecture

Open `docs/contract/openapi.yaml` and show `GET /health`, `POST /api/students`, and the student response schema. Then show the architecture diagram in `docs/architecture-explanation.md`.

**Say:** “The contract is the fixed expected behavior. The Express route calls a controller, which uses the same repository interface whether data is in MongoDB or memory. Postman checks actual HTTP responses; the separate contract test loads this YAML and validates live responses with Ajv.”

### 2:00–3:25 — Demonstrate the CRUD lifecycle

In Postman, open **Student CRUD API → 00 Health → TC30 Health readiness** and click **Send**. Then open **01 CRUD Lifecycle → TC01 Create valid student**, click **Send**, and point to `201`, the 24-character ID, normalized email, and timestamps. Continue through TC02 (filtered list), TC03 (get), TC04 (full update), TC27 (persistence), TC05 (delete), and TC06 (get deleted record). Use the ID saved by TC01; do not edit it manually.

**Say:** “The create test saves its returned ID into the environment. The following requests reuse it, check the updated fields and timestamps, then verify the 204 empty delete response and the 404 after deletion.”

### 3:25–4:20 — Show validation and uniqueness

Open **02 Validation (Negative)** and send TC09 (invalid email) and TC10 (out-of-range year). Then open **03 Uniqueness** and send TC23 (same email with different case) and TC24 (PUT onto another student’s email).

**Show:** validation returns 400 with `VALIDATION_ERROR`; duplicate email returns 409 with `DUPLICATE_EMAIL`.

**Say:** “Negative tests check the exact status and error code, not just whether the request failed. The uniqueness checks show that email normalization applies across create and update.”

### 4:20–5:20 — Run Newman and inspect reports

Stop the manually started server with **Ctrl+C**. In PowerShell run:

```powershell
npm run test:all
```

**Show:** the runner reports that it starts the backend, then the three Newman summary tables and exit code `0`. Open `reports/api/api-report.html` and `reports/api/data-report.html`.

**Say:** “The all-tests command checks health, starts its own server when needed, and cleans up only that server. Each Newman request and collection has a time limit, so an unresponsive API fails instead of hanging indefinitely.”

### 5:20–6:10 — Show repeatable data and fault detection

Point to `postman/test-data.csv` and explain that the data-driven folder creates, reads, and deletes one student for each of its eight rows. Then run:

```powershell
npm run test:mutations
```

**Show:** an expected mutation failure such as B01/TC05, followed by the restored folder passing.

**Say:** “Mutation testing deliberately introduces a known defect. The expected test must detect it, and the same test must pass again after the defect is removed.”

### 6:10–7:00 — Close with contract and CI

Show `.github/workflows/api-tests.yml` and the JUnit report `reports/api/api-junit.xml`.

**Say:** “GitHub Actions installs both dependency sets, starts the memory backend, waits for health, runs the same suite, and uploads the reports. This workflow file is configured locally; a hosted run can only be shown after the repository has a GitHub remote and a workflow run.”

Finish with: “The project demonstrates API behavior, contract checks, repeatable test data, readable reports, and CI automation while keeping the contract as the source of expected behavior.”

## Demo reset

Press **Ctrl+C** in any remaining manually started API window. `npm run test:all`, `npm run test:mongo`, and the contract helpers clean up the server processes they start. Generated reports remain under `reports/` and are ignored by Git.
