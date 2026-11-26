# CRUD API Automation and Validation Framework Using Postman

[![Node.js Version](https://img.shields.io/badge/Node.js-v24.x%20%7C%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Postman](https://img.shields.io/badge/Postman-v11-FF6C37?logo=postman&logoColor=white)](https://www.postman.com/)
[![Newman](https://img.shields.io/badge/Newman-6.2.x-FF6C37?logo=postman&logoColor=white)](https://www.npmjs.com/package/newman)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0.3-6BA539?logo=openapi-initiative&logoColor=white)](https://swagger.io/specification/)
[![MongoDB / Mongoose](https://img.shields.io/badge/MongoDB-Optional%20Fallback-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An end-to-end, contract-first API development and automated testing framework built for a **Student Management REST API**. This project demonstrates how an API can be specified with a frozen OpenAPI 3.0 contract, implemented with Express and a dual-storage architecture (in-memory with optional MongoDB persistence), and validated against comprehensive test suites using Postman and Newman in CLI, HTML, and CI/CD pipelines.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Key Features](#2-key-features)
- [3. Technology Stack](#3-technology-stack)
- [4. Project Architecture](#4-project-architecture)
- [5. Folder Structure](#5-folder-structure)
- [6. API Endpoints](#6-api-endpoints)
- [7. Installation and Setup](#7-installation-and-setup)
- [8. Environment Variables](#8-environment-variables)
- [9. Running the Application](#9-running-the-application)
- [10. Running Automated Tests](#10-running-automated-tests)
- [11. Test Scenarios](#11-test-scenarios)
- [12. Sample Test Results](#12-sample-test-results)
- [13. Reports](#13-reports)
- [14. Future Improvements](#14-future-improvements)
- [15. Author](#15-author)

---

## 1. Project Overview

In production environments, APIs must strictly adhere to their published contracts to prevent breaking dependent clients. This project establishes a complete automated validation framework for a RESTful Student Management API:

1. **Contract-First Design:** The API behavior is governed strictly by [`docs/contract/openapi.yaml`](docs/contract/openapi.yaml) and frozen architectural decisions [`docs/contract/decisions.md`](docs/contract/decisions.md).
2. **Dual-Mode Repository Pattern:** Storage defaults to a self-contained in-memory store that generates 24-character hexadecimal IDs and enforces case-insensitive email uniqueness. If a MongoDB database is configured and reachable via `MONGODB_URI`, the server seamlessly connects through Mongoose; if unreachable, it safely falls back to memory storage.
3. **Automated Verification:** Comprehensive test suites validate positive CRUD paths, boundary values, strict types, case-insensitive uniqueness, error envelopes, and data-driven CSV iterations using Newman.

---

## 2. Key Features

- **Full CRUD Functionality:** Endpoints for creating, reading (single and paginated lists), updating, and deleting student records.
- **Strict Input Validation:** Enforces strict JSON types (e.g., rejecting strings like `"3"` for integer fields), inclusive range limits (`year` 1–4, `cgpa` 0.0–10.0), trimmed strings, and RFC 5322 email formatting.
- **Deterministic Check Order (D-08):** Evaluates requests in strict priority: `ID Format (400)` $\rightarrow$ `JSON Syntax (400)` $\rightarrow$ `Body Validation (400)` $\rightarrow$ `Resource Existence (404)` $\rightarrow$ `Uniqueness (409)`.
- **Case-Insensitive Uniqueness:** Normalizes and prevents duplicate email registrations across all casing variations (e.g., `JOHN@EXAMPLE.COM` clashes with `john@example.com`).
- **Standardized Response Envelopes:**
  - Success: `{ "success": true, "data": { ... } }` (List adds `count`, `total`, `page`, `limit`).
  - Error: `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`.
- **Data-Driven Testing (CSV):** Automates multi-row lifecycle validation with dynamic runtime email generation to prevent test collision.
- **Automated Schema Validation:** Compiles OpenAPI schemas with Ajv and asserts schema validity on every response.
- **Demonstration Fault Injection:** Opt-in mutations (`INJECT_BUG`) to empirically prove test suite catchability.
- **Multi-Format Reporting:** Generates interactive HTML dashboards (`htmlextra`), structured JUnit XML reports, and CLI summaries.

---

## 3. Technology Stack

| Layer / Tool | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v18+ LTS, tested on v24.19.0) | Asynchronous backend execution environment |
| **Framework** | Express.js (v4.21.x) | HTTP routing, parameter handling, and middleware |
| **Storage (Persistent)** | MongoDB & Mongoose (v8.9.x) | Document database with schema enforcement and unique indexes *(Optional)* |
| **Storage (In-Memory)** | Custom In-Memory Map | Fast, zero-dependency storage matching the repository interface |
| **Contract Specification** | OpenAPI 3.0.3 | Single source of truth for paths, parameters, and schemas |
| **Schema Validation** | Ajv (v8.x) & `ajv-formats` | JSON schema compilation and contract assertion |
| **API Testing** | Postman v2.1 Collection | Request definition, pre-request scripts, and test assertions |
| **CLI Test Runner** | Newman (v6.2.x) | Headless test execution for CLI and CI/CD pipelines |
| **Reporting** | `newman-reporter-htmlextra` | Interactive HTML reports and JUnit XML generation |
| **CI / CD** | GitHub Actions | Automated build, test, and artifact archiving on push/PR |

---

## 4. Project Architecture

The architecture decouples the HTTP layer from the data persistence mechanism through a unified Repository interface. Controllers interact strictly with the repository, remaining oblivious to whether the active backend is MongoDB or in-memory storage.

```
                           +---------------------------+
                           |  docs/contract/           |
                           |  openapi.yaml             |
                           +-------------+-------------+
                                         |
                       Contract-Driven   | Schema Compilation
                                         v
+-------------------------+       +---------------+       +-------------------------+
| Postman Collection      | ----> | Newman Runner | ----> | HTML / JUnit Reports    |
| & postman/test-data.csv |       +-------+-------+       | (reports/api, /proof)   |
+-------------------------+               |               +-------------------------+
                                          | HTTP Requests
                                          v
                              +-----------------------+
                              | Express Application   |
                              | (backend/server.js)   |
                              +-----------+-----------+
                                          |
                      +-------------------+-------------------+
                      |                                       |
                      v                                       v
          +-----------------------+               +-----------------------+
          | Memory Repository     |               | Mongoose Repository   |
          | (Default / Fallback)  |               | (When MONGODB_URI set)|
          +-----------------------+               +-----------+-----------+
                      |                                       |
                      v                                       v
          +-----------------------+               +-----------------------+
          | In-Memory JavaScript  |               | MongoDB Database      |
          | Map Store             |               | (Local or Remote)     |
          +-----------------------+               +-----------------------+
```

---

## 5. Folder Structure

```text
crud-api-automation/
├── .github/
│   └── workflows/
│       └── api-tests.yml                  # GitHub Actions CI workflow definition
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                      # Dual-mode storage connection & fallback logic
│   │   │   └── env.js                     # Environment variable parser
│   │   ├── controllers/
│   │   │   ├── healthController.js        # Health check endpoint controller
│   │   │   ├── studentController.js       # CRUD controllers implementing D-08 check order
│   │   │   └── testController.js          # Test reset controller
│   │   ├── middleware/
│   │   │   ├── errorHandler.js            # Centralized error handler (INVALID_JSON, etc.)
│   │   │   └── validateId.js              # Param-level 24-hex ID format validator
│   │   ├── models/
│   │   │   ├── Student.js                 # Mongoose schema (transforms _id to id, strips __v)
│   │   │   ├── memoryRepository.js        # In-memory store with identical interface
│   │   │   └── mongoRepository.js         # Mongoose-backed repository implementation
│   │   ├── routes/
│   │   │   ├── health.js                  # GET /health
│   │   │   ├── students.js                # /api/students routes
│   │   │   └── test.js                    # POST /api/test/reset (conditional)
│   │   └── utils/
│   │       ├── idCheck.js                 # Hex ID regular expression helper
│   │       ├── response.js                # Success and Error response envelopers
│   │       └── validate.js                # Strict type, range, and format validators
│   ├── .env.example                       # Backend environment template
│   ├── package.json                       # Backend dependencies and scripts
│   ├── server.js                          # Express application entry point
│   ├── test-contract.js                   # Live schema validator (Ajv)
│   ├── verify-fallback.js                 # Unreachable Mongo URI fallback verifier
│   └── verify.js                          # In-process 106-assertion test runner
├── docs/
│   ├── contract/
│   │   ├── decisions.md                   # Frozen architectural decisions (D-01 to D-20)
│   │   └── openapi.yaml                   # OpenAPI 3.0.3 machine-readable contract
│   ├── api-documentation.md               # Detailed API endpoint reference
│   ├── architecture-explanation.md        # Deep dive into layers and design patterns
│   ├── test-matrix.md                     # Traceability matrix for TC01–TC35
│   └── viva-questions.md                  # Comprehensive technical Q&A guide
├── postman/
│   ├── proof/
│   │   ├── Restful-Booker-Proof.postman_collection.json
│   │   └── Restful-Booker.postman_environment.json
│   ├── tools/
│   │   ├── build-collection.js            # Postman collection generator
│   │   ├── generate-openapi-schemas.js    # Schema generator from OpenAPI contract
│   │   └── run-newman.js                  # Automated Newman test executor
│   ├── Student-API-Local.postman_environment.json
│   ├── Student-CRUD-API.postman_collection.json
│   └── test-data.csv                      # Iteration dataset for data-driven testing
├── reports/
│   ├── api/                               # Newman test HTML and JUnit XML reports
│   └── proof/                             # External proof reports
├── .env.example                           # Root environment template
├── .gitignore                             # Clean exclusion rules for Node/OS/reports
├── package.json                           # Root orchestration scripts and dev dependencies
└── README.md                              # Project documentation
```

---

## 6. API Endpoints

All responses are returned as `application/json; charset=utf-8`.

| Method | Endpoint | Description | Expected Status Codes |
|---|---|---|---|
| `GET` | `/health` | Service readiness and storage mode check | `200 OK` |
| `POST` | `/api/students` | Create a new student | `201 Created`, `400 Bad Request`, `409 Conflict` |
| `GET` | `/api/students` | List students (supports `course`, `page`, `limit`) | `200 OK`, `400 Bad Request` |
| `GET` | `/api/students/:id` | Retrieve a student by 24-character hex ID | `200 OK`, `400 Bad Request`, `404 Not Found` |
| `PUT` | `/api/students/:id` | Full replacement of student details | `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict` |
| `DELETE` | `/api/students/:id` | Delete student (returns empty body) | `204 No Content`, `400 Bad Request`, `404 Not Found` |
| `POST` | `/api/test/reset` | Truncate student records *(test-support only)* | `204 No Content` (or `404 ROUTE_NOT_FOUND` if disabled) |

### Request Body Schema (`StudentInput`)

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "course": "Computer Science",
  "year": 3,
  "cgpa": 8.75
}
```

*Note: Unknown fields (such as `id`, `createdAt`, `updatedAt`) are ignored and never override server-assigned values (D-11).*

---

## 7. Installation and Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher (v24 LTS recommended)
- **npm:** v9.0.0 or higher
- **Git**

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/crud-api-automation.git
   cd crud-api-automation
   ```

2. **Install root dependencies (Newman and test tools):**
   ```bash
   npm ci
   ```

3. **Install backend dependencies (Express, Mongoose, Ajv):**
   ```bash
   npm --prefix backend ci
   ```

---

## 8. Environment Variables

Create `.env` in the repository root or configure environment variables directly. Default settings are safe for immediate execution without any external database.

```ini
# Port for the Express server (default: 5000)
PORT=5000

# MongoDB Connection String
# Leave blank/unset to use the built-in in-memory repository
MONGODB_URI=

# Enable test support routes (POST /api/test/reset)
# Set to 'true' during automated test runs; 'false' in production
ENABLE_TEST_ROUTES=true

# Fault Injection (Stage 4 demonstration only; leave unset normally)
INJECT_BUG=
```

---

## 9. Running the Application

### Option A: In-Memory Storage Mode (Recommended / Zero Config)

No database installation required. Run:

```bash
# On Linux/macOS
PORT=5000 ENABLE_TEST_ROUTES=true npm start

# On Windows (PowerShell)
$env:PORT="5000"; $env:ENABLE_TEST_ROUTES="true"; npm start
```

*Console Output:*
```text
[storage] MONGODB_URI not set — using IN-MEMORY store
[test-routes] POST /api/test/reset is ENABLED
[server] Listening on http://localhost:5000
```

### Option B: MongoDB Persistent Storage Mode

If you have a local MongoDB instance running on port 27017:

```bash
# On Linux/macOS
MONGODB_URI="mongodb://localhost:27017/student_db" npm start

# On Windows (PowerShell)
$env:MONGODB_URI="mongodb://localhost:27017/student_db"; npm start
```

*Console Output:*
```text
[storage] Connected to MongoDB
[server] Listening on http://localhost:5000
```

### Verifying Service Health

Query the readiness check endpoint:

```bash
curl -s http://localhost:5000/health
```

*Response:*
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "storage": "memory"
  }
}
```

---

## 10. Running Automated Tests

The framework provides multiple testing layers covering unit assertions, live contract validation, and complete collection automation.

```text
Test Suite Architecture:
├── 1. Unit & Repository Checks     --> node backend/verify.js (--mode=memory / --mode=mongo)
├── 2. Live Contract Validator       --> npm run test:contract:memory / test:contract:mongo
├── 3. Comprehensive Newman Suite   --> npm run test:all
│   ├── Folders 00-04 (Core CRUD)   --> npm run test:api
│   ├── Folder 05 (Data-Driven CSV) --> npm run test:data
│   └── Reset Route Verification    --> npm run test:reset-disabled
└── 4. Mutation Testing (Stage 4)   --> npm run test:mutations
```

### 1. In-Process Verification Suite (106 Assertions)

Runs 106 assertions verifying boundaries, type strictness, and check order:

```bash
# In-memory mode
node backend/verify.js --mode=memory

# MongoDB mode (spins up ephemeral mongodb-memory-server)
node backend/verify.js --mode=mongo
```

### 2. Live OpenAPI / Ajv Contract Validation

Validates live HTTP responses directly against [`docs/contract/openapi.yaml`](docs/contract/openapi.yaml):

```bash
npm run test:contract:memory
npm run test:contract:mongo
```

### 3. Full Newman Suite (CLI + Reports)

Orchestrates server launch, readiness polling, collection execution, and report generation:

```bash
npm run test:all
```

### 4. Data-Driven Testing (CSV Iterations)

Executes multi-row iteration tests driven by [`postman/test-data.csv`](postman/test-data.csv):

```bash
npm run test:data
```

### 5. Fallback Resilience Verification

Verifies that an unreachable MongoDB URI gracefully falls back to memory within 5 seconds:

```bash
node backend/verify-fallback.js
```

---

## 11. Test Scenarios

The framework implements 36 structured test cases derived from [`docs/test-matrix.md`](docs/test-matrix.md):

| Category | Test Case IDs | Key Scenarios Covered |
|---|---|---|
| **Core CRUD Lifecycle** | TC01–TC06, TC27, TC32 | 201 Create with 24-hex ID, 200 Read, 200 Update, 204 Delete (empty body), 404 on deleted resource, 404 on double deletion |
| **Timestamp Invariance** | TC26 | Verifies `createdAt` remains immutable on `PUT`, while `updatedAt` advances |
| **Strict Type Checking** | TC22 | Rejects string numbers (`"3"` for year, `"8.5"` for cgpa) and numeric names with `400 VALIDATION_ERROR` |
| **Boundary Testing** | TC10, TC11, TC20, TC21 | Validates boundary limits: year 1 and 4 accepted (0 and 5 rejected); cgpa 0.0 and 10.0 accepted (-0.1 and 10.1 rejected) |
| **Email Normalization & Duplicate Prevention** | TC12, TC23, TC24, TC34 | Trims whitespace and lowercases email; blocks duplicate emails across different casings with `409 DUPLICATE_EMAIL`; allows self-email retention on `PUT` |
| **Whitespace & Blank Fields** | TC08, TC09, TC25, TC35 | Rejects whitespace-only names and missing required fields with structured field-level error details |
| **Error Envelopes & Routing** | TC15–TC18 | Validates `400 INVALID_JSON` on malformed syntax, `400 INVALID_ID` on non-hex parameters, `404 ROUTE_NOT_FOUND` on unknown routes, and JSON Content-Type headers |
| **Pagination & Filtering** | TC02, TC28, TC29 | Case-insensitive course filtering; rejects invalid pagination (`limit=0`, `limit=101`, `page=0`) with `400 VALIDATION_ERROR` |
| **Data-Driven Execution** | TC33 | Executes iterative lifecycle tests across 8 CSV dataset rows with runtime uniqueness isolation |
| **Health & Operations** | TC30, TC31, TC36 | Validates `/health` reporting and checks local response latency (< 500 ms) |

---

## 12. Sample Test Results

The following verified results are drawn directly from the execution audit records:

### Newman Full Suite Execution (`npm run test:all`)

```text
┌─────────────────────────┬─────────────────────┬─────────────────────┐
│ Category                │ Executed            │ Failed              │
├─────────────────────────┼─────────────────────┼─────────────────────┤
│ Iterations              │ 9 (1 main + 8 CSV)  │ 0                   │
│ Requests                │ 87                  │ 0                   │
│ Test Scripts            │ 87                  │ 0                   │
│ Prerequest Scripts      │ 87                  │ 0                   │
│ Assertions              │ 340                 │ 0                   │
└─────────────────────────┴─────────────────────┴─────────────────────┘
Total run duration: 4.8s
Result: PASS (Exit Code: 0)
```

### In-Process Verification Suite (`node backend/verify.js --mode=memory`)

```text
══════════════════════════════════════════════════════════════════════
  BACKEND VERIFICATION — MODE: MEMORY
══════════════════════════════════════════════════════════════════════
  ✓  TC30: GET /health returns 200 with storage "memory"
  ✓  TC01: POST /api/students returns 201 with 24-hex id (no _id, no __v)
  ✓  TC19: Client-supplied id and timestamps are ignored
  ✓  TC34: Email " Mixed@Case.COM " normalized to "mixed@case.com"
  ✓  TC02: GET /api/students?course=CSE returns matching array
  ✓  TC03: GET /api/students/:id returns single student
  ✓  TC04: PUT /api/students/:id updates record
  ✓  TC26: createdAt preserved, updatedAt updated
  ✓  TC05: DELETE returns 204 with truly empty body
  ✓  TC06: GET on deleted student returns 404 NOT_FOUND
  ✓  TC16: GET /api/students/abc123 returns 400 INVALID_ID
  ✓  D-08: PUT /api/students/bad-id with malformed body returns INVALID_ID first
  ✓  TC17: POST with malformed JSON returns 400 INVALID_JSON
  ✓  TC12: Duplicate email returns 409 DUPLICATE_EMAIL
  ✓  TC23: Duplicate email with differing case returns 409 DUPLICATE_EMAIL
  ✓  TC20: Boundaries (year 1, 4; cgpa 0, 10) accepted with 201
  ✓  TC21: Boundaries (year 0, 5; cgpa -0.1, 10.1) rejected with 400
  ✓  TC22: Wrong types (year:"3", cgpa:"8.1", name:123) rejected with 400
  ✓  TC29: Invalid pagination (limit=0, limit=101, page=0) rejected with 400
  ✓  D-17: POST /api/test/reset returns 204 and clears database
══════════════════════════════════════════════════════════════════════
  RESULTS: 106 passed   0 failed
══════════════════════════════════════════════════════════════════════
```

### Live Contract Validation (`npm run test:contract:memory`)

```text
=== Contract validation against live server ===
[contract] Loading schema from: docs/contract/openapi.yaml
[contract] Schemas loaded and $refs resolved

  ✓ GET /health schema valid (HealthResponse)
  ✓ POST /api/students (201) schema valid (StudentResponse)
  ✓ GET /api/students (200) schema valid (StudentListResponse)
  ✓ GET /api/students/:id (200) schema valid (StudentResponse)
  ✓ PUT /api/students/:id (200) schema valid (StudentResponse)
  ✓ Error responses schema valid (ErrorResponse for 400, 404, 409)
  ✓ All items contain 24-character hexadecimal IDs
  ✓ Zero instances of internal database fields (_id, __v)

=== Results: 66 passed, 0 failed ===
```

---

## 13. Reports

Automated test executions produce structured reports saved in the [`reports/`](reports/) directory:

- **Interactive HTML Report (`reports/api/api-report.html`):** Visual dashboard generated via `newman-reporter-htmlextra` detailing individual HTTP requests, latency, headers, request/response bodies, and assertion outcomes.
- **Data-Driven Report (`reports/api/data-report.html`):** Iteration breakdown of CSV-driven student lifecycle tests.
- **JUnit XML (`reports/api/api-junit.xml`):** Standardized test report format consumed by CI/CD engines for pass/fail analytics.
- **Proof Run Reports (`reports/proof/`):** Independent validation results from the external public API proof exercise.

---

## 14. Future Improvements

- [ ] **Authentication & Authorization:** Add JWT-based Bearer token authentication and Role-Based Access Control (RBAC) (e.g., Student vs. Registrar permissions).
- [ ] **Partial Updates (`PATCH`):** Implement RFC 7396 JSON Merge Patch support for updating specific student fields without requiring full entity replacement.
- [ ] **Advanced Query Capabilities:** Support sorting (`sort=name:asc`), field projection (`fields=name,cgpa`), and multi-field filtering.
- [ ] **Rate Limiting & Security Headers:** Integrate `express-rate-limit` to prevent DoS abuse and `helmet` for secure HTTP header hardening.
- [ ] **Dockerization:** Provide a `Dockerfile` and `docker-compose.yml` defining an isolated multi-container setup with MongoDB and Newman test sidecars.

---

## 15. Author

- **Academic Project:** CRUD API Automation and Validation Framework Using Postman
- **Repository:** [`crud-api-automation`](https://github.com/<your-username>/crud-api-automation)
- **Specification:** Academic Term Project & Software Testing Demonstration
