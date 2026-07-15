---
description: >
  Use when the user asks to review code for security issues, vulnerabilities, or bugs; or mentions
  CVEs, OWASP, SAST, pentesting, hardening, threat modeling, incident response, compliance
  (SOC2, ISO 27001, NIST, PCI-DSS, HIPAA), cloud security posture, or asks "is this secure?".
  Also use for weekly security health reports and manager security briefings.
---

# Claude Security Skill

_Skill version: 2.0 · Last changed: 2026-07-06 · Plugin compatibility: >=1.14.0 · Consent: A_

A structured security review skill using the **three-pass scan architecture**.
Covers application security, cloud infrastructure, threat modeling, and
compliance mapping. Stack-agnostic — detects the project's language stack and
loads only matching reference files.

---

> **Single-writer assumption**: This skill writes to a persistent cache file. See `$PLUGIN_DIR/skills/shared/single-writer-assumption.md` for concurrency constraints and CI guidance.

## Model routing

This skill is in the **review tier** — it uses `REVIEW_MODEL` (default: `claude-sonnet-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "REVIEW_MODEL": "claude-sonnet-4-6" } }
```

See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for full routing documentation.

## Persona

Execute as **[SEC] Dana Ito — Security Engineer** (12 yrs appsec). Optimizes for attacker's-eye
risk; always asks "how would I abuse this?" Carry the compliance-framework lens within this role,
and weigh [SA] Solution Architect concerns when a finding is architectural (trust boundaries, data
flow). Expertise spans **this project's actual stack and languages** (per architecture.md /
detected_stacks), every layer present — never a fixed technology.

The persona sets *what to scrutinize* — it never licenses assumption. Findings must cite evidence
(file/function/pattern); a persona's "experience" is never evidence and never a substitute for the
free-form pass's citation rule (ADR 0045). Subordinate to CLAUDE.md section 3 (do not assume). Never
name the persona in the report or ledger. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Scan Architecture — Three Passes

This skill implements the three-pass scan architecture defined in
`$PLUGIN_DIR/skills/shared/three-pass-spec.md`. Read that spec for the full architecture.

```
Pass 1 — STRUCTURED RULE-BASED SCAN
   Known security patterns, deterministic checks. Fast, reproducible.
   Owns hard pass/fail signals (secrets, injection, critical misconfigs).
        |
        v
Pass 2 — SPECIALIZED PERSONA PASSES
   Four focused reviews, each anchored to one threat model.
   Catches what flat checklists miss — chains, flows, gaps.
        |
        v
Pass 3 — FREE-FLOW ADVERSARIAL PASS
   Open-ended. De-scoped from everything above. Catches the
   unknown, the contextual, and the interactions between changes.
```

---

## Step 0 — Scope and Infrastructure

### Step 0a — Interactive scope menu

If no scope flag was provided, present the interactive menu and WAIT for the
developer to choose. Do not proceed without a selection.

See `$PLUGIN_DIR/skills/shared/interactive-menu-spec.md` for the full menu specification.

The skill icon is a shield. The skill name is "Security Review".

### Step 0b — Stack detection

Detect the project's language stack BEFORE loading any reference files.

```bash
# Check for language signals
find . -name "*.cs" -maxdepth 4 | head -1 && echo "DOTNET"
find . -name "*.ts" -maxdepth 4 | head -1 && echo "TYPESCRIPT"
find . -name "*.py" -maxdepth 4 | head -1 && echo "PYTHON"
find . -name "*.java" -maxdepth 4 | head -1 && echo "JAVA"
find . -name "*.go" -maxdepth 4 | head -1 && echo "GO"
```

Announce what will be loaded:
```
Security Review — Stack detection
  Detected: {detected stacks}
  Loading: {language-specific references to load}
  Skipping: {languages not present}
```

Only load the language-notes.md sections for detected languages. Do NOT load
Python, Java, or Go notes for a pure .NET/TypeScript project. Do NOT load
cloud-checks.md unless cloud infrastructure files are present. Load
compliance-controls.md only if the user mentions a compliance framework.

### Step 0c — Determine scope

Apply scope flags per `$PLUGIN_DIR/skills/shared/scope-flags-spec.md`. Supported flags:

| Flag | Behaviour |
|---|---|
| `--changed` | Staged + unstaged modified files only |
| `--pr` | Branch diff vs base |
| `--full` | All files, ignore cache |
| `--ci` | Same as `--full`, warns if cache found |
| `--area backend` | Server-side source files (extensions per detected stack) |
| `--area frontend` | Client-side files (*.ts, *.html, *.jsx, *.tsx) |
| `--area config` | Config/IaC (*.json, *.yml, *.env, Dockerfile, *.tf) |
| `--area <ModuleName>` | Knowledge-graph module files |
| `--continue` | Resume from checkpoint |
| (none) | Interactive menu (Step 0a) |

