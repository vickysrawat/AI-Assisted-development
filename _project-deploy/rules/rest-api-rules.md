---
paths: ["**/routes/**", "**/controllers/**", "**/api/**", "**/endpoints/**"]
detect:
  always: false
---

# REST API Rules — HTTP API design and serving conventions

> Deployed automatically alongside any backend Layer 3 language file for HTTP-based backends.
> For consuming REST APIs from the frontend see `rest-client-rules.md`.

## URL Design
- Resources are nouns, plural: `/users`, `/filter-configurations`, `/audit-logs`
- Hierarchy reflects ownership: `/users/{userId}/filters` for resources owned by a user
- No verbs in paths — the HTTP method IS the verb: `POST /users` not `POST /createUser`
- Kebab-case for multi-word path segments: `/filter-configurations` not `/filterConfigurations`
- Query parameters for filtering, sorting, pagination: `GET /users?status=active&sort=name&page=2&pageSize=25`

## Versioning
- API version in the URL path: `/api/v1/users` — never in a header or query string
- Increment the major version only on breaking changes — additive changes (new optional fields, new endpoints) do not need a version bump
- Maintain the previous version for at least one release cycle after a breaking change

## HTTP Methods
- `GET` — read only, idempotent, no request body
- `POST` — create a new resource or trigger a non-idempotent action
- `PUT` — replace a resource entirely; idempotent
- `PATCH` — partial update; idempotent
- `DELETE` — remove a resource; idempotent
- Never use `GET` for operations with side effects

## HTTP Status Codes
- `200 OK` — successful GET, PUT, PATCH, DELETE with a response body
- `201 Created` — successful POST that creates a resource; include `Location` header with the new resource URL
- `204 No Content` — successful DELETE or operation with no response body
- `400 Bad Request` — invalid request structure or validation failure
- `401 Unauthorized` — missing or invalid credentials
- `403 Forbidden` — authenticated but insufficient permission
- `404 Not Found` — resource does not exist (never use 404 to hide a resource that exists but is forbidden)
- `409 Conflict` — state conflict (duplicate key, optimistic concurrency failure)
- `422 Unprocessable Entity` — syntactically valid but semantically invalid
- `429 Too Many Requests` — rate limit exceeded; include `Retry-After` header
- `500 Internal Server Error` — unexpected server failure; log fully, return sanitized message

## Request Validation
- Validate all input at the handler boundary before any business logic
- Return `400` with a structured error body listing all validation failures — not just the first one
- Reject unknown fields (`additionalProperties: false` in schema validators) — do not silently ignore

## Response Envelope
- Success: return the resource directly or a wrapper `{ data: T }` — be consistent across all endpoints
- Error: always `{ errorCode: string, message: string, traceId: string }` — never a bare string
- Validation error: include field-level detail: `{ errorCode: 'VALIDATION_ERROR', fields: [{ field, message }] }`

## Pagination
- Cursor-based pagination for large, frequently changing datasets; offset-based for admin/reporting queries
- Always include pagination metadata in the response: `{ data: T[], total: number, page: number, pageSize: number }`
- Maximum `pageSize` enforced server-side — never trust client-provided page sizes without a cap

## Out of bounds
- No verbs in URL paths
- No 200 responses with error bodies
- No `GET` with side effects
- No unbounded list endpoints — always paginate
- No breaking changes without a version increment
