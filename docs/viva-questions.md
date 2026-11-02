# Viva preparation

## 30-second project introduction

“My project is a CRUD API Automation and Validation Framework using Postman. It includes an Express Student API with MongoDB and in-memory storage, a frozen OpenAPI contract, and a Postman collection that checks real HTTP responses. Newman runs the same tests from the command line, produces HTML and JUnit reports, and the GitHub Actions workflow is set up to run them in CI. I also use data-driven and mutation tests to show repeatability and prove that important assertions catch known defects.”

## Two-minute technical explanation

“A request starts at an Express route in `backend/server.js`. The route calls a controller, which validates the input and uses a repository interface. `backend/src/config/db.js` chooses the Mongoose repository when MongoDB connects successfully; otherwise it logs and uses the memory repository. Both repositories support the same controller operations. Public responses use the contract’s success or error envelope and expose a 24-hex `id`, not MongoDB’s `_id` or `__v`.

“The OpenAPI YAML is the fixed description of the endpoints, request fields, statuses, and response schemas. The collection generator resolves the schema references and places schemas in collection variables. Postman’s test scripts validate those response bodies while Newman runs the collection from a terminal. A separate Ajv contract test loads the same YAML and validates actual live responses, including Mongo-specific checks.

“The tests cover the CRUD lifecycle, invalid values, year and CGPA boundaries, duplicate emails, pagination, filtering, timestamps, response headers, and a CSV-driven create/get/delete flow. Successful flows use fresh test data and clean up records. `npm run test:all` checks health, starts an API if needed, runs the main, CSV, and reset-disabled suites in order, and cleans up its own server. Request and run timeouts make a stalled API fail within a bounded time. Mutation testing turns on each known defect in isolation and verifies that the expected TC checks fail, then reruns the tests without the defect. Reports are HTML for people and JUnit XML for test tooling.”

## Likely questions and short answers

### Project and API basics

1. **What problem does the project solve?** — It makes Student API behavior easy to check repeatedly against a documented contract.
2. **What does CRUD mean?** — Create, Read, Update, and Delete. This API uses POST, GET, PUT, and DELETE for those operations.
3. **What is REST?** — A common way to expose resources over HTTP using resource paths, methods, and status codes.
4. **What is an endpoint?** — A method and path together, such as `GET /api/students/{id}`.
5. **What does Express do?** — It receives HTTP requests, runs middleware, routes them to handlers, and sends responses.
6. **Why is there no frontend?** — The project focuses on the API and its automated validation; Postman/Newman act as clients.

### Methods, statuses, and validation

7. **Why does create return 201?** — The request created a new student resource.
8. **Why does a successful delete return 204?** — The deletion succeeded and the contract specifies an empty response body.
9. **What is the difference between `INVALID_ID` and `NOT_FOUND`?** — A malformed ID returns 400; a valid-format ID with no matching student returns 404.
10. **What does PUT mean here?** — It replaces the student’s editable fields and requires all five fields: name, email, course, year, and CGPA.
11. **Why validate year 1–4 and CGPA 0–10?** — They are domain limits. Tests include valid boundary values and values just outside the limits.
12. **What is negative testing?** — Sending invalid input and checking the exact expected error status and code.
13. **What is boundary-value testing?** — Testing values at and just outside allowed limits, such as years 1, 4, 0, and 5.
14. **What is D-08 validation order?** — ID format, JSON syntax, body validation, record existence, then uniqueness.

### Data, storage, and isolation

15. **Why normalize email addresses?** — Trimming and lowercasing makes case and surrounding spaces irrelevant to uniqueness.
16. **Why both an application uniqueness check and a Mongo unique index?** — The application returns a clear `DUPLICATE_EMAIL` error; the database index also protects against concurrent writes.
17. **What is the memory store?** — A repository with the same interface as MongoDB, but its records exist only while that server process is alive.
18. **How does the API choose storage?** — A reachable `MONGODB_URI` selects MongoDB; when it is unset or connection selection fails, startup logs and selects memory. `/health` reports the active mode.
19. **How do you avoid duplicate data across runs?** — Successful requests use a run-specific email; CSV emails also include an iteration value, and test-created records are deleted.
20. **Why is a test reset route needed?** — It gives the test collection a predictable clean state. It is disabled unless `ENABLE_TEST_ROUTES=true` and is not meant for production.

### Postman, Newman, schemas, and reports

21. **What is Postman used for?** — Creating and manually sending requests, storing environment values such as `base_url` and the created student ID, and running assertions.
22. **What does Newman add?** — It runs the Postman collection from a terminal or CI without opening the Postman app.
23. **What is a response schema?** — Rules for response structure and data types; the tests compare actual JSON with the OpenAPI-derived schema.
24. **Why use Ajv and tv4?** — The separate contract test uses Ajv to load and validate against OpenAPI. The collection uses Postman’s built-in tv4 so the same requests remain runnable in Postman and Newman.
25. **Why have CSV tests?** — One create/get/delete flow can be repeated over several input rows without copying the requests.
26. **What is the difference between HTML and JUnit reports?** — HTML is readable for a person; JUnit XML is a structured format that CI systems can consume.

### Automation, safety, and limitations

27. **What does GitHub Actions do?** — It installs dependencies, starts the memory API, waits for health, runs `test:all`, and uploads reports. A hosted pass must be confirmed from an actual GitHub run.
28. **Why use a health check and timeouts?** — Readiness prevents sending tests too early; timeouts turn a stalled endpoint into a finite failure instead of an indefinite wait.
29. **What does `test:all` do with an existing server?** — It reuses a healthy local server. If there is no listener, it starts and later stops its own backend. If a listener is occupied but unhealthy, it fails and leaves that process alone.
30. **What is mutation testing?** — It enables a deliberate fault and checks that the intended assertion fails. This provides evidence that the test can detect that kind of defect.
31. **Why is B03 a memory-mode mutation?** — It bypasses the memory repository’s application check; Mongo’s unique index is an independent mechanism and still protects Mongo writes.
32. **What are the project’s limitations?** — There is no frontend, the memory store is not persistent, the Restful-Booker proof depends on a public service, and a hosted CI result requires a connected GitHub repository.
33. **What could be improved later?** — Add authenticated user management or a frontend, expand load/security coverage, and inspect hosted CI runs after the project is connected to GitHub.

## Simple explanation of the data flow

```text
Postman/Newman request → Express route → controller → memory or Mongo repository
Postman/Newman assertion ← HTTP response ← response formatter ← controller
```

See [`architecture-explanation.md`](architecture-explanation.md) for the fuller diagram and component roles.
