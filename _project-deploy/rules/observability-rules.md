---
paths: ["**/logging/**", "**/telemetry/**", "**/middleware/**", "**/filters/**"]
detect:
  always: false
---

# Observability Rules — Structured logging, distributed tracing, metrics, and health checks

> Deployed automatically alongside any backend Layer 3 language file.
> Covers the principles; language-specific libraries (Serilog, structlog, Pino) are in the Layer 3 file.

## Structured Logging
- JSON-format structured logs only — never free-text log messages in production
- Every log entry includes at minimum: `timestamp` (ISO 8601), `level`, `service`, `operation`, `traceId`
- Log levels used correctly:
  - `trace` / `verbose` — per-field execution detail (disabled in production by default)
  - `debug` — diagnostic information useful during development
  - `info` — normal application flow milestones (request received, operation completed)
  - `warn` — recoverable issue that may need attention (retry succeeded, fallback used)
  - `error` — an operation failed and requires investigation; always include full exception detail
- Never log PII, credentials, tokens, or full request/response bodies — log identifiers and outcomes only
- Parameterised log messages — no string interpolation of variables into the message template:
  - Correct: `log.info("User {UserId} updated filter {FilterId}", userId, filterId)`
  - Wrong: `log.info($"User {userId} updated filter {filterId}")`

## Distributed Tracing
- `traceId` and `spanId` propagated on every inbound request — extracted from `traceparent` header (W3C Trace Context)
- Generate a new `traceId` if none is present in the incoming request
- `traceId` included in every log entry and every error response body — enables correlation across services and log aggregators
- Outbound HTTP calls injected with the current trace context — never start a child span without propagating the parent

## Request Logging
- Log every inbound request: `{ method, path, statusCode, durationMs, traceId, userId }`
- Log at `info` level on success; `warn` on 4xx (client error); `error` on 5xx (server error)
- Sensitive path parameters (e.g. `/users/{userId}`) logged as-is — sensitive query params (e.g. `?token=`) masked
- Response body never logged — response status and size are sufficient

## Metrics
- Expose a metrics endpoint (`/metrics` in Prometheus format or equivalent) — consumed by the monitoring system
- Standard metrics at minimum: request count by route + status, request duration (histogram), error rate, DB query duration
- Custom business metrics for key operations: records created, jobs processed, cache hit/miss ratio
- Metric labels (dimensions) kept low-cardinality — never use user IDs or request IDs as labels

## Health Checks
- `/health` or `/healthz` endpoint returning `200 OK` when all critical dependencies are reachable
- `/health/ready` (readiness) separate from `/health/live` (liveness) for Kubernetes deployments
- Health endpoint checks: DB connectivity, cache connectivity, downstream service reachability
- Health endpoint requires no authentication — monitoring systems must be able to call it without tokens
- Never include sensitive connection details in the health response body

## Alerting Considerations
- Log errors at `error` level only when human action may be required — avoid alert fatigue from noisy warns
- Include enough context in `error` logs to diagnose without needing to reproduce: `{ operation, input summary, exception type, message, stacktrace }`
- Do not swallow exceptions silently — every caught exception either handled or logged + re-thrown

## Out of bounds
- No free-text log messages in production — structured JSON only
- No PII in log entries
- No string interpolation in log message templates
- No requests without a `traceId`
- No health endpoint behind authentication
