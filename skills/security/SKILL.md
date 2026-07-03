---
description: >
  Use when the user asks to review code for security issues, vulnerabilities, or bugs; or mentions
  CVEs, OWASP, SAST, pentesting, hardening, threat modeling, incident response, compliance
  (SOC2, ISO 27001, NIST, PCI-DSS, HIPAA), cloud security posture, or asks "is this secure?".
  Also use for weekly security health reports and manager security briefings.
---

# Claude Security Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: A_
A full-spectrum security assistant. Covers application security, cloud infrastructure, threat
modeling, incident response, compliance, and weekly manager/lead reporting. Always adapt output
type and technical depth to the task and the user's apparent role.

---


---


> **Single-writer assumption**: This skill writes to a persistent cache file. See `../shared/single-writer-assumption.md` for concurrency constraints and CI guidance.

## 0. Scope & Cache-Aware File Selection

Run this before any analysis. Reduces token cost by 80–95% on repeated runs.

### Step 0a — Detect language stack (lazy reference loading)

Before loading any reference files, detect the languages present:

```bash
# Check for language signals
find . -name "*.cs" -maxdepth 4 | head -1 && echo "DOTNET"
find . -name "*.ts" -maxdepth 4 | head -1 && echo "TYPESCRIPT"
find . -name "*.py" -maxdepth 4 | head -1 && echo "PYTHON"
find . -name "*.java" -maxdepth 4 | head -1 && echo "JAVA"
find . -name "*.go" -maxdepth 4 | head -1 && echo "GO"
```

Only load the language-notes.md section for detected languages.
Do NOT load Python, Java, or Go notes for a pure .NET/TypeScript project.
Do NOT load cloud-checks.md unless cloud infrastructure files are present
(`*.tf`, `*.yaml` with cloud providers, CDK/CloudFormation patterns).
Load compliance-controls.md only if the user mentions a compliance framework.

Announce what will be loaded:
```
🔍 Security Review — Language detection
  Detected: .NET/C# · TypeScript/Angular
  Loading: language-notes (dotnet, typescript)
  Skipping: Python · Java · Go · cloud-checks · compliance
  Reason: not present in this codebase
```

### Step 0b — Determine scope

| Flag | Behaviour |
|---|---|
| `--changed` | Review only git-staged and unstaged modified files |
| `--pr` | Review only files changed in this branch vs base branch |
| `--full` | Force full codebase scan — ignore cache |
| `--ci` | CI mode: same as `--full`, warns if cache file found on disk |
| `--area backend` | Only `*.cs` files — .NET layer scan |
| `--area frontend` | Only `*.ts` and `*.html` files — Angular layer scan |
| `--area config` | Only `*.json`, `*.yml`, `*.yaml`, `*.env`, `Dockerfile`, `*.tf` — IaC/config scan |
| `--area <ModuleName>` | Entry-point file + key files for that knowledge-graph module |
| `--continue` | Resume from `.claude/security-checkpoint.json` |
| (none) | Default: cache-aware full-project scan with budget cap (see Step 0b2) |

For `--changed`:
```bash
git diff --name-only && git diff --name-only --cached
```

For `--pr`:
```bash
git diff --name-only origin/HEAD...HEAD
```

### Step 0b2 — Apply file budget cap

After resolving the scope flag, count the candidate files:

```bash
# Count candidate files (before cache filtering)
find . \
  -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.angular/*" \
  -not -path "./dist/*" -not -path "./out/*" -not -path "./build/*" \
  -not -path "./.cache/*" -not -path "./coverage/*" -not -path "./bin/*" \
  -not -path "./obj/*" -not -path "./tmp/*" \
  -type f \( -name "*.ts" -o -name "*.js" -o -name "*.cs" -o -name "*.html" \
    -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.tf" \
    -o -name "*.sh" -o -name "*.ps1" -o -name "Dockerfile" \
    -o -name "appsettings*.json" \) | wc -l
```

