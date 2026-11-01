# Test Matrix

Derived from `contract/openapi.yaml` and `contract/decisions.md`. TC01 to TC15 follow the project plan; TC16 onwards are extensions.
"Postman request" names are placeholders: the Stage 3 collection must use these TC IDs in request or test names so results trace back here.

## 1. Test cases

### Core CRUD lifecycle (chained, run in this order)

| ID | Scenario | Method and path | Expected | Key assertions |
|---|---|---|---|---|
| TC01 | Create valid student | POST /api/students | 201 | Schema valid; `data.id` is 24-hex; `student_id` saved; email lower-cased; `success` is true |
| TC02 | Get all students | GET /api/students?course={{unique_course}} | 200 | `data` is array; `count` >= 1; contains created id |
| TC03 | Get existing student | GET /api/students/{{student_id}} | 200 | `data.id` equals `student_id`; fields match what was sent |
| TC04 | Update existing student | PUT /api/students/{{student_id}} | 200 | Changed fields updated; id unchanged |
| TC27 | Update persisted | GET /api/students/{{student_id}} | 200 | Returns the updated values |
| TC26 | Timestamps on update | (uses TC03 and TC27 responses) | n/a | `createdAt` unchanged; `updatedAt` later than before |
| TC05 | Delete existing student | DELETE /api/students/{{student_id}} | 204 | Body is empty |
| TC06 | Read deleted student | GET /api/students/{{student_id}} | 404 | `error.code` = NOT_FOUND |
| TC32 | Delete twice | DELETE /api/students/{{student_id}} | 404 | `error.code` = NOT_FOUND |

### Negative and validation (each creates its own data where needed)

| ID | Scenario | Method | Expected | Key assertions |
|---|---|---|---|---|
| TC07 | Read non-existing (well-formed) id | GET | 404 | NOT_FOUND |
| TC08 | Create without name | POST | 400 | VALIDATION_ERROR; `details` names `name` |
| TC09 | Create with invalid email | POST | 400 | VALIDATION_ERROR; `details` names `email` |
| TC10 | Create with year outside 1 to 4 | POST | 400 | VALIDATION_ERROR (year 0 and year 5) |
| TC11 | Create with CGPA outside 0 to 10 | POST | 400 | VALIDATION_ERROR (-0.1 and 10.1) |
| TC12 | Create duplicate email | POST | 409 | DUPLICATE_EMAIL |
| TC13 | Update non-existing student | PUT | 404 | NOT_FOUND (valid body, well-formed id) |
| TC14 | Delete non-existing student | DELETE | 404 | NOT_FOUND |
| TC15 | Response content type | GET | 200 | `Content-Type` contains `application/json` |
| TC16 | Malformed id | GET /api/students/abc123 | 400 | INVALID_ID |
| TC17 | Malformed JSON body | POST | 400 | INVALID_JSON |
| TC18 | Unknown route | GET /api/unknown | 404 | ROUTE_NOT_FOUND; JSON content type |
| TC19 | Client-supplied id/timestamps ignored | POST with `id`, `createdAt` | 201 | Returned `id` differs from the supplied one |
| TC20 | Valid boundaries | POST | 201 | year 1 and 4; cgpa 0 and 10 all accepted |
| TC21 | Invalid boundaries | POST | 400 | year 0 and 5; cgpa -0.1 and 10.1 rejected |
| TC22 | Wrong types | POST | 400 | `year:"3"`, `cgpa:"8.1"`, `name:123` rejected |
| TC23 | Duplicate email, different case | POST | 409 | `JOHN@EXAMPLE.COM` clashes with `john@example.com` |
| TC24 | PUT with another student's email | PUT | 409 | DUPLICATE_EMAIL |
| TC25 | PUT with a missing required field | PUT | 400 | VALIDATION_ERROR |
| TC28 | Filter by course | GET ?course= | 200 | Only matching students returned |
| TC29 | Invalid pagination | GET ?limit=0, ?limit=101, ?page=0 | 400 | VALIDATION_ERROR for each |
| TC30 | Health check | GET /health | 200 | `data.status` = ok; `storage` is mongo or memory |
| TC31 | Response time | every CRUD request | n/a | Under 500 ms |
| TC33 | Data-driven run | POST, GET, DELETE per CSV row | 201, 200, 204 | One student per row, cleaned up |
| TC34 | Email normalisation | POST with `" Mixed@Case.COM "` | 201 | Stored as `mixed@case.com` |
| TC35 | Whitespace-only name | POST | 400 | VALIDATION_ERROR |

Total: 35 test cases.

## 2. Bug-injection catalogue (Stage 4)

Run the API with `INJECT_BUG=<name>` and run the full collection. The listed test(s) **must fail**, and no unrelated test should.

| Bug | `INJECT_BUG` value | What the API does wrongly | Must be caught by |
|---|---|---|---|
| B01 | `delete-returns-200` | DELETE returns 200 with a body instead of 204 | TC05 |
| B02 | `skip-email-validation` | Accepts any string as email | TC09 |
| B03 | `skip-unique-email` | Allows duplicate emails | TC12, TC23, TC24 |
| B04 | `year-upper-bound-5` | Accepts year 5 | TC10, TC21 |
| B05 | `cgpa-upper-bound-11` | Accepts cgpa up to 11 | TC11, TC21 |
| B06 | `not-found-as-200` | Missing student returns 200 with null data | TC06, TC07 |
| B07 | `update-not-persisted` | PUT replies 200 but does not save | TC27 |
| B08 | `expose-underscore-id` | Returns `_id` instead of `id` | TC01, TC03 (schema) |
| B09 | `wrong-content-type` | Returns `text/html` | TC15 |
| B10 | `slow-response` | Adds a 1500 ms delay | TC31 |
| B11 | `accept-client-id` | Honours a client-supplied id | TC19 |
| B12 | `created-at-changes-on-update` | Overwrites `createdAt` on PUT | TC26 |
| B13 | `invalid-id-as-500` | Malformed id returns 500 | TC16 |

Pass criterion for Stage 4: a table in the report showing, for each bug, the test(s) that failed in the Newman output.

## 3. Requirement traceability (starter)

| Requirement | Test cases |
|---|---|
| Create student | TC01, TC19, TC20, TC34 |
| Read all / filter / paginate | TC02, TC28, TC29 |
| Read one | TC03, TC06, TC07, TC16 |
| Update | TC04, TC13, TC24, TC25, TC26, TC27 |
| Delete | TC05, TC14, TC32 |
| Validation rules | TC08 to TC11, TC21, TC22, TC35 |
| Uniqueness | TC12, TC23, TC24 |
| Error handling and format | TC15, TC17, TC18 |
| Health and performance | TC30, TC31 |
| Data-driven | TC33 |
