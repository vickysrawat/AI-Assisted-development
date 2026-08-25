# Shared Reference: Full-Stack Integration (coordinated backend + frontend runs)

_Loaded by a `backend` run that PUBLISHES an API contract, or a `frontend` run that CONSUMES one.
Covers JWT, CORS, the API contract, and how the two runs coordinate._

---

## The model: two coordinated single-track runs (not one migration)

A full-stack migration is **two separate `/migration` runs sharing a contract**, not one invocation:
1. **Backend run** (e.g. nodejs→.NET) migrates the API and, at completion, **publishes** the contract
   — `ADO-{ID}-integration-contract.md` + the built `openapi.json` + a `contract_hash`.
2. **Frontend run** (react→Angular) **consumes** that published contract (or an existing backend's
   OpenAPI), generates a typed client from it, and builds the UI against it.

**Backend-first is mandatory** — the frontend builds against a *frozen, published* contract, never a
moving one:
1. The contract must be defined before Angular calls it — an unstable API doubles frontend rework.
2. The new backend can serve BOTH the old and new frontends during the transition.
3. Auth / CORS / session decisions are the backend's; they constrain the frontend.
4. Backend endpoints can be smoke-tested before any frontend code exists.

**Sequence:** backend run completes → contract published (+ hash) → frontend run consumes it; each
frontend cluster re-checks the contract hash (SKILL.md Step 4.3a) so a later backend change can't
silently break a frontend already built against it.

---

## Integration Contract Structure

Write `ADO-{ADO_ID}-integration-contract.md` with these sections:

### 1. Authentication & Authorization

```markdown
## Authentication
- Mechanism:  JWT Bearer
- Algorithm:  RS256 (recommended for hybrid phase — see JWT section below)
- Token location: Authorization: Bearer {token}
- JWKS endpoint: https://{auth-domain}/.well-known/jwks.json (if RS256)

## Claims
| Claim | Type | .NET mapping | Angular usage |
|---|---|---|---|
| sub | string | ClaimTypes.NameIdentifier | userId in localStorage / service |
| roles | string[] | ClaimTypes.Role (configure RoleClaimType) | route guards |
| {custom} | {type} | {claim name} | {usage} |

## Token lifecycle
- Expiry: {e.g. 1 hour}
- Refresh: {endpoint or sliding window}
- Clock skew: set ClockSkew = TimeSpan.Zero on .NET side for strict expiry
```

### 2. API Endpoints

For each endpoint:
```markdown
### GET /api/users/{id}
- Auth required: Yes — role: admin | user (own only)
- Request: path param {id: string}
- Response 200: { id: string, name: string, email: string }
- Response 404: { error: { code: "NOT_FOUND", message: string } }
- Breaking change vs original: None | Minor (added email field) | Major (renamed userId → id)
```

### 3. Error Contract

Standard error response shape (both tracks must honour this):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [{ "field": "email", "message": "Invalid format" }]
  }
}
```

HTTP status codes in use: `200`, `201`, `400`, `401`, `403`, `404`, `422`, `500`.

### 4. Contract Version
```markdown
version: 1
last_updated: {date}
hash: {computed after writing}
```

---

## Breaking Change Classification

| Change type | Classification | Gate required |
|---|---|---|
| Added optional field to response | Non-breaking | None — auto-allow |
| Removed field from response | BREAKING | STOP FRONTEND track |
| Renamed field | BREAKING | STOP FRONTEND track |
| Changed field type | BREAKING | STOP FRONTEND track |
| Added required request param | BREAKING | STOP FRONTEND track |
| Added optional request param | Non-breaking | None — auto-allow |
| Changed HTTP method (GET → POST) | BREAKING | STOP FRONTEND track |
| Changed status code semantics | BREAKING | STOP FRONTEND track |

After any BACKEND slice that produces a BREAKING change:
```
⚠ BREAKING change detected in BACKEND Slice {N}.
  FRONTEND track is paused until FRONTEND code is updated to handle:
  {list of breaking changes}

  Update FRONTEND slice code, then: MIGRATE RESUME ADO-{ADO_ID} FRONTEND