**FILE_BUDGET = 40 files per session.**

If candidate count ≤ 40: proceed normally.

If candidate count > 40 and no `--area` or `--continue` flag:

```
⚠ Large project: {N} files found — exceeds the 40-file session budget.

  Scanning this session:  40 files (priority-ordered — see Step 0c2)
  Remaining:              {N-40} files

  After this scan completes, run these sub-scans for full coverage:

    /security-review --area backend     → .NET / C# files ({count})
    /security-review --area frontend    → Angular / TypeScript files ({count})
    /security-review --area config      → Config, IaC, env files ({count})

  Or resume the remainder:
    /security-review --continue

  Writing checkpoint for resumption…
```

Write the checkpoint with all files listed (see Step 0g), then proceed
with the first 40 files in priority order (Step 0c2).

### Step 0c — Build the candidate file list (ALL files from project root)

> ⚠️ **SCAN ROOT IS ALWAYS `.` — NEVER `./src` OR ANY SUBDIRECTORY.**
> Config files, environment files, pipeline YAML, Dockerfiles, and IaC outside
> `src/` are among the highest-value security targets in any project.
> Running `find ./src` instead of `find .` silently misses all of them.

**This step must always enumerate from the project root.**

For a default or `--full` scan, enumerate ALL files from the project root.
Run this exact command — do NOT scope it to src/ or any subdirectory:

```bash
find . \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./.angular/*" \
  -not -path "./dist/*" \
  -not -path "./out/*" \
  -not -path "./build/*" \
  -not -path "./.cache/*" \
  -not -path "./coverage/*" \
  -not -path "./bin/*" \
  -not -path "./obj/*" \
  -not -path "./tmp/*" \
  -not -path "./.claude/security-checkpoint.json" \
  -type f \( \
    -name "*.ts" -o -name "*.js" -o -name "*.cs" -o -name "*.py" \
    -o -name "*.java" -o -name "*.go" -o -name "*.rb" -o -name "*.php" \
    -o -name "*.html" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" \
    -o -name "*.tf" -o -name "*.tfvars" -o -name "*.env" \
    -o -name "*.config" -o -name "*.sh" -o -name "*.ps1" \
    -o -name "Dockerfile" -o -name ".htaccess" -o -name "web.config" \
    -o -name "appsettings*.json" -o -name "*.pem" -o -name "*.key" \
  \) | sort
```

**Hard rule: the scan root is always `.` (the project root). Never change this to `./src`
or any other subdirectory. Files outside `src/` — angular.json, environment files,
pipeline YAML, Dockerfiles, nginx config, appsettings — are high-value security targets.**

This produces the **full candidate list** — files both inside and outside `src/`.
Do not restrict the scan to `src/` or any other subdirectory unless the user explicitly
requests it with a path argument.

For `--changed` and `--pr`, the git commands already produce a root-relative file list —
use those directly as the candidate list without any path filtering.

### Step 0c2 — Sort candidate files by priority

Sort the candidate list in this order before applying the budget cap.
This ensures that if context is exhausted, it happens after high-value files are scanned:

1. **Static asset directories** — `public/*`, `wwwroot/*`, `assets/*` (Critical exposure risk)
2. **Auth and authorisation** — files matching `*auth*`, `*login*`, `*policy*`, `*middleware*`, `*jwt*`, `*identity*`
3. **API controllers and routers** — files matching `*controller*`, `*router*`, `routes/*`, `*endpoint*`
4. **Data access layer** — files matching `*repository*`, `*context*`, `*service*`, `*store*`
5. **Configuration and environment** — `appsettings*.json`, `.env*`, `*config*`, `*.tf`, `*pipeline*`, `*workflow*`, `Dockerfile`
6. **Angular components with data binding** — `*.component.ts`, `*.component.html`
7. **Tests, utilities, helpers** — `*.spec.ts`, `*test*`, `*helper*`, `*util*` (lowest priority)

