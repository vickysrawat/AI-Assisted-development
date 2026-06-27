---
name: architect
description: >
  Detects the repo type, deploys matching architecture template files into
  .claude/architecture/, checks which files are already populated, and populates
  only the missing ones by analysing the actual codebase. Triggered by
  dream-init automatically. Can also be triggered manually with:
  "populate architecture docs", "document the architecture",
  "run the architect skill", or "fill in the architecture files".
---

# Architect Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: B_
Detects repo type → deploys templates → checks population state → populates missing files.

---

## Step 0.5 — Collect deployment context

**Run this before anything else.** Check whether `.claude/architecture/architecture-deployment.md`
already exists and is populated (no `⚠ Not yet answered` markers):

```bash
ls .claude/architecture/architecture-deployment.md 2>/dev/null || echo "MISSING"
grep "Not yet answered" .claude/architecture/architecture-deployment.md 2>/dev/null | wc -l
```

If the file exists and has 0 `⚠ Not yet answered` markers — **skip this step entirely**.
The deployment context is already captured.

> **FORCE mode exception:** when this step is invoked by `/update-arch --deployment`
> (an explicit re-capture request), do NOT apply the skip above. Re-run the
> questionnaire even on a fully-populated file, pre-filling the current answers as
> defaults the developer can keep or change. The skip applies only to the normal
> `dream-init` / architect path, not to an explicit `--deployment` re-capture.

If the file is missing or has unanswered markers — run the CI/CD detection pass first,
then ask only the questions the filesystem cannot answer.

### CI/CD and deployment detection

```bash
echo "=== Azure DevOps Pipelines ==="
find . -name "azure-pipelines*.yml" -o -name "azure-pipelines*.yaml" -maxdepth 3 2>/dev/null
ls .azure/ 2>/dev/null

echo "=== GitHub Actions ==="
ls .github/workflows/ 2>/dev/null

echo "=== Other CI ==="
ls Jenkinsfile .gitlab-ci.yml bitbucket-pipelines.yml 2>/dev/null

echo "=== Web Deploy / IIS publish profiles ==="
find . -name "*.pubxml" -maxdepth 4 2>/dev/null

echo "=== Docker ==="
ls Dockerfile docker-compose*.yml .dockerignore 2>/dev/null

echo "=== IIS web.config ==="
find . -name "web.config" -maxdepth 3 2>/dev/null

echo "=== Deploy scripts ==="
find . -maxdepth 3 \( -name "deploy*.ps1" -o -name "deploy*.sh" -o -name "publish*.ps1" \) 2>/dev/null
```

Report what was detected, then ask only the unanswered questions below.
Do not ask questions the filesystem evidence already answers.

### Phase 1 — Detect authentication signals

Before asking questions, scan for auth patterns so Entra ID questions
are only presented when relevant:

```bash
echo "=== Entra ID / Azure AD signals ==="
grep -r "AddMicrosoftIdentityWebApi\|AddMicrosoftIdentityWebApp\|AzureAd\|MicrosoftIdentity\|\.microsoft\.com/.*tenant\|TenantId\|ClientId"   --include="*.cs" --include="*.json" --include="*.ts" -l . 2>/dev/null | head -5

echo "=== MSAL (Entra ID SPA) ==="
grep -r "@azure/msal-angular\|@azure/msal-browser\|PublicClientApplication\|InteractionType" \
  --include="*.ts" --include="*.json" -l . 2>/dev/null | head -5

echo "=== SPA route guards ==="
grep -r "CanActivate\|CanActivateFn\|MsalGuard\|AuthGuard\|RequireAuth\|PrivateRoute" \
  --include="*.ts" --include="*.tsx" -l . 2>/dev/null | head -5

echo "=== SPA HTTP interceptors ==="
grep -r "HttpInterceptor\|withInterceptors\|HTTP_INTERCEPTORS\|MsalInterceptor" \
  --include="*.ts" -l . 2>/dev/null | head -5

echo "=== React MSAL / OIDC ==="
grep -r "useMsal\|useIsAuthenticated\|AuthenticatedTemplate\|react-oidc\|oidc-client" \
  --include="*.tsx" --include="*.ts" --include="*.jsx" -l . 2>/dev/null | head -5

echo "=== Token storage risk ==="
grep -r "localStorage.setItem\|sessionStorage.setItem" \
  --include="*.ts" --include="*.tsx" --include="*.js" -l . 2>/dev/null | head -5

echo "=== Auth error / refresh handling ==="
grep -r "acquireTokenSilent\|acquireTokenRedirect\|loginRedirect\|InteractionRequiredAuthError" \
  --include="*.ts" -l . 2>/dev/null | head -5

echo "=== PKCE / implicit flow ==="
grep -r "responseType.*token\|response_type.*token\|implicitGrantSettings" \
  --include="*.ts" --include="*.json" . 2>/dev/null

echo "=== JWT / OAuth generic (backend) ==="
grep -r "AddJwtBearer\|AddAuthentication\|UseAuthentication\|JwtBearerDefaults" \
  --include="*.cs" -l . 2>/dev/null | head -5

echo "=== App registrations / scope config ==="
grep -r "Scopes\|ClientSecret\|Instance.*login\.microsoftonline\|Authority\|clientId" \
  --include="*.json" --include="*.cs" --include="*.ts" -l . 2>/dev/null | head -5
```

