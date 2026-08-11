# Spec: INTEGRATION-CONTRACT.md

_Loaded by migration SKILL.md at Stage 3 (two-track migrations only)._
_Also see: skills/migration/references/shared/fullstack-integration.md for JWT/CORS guidance._

---

## Document: INTEGRATION-CONTRACT.md

**Filename:** `ADO-{ADO_ID}-integration-contract.md`
**Purpose:** The API surface contract shared between the BACKEND and FRONTEND migration tracks.
Both tracks reference this document during Stage 4. BREAKING changes to the contract pause the
FRONTEND track until the change is acknowledged and handled.

**Generated from:** Source API analysis + SECURITY-ARCHITECTURE.md auth decisions.
**Maintained by:** Orchestrator — updated whenever a BACKEND cluster changes an endpoint.

### Required Sections

**## 1. Contract Metadata**
```
version:       1
last_updated:  {date}
hash:          {sha256 of this file — computed after writing, stored in checkpoint}
auth_strategy: {from SECURITY-ARCHITECTURE.md}
```

**## 2. Authentication & Tokens**
```
Mechanism:     {JWT Bearer | API Key | None}
Algorithm:     {RS256 (recommended for hybrid phase) | HS256}
Token location: Authorization: Bearer {token}
JWKS endpoint: {https://... | N/A}

Claims:
  {claim name}  →  {.NET ClaimType / Java annotation / Angular usage}
  sub           →  ClaimTypes.NameIdentifier (configure NameClaimType = "sub")
  roles         →  ClaimTypes.Role (configure RoleClaimType = "roles")
  {other}       →  {usage}

Token lifecycle:
  Expiry:    {e.g. 1 hour}
  Refresh:   {sliding window endpoint | N/A}
  ClockSkew: Set ClockSkew = TimeSpan.Zero on .NET side
```

**## 3. CORS Policy**
```
Allowed origins:  {explicit list — never AllowAnyOrigin}
  Dev:   http://localhost:4200
  Staging: https://staging.{domain}
  Prod:  https://{domain}
Allowed methods:  GET, POST, PUT, DELETE, OPTIONS
Credentials:      {true if using cookies | false}
```

**## 4. Error Contract**

Standard error response shape for ALL 4xx and 5xx responses:
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "string — human-readable error title",
  "status": 400,
  "detail": "string — specific message",
  "instance": "/api/v1/orders/123",
  "errors": {
    "fieldName": ["validation message"]
  }
}
```

HTTP status codes in use: 200 · 201 · 400 · 401 · 403 · 404 · 422 · 500.

**## 5. API Endpoints**

One entry per endpoint. Derived from source API controller/route analysis.

---
### {HTTP Method} {/api/v{version}/{resource}/{params}}

**Description:** {what this endpoint does}
**Auth required:** {Yes — role: {role} | No}
**Request body:**
```json
{sample request body from source analysis — null if GET/DELETE}
```
**Response 200/201:**
```json
{sample response body}
```
**Response errors:** 400 (validation) · 401 (unauthenticated) · 403 (forbidden) · 404 (not found)

**Breaking change vs original API:** None | Minor (added {field}) | Major ({description})

---

**## 6. Breaking Change Log**

Populated by orchestrator during Stage 4 whenever a BACKEND cluster changes an endpoint.

| Version | Date | Endpoint | Change | Impact on FRONTEND |
|---|---|---|---|---|
| 1 | {date} | Initial contract | — | — |

### Breaking Change Classification

| Change | Classification | Gate |
|---|---|---|
| Added optional response field | Non-breaking | None |
| Removed field | BREAKING | Pause FRONTEND track |
| Renamed field | BREAKING | Pause FRONTEND track |
| Changed field type | BREAKING | Pause FRONTEND track |
| Added required request param | BREAKING | Pause FRONTEND track |
| Added optional request param | Non-breaking | None |
