# Language-Specific Security Notes

## Python
- **Injection**: `subprocess.call(shell=True)`, `os.system()`, `eval()`, `exec()`, `pickle.loads()` — all high-risk
- **SQL**: Raw string formatting into queries; use parameterised queries (`cursor.execute(sql, params)`)
- **Deserialization**: `pickle`, `yaml.load()` (use `yaml.safe_load()`), `marshal`
- **Secrets**: `os.environ` is preferred; flag hardcoded strings matching key/secret/token/password patterns
- **Crypto**: Avoid `MD5`/`SHA1` for passwords; use `bcrypt`, `argon2`, or `hashlib.scrypt`
- **Path traversal**: `open(user_input)` without `os.path.abspath` + prefix check
- **SSRF**: `requests.get(url)` where `url` is user-controlled without allowlist validation
- **Template injection**: Jinja2 `render_template_string(user_input)` — always use `render_template`

## JavaScript / Node.js
- **Prototype pollution**: `obj[key] = value` where key is user-controlled; `merge()` / `extend()` on untrusted input
- **ReDoS**: Complex RegExp with user-controlled input
- **SQL**: String concatenation into queries; use parameterised queries or ORMs correctly
- **Command injection**: `child_process.exec(userInput)` — use `execFile` with args array
- **Path traversal**: `path.join(__dirname, userInput)` — validate with `path.resolve` + prefix check
- **XSS**: `innerHTML`, `dangerouslySetInnerHTML`, `document.write` with user data
- **Secrets**: `.env` files must not be committed; flag `process.env` reads for missing validation
- **`eval()` / `Function()`**: Always flag
- **npm**: Flag `--legacy-peer-deps` installs; recommend `npm audit fix`

---

## C#

- **SQL injection**: `string.Format()`/interpolation into `SqlCommand` — always use `SqlParameter` or parameterised queries
- **Command injection**: `Process.Start(userInput)` — validate and allowlist; never pass raw input to shell
- **Deserialization**: `BinaryFormatter`, `NetDataContractSerializer`, `JavaScriptSerializer` on untrusted data — all high-risk (CWE-502); prefer `System.Text.Json` with strict options
- **XXE**: `XmlDocument`, `XmlReader`, `XPathDocument` — disable external entities: set `XmlResolver = null` and `DtdProcessing = DtdProcessing.Prohibit`
- **Path traversal**: `Path.Combine(baseDir, userInput)` — always call `Path.GetFullPath()` and verify result starts with expected base
- **Open redirect**: `Response.Redirect(userInput)` — validate against allowlist or use relative paths only
- **SSRF**: `HttpClient.GetAsync(userInput)` — validate URL scheme and host against allowlist
- **Crypto**: Avoid `MD5CryptoServiceProvider`, `SHA1CryptoServiceProvider`, `DESCryptoServiceProvider`; use `Aes`, `SHA256`, `HMACSHA256`; use `Rfc2898DeriveBytes` (PBKDF2) or `BCrypt.Net` for password hashing
- **Secrets**: Never hardcode in `appsettings.json` committed to source control; use `Secret Manager`, Azure Key Vault, or environment variables
- **Regex DoS (ReDoS)**: Complex patterns with user input — set `RegexOptions.NonBacktracking` (.NET 7+) or apply timeouts via `Regex(pattern, options, TimeSpan)`
- **Assembly reflection**: `Assembly.Load(userInput)`, `Activator.CreateInstance(typeName)` — arbitrary type instantiation risk

---

## ASP.NET Framework (System.Web / MVC 5 and earlier)

