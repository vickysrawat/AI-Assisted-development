---
name: app-readiness
description: >
  Assesses whether the application is production ready from an Enterprise Architect
  and Solution Architect perspective. Evaluates 8 domains: deployment pipeline,
  resilience, observability, security posture, scalability, data integrity,
  operational runbook, and test coverage. Produces an HTML report.
  Triggered by: "is the app production ready", "app readiness", "production readiness
  check", "enterprise architecture review", "solution architecture review",
  "go-live readiness", "is this ready to deploy", "production checklist".
---

# App Production Readiness Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: B_
Evaluates whether the application is ready for production from an Enterprise Architect
and Solution Architect perspective. Reads deployment context from
`.claude/architecture/architecture-deployment.md`, queries ADO for pipeline state,
and applies the correct checklist for the hosting model (IIS vs container vs App Service).

---

## Model routing

This skill is in the **infrastructure tier** — uses `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

For higher-quality analysis on complex architectures:
```json
{ "env": { "INFRA_MODEL": "claude-opus-4-6" } }
```

See `../shared/model-routing-spec.md`.

## Persona

Execute as **[EA] Grace Lin — Enterprise Architect** (20 yrs). Optimizes for go-live safety across
all readiness domains; always asks "what happens at 3am when this fails?" Weigh [SA] Solution
Architect concerns on structure. Reasons about this project's actual stack, deployment topology, and
operational posture — never a fixed technology.

The persona sets *what to scrutinize* — it never licenses assumption. Architecture docs, ADO pipeline
state, and the codebase are the only sources of truth; a persona's "experience" is never evidence
(subordinate to CLAUDE.md §3 / decision transparency). Never name the persona in any artifact. See
`../shared/personas-spec.md`.

---

## Source file consent

This skill is **Category B** — requires explicit consent before reading any source file.
See `../shared/source-file-consent.md`.

Phase 0 (bash), Phase 1 (architecture docs + ADO API), and Phase 2 (readiness checks)
produce the full report without reading any source files.
Phase 3 (targeted source reads for Red findings) requires the consent gate for each file.

---

## Step 0 — Resolve scope

Check for `--quick` or `--full` flag:

| Flag | Behaviour |
|---|---|
| `--quick` | Phase 0 + Phase 1 + Phase 2 (no source reads) — ~12K tokens |
| `--full` | All phases including targeted source reads for Red domains — ~25K tokens |
| (none) | Default: `--quick` |

Announce:
```
🏗 App Production Readiness Assessment
  Mode    : {--quick / --full}
  Reading : deployment docs + ADO pipeline state
  Source reads: {none (--quick) / consent-gated for Red domains (--full)}
```

---

## Step 1 — Load deployment context

Read `.claude/architecture/architecture-deployment.md`:

```bash
cat .claude/architecture/architecture-deployment.md 2>/dev/null || echo "MISSING"
```

If MISSING or all `⚠ Not yet answered`:
```
⚠ Deployment context not captured.
Run the architect skill first to answer the deployment questionnaire:
  "run the architect skill"
Or run: /ai-assisted-development:update-arch --deployment
```
And stop.

Extract and hold:
- `HOSTING_MODEL` — IIS | container | app-service | windows-service | mixed
- `ADO_ORG` — organisation name
- `ADO_PROJECT` — project name
- `PIPELINE_FILE` — pipeline YAML file name(s)
- `ENVIRONMENTS` — list of environments
- `SECRETS_STRATEGY` — how secrets are managed
- `ROLLBACK_PROCEDURE` — documented or undocumented
- `DB_MIGRATION` — migration strategy
- `AUTH_PROVIDER` — Entra ID | JWT | None
- `ENTRA_TENANT_MODEL` — single | multi | B2C | unknown
- `ENTRA_TOKEN_VALIDATION` — AddMicrosoftIdentityWebApi | AddJwtBearer | client-trusts | unknown
- `ENTRA_SERVICE_TO_SERVICE` — Managed Identity | Client Secret | None

Also read `.claude/architecture/architecture.md` for tech stack context.

Also read, if present, for richer scoring:
- `.claude/architecture/architecture-security.md` — trust zones + authorization model → feeds
  the security-posture scoring (documented authz model, sensitive-data handling).
- The `## Non-Functional Requirements & Constraints` section of `architecture-deployment.md`
  and `architecture-integrations.md` (resilience/failure behavior) → feed the Resilience (EA-2),
  Observability (EA-3), and Scalability (EA-5) domains (performance baseline documented,
  dependency failure handling, availability target). If NFR targets are unpopulated, score the
  relevant domain no higher than 4 and note "NFR targets not captured".

