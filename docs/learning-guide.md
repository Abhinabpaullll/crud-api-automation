# Learning guide: follow one API request through the project

This guide is for someone new to REST APIs, Postman, and CI. Try each step in order.

## 1. Start with the contract

Open [`contract/openapi.yaml`](contract/openapi.yaml). It describes the paths, HTTP methods, status codes, request fields, and response schemas. For example, `POST /api/students` accepts a JSON student and returns `201` with a success envelope.

The contract is frozen. If code and contract differ, first identify which side is wrong; do not change the expected result simply to get a green test.

## 2. Understand an HTTP request

An HTTP request has a method, URL, headers, and sometimes a body. A create request looks like:

```http
POST /api/students
Content-Type: application/json
```

```json
{"name":"Ravi Shah","email":"ravi@example.com","course":"CSE","year":2,"cgpa":8.2}
```

The response has a status line (such as `201 Created`), headers (such as `Content-Type`), and a body. A test should inspect all three when the contract defines them.

## 3. Start the backend in memory mode

```powershell
$env:PORT = '5000'
$env:MONGODB_URI = ''
$env:ENABLE_TEST_ROUTES = 'true'
npm start
```

An empty Mongo URI selects the memory repository. `/health` tells you which storage mode is active. The two repositories share the same methods so controllers do not need separate CRUD logic.

## 4. Try a request manually

In a second PowerShell window:

```powershell
$student = @{
  name='Ravi Shah'; email='ravi@example.com'; course='CSE'; year=2; cgpa=8.2
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:5000/api/students `
  -ContentType 'application/json' -Body $student
```

The returned `data.id` is a public ID. Use it in `GET /api/students/{id}`, `PUT`, and `DELETE` requests.

## 5. Explore the Postman collection

Import the collection and environment. Select `Student-API-Local`. The collection pre-request script creates a run ID and unique email/course values so a second run does not collide with the first.

Open `TC01 Create valid student`. Its test script checks `201`, the response schema, the 24-hex ID, normalized email, and success flag. The next requests use the saved ID, so the main lifecycle demonstrates chaining.

TC25 and TC28 are designed to stand alone: each creates its own setup data and deletes it after the assertion.

## 6. What Newman adds

Postman is useful interactively; Newman runs the same collection from a terminal or CI. From the project root:

```powershell
npm run test:all
```

`test:all` checks readiness, starts and cleans up an API when necessary, then runs all three suites. Newman prints request/assertion counts and returns a nonzero exit code if an assertion fails. It also writes HTML and JUnit reports under `reports/api/`.

The CSV contains eight valid students. `test:data` executes create, get, and delete for every row. The runtime email includes the row’s local name, run ID, and iteration index.

## 7. How schema checking works

`npm run collection:generate` builds the collection and runs the schema generator. The generator reads the OpenAPI YAML, resolves `$ref` references, compiles each component schema with Ajv, and stores the resolved schemas in `postman/tools/openapi-response-schemas.json` and collection variables. The Postman scripts validate actual response bodies with the built-in tv4 library so the same collection can run in Postman and Newman.

The separate `backend/test-contract.js` uses Ajv directly to check live responses against the OpenAPI schema. It also checks for `_id` and `__v` in Mongo mode.

## 8. Memory and Mongo modes

- **Memory:** leave `MONGODB_URI` empty. Data exists only for the process lifetime.
- **Mongo:** set `MONGODB_URI` to a reachable MongoDB connection string. `/health` reports `mongo` after the connection succeeds.
- **Fallback:** if Mongo is unreachable, the server logs the connection failure and selects memory mode.

For an isolated MongoDB without installing a server manually, run `npm run test:mongo`. The helper starts `mongodb-memory-server`, runs the suite, and stops its temporary processes.

## 9. How CI works

The workflow installs dependencies from both lockfiles, starts a memory backend, waits for `/health`, runs `npm run test:all`, and uploads reports. A green check means Newman exited zero in that hosted run. The local workflow file is not proof that GitHub ran it; a repository must be pushed before the Actions page can show a run.

## 10. How to demonstrate bug detection

Run `npm run test:mutations`. The helper enables one startup fault at a time. For B01, DELETE incorrectly returns 200 and TC05 fails its status and empty-body checks. It then starts a normal backend and reruns the same folder. This demonstrates why exact status, body, schema, and header assertions matter.

## Useful vocabulary

- **Endpoint:** a method/path pair such as `GET /api/students`.
- **Status code:** the HTTP result, such as 200, 201, 400, or 404.
- **Schema:** rules describing the shape and data types of a JSON value.
- **Idempotent:** repeating an operation has the same intended final effect; `DELETE` of a missing record still returns a defined 404 here.
- **Regression:** a change that breaks previously correct behavior.
- **CI:** automated checks run by a hosted system after repository events.
