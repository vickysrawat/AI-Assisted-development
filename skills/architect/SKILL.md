---
name: architect
description: >
  Detects the repo type, deploys matching architecture template files into
  .claude/architecture/, checks which files are already populated, and populates
  only the missing ones by analysing the actual codebase. Triggered by
  setup-init automatically. Can also be triggered manually with:
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
> `setup-init` / architect path, not to an explicit `--deployment` re-capture.

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

Q9. Non-functional requirements (only the parts code cannot reveal — extract the rest)
    - Performance target (e.g. p95 latency, requests/sec)?    (value / "none defined")
    - Expected peak load / concurrent users?                   (value / "unknown")
    - Availability / uptime target (e.g. 99.9%)?               (value / "none defined")
    - Compliance frameworks in scope (SOC 2 / GDPR / HIPAA / none)?
    - Data residency constraints?                              (value / "none")
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

## Non-Functional Requirements & Constraints
| Item | Value |
|---|---|
| Performance target (p95 / throughput) | {Q9 answer or extracted} |
| Expected peak load | {Q9 answer} |
| Availability / uptime target | {Q9 answer} |
| Scaling model | {extract from k8s/App Service config or "⚠ needs manual input"} |
| Rate limiting | {extract from code or "⚠ needs manual input"} |
| Caching strategy | {extract from code or "⚠ needs manual input"} |
| Compliance frameworks | {Q9 answer} |
| Data residency constraints | {Q9 answer} |

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

### Step 1 post-detection — Run Bootstrap Phase 2

Immediately after `REPO_TYPE` is known (whether auto-detected or provided by the developer),
run Bootstrap Phase 2. This pre-copies the architecture templates and deploys rules — both
mechanical operations that do not require LLM analysis.

**1a. Record the detected type in `dream-init-state.json`:**
```bash
node -e "
const fs=require('fs'),p='.claude/dream-init-state.json';
let s={};try{s=JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){}
s.repo_type='REPLACE_WITH_REPO_TYPE';
fs.writeFileSync(p,JSON.stringify(s,null,2));
"
```

**1b. Run Bootstrap Phase 2:**
```bash
PLUGIN_DIR="$(cat .claude/plugin-path.txt 2>/dev/null | tr -d '\n')"
node "$PLUGIN_DIR/scripts/setup-init-bootstrap.cjs" --mode post-detect --repo-type REPLACE_WITH_REPO_TYPE
```

Wait for the script to print `✓ Bootstrap Phase 2 complete` before continuing.
Phase 2 **composes** the 8 architecture template files for this stack — merging the
stack-agnostic base in `templates/_shared/` with the stack-specific files in
`templates/<stack>/` (stack files override same-named shared files) — as *scaffolding*
with the `<!-- TEMPLATE -->` marker **retained** (the Step 3 guard detects them as
unpopulated and this skill populates them below; the marker is the authoritative
"needs population" signal, removed only after a real population pass — see ADR 0053),
and deploys matching rules to `.claude/rules/`.

---

## Step 2 — Resolve template path and file names

**Step 1b — Phase D capability probe (machine-local).** Now that the stack is
known, probe THIS machine for deterministic analyzers per
`$PLUGIN_DIR/skills/shared/phase-d-spec.md` §2 — ladders for detected stacks only. Write
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


**Common files (every stack)** — templates are **composed** from two tiers: the stack-agnostic
base in `templates/_shared/` (`architecture-data.md`, `-integrations.md`, `-security.md`,
`-decisions.md`) plus the stack-specific files in `templates/<stack>/`, with any same-named
stack file overriding the shared one. Every repo type still resolves to the same 8-file set:

| File | Populated by | Notes |
|---|---|---|
| `architecture.md` | File 1 prompt | includes two Mermaid diagrams (End-to-End + Layered) |
| `architecture-{callchains\|flows\|api}.md` | File 2 prompt | stack-specific (see below) |
| `architecture-reference.md` | File 3 prompt | package versions, CI/CD, fan-in/out |
| `architecture-data.md` | File 4 prompt | data model / schema / ownership |
| `architecture-integrations.md` | File 5 prompt | external deps + resilience + failure |
| `architecture-security.md` | File 6 prompt | trust zones + authorization model |
| `architecture-decisions.md` | File 7 prompt | **seed-only** AD-NNN log (never invent rationale) |
| `architecture-deployment.md` | Step 0.5 questionnaire | hosting/auth/secrets + NFR section |