- **XSS**: `@Html.Raw(userInput)`, `Response.Write(userInput)` — always use `@Html.Encode()` or Razor's auto-encoding (`@model.Property`)
- **Request validation bypass**: `[ValidateInput(false)]` or `<httpRuntime requestValidationMode="2.0">` — flag; explain the risk
- **CSRF**: Missing `[ValidateAntiForgeryToken]` on POST/PUT/DELETE actions + missing `@Html.AntiForgeryToken()` in forms
- **Open redirect**: `Redirect(returnUrl)` without validation — use `Url.IsLocalUrl(returnUrl)` check
- **ViewState tampering**: `EnableViewStateMac="false"` — always flag; MAC must be enabled
- **Machine key exposure**: Hardcoded `<machineKey>` in `web.config` in source control — rotate immediately
- **Verbose errors**: `<customErrors mode="Off">` in production — switch to `RemoteOnly` or `On`
- **Overly permissive routes**: Catch-all route patterns that expose unintended controllers/actions
- **Forms authentication**: `timeout` set too high; `requireSSL="false"` on the auth cookie; missing `httpOnlyCookies="true"` and `SameSite`
- **Bundling/minification**: Debug mode left on in production exposes source maps and unminified JS

---

## ASP.NET Core / ASP.NET 6+ (Minimal APIs & MVC)

- **Missing security headers**: No `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` — recommend `NWebsec` or custom middleware
- **CORS misconfiguration**: `AllowAnyOrigin()` + `AllowCredentials()` — invalid and a security risk; never combine these
- **CSRF**: For cookie-based auth, `[AutoValidateAntiforgeryToken]` should be applied globally; exempt only API endpoints using token auth
- **JWT validation gaps**: Missing `ValidateIssuer`, `ValidateAudience`, `ValidateLifetime` in `TokenValidationParameters`; accepting `alg: none` (CVE class); symmetric key too short (<256 bits)
- **Data protection API**: Keys stored unprotected on disk; missing key encryption at rest — use `ProtectKeysWithAzureKeyVault()` or `ProtectKeysWith*` in production
- **Endpoint authorisation**: Missing `[Authorize]` on sensitive minimal API endpoints; relying solely on client-side checks
- **Environment leakage**: `app.UseDeveloperExceptionPage()` not gated to `Development` environment; `ASPNETCORE_ENVIRONMENT=Development` set in production
- **Static file serving**: `app.UseStaticFiles()` serving `wwwroot` containing sensitive files (`.config`, `.env`, backup files)
- **Real data in static directories**: any `.json`, `.csv`, or data file in `wwwroot/`, `public/`, `assets/`, or `static/` containing real entity data — names, IDs, case details, credentials. These files are served without authentication. Flag as CRITICAL (see Step 0.5). Angular's `public/` folder maps directly to the build output root and is fully public.
- **Rate limiting**: No `app.UseRateLimiter()` on authentication or sensitive endpoints (available natively in .NET 7+)
- **Health check exposure**: `/healthz` or `/health` endpoints publicly accessible without auth, leaking infrastructure details
- **Secrets**: `IConfiguration` reading secrets from `appsettings.json` checked into source — use `dotnet user-secrets` locally, Key Vault / environment variables in production

---

## ASP.NET Web API (System.Web.Http & ASP.NET Core API)

- **Mass assignment / over-posting**: Binding `[FromBody]` directly to EF entity models — use DTOs with explicit property mapping
- **Verbose error responses**: Returning `Exception.Message` or stack traces in API responses — use `ProblemDetails` with generic messages in production
- **Insecure direct object reference (IDOR)**: `/api/orders/{id}` without verifying `id` belongs to the authenticated user (CWE-639)
- **Missing authentication on routes**: Routes without `[Authorize]` that should be protected; global fallback policy not configured
- **Content negotiation abuse**: Accepting `application/xml` input without disabling XXE in the XML formatter
- **HTTP verb confusion**: Actions accessible via unintended verbs (e.g., GET modifying state); always restrict with `[HttpGet]`, `[HttpPost]`, etc.
- **Large payload attacks**: No `MaxRequestBodySize` limit — set in `KestrelServerOptions` or `IIS web.config`
- **API versioning exposure**: Deprecated API versions still active and unauthenticated
- **Swagger/OpenAPI in production**: `/swagger` endpoint publicly accessible — gate behind auth or disable in non-development environments

---

## WCF (Windows Communication Foundation)

