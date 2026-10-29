# Entra ID Authentication — Plugin Reference
#
# Purpose: Initial setup guide and diagnostic reference for React + FastAPI projects
#          using Microsoft Entra ID (MSAL). Not a per-story template — referenced by
#          techspec-react-fastapi.md and auth-rules.md.
#
# Derived from: ADO-131542 Rate Tracker implementation + UAT lessons (October 2026).
# Last updated: 2026-10-20

---

## §1 — One vs. Two App Registrations

| | Single registration | Two registrations |
|---|---|---|
| **Use when** | Internal app, one team, no downstream API-to-API calls | External-facing, multi-team, CA policies differ, API calls other APIs (OBO) |
| **App roles** | Defined on the single registration; appear in the access token | Defined on API registration |
| **OBO** | Not needed | Required when the API must call another API as the signed-in user |
| **Admin overhead** | One registration, one Enterprise App | Two of each |

Microsoft's formal recommendation is two registrations for production. A single registration
is pragmatic for a single-team internal tool with no downstream API-to-API calls, as long as
`accessTokenAcceptedVersion` is set to `2` and delegated scopes are used.

---

## §2 — App Registration Configuration

### §2.1 Token Version — Critical

Default `accessTokenAcceptedVersion: null` produces **v1.0 tokens**. v1.0 and v2.0 tokens
have different `aud` and `iss` values — a mismatch causes "Invalid audience" silently.

| | v1.0 token | v2.0 token |
|---|---|---|
| `aud` | `api://<client-id>` | `<client-id>` (GUID only) |
| `iss` | `https://sts.windows.net/<tenant-id>/` | `https://login.microsoftonline.com/<tenant-id>/v2.0` |

**Fix:** Manifest blade → `accessTokenAcceptedVersion` → `2` → Save.

**Or support both formats in the backend** (safer during migration):
```python
_VALID_TOKEN_FORMATS = [
    {"audience": AZURE_CLIENT_ID,
     "issuer": f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/v2.0"},
    {"audience": f"api://{AZURE_CLIENT_ID}",
     "issuer": f"https://sts.windows.net/{AZURE_TENANT_ID}/"},
]
```

### §2.2 Redirect URI — Must Be `spa` Type

Authentication blade → **Single-page application** (not `web`).
Register every environment:
```
http://localhost:8000/    ← local dev (trailing slash required)
http://localhost:5173/    ← Vite dev server
https://app.uat.yourdomain.com/
https://app.yourdomain.com/
```
If registered as `web`: `AADSTS9002325: Proof Key for Code Exchange required`.

### §2.3 App Roles

App roles blade → Create app role for each role.
**Value field is case-sensitive — must match code exactly** (`Administrator`, `Coordinator`).

### §2.4 Delegated Scope

Expose an API blade → Application ID URI (auto-fills `api://<client-id>`) → Add scope:
- Scope name: `access_as_user`
- Creates: `api://<client-id>/access_as_user`

### §2.5 User Assignment

Enterprise Applications → app → Users and groups → assign each user with their role.
Users without assignment get `AADSTS50105`.

---

## §3 — Why `.default` Scope Fails in a Browser SPA

`.default` instructs Entra to use statically-configured permissions — it is a v1.0
compatibility shim designed for client credentials (no user) and On-Behalf-Of (no
interactive session).

When a SPA calls `loginRedirect({ scopes: ["api://<client-id>/.default"] })`, the client
and resource are the same application. Entra treats this as a client credentials grant,
which requires a secret. The browser has no secret.

Result: `AADSTS90009: Application is requesting a token for itself.`

Even if it succeeded, a client-credentials token carries no user identity (`sub`, `oid`,
`preferred_username`, `roles`) — the API cannot enforce per-user authorization.

**Decision rule:**
```
Is a user present and interactively signing in?
  YES → Authorization code + PKCE → explicit delegated scope (api://.../access_as_user)
  NO  → Client credentials / OBO  → .default scope
```

**Side-by-side comparison:**

| | `api://<client-id>/.default` | `api://<client-id>/access_as_user` |
|---|---|---|
| Permission type | Application (app-only) | Delegated (user-bound) |
| Intended flow | Client credentials, OBO | Authorization code + PKCE |
| User present? | No | Yes |
| Result in browser SPA | AADSTS90009 — rejected | Login prompt → user-bound token |
| Token contains user identity? | No | Yes |