### Step 0d — Build candidate file list

Enumerate from the project root. NEVER restrict to `src/` or any subdirectory.
Use the canonical find command from `$PLUGIN_DIR/skills/shared/scope-flags-spec.md`.

### Step 0e — Sort by priority

1. **Static asset directories** — `public/*`, `wwwroot/*`, `assets/*`
2. **Auth and authorization** — `*auth*`, `*login*`, `*policy*`, `*middleware*`, `*jwt*`
3. **API controllers and routers** — `*controller*`, `*router*`, `routes/*`
4. **Data access layer** — `*repository*`, `*context*`, `*service*`, `*store*`
5. **Configuration** — `appsettings*`, `.env*`, `*config*`, `*.tf`, `Dockerfile`
6. **Frontend components** — `*.component.ts`, `*.component.html`, `*.jsx`, `*.tsx`
7. **Tests and utilities** — `*.spec.ts`, `*test*`, `*helper*` (lowest priority)

### Step 0f — Cache-aware file selection

For default scans (no `--full`, `--ci`, `--changed`, `--pr`):
- Read `.claude/file-cache.json` per `$PLUGIN_DIR/skills/shared/file-cache-schema.md`
- Compare charCount for each file; skip unchanged files
- If no cache exists, treat all files as changed (first run)

For `--full` / `--ci`: skip cache entirely, scan all files.
For `--changed` / `--pr`: git-derived list, no cache check.

### Step 0g — Load references and report scope

Load the core references — read `.claude/plugin-path.txt` to get PLUGIN_DIR
(if absent, use `skills/shared/plugin-path-resolution.md §1a`), then:
```
Read $PLUGIN_DIR/skills/security/references/pass1-patterns.md
Read $PLUGIN_DIR/skills/security/references/output-formats.md
Read $PLUGIN_DIR/skills/security/references/cross-cutting-principles.md
Read $PLUGIN_DIR/skills/shared/business-context-severity.md
```

Load language-specific patterns for detected stack:
```
Read $PLUGIN_DIR/skills/security/references/language-notes.md (only detected language sections)
```

Load architecture security context if present (do NOT scan source for it):
```
Read .claude/architecture/architecture-security.md      (if present)
Read .claude/architecture/architecture-integrations.md  (if present)
Read .claude/architecture/architecture-deployment.md    (if present — auth mechanics + NFR)
```
- `architecture-security.md` — trust boundaries + the authorization model (Action → Role/Policy
  → Enforced-at). Use it to focus SEC-AUTHZ checks on the documented enforcement points and to
  spot gaps (an action with no documented policy).
- `architecture-integrations.md` — external dependencies + contracts; use for SSRF / third-party
  / data-egress surface.
- **Staleness caveat:** these docs describe the *intended* model and may lag the code. Treat them
  as a map of where to look, NOT as evidence that a control exists — always confirm in source.
  If the code contradicts the doc, report the drift.

Report scope:
```
Security Review Scope
  Mode     : {resolved scope}
  Stack    : {detected languages}
  Scan root: project root (all directories)
  Files    : N to scan, M skipped (cache)
  First run: true | false
```

If 0 files to scan:
```
No changed files since last security review.
Use --full to force a complete rescan.
```
And stop.

### Step 0h — Write checkpoint

Write the checkpoint file per `$PLUGIN_DIR/skills/shared/checkpoint-schema.md` before scanning.
Update after each file. Delete on completion.

---

## Pre-Scan — Static Asset Audit

**This runs BEFORE Pass 1, regardless of scope flag.**

Load and execute `$PLUGIN_DIR/skills/security/references/static-asset-audit.md`. This check enumerates
static-serving directories completely even on `--changed` or `--pr` scans —
a data file committed to `public/` weeks ago is a live exposure now.

Any CRITICAL finding from this audit is reported immediately, before Pass 1.

---

## Pre-Scan — .gitignore Coverage

**This runs BEFORE Pass 1, regardless of scope flag.**

Check `.gitignore` coverage for sensitive file patterns per
`$PLUGIN_DIR/skills/security/references/pass1-patterns.md` section SEC-GITIGNORE.

```bash
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
  found=$(find . -name "$pattern" -not -path "./.git/*" 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    git check-ignore -q "$found" 2>/dev/null || echo "NOT_GITIGNORED: $found"
  fi
done
```