---

## Step 2 — Load analysis references

Read `.claude/plugin-path.txt` to get PLUGIN_DIR (if absent, resolve via
`skills/shared/plugin-path-resolution.md §1a`), then:
```
Read $PLUGIN_DIR/skills/app-readiness/references/ado-pipelines-api.md
Read $PLUGIN_DIR/skills/shared/business-context-severity.md
Read $PLUGIN_DIR/skills/shared/source-file-consent.md
Read $PLUGIN_DIR/skills/shared/scope-flags-spec.md
```

> This skill uses `--quick` and `--full` flag variants. These are skill-local
> extensions registered in `scope-flags-spec.md §Skill-local flag extensions`.
> `--quick` = phases 1–2 only (no source reads); `--full` = all 8 phases including
> targeted source reads for Red domains.

Load the hosting-model-specific checklist:
- If `HOSTING_MODEL` = `IIS` → the IIS checks in Step 3 apply
- If `HOSTING_MODEL` = `container` → container checks apply
- If `HOSTING_MODEL` = `app-service` → App Service checks apply
- If `HOSTING_MODEL` = `mixed` → apply the checks for each component

---

## Step 3 — Phase 0: Evidence collection (bash, no source reads)

Run these before any ADO API calls. Record PRESENT / MISSING / PARTIAL for each.

```bash
echo "=== Health checks ==="
grep -r "UseHealthChecks\|MapHealthChecks\|AddHealthChecks\|/healthz\|/health" \
  --include="*.cs" --include="*.ts" -l . 2>/dev/null | head -5

echo "=== Observability ==="
grep -r "AddOpenTelemetry\|ApplicationInsights\|Serilog\|ILogger\|CorrelationId\|TraceId" \
  --include="*.cs" -l . 2>/dev/null | head -5

echo "=== Resilience (Polly) ==="
grep -r "AddPolicyHandler\|WaitAndRetryAsync\|CircuitBreakerAsync\|TimeoutAsync" \
  --include="*.cs" -l . 2>/dev/null | head -5
grep -r "HttpClientFactory\|AddHttpClient\|AddTransientHttpError" \
  --include="*.cs" -l . 2>/dev/null | head -5

echo "=== Secrets management ==="
grep -r "AddAzureKeyVault\|AddUserSecrets\|DefaultAzureCredential\|ManagedIdentity" \
  --include="*.cs" -l . 2>/dev/null | head -3
grep -r "connectionString\|password\|ApiKey" appsettings.json 2>/dev/null | head -5

echo "=== Test projects ==="
find . \( -name "*Tests.csproj" -o -name "*Test.csproj" -o -name "*.spec.ts" \) | wc -l
find . -name "coverage.xml" -o -name "lcov.info" -o -name "coverage-summary.json" 2>/dev/null

echo "=== Migrations ==="
find . -name "Migrations" -type d 2>/dev/null
find . -name "*_Initial*.cs" -path "*/Migrations/*" 2>/dev/null | head -3

echo "=== Pipeline files ==="
find . -name "azure-pipelines*.yml" -maxdepth 3 2>/dev/null
find . -name "*.pubxml" -maxdepth 4 2>/dev/null

echo "=== IIS signals ==="
find . -name "web.config" -not -path "*/obj/*" -maxdepth 4 2>/dev/null
find . -name "applicationHost.config" -maxdepth 4 2>/dev/null

echo "=== Runbook / ops docs ==="
find . \( -name "RUNBOOK*" -o -name "runbook*" -o -name "OPERATIONS*" \
  -o -name "incident-response*" -o -name "deployment-guide*" \) 2>/dev/null
```

---

## Step 4 — Phase 1: ADO pipeline assessment

Requires `AZURE_DEVOPS_PAT`. Check environment:

```bash
[ -n "$AZURE_DEVOPS_PAT" ] && echo "PAT_SET" || echo "PAT_MISSING"
```

If PAT_MISSING: note "ADO pipeline checks skipped — AZURE_DEVOPS_PAT not set.
Set it and re-run for full assessment." Score pipeline domain as ⚠️ 2 — cannot verify.

If PAT_SET — build the auth header once and immediately scrub the raw PAT:

```bash
ADO_AUTH=$(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)
unset AZURE_DEVOPS_PAT
```

Then run these checks using `references/ado-pipelines-api.md`:

**4a — List pipelines and last run**
```bash
# List all pipelines
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/pipelines?api-version=7.1"

# For each pipeline — get last run
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/pipelines/{ID}/runs?api-version=7.1&\$top=1"
```

Record:
- Pipelines found: name, last run result (succeeded / failed / in-progress)
- Last 3 build results from build history

**4b — List environments and approval gates**
```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/distributedtask/environments?api-version=7.1"
```

Record:
- Environments defined: names
- Production environment exists: yes / no
- Approval gate on production environment: yes / no / cannot determine

**4c — Check service connections**
```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/serviceendpoint/endpoints?api-version=7.1"
```

Record:
- Deployment service connections exist: yes / no
- All service connections status: Ready / Not Ready

**4d — Read pipeline YAML files** (from filesystem, no source consent needed)
```bash
cat {PIPELINE_FILE} 2>/dev/null
```

Look for:
- Stages defined (build → test → staging → [approval] → production)
- Test task present (VSTest, dotnet test, ng test)
- Deployment to staging before production
- Manual approval gate (`type: environment` with approval check)
- Rollback step or mechanism

---

## Step 5 — Phase 2: Score all 8 domains

Apply the maturity scale and the hosting-model-specific checks.

**Maturity scale:**
| Score | Label |
|---|---|
| 1 | Not started — no evidence |
| 2 | Ad hoc — partial, inconsistent |
| 3 | Defined — consistently implemented, not validated under failure |
| 4 | Managed — implemented, tested, documented |
| 5 | Optimised — measured and improved over time |

**RAG:**
- ✅ Green = 4–5
- ⚠️ Amber = 3
- 🔴 Red = 1–2

---

### EA-1: Deployment pipeline (ADO)

| Check | IIS | Container / App Service |
|---|---|---|
| Pipeline YAML exists in repo | ✓ required | ✓ required |
| Pipeline runs on every PR merge to dev | ✓ required | ✓ required |
| Build stage compiles and runs all tests | ✓ required | ✓ required |
| Deploy stage deploys to staging first | ✓ required | ✓ required |
| Manual approval gate before production | ✓ required | ✓ required |
| Last 3 builds: all succeeded | ✓ good signal | ✓ good signal |
| Service connection exists and is Ready | ✓ required | ✓ required |
| Deployment artefact versioned (build number) | ✓ required | Image tag = build number |
| Rollback mechanism documented in pipeline | ✓ required | Re-run prev run or slot swap |

Score 1: No pipeline — manual deployments only.
Score 2: Pipeline exists but deploys straight to production with no staging.
Score 3: Pipeline deploys to staging then production but no approval gate.
Score 4: Staging → approval gate → production. All tests in pipeline.
Score 5: Score 4 + last 10 builds green, rollback step automated, deployment frequency tracked.

**Critical finding:** If last production build failed and a manual fix was deployed without
the pipeline — score 1, Red, blocking finding regardless of other scores.

---

### EA-2: Resilience and fault tolerance

IIS-specific signals:
- App Pool `startMode` = `AlwaysRunning` (not `OnDemand`)
- App Pool auto-restart on crash configured
- SQL connection string includes `ConnectRetryCount` and `ConnectRetryInterval`
- Polly retry/circuit-breaker on external HTTP calls (check evidence from Step 3)
- Timeout configuration on all SQL commands and HTTP clients

Container/App Service signals:
- Polly policies registered in DI
- `HttpClientFactory` used (not `new HttpClient()`)
- Health probes configured (liveness + readiness)
- Graceful shutdown handling (`IHostApplicationLifetime`)
- Restart policy defined

Score 1: No retry, no circuit breaker, App Pool crashes cascade to downtime.
Score 2: Some retry logic but inconsistent — some services have it, others don't.
Score 3: Polly on all external calls, App Pool auto-restart, connection string retry.
Score 4: Score 3 + timeout on all operations + graceful shutdown.
Score 5: Score 4 + load tested, failure scenarios documented, chaos testing done.

---

### EA-3: Observability

Evidence signals from Step 3:
- Structured logging (Serilog JSON sink to file or Azure Monitor)
- Correlation IDs on all HTTP requests
- Application Insights or equivalent APM
- Health check endpoint reachable from monitoring system
- Log level correct for production (Warning or above, not Debug)

IIS-specific: Windows Event Log writing, IIS access logs forwarded to central store.
Container: stdout/stderr to log aggregator, OpenTelemetry traces.