Hold result as:
- `AUTH_ENTRA` = true if any Entra/MSAL/AzureAd signals found
- `AUTH_SPA` = true if Angular or React SPA is present (angular.json or react in package.json)
- `AUTH_SPA_GUARDS` = true if route guard files found
- `AUTH_SPA_INTERCEPTOR` = true if HTTP interceptor files found
- `AUTH_SPA_LOCAL_STORAGE` = true if localStorage.setItem found (potential token storage risk)
- `AUTH_JWT_GENERIC` = true if only generic JWT bearer with no Entra signals
- `AUTH_NONE` = true if no auth signals found at all

---

### Phase 2 — Ask all questions, one pass

Present the full questionnaire based on what was detected.
**Do not write anything yet.** Collect every answer first.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DEPLOYMENT CONTEXT — {N} questions
   Detected: {list detected signals e.g. "azure-pipelines.yml · Entra ID auth"}
   Nothing will be written until you review the draft and type APPROVED.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q1. Hosting model — how is this application hosted in production?
    a) IIS on Windows Server (on-premises or Azure VM)
    b) Azure App Service (code deploy — not containerised)
    c) Docker / containerised (k8s, ACI, App Service containers)
    d) Windows Service / background worker
    e) Multiple of the above — which component uses which?

Q2. CI/CD pipeline
    Detected: {detected file(s) or "none found"}
    ADO org:  {from CLAUDE.md or "not found — please provide"}
    ADO project: {from CLAUDE.md or "not found — please provide"}

    - Does the pipeline deploy automatically to staging?       (yes / no / not configured)
    - Is there a manual approval gate before production?       (yes / no / not configured)
    - Are pipeline runs linked to ADO work items?              (yes / no / not sure)

Q3. Environments — list in deployment order
    (e.g. Local → Dev → Staging → Production  or  Local → UAT → Production)

Q4. Secrets management in production
    a) Azure Key Vault via Managed Identity (no credentials in config)
    b) Azure Key Vault via Client Secret (secret stored in environment variable)
    c) Environment variables set at the host / App Pool level
    d) Windows Credential Manager / DPAPI
    e) appsettings.json deployed to the server
    f) Not yet decided / still hardcoded

Q5. Rollback procedure — if a bad deployment reaches production
    a) Re-run the previous ADO pipeline run
    b) Manual IIS binding switch / restore backup site
    c) Azure App Service slot swap
    d) No documented rollback procedure yet
    e) Other — describe

Q6. Database
    a) EF Core migrations run automatically by the pipeline
    b) EF Core migrations run manually before deployment
    c) DBA-managed SQL scripts deployed separately
    d) No database