---

## Pass 1 — Structured Rule-Based Scan

Apply the deterministic security patterns from `$PLUGIN_DIR/skills/security/references/pass1-patterns.md`
and the language-specific patterns from `$PLUGIN_DIR/skills/security/references/language-notes.md` to every
in-scope file.

### What Pass 1 checks

Load `$PLUGIN_DIR/skills/security/references/pass1-patterns.md` for the full pattern catalog. Categories:

| Category | ID | Focus |
|---|---|---|
| Injection | SEC-INJ | SQL, command, template, LDAP, XPath, NoSQL |
| Authentication | SEC-AUTH | Missing auth, session issues, hardcoded creds |
| Access Control | SEC-AUTHZ | IDOR, missing ownership checks, role gaps |
| Data Exposure | SEC-DATA | Secrets in code, weak crypto, missing TLS |
| Misconfiguration | SEC-CONFIG | Debug mode, CORS, headers, cookies |
| Deserialization | SEC-DESER | Unsafe parse, type-controlled deser, prototype pollution |
| SSRF | SEC-SSRF | User-controlled URLs to HTTP clients |
| XXE | SEC-XXE | XML parsers with external entities |
| DOM Security | SEC-DOM | Direct DOM, DomSanitizer bypass, innerHTML |
| Data Export | SEC-EXPORT | Unscoped exports, missing audit logging |
| Audit Logging | SEC-AUDIT | Missing who/when/what logging |
| Rate Limiting | SEC-RATE | No rate limits on auth/data endpoints |
| Console Logging | SEC-CONSOLE | PII in console, error object exposure |
| Dependencies | SEC-DEPS | Vulnerable dependency signals |
| Git Ignore | SEC-GITIGNORE | Sensitive files not covered |

### Pass 1 output

Every finding gets:
1. A fingerprint per `$PLUGIN_DIR/skills/shared/fingerprint-spec.md`
2. A pattern ID (SEC-INJ, SEC-AUTH, etc.)
3. File, function/location
4. Severity (technical + business override)
5. Vulnerable code snippet
6. Corrected code snippet (copy-pasteable fix)
7. Pass: 1

Update the checkpoint after each file.

---

## Pass 2 — Specialized Persona Passes

Load `$PLUGIN_DIR/skills/security/references/pass2-personas.md` for persona definitions.

Run four focused reviews sequentially. Each persona:
- Receives the file set + ALL prior findings (Pass 1 + prior personas)
- Has a de-duplication gate (MUST NOT re-report same file + vuln_class)
- Must cite file/function/evidence
- Max 5 findings each

| Order | Persona | Lens | Activation |
|---|---|---|---|
| P1 | Attacker | Exploitation chains, auth bypass, privilege escalation | Always |
| P2 | Data Protection Analyst | Sensitive data flows, cross-boundary leaks, retention | Always |
| P3 | Access Control Auditor | Authorization gaps, role hierarchy, object-level auth | Always |
| P4 | Infrastructure Hardener | Cloud IAM, IaC, containers, CI/CD, network | Only if infra files detected |

### De-duplication instruction (inject before each persona)

```
You have already found these findings in prior passes:
{summary: fingerprint, file, vuln_class for each}

DO NOT re-report any finding covering the same file + vulnerability class.
Only report NEW findings that add information not captured above.
```

### Pass 2 output

Findings follow the format in `$PLUGIN_DIR/skills/security/references/pass2-personas.md`. Fingerprint
fixable findings per `$PLUGIN_DIR/skills/shared/fingerprint-spec.md`. Set Pass: 2.

---

## Pass 3 — Free-Flow Adversarial Pass

De-scoped from everything above. Receives ALL prior findings and MUST NOT
re-report any of them.

### Instruction

```
Analyze the code and all prior findings. Reason as a senior application
security engineer focusing on what file-level patterns and persona reviews
typically miss:

- Interaction effects between components
- Business logic flaws that no pattern catches
- Trust boundary violations across service seams
- Insecure defaults under specific deployment configurations
- Race conditions, TOCTOU, error-handling gaps that weaken security posture
- "What did all the above passes miss?"

Report the most impactful risks (up to 7). Only include risks you can tie to
specific evidence — cite the file, function, or pattern observed.

For each risk:
- Name (plain English)
- Severity and likelihood (one line each, with justification)
- Why it matters in THIS codebase (reference specific code)
- A specific, actionable mitigation (config or code change, not generic advice)

Do not assign CVSS scores — these are qualitative assessments.

Label the section: "LLM-inferred risk hypotheses — validate before treating
as confirmed vulnerabilities."
```

