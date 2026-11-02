# Student Management API reference

The OpenAPI file is the complete machine-readable contract: [`contract/openapi.yaml`](contract/openapi.yaml). This page is a beginner-oriented quick reference. Base URL defaults to `http://localhost:5000`.

## Student input

```json
{
  "name": "Ava Thompson",
  "email": "ava@example.com",
  "course": "CSE",
  "year": 2,
  "cgpa": 8.4
}
```

All five fields are required for both `POST` and `PUT`. `year` must be a JSON integer, and `cgpa` must be a JSON number. Names, courses, and email are trimmed. Email is lower-cased before storage. Unknown properties are ignored.

## Endpoints

| Method and path | Success response | Errors / behavior |
|---|---|---|
| `GET /health` | `200`, `HealthResponse` | `data.storage` is `memory` or `mongo`. |
| `POST /api/students` | `201`, `StudentResponse` | `400 VALIDATION_ERROR` or `409 DUPLICATE_EMAIL`. |
| `GET /api/students` | `200`, `StudentListResponse` | `400 VALIDATION_ERROR` for invalid page/limit. Supports `course`, `page`, `limit`. |
| `GET /api/students/{id}` | `200`, `StudentResponse` | `400 INVALID_ID`; `404 NOT_FOUND`. |
| `PUT /api/students/{id}` | `200`, `StudentResponse` | `400 INVALID_ID` / `VALIDATION_ERROR`; `404 NOT_FOUND`; `409 DUPLICATE_EMAIL`. Full replacement. |
| `DELETE /api/students/{id}` | `204`, empty body | `400 INVALID_ID`; `404 NOT_FOUND`. |
| `POST /api/test/reset` | `204`, empty body | Exists only with `ENABLE_TEST_ROUTES=true`; otherwise `404 ROUTE_NOT_FOUND`. |

## List parameters

- `course`: case-insensitive exact match.
- `page`: positive integer, defaults to 1.
- `limit`: integer from 1 to 100, defaults to 10.

Examples:

```text
GET /api/students?course=cse
GET /api/students?page=2&limit=25
```

## Response shapes

Success responses use `{ "success": true, "data": ... }`. List responses also contain `count`, `total`, `page`, and `limit`. Each student exposes `id`, `name`, `email`, `course`, `year`, `cgpa`, `createdAt`, and `updatedAt`; Mongo internals are not public fields.

Error responses use `{ "success": false, "error": { "code", "message", "details?" } }`. Validation details contain `field` and `message`.

## Important behavior

- IDs are 24 lowercase hexadecimal characters in either storage mode.
- `createdAt` is set on creation and stays unchanged on successful updates; `updatedAt` advances on each successful `PUT`.
- D-08 precedence is ID format → JSON syntax → body validation → existence → uniqueness.
- All error and success JSON responses use `application/json; charset=utf-8`.
- `DELETE` success has no body.