```

**Only show Q7 if `AUTH_ENTRA` is true:**
```
Q7. Entra ID (Azure AD) authentication — detected in this codebase

    Q7a. Authentication flow
         a) Single tenant — only your organisation's users (one tenant ID)
         b) Multi-tenant — users from any Azure AD tenant
         c) B2C — external / consumer identities (Azure AD B2C)
         d) Not sure — the config is there but I haven't confirmed the intent

    Q7b. App registrations
         How many Azure AD app registrations does this application use?
         (e.g. 1 for the API only · 2 for API + SPA · separate registrations per environment)

    Q7c. Token validation
         Where is the bearer token validated?
         a) .NET API using Microsoft.Identity.Web (AddMicrosoftIdentityWebApi)
         b) .NET API using manual AddJwtBearer with Microsoft authority
         c) Angular/SPA validates and sends token; API trusts it without re-validating
         d) Not sure

    Q7d. Scopes and roles
         Does the application use:
         a) App roles defined in the app registration manifest
         b) Azure AD groups mapped to application roles
         c) Delegated scopes only (user acts on their own behalf)
         d) Both app roles and delegated scopes
         e) Not yet configured

    Q7e. Service-to-service calls
         Does any part of this application call other APIs or Azure services
         using a Managed Identity or Client Credentials flow?  (yes / no / not sure)
         If yes — which services?

    Q7f. Token storage (frontend)
         If there is an Angular or SPA frontend using MSAL:
         a) MSAL session storage (default — cleared on tab close)
         b) MSAL local storage (persists across sessions — higher XSS risk)
         c) No frontend auth — API-only application

    Q7g. Conditional Access
         Are any Conditional Access policies applied to this application
         in Entra ID?  (yes / no / not sure)
         If yes — MFA required? Compliant device required? Named location?
```

**Only show Q7h if `AUTH_SPA` is true (Angular or React frontend detected):**
```
    Q7h. SPA authentication implementation

         Q7h-1. Authentication flow
                Which OAuth2 flow does the SPA use?
                a) Authorization Code with PKCE — correct, secure
                b) Implicit flow (response_type=token in URL) — legacy, insecure, should be migrated
                c) Not sure — let me check
                (MSAL Angular/Browser v2+ uses PKCE by default — confirm in MSAL config)

         Q7h-2. Route protection
                How are protected routes secured in the SPA?
                a) Angular: MsalGuard on every protected route in app-routing.module.ts
                b) Angular: Custom AuthGuard implementing CanActivate/CanActivateFn
                c) React: PrivateRoute / RequireAuth wrapper component
                d) React: AuthenticatedTemplate from @azure/msal-react
                e) No route guards — relying on API to reject unauthenticated calls
                f) Mix of the above — describe

         Q7h-3. Token attachment
                How does the SPA attach tokens to API calls?
                a) MsalInterceptor configured with protectedResourceMap (automatic per URL)
                b) Custom HttpInterceptor reads token and adds Authorization header
                c) Manual — each service/component calls acquireTokenSilent() and adds header
                d) Tokens are NOT attached — API calls are unauthenticated from the SPA
                e) Not sure

         Q7h-4. Silent token refresh
                How does the SPA handle token expiry?
                a) MsalInterceptor handles automatically (acquireTokenSilent → redirect on failure)
                b) Custom refresh logic using acquireTokenSilent with fallback to loginRedirect
                c) Page reload / re-login required when token expires
                d) Not handled — users get 401 errors after token expiry

         Q7h-5. Auth error handling
                What happens when authentication fails or the user's session expires?
                a) MsalBroadcastService listens for InteractionStatus.None + handles errors
                b) HTTP interceptor catches 401 and triggers loginRedirect
                c) Error shown to user with no automatic recovery
                d) Errors are silently swallowed — user sees a broken page
                e) Not implemented yet

         Q7h-6. Post-login redirect
                Where does the SPA redirect after successful login?
                a) Back to the route the user originally requested (using redirect URI state)
                b) Always to a fixed home/dashboard page
                c) Not configured — sometimes lands on a blank MSAL callback page

         Q7h-7. Logout
                What does logout do?
                a) logoutRedirect() / logoutPopup() — clears MSAL cache and Entra ID session
                b) Local only — clears local token but Entra ID session remains (SSO persists)
                c) No logout implemented
