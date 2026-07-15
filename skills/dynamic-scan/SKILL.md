---
description: >
  Use when the user asks to run a dynamic scan, DAST, runtime security scan, or live
  vulnerability scan against a running web application or API; or mentions OWASP ZAP,
  active scan, passive scan, baseline scan, spidering a live site, fuzzing endpoints,
  scanning a localhost/staging URL, or "scan my running app". Covers Angular SPA,
  ASP.NET MVC, ASP.NET Web API, Blazor, and Razor Pages targets, plus dependency
  vulnerability auditing (npm, pip, NuGet). This is the runtime counterpart to the
  static `security` skill — use `security` for source-code SAST, use this for a
  running target. Also use for CI/CD DAST pipeline setup.
---

# Dynamic Scan Skill (DAST)

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: A(scan)|B(finding-map)_
Runtime security testing of a **running** web application or API using OWASP ZAP via
Docker, driven by the ZAP **Automation Framework** (a single YAML plan). This skill is
the dynamic (DAST) counterpart to the static `security` skill (SAST). They share scope
flags, model routing, consent rules, and business-context severity.

> **Business-context severity**: All findings produced by this skill are re-rated using
> `$PLUGIN_DIR/skills/shared/business-context-severity.md`. A runtime finding that exposes immigration
> IDs, privileged matter data, or vulnerable-client data is escalated to Critical even
> when ZAP's own risk rating is lower. Apply the B1–B7 overrides before writing the report.

> **Source-file consent**: This skill is Category A for the live scan itself (the user
> invoked `/dynamic-scan`), but reading application source to map a finding back to a
> file (Step 5) is Category B. See `$PLUGIN_DIR/skills/shared/source-file-consent.md`.

> **Single-writer assumption**: This skill writes a report and a baseline file under the
> project. See `$PLUGIN_DIR/skills/shared/single-writer-assumption.md` for concurrency constraints.

> **Model routing**: This is an analysis task. Use `REVIEW_MODEL` (default
> `claude-sonnet-4-6`). See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

---

## Persona

Execute as **[SEC] Dana Ito — Security Engineer** (12 yrs appsec). Optimizes for attacker's-eye,
runtime-reachable risk; always asks "how would I abuse this?" Reasons about the running target in its
actual stack (Angular SPA, ASP.NET MVC/Web API, Blazor, Razor) — never assuming one.

The persona sets *what to scrutinize* — it never licenses assumption. ZAP output, the live target's
responses, and (Category B) mapped source are the only sources of truth; a persona's "experience" is
never a substitute for an observed finding (subordinate to CLAUDE.md §3 / decision transparency).
Never name the persona in the report or ledger. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## 0. Pre-flight — safety, environment, stack detection

Run this before anything else. Nothing is scanned until Step 0 passes.

### Step 0a — Authorisation and environment gate (hard stop)

DAST sends real traffic — and active scans send **attack payloads** — to a live target.
Before any scan, confirm:

```
⚠ Dynamic Scan — pre-flight authorisation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Target        : {URL}
  Scan type     : {passive (safe) | active (sends attack payloads)}

  Active scanning sends SQL injection, XSS, path-traversal and command-injection
  payloads to the target. It can corrupt data, trigger WAF bans, and fill logs.

  Confirm BOTH before proceeding:
   1. This target is a local or staging environment — NOT production.
   2. You own it or have written authorisation to test it.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- **Passive / baseline scan** → Category A, proceed after the environment line is acknowledged.
- **Active / full scan** (`--full`, or `--scope` on a path) → require explicit confirmation
  of both points above. If the user names a production host, refuse and stop.

### Step 0b — Docker availability

```bash
docker info >/dev/null 2>&1 && echo "DOCKER_OK" || echo "DOCKER_MISSING"
```

If `DOCKER_MISSING`: the scan cannot run headless. Tell the user to start Docker Desktop,
or — for Windows Authentication targets (see Step 0e) — to use ZAP Desktop instead.

**Image (verified current):** use `ghcr.io/zaproxy/zaproxy:stable`. For `--ci`, use the
smaller `ghcr.io/zaproxy/zaproxy:bare`. The old `owasp/zap2docker-stable` image name is
retired — never use it.

```bash
docker pull ghcr.io/zaproxy/zaproxy:stable
```

### Step 0c — Detect target stack (lazy reference loading)

```bash
# Frontend / SPA
find . -name "angular.json" -maxdepth 3 | head -1 && echo "ANGULAR"
# ASP.NET family
find . -name "*.csproj" -maxdepth 4 -exec grep -l "Microsoft.AspNetCore.Mvc" {} \; 2>/dev/null | head -1 && echo "MVC"
find . -name "Program.cs" -maxdepth 4 -exec grep -l "AddControllers\|MapControllers" {} \; 2>/dev/null | head -1 && echo "API"
find . -name "Program.cs" -maxdepth 4 -exec grep -l "AddRazorPages" {} \; 2>/dev/null | head -1 && echo "RAZORPAGES"
find . -name "*.csproj" -maxdepth 4 -exec grep -l "Microsoft.AspNetCore.Components" {} \; 2>/dev/null | head -1 && echo "BLAZOR"
# Java / Spring Boot
{ find . -name "pom.xml" -maxdepth 3 -exec grep -l "spring-boot-starter-web" {} \; 2>/dev/null; \
  find . -name "build.gradle*" -maxdepth 3 -exec grep -l "spring-boot" {} \; 2>/dev/null; } | head -1 && echo "SPRING_BOOT"
