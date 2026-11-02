# Test strategy

## Test layers

1. **Backend verification (`backend/verify.js`)** runs the same 106 assertions against the memory repository and an isolated MongoDB instance.
2. **Live contract validation (`backend/test-contract.js`)** loads the actual OpenAPI YAML, resolves response schemas, compiles them with Ajv, then checks real HTTP responses. Mongo mode recursively checks that `_id` and `__v` are absent.
3. **Postman/Newman (`postman/Student-CRUD-API.postman_collection.json`)** checks the traceable scenarios TC01–TC35, response codes, error codes, field details, response headers, schemas, and CRUD behavior.
4. **Data-driven run** executes create/get/delete once per CSV row and cleans each created student.
5. **CI** runs the complete suite on Node 24 with the in-memory backend and uploads HTML/JUnit reports.
6. **Mutation verification** turns on one deliberate bug at a time, checks the expected TC IDs fail, and reruns that folder with a clean backend.

## Test data and isolation

Collection pre-request logic creates a run ID, email, and unique course. CSV emails include the row’s local name, run ID, and Newman iteration index. TC25 and TC28 create and delete their own setup records; the main CRUD flow intentionally chains TC01–TC06 and TC32.

The test reset endpoint is enabled only in the test server. A separate process starts the backend with reset disabled and verifies `404 ROUTE_NOT_FOUND`.

## Assertions

- Assert exact status codes; error cases check exact `error.code`.
- Check `details[].field` for field-specific validation scenarios.
- Check JSON content type on errors and the documented successful response.
- Validate response bodies with schemas generated directly from OpenAPI and stored in collection variables for Postman/Newman’s built-in tv4 validator.
- Check 204 response bodies are exactly empty.
- Check timestamps, strict numeric types, boundaries, email normalization, uniqueness, pagination, filtering, and persistence.
- Collection-level TC31 requires every request under `/api/students` to respond in less than 500 ms.

## Repeatability and commands

```powershell
npm run test:all
npm run test:mongo
npm run test:contract:memory
npm run test:contract:mongo
npm run test:mutations
```

The normal CI command is `npm run test:all`. It never sets `INJECT_BUG`. The Mongo/contract helpers start and stop temporary local services. `mongodb-memory-server` may need a MongoDB binary download.

## Test case traceability

The 35 scenario definitions remain in [`test-matrix.md`](test-matrix.md), and the exact collection request mapping is [`TC-COVERAGE.md`](../postman/TC-COVERAGE.md). TC26 is an assertion within the TC04 update response; TC31 is a collection-level test script.
