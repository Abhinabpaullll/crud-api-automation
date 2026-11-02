# Project requirements

## Purpose

Build a small Student Management API and demonstrate that an independent Postman/Newman suite can check it against a frozen OpenAPI contract. The project is a backend/API testing project; it does not include a frontend.

## Users and actors

- **API client:** creates, reads, replaces, and deletes student records over HTTP.
- **Tester:** imports the Postman collection, selects an environment, and runs the collection.
- **CI runner:** starts the API in memory mode and runs Newman after a push or pull request.
- **Tutor/examiner:** reviews the contract, test matrix, reports, and mutation evidence.

## Functional requirements

1. Provide `GET /health` readiness with storage mode.
2. Create a student with name, email, course, year, and CGPA.
3. List students, optionally filter by course, and paginate with page/limit.
4. Retrieve a student by its 24-character lowercase hexadecimal ID.
5. Replace a student with `PUT`; all five input fields are required.
6. Delete a student with `204 No Content` and an empty response body.
7. Normalize email by trimming and lower-casing it; reject case-insensitive duplicates on create and update.
8. Validate fields strictly: year is an integer from 1 through 4; CGPA is a number from 0 through 10; names and courses are non-blank and at most 100 characters; email is valid and at most 254 characters.
9. Ignore client-supplied IDs and timestamps.
10. Return the contract error envelope with the exact error code and field details where defined.
11. Observe D-08 ordering: ID format, JSON syntax, body validation, existence, then uniqueness.
12. Offer `POST /api/test/reset` only when `ENABLE_TEST_ROUTES=true`.

## Quality requirements

- Use the same API behavior in memory and Mongo modes.
- Never expose Mongo `_id` or `__v` in public responses.
- Assert response structure against schemas generated from the OpenAPI document.
- Keep test data isolated with unique runtime values and delete data created by a test.
- Keep the local CRUD response-time threshold under 500 ms (TC31).
- Make test failures produce a nonzero Newman exit code.
- Run the same suite locally and in GitHub Actions without secrets.
- Keep fault injection disabled by default and out of normal CI.

## Scope exclusions

- No browser-based user interface.
- No authentication or authorization for the student CRUD endpoints.
- No `PATCH`; the frozen contract defines full replacement with `PUT`.
- No production deployment or hosted database credentials.

## Source of truth

The frozen API definition is [`contract/openapi.yaml`](contract/openapi.yaml), with behavioral decisions in [`contract/decisions.md`](contract/decisions.md). The scenario IDs and test intent are in [`test-matrix.md`](test-matrix.md).