Score 1: Console.Write only, no log aggregation, no APM.
Score 2: File logging but no structured format, no correlation IDs, no APM.
Score 3: Structured logging, Application Insights configured, health endpoint present.
Score 4: Score 3 + correlation IDs, distributed tracing, alerting rules configured.
Score 5: Score 4 + SLO/SLA dashboards, anomaly detection, runbook linked from alerts.

---

### EA-4: Security posture

Read the most recent security report from `security/`. If none exists, score 2 and flag
as blocking — no security scan means unknown security posture.

```bash
ls security/ 2>/dev/null | sort -r | head -3
```

Load the most recent HTML report and extract:
- Unresolved Critical findings → **blocking** regardless of other scores
- Unresolved B1–B7 business context findings → **blocking**
- Unresolved High findings → reduces max score to 3
- Secrets management strategy (from deployment context)

IIS-specific: HTTPS binding, HTTP to HTTPS redirect in web.config, auth on all endpoints.
Container: No secrets in image layers, image scanning result if available.

**Entra ID specific checks** (only if `architecture-deployment.md` shows Entra ID auth):

Read the Entra ID section of `.claude/architecture/architecture-deployment.md` and check:

| Check | Good signal | Risk signal |
|---|---|---|
| Tenant model | Single-tenant for internal app | Multi-tenant when only internal users needed |
| Token validation | `AddMicrosoftIdentityWebApi` on API | Angular/SPA trusts token, API does not re-validate |
| App roles / scopes | Roles defined and mapped to auth policies | No roles — all authenticated users get full access |
| Service-to-service | Managed Identity (no stored secret) | Client Secret stored in appsettings.json |
| Frontend token storage | MSAL session storage | MSAL local storage (XSS risk) |
| Conditional Access | MFA required for production | No CA policies |
| Client secrets | In Key Vault, rotated regularly | In appsettings.json, never rotated |

If `architecture-deployment.md` shows Entra ID auth but `Q7c` is "Angular validates and
sends, API trusts without re-validating" — that is a **High finding** regardless of CVSS:
the API has no server-side token validation and accepts any token the client presents.


**SPA authentication checks** (only if `AUTH_SPA` is true in deployment context):

Read the `## SPA Authentication` section of `architecture-deployment.md`.

| Check | Good signal | Finding if absent |
|---|---|---|
| OAuth2 flow | PKCE (MSAL v2+, no `responseType: token`) | High — implicit flow exposes tokens in URL |
| All protected routes guarded | Every route has `canActivate: [MsalGuard]` or equivalent | High — unauthenticated users can access UI shell |
| Token attached via interceptor | `MsalInterceptor` or custom interceptor in `app.config.ts` | High — some API calls may be unauthenticated |
| Silent token refresh | `acquireTokenSilent` with `InteractionRequiredAuthError` fallback | Medium — broken UX and 401 errors after token expiry |
| Token storage | `sessionStorage` (not `localStorage`) | Amber (High if B1–B7 data) — XSS persistence risk |
| Full logout | `logoutRedirect()` clears Entra ID session | Medium — SSO session persists after logout |
| Content Security Policy | CSP meta tag in `index.html` | Medium (High if `localStorage` tokens) |

If `AUTH_SPA_LOCAL_STORAGE` is true and the application handles B1–B7 data →
escalate token storage finding to **Critical** via business context override B1/B2.
A persisted Entra ID token for attorney-client matter data is a breach enabler.

Score 1: No security scan ever run, or Critical unresolved findings.
Score 2: Security scan run but High findings unresolved, OR Entra ID configured but
         API does not re-validate tokens server-side.
Score 3: No Critical or High. Entra ID token validation confirmed server-side.
Score 4: Score 3 + Managed Identity for service-to-service, no Client Secrets in config,
         MSAL session storage on frontend.
Score 5: Score 4 + Conditional Access (MFA), penetration test done, CA policies documented.

**Always apply B1–B7 business context severity from `../shared/business-context-severity.md`.**
Any unresolved B1–B7 finding is a blocker regardless of CVSS score.

---

### EA-5: Scalability

Evidence from Step 3 + architecture docs:
- No static mutable state in services
- No `DbContext` registered as Singleton
- No `.Result` or `.Wait()` on async operations
- Connection pooling configured (SQL connection string `Max Pool Size`)
- `AsNoTracking()` on read-only EF queries
- Caching strategy for expensive reads (IMemoryCache, IDistributedCache, Redis)

IIS-specific: Session state externalised if multiple servers (SQL, Redis).
Container: Horizontal scaling strategy documented.

