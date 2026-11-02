# Project demonstration script (about 8 minutes)

## Before the demo

- Install root and backend dependencies with `npm ci` and `npm --prefix backend ci`.
- Start the API with `PORT=5000`, empty `MONGODB_URI`, and `ENABLE_TEST_ROUTES=true`.
- Keep Postman open with the `Student-API-Local` environment selected.
- Ensure the live server is ready at `/health`.

## Walkthrough

1. **Introduce the goal (45 sec).** Explain that this project tests a Student API against a frozen OpenAPI contract and has no frontend.
2. **Show the contract (60 sec).** Open `docs/contract/openapi.yaml`; point out `POST /api/students`, the student schema, success/error statuses, and 204 empty-body rule.
3. **Show readiness and create (90 sec).** In Postman, run TC30 then TC01. Show status `201`, returned 24-hex `id`, normalized email, and timestamps.
4. **Show chained lifecycle (90 sec).** Run TC02–TC06 and TC32. Explain that the collection saves the ID, verifies the update, then checks deletion and the second delete.
5. **Show validation and uniqueness (90 sec).** Run TC09, TC10, TC12, TC23, and TC24. Point to exact statuses, codes, and field details.
6. **Show data-driven execution (60 sec).** Run `npm run test:data`; explain the eight CSV rows, iteration index, and cleanup.
7. **Show Newman reports (60 sec).** Run `npm run test:all`; open `reports/api/api-report.html` or the JUnit XML. Explain zero failures and exit code 0.
8. **Show fault detection (60 sec).** Run `npm run test:mutations`. Point out B01 causes TC05 to fail and the restored folder passes.
9. **Close with CI and scope (45 sec).** Show the workflow and explain the user must push to GitHub before an Actions run can be inspected. Mention Mongo uses an isolated test server.

## Expected explanation

“The contract is the expected behavior. Newman sends real HTTP requests and checks status, headers, response fields, and schemas. Each test uses controlled data and cleans up. The CI job repeats the same checks automatically. Mutation cases demonstrate that specific assertions fail when known defects are introduced.”
