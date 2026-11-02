# Project report and audit record

## Project summary

The project implements a Student Management API and an independent Postman/Newman test framework. The frozen OpenAPI contract defines behavior; response schemas are generated from that file and validated against live responses. Storage can use MongoDB/Mongoose or the in-memory fallback.

## Initial repository audit

This table records the state found before this documentation pass.

| Component | Actual state | Evidence | Missing work at audit | Recommended action |
|---|---|---|---|---|
| Git | On `main`; clean before this pass; latest known commits were present. No remote configured. | `git status`, `git log -6`; `git remote` returned no remotes. | No hosted Actions run could be inspected. | Keep working locally on `main`; give the user repository/push instructions. |
| Root README | Missing. | `Get-Content README.md` reported path not found. | Project overview and setup guide. | Create root README. |
| Root npm scripts | Present: proof, collection/schema generation, API/data/all, and reset-disabled commands. Root lockfile present. | `package.json`, `package-lock.json`. | Convenient Mongo, contract, and mutation commands. | Add scripts for reproducible verification. |
| Backend | Express app, memory/Mongo repositories, `verify.js`, `verify-fallback.js`, and `test-contract.js` present. No fault injection implementation existed. | `backend/server.js`, `backend/src/`, verification scripts, backend lockfile. | Five Stage 4 mutations. | Implement opt-in startup fault hooks and test each expected TC. |
| Frozen contract and matrix | Present. Contract is marked frozen. | `docs/contract/openapi.yaml`, `decisions.md`, `docs/test-matrix.md`. | No change needed. | Keep these as the source of truth. |
| Postman suite | Collection, environment, CSV, schema tools, and TC coverage table present. TC25 depended on lifecycle state; TC28 could pass with an empty list; TC15 checked only successful content type. | Collection request/test scripts and `postman/tools/build-collection.js`. | Make TC15 cover error content type; make TC25 and TC28 self-contained. | Strengthen those checks without changing the contract. |
| CI workflow | Present and references root/backend `npm ci`, Node 24, memory backend, health wait, `test:all`, and always-uploaded reports. No bug variable is set. | `.github/workflows/api-tests.yml`; both lockfiles exist. | No GitHub run is available. | Keep workflow free of mutations; inspect after user pushes. |
| Documentation | Only contract files and `test-matrix.md` existed under `docs/`; no root README. | `rg --files docs`; root listing. | Requirements, API guide, strategy, test cases, report, tutorial, viva, demo, screenshot, GitHub guide. | Add the requested learner-focused documents. |
| Reports and proof exercise | API and proof HTML/JUnit report files were physically present; generated outputs are ignored by `.gitignore`. Proof collection/environment/notes exist. | `Get-ChildItem reports`; `postman/proof/`. | Current Restful-Booker reachability needed checking. | Preserve proof assets and run it once; report network limits honestly. |
| Ignore rules | `.env`, local environment variants, logs, dependencies, and generated reports are ignored. | `.gitignore`. | No change needed. | Keep credentials and generated output out of Git. |

## Verification results

All commands ran on Node `v24.19.0`, npm `11.17.0`. Local HTTP checks used high ports because port 5000 was occupied in this environment. Raw logs are under `reports/api/` and are ignored by Git.