### Pass 3 output

Advisory findings. Not fingerprinted. Not entered in the ledger unless promoted.
Set Pass: 3.

---

## Post-Scan — Report Assembly

### HTML report

Generate a self-contained HTML report with:
1. **Summary** — open/fixed/dismissed counts, scan metadata
2. **Pre-Scan Findings** — static asset audit, gitignore coverage
3. **Pass 1 Findings** — structured findings table, sorted by severity
4. **Pass 2 Findings** — "Expert Analysis" section, by persona
5. **Pass 3 Findings** — "Risk Hypotheses" section (labeled advisory)

Write to `security/security-review-{YYYY-MM-DD}.html`.

### Ledger update

Write or update `security/security-ledger.md` per `$PLUGIN_DIR/skills/shared/ledger-schema.md`.

Read existing ledger first:
```bash
cat security/security-ledger.md 2>/dev/null || echo "NO_LEDGER_YET"
```

Apply reconciliation rules from `$PLUGIN_DIR/skills/shared/ledger-schema.md`:
1. Still Open → keep Open, update last-seen
2. Newly Fixed → mark Fixed
3. New → add as Open
4. Already Fixed → leave unchanged
5. Dismissed → delegate to `$PLUGIN_DIR/skills/shared/dismissed-findings-reconciliation.md`

Create folder and add to .gitignore:
```bash
mkdir -p security
grep -q "^security/" .gitignore 2>/dev/null || echo "security/" >> .gitignore
```

### Cache update

Update `.claude/file-cache.json` per `$PLUGIN_DIR/skills/shared/file-cache-schema.md`:
- Update charCount, lastScanned, add "security" to scannedBy
- Merge with existing entries

### Checkpoint cleanup

Delete `.claude/security-checkpoint.json` on successful completion.

---

## Reference Files

| File | When to load |
|------|-------------|
| `$PLUGIN_DIR/skills/security/references/pass1-patterns.md` | Always — Pass 1 structured patterns |
| `$PLUGIN_DIR/skills/security/references/pass2-personas.md` | Always — Pass 2 persona definitions |
| `$PLUGIN_DIR/skills/security/references/static-asset-audit.md` | Always — pre-scan check |
| `$PLUGIN_DIR/skills/security/references/output-formats.md` | Always — report formatting rules |
| `$PLUGIN_DIR/skills/security/references/cross-cutting-principles.md` | Always — writing quality rules |
| `$PLUGIN_DIR/skills/security/references/language-notes.md` | Only detected language sections |
| `$PLUGIN_DIR/skills/security/references/domain-guidance.md` | Pass 2 + Pass 3 context (cloud, threat model, IR sections) |
| `$PLUGIN_DIR/skills/security/references/cloud-checks.md` | Only if cloud/IaC files detected (P4 persona) |
| `$PLUGIN_DIR/skills/security/references/compliance-controls.md` | Only if user mentions a compliance framework |
| `$PLUGIN_DIR/skills/security/references/weekly-summary-template.md` | Only for weekly summary requests |
| `$PLUGIN_DIR/skills/shared/three-pass-spec.md` | Architecture reference |
| `$PLUGIN_DIR/skills/shared/interactive-menu-spec.md` | Menu specification |
| `$PLUGIN_DIR/skills/shared/scope-flags-spec.md` | Scope flag definitions |
| `$PLUGIN_DIR/skills/shared/file-cache-schema.md` | Cache schema and merge rules |
| `$PLUGIN_DIR/skills/shared/checkpoint-schema.md` | Checkpoint schema |
| `$PLUGIN_DIR/skills/shared/fingerprint-spec.md` | Fingerprint generation |
| `$PLUGIN_DIR/skills/shared/ledger-schema.md` | Ledger format and reconciliation |
| `$PLUGIN_DIR/skills/shared/business-context-severity.md` | B1-B7 override triggers |
| `$PLUGIN_DIR/skills/shared/source-file-consent.md` | Consent category enforcement |
| `$PLUGIN_DIR/skills/shared/dismissed-findings-reconciliation.md` | Rule 5 dismissed finding handling |
| `$PLUGIN_DIR/skills/shared/graph-index-schema.md` / `graph-module-schema.md` | Knowledge graph for --area |

---

## Example Trigger Phrases

- "Review this code for security issues"
- "Is this Terraform config secure?"
- "Help me threat model this architecture"
- "Map our controls to SOC2"
- "What are the OWASP risks in this API?"
- "Generate the weekly security summary for my manager"
- "Run a security scan"
- "Is this secure?"