**Stack-specific File 2 name:**

| REPO_TYPE | Template folder | File 2 |
|---|---|---|
| `DOTNET_API` | `templates/dotnet-api/` | `architecture-callchains.md` |
| `ANGULAR_NX` | `templates/angular-nx/` | `architecture-flows.md` |
| `ANGULAR_STANDARD` | `templates/angular-standard/` | `architecture-flows.md` |
| `REACT` | `templates/react/` | `architecture-flows.md` |
| `JS_LIBRARY` | `templates/js-library/` | `architecture-api.md` |
| `ASPNET_FRAMEWORK` | `templates/aspnet-framework/` | `architecture-flows.md` |
| `ASPNET_MVC` | `templates/aspnet-mvc/` | `architecture-flows.md` |
| `SPRING_BOOT` | `templates/spring-boot/` | `architecture-callchains.md` |
| `PYTHON_FASTAPI` | `templates/python-fastapi/` | `architecture-flows.md` |
| `PYTHON_DJANGO` | `templates/python-django/` | `architecture-flows.md` |
| `PYTHON_FLASK` | `templates/python-flask/` | `architecture-flows.md` |

> `architecture-data.md` is stack-adaptive: backend stacks document DB schema/entities;
> frontend stacks (angular-*, react) document client state model + API DTO shapes;
> `js-library` documents exported data structures/types.

---

## Step 3 — Deploy templates to .claude/architecture/

**Populated-files guard (run first):** Check whether all files for this repo type are
already populated. Use the **two-signal detector** from `$PLUGIN_DIR/skills/shared/arch-populated-detect.md`
(`arch_unfilled` = TEMPLATE marker on line 1 **or** a scaffold-only body token) — do NOT
use a bare `grep TEMPLATE`, which mis-reads a marker-free-but-empty file as populated:

```bash
# arch_unfilled() is defined in ../shared/arch-populated-detect.md — source or inline it.
for f in .claude/architecture/architecture.md .claude/architecture/architecture-*.md; do
  [ -f "$f" ] && { arch_unfilled "$f" && echo "$f: NEEDS_POPULATION" || echo "$f: POPULATED"; } || echo "$f: MISSING"
done
```

If ALL expected files for this `REPO_TYPE` exist **and** none is `NEEDS_POPULATION`
→ **skip Steps 3–6 entirely and proceed directly to Step 7.**

```bash
mkdir -p .claude/architecture
```

This is the fallback path for when Bootstrap Phase 2 did **not** run (e.g. the architect
skill was invoked standalone). Deploy by **composing** the two template tiers — read
`templates/_shared/*.md` first, then overlay `templates/<stack>/*.md` so any same-named
stack file wins — then, for each of the eight resulting files:
1. Check if `.claude/architecture/{filename}` already exists
2. If it does **and is not `arch_unfilled`** (real application content) → **skip it**, mark as `POPULATED`
3. If it does not exist or is `arch_unfilled` → copy the composed template **with the
   `<!-- TEMPLATE -->` marker retained**, mark as `NEEDS_POPULATION`

To detect whether a file contains real content vs scaffolding, use the two-signal
`arch_unfilled` detector from `$PLUGIN_DIR/skills/shared/arch-populated-detect.md` (marker on line 1,
or a scaffold-only body token). Every deployed template carries the `<!-- TEMPLATE -->`
marker through every copy path; it is removed only after a real population pass (Step 5).
Never strip the marker on copy — an interrupted run would then leave an undetectable
empty file.

```bash
# Two-signal check (see ../shared/arch-populated-detect.md)
arch_unfilled .claude/architecture/architecture.md && echo "NEEDS_POPULATION" || echo "POPULATED"
```

Report after this step:
```
.claude/architecture/
  ✓ architecture.md          — already populated, skipping
  ⬜ architecture-flows.md   — template deployed, needs population
  ⬜ architecture-reference.md — template deployed, needs population
```