Within each tier, sort alphabetically. Apply the 40-file budget cap after sorting —
this guarantees the most security-sensitive files are always scanned regardless of project size.

### Step 0d — Load cache and identify changed files

First, check which mode applies — this determines whether the cache is consulted at all:

---

**IF `--full` or `--ci` flag was given:**

```
SKIP THE CACHE ENTIRELY.
Every file in the candidate list is CHANGED → scan all of them.
Do not read file-cache.json.
Do not compare character counts.
Do not skip any file.
Jump directly to Step 0e.
```

---

**IF `--changed` or `--pr` flag was given:**

The candidate list already came from git — those files are all CHANGED by definition.
Do not consult the cache. Scan all files in the git-derived list.
Jump directly to Step 0e.

---

**IF no flag was given (default cache-aware scan):**

```bash
cat .claude/file-cache.json 2>/dev/null || echo "NO_CACHE"
```

If `NO_CACHE` → treat every file in the candidate list as CHANGED, scan all.

Otherwise, for each file in the candidate list:
1. Get current char count: `wc -c <file>`
2. Compare to `files[path].charCount` in the cache
3. Counts differ or file missing from cache → **CHANGED** → scan this file
4. Counts match → **UNCHANGED** → skip this file

---

**Hard rule: `--full` means scan everything. No file is ever skipped when `--full` is set.**

### Step 0e — Load analysis references, then report scope

Load the reference files required for analysis. Do this BEFORE reporting scope:

```
Read skills/security/references/output-formats.md
Read skills/security/references/domain-guidance.md
Read skills/security/references/cross-cutting-principles.md
Read skills/shared/business-context-severity.md
```

For the detected language stack, also load the relevant sections of:
```
Read skills/security/references/language-notes.md  (dotnet and typescript sections only)
```

Then report scope:

```
🛡 Security Review Scope
  Mode    : cache-aware | --changed | --pr | --full | --ci | --area {name} | --continue
  Area    : {all | backend | frontend | config | <AreaName>}
  Language refs: .NET · TypeScript  (lazy-loaded)
  Scan root: project root (all directories)
  Priority: auth/controllers/data/config/components/tests
  Files to scan: N  (session budget: 40 max)
  Files skipped (cache): M
  Files queued for next session: {K or "none"}
```

If 0 files changed:
```
✅ No changed files since last security review.
Use --full to force a complete rescan.
```

### Step 0f — Update cache after scan

After completing analysis, update `.claude/file-cache.json`:
- Update `charCount`, `lastScanned`, add `"security"` to `scannedBy` for every scanned file
- Merge with existing entries — do not overwrite code-review or other skill data
- See `../shared/file-cache-schema.md` for merge rules (load on first use)

---

### Step 0f2 — Write/update the security ledger

After generating the HTML report, write or update `security/security-ledger.md`.
This is the persistent finding record that enables `/fix` to apply remediations
and `checkin`/`pr-create` to gate on open findings.

Create the `security/` folder if it does not exist:
```bash
mkdir -p security
```

**Fingerprint generation** — use the same algorithm as code-review:
```bash
# fingerprint = "FP-" + first 8 chars of SHA-1 of: checker + "|" + file + "|" + vuln_type + "|" + short_description
!node -e "console.log('FP-' + require('crypto').createHash('sha1').update(process.argv[1]).digest('hex').slice(0,8))" "SQLI|UserRepository.cs|SQL injection|user input concatenated into query"

**Collision check** — after computing each fingerprint, verify it does not already
exist in the ledger with different content. If a collision is detected, append a
counter suffix: `FP-a1b2c3d4` → `FP-a1b2c3d4b`. Collisions are rare but silent
when undetected — always check.
```

**What gets a fingerprint** — only findings with a concrete source-level fix:
- A finding qualifies if it has a specific file, a vulnerable code snippet, and a corrected code snippet
- Findings that are advisory-only (e.g. "consider adding rate limiting") get `manual-fix-required` in place of an FP ID and are excluded from the fix workflow

