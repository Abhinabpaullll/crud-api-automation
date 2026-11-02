# Troubleshooting

Commands use PowerShell and assume the current directory is the repository root.

## `npm` reports a missing package

Install from the existing lockfiles:

```powershell
npm ci
npm --prefix backend ci
```

The root install contains Newman and its HTML reporter. The backend install contains Express, Mongoose, Ajv, and the OpenAPI tooling.

## `/health` cannot be reached

Start the API explicitly:

```powershell
$env:PORT = '5000'
$env:MONGODB_URI = ''
$env:ENABLE_TEST_ROUTES = 'true'
npm start
```

In a second window, check:

```powershell
Invoke-RestMethod -TimeoutSec 5 http://127.0.0.1:5000/health
```

If the port is in use, inspect the owning process before stopping anything:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5000 |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

The test runner will not kill that process. If it is an unresponsive listener, stop it yourself only after confirming its PID and purpose; then rerun `npm run test:all`.

## `test:all` reports an unhealthy or occupied listener

The runner checks `/health` before starting. If a local address accepts a connection but does not return the expected health envelope, the runner exits with a diagnostic to avoid creating a second API. Check the port owner and backend logs. Startup waits at most ten seconds; Newman requests wait at most ten seconds.

To start the API manually and keep it running, use `npm start`. The separate commands `npm run test:api` and `npm run test:data` expect an already running API at the environment's `base_url`; use `npm run test:all` for managed startup.

## Health reports `storage: memory`

That is expected when `MONGODB_URI` is empty. For Mongo mode, set a reachable Mongo connection string before starting the API:

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/student_api'
npm start
```

If Mongo cannot be selected before the configured timeout, startup logs the connection failure and uses memory mode. Confirm the `/health` value before interpreting the test run as a Mongo run. For a temporary isolated Mongo server, use `npm run test:mongo` or `npm run test:contract:mongo`; the first uncached run may download a MongoDB binary.

## Reset-route test fails

The `POST /api/test/reset` route exists only when `ENABLE_TEST_ROUTES=true`. The `test:all` runner enables it for its owned API, then separately starts the reset-disabled server and expects `404 ROUTE_NOT_FOUND`. For a manually started Postman API suite, set the variable before `npm start`:

```powershell
$env:ENABLE_TEST_ROUTES = 'true'
npm start
```

Do not enable the test route in a production deployment.

## Newman fails an assertion

Read the failing TC ID and request name in the terminal or HTML report. Check the exact expected status, error code, response field, and schema before changing code or tests. The OpenAPI contract is frozen; do not change an expected status just to make a test pass.

If a failure is specific to data, rerun `npm run test:all`; each normal run makes fresh email/course values and the CSV flow deletes its own records. TC25 and TC28 also create and remove their own setup records.

## Reports are missing

Run `npm run test:all` from the repository root. The main and CSV runs write HTML and JUnit outputs under `reports/api/`. The public Restful-Booker proof has its own `npm run test:proof` command and writes under `reports/proof/`. Generated reports are ignored by Git.

## Generated collection changed

The collection and response-schema variables are generated with:

```powershell
npm run collection:generate
```

The TC08 missing-name request uses a fixed email because it cannot create a student. Runtime-generated IDs and emails for successful flows remain dynamic in Postman pre-request scripts. Inspect the diff after regeneration; do not keep timestamp-only churn.

## GitHub Actions cannot be shown

The workflow file is `.github/workflows/api-tests.yml`. A hosted run requires the repository to be connected to GitHub and a push or pull request to trigger it. A local workflow file alone does not prove a hosted run passed.