If all files are already populated → output:
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

The prompt file contains seven sections: `## File 1 Prompt` (architecture.md, incl. the two
Mermaid diagrams) through `## File 7 Prompt` (architecture-decisions.md, seed-only). Run only
the prompts for files marked `NEEDS_POPULATION`. `architecture-deployment.md` is not prompt-
driven — it is produced by the Step 0.5 questionnaire.

---

## Step 5 — Populate files (parallel where possible)

Run File 1 (architecture.md, incl. both Mermaid diagrams) and File 2 in parallel.
Run the remaining code-populated prompts once orientation is established:
- **File 3** (reference), **File 4** (data), **File 5** (integrations), **File 6** (security)
  — after File 1/2; these benefit from the structure already mapped and may run in parallel.
- **File 7** (decisions, **seed-only**) — run last, after File 1, so it can reference the
  detected stack and layering. **Skip entirely if `architecture-decisions.md` already
  contains real `AD-NNN` entries** — it is an append-only human log, not regenerated.

For each file:
1. Execute the prompt against the actual codebase
2. Write the output to `.claude/architecture/{filename}`
3. Remove the `<!-- TEMPLATE -->` marker from the first line — **this is the only
   place the marker is ever removed** (no copy/deploy path strips it; see ADR 0053)
4. Every section that could not be determined from code must contain:
   `> ⚠ Could not determine — needs manual input`
   rather than being left empty or guessed.
5. For `architecture.md`, ensure both ` ```mermaid ` blocks are syntactically valid
   (balanced brackets, no stray `()[]{}` inside node labels). If the layer graph is not
   derivable, keep the `⚠` marker instead of emitting an empty/invalid diagram.

---

## Step 6 — Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Architecture docs populated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Repo type : {REPO_TYPE}

  ✓ architecture.md            {N sections, M flagged} (+ 2 Mermaid diagrams)
  ✓ architecture-{flows|callchains|api}.md  {N sections, M flagged}
  ✓ architecture-reference.md  {N sections, M flagged}
  ✓ architecture-data.md       {N sections, M flagged}
  ✓ architecture-integrations.md {N sections, M flagged}
  ✓ architecture-security.md   {N sections, M flagged}
  ✓ architecture-decisions.md  {N AD entries seeded — rationale flagged for human}

  Skipped (already populated):
    [list any skipped files]

Flagged sections need manual input — search for ⚠ in the files.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Reference files

| File | Purpose |
|---|---|
| `$PLUGIN_DIR/skills/shared/graph-json-schema.md` | Schema for `.claude/graph/graph.json` (authoritative structure — typed nodes/edges, fingerprints) |
| `$PLUGIN_DIR/skills/shared/graph-index-schema.md` | Schema for `.claude/graph/graph-index.md` (breadth index projection) |
| `$PLUGIN_DIR/skills/shared/graph-module-schema.md` | Schema for `.claude/graph/<module>.md` (per-module depth projection) |
| `$PLUGIN_DIR/skills/shared/scope-flags-spec.md` | Scope flag definitions (informational) |

## Model routing

This skill is in the **infrastructure tier** — it uses `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

architecture doc generation — detects repo type, populates templates, generates the knowledge graph

To override for this project:
```json
{ "env": { "INFRA_MODEL": "claude-opus-4-6" } }
```

See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full routing specification.

## Persona

Execute as **[SA] Rafael Mendes — Solution Architect** (16 yrs). Optimizes for a coherent, operable
picture of the system; always asks "where are the seams and who owns each?" Classify module types,
infer non-parseable relationships, and name domains in terms of **this project's actual stack and
topology** (per detected_stacks) — never a fixed technology.