**Read the existing ledger first** (if it exists) to reconcile:
```bash
cat security/security-ledger.md 2>/dev/null || echo "NO_LEDGER_YET"
```

Reconciliation rules (identical to code-review):
1. **Still Open** — finding in both current scan AND ledger (status Open): keep as Open, update `last-seen` date
2. **Newly Fixed** — finding in ledger as Open but NOT in current scan: mark as Fixed, note date
3. **New** — finding in current scan but NOT in ledger: add as new Open entry
4. **Already Fixed** — finding in ledger as Fixed and absent from current scan: leave unchanged
5. **Dismissed** — delegate entirely to `../shared/dismissed-findings-reconciliation.md`
   (spec v1.0). Keep dismissed if file unchanged since `dismissed-date`; set
   `verify-flag: code-changed` and re-open as Open (preserving original dismissal
   metadata as a note) if the file has commits since `dismissed-date`. Never count
   dismissed findings toward open totals.

Write `security/security-ledger.md` with this structure:

```markdown
# Security Ledger
_Last updated: YYYY-MM-DD · Managed by /security-review · Do not edit manually_

## Summary
Open: N · Fixed: N · Dismissed: N · Manual-fix-required: N

---

## Open Findings

### [FP-xxxxxxxx] <VULN-TYPE> — <Severity>
- **File**: <file>
- **Location**: <function or route>
- **First detected**: <date>
- **Last seen**: <date>
- **Status**: Open
- **Description**: <one line — what the vulnerability is>
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
- **Fix explanation**: <one line — what changed and why>

(repeat per fixable open finding)

---

## Manual-Fix-Required Findings

### <VULN-TYPE> — <Severity>
- **Finding**: <description>
- **Recommendation**: <what to do>
- **Status**: manual-fix-required
- **Reason**: <why no auto-fix: config-level / infra-level / requires-design-decision>

(repeat per advisory finding)

---

## Fixed Findings

### [FP-xxxxxxxx] <VULN-TYPE> — <Severity>
- **File**: <file>
- **First detected**: <date>
- **Fixed date**: <date>
- **Fixed by**: [auto-fix via /fix] or [manual]
- **Status**: Fixed

(repeat per fixed finding)

---

## Dismissed Findings

### [FP-xxxxxxxx] <VULN-TYPE> — <Severity>
- **File**: <file>
- **Location**: <function or route>
- **First detected**: <date>
- **Status**: Dismissed
- **Dismissed date**: <date>
- **Dismissed by**: <git user>
- **Reason**: <false-positive | wont-fix | accepted-risk | by-design>
- **Justification**: <free-text explanation>
- **Verify flag**: <none | code-changed>

(repeat per dismissed finding)
```

**Add `security/` to `.gitignore`** if not already present (check and append):
```bash
grep -q "^security/" .gitignore 2>/dev/null || echo "security/" >> .gitignore
```

---


---

## Step 0g — Checkpoint file (resume on connection drop)

Before scanning any files, write a checkpoint file so the skill can resume if the
connection drops mid-scan rather than starting over.

```bash
mkdir -p .claude
CHECKPOINT=".claude/security-checkpoint.json"
```

**On start:** write the checkpoint with the full file list and scan status:
```json
{
  "started": "YYYY-MM-DDTHH:MM:SSZ",
  "scope": "--changed | --pr | --full | default",
  "files": [
    { "path": "src/Controllers/UserController.cs",  "status": "pending" },
    { "path": "src/Services/AuthService.cs",        "status": "pending" },
    { "path": "angular.json",                        "status": "pending" },
    { "path": "environments/environment.prod.ts",   "status": "pending" },
    { "path": ".github/workflows/deploy.yml",        "status": "pending" }
  ],
  "findings": []
}
```