```

**Only show Q8 if `AUTH_NONE` is true:**
```
Q8. No authentication signals detected
    Is this application intentionally unauthenticated (public API, static site)?
    Or is authentication planned but not yet implemented?
    a) Intentionally public — no auth required
    b) Auth planned but not implemented yet
    c) Auth is handled by a reverse proxy / API gateway upstream (describe)
```

---

### Phase 3 — Present draft for approval

Once all answers are received, build the complete draft content for
`architecture-deployment.md` and display it in full:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 DEPLOYMENT CONTEXT DRAFT
   Review carefully — this will be written to:
   .claude/architecture/architecture-deployment.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Architecture — Deployment & Operations

## Hosting Model
{Q1 answer — full description}

## CI/CD Pipeline
| Item | Value |
|---|---|
| Tool | Azure DevOps Pipelines |
| Pipeline file | {detected or provided} |
| Organisation | {ADO org} |
| Project | {ADO project} |
| Auto-deploy to staging | {Q2 answer} |
| Approval gate before production | {Q2 answer} |
| Work item linking | {Q2 answer} |

## Environments
| Environment | Deployment trigger |
|---|---|
{Q3 — one row per environment}

## Secrets Management
{Q4 answer — full description}

## Authentication
{If AUTH_ENTRA:}
| Item | Value |
|---|---|
| Provider | Microsoft Entra ID (Azure AD) |
| Tenant model | {Q7a} |
| App registrations | {Q7b} |
| Token validation | {Q7c} |
| Scopes / roles | {Q7d} |
| Service-to-service | {Q7e} |
| Frontend token storage | {Q7f} |
| Conditional Access | {Q7g} |

{If AUTH_SPA is true:}
### SPA Authentication

| Item | Value |
|---|---|
| OAuth2 flow | {Q7h-1} |
| Route protection | {Q7h-2} |
| Token attachment | {Q7h-3} |
| Silent token refresh | {Q7h-4} |
| Auth error handling | {Q7h-5} |
| Post-login redirect | {Q7h-6} |
| Logout | {Q7h-7} |

{If AUTH_JWT_GENERIC:}
| Item | Value |
|---|---|
| Provider | JWT Bearer (non-Entra) |
| Details | Needs manual documentation |

{If AUTH_NONE:}
| Item | Value |
|---|---|
| Authentication | {Q8 answer} |

## Database
{Q6 answer}

## Rollback Procedure
{Q5 answer}

## Known Infrastructure Constraints
> ⚠ Not yet documented — add any IIS version, .NET runtime, firewall, or network constraints here

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 APPROVAL REQUIRED

Reply:
  ✅ APPROVED          — draft is correct, write the file
  ✏  EDIT [field]      — e.g. "EDIT Authentication — it's multi-tenant not single"
  ❌ REJECT            — start the questions over

Nothing will be written until you reply APPROVED.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Phase 4 — Handle edits

If `EDIT [field]`:
- Update only that field in the draft
- Re-display only the changed section and the approval block
- Do not re-ask all questions

If `REJECT`:
- Clear all answers
- Re-run Phase 1 and Phase 2 from scratch

---

### Phase 5 — Write file on APPROVED only

Only after receiving the exact word `APPROVED`:

Write `.claude/architecture/architecture-deployment.md` with the approved content.

```bash
mkdir -p .claude/architecture
node -e "
const fs = require('fs');
const content = String.raw\`REPLACE_WITH_APPROVED_CONTENT\`;
fs.writeFileSync('.claude/architecture/architecture-deployment.md', content, 'utf8');
console.log('Written: .claude/architecture/architecture-deployment.md');
"
```

Confirm:
```
✅ .claude/architecture/architecture-deployment.md written

  Hosting model : {Q1}
  CI/CD         : {pipeline file} → ADO ({org}/{project})
  Environments  : {list}
  Auth          : {Entra ID / JWT / None}
  Secrets       : {Q4}
  Rollback      : {Q5}
  DB migrations : {Q6}

This file persists across sessions — the architect skill will not ask
these questions again unless you run /update-arch --deployment.
```

