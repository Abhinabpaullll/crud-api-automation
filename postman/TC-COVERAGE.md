# Test case coverage

| ID | Postman request name or collection-level assertion |
|---|---|
| TC01 | `TC01 Create valid student` |
| TC02 | `TC02 Get filtered students includes created ID` |
| TC03 | `TC03 Get existing student` |
| TC04 | `TC04 Update existing student` |
| TC05 | `TC05 Delete existing student` |
| TC06 | `TC06 Get deleted student` |
| TC07 | `TC07 Get non-existing valid ID` |
| TC08 | `TC08 Create without name` |
| TC09 | `TC09 Invalid email` |
| TC10 | `TC10 Invalid year 0`; `TC10 Invalid year 5` |
| TC11 | `TC11 Invalid CGPA -0.1`; `TC11 Invalid CGPA 10.1` |
| TC12 | `TC12 Reject duplicate email` (seed and cleanup requests are also labelled TC12) |
| TC13 | `TC13 Update non-existing student` |
| TC14 | `TC14 Delete non-existing student` |
| TC15 | `TC15 JSON response Content-Type` |
| TC16 | `TC16 Malformed student ID` |
| TC17 | `TC17 Malformed JSON body` |
| TC18 | `TC18 Unknown route` |
| TC19 | `TC19 Client id and timestamps ignored` |
| TC20 | `TC20 Valid boundaries year 1 cgpa 0`; `TC20 Valid boundaries year 4 cgpa 10` |
| TC21 | `TC21 Invalid boundaries year 0`; `TC21 Invalid boundaries year 5`; `TC21 Invalid boundaries CGPA -0.1`; `TC21 Invalid boundaries CGPA 10.1` |
| TC22 | `TC22 Wrong field types` |
| TC23 | `TC23 Reject different-case email` (seed and cleanup requests are also labelled TC23) |
| TC24 | `TC24 Reject PUT with another student email` (two seed and two cleanup requests are also labelled TC24) |
| TC25 | `TC25 PUT missing required field` |
| TC26 | `TC04 Update existing student` test `TC26: createdAt unchanged and updatedAt advances` |
| TC27 | `TC27 Update persisted` |
| TC28 | `TC28 Filter by course` |
| TC29 | `TC29 Invalid pagination 1`; `TC29 Invalid pagination 2`; `TC29 Invalid pagination 3` |
| TC30 | `TC30 Health readiness` |
| TC31 | Collection-level test script: `TC31: CRUD response under 500 ms`, applied to each request whose URL contains `/api/students` |
| TC32 | `TC32 Delete twice` |
| TC33 | `TC33 Create row from CSV`; `TC33 Get CSV-created row`; `TC33 Cleanup CSV-created row` (run once for every CSV row) |
| TC34 | `TC34 Email trim and lowercase` |
| TC35 | `TC35 Whitespace-only name` |

The additional `TC36 Test reset route mode` checks the test-support endpoint in both enabled and disabled server configurations.