The persona sets *what to scrutinize* — it never licenses assumption. The codebase and its manifests
are the only sources of truth; document what is actually there, never what a persona would "expect"
(subordinate to CLAUDE.md §3 / decision transparency). Never name the persona in any artifact. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`$PLUGIN_DIR/skills/shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.

---

## Hard Rules

- NEVER overwrite a file that already has real content — skip and report
- NEVER invent facts — every value must come from actual source files
- NEVER leave a section empty — use the `⚠ Could not determine` marker instead
- NEVER run File 3–6 in parallel with File 1/2 — they run after
- NEVER overwrite `architecture-decisions.md` once it has real `AD-NNN` entries — it is an
  append-only, human-maintained log; the seed pass runs only on a fresh/empty file
- NEVER invent a decision's *rationale*, an authorization rule, an SLA, a timeout, or an NFR
  target — seed only what code/config proves and flag the rest with `⚠`
- NEVER emit an empty or invalid Mermaid block — keep the `⚠` marker if a diagram is not derivable
- If a source file cannot be read, note the path and continue with available files

---

## Step 7 — Generate the codebase knowledge graph

After populating architecture docs, generate the **codebase knowledge graph** in
`.claude/graph/`. The graph is the single orientation layer for the plugin
(ADR 0038): every skill that
needs codebase orientation — `icea-feature`, `icea-review`, `code-review`,
`security`, and others — reads it instead of scanning raw source. It replaces the
former `domain-map.md` (retired in v3.0.0, ADR 0017 superseded).

The graph has three parts:
- **`graph.json`** — the **authoritative structure**: typed nodes, typed edges with
  confidence, module-wide fingerprints, hub flags. See `$PLUGIN_DIR/skills/shared/graph-json-schema.md`.
  Never auto-loaded (no `paths:`).
- **`graph-index.md`** — an always-loaded breadth index (module → entry point), *projected
  from* `graph.json`. See `$PLUGIN_DIR/skills/shared/graph-index-schema.md`.
- **`graph/<module>.md`** — one on-demand depth file per module (bounded context, key files,
  dependencies, patterns; ≤400 tokens; auto-loads via `paths:` frontmatter), *projected from*
  `graph.json`. See `$PLUGIN_DIR/skills/shared/graph-module-schema.md`.

The graph is **committed and PR-reviewed** — it is *not* gitignored (v3.0.0).

### Step 7-1 — Determine structure

Identify modules from the directory tree (one module per bounded context / top-level
source folder — the same derivation used for architecture docs). Count them:

| Module count | Structure |
|---|---|
| ≤ 30 | `flat` — detail files at `.claude/graph/<module>.md` |
| > 30 | `domain` — grouped: `.claude/graph/<domain>/<module>.md` |

```bash
mkdir -p .claude/graph
TODAY=$(date +%Y-%m-%d)
```

### Step 7-2 — Build `graph.json` (authoritative structure — do this first)

For each module, assemble a node per `$PLUGIN_DIR/skills/shared/graph-json-schema.md`: `id`, `module`,
`domain`, `type` (classify: `service`/`repository`/`ui`/`datastore`/`external-api`/
`shared-lib`/`domain`), `detailFile`, `entryPoint`, `paths` (source-root glob(s) — an
array; multi-root modules list each), and the **module-wide** `fingerprint` computed
over all files under `paths` (use the `graph_module_fingerprint` helper in
`graph-json-schema.md` — *not* a single-file sha1). Add any `edges` you can see that a
parser cannot (`INFERRED`/`AMBIGUOUS`: DI, dynamic/config wiring, prose-only), and set
`hub: true` on the most-connected nodes.

**Before writing, build `directoryCatalog` in memory** (same as graph-sync Step 8d):

```bash
# Requires GNU grep for -oP.
# Build output directories (Angular outputPath, Next.js distDir) are intentionally excluded —
# build output is out of scope by nature; the risk is source files committed and served directly.

# Static-serving — name-based
find . -not -path "./.git/*" -not -path "./node_modules/*" \
  -not -path "./dist/*" -not -path "./bin/*" -not -path "./obj/*" \
  -type d \( -name "public" -o -name "wwwroot" -o -name "assets" \
    -o -name "static" -o -name "StaticFiles" -o -name "Content" \) \
  | sed 's|^\./||' | sort

# Static-serving — config-based (custom source paths from app code)
# .NET: UseStaticFiles with PhysicalFileProvider
grep -rn --include="*.cs" "UseStaticFiles" . 2>/dev/null \
  | grep -v "node_modules\|\.git\|bin\|obj" \
  | grep -oP '(?<=PhysicalFileProvider\()[^)]+' \
  | grep -oP '"[^"]*"' | tr -d '"' | sort -u