---

### Hard rules for Step 0.5

- **NEVER write `architecture-deployment.md` before receiving `APPROVED`**
- **NEVER skip Q7 when Entra ID signals are detected** — auth configuration is the
  most common source of production security incidents
- **NEVER accept "looks good" or "yes" as APPROVED** — the exact word is required
- **NEVER ask Q7 when AUTH_ENTRA is false** — only present relevant questions
- **NEVER ask Q7h when AUTH_SPA is false** — only present SPA questions for SPA projects
- **NEVER assume PKCE is in use** — always confirm in Q7h-1, even for MSAL Angular projects
  (MSAL Angular v1 used implicit flow; v2+ uses PKCE — the version matters)
- Ask all questions in one pass (Phase 2) before presenting the draft — do not
  ask one question, wait for answer, ask the next. Collect all answers first.

---

## Step 1 — Detect repo type

Run these checks in order. Stop at the first match.

```bash
# Nx Angular monorepo
ls nx.json 2>/dev/null && echo "ANGULAR_NX"

# Standard Angular workspace
ls angular.json 2>/dev/null && echo "ANGULAR_STANDARD"

# React (package.json with react dependency)
node -e "try{const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};if(d['react'])console.log('REACT')}catch(e){}" 2>/dev/null

# Custom JS/TS library (package.json, no framework, has main/exports)
node -e "try{const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};if(!d['react']&&!d['@angular/core']&&(p.main||p.exports||p.module))console.log('JS_LIBRARY')}catch(e){}" 2>/dev/null

# Java / Spring Boot (Maven or Gradle with a spring-boot dependency/plugin)
{ find . -name "pom.xml" -maxdepth 3 2>/dev/null | xargs grep -l "spring-boot" 2>/dev/null; \
  find . -name "build.gradle*" -maxdepth 3 2>/dev/null | xargs grep -l "org.springframework.boot" 2>/dev/null; } \
  | head -1 | grep -q "." && echo "SPRING_BOOT"

# Python — detect framework (check in priority order: Django, FastAPI, Flask)
find . -name "manage.py" -maxdepth 2 2>/dev/null | head -1 | grep -q "." && echo "PYTHON_DJANGO"
{ grep -rl "fastapi" --include=requirements.txt --include=pyproject.toml . 2>/dev/null; } \
  | head -1 | grep -q "." && echo "PYTHON_FASTAPI"
{ grep -rl "[Ff]lask" --include=requirements.txt --include=pyproject.toml . 2>/dev/null; } \
  | head -1 | grep -q "." && echo "PYTHON_FLASK"

# Legacy ASP.NET Framework (packages.config or web.config without SDK-style csproj)
ls packages.config 2>/dev/null && echo "ASPNET_FRAMEWORK"
find . -name "packages.config" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && echo "ASPNET_FRAMEWORK"

# ASP.NET MVC with Razor (SDK-style csproj + Views folder)
find . -name "*.csproj" -maxdepth 3 2>/dev/null | xargs grep -l "Microsoft.NET.Sdk.Web" 2>/dev/null | head -1 | grep -q "." && \
  ls -d */Views 2>/dev/null | grep -q "." && echo "ASPNET_MVC"

# .NET Web API (SDK-style csproj, no Views)
find . -name "*.sln" -maxdepth 2 2>/dev/null | head -1 | grep -q "." && echo "DOTNET_API"
```

Hold the detected type as `REPO_TYPE`. For Python, if more than one framework
signal matches, prefer the most specific in this order: `PYTHON_DJANGO` →
`PYTHON_FASTAPI` → `PYTHON_FLASK`. If nothing matches, output:
```
⚠ Could not detect repo type automatically.
Please specify: dotnet-api | angular-nx | angular-standard | react | js-library
              | aspnet-framework | aspnet-mvc | spring-boot
              | python-fastapi | python-django | python-flask
```
And wait for input.

---

## Step 2 — Resolve template path and file names