- **Binding security mode**: `basicHttpBinding` defaults to `None` (no transport or message security) — require `Transport` (HTTPS) or `Message` mode
- **`mexHttpBinding` exposure**: Metadata endpoint (`?wsdl`) publicly accessible — disable in production: `<serviceMetadata httpGetEnabled="false"/>`
- **Message security credentials**: `clientCredentialType="None"` on message-secured bindings — always require authentication
- **ClearText passwords**: `UserName` credential type over HTTP without transport security — always pair with HTTPS
- **Deserialization**: `NetDataContractSerializer` and `DataContractSerializer` with `maxItemsInObjectGraph` not set — cap to prevent DoS
- **Transport security**: Missing `<security mode="Transport">` on internet-facing endpoints — flag plaintext exposure
- **Exception detail in faults**: `includeExceptionDetailInFaults="true"` in production — exposes stack traces; set to `false`
- **Replay attacks**: Missing `<security>` with `replayDetection` enabled on message-secured bindings
- **Throttling**: No `<serviceThrottling>` configured — default limits are very high and enable DoS

---

## Entity Framework (EF6 & EF Core)

- **Raw SQL injection**: `Database.ExecuteSqlRaw(userInput)`, `FromSqlRaw($"... {userInput}")` — use `ExecuteSqlInterpolated` / `FromSqlInterpolated` or parameterised overloads
- **LINQ injection via dynamic queries**: Building LINQ expressions from user strings using reflection or `Dynamic LINQ` library without input validation
- **Over-fetching / data exposure**: Returning full EF entity objects from API endpoints — always project to DTOs; avoid exposing navigation properties unintentionally
- **Lazy loading with serialization**: Lazy loading enabled + JSON serialization can cause infinite loops and expose unintended related data — disable lazy loading in API contexts
- **Audit fields bypass**: `CreatedBy`, `ModifiedBy` set from client input rather than server-side identity
- **Soft delete not enforced**: Queries missing `.Where(x => !x.IsDeleted)` global query filter — add global query filters in `OnModelCreating`
- **Connection string secrets**: Connection strings in `appsettings.json` with plaintext passwords committed to source control
- **Migration scripts in production**: `Database.Migrate()` called at app startup in production with a high-privilege DB account — use a least-privilege migration account
- **N+1 queries**: Not a direct security issue but can be exploited for DoS via deliberate triggering — use `.Include()` and projection

---

## ORM General Patterns (Dapper, NHibernate, LINQ to SQL, etc.)

- **Raw query string building**: Any ORM that accepts raw SQL strings is vulnerable to injection when user input is concatenated — always use parameterised overloads
- **Dapper**: `connection.Execute("... WHERE id = " + id)` — use `connection.Execute("... WHERE id = @Id", new { Id = id })`
- **NHibernate HQL injection**: `session.CreateQuery("FROM User WHERE name = '" + input + "'")` — use named parameters: `.SetString("name", input)`
- **Bulk operations without row limits**: `DELETE FROM table WHERE condition` from ORM without `.Take()` / `TOP` — can wipe large datasets; enforce row-count limits
- **Unrestricted includes / eager loading**: Allowing client to specify which navigation properties to include (e.g., via query string) — allowlist permitted includes server-side
- **Schema exposure via error messages**: ORM exception messages often include table/column names — catch and genericise before returning to clients

---

## Database Security (SQL Server, PostgreSQL, MySQL, etc.)

### General
- **Least privilege**: Application DB account should have only SELECT/INSERT/UPDATE/DELETE on required tables — never `db_owner`, `sa`, or `root`
- **Stored procedure injection**: Dynamic SQL inside stored procs (`EXEC('SELECT ... ' + @param)`) — use `sp_executesql` with typed parameters
- **Default credentials**: `sa` / `root` with blank or default password — flag immediately
- **Encryption at rest**: Sensitive columns (PII, financial data) should use Transparent Data Encryption (TDE) or column-level encryption
- **Encryption in transit**: Require TLS for all client connections; flag `sslmode=disable` (PostgreSQL) or `Encrypt=False` (SQL Server connection string)
- **Backup security**: Unencrypted database backups stored in accessible locations (e.g., public S3 bucket, world-readable filesystem path)
- **Audit logging**: No database-level audit trail for privileged operations, schema changes, or access to sensitive tables