# Express: express.static('path')
grep -rn --include="*.js" --include="*.ts" --include="*.mjs" \
  'express\.static(' . 2>/dev/null \
  | grep -v "node_modules\|\.git\|dist" \
  | grep -oP "express\.static\(\s*['\"]([^'\"]+)['\"]" \
  | grep -oP "['\"][^'\"]+['\"]" | tr -d "'\"" | sort -u
# Nginx: root directive — relative paths only (absolute paths are deployment-time)
find . \( -name "*.conf" -o -name "*.nginx" \) 2>/dev/null \
  | grep -v "\.git\|node_modules" \
  | xargs grep -h "^\s*root " 2>/dev/null \
  | grep -oP "root\s+\K[^;]+" | grep -v '^/' | sort -u

# Config directories
find . -not -path "./.git/*" -not -path "./node_modules/*" \
  -maxdepth 3 -type d \( -name "environments" -o -name "env" \
    -o -name ".github" -o -name "infra" -o -name "terraform" \
    -o -name "k8s" -o -name "helm" \) \
  | sed 's|^\./||' | sort

# Test directories
find . -not -path "./.git/*" -not -path "./node_modules/*" \
  -not -path "./dist/*" -maxdepth 4 \
  -type d \( -name "test" -o -name "tests" -o -name "__tests__" \
    -o -name "spec" -o -name "e2e" -o -name "cypress" \) \
  | sed 's|^\./||' | sort
```

Add to the in-memory graph object before the write:
```javascript
// reviewed defaults false on initial generation — developer validates via security skill §0.5
g.directoryCatalog = { generatedAt: TODAY, reviewed: false, staticServing: [...], config: [...], test: [...] };
```

Now write `.claude/graph/graph.json` deterministically (sorted, stable key order, includes
`directoryCatalog`). Then populate the source-visible `EXTRACTED` edges **deterministically**
— resolve `$PLUGIN_DIR` (`$PLUGIN_DIR/skills/shared/plugin-path-resolution.md` §1a) and run
`node "$PLUGIN_DIR/scripts/graph-extract-edges.js"` (parses imports locally, offline;
rewrites only `EXTRACTED` edges; never touches `nodes`/`fingerprint`s/`directoryCatalog`;
ADR 0041). **Never hand-write an `EXTRACTED` edge.**
Confirm: `✓ Written: .claude/graph/graph.json (~N tokens)`.

### Step 7-3 — Project one detail file per module

For each node, write a detail file following `$PLUGIN_DIR/skills/shared/graph-module-schema.md` exactly:
`paths:` frontmatter (first root), the ambient-context comment,
`_Fingerprint: {node.fingerprint} | Updated: {TODAY}_`, the four sections (Bounded
context, Key files ≤5, Dependencies with types, Patterns), and — when it fits under 400
tokens — a `**Depended on by:**` line. Write silently — confirm each with
`✓ Written: .claude/graph/<module>.md (~N tokens)`.

### Step 7-4 — Project graph-index.md

Build the index following `$PLUGIN_DIR/skills/shared/graph-index-schema.md` — `paths: always`
frontmatter, header line (`Generated | Modules: N | Structure`), and one table row
per node (`Module | Domain | Detail File | Entry Point`), matching `graph.json` exactly.

### Rules
- Do NOT invent modules — only map what exists in the directory tree
- Omit test files, migrations, and auto-generated files
- If a folder has only 1–2 files, merge it into the closest parent module
- Overwrite existing graph files — they are generated, not human-maintained
- `graph.json` is authoritative; the index and detail files are projected from it
- Every node carries a **module-wide** `fingerprint` (per-module staleness over all its
  files); there is no separate whole-repo fingerprint

### Confirm to developer
After writing:
```
✓ .claude/graph/ written — <N> modules mapped (graph.json + index + detail files)
  Used by: icea-feature · icea-review · code-review · security · …
  Refresh incrementally with /graph-sync
```