**Step 1b — Phase D capability probe (machine-local).** Now that the stack is
known, probe THIS machine for deterministic analyzers per
`../shared/phase-d-spec.md` §2 — ladders for detected stacks only. Write
results to `.claude/settings.local.json` under the `phaseD` key (machine-
specific, auto-gitignored — NEVER into architecture-deployment.md; tool
availability is a per-machine fact and a capability claim in a committed file
is a spec violation). Record only team POLICY in architecture-deployment.md,
e.g. "C# Phase D expected via analyzer build warnings". Report coverage to the
developer:

```
🔍 Phase D probe (this machine):
   C#  → SecurityCodeScan 5.6.7 (project-local, build-warnings mode) ✅
   JS  → eslint 8.44 (node_modules) ✅
   Re-probe anytime: /update-arch --reprobe
```


| REPO_TYPE | Template folder | File 1 | File 2 | File 3 | File 4 |
|---|---|---|---|---|
| `DOTNET_API` | `templates/dotnet-api/` | `architecture.md` | `architecture-callchains.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `ANGULAR_NX` | `templates/angular-nx/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `ANGULAR_STANDARD` | `templates/angular-standard/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `REACT` | `templates/react/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `JS_LIBRARY` | `templates/js-library/` | `architecture.md` | `architecture-api.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `ASPNET_FRAMEWORK` | `templates/aspnet-framework/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `ASPNET_MVC` | `templates/aspnet-mvc/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `SPRING_BOOT` | `templates/spring-boot/` | `architecture.md` | `architecture-callchains.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `PYTHON_FASTAPI` | `templates/python-fastapi/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `PYTHON_DJANGO` | `templates/python-django/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |
| `PYTHON_FLASK` | `templates/python-flask/` | `architecture.md` | `architecture-flows.md` | `architecture-reference.md` | `architecture-deployment.md` |

---

## Step 3 — Deploy templates to .claude/architecture/

```bash
mkdir -p .claude/architecture
```

For each of the three files:
1. Check if `.claude/architecture/{filename}` already exists
2. If it does **and contains application-specific content** (not just template headings) → **skip it**, mark as `POPULATED`
3. If it does not exist or contains only template scaffolding → copy from the plugin template, mark as `NEEDS_POPULATION`

To detect whether a file contains real content vs scaffolding, check if it contains
the marker `<!-- TEMPLATE -->` at the top. All deployed templates include this marker;
once a file is populated the skill removes it.

```bash
# Check marker
head -1 .claude/architecture/architecture.md 2>/dev/null | grep -q "TEMPLATE" && echo "TEMPLATE" || echo "POPULATED"
```

Report after this step:
```
.claude/architecture/
  ✓ architecture.md          — already populated, skipping
  ⬜ architecture-flows.md   — template deployed, needs population
  ⬜ architecture-reference.md — template deployed, needs population
```

If all three are already populated → output:
```
✅ All architecture files already populated — nothing to do.
```
And stop.

---

## Step 4 — Load the matching prompt file

Read the prompt file for this repo type:

| REPO_TYPE | Prompt file |
|---|---|
| `DOTNET_API` | `prompts/dotnet-api.md` |
| `ANGULAR_NX` | `prompts/angular-nx.md` |
| `ANGULAR_STANDARD` | `prompts/angular-standard.md` |
| `REACT` | `prompts/react.md` |
| `JS_LIBRARY` | `prompts/js-library.md` |
| `ASPNET_FRAMEWORK` | `prompts/aspnet-framework.md` |
| `ASPNET_MVC` | `prompts/aspnet-mvc.md` |
| `SPRING_BOOT` | `prompts/spring-boot.md` |
| `PYTHON_FASTAPI` | `prompts/python-fastapi.md` |
| `PYTHON_DJANGO` | `prompts/python-django.md` |
| `PYTHON_FLASK` | `prompts/python-flask.md` |

The prompt file contains three sections: `## File 1 Prompt`, `## File 2 Prompt`,
`## File 3 Prompt`. Run only the prompts for files marked `NEEDS_POPULATION`.

---

## Step 5 — Populate files (parallel where possible)

Run File 1 and File 2 prompts in parallel.
Run File 3 (reference/callchains) after File 1 and File 2 complete — it is the
most thorough pass and benefits from the orientation already established.