**After each file is scanned:** update that file's status to `"done"` and append
any findings to the `"findings"` array. Write the checkpoint after every file —
not just at the end.

**On next run — detect and offer resume:**

```bash
cat .claude/security-checkpoint.json 2>/dev/null || echo "NO_CHECKPOINT"
```

If the checkpoint exists and has `"status": "pending"` files:
```
⚠ Found an incomplete security scan from {started}.
  Scanned : {done_count} files
  Remaining: {pending_count} files
  Findings so far: {finding_count}

Resume from where it stopped? (yes / no — 'no' starts a fresh scan)
```

- If `yes`: skip files already marked `"done"`, continue from the first `"pending"` file,
  merge with existing findings, then generate the final report.
- If `no`: delete the checkpoint file and start fresh.

**On successful completion:** delete `.claude/security-checkpoint.json`.

**On failure / connection drop:** the checkpoint survives — next run detects it and offers resume.

> Add `.claude/security-checkpoint.json` to `.gitignore` — it is a runtime file, not source.

---


## Model routing

This skill is in the **review tier** — it uses `REVIEW_MODEL` (default: `claude-sonnet-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "REVIEW_MODEL": "claude-sonnet-4-6" } }
```

See `../shared/model-routing-spec.md` for full routing documentation.


### Step 0h — Mandatory .gitignore coverage check

Run this on every scan regardless of scope flags. A misconfigured .gitignore is a
data exposure vector regardless of what else is found.

```bash
# Check .gitignore exists
ls .gitignore 2>/dev/null || echo "NO_GITIGNORE"

# Check for sensitive files that exist but are NOT gitignored
SENSITIVE_PATTERNS=(
  ".claude/settings.json"
  ".claude/settings.local.json"
  ".claude/file-cache.json"
  ".env"
  ".env.local"
  ".env.production"
  "*.pem"
  "*.key"
  "*.p12"
  "*.pfx"
  "appsettings.json"
  "appsettings.Production.json"
  "secrets.json"
)
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  # Check if file exists
  found=$(find . -name "$pattern" -not -path "./.git/*" 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    # Check if it's covered by .gitignore
    git check-ignore -q "$found" 2>/dev/null || echo "NOT_GITIGNORED: $found"
  fi
done
```

Any file that exists AND is not gitignored AND contains sensitive data →
**Low finding** (or Higher if the repo is public or the data is critical).

Report format:
```
SEC-L00X — Sensitive file not covered by .gitignore
- File: .claude/settings.json
- Risk: Contains AZURE_DEVOPS_PAT — would be committed if git push is run
- Fix: Add .claude/settings.json to .gitignore
```

---

## 0.5 — Static asset directory audit (ALWAYS runs first, before SAST)

**This check runs before any code analysis.** It takes under 10 seconds and catches
the class of finding most likely to cause an immediate data breach: real data files
committed into directories that Angular, .NET, or Node.js serve without authentication.

### Why this runs first

Static asset directories (`public/`, `wwwroot/`, `assets/`, `static/`) are served
directly by the web server or Angular's build output. Every file inside them is
reachable by URL with no authentication, no authorisation check, and no API layer.
A single data file committed here bypasses every security control in the entire stack.
This check must not be skipped, deprioritised, or folded into the general SAST pass.

### Step — enumerate static-serving directories

```bash
# Find all static asset directories in the project
find . \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" \
  -not -path "./bin/*" \
  -not -path "./obj/*" \
  -type d \( \
    -name "public" \
    -o -name "wwwroot" \
    -o -name "assets" \
    -o -name "static" \
    -o -name "StaticFiles" \
    -o -name "Content" \
  \) | sort
```

For each directory found, list ALL files inside it:

```bash
find {directory} -type f | sort
```

### Step — classify every file found

For each file in a static-serving directory, apply this classification:

| File type | Expected? | Action |
|---|---|---|
| `*.html`, `*.css`, `*.js`, `*.woff`, `*.woff2`, `*.ttf`, `*.svg`, `*.png`, `*.jpg`, `*.ico` | ✅ Normal static assets | Skip |
| `*.json` with **only** UI config (theme, i18n strings, feature flags, column definitions) | ⚠️ Review content | Read the file |
| `*.json` containing real entity data (names, IDs, case details, any domain records) | 🚨 CRITICAL | Immediate finding — see below |
| `*.json` containing credentials, API keys, connection strings | 🚨 CRITICAL | Immediate finding |
| `*.csv`, `*.xlsx`, `*.xml`, `*.sql` | 🚨 CRITICAL unless provably empty templates | Immediate finding |
| `*.env`, `*.config`, `*.pem`, `*.key`, `*.pfx` | 🚨 CRITICAL | Immediate finding |
| Any backup file (`*.bak`, `*.old`, `*.orig`, `*.backup`) | 🚨 CRITICAL | Immediate finding |
| Any file that is not a standard static web asset | ⚠️ Flag | Medium unless content is sensitive |

### Step — read JSON files to determine content type

For every `.json` file in a static-serving directory:

1. Read the file
2. Determine: does it contain **real entity data**?

Signals of real entity data (flag as CRITICAL regardless of quantity):
- Personal names (firstName, lastName, fullName, name fields with actual values)
- Government-issued IDs: A-Numbers, passport numbers, SSNs, NI numbers, visa numbers
- Case or matter identifiers tied to real individuals
- Attorney-client communications or matter descriptions
- Medical, financial, immigration, or legal records
- Email addresses, phone numbers, physical addresses
- Any field whose value looks like a real person's data (not a placeholder/mock)

Signals that the file is safe UI config (do not flag):
- Pure arrays of column definitions, filter configs, theme tokens
- i18n string maps (key → translated string)
- No fields whose values are names, IDs, or case-specific data

### Step — raise CRITICAL finding immediately if real data is found

Do not wait until the end of the scan. Raise this finding immediately and display
it at the top of the security review output, before all other findings:

```
🚨 CRITICAL — {plain English title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Severity  : CRITICAL
- **CVSS v3.1**     : <mathematical score> (<vector>)
- **Business sev.** : Critical (override: privileged/PII data + override triggers apply)
File      : {path/to/file}  ← publicly accessible at http://[server]/{filename}
OWASP     : A02 Cryptographic Failures / A01 Broken Access Control
CWE       : CWE-312 Cleartext Storage of Sensitive Information

What is happening:
  {file} is inside a static asset directory that {Angular build / .NET Kestrel /
  Node.js Express static middleware} serves without any authentication. Every file
  in this directory is reachable by URL — no login, no token, no session required.
  This file contains: {describe the actual data found — names, IDs, case details,
  exactly what categories of PII or confidential data were found}.

Impact:
  Anyone who can reach the web server can download the complete file contents at
  http://[server]/{filename}. No authentication bypass is required. This is not a
  theoretical risk — the data is exposed right now on any running instance.
  {For legal/immigration data}: This likely constitutes a breach of attorney-client
  privilege and may trigger mandatory breach notification obligations.

Remediation — IMMEDIATE action required:
  1. Delete {file} immediately: git rm {file} && git commit -m "Remove exposed data file"
  2. Also purge it from git history (the file may have been committed for some time):
     git filter-repo --path {file} --invert-paths
     (or use git filter-branch / BFG Repo-Cleaner)
  3. Assume the data has already been accessed — check web server access logs for
     requests to /{filename} going back to when the file was first committed
  4. Never put real data in any static-serving directory. All data must come from
     the authenticated API. Use mock/fixture data (fake names, fake IDs) for any
     local development fixtures — never real records.
  5. Add a CI check to block commits of .json files containing real data patterns
     to public/ or equivalent directories.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Hard rules for this check

- **NEVER skip this check** regardless of scope flag. It runs on `--changed`, `--pr`,
  `--full`, `--ci`, and default scans. A data file exposed in `public/` is a breach
  regardless of what changed in this commit.
- **NEVER downgrade from CRITICAL** because the app is "internal" or "behind a VPN".
  Network access controls are not the same as application-level authentication.
  The CVSS score is based on impact if reached, not on assumed perimeter security.
- **ALWAYS raise the finding before SAST analysis** — do not bury it in a list of
  Medium injection findings.
- **ALWAYS include the git history purge step** — deleting the file is not sufficient
  if it has been committed; the data remains in git history.
- For this project specifically: any data involving client names, matter numbers,
  A-Numbers, or attorney-client content is attorney-client privileged. The finding
  severity does not decrease because the data set is small.

---

## 1. Orientation — Read First

Before responding, answer three questions internally:

1. **Domain** — Which primary domain applies?
   - `appsec` — code review, SAST findings, secure coding, API security
   - `cloud` — AWS/GCP/Azure posture, IaC (Terraform/CDK), IAM, network controls
   - `threat-model` — architecture diagrams, data-flow analysis, STRIDE/PASTA
   - `ir-forensics` — active incident, log triage, malware analysis, post-mortem
   - `compliance` — SOC2, ISO 27001, NIST CSF/800-53, CIS Benchmarks, HIPAA, PCI-DSS
   - `weekly-summary` — combined security health report for managers and leads

2. **Audience** — Developer? Security engineer/pentester? GRC/manager? Mixed?
   - Developers: lead with actionable fixes and code snippets; explain *why* last.
   - Security engineers: use standard taxonomy (CWE, CVE, CVSS), skip basics.
   - GRC/managers: lead with business risk and compliance mapping; avoid deep technical jargon.

3. **Output type** — What does this task need?
   See §2 for the canonical output formats.

---

## 2. Output Formats

Load `references/output-formats.md` now — this file is required for the analysis pass.
Do not proceed to scanning until this file is loaded.

---

## 3. Domain Guidance

Load `references/domain-guidance.md` now — this file contains the checker patterns
and severity calibration for the detected language stack.
Do not proceed to scanning until this file is loaded.

---

## 4. Cross-Cutting Principles

Load `references/cross-cutting-principles.md` now.

---


## 5. Reference Files

Load in Step 0e (before analysis):

| File | When to load |
|------|-------------|
| `references/output-formats.md` | Always — required for every analysis pass |
| `references/domain-guidance.md` | Always — checker patterns, IDOR patterns, severity calibration |
| `references/cross-cutting-principles.md` | Always — writing quality rules |
| `references/language-notes.md` | Only for detected language stack (dotnet/typescript sections) |
| `references/compliance-controls.md` | Only if user mentions a compliance framework |
| `references/cloud-checks.md` | Only if cloud infrastructure files detected |
| `references/weekly-summary-template.md` | Only for weekly summary requests |
| `../shared/business-context-severity.md` | Always — B1–B7 override triggers |
| `../shared/source-file-consent.md` | Always — consent category enforcement |
| `../shared/file-cache-schema.md` | On first cache-write only |
| `../shared/scope-flags-spec.md` (v1.4) | On first scope resolution only |
| `../shared/graph-index-schema.md` · `../shared/graph-module-schema.md` | Knowledge-graph schema (index + per-module detail) used for `--area` orientation |

---

## 6. Example Trigger Phrases

This skill should activate for requests like:
- "Review this code for security issues"
- "Is this Terraform config secure?"
- "Help me threat model this architecture"
- "We had a potential breach — what do I do?"
- "Map our controls to SOC2"
- "What's the CVSS score for this finding?"
- "Harden this IAM policy"
- "Write a security review for this PR"
- "What are the OWASP risks in this API?"
- "Help me respond to this GuardDuty alert"
- "Generate the weekly security summary for my manager"
- "Create a security health report for this week"
- "Produce a security digest for the leadership team"
