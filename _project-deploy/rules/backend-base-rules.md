---
paths: ["**/*.cs", "**/*.ts", "**/*.py", "**/*.java"]
detect:
  always: false
---

# Backend Base Rules — Universal guardrails for all backend projects

> Deployed automatically alongside any backend Layer 3 language file.
> These rules apply regardless of language, framework, or protocol.

## Architecture
- Thin handler/controller: bind + validate input, call a service, map the response — no business logic in the handler layer
- Service layer owns all business logic — stateless, testable, framework-independent
- Data-access layer owns all persistence — never mix SQL/ORM calls with business logic

## Secrets and Configuration
- No secrets, connection strings, API keys, or credentials hardcoded anywhere in source
- All configuration read from environment variables or a secrets manager (Azure Key Vault, AWS Secrets Manager)
- `.env` files are for local development only — never committed to the repository
- Configuration validated at startup — fail fast with a clear error if required env vars are missing

## Error Responses
- Structured error response on every failure — never return a raw exception message or stack trace
- Consistent error envelope across all endpoints: `{ errorCode, message, traceId }` (or equivalent per project standard)
- Status codes semantically correct — 4xx for client errors, 5xx for server errors; never 200 with an error body

## Security Defaults
- All endpoints require authentication unless explicitly marked public
- Input validated at the boundary before any business logic runs
- Parameterised queries / ORM for all database access — no string-concatenated SQL
- No `eval()`, `exec()`, `shell=True`, or equivalent dynamic code execution on user input

## Logging
- Structured logging only — JSON-format log entries with at minimum: `timestamp`, `level`, `service`, `operation`, `traceId`
- Never log PII, secrets, tokens, or full request/response bodies
- Log at appropriate levels: `info` for normal flow, `warn` for recoverable issues, `error` for exceptions with full context

## Observability
- Every inbound request logged with: method, path, status, duration, traceId
- Unhandled exceptions caught at the framework boundary — logged and converted to a 500 response
- Health endpoint (`/health` or `/healthz`) returning 200 when the service is up — no auth required on this endpoint

## Testing
- Each ICEA Acceptance Criterion covered by at least one test
- Always test: happy path, validation error, not-found, and permission boundary
- No secrets in test configuration — use mock credentials or a test-specific secret store

## See also
- `rest-api-rules.md` — HTTP design conventions (deployed with HTTP-based backends)
- `auth-rules.md` — authentication and authorisation patterns
- `api-security-rules.md` — OWASP and attack surface rules
- `data-access-rules.md` — data access patterns
- `observability-rules.md` — structured logging and tracing detail
- `testing-backend-rules.md` — test strategy and patterns