---

## §4 — FastAPI Backend Implementation

### §4.1 Configuration (config.py)

```python
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(Path(__file__).parent.parent / ".env", override=False)  # override=False: k8s env wins
except ImportError:
    pass

AZURE_TENANT_ID: str = os.getenv("AZURE_TENANT_ID", "")
AZURE_CLIENT_ID: str = os.getenv("AZURE_CLIENT_ID", "")
AZURE_SCOPE: str     = os.getenv("AZURE_SCOPE", "")
AUTH_DISABLED: bool  = os.getenv("AUTH_DISABLED", "false").lower() == "true"
```

`override=False` ensures k8s-injected variables are never clobbered by a local `.env`.

### §4.2 JWKS Validation

```python
_JWKS_URL = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/discovery/v2.0/keys"
_TTL_SECONDS   = 3600   # refresh hourly
_GRACE_SECONDS = 300    # serve stale keys for 5 min if refresh fails

def get_current_user(credentials=Depends(HTTPBearer(auto_error=False))) -> UserContext:
    if AUTH_DISABLED:
        return _DEV_USER
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    last_error = None
    for fmt in _VALID_TOKEN_FORMATS:
        try:
            claims = jwt.decode(token, _get_jwks(), algorithms=["RS256"],
                                audience=fmt["audience"], issuer=fmt["issuer"])
            return UserContext(...)
        except JWTError as e:
            last_error = e

    raise HTTPException(status_code=401, detail=f"Invalid or expired token: {last_error}")
```

**Caching notes:**
- Use `time.monotonic()` — immune to DST/NTP clock changes
- Serve stale keys during grace period — JWKS fetch failures are usually transient
- Return 503 after grace (not 401) — the client's token is not at fault

### §4.3 Role Dependencies

```python
def require_any_role(user=Depends(get_current_user)) -> UserContext:
    if not user.is_authorized:
        raise HTTPException(status_code=403, detail="Access denied: insufficient role")
    return user

def require_admin(user=Depends(get_current_user)) -> UserContext:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied: Administrator role required")
    return user
```

### §4.4 Runtime Config Endpoint

The frontend cannot read environment variables at runtime in Docker/k8s.

```python
@router.get("/api/auth/config")
def get_client_config():
    return {
        "clientId": AZURE_CLIENT_ID, "tenantId": AZURE_TENANT_ID,
        "scope": AZURE_SCOPE, "redirectUri": AZURE_REDIRECT_URI,
        "authDisabled": AUTH_DISABLED,
    }
```

Frontend fetches this before initializing MSAL — ensures Azure AD values are
environment-specific without rebuilding the frontend bundle per environment.

### §4.5 Startup Order

```python
@app.on_event("startup")
def startup():
    initialize_jwks()  # fail-fast if Azure AD unreachable — must come first
    init_db()
```

### §4.6 AUTH_DISABLED Feature Flag

```python
AUTH_DISABLED: bool = os.getenv("AUTH_DISABLED", "false").lower() == "true"
_DEV_USER = UserContext(email="dev@local", display_name="Dev Admin",
                        roles=["Administrator"], oid="dev", expires_at=9_999_999_999)
```

**Hard rules:**
- `AUTH_DISABLED=true` must **never** appear in UAT or Production k8s Secrets
- k8s Secrets must **omit the key entirely** (defaults to `false`)
- Startup must log a prominent `WARNING` when the flag is active
- Tests must use a mock user, **not** `AUTH_DISABLED=true`

---

## §5 — React + MSAL Frontend Implementation

### §5.1 Bootstrap Pattern

```jsx
async function bootstrap() {
    const config = await fetch("/api/auth/config").then(r => r.json())
    if (config.authDisabled) { render(<DevApp />); return; }

    initAuthConfig(config)
    const msalInstance = new PublicClientApplication(msalConfig)
    await msalInstance.initialize()  // must await — handles redirect promise
    render(<MsalProvider instance={msalInstance}><App /></MsalProvider>)
}
bootstrap()
```

