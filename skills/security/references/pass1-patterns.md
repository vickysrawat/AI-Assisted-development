# Security Skill — Pass 1 Structured Patterns
_Loaded during Pass 1 of the three-pass scan architecture._
_Stack-agnostic patterns. Language-specific patterns are in pass1-patterns-{lang}.md files._

---

## Purpose

These are deterministic, rule-based security patterns for Pass 1. Each pattern
has a known vulnerability class, a detection heuristic, and a concrete fix
template. The same code should always produce the same finding.

For language-specific patterns, load the matching `pass1-patterns-{lang}.md`
based on detected stack (see `../../shared/three-pass-spec.md` § Stack-agnostic loading).

---

## Pattern Categories

### SEC-INJ — Injection (CWE-89, 77, 94, 90, 643)

Scan for user-controlled input reaching:
- SQL queries without parameterization
- OS command execution (exec, spawn, system, Process.Start)
- Template engines without escaping
- LDAP queries with string concatenation
- XPath queries with string concatenation
- NoSQL queries with object injection

Severity: High-Critical depending on auth requirements and data sensitivity.

### SEC-AUTH — Broken Authentication (CWE-287, 384, 306)

Scan for:
- Endpoints with no authentication middleware or decorator
- Session tokens in URLs or query parameters
- Missing session invalidation on logout
- Hardcoded credentials or default passwords
- Password comparison without constant-time comparison
- Missing multi-factor enforcement on sensitive operations

Severity: High-Critical.

### SEC-AUTHZ — Broken Access Control / IDOR (CWE-639, 862, 863)

Scan for:
- User identity derived from URL path or query parameter (not session)
- Object IDs in URLs with no visible ownership check on the server
- /whoami or /me endpoint used as auth substitute (identification, not authorization)
- Missing role checks on admin or privileged endpoints
- Client-side role enforcement without server-side validation
- Horizontal privilege escalation (user A accessing user B's resources)

Title guidance: "Username exposed in URL path", "User ID controllable by client"
— not "IDOR via username parameter".

Severity: Medium-Critical depending on data sensitivity.

### SEC-DATA — Sensitive Data Exposure (CWE-312, 326, 798, 209)

Scan for:
- Secrets in source code: API keys, passwords, tokens, connection strings
- Weak or deprecated cryptographic algorithms (MD5, SHA1 for passwords, DES, RC4)
- Missing TLS enforcement (HTTP links, missing HSTS)
- Sensitive data in error messages or stack traces
- PII logged to console, files, or external services
- Sensitive data in localStorage/sessionStorage without encryption

Severity: Medium-Critical. Secrets in code = Critical. Weak crypto = High.

### SEC-CONFIG — Security Misconfiguration (CWE-16)

Scan for:
- Debug mode enabled in production configs
- Verbose error messages exposing internals
- Permissive CORS (Access-Control-Allow-Origin: *)
- Missing security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Directory listing enabled
- Default accounts or credentials in configuration
- Missing cookie flags (Secure, HttpOnly, SameSite)

Severity: Low-High depending on exposure.

### SEC-DESER — Insecure Deserialization (CWE-502)

Scan for:
- JSON.parse of untrusted data without try/catch (CWE-20)
- Parsed JSON applied directly to framework APIs without schema validation
  (e.g., grid column state, filter models, form patchValue)
- Deserialization of user-controlled types (BinaryFormatter, pickle, yaml.load)
- Prototype pollution via user-controlled object keys (Node.js)

Severity: Medium-High. Type-controlled deserialization = Critical.

### SEC-SSRF — Server-Side Request Forgery (CWE-918)

Scan for:
- User-controlled URLs passed to HTTP client (fetch, HttpClient, requests.get)
- Missing URL allowlist or scheme validation
- Internal service URLs constructable from user input

Severity: High.

### SEC-XXE — XML External Entity (CWE-611)

Scan for:
- XML parsers with external entity processing enabled
- DTD processing not explicitly disabled
- XmlReader/XmlDocument without secure settings

Severity: High.

### SEC-DOM — Client-Side DOM Security (CWE-79, 749)

Scan for:
- Direct DOM manipulation bypassing framework (document.querySelector, .innerHTML)
- DomSanitizer.bypassSecurityTrust* usage
- [innerHTML] binding with unsanitized data
- window.prompt/confirm for user input (unsanitized, blockable)
- Unescaped user data in template interpolation

Severity: Medium-High.

### SEC-EXPORT — Unscoped Data Export (CWE-359)

Scan for:
- Export functions (CSV, Excel, PDF) iterating full data array instead of filtered view
- Missing server-side audit logging of export events
- Bulk data endpoints with no pagination or rate limiting

Severity: Low-Medium. Escalate if dataset contains B1-B7 data.

### SEC-AUDIT — Missing Audit Logging (CWE-778)

Scan for:
- Sensitive data access with no backend logging
- Mutations (create/update/delete) with no audit trail
- Missing who/when/what for data access events
- Logging sensitive data values instead of access metadata

Severity: Low-Medium. Escalate to Medium-High under compliance frameworks.

### SEC-RATE — Missing Rate Limiting (CWE-400, 799)

Scan for:
- Authentication endpoints with no rate limiting
- Large dataset endpoints with no caching or pagination
- Client-side code re-fetching on every interaction without caching
- File upload endpoints with no size limits

Severity: Low-Medium (Informational for non-auth endpoints).

### SEC-CONSOLE — Production Console Logging (CWE-209)

Scan for:
- console.log/console.error with user data or error objects in production code
- Error objects exposing response bodies, API URLs, headers, stack traces
- PII visible in browser DevTools

Severity: Low-Medium. Escalate if data includes B1-B7 categories.

### SEC-DEPS — Vulnerable Dependencies

Flag when dependency manifests are present but show signals of vulnerability:
- Known-vulnerable package versions (if detectable from manifest)
- Wildcard or unpinned version ranges
- No lockfile present
- Recommend appropriate audit tool:
  - npm/yarn: `npm audit`
  - pip: `pip-audit`, `safety`
  - .NET: `dotnet list package --vulnerable`
  - Java: `mvn dependency-check:check`
  - General: `trivy fs .`

Severity: Informational (tool recommendation, not a source-level finding).

### SEC-GITIGNORE — Sensitive Files Not Ignored

Check `.gitignore` coverage for sensitive file patterns:
- `.env`, `.env.local`, `.env.production`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- `appsettings.json`, `appsettings.Production.json`
- `secrets.json`
- `.claude/settings.json`, `.claude/settings.local.json`
- `.claude/file-cache.json`

Any file that exists AND is not gitignored AND contains sensitive data = finding.

Severity: Low-High depending on file contents.

---

## Severity calibration

CVSS provides the mathematical baseline. Business context can escalate (never
downgrade) from the CVSS score. Per `../../shared/business-context-severity.md`:

| Technical severity | CVSS range | Examples |
|---|---|---|
| Critical | 9.0-10.0 (or B1-B7 override) | RCE, auth bypass, mass data exposure, privileged data |
| High | 7.0-8.9 | SQLi, privilege escalation, significant data exposure |
| Medium | 4.0-6.9 | Stored XSS, limited IDOR, information disclosure |
| Low | 0.1-3.9 | Best-practice gaps, minor leakage |

Always report both technical and business severity when they differ.
