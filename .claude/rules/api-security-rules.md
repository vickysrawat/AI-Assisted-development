---
paths: ["**/middleware/**", "**/filters/**", "**/interceptors/**", "**/controllers/**"]
detect:
  always: false
---

# API Security Rules — Attack surface, OWASP top 10, and defence in depth

> Deployed automatically alongside any backend Layer 3 language file.
> Covers the attack surface of the API: what threats it defends against.
> For identity and access control see `auth-rules.md`.

## Injection Prevention (OWASP A03)
- Parameterised queries / ORM for all database access — no string-concatenated SQL ever
- Never pass user input to: `eval()`, `exec()`, `subprocess(shell=True)`, `child_process.exec()`, or equivalent
- HTML-encode all user-supplied content rendered in responses
- File paths derived from user input validated against an allowlist — never `path.join(baseDir, userInput)` directly

## Broken Access Control (OWASP A01)
- Enforce access control server-side on every request — never rely on client-side hiding
- Resource-level checks: verify the authenticated user owns or has permission for the specific record
- Directory traversal prevention: resolved file paths must start with the allowed base directory
- `CORS` policy: explicit allowlist of origins — never `Access-Control-Allow-Origin: *` for authenticated APIs

## Security Misconfiguration (OWASP A05)
- Remove all debug endpoints, stack traces, and detailed error messages from production responses
- HTTP security headers on every response:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (or `Content-Security-Policy: frame-ancestors 'none'`)
  - `Referrer-Policy: strict-origin-when-cross-origin`
- Disable unused HTTP methods at the router level — if only `GET` and `POST` are used, block `PUT`, `DELETE`, etc.

## Rate Limiting and DoS Prevention (OWASP A04 adjacent)
- Rate limiting on all public endpoints and auth endpoints — stricter limits on login (`5 req/min`)
- Request body size limit enforced — never accept unbounded payloads
- Timeout on all outbound HTTP calls — never allow downstream slowness to exhaust thread/connection pool
- `Retry-After` header returned on `429` responses

## Secrets Management (OWASP A02 adjacent)
- No secrets in source code, config files, or environment files committed to the repo
- Secrets via a managed store (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets on a schedule and immediately on suspected compromise
- Never log secrets, tokens, or API keys — log only metadata (`secret_name_used`, `key_id`)

## Input Validation and Sanitisation (OWASP A03)
- Validate all input at the boundary: type, length, format, and allowed values
- Reject (not sanitise) inputs that fail validation — sanitisation-as-defence is a secondary layer, not a substitute
- `additionalProperties: false` on JSON schema validators — reject unknown fields
- File uploads: validate MIME type via magic bytes, not file extension; scan for malware where required

## Dependency Security (OWASP A06)
- `npm audit` / `dotnet list package --vulnerable` / `safety check` in CI — block on critical and high findings
- Pin dependency versions — no open ranges (`^`, `~`) for direct dependencies in production code
- Review dependencies before adding — prefer well-maintained packages with few transitive dependencies

## Out of bounds
- No string-concatenated SQL
- No `Access-Control-Allow-Origin: *` on authenticated APIs
- No stack traces or internal error details in API responses
- No secrets in source or committed config files
- No file paths constructed from user input without allowlist validation