For each file:
1. Execute the prompt against the actual codebase
2. Write the output to `.claude/architecture/{filename}`
3. Remove the `<!-- TEMPLATE -->` marker from the first line
4. Every section that could not be determined from code must contain:
   `> ⚠ Could not determine — needs manual input`
   rather than being left empty or guessed.

---

## Step 6 — Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Architecture docs populated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Repo type : {REPO_TYPE}

  ✓ architecture.md            {N sections, M flagged}
  ✓ architecture-flows.md      {N sections, M flagged}
  ✓ architecture-reference.md  {N sections, M flagged}

  Skipped (already populated):
    [list any skipped files]

Flagged sections need manual input — search for ⚠ in the files.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Reference files

| File | Purpose |
|---|---|
| `../shared/domain-map-spec.md` | Canonical schema and authoring rules for domain-map.md |
| `../shared/scope-flags-spec.md` | Scope flag definitions (informational) |

## Model routing

This skill is in the **infrastructure tier** — it uses `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

architecture doc generation — detects repo type, populates templates, generates domain-map

To override for this project:
```json
{ "env": { "INFRA_MODEL": "claude-opus-4-6" } }
```

See `../shared/model-routing-spec.md` for the full routing specification.

---

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`../shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.

---

## Hard Rules

- NEVER overwrite a file that already has real content — skip and report
- NEVER invent facts — every value must come from actual source files
- NEVER leave a section empty — use the `⚠ Could not determine` marker instead
- NEVER run File 3 in parallel with File 1/2 — it must run after
- If a source file cannot be read, note the path and continue with available files

---

## Step 7 — Generate domain-map.md (NEW)

After populating architecture docs, write a `domain-map.md` to `.claude/architecture/`.
This file is a lightweight index used by `icea-feature`, `code-review`, and
`security-review` to orient themselves without reading raw source files.

### Format

Before writing, compute the entry-point fingerprint:
```bash
# Collect all entry-point paths that will appear in the map (sort for stability)
# Then hash them together
ENTRIES=$(grep "^- \*\*Entry point\*\*:" .claude/architecture/domain-map.md 2>/dev/null | sed "s/.*\`\(.*\)\`.*/\1/" | sort)
FINGERPRINT=$(echo "$ENTRIES" | xargs -I{} sha1sum "{}" 2>/dev/null | sha1sum | cut -d' ' -f1)
TODAY=$(date +%Y-%m-%d)
```

```markdown
# domain-map.md
_Auto-generated by architect skill. Re-run `/ai-assisted-development:dream-init`
or ask "run the architect skill" after major structural changes._
_Generated: {TODAY}_
_Fingerprint: {FINGERPRINT}_

## Stack
- Backend: <detected stack>
- Frontend: <detected stack>
- Middleware: <detected stack if present>

## Feature Areas

### <AreaName>
- **Layer**: Backend | Frontend | Middleware | Shared
- **Entry point**: `<path/to/MainFile>`
- **Key files**:
  - `<path/to/FileA>` — <one-line description>
  - `<path/to/FileB>` — <one-line description>
- **Notes**: <cross-cutting concerns, patterns, gotchas — omit if none>

---
```

Repeat the `### <AreaName>` block for every meaningful feature area discovered.
Use folder names and file naming patterns to infer area names — do NOT read file
contents to produce this map.

### Rules
- Maximum 3 files per area in "Key files" — entry point is separate
- Omit test files, migrations, and auto-generated files from the map
- If a folder has only 1–2 files, merge it with the closest parent area
- Do NOT invent feature areas — only map what exists in the directory tree
- Write to `.claude/architecture/domain-map.md` — overwrite if already exists (this
  is a generated file, not a human-maintained one)
- Always include `_Generated: YYYY-MM-DD_` and `_Fingerprint: <sha1>_` header lines
  (see `../shared/domain-map-spec.md` for the fingerprint computation)

### Confirm to developer
After writing:
```
✓ .claude/architecture/domain-map.md written — <N> feature areas mapped
  Used by: icea-feature · code-review · security-review
```