| Check | Result | Evidence |
|---|---|---|
| Normal Newman baseline, memory, run 1 | PASS, exit 0; 60 + 24 + 3 requests, 340 assertions, zero failed. | `reports/api/normal-baseline-1.txt` |
| Normal Newman baseline, memory, run 2 | PASS, exit 0; same counts. | `reports/api/normal-baseline-2.txt` |
| Full Newman suite, Mongo mode | PASS, exit 0; 60 + 24 + 3 requests, 340 assertions, zero failed. | `reports/api/final-newman-mongo.txt` |
| Backend `verify.js`, memory | PASS, 106 passed, 0 failed. | `reports/api/final-verify-memory.txt` |
| Backend `verify.js`, Mongo | PASS, 106 passed, 0 failed. | `reports/api/final-verify-mongo.txt` |
| Live OpenAPI/Ajv contract test, memory | PASS, 66 passed, 0 failed. | `reports/api/final-contract-memory.txt` |
| Live OpenAPI/Ajv contract test, Mongo | PASS, 86 passed, 0 failed, including recursive `_id`/`__v` checks. | `reports/api/final-contract-mongo.txt` |
| Unreachable Mongo fallback | PASS, `mongodb://127.0.0.1:1/x`; health returned `storage: memory` in 2,778 ms (5,000 ms limit). | `reports/api/audit-fallback.txt` |
| Postman JSON/schema generation | PASS; six OpenAPI response schemas compile with Ajv; Newman parses the collection and environment in the live runs. | `npm run collection:generate`, Newman logs. |
| Restful-Booker proof run | PASS after retry with external network access; 19 requests and 54 assertions, zero failures. The initial sandboxed attempt failed DNS resolution and is not used as behavior evidence. | `reports/api/audit-proof-run-elevated.txt` |
| GitHub Actions | NOT RUN remotely. | No Git remote configured; workflow was audited locally only. |

The Newman totals include TC31’s collection-level latency checks. The data folder ran eight CSV iterations, each with create/get/delete and cleanup.

## Mutation results

For each fault, the mutation runner first ran a full normal `npm run test:all` baseline (60 + 24 + 3 requests, 340 assertions, zero failures). It then created a fresh memory-mode backend for that fault, checked the listed failures, and started a clean server to rerun the affected folder. All five per-bug baselines and all five restored folders passed. B03 is deliberately injected in the memory repository; MongoDB’s unique index remains a separate enforcement layer and cannot be bypassed by that application-level mutation.

| Bug | Injected behavior | Expected failing TCs | Actual failing TCs | Unrelated failures | Result |
|---|---|---|---|---|---|
| B01 `delete-returns-200` | Successful delete returns 200 with a body. | TC05 | TC05 | None | PASS; restored folder exit 0. |
| B02 `skip-email-validation` | Skips email format/length validation for non-empty email strings. | TC09 | TC09 | None | PASS; restored folder exit 0. |
| B03 `skip-unique-email` | Skips app-level unique email checks in memory mode. | TC12, TC23, TC24 | TC12, TC23, TC24 | None | PASS; restored folder exit 0. |
| B04 `year-upper-bound-5` | Allows year 5 in the memory-mode validator. | TC10, TC21 | TC10, TC21 | None | PASS; restored folder exit 0. |
| B09 `wrong-content-type` | Sends JSON error bodies with `text/html`. | TC15 | TC15, TC18 | None; TC18 independently checks the same error-header rule. | PASS; restored folder exit 0. |

Raw per-bug baseline logs are `reports/api/baseline-B01.log`, `baseline-B02.log`, `baseline-B03.log`, `baseline-B04.log`, and `baseline-B09.log`. Mutation and restoration logs use the corresponding `mutation-Bxx.log` and `restored-Bxx.log` names. The aggregate command output is `reports/api/bug-mutations-final.txt`.

## Findings and corrections

- The frozen API contract and normal backend responses agreed in both storage modes for the exercised statuses, including `409 DUPLICATE_EMAIL` and empty `204` responses.
- TC15 originally checked only a successful JSON response. An error-response content-type request was added under TC15 so the documented B09 mutation is directly caught. TC18 also catches it, as expected from its own error-header assertion.
- TC25 originally reused the main lifecycle `student_id`; it now creates and cleans up its own target record.
- TC28 originally allowed an empty result to satisfy `every(...)`; it now seeds one matching and one non-matching student, asserts the matching record is present and all results match, and cleans up both records.
- No OpenAPI or frozen decision changes were made.
- The first sandboxed Restful-Booker attempt could not resolve the host; the elevated retry reached the API and all 54 assertions passed. Existing proof files were not modified.
- GitHub Actions could not be confirmed in a hosted runner because this repository has no remote configured. See [`github-actions-guide.md`](github-actions-guide.md).