### SQL Server
- **`xp_cmdshell` enabled**: Allows OS command execution from T-SQL — must be disabled: `EXEC sp_configure 'xp_cmdshell', 0`
- **`sa` account enabled**: Disable or rename; never use for application connections
- **CLR integration enabled unnecessarily**: `clr enabled = 1` expands attack surface — disable if unused
- **Linked servers**: Overly permissive linked server credentials; `DATA_ACCESS` enabled without business need
- **Row-level security (RLS) missing**: Multi-tenant databases without RLS policies risk cross-tenant data leakage

### PostgreSQL
- **`SUPERUSER` role for app account**: Application should use a role with minimal grants
- **`pg_hba.conf` trust authentication**: `trust` method allows passwordless local connections — use `scram-sha-256`
- **Public schema privileges**: By default all users can create objects in `public` — revoke with `REVOKE CREATE ON SCHEMA public FROM PUBLIC`
- **`COPY TO/FROM` with user-controlled paths**: Allows reading/writing arbitrary server files if superuser
- **`search_path` injection**: Functions with `SECURITY DEFINER` that don't set `search_path` are vulnerable to schema injection

### MySQL / MariaDB
- **`FILE` privilege**: Grants `LOAD DATA INFILE` / `SELECT INTO OUTFILE` — read/write arbitrary files; revoke unless explicitly needed
- **Anonymous accounts**: Default installs may include anonymous users — `SELECT user, host FROM mysql.user WHERE user=''`; remove all
- **`skip-grant-tables`**: Disables all access control — never in production; flag immediately if present in `my.cnf`
- **`LOAD DATA LOCAL INFILE`**: Can be exploited by a malicious server to read client files — disable with `--local-infile=0`
- **Weak `mysql_native_password`**: Prefer `caching_sha2_password` (MySQL 8+) or `sha256_password`



#### SPA Authentication Security — Angular / React with Entra ID / MSAL

These checks apply to any Angular or React application using MSAL or OAuth2.
Run these when `AUTH_SPA` is true in the deployment context.

**OAuth2 flow — PKCE vs implicit (CRITICAL)**
```typescript
// RED FLAG — implicit flow sends token in URL fragment (visible in logs, history)
responseType: 'id_token token'   // in MSAL config
response_type: 'token'           // in any OAuth config

// CORRECT — PKCE (default in MSAL Angular/Browser v2+)
// Verify MSAL version ≥ 2.x — v1 used implicit by default
```
Any use of `responseType: 'id_token token'` or `response_type: 'token'` is a High finding.
Tokens in URL fragments appear in browser history, server access logs, and referrer headers.

**Route guards — every protected route must be guarded**
```typescript
// RED FLAG — protected route with no guard
const routes: Routes = [
  { path: 'matters', component: MattersComponent },  // no guard — anyone can navigate here
];

// CORRECT
{ path: 'matters', component: MattersComponent, canActivate: [MsalGuard] }
// or functional guard:
{ path: 'matters', component: MattersComponent, canActivate: [() => inject(AuthGuard).canActivate()] }
```
Check every route in `app-routing.module.ts` or `app.routes.ts`. A missing guard means
an unauthenticated user can navigate to the route client-side — even if the API rejects
their calls, they see the UI shell.

**HTTP interceptor — tokens must be attached automatically**
```typescript
// RED FLAG — no interceptor, token attached manually per-service
this.http.get('/api/matters', { headers: { Authorization: 'Bearer ' + token } })
// Problem: token may be expired, attachment is inconsistent, some calls may be missed

// CORRECT — MsalInterceptor with protectedResourceMap
providers: [
  provideHttpClient(withInterceptors([msalInterceptorConfigFactory])),
  { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: msalInterceptorConfigFactory }
]
```
Check `app.config.ts` or `app.module.ts`. If `MsalInterceptor` or a custom interceptor
is not registered, some API calls will be unauthenticated. Flag as High.

