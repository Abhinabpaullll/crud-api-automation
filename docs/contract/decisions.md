# Decision Log (API Contract v1.0.0)

Status: **PROPOSED**. Review once, then mark **FROZEN** before Stage 1 starts.
After freezing, any change must be added here as a new dated entry *before* code or tests change.

Companion files: `openapi.yaml` (machine-readable contract), `../test-matrix.md` (test cases and bug catalogue).

## D-01 to D-12: API behaviour

| ID | Decision | Rationale |
|---|---|---|
| D-01 | Success envelope: `{ "success": true, "data": ... }`. List adds `count`, `total`, `page`, `limit`. | One predictable shape for every test. |
| D-02 | Error envelope: `{ "success": false, "error": { "code", "message", "details?" } }`. Codes: `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_JSON`, `NOT_FOUND`, `DUPLICATE_EMAIL`, `ROUTE_NOT_FOUND`, `INTERNAL_ERROR`. | Tests assert the *specific* error code, not just "any failure" (plan section 15). |
| D-03 | Identifier is exposed as `id` (string). Mongo `_id` and `__v` are never returned. | Postman scripts use `body.data.id`. |
| D-04 | `id` is a 24-character lowercase hex string in both Mongo and in-memory mode (the fallback generates ObjectId-style ids). | Both modes behave identically for malformed vs missing ids. |
| D-05 | Malformed id -> `400 INVALID_ID`. Well-formed but unknown id -> `404 NOT_FOUND`. | Plan section 7 asks for this distinction to be documented. |
| D-06 | `DELETE` returns `204 No Content` with an **empty body**. | One convention, used everywhere (plan section 3.2). |
| D-07 | `PUT` is full replacement: all five input fields required. `PATCH` is out of scope. | Keeps scope small. PUT vs PATCH stays a viva talking point. |
| D-08 | Check order: id format -> JSON syntax -> body validation -> existence (404) -> uniqueness (409). | Makes every error test deterministic. |
| D-09 | Email is trimmed and lower-cased before validation and storage. Uniqueness is case-insensitive. `PUT` may keep the student's own email but not take another student's. | Prevents hidden duplicates. |
| D-10 | Validation is type-strict: `year` must be a JSON integer 1 to 4, `cgpa` a JSON number 0 to 10 (inclusive), `name` and `course` non-blank strings (trimmed, max 100). Email max 254. A string such as `"3"` is rejected. | Gives crisp boundary and type tests. |
| D-11 | Unknown fields are ignored. Client-supplied `id`, `createdAt`, `updatedAt` never override server values. | Protects against mass assignment. |
| D-12 | `createdAt` is set once; `updatedAt` changes on every successful `PUT`. ISO 8601 UTC. | Lets tests assert timestamp behaviour. |

## D-13 to D-18: Listing, platform and operations

| ID | Decision | Rationale |
|---|---|---|
| D-13 | `GET /api/students` supports `course` (case-insensitive exact match), `page` (default 1) and `limit` (default 10, max 100). Invalid values -> `400 VALIDATION_ERROR`. | Covers query parameters; tests use a unique course value so results are deterministic. |
| D-14 | `GET /health` -> `200` with `{ success, data: { status: "ok", storage: "mongo" \| "memory" } }`. | CI waits on this before running Newman. |
| D-15 | All responses are `application/json; charset=utf-8`, including errors and unknown routes. Unknown route -> `404 ROUTE_NOT_FOUND`. Malformed JSON body -> `400 INVALID_JSON`. | Plan test TC15 and consistent error handling. |
| D-16 | Default port `5000` via `PORT`. Storage: Mongo when `MONGODB_URI` is set and reachable, otherwise the in-memory fallback (logged clearly at startup and reported by `/health`). | Matches the plan; fallback is documented, never silent. |
| D-17 | `POST /api/test/reset` (204) exists only when `ENABLE_TEST_ROUTES=true`; otherwise it does not exist (`404 ROUTE_NOT_FOUND`). Never enabled by default. | Clean test data without touching production behaviour. |
| D-18 | Performance target used in tests: each CRUD request responds in under 500 ms locally. | Gives the response-time assertions a stated basis. |

## D-19: Fault injection (used in Stage 4)

`INJECT_BUG=<name>` makes the API misbehave on purpose so we can prove the tests catch it. Default is unset. It is read once at startup and must **never** be set in CI's normal test job. The catalogue of bug names and the test that must fail for each is in `../test-matrix.md`.

## D-20: Test data

- The CSV file holds `name,course,year,cgpa` plus an `email_local` column. The collection builds the final email at run time as `<email_local>+<timestamp><iteration>@example.com` so reruns never collide (plan section 8).
- Each data-driven iteration deletes the student it created.
- Negative tests that must not depend on earlier requests create their own students and clean up.

## Environment variables (for `.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `MONGODB_URI` | *(unset)* | Mongo connection; unset means in-memory mode |
| `ENABLE_TEST_ROUTES` | `false` | Enables `POST /api/test/reset` |
| `INJECT_BUG` | *(unset)* | Fault injection name (Stage 4 only) |

## Change history

| Date | Change | By |
|---|---|---|
| 2026-11-01 | Initial proposal | Stage 0 |
