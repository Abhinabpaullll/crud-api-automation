# Test cases

The detailed source matrix is [`test-matrix.md`](test-matrix.md). The collection-to-scenario mapping is [`postman/TC-COVERAGE.md`](../postman/TC-COVERAGE.md). This summary groups the cases by purpose.

| ID | Scenario | Main expected result |
|---|---|---|
| TC01–TC06 | Create, filter/list, read, update, delete, read after delete | `201`, `200`, `204` empty, then `404 NOT_FOUND`. |
| TC07–TC11 | Missing ID and invalid/missing required fields, invalid email, year, CGPA | `404 NOT_FOUND` or `400 VALIDATION_ERROR` with the appropriate field detail. |
| TC12–TC14 | Duplicate create, update missing record, delete missing record | `409 DUPLICATE_EMAIL` or `404 NOT_FOUND`. |
| TC15–TC18 | Successful/error JSON content type, malformed ID/JSON, unknown route | Exact status/code and JSON response schema. TC15 checks both success and error content types. |
| TC19–TC22 | Ignore client metadata, valid/invalid boundaries, strict JSON types | `201` for allowed values; `400 VALIDATION_ERROR` for invalid inputs. |
| TC23–TC25 | Case-insensitive duplicate, update another student’s email, missing PUT field | `409`, `409`, and `400` respectively. TC25 uses its own setup and cleanup records. |
| TC26–TC27 | Timestamp rules and update persistence | `createdAt` stable; `updatedAt` advances and persists. |
| TC28–TC29 | Course filter and invalid pagination | Only the seeded matching course is returned; invalid page/limit gives `400`. |
| TC30–TC32 | Health, CRUD latency, repeated delete | Health `200`; each CRUD response below 500 ms; second delete `404`. |
| TC33 | CSV data-driven lifecycle | Eight rows each receive create `201`, get `200`, delete `204`, and cleanup. |
| TC34–TC35 | Email normalization and whitespace-only name | Normalized email `201`; blank name `400 VALIDATION_ERROR`. |

## Reset-route check

The additional `TC36 Test reset route mode` checks `204` with empty body when enabled and `404 ROUTE_NOT_FOUND` when disabled. It is separate from the 35 matrix cases.
