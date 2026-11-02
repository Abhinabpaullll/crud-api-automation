# Backend — Student Management API

Node.js + Express + Mongoose backend for the **CRUD API Automation and Validation Framework** academic project.

---

## Quick start

```bash
# 1. Enter the backend directory
cd backend

# 2. Copy the env example
cp .env.example .env     # or `copy .env.example .env` on Windows

# 3. (Optional) Edit .env — set MONGODB_URI if you have Mongo; leave it blank for in-memory mode

# 4. Install dependencies
npm install

# 5. Start the server
npm start
```

The server listens on **port 5000** by default (configurable via `PORT`).

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Production — `node server.js` |
| `npm run dev` | Development — `node --watch server.js` (auto-restart on file change) |
| `npm run test:contract` | Validate live API responses against OpenAPI schema (requires server running) |

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | HTTP port |
| `MONGODB_URI` | *(unset)* | Mongo connection string; unset = in-memory mode |
| `ENABLE_TEST_ROUTES` | `false` | Enable `POST /api/test/reset` |

> **Never commit `.env`** — it is in `.gitignore`.

---

## Storage modes

| Mode | When active | Health `storage` field |
|------|-------------|----------------------|
| **In-memory** | `MONGODB_URI` unset or Mongo unreachable | `"memory"` |
| **MongoDB** | `MONGODB_URI` set and reachable | `"mongo"` |

Both modes expose the same repository interface; controllers are storage-agnostic.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Readiness check |
| `POST` | `/api/students` | Create student |
| `GET` | `/api/students` | List students (filter + pagination) |
| `GET` | `/api/students/:id` | Get student by id |
| `PUT` | `/api/students/:id` | Replace student (all fields required) |
| `DELETE` | `/api/students/:id` | Delete student (204 empty body) |
| `POST` | `/api/test/reset` | Delete all students (**only when `ENABLE_TEST_ROUTES=true`**) |

Full schema in [`../docs/contract/openapi.yaml`](../docs/contract/openapi.yaml).

---

## Project layout

```
backend/
├── server.js                    # Entry point
├── package.json
├── .env.example
├── test-contract.js             # Contract smoke-test (runs against live server)
└── src/
    ├── config/
    │   ├── env.js               # Reads environment variables
    │   └── db.js                # Connects to Mongo or falls back to memory
    ├── models/
    │   ├── Student.js           # Mongoose schema
    │   ├── memoryRepository.js  # In-memory store (same interface as Mongo)
    │   └── mongoRepository.js   # Mongoose repository
    ├── controllers/
    │   ├── healthController.js
    │   ├── studentController.js
    │   └── testController.js
    ├── routes/
    │   ├── health.js
    │   ├── students.js
    │   └── test.js
    ├── middleware/
    │   └── errorHandler.js      # INVALID_JSON + INTERNAL_ERROR handlers
    └── utils/
        ├── validate.js          # Hand-written validation (D-08 to D-12)
        ├── idCheck.js           # 24-char hex id check (D-04, D-05)
        └── response.js          # Shared success / error envelope helpers
```