```

---

## JWT Token Compatibility (Hybrid Phase)

During the hybrid phase (old frontend + new backend, or vice versa), both systems must accept the same tokens.

### Recommended: RS256 with JWKS Endpoint

RS256 uses asymmetric keys:
- Auth server signs with **private key** (secret)
- Both old and new backends validate with **public key** (from JWKS endpoint)
- Neither backend needs the private key — only the JWKS URL

Benefits:
- The same token is valid for both the old Express API and the new .NET API simultaneously.
- Key rotation is automatic via JWKS.
- No shared secret to manage.

### .NET JWT Bearer Configuration
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.Authority = "https://your-auth-domain/";
        options.Audience = "your-api-audience";
        options.TokenValidationParameters = new TokenValidationParameters {
            NameClaimType = "sub",                    // maps sub → ClaimTypes.NameIdentifier
            RoleClaimType = "roles",                  // match your token's role claim name
            ClockSkew = TimeSpan.Zero                 // strict expiry — no 5-min tolerance
        };
    });
```

### Angular JWT Interceptor
```typescript
// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};

// app.config.ts
provideHttpClient(withInterceptors([authInterceptor]))
```

### Token Claims Mapping
| JWT claim | .NET ClaimTypes | Angular usage |
|---|---|---|
| `sub` | `ClaimTypes.NameIdentifier` (configure NameClaimType) | userId |
| `email` | `ClaimTypes.Email` | display |
| `roles` | `ClaimTypes.Role` (configure RoleClaimType) | route guards |
| `name` | `ClaimTypes.Name` | display name |

⚠ .NET `ClaimTypes.NameIdentifier` maps to `sub` ONLY if `NameClaimType = "sub"` is configured. Without this, `.User.Identity.Name` returns null.

---

## CORS During the Hybrid Phase

During transition, the backend must accept requests from BOTH old and new frontend origins.

### .NET CORS Configuration
```csharp
builder.Services.AddCors(options => {
    options.AddPolicy("HybridMigration", policy => {
        policy.WithOrigins(
            "https://old-react-app.domain.com",    // old frontend — remove when decommissioned
            "https://new-angular-app.domain.com"   // new frontend
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();  // Only if using HttpOnly cookies
    });
});

// In middleware pipeline (after UseRouting, before UseAuthentication):
app.UseCors("HybridMigration");
```

**NEVER use `AllowAnyOrigin()` with `AllowCredentials()` — the framework throws an exception.**
**NEVER use `AllowAnyOrigin()` in production — it defeats the purpose of CORS.**

### Local Development CORS
For local development, use Angular's proxy config instead of adding `localhost:4200` to CORS:
```json
// proxy.conf.json
{
  "/api": {
    "target": "https://localhost:5001",
    "secure": false,
    "changeOrigin": true
  }
}
```
This avoids browser pre-flight OPTIONS requests and simplifies debugging.

---

## Angular HttpClient → .NET API Integration Checklist

Before FRONTEND slices begin:
- [ ] OpenAPI spec generated from .NET API (Swashbuckle or `Microsoft.AspNetCore.OpenApi`)
- [ ] Angular HTTP client code generated from spec: `npx openapi-generator-cli generate -i swagger.json -g typescript-angular -o src/app/api`
- [ ] JWT interceptor configured to attach Bearer token to all `/api` requests
- [ ] CORS policy tested with both frontend origins
- [ ] Error response shape matches contract (Angular error handler parses `error.error.code`)
- [ ] Auth guard implemented: `canActivate: [() => inject(AuthService).isAuthenticated()]`

---

## Failure Modes to Avoid

| Failure | Prevention |
|---|---|
| Strangler facade becomes permanent | Set explicit sunset date; remove old routes when their slice is migrated |
| New features going into old stack | Policy: ALL new features → new stack from day 1 |
| API contract diverges mid-migration | Contract hash in checkpoint; BACKEND slice gate on breaking changes |
| Auth token incompatibility on cutover | Use JWKS/RS256 so both backends validate the same tokens |
| CORS opens too wide for convenience | `WithOrigins` always; never `AllowAnyOrigin` in production |
| Frontend deployed before API ready | Backend-first; gate FRONTEND slices on BACKEND B4 completion |