Score 1: Static state, blocking async calls, no connection pooling.
Score 2: Some issues — inconsistent async patterns or missing pooling.
Score 3: No blocking async, connection pooling set, read queries use AsNoTracking.
Score 4: Score 3 + caching strategy, load tested at expected peak.
Score 5: Score 4 + auto-scaling configured, performance baseline documented.

---

### EA-6: Data integrity and backup

Evidence from Step 3 + deployment context:
- EF Core Migrations folder present and tracked in git
- Migration strategy documented (auto-run in pipeline vs manual DBA)
- Backup schedule defined (from architecture-deployment.md)
- RTO and RPO documented
- DB transactions used for multi-step writes

Score 1: No migrations, no backup plan documented.
Score 2: Migrations exist but run manually with no documented process.
Score 3: Migrations in pipeline, backup configured, RTO/RPO estimated.
Score 4: Score 3 + rollback scripts tested, backup restore tested.
Score 5: Score 4 + automated restore testing, point-in-time recovery configured.

---

### EA-7: Operational runbook

Evidence from Step 3:
- Runbook file found in repository
- Deployment procedure documented
- Rollback procedure documented (not just "reverse the deployment")
- Known failure modes documented with recovery steps
- On-call contact / escalation path documented

Score 1: No documentation. Deployment and rollback are tribal knowledge.
Score 2: Some notes exist but incomplete — missing rollback or escalation path.
Score 3: Deployment and rollback documented. No failure mode playbooks.
Score 4: Score 3 + known failure modes documented with recovery steps.
Score 5: Score 4 + runbook tested in staging, incident response practiced.

---

### EA-8: Test coverage

Evidence from Step 3:
- Test project count and type (unit / integration / E2E)
- Coverage report present
- Tests run in ADO pipeline and block on failure (from Step 4d)
- Coverage threshold enforced in pipeline

Score 1: 0 or near-0 test files. No tests in pipeline.
Score 2: Some unit tests but no integration tests. Tests not in pipeline.
Score 3: Unit tests for services, integration tests for controllers. Tests in pipeline.
Score 4: Score 3 + coverage report, coverage threshold in pipeline.
Score 5: Score 4 + E2E tests for critical paths, flaky tests tracked and resolved.

---

## Step 6 — Apply business context severity

Before determining the verdict, apply B1–B7 from `../shared/business-context-severity.md`
to every finding. Any finding touching attorney-client data, immigration identifiers,
active case timelines, vulnerable client data, or real PII in a static directory
is a blocker regardless of its domain score.

---

## Step 7 — Verdict

| Verdict | Condition |
|---|---|
| ✅ **Production ready** | All 8 domains ≥ 3. No domain at 1. No unresolved Critical security findings. |
| ⚠️ **Conditionally ready** | EA-2, EA-3, EA-4, EA-8 all ≥ 3. Other domains may be at 2. Document exceptions. |
| 🔶 **Not ready** | Any critical domain (EA-2, EA-3, EA-4, EA-8) < 3, OR more than 3 domains at 2. |
| 🔴 **Blocked** | Any domain at 1, OR unresolved Critical security finding, OR unresolved B1–B7 finding, OR no ADO pipeline. |

Critical domains: EA-2 (Resilience), EA-3 (Observability), EA-4 (Security), EA-8 (Tests).

---

## Step 8 — Phase 3: Targeted source reads (--full only)

For each domain scored Red, apply the Category B consent gate from `../shared/source-file-consent.md`.
Maximum 5 files across the entire assessment. Each read must state:
- Which domain it serves
- What it is confirming
- Why bash evidence was insufficient

---

## Step 9 — Generate HTML report

Write to `prod-readiness/app-readiness-{date}.html`.

```bash
mkdir -p prod-readiness
```

Report structure:
1. **Executive summary** — overall verdict, score grid (8 domains RAG), top 3 blockers
2. **ADO pipeline status** — pipeline name, last run, environments, approval gates
3. **Domain findings** — each domain with score, evidence found, gaps, specific fixes
4. **Remediation roadmap** — three tiers: Before go-live / Within 30 days / Next sprint
5. **Strengths** — what is already well-implemented

---

## Hard Rules

- NEVER invent metric values or pipeline states — if an API call fails, mark that check as ❓ Unknown
- NEVER score a domain higher than the evidence supports
- NEVER skip EA-4 (Security) because a recent scan was not found — score it 1 or 2 and flag as blocking
- NEVER skip B1–B7 business context check
- NEVER read source files in --quick mode
- NEVER proceed without deployment context — require the architect skill to be run first
