# Viva questions and short answers

1. **What is the project?** — A Student REST API and a Postman/Newman framework that validates real responses against a frozen OpenAPI contract.
2. **Why is there no frontend?** — The project scope is API implementation and automated API validation, so clients are Postman, Newman, and HTTP tools.
3. **What is REST?** — A style for resources over HTTP using methods such as GET, POST, PUT, and DELETE with standard status codes.
4. **What is an endpoint?** — An HTTP method plus a path, for example `GET /api/students/{id}`.
5. **Why does create return 201?** — The request created a new resource.
6. **Why does successful DELETE return 204?** — The deletion succeeded and the response intentionally contains no body.
7. **What is the OpenAPI file used for?** — It describes paths, statuses, parameters, and schemas; generated response schemas power checks and Ajv validates live responses.
8. **Why freeze the contract?** — It gives implementation and tests a stable, independently reviewable target.
9. **How are errors represented?** — In a consistent `{success:false,error:{code,message,details?}}` envelope.
10. **What distinguishes INVALID_ID from NOT_FOUND?** — A malformed ID is 400; a well-formed ID with no record is 404.
11. **What is D-08 ordering?** — ID format, JSON syntax, body validation, existence, then uniqueness.
12. **Why is email normalized?** — Trimming and lower-casing prevents superficial case/space differences from creating duplicate identities.
13. **Why use a Mongo unique index as well as application checks?** — Application checks provide clear errors; the database index protects against concurrent duplicate inserts.
14. **What is the in-memory fallback?** — A repository implementation used when Mongo is unset or unavailable; it keeps local/CI tests independent of a database service.
15. **How are IDs protected from leaking Mongo internals?** — Responses expose `id`; schemas reject extra student properties and Mongo contract checks recursively reject `_id`/`__v`.
16. **Why use PUT and not PATCH?** — The frozen contract defines full replacement and requires all five input fields; PATCH is out of scope.
17. **What does TC31 check?** — A collection-level assertion that each `/api/students` response is below 500 ms locally.
18. **Why is CSV data useful?** — One collection flow can be repeated with several values without duplicating requests.
19. **How does the CSV avoid collisions?** — It combines a row-specific local email name with a per-run ID and iteration index.
20. **Why clean up test data?** — Tests can be rerun and do not depend on records left by earlier runs.
21. **What is Newman?** — The command-line runner for Postman collections, useful in scripts and CI.
22. **What do HTML and JUnit reports provide?** — HTML is easy for a person to review; JUnit XML is structured for CI/test dashboards.
23. **How does CI decide whether to pass?** — Newman’s process exit code; any failed assertion makes the required step fail.
24. **What is fault injection?** — A deliberate opt-in defect used to prove that a test detects a specific regression.
25. **Why is `INJECT_BUG` absent in normal CI?** — CI must test correct behavior, not intentionally broken behavior.
26. **Why is B03 demonstrated in memory mode?** — The fault skips the memory repository’s application uniqueness check; a Mongo unique index independently rejects duplicates.
27. **Did the hosted GitHub workflow pass?** — It was not confirmed. The checkout has no remote, so no hosted run was available to inspect.
28. **What happened to the public Restful-Booker proof run?** — The current rerun failed DNS resolution for the public hostname, so no current behavior is claimed from that attempt.