**Silent token refresh — token expiry must not break the UX**
```typescript
// RED FLAG — no refresh handling; user gets 401 after 1 hour
// Nothing in the code handles token expiry

// RED FLAG — catch that swallows the error silently
acquireTokenSilent(request).catch(() => {});  // user sees broken UI

// CORRECT — fail to interactive login on InteractionRequiredAuthError
acquireTokenSilent(request).catch((error) => {
  if (error instanceof InteractionRequiredAuthError) {
    acquireTokenRedirect(request);
  }
});
```

**Token storage — sessionStorage is safer than localStorage**
```typescript
// AMBER — localStorage persists across sessions and survives XSS longer
cacheLocation: 'localStorage'

// BETTER — sessionStorage (default) cleared on tab close
cacheLocation: 'sessionStorage'
```
Flag `localStorage` as Amber with the XSS persistence note. If the application
handles B1–B7 data, escalate to High — a persisted token for attorney-client matter
data is a meaningful credential.

**Logout — must clear Entra ID session, not just local cache**
```typescript
// RED FLAG — local-only logout; Entra ID SSO session persists
this.authService.logout();  // only clears MSAL cache

// CORRECT — full logout including Entra ID session
this.msalService.logoutRedirect({
  postLogoutRedirectUri: '/'
});
```
Local-only logout means the user's Entra ID session remains active. Another person
on the same browser can re-authenticate without entering credentials.

**Content Security Policy — required for SPA**
```html
<!-- RED FLAG — no CSP in index.html -->
<head>
  <title>App</title>  <!-- no Content-Security-Policy meta tag -->

<!-- MINIMUM for MSAL Angular (note: unsafe-eval required by some AG Grid versions) -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           connect-src 'self' https://login.microsoftonline.com https://*.microsoft.com;
           script-src 'self' 'unsafe-eval';
           style-src 'self' 'unsafe-inline';">
```
Missing CSP is a Medium finding. With `localStorage` token storage, elevate to High
(XSS + no CSP + persistent token = token theft).

**React-specific: protected route pattern**
```typescript
// RED FLAG — no wrapper, route is open
<Route path="/matters" element={<MattersComponent />} />

// CORRECT — RequireAuth wrapper or AuthenticatedTemplate
<Route path="/matters" element={
  <RequireAuth>
    <MattersComponent />
  </RequireAuth>
} />
// or with MSAL React:
<AuthenticatedTemplate>
  <MattersComponent />
</AuthenticatedTemplate>
```

#### Angular-specific security patterns

**Direct DOM manipulation** — flag any `document.querySelector`, `document.getElementById`,
`.innerHTML` assignment, or `.nativeElement.style` access. Use `Renderer2` or template bindings.

**Unsafe deserialization into framework APIs** — `JSON.parse()` output applied directly to
`gridApi.applyColumnState()`, `setFilterModel()`, `patchValue()`, or similar framework methods
without schema validation. Validate object shape before applying.

**Unscoped data export** — exports iterating `this.rowData` or equivalent full arrays instead
of `gridApi.forEachNodeAfterFilterAndSort()`. Check for audit logging of export events.

**window.prompt / native dialogs** — `prompt()`, `confirm()`, `alert()` for user input sent
to backend. Replace with Angular modal; sanitize and length-limit input before sending.

**localStorage JSON.parse without try/catch** — `JSON.parse(localStorage.getItem('key'))`
with no error handling. Wrap in try/catch with a typed fallback.

**HttpClient with no auth interceptor** — `provideHttpClient(withFetch())` with no interceptor
attaching credentials, bearer tokens, or XSRF headers. Check `app.config.ts` for missing
`withXsrfConfiguration()` or credential interceptor.

**Missing Content Security Policy** — `src/index.html` with no `<meta http-equiv="Content-Security-Policy">`.
Check backend response headers too. AG Grid requires `'unsafe-eval'` — document this in CSP.
