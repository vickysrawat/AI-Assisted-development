# ZAP Authentication

Configure auth in the Automation Framework context. A **verification strategy** with a
logged-in or logged-out indicator is mandatory — without it ZAP will not run the auth
script and the scan will silently test only the login page.

## Verification gate (skill Step 1d)

After the first authenticated request, read ZAP's internal statistic
`stats.auth.state.loggedin`. If `0`, authentication failed — STOP and report it; do not
scan. If `> 0`, proceed.

## Form-based

```yaml
authentication:
  method: "form"
  parameters:
    loginPageUrl: "http://host.docker.internal:PORT/Account/Login"
    loginRequestUrl: "http://host.docker.internal:PORT/Account/Login"
    loginRequestBody: "Email={%username%}&Password={%password%}"
verification:
  method: "response"
  loggedInRegex: "\\bLogout\\b"
  loggedOutRegex: "\\bLogin\\b"
users:
  - name: tester
    credentials: { username: "${ZAP_USER}", password: "${ZAP_PASS}" }
```
ASP.NET MVC forms post an antiforgery token — add its field name in the ZAP Anti-CSRF
options so ZAP extracts and replays it; otherwise POSTs return 400.

## Token / JWT (APIs)

Set at the SYSTEM level (NOT in the plan env block — ZAP ignores auth header vars there):
```bash
export ZAP_AUTH_HEADER_VALUE="Bearer eyJ..."   # ZAP_AUTH_HEADER defaults to Authorization
```
Decode the JWT and flag weak algorithms (`alg: none`, guessable HS256 secret). Tokens
expire — for long scans warn the user the token may need refreshing mid-scan.

## OAuth / Azure AD

Headless OAuth redirects are not reliable. Two options:
1. Script-based auth job that performs the token exchange, OR
2. Manual: log in via ZAP's browser, capture the session, then scan. Document the manual
   step for the user — do not promise headless Azure AD.

## Windows / NTLM

See `zap-windows-auth.md` — separate handling, possible blocker headless.
