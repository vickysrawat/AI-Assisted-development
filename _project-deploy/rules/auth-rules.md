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

## Microsoft Entra ID (MSAL) — SPA + API pattern

> Apply these rules in addition to the OAuth 2.0 / OIDC rules above when
> the stack contains `msal-browser`, `@azure/msal-browser`, `msal-react`,
> or `@azure/msal-react`.

- DO NOT use `{resource}/.default` scope in browser SPA login (`loginRedirect` /
  `loginPopup`) — `.default` is for client credentials and OBO (no user present);
  in a browser it triggers AADSTS90009 (application requesting token for itself)
- DO NOT store MSAL access tokens in `localStorage` — use `sessionStorage`
  (`cacheLocation: "sessionStorage"` in MSAL config)
- DO NOT redirect (`acquireTokenRedirect`) on all `acquireToken` errors — only
  redirect on `instanceof InteractionRequiredAuthError`; other errors cause
  infinite redirect loops
- DO NOT guard `loginRedirect` without checking `inProgress !== InteractionStatus.None`
  first — React 18 StrictMode double-invokes effects and causes concurrent MSAL
  interactions; also check `window.location.hash.includes('error=')` to prevent
  re-triggering after an Azure AD error response
- DO NOT read roles from `idTokenClaims.roles` — app roles appear in the **access
  token**, not reliably in the ID token; acquire a token silently and decode the JWT
  payload to read `roles`; guard loading state (`loadingRoles`) to prevent
  "Access Denied" flash while the access token is being fetched
- When `isAuthorized` from `useAuth()` is used in a component, always guard with
  `if (loadingRoles) return <LoadingSpinner />` before the authorization check —
  `isAuthorized` returns `false` during silent token acquisition and causes a
  premature "Access Denied" render without the guard
- DO NOT set `AUTH_DISABLED=true` in UAT or Production k8s Secrets — log a startup
  `WARNING` when the flag is active; tests must use a mock user, not `AUTH_DISABLED`
- DO NOT patch `auth_module.initialize_jwks` in tests — patch `main_module.initialize_jwks`;
  `from .auth import initialize_jwks` in `main.py` creates a direct name binding that
  patching the source module does not affect
- DO NOT leave `app.dependency_overrides` set between test fixtures — clear overrides
  at the start of `unauthed_client` or any fixture that changes the user context, or
  tests inherit previous overrides silently