`await msalInstance.initialize()` must complete before use — without it,
`handleRedirectPromise` has not run and auth code from the redirect URI is silently lost.

### §5.2 MSAL Config

```js
export const msalConfig = {
    auth: { clientId: "PLACEHOLDER", authority: "...", redirectUri: "..." },
    cache: {
        cacheLocation: "sessionStorage",   // NOT localStorage — cleared on tab close
        storeAuthStateInCookie: false,
    },
}
export const loginRequest = { scopes: ["api://<client-id>/access_as_user"] }
```

### §5.3 Login Redirect — Guard Against Loops

```jsx
function LoginRedirect() {
    const { instance, inProgress } = useMsal()
    useEffect(() => {
        if (window.location.hash.includes('error=')) return   // Azure AD returned an error
        if (inProgress !== InteractionStatus.None) return     // another MSAL call in progress
        instance.loginRedirect(loginRequest).catch(() => {})
    }, [instance, inProgress])
    return null
}
```

Both guards are required. `inProgress` prevents concurrent MSAL interactions in
React 18 StrictMode (effects fire twice). `error=` prevents re-triggering after
`AADSTS50105` or any redirect error.

### §5.4 Reading Roles — Access Token, Not ID Token

App roles appear in the **access token**. `idTokenClaims.roles` is often empty.

```js
export function useAuth() {
    const { instance, accounts } = useMsal()
    const account = useAccount(accounts[0] || {})
    const [accessTokenClaims, setAccessTokenClaims] = useState(null)

    useEffect(() => {
        if (!account) return
        instance.acquireTokenSilent({ ...loginRequest, account })
            .then(result => {
                const payload = result.accessToken.split('.')[1]
                const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
                setAccessTokenClaims(claims)
            })
            .catch(() => {})
    }, [instance, account])

    const roles = accessTokenClaims?.roles ?? account?.idTokenClaims?.roles ?? []
    const loadingRoles = !!account && !accessTokenClaims  // prevents "Access Denied" flash

    return {
        isAdmin: roles.includes("Administrator"),
        isCoordinator: roles.includes("Coordinator"),
        isAuthorized: roles.some(r => ["Administrator", "Coordinator"].includes(r)),
        loadingRoles,
    }
}
```

### §5.5 Token Acquisition for API Calls (authService.ts)

```typescript
import { InteractionRequiredAuthError } from "@azure/msal-browser"

export async function getAccessToken(): Promise<string> {
    if (_authDisabled) return ""
    try {
        const result = await _msalInstance.acquireTokenSilent({ ...loginRequest, account: ... })
        return result.accessToken
    } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
            await _msalInstance.acquireTokenRedirect(loginRequest)
            return ""
        }
        throw err   // network errors etc. → let the API call fail cleanly (no redirect loop)
    }
}
```

Only redirect on `InteractionRequiredAuthError`. Redirecting on all errors causes
infinite redirect loops on transient network failures.

---

## §6 — Testing Strategy

### §6.1 Override `get_current_user` — Not JWKS