# Python web (FastAPI / Django / Flask)
{ grep -rl "fastapi\|[Dd]jango\|[Ff]lask" --include=requirements.txt --include=pyproject.toml . 2>/dev/null; \
  find . -name "manage.py" -maxdepth 2 2>/dev/null; } | head -1 && echo "PYTHON_WEB"
# Dependency manifests
find . -name "package.json" -maxdepth 3 | head -1 && echo "NPM"
find . -name "requirements.txt" -o -name "Pipfile.lock" -o -name "pyproject.toml" -maxdepth 3 | head -1 && echo "PIP"
find . -name "*.csproj" -maxdepth 4 | head -1 && echo "NUGET"
{ find . -name "pom.xml" -o -name "build.gradle*" -maxdepth 3 2>/dev/null; } | head -1 && echo "MAVEN_GRADLE"
```

Load only the reference file(s) for the detected stack. Do **not** load Blazor notes for
a pure MVC app, etc.

| Detected | Load reference |
|---|---|
| ANGULAR | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-angular-spa.md` + `$PLUGIN_DIR/skills/dynamic-scan/references/route-extraction.md` |
| MVC | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-aspnet-mvc.md` + `$PLUGIN_DIR/skills/dynamic-scan/references/route-extraction.md` |
| API | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-aspnet-api.md` |
| BLAZOR | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-aspnet-blazor.md` |
| RAZORPAGES | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-aspnet-mvc.md` (Razor Pages shares MVC handling) |
| SPRING_BOOT | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-spring-boot.md` + `$PLUGIN_DIR/skills/dynamic-scan/references/route-extraction.md` |
| PYTHON_WEB (FastAPI/Django/Flask) | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-python-web.md` + `$PLUGIN_DIR/skills/dynamic-scan/references/route-extraction.md` |
| any auth needed | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-auth.md` |
| Windows Auth | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-windows-auth.md` |
| NPM / PIP / NUGET / MAVEN_GRADLE | `$PLUGIN_DIR/skills/dynamic-scan/references/dependency-scan.md` |
| always (reporting) | `$PLUGIN_DIR/skills/dynamic-scan/references/severity-mapping.md` + `$PLUGIN_DIR/skills/dynamic-scan/references/report-format.md` |
| always (the plan) | `$PLUGIN_DIR/skills/dynamic-scan/references/zap-automation-plan.md` |

Announce:
```
🔍 Dynamic Scan — stack detection
  Detected : ASP.NET MVC · ASP.NET Web API
  Spider   : Traditional (MVC) + API import (Web API)
  Auth     : Forms Authentication detected → zap-auth.md
  Deps     : NuGet → dotnet list package --vulnerable
  Loading  : zap-aspnet-mvc · zap-aspnet-api · zap-auth · route-extraction
  Skipping : Angular · Blazor · npm · pip — not present
```

### Step 0d — Resolve scope flag

Adopt the canonical flags from `$PLUGIN_DIR/skills/shared/scope-flags-spec.md`. Dynamic-scan-specific flags:

| Flag | Behaviour |
|---|---|
| `--url <target>` | Target URL. Required for any live scan. |
| `--stack <type>` | Override 0c detection: `angular`, `mvc`, `api`, `blazor`, `razorpages`. |
| `--auth <type>` | `none`, `form`, `token`, `azure`, `windows`. |
| `--swagger <path>` | OpenAPI/Swagger file → full API endpoint coverage, skips spider. |
| `--scope <path>` | Limit active scan to a path (e.g. `/api/v1/payments`). Implies active scan. |
| `--deps-only` | Skip the live scan; run dependency audit only. Always safe. |
| `--full` | Full active scan (attack payloads). Requires Step 0a confirmation. |
| `--baseline <file>` | Apply a false-positive baseline (Step 4). |
| `--diff` | Report only findings new since the last report. |
| `--max-duration <min>` | Time-box spider + active scan (default 10 min each). |
| `--rate-limit <n>` | Cap scanner threads per host (maps to `scanner.threadPerHost`). |
| `--fail-on <sev>` | CI: non-zero exit if any finding ≥ severity (uses ZAP `exitStatus` job). |
| `--ci` | Headless, no prompts, JSON + HTML output, `zap-bare` image. |
| (none) | Default: **passive baseline scan + dependency audit** — no attack payloads. |

### Step 0e — Windows Authentication check (potential blocker)

If `--auth windows` or Windows Auth is detected (IIS app, NTLM/Negotiate), STOP and read
`$PLUGIN_DIR/skills/dynamic-scan/references/zap-windows-auth.md`. NTLM is a built-in ZAP method but is unreliable headless
in Docker. Present the three options there (Desktop-GUI-test-then-export context, Basic-auth
fallback, or pre-authenticated session cookie) and let the user choose before continuing.

---

## 1. Environment + authentication setup

### Step 1a — Resolve localhost for Docker networking

ZAP runs inside Docker; `localhost` inside the container is the container, not the host.
- Windows / macOS Docker Desktop: replace `localhost`/`127.0.0.1` in the target URL with
  `host.docker.internal`.
- Linux: add `--add-host=host.docker.internal:host-gateway` to the `docker run` command.

Announce the rewrite so the user understands why the URL changed.

### Step 1b — HTTPS / self-signed dev certs (every stack)

Local IIS and `dotnet run` almost always serve HTTPS with a self-signed dev cert, which
ZAP rejects by default. For any `https://` localhost target, the Automation Framework plan
must disable cert validation for the scan. Set this in the plan's `env` block:

```yaml
env:
  parameters:
    failOnError: true
    progressToStdout: true
  proxy: {}
  vars: {}
# and pass: -config certificate.use=false  (or accept the dev cert explicitly)
```

`--accept-cert` is ON by default for localhost targets. Note it in the announcement.

### Step 1c — Configure authentication (if any)

