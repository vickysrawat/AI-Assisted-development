---
paths: ["**/auth/**", "**/middleware/**", "**/guards/**", "**/filters/**"]
---

# Auth Rules — Authentication and Authorisation (AuthN + AuthZ)

> Deployed automatically alongside any backend Layer 3 language file.
> AuthN = verifying identity ("who are you?")
> AuthZ = verifying permission ("what are you allowed to do?")
> OAuth 2.0 / OIDC = delegated authorisation protocol (see OAuth section below)

## Core Principle
- AuthN always before AuthZ — never check permissions for an unverified identity
- One canonical place to resolve the current user — not re-parsed in multiple locations:
  - .NET: `ICurrentUserService` reading from `HttpContext.User.Claims`
  - Node.js: `req.user` set by auth middleware before route handlers run
  - Python FastAPI: a `Depends(get_current_user)` dependency
  - Python Django: `request.user` set by `AuthenticationMiddleware`
- Never trust client-provided user IDs, roles, or permissions — resolve from the verified token/session

## Authentication (AuthN)
- JWTs validated for: signature, expiry (`exp`), issuer (`iss`), audience (`aud`) — all four, always
- Short-lived access tokens (15–60 min) + long-lived refresh tokens stored `httpOnly` cookie
- Refresh token rotation on every use — invalidate the old token after issuing the new one
- Session fixation prevention: regenerate session ID after login
- MFA enforcement for admin/privileged roles — not optional

## Authorisation (AuthZ)
- Enforce in a centralised layer (middleware, guard, decorator, policy) — never ad-hoc inside business logic
- RBAC: roles assigned to users, permissions assigned to roles — check permission, not role, in business logic
- ABAC: for fine-grained access (resource ownership, tenant isolation) — check at the service layer
- Resource ownership verified before returning or mutating: "does this user own this record?" — not just "is this user authenticated?"
- Principle of least privilege: request only the scopes/roles needed; default deny

## OAuth 2.0 / OIDC (if used)
- Use OIDC for user authentication — OAuth 2.0 alone does not prove identity
- `state` parameter mandatory to prevent CSRF in the authorization code flow
- `PKCE` mandatory for public clients (SPAs, mobile apps) — no client secret in public clients
- `nonce` in ID token requests to prevent replay attacks
- Validate all ID token claims: `iss`, `aud`, `exp`, `nonce` — not just the signature
- Store access tokens in memory (not `localStorage`) for browser clients; use `httpOnly` cookies for refresh tokens

## Token Handling
- Never log tokens, session IDs, or credentials — log only token metadata (`sub`, `exp`, `jti`)
- Token revocation list (or short TTL) for immediate invalidation on logout or compromise
- `Secure; HttpOnly; SameSite=Strict` on all auth cookies

## Out of bounds
- No client-provided user IDs trusted without token validation
- No role or permission checks ad-hoc inside business logic methods
- No access tokens in `localStorage` for sensitive apps
- No JWT without validating all four claims (signature, expiry, issuer, audience)
- No `SameSite=None` without a documented cross-origin requirement