```python
@pytest.fixture()
def client(monkeypatch):
    import app.main as main_module
    monkeypatch.setattr(main_module, "initialize_jwks", lambda: None)  # patch the CALLER
    app.dependency_overrides[get_current_user] = lambda: _mock_admin
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

**Patch the caller, not the definer:** `from .auth import initialize_jwks` in `main.py`
creates a direct name binding. Patching `auth_module.initialize_jwks` does nothing for
`main_module`'s already-bound reference.

**Clear overrides between fixtures:** `unauthed_client` must call
`app.dependency_overrides.clear()` at its start, or it inherits leftover admin overrides.

### §6.2 Coverage Matrix

| Test class | Fixture | Verifies |
|---|---|---|
| `TestAuthGates` | `unauthed_client` | All protected endpoints return 401 |
| `TestAuthGates` | `coord_client` | Admin-only endpoints return 403 for Coordinator |
| `TestAuthGates` | `client` (admin) | Admin-only endpoints return 200 for Administrator |
| `TestJWKSCache` | — | TTL, grace period, 503 after grace |
| `TestUserContext` | — | `is_admin`, `is_authorized` flag logic |

---

## §7 — Breaking Points (B1–B13)

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| B1 | "Invalid audience" — token rejected | `accessTokenAcceptedVersion: null` → v1.0 tokens | Set to `2` in manifest, or support both formats in backend |
| B2 | `AADSTS90009: Application requesting token for itself` | `AZURE_SCOPE=.default` in browser redirect | Change scope to `api://<client-id>/access_as_user` |
| B3 | `AADSTS50105: User not assigned to a role` | User not assigned in Enterprise Applications | Enterprise Applications → app → Users and groups |
| B4 | `AADSTS9002325: PKCE required for cross-origin code redemption` | Redirect URI registered as `web` not `spa` | Re-register under Authentication → Single-page application |
| B5 | Infinite redirect loop after Azure AD error | `LoginRedirect` fires again on error hash | Check `window.location.hash.includes('error=')` before `loginRedirect()` |
| B6 | Home page flashes then back to login | `catch {}` redirected on all errors | Only redirect on `instanceof InteractionRequiredAuthError` |
| B7 | User sees "Access Denied" despite correct role | `idTokenClaims.roles` empty; roles in access token | Acquire access token silently, decode JWT to read `roles`; add `loadingRoles` guard |
| B8 | `authorization_pending` (400) causes 500 | `raise_for_status()` converts non-200 to exception | Check status code; forward non-200 Azure AD responses as-is |
| B9 | Works locally but fails in Docker | `python-dotenv` not installed | Add to `requirements.txt`; call `load_dotenv(override=False)` in `config.py` |
| B10 | Roles visible in browser devtools but access denied | Devtools shows ID token; `roles` in access token | Use `jwt.ms` or `/api/auth/me` to inspect the actual access token |
| B11 | Auth changes not picked up in browser | Stale frontend bundle | Run `npm run build`, hard-refresh (`Ctrl+Shift+R`) |
| B12 | `AADSTS700084` — redirect loop after long session | SPA refresh tokens have 24-hour lifetime | Detect error code; show "session expired, please log in again" |
| B13 | React 18 StrictMode fires `loginRedirect` twice | StrictMode double-invokes effects | Guard with `inProgress !== InteractionStatus.None` |

---

## §8 — Environment Configuration

| Variable | Local dev | UAT | Prod |
|---|---|---|---|
| `AUTH_DISABLED` | `true` | Omit (→ `false`) | Omit (→ `false`) |
| `AZURE_TENANT_ID` | Tenant GUID | Tenant GUID | Tenant GUID |
| `AZURE_CLIENT_ID` | App GUID | App GUID | App GUID |
| `AZURE_SCOPE` | `api://<AID>/access_as_user` | Same | Same |
| `AZURE_REDIRECT_URI` | `http://localhost:8000/` | UAT URL | Prod URL |

### k8s Secret template

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: secret-entraid
type: Opaque
stringData:
  AZURE_TENANT_ID: "<tenant-guid>"
  AZURE_CLIENT_ID: "<client-guid>"
  AZURE_SCOPE: "api://<client-guid>/access_as_user"
  AZURE_REDIRECT_URI: "https://app.yourdomain.com/"
  # AUTH_DISABLED intentionally omitted — defaults to false
```

---

## §9 — Sources

- [Scopes and permissions — `.default` section](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc)
- [One vs. Two App Registrations](https://learn.microsoft.com/en-us/answers/questions/1421814/one-vs-two-app-registrations-for-an-app-with-front)
- [Access tokens in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
- [Entra app manifest — `accessTokenAcceptedVersion`](https://learn.microsoft.com/en-us/entra/identity-platform/reference-app-manifest)
- [OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Acquire a token to call a web API from a SPA](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token)
- [Handle errors in MSAL.js](https://learn.microsoft.com/en-us/entra/identity-platform/msal-error-handling-js)
- [AADSTS90009 — application requesting token for itself](https://learn.microsoft.com/en-us/answers/questions/1076516/oauth-2-0-and-azure-active-directory-error-aadsts9)
- [Just what is the /.default scope](https://dev.to/425show/just-what-is-the-default-scope-in-the-microsoft-identity-platform-azure-ad-2o4d)
- [React 18 StrictMode + MSAL infinite loop — MSAL GitHub Issue #5074](https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/5074)