Read `.claude/plugin-path.txt` to get PLUGIN_DIR (if absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`). Read `$PLUGIN_DIR/skills/dynamic-scan/references/zap-auth.md` for the per-type YAML. Summary:
- `form` → form-based auth job with login URL + username/password field names.
- `token` → set `ZAP_AUTH_HEADER_VALUE` at the **system level** (never in the plan's `env`
  block — ZAP ignores auth header vars defined there). Decode JWTs and flag weak `alg`.
- `azure` → script-based auth or manual browser flow (OAuth redirects are not headless-friendly).
- `windows` → see Step 0e.

**Credentials are passed via environment variables / ZAP secrets, never hardcoded in the
YAML plan.** The plan references them by name.

### Step 1d — Authentication verification GATE (mandatory for authenticated scans)

A misconfigured login means ZAP scans the login page repeatedly and reports nothing useful.
Before spidering, the plan must define a **verification strategy** with a logged-in (or
logged-out) indicator — without one, ZAP will not run the auth script at all.

After the first authenticated request, check ZAP's internal statistic
`stats.auth.state.loggedin`:

- `stats.auth.state.loggedin > 0` → authentication is working. Proceed to Step 2.
- `stats.auth.state.loggedin == 0` → **STOP**. Report "authentication is not working — the
  logged-in indicator was never matched" and show the user the candidate indicators to fix.
  Do NOT scan; a scan now would produce a misleading empty/garbage report.

---

## 2. Route discovery (closes the SPA/API coverage hole)

Spiders miss lazy-loaded SPA routes and attribute-routed API endpoints. Seed ZAP with a
known route list so coverage does not depend on the spider alone. Read
`$PLUGIN_DIR/skills/dynamic-scan/references/route-extraction.md`.

- **Angular** → parse `*-routing.module.ts` / `app.routes.ts` for `path:` entries.
- **MVC / Razor Pages** → `[Route]`, `[HttpGet/Post/...]` attributes + conventional
  `{controller}/{action}/{id}`.
- **Web API** → prefer `--swagger`. If no spec, extract routes from controller attributes;
  confirm the derived endpoint list with the user before scanning.

Feed the resulting URLs into the plan as additional spider seed URLs (or, for APIs, as the
`openapi`/`requestor` job targets).

---

## 3. Build and run the Automation Framework plan

Read `$PLUGIN_DIR/skills/dynamic-scan/references/zap-automation-plan.md` for the full per-stack YAML templates. The skill
**generates a single `zap-plan.yaml`** with jobs in this order, then runs it. Do not chain
the legacy `zap-baseline.py` / `zap-full-scan.py` scripts — the Automation Framework is the
maintained path.

Job sequence:
1. `passiveScan-config` — enable passive rules (+ auth auto-detect rules if authenticating).
2. `spider` (traditional, for MVC/Razor) and/or `spiderAjax` (for Angular/Blazor SPAs).
3. `openapi` — if `--swagger` given (API targets), import the spec.
4. `passiveScan-wait`.
5. `activeScan` — ONLY for `--full` or `--scope`. Omit for the default/passive run.
6. `report` — `traditional-html` + `traditional-json`.
7. `exitStatus` — if `--fail-on` given, set ZAP's exit code by threshold.

Time-boxing (`--max-duration`) maps to each job's `maxDuration`. Throttle (`--rate-limit`)
maps to `activeScan.parameters.threadPerHost`, default a conservative value so a local IIS
is not saturated into producing false timeouts.

Run (mount the working dir so the plan and reports are shared):

```bash
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$(pwd)/dynamic-scan:/zap/wrk/:rw" \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -cmd -autorun /zap/wrk/zap-plan.yaml
```

In parallel (or when `--deps-only`), run the dependency audit from `$PLUGIN_DIR/skills/dynamic-scan/references/dependency-scan.md`:

```bash
# .NET (built into the SDK — no extra tooling)
dotnet list package --vulnerable --include-transitive
# Node
npm audit --json
# Python
pip-audit -f json
```

---

## 4. Parse, baseline, severity, diff

1. Read the JSON report ZAP wrote to `dynamic-scan/`.
2. **Baseline**: if `--baseline` given, suppress alerts listed in it via the plan's
   `alertFilter` job. See `$PLUGIN_DIR/skills/dynamic-scan/references/baseline-tuning.md`. Keep noise (missing headers on
   static assets, CSP-on-JSON-API) out of the report so the signal stays trusted.
3. **Severity**: translate ZAP risk → CVSS/CWE using `$PLUGIN_DIR/skills/dynamic-scan/references/severity-mapping.md`, then
   apply the B1–B7 business overrides from `$PLUGIN_DIR/skills/shared/business-context-severity.md`.
4. **Diff**: if `--diff` given, compare against the previous `dynamic-scan/` report and show
   only NEW findings — the "did this PR introduce a vulnerability?" signal.

---

## 5. Fix suggestions (with source mapping)

For each confirmed finding, map the HTTP-layer result back to source. Read
`$PLUGIN_DIR/skills/dynamic-scan/references/finding-to-source.md`. ZAP gives a URL + parameter; resolve it to the MVC
controller/action or API route, locate the `.cs`/`.ts` file, and propose a concrete fix in
that file. Reading that source file is **Category B consent** — use the gate from
`$PLUGIN_DIR/skills/shared/source-file-consent.md` before opening it.

For dependency findings: state direct vs transitive, the patched version, and whether the
upgrade is safe (`npm audit fix --dry-run` / `dotnet add package` to the fixed version).

---

## 6. Report and cleanup

Write a self-contained HTML report to `dynamic-scan/` (mirrors how `security` writes to
`security/`). Use the structure in `$PLUGIN_DIR/skills/dynamic-scan/references/report-format.md`.

**Cleanup (mandatory):** ZAP session and context files can contain plaintext credentials.
Delete them after the report is written, and ensure `dynamic-scan/` is gitignored except
the HTML report.

```bash
rm -f dynamic-scan/*.session dynamic-scan/*.context dynamic-scan/zap-plan.yaml 2>/dev/null || true
```

Final summary:
```
Dynamic scan complete → dynamic-scan/dynamic-scan-<date>.html

Target    : {URL}   Stack: {detected}   Scan: {passive | active}
Auth      : {type}  (verified: {yes/no})
Scanned   : {N URLs spidered, M endpoints}

Findings:
  Critical: N   High: N   Medium: N   Low: N   Info: N

## 6b. Write/update the dynamic-scan ledger

After the HTML report is written, write or update `dynamic-scan/dynamic-scan-ledger.md`.
This enables `/fix` to apply source-level remediations and `checkin`/`pr-create` to
gate on open DAST findings.

```bash
mkdir -p dynamic-scan
```

**Fingerprint generation:**
```bash
!node -e "console.log('FP-' + require('crypto').createHash('sha1').update(process.argv[1]).digest('hex').slice(0,8))" "XSS|MatterController.cs|reflected-xss|unsanitized parameter echoed in response"
```

**What gets a fingerprint** — findings with a source-level fix path only:
- Finding must have a source file identified (via finding-to-source.md mapping from Step 5)
- Finding must have a vulnerable snippet and corrected snippet
- Findings without a source fix (server config, TLS config, infrastructure-level) get
  `manual-fix-required` status — no FP ID, excluded from /fix workflow

**Reconcile with existing ledger** — apply the standard five reconciliation rules.
For the Dismissed rule (Rule 5), delegate entirely to
`$PLUGIN_DIR/skills/shared/dismissed-findings-reconciliation.md` (spec v1.0): keep dismissed if
file unchanged since `dismissed-date`; set `verify-flag: code-changed` and re-open
as Open (preserving original dismissal metadata) if the file has commits since
`dismissed-date`. Never count dismissed findings toward open totals.
```bash
cat dynamic-scan/dynamic-scan-ledger.md 2>/dev/null || echo "NO_LEDGER_YET"
```

Write `dynamic-scan/dynamic-scan-ledger.md` with this structure:

```markdown
# Dynamic Scan Ledger
_Last updated: YYYY-MM-DD · Managed by /dynamic-scan · Do not edit manually_

## Summary
Open: N · Fixed: N · Dismissed: N · Manual-fix-required: N

---

## Open Findings

### [FP-xxxxxxxx] <ZAP-ALERT-NAME> — <Severity>
- **URL**: <url-where-found>
- **File**: <mapped source file from Step 5>
- **Location**: <controller/route>
- **First detected**: <date>
- **Last seen**: <date>
- **Status**: Open
- **Description**: <one line>
- **CVSS**: <score> (<vector>)
- **CWE**: <CWE-ID>
- **Vulnerable code**:
  ```
  <vulnerable snippet>
  ```
- **Fix**:
  ```
  <corrected snippet>
  ```
- **Fix explanation**: <one line>

---

## Manual-Fix-Required Findings

### <ZAP-ALERT-NAME> — <Severity>
- **Finding**: <description>
- **Recommendation**: <what to do>
- **Status**: manual-fix-required
- **Reason**: <server-config / tls-config / infra-level / no-source-mapping>

---

## Fixed Findings

### [FP-xxxxxxxx] <ZAP-ALERT-NAME> — <Severity>
- **URL**: <url>
- **First detected**: <date>
- **Fixed date**: <date>
- **Fixed by**: [auto-fix via /fix] or [manual]
- **Status**: Fixed

---

## Dismissed Findings

### [FP-xxxxxxxx] <ZAP-ALERT-NAME> — <Severity>
- **URL**: <url>
- **File**: <mapped source file>
- **Location**: <controller/route>
- **First detected**: <date>
- **Status**: Dismissed
- **Dismissed date**: <date>
- **Dismissed by**: <git user>
- **Reason**: <false-positive | wont-fix | accepted-risk | by-design>
- **Justification**: <free-text explanation>
- **Verify flag**: <none | code-changed>

(repeat per dismissed finding)
```

**Add `dynamic-scan/` to `.gitignore`** if not already present:
```bash
grep -q "^dynamic-scan/" .gitignore 2>/dev/null || echo "dynamic-scan/" >> .gitignore
```
Dependencies:
  Vulnerable packages: N  (direct: N, transitive: N)

Top 3:
1. [title] — [url/param] — CVSS N.N (CWE-XXX) → [file:line]
2. ...
3. ...
```

---

## Scope of v1 (explicit)

In scope: Angular SPA, ASP.NET MVC, Web API, Blazor (HTTP surface), Razor Pages; passive +
active ZAP scans via Automation Framework; npm/pip/NuGet dependency audit; baseline tuning;
run-to-run diff; source-mapped fixes; CI via `--ci`/`--fail-on`.

Deferred to v2 (stated, not silently missing): WebSocket/SignalR message fuzzing (ZAP's
standard scanner does not cover WS payloads); GraphQL deep fuzzing beyond import; headless
OAuth/Azure AD without a manual browser step.
