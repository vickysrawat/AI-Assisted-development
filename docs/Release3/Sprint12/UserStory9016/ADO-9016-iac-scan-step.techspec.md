# Tech Spec — Security Skill: Dedicated IaC Scan Step (Sub-Agent)
ADO #9016 · Release R3 · Sprint S12
Status: DRAFT

---

## Overview

This story adds a dedicated IaC Scan Pre-Scan step to `skills/security/SKILL.md` that detects Dockerfile, docker-compose, and Kubernetes YAML files in the repo, delegates scanning to a sub-agent whose context is restricted to the IaC file list and the new `iac-scan.md` rule catalog, and merges the validated findings into `security/security-ledger.md` as `SEC-CONTAINER` or `SEC-IAC` entries — each with an FP fingerprint, file path, severity, rule, evidence, and a `fix` snippet. A new `scripts/validate-iac-findings.cjs` script validates the sub-agent's JSON output before any ledger write (all-or-nothing: a malformed batch is rejected, logged to `.claude/logs/`, and raises a single advisory finding). Ancillary changes narrow the P4 persona's scope in `pass2-personas.md` (de-dup gate excludes SEC-CONTAINER/SEC-IAC already logged this run) and remove the duplicate per-rule container checks from `cloud-checks.md`. The `_deploy-manifest.json` registers `iac-scan.md` for `REFRESH RULES` tooling, and a new Section 1c-quad check in `setup-status/SKILL.md` reads the `Last-validated:` and `Stale-after: 90` metadata directly from the `iac-scan.md` header to flag staleness — no manifest schema change required.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | IaC Scan Pre-Scan step positioned after .gitignore, before Pass 1 | `skills/security/SKILL.md` | ✅ Covered |
| AC-F2 | `find` command globs Dockerfile, docker-compose*.yml, *.yaml under k8s/pipelines/deploy/manifests/ | `skills/security/SKILL.md` | ✅ Covered |
| AC-F3 | Skip message + exit if no IaC files found | `skills/security/SKILL.md` | ✅ Covered |
| AC-F4 | Sub-agent context scoped to file list + iac-scan.md + fingerprint-spec.md + ledger output schema | `skills/security/SKILL.md` | ✅ Covered |
| AC-F5 | Dockerfile/docker-compose findings emitted with ID `SEC-CONTAINER` | `skills/security/SKILL.md`, `skills/security/references/iac-scan.md` | ✅ Covered |
| AC-F6 | K8s YAML findings emitted with ID `SEC-IAC` | `skills/security/SKILL.md`, `skills/security/references/iac-scan.md` | ✅ Covered |
| AC-F7 | Both IDs produce FP-fingerprinted ledger entries, Status: Open | `scripts/validate-iac-findings.cjs`, `skills/security/SKILL.md` | ✅ Covered |
| AC-F8 | `/fix FP-{id}` works on SEC-CONTAINER; produces corrected snippet | `scripts/validate-iac-findings.cjs` (`fix` field required in schema) | ✅ Covered |
| AC-F9 | `/dismiss FP-{id}` works on SEC-IAC; updates ledger status | `scripts/validate-iac-findings.cjs` (correct ledger format ensured) | ✅ Covered |
| AC-F10 | `checkin` Check D fails when any OPEN SEC-CONTAINER/SEC-IAC finding exists | `scripts/validate-iac-findings.cjs` (findings reach ledger with correct ID + Status: Open) | ✅ Covered |
| AC-F11 | `validate-iac-findings.cjs` validates JSON; required fields enumerated | `scripts/validate-iac-findings.cjs` | ✅ Covered |
| AC-F12 | Missing-field batch: entire batch rejected; raw output to `.claude/logs/`; advisory raised; zero ledger writes | `scripts/validate-iac-findings.cjs` | ✅ Covered |
| AC-F13 | `tests/validate-iac-findings.test.cjs` passes with 4 named cases | `tests/validate-iac-findings.test.cjs` | ✅ Covered |
| AC-F14 | `iac-scan.md` contains >= 5 Dockerfile + 5 docker-compose + 9 K8s rules | `skills/security/references/iac-scan.md` | ✅ Covered |
| AC-F15 | Each rule section header: Source + Last-validated + Stale-after | `skills/security/references/iac-scan.md` | ✅ Covered |
| AC-F16 | Coverage map table at top of `iac-scan.md` | `skills/security/references/iac-scan.md` | ✅ Covered |
| AC-F17 | `pass2-personas.md` P4 de-dup gate excludes SEC-CONTAINER/SEC-IAC already in ledger from current scan | `skills/security/references/pass2-personas.md` | ✅ Covered |
| AC-F18 | `cloud-checks.md` per-rule Dockerfile/docker-compose checks removed | `skills/security/references/cloud-checks.md` | ✅ Covered |
| AC-F19 | `_deploy-manifest.json` entry for `iac-scan.md` (for `REFRESH RULES` tooling) | `_deploy-manifest.json` | ✅ Covered |
| AC-F20 | `setup-status` flags `iac-scan.md` amber/red when Last-validated > 90 days | `skills/setup-status/SKILL.md` (new Section 1c-quad reads Last-validated + Stale-after from file header) | ✅ Covered |
| AC-NF1 | Skip path completes <1s; sub-agent not invoked | `skills/security/SKILL.md` (skip gate before sub-agent call) | ✅ Covered |
| AC-NF2 | `validate-iac-findings.cjs` validates <=50 findings in <500ms | `scripts/validate-iac-findings.cjs` | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `skills/security/SKILL.md` | AC-F1, AC-F2, AC-F3, AC-F4, AC-F5, AC-F6, AC-F7, AC-NF1 |
| `skills/security/references/iac-scan.md` | AC-F5, AC-F6, AC-F14, AC-F15, AC-F16 |
| `skills/security/references/cloud-checks.md` | AC-F18 |
| `skills/security/references/pass2-personas.md` | AC-F17 |
| `scripts/validate-iac-findings.cjs` | AC-F7, AC-F8, AC-F9, AC-F10, AC-F11, AC-F12, AC-NF2 |
| `tests/validate-iac-findings.test.cjs` | AC-F13 |
| `_deploy-manifest.json` | AC-F19 |
| `skills/setup-status/SKILL.md` | AC-F20 |

**Coverage result:** All 22 ACs covered across 8 files. No gaps. No orphaned file changes.

---

## Files Changed

### 1. `skills/security/SKILL.md` — modify

**Where:** After the `.gitignore Coverage` Pre-Scan step, before Pass 1.

**Add three contiguous steps:**

```
### Pre-Scan: IaC Scan

**Step 0c — IaC File Detection**

Discover IaC files in the working tree:

```bash
IAC_FILES=$(find . \
  \( -name "Dockerfile" \
  -o -name "docker-compose*.yml" \
  -o \( \( -path "*/k8s/*" -o -path "*/pipelines/*" -o -path "*/deploy/*" -o -path "*/manifests/*" \) -name "*.yaml" \) \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  2>/dev/null)
```

If no IaC files found:
```
IaC Scan: skipped — no IaC files found in scope
```
Exit Pre-Scan step. Continue to Pass 1. Sub-agent is NOT invoked. (AC-F3, AC-NF1)

If IaC files found, announce scope:
```
IaC Scan: {N} file(s) detected
  {list of matched file paths}
```

**Step 0d — iac-scan.md Existence Gate**

```bash
[ -f "skills/security/references/iac-scan.md" ] || echo "IAC_SCAN_MISSING"
```

If `IAC_SCAN_MISSING`:
```
⛔ IaC Scan blocked — iac-scan.md not found. Run /setup-sync to repair.
```
Skip sub-agent. Continue to Pass 1. (AC-F3 error state)

**Step 0e — IaC Scan Sub-Agent Invocation**

Delegate to a sub-agent. Provide ONLY these inputs — no source code files:
1. The list of detected IaC file paths and their full contents
2. Full content of `skills/security/references/iac-scan.md`
3. Full content of `skills/shared/fingerprint-spec.md`
4. The required JSON output schema:

Each finding must be a JSON object with exactly these 8 fields:
- `fingerprint` — string matching pattern FP-[0-9a-f]{8}
- `id` — either `SEC-CONTAINER` (Dockerfile or docker-compose) or `SEC-IAC` (K8s YAML)
- `file` — relative path to the file containing the finding
- `line` — integer line number
- `severity` — one of: Critical, High, Medium, Low
- `rule` — rule ID from iac-scan.md (e.g. DOCKER-001, COMPOSE-004, K8S-001)
- `evidence` — verbatim code excerpt triggering the rule
- `fix` — corrected code snippet that resolves the finding

Sub-agent task: scan each IaC file against the rules in `iac-scan.md`. Emit only rules that fire.
Return a JSON array of findings. Return `[]` if no rules fire. (AC-F4, AC-F5, AC-F6)

After sub-agent returns, validate output before any ledger write:

```bash
echo "$SUB_AGENT_OUTPUT" > /tmp/iac-findings-$$.json
node scripts/validate-iac-findings.cjs --input-file /tmp/iac-findings-$$.json
VALID_EXIT=$?
rm -f /tmp/iac-findings-$$.json
```

On exit 0 (valid): merge findings into `security/security-ledger.md` (append rows). (AC-F7)
On exit 1 (invalid): do NOT write to ledger — see Error Handling. (AC-F12)
```

### 2. `skills/security/references/iac-scan.md` — new file

```markdown
# IaC Scan Rule Catalog
Last updated: 2026-10-07

## Coverage Map

| Source | Total checks | Automated here | Excluded (reason) |
|---|---|---|---|
| CIS Docker Benchmark v1.6 | 84 | 5 | 79 excluded — require a running container, built image, or live cluster; not automatable via static file scan (out of scope per ICEA ADO-9016) |
| CIS Kubernetes Benchmark v1.8 | 100+ | 9 | 91+ excluded — require live cluster, admission controller, or runtime audit |
| Docker Compose Security Best Practices (Docker docs) | informal | 5 | N/A — all practical static-analysis checks included |

---

## Dockerfile Rules
Source: CIS Docker Benchmark v1.6
Last-validated: 2026-10-07
Stale-after: 90

### DOCKER-001 — No USER instruction (runs as root)
**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** Dockerfile has no `USER` instruction before the final `CMD` or `ENTRYPOINT`
**Fix:** Add `USER appuser` (or the project-specific non-root user) before the final CMD/ENTRYPOINT

### DOCKER-002 — No pipefail on RUN with pipes
**Severity:** Medium
**ID:** SEC-CONTAINER
**Pattern:** `RUN` instruction contains a pipe (`|`) without `set -o pipefail` or `pipefail` shell option
**Fix:** Prefix the RUN instruction with `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` or prepend `set -o pipefail &&`

### DOCKER-003 — Latest tag used
**Severity:** Medium
**ID:** SEC-CONTAINER
**Pattern:** `FROM image:latest` or `FROM image` with no tag
**Fix:** Pin to a specific, immutable version tag (e.g. `node:20.11-alpine3.19`)

### DOCKER-004 — Debug port exposed
**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `EXPOSE 5858` (Node.js debug), `EXPOSE 9229` (V8 inspector), or `EXPOSE 5005` (Java JDWP) or `EXPOSE 5678` (Python debugpy)
**Fix:** Remove the debug `EXPOSE` instruction; debug ports must not be published in production images

### DOCKER-005 — COPY without --chown
**Severity:** Low
**ID:** SEC-CONTAINER
**Pattern:** `COPY` instruction copies application files without the `--chown` flag
**Fix:** Use `COPY --chown=appuser:appgroup . .` so copied files are owned by the non-root user

---

## docker-compose Rules
Source: Docker Compose Security Best Practices (https://docs.docker.com/compose/)
Last-validated: 2026-10-07
Stale-after: 90

### COMPOSE-001 — privileged: true
**Severity:** Critical
**ID:** SEC-CONTAINER
**Pattern:** `privileged: true` present in any service definition
**Fix:** Remove `privileged: true`. If specific capabilities are needed, add them explicitly via `cap_add` with a justification comment.

### COMPOSE-002 — cap_add without justification comment
**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `cap_add:` block present with any capability and no inline `#` comment on the same or following line
**Fix:** Add a comment explaining why the capability is needed, or remove it if not required

### COMPOSE-003 — read_only not set
**Severity:** Low
**ID:** SEC-CONTAINER
**Pattern:** Service definition does not include `read_only: true`
**Fix:** Add `read_only: true` to the service; explicitly mount writable `tmpfs` or named volumes for paths that require writes

### COMPOSE-004 — Plaintext env-var secrets
**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `environment:` block contains a key whose name includes `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, or `PASS` with a literal inline value (not `${VAR}` reference)
**Fix:** Move the value to a `.env` file (gitignored) or Docker secrets; reference via `${VAR_NAME}` interpolation

### COMPOSE-005 — network_mode: host
**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `network_mode: "host"` or `network_mode: host` in any service
**Fix:** Remove `network_mode: host`; define an explicit named network with an isolated driver (bridge or overlay)

---

## Kubernetes YAML Rules
Source: CIS Kubernetes Benchmark v1.8
Last-validated: 2026-10-07
Stale-after: 90

### K8S-001 — Plaintext env-var secrets
**Severity:** Critical
**ID:** SEC-IAC
**Pattern:** `env:` block contains a key whose name includes `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, or `PASS` with `value:` (not `valueFrom:`)
**Fix:** Replace `value:` with `valueFrom.secretKeyRef` referencing a Kubernetes Secret object

### K8S-002 — securityContext.privileged: true
**Severity:** Critical
**ID:** SEC-IAC
**Pattern:** Container spec contains `securityContext:` with `privileged: true`
**Fix:** Remove `privileged: true` from the container's securityContext

### K8S-003 — runAsNonRoot not set
**Severity:** High
**ID:** SEC-IAC
**Pattern:** Container `securityContext` is present but does not include `runAsNonRoot: true`
**Fix:** Add `runAsNonRoot: true` to the container's securityContext

### K8S-004 — hostPath volume
**Severity:** High
**ID:** SEC-IAC
**Pattern:** `volumes:` section contains a `hostPath:` entry
**Fix:** Replace `hostPath` with a `PersistentVolumeClaim`. If unavoidable (e.g. socket mounting), add an inline comment with justification.

### K8S-005 — hostNetwork: true
**Severity:** High
**ID:** SEC-IAC
**Pattern:** Pod spec contains `hostNetwork: true`
**Fix:** Remove `hostNetwork: true`; use a ClusterIP Service for internal pod-to-pod communication

### K8S-006 — cap_add capabilities
**Severity:** High
**ID:** SEC-IAC
**Pattern:** Container `securityContext.capabilities.add` contains any capability
**Fix:** Add `drop: ["ALL"]` and list only the specific capabilities required, with an inline justification comment per capability

### K8S-007 — resources.limits missing
**Severity:** Medium
**ID:** SEC-IAC
**Pattern:** Container spec has no `resources.limits` block (or is missing `limits.cpu` or `limits.memory`)
**Fix:** Add `resources.limits.cpu` and `resources.limits.memory` appropriate to the workload

### K8S-008 — namespace: default
**Severity:** Low
**ID:** SEC-IAC
**Pattern:** Manifest specifies `namespace: default` or omits the `namespace` field entirely
**Fix:** Deploy to an explicit named namespace appropriate to the environment (e.g. `app-production`, `app-staging`)

### K8S-009 — readOnlyRootFilesystem not set
**Severity:** Medium
**ID:** SEC-IAC
**Pattern:** Container `securityContext` is present but does not include `readOnlyRootFilesystem: true`
**Fix:** Add `readOnlyRootFilesystem: true`; mount writable `emptyDir` or `PersistentVolumeClaim` volumes for paths that require writes
```

### 3. `skills/security/references/cloud-checks.md` — modify

**What to remove:** All per-rule checks that reference `Dockerfile`, `docker-compose`, container image configuration, or container runtime settings. These are now covered by `iac-scan.md`.

**What to keep:** All AWS/GCP/Azure cloud posture checks — IAM policies, security groups, network ACLs, storage bucket permissions, trust boundary analysis, cloud service misconfiguration (e.g. public S3 buckets, overly-permissive IAM roles, unencrypted storage).

**Implementer instruction:** Search `cloud-checks.md` for any heading or rule that references Dockerfile, docker-compose, container images, container runtime, or the DOCKER-* / COMPOSE-* rule IDs. Remove those sections. Confirm the remaining checks are cloud infrastructure only.

### 4. `skills/security/references/pass2-personas.md` — modify

**What to add to P4 persona** — in the "De-duplication gate" or equivalent section:

```markdown
**SEC-CONTAINER / SEC-IAC de-duplication:** The IaC Scan Pre-Scan step (Step 0e) runs before Pass 2 and logs `SEC-CONTAINER` and `SEC-IAC` findings to the security ledger for the current scan session. P4 must not re-report findings for the same file + vulnerability class that are already recorded with `SEC-CONTAINER` or `SEC-IAC` IDs from this session.

Before raising any finding related to Dockerfile, docker-compose.yml, or Kubernetes YAML content, check whether a `SEC-CONTAINER` or `SEC-IAC` ledger row already exists for that file. If it does, suppress the finding.

P4's "Looks for" scope is narrowed to: architectural cloud IAM concerns, network topology misconfiguration, cross-service trust boundary weaknesses, and cloud-provider-specific misconfigurations. P4 does NOT review container file content — that is the IaC Scan step's responsibility. (AC-F17)
```

### 5. `scripts/validate-iac-findings.cjs` — new file

**Module purpose:** Validates the IaC Scan sub-agent's JSON output before ledger merge. All-or-nothing: any malformed finding rejects the entire batch.

**Required fields per finding:** `fingerprint`, `id`, `file`, `line`, `severity`, `rule`, `evidence`, `fix`

**Valid `id` values:** `SEC-CONTAINER`, `SEC-IAC`

**Valid `severity` values:** `Critical`, `High`, `Medium`, `Low`

**Fingerprint format:** must match `/^FP-[0-9a-f]{8}$/`

**Validation logic:**
1. Parse input as JSON — if parse fails, return `{ valid: false, error: 'INVALID_JSON' }`
2. If result is not an array, return `{ valid: false, error: 'NOT_AN_ARRAY' }`
3. If array is empty `[]`, return `{ valid: true, findings: [] }` — no error
4. For each finding at index N:
   a. Check all 8 required fields exist and are non-null — if missing: `{ valid: false, error: 'MISSING_FIELD', finding_index: N, field: 'name' }`
   b. Check `id` is `SEC-CONTAINER` or `SEC-IAC` — if not: `{ valid: false, error: 'INVALID_ID', finding_index: N }`
   c. Check `severity` is one of the 4 valid values — if not: `{ valid: false, error: 'INVALID_SEVERITY', finding_index: N }`
   d. Check `fingerprint` matches `/^FP-[0-9a-f]{8}$/` — if not: `{ valid: false, error: 'INVALID_FINGERPRINT', finding_index: N }`
   e. Check `file` path exists on disk (using `fs.existsSync`) — if not: `{ valid: false, error: 'UNRESOLVABLE_PATH', finding_index: N, file: path }`
5. If all findings pass: return `{ valid: true, findings: [...] }`

**On validation failure (CLI mode):**
- Write raw input to `.claude/logs/iac-scan-{YYYY-MM-DD}.md`
- Print advisory message: `IaC scan output invalid — manual review required, see .claude/logs/iac-scan-{date}.md`
- Exit with code 1

**Module interface:**
```javascript
// For direct require() in tests:
module.exports = { validateIacFindings };

// CLI usage invoked from SKILL.md via Bash tool:
// node scripts/validate-iac-findings.cjs --input-file /path/to/findings.json
// exit 0 = valid batch; exit 1 = invalid batch
```

### 6. `tests/validate-iac-findings.test.cjs` — new file

Mirrors `scripts/validate-iac-findings.cjs` 1:1. Uses the repo's existing Jest/node test harness.

**The 4 required test cases (AC-F13):**

| Test name | Input | Expected result |
|---|---|---|
| `valid batch accepted` | Array with 2 complete findings (all 8 fields populated, valid id/severity/fingerprint, existing file paths using repo fixtures) | `{ valid: true, findings: [...] }` |
| `missing-field batch rejected` | Array where finding[1] has the `fingerprint` field removed | `{ valid: false, error: 'MISSING_FIELD', finding_index: 1, field: 'fingerprint' }` |
| `empty array accepted` | `[]` | `{ valid: true, findings: [] }` |
| `non-JSON string rejected` | String `"this is not json"` (passed as raw string, not parsed) | `{ valid: false, error: 'INVALID_JSON' }` |

### 7. `_deploy-manifest.json` — modify

Add an entry to register `iac-scan.md` for `REFRESH RULES` tooling. The current manifest schema (`deployed_rules[]` array + `stack_keys[]`) does NOT support `stale_after_days` — confirmed by codebase search (zero matches). Staleness detection is handled by Section 8 below, not by this manifest.

```json
{
  "file": "skills/security/references/iac-scan.md",
  "category": "rule-catalog",
  "description": "IaC scan rule catalog — Dockerfile, docker-compose, and K8s YAML rules"
}
```

**Implementer note:** Read `_deploy-manifest.json` before editing to determine the exact schema used — the existing entries use a `deployed_rules` string array, so this object may need to go into a separate `reference_files` array if one exists, or be created. Do not add `stale_after_days` to the manifest — the schema does not support it.

### 8. `skills/setup-status/SKILL.md` — modify

**Where:** Add a new Section 1c-quad immediately after the existing Section 1c-ter (rule file staleness check, which covers `.claude/rules/` only).

**What to add:**

```markdown
### 1c-quad — IaC scan rule catalog staleness

Only run if `skills/security/references/iac-scan.md` exists.

```bash
node -e "
  const fs = require('fs');
  const file = 'skills/security/references/iac-scan.md';
  if (!fs.existsSync(file)) { console.log('IAC_SCAN_MISSING'); process.exit(0); }
  const content = fs.readFileSync(file, 'utf8');
  const dateMatch = content.match(/Last-validated:\s*(\d{4}-\d{2}-\d{2})/);
  const staleMatch = content.match(/Stale-after:\s*(\d+)/);
  if (!dateMatch) { console.log('NO_DATE'); process.exit(0); }
  const lastValidated = dateMatch[1];
  const staleAfterDays = staleMatch ? parseInt(staleMatch[1], 10) : 90;
  const ageDays = Math.floor((Date.now() - Date.parse(lastValidated)) / 86400000);
  console.log('LAST_VALIDATED=' + lastValidated + ' AGE_DAYS=' + ageDays + ' STALE_AFTER=' + staleAfterDays);
" 2>/dev/null
```

Status:
- `ageDays` < `staleAfterDays` → ✅ Green — rule catalog is current
- `ageDays` >= `staleAfterDays` AND < `staleAfterDays * 2` → ⚠️ Amber:
  ```
  ⚠ skills/security/references/iac-scan.md last validated {N} days ago ({lastValidated}).
    CIS Benchmarks release updated checks periodically — type: REFRESH RULES iac-scan.md
  ```
- `ageDays` >= `staleAfterDays * 2` → ❌ Red — over 180 days:
  ```
  ❌ skills/security/references/iac-scan.md last validated {N} days ago.
    IaC scan rules are likely outdated — type: REFRESH RULES iac-scan.md
  ```
- `IAC_SCAN_MISSING` → ⚠️ Amber — file not present; run `/setup-sync`
- `NO_DATE` → ⚠️ Amber — `Last-validated:` header missing from file

Include in output report line:
```
  iac-scan.md (rule catalog)         {✅ / ⚠️ / ❌}  {last validated: {date} ({N} days) | stale — REFRESH RULES iac-scan.md | missing — run /setup-sync}
```
```

---

## Implementation Notes

### Sub-agent context isolation (AC-F4)

The sub-agent receives only: IaC file contents, `iac-scan.md`, `fingerprint-spec.md`, and the output JSON schema. Source code (`.cjs`, `.js`, `.py`, `.cs`, `.md` skills) is never passed. This is the principal token-cost guard and prevents scope drift into non-IaC concerns.

### Fingerprint generation

The sub-agent generates fingerprints following `fingerprint-spec.md`. The validator checks format only (`/^FP-[0-9a-f]{8}$/`) — it does not re-derive or verify uniqueness. Collision risk across runs is the same as all other skill findings.

### Ledger merge format

Append rows to `security/security-ledger.md` after validation passes. Format:

```
| FP-xxxxxxxx | SEC-CONTAINER | Open | High | Dockerfile | {line} | DOCKER-001 | {evidence} | {fix} |
| FP-yyyyyyyy | SEC-IAC | Open | Critical | pipelines/k8s/uat/deployment.yaml | {line} | K8S-001 | {evidence} | {fix} |
```

The existing `/fix`, `/dismiss`, and `checkin` Check D skills already read ledger rows by ID and FP — no changes needed in those skills.

### iac-scan.md gate ordering

Step 0d (gate check) runs before Step 0e (sub-agent). If `iac-scan.md` is missing, the gate fires and Pass 1 continues — the step exits cleanly without leaving the session in a broken state.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No IaC files found | Step announces skip message; exits without sub-agent invocation; Pass 1 continues normally |
| `iac-scan.md` not found at Step 0d | Halt IaC Scan: `⛔ IaC Scan blocked — iac-scan.md not found. Run /setup-sync to repair.` Pass 1 continues. |
| Sub-agent returns malformed JSON | `validate-iac-findings.cjs` exits 1; raw output logged to `.claude/logs/iac-scan-{YYYY-MM-DD}.md`; single advisory finding raised; zero findings written to ledger |
| Sub-agent returns valid JSON but a `file` path does not exist on disk | That finding flagged `UNRESOLVABLE_PATH`; entire batch rejected (all-or-nothing); advisory raised; not written to ledger |
| `docker-compose.yml` has `privileged: false` set explicitly | COMPOSE-001 does not fire — rule triggers on `true` only |
| P4 runs after IaC Scan logged SEC-CONTAINER for Dockerfile | P4 de-dup gate suppresses re-reporting same file + vulnerability class; P4 produces architectural findings only |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| SKILL.md Pre-Scan step (AC-F1–F7, AC-NF1) | Steps 0c/0d/0e: detection glob, skip logic, iac-scan.md gate, sub-agent invocation with scoped context, validation call, ledger merge | 2 |
| Validation script + test (AC-F8–F13, AC-NF2) | `validate-iac-findings.cjs` + `tests/validate-iac-findings.test.cjs` | 1 |
| `iac-scan.md` rule catalog (AC-F14–F16) | 19 rules across 3 file types + coverage map + governance metadata | 1 |
| `cloud-checks.md` + `pass2-personas.md` (AC-F17–F18) | Remove container checks; add P4 de-dup gate | 0.5 |
| `_deploy-manifest.json` + `setup-status/SKILL.md` (AC-F19–F20) | Register `iac-scan.md` in manifest; add Section 1c-quad staleness check in setup-status | 0.5 |
| **Total** | | **5** |

**Total SP: 5**
**Type: STORY** — single implementation ADO, no child ADOs needed. All 8 files ship in one PR.

---

## Definition of Done

**Implementation**
- [ ] All 8 files changed as specified in Files Changed section
- [ ] No hardcoded secrets, connection strings, or credentials
- [ ] No `console.log` in `validate-iac-findings.cjs` production paths (use `process.stderr.write` for diagnostics if needed)
- [ ] `validate-iac-findings.cjs` uses `require()` / `module.exports` — no ES module syntax (CommonJS constraint)
- [ ] Fingerprint format in sub-agent prompt matches `skills/shared/fingerprint-spec.md`
- [ ] `_deploy-manifest.json` entry format verified against existing entries before writing (no `stale_after_days` — schema does not support it)
- [ ] `setup-status/SKILL.md` Section 1c-quad placed after Section 1c-ter (rule file staleness); output report line added

**Quality**
- [ ] `tests/validate-iac-findings.test.cjs` passes all 4 named test cases
- [ ] `npm test` passes — no new test failures introduced
- [ ] Manual smoke test: repo with a Dockerfile lacking `USER` → `SEC-CONTAINER` row appears in `security/security-ledger.md` after `/security --full`
- [ ] Manual smoke test: repo with no IaC files → "IaC Scan: skipped" appears; no sub-agent invoked
- [ ] `checkin` Check D fails when OPEN `SEC-CONTAINER` or `SEC-IAC` finding is in ledger

**Review readiness**
- [ ] PR title: `[ADO-9016] Security Skill — Dedicated IaC Scan Step`
- [ ] PR description maps each changed file to its ACs (reference AC Coverage Matrix above)
- [ ] ICEA committed in the same branch as implementation

### Reviewer Checklist

- [ ] `validate-iac-findings.cjs` rejects the entire batch on any missing field — no partial writes, no silent failures
- [ ] `iac-scan.md` coverage map accurately states how many total CIS Benchmark checks exist vs. what is automated here
- [ ] P4 de-dup gate suppresses only `SEC-CONTAINER`/`SEC-IAC` from the **current session's run** — not all historical ledger entries; historical entries remain queryable
- [ ] Sub-agent context in SKILL.md Step 0e does NOT include source code file paths
- [ ] The `find` command glob covers all four directory patterns (`k8s/`, `pipelines/`, `deploy/`, `manifests/`) without hardcoding environment subdirectory names (e.g. no `k8s/uat/` literal)
- [ ] `_deploy-manifest.json` entry is syntactically valid JSON; does NOT include `stale_after_days` (schema does not support it)
- [ ] `setup-status/SKILL.md` Section 1c-quad parses `Last-validated:` from `iac-scan.md` header correctly; amber fires at 90 days, red at 180 days

---

## Open Questions

No open questions — all resolved before SAVE TECH.

> OQ-1 (resolved 2026-10-07): `_deploy-manifest.json` does NOT support `stale_after_days` (confirmed by codebase grep — zero matches). `setup-status` has no existing check for skill reference file staleness. Resolution: AC-F20 is satisfied by a new Section 1c-quad in `setup-status/SKILL.md` that reads `Last-validated:` and `Stale-after:` directly from `iac-scan.md` header — no manifest schema change required.

---

## Request Flow

### Happy Path — IaC files found, valid sub-agent output

```
/security --full
  |
  +-- Pre-Scan: .gitignore Coverage (existing step)
  |
  +-- Pre-Scan: IaC Scan (NEW — Steps 0c/0d/0e)
  |     |
  |     +-- Step 0c: find Dockerfile + docker-compose*.yml + *.yaml under k8s|pipelines|deploy|manifests
  |     |     -> N files found
  |     |
  |     +-- Step 0d: iac-scan.md existence gate
  |     |     -> file exists, continue
  |     |
  |     +-- Step 0e: Sub-agent invoked
  |     |     Input: IaC file contents + iac-scan.md + fingerprint-spec.md + output schema
  |     |     Output: JSON array of M findings
  |     |
  |     +-- validate-iac-findings.cjs (exit 0 = valid)
  |     |
  |     +-- Merge M rows into security/security-ledger.md
  |     |
  |     +-- "IaC Scan: M finding(s) written to ledger"
  |
  +-- Pass 1: SAST (existing — unchanged)
  |
  +-- Pass 2: P1/P2/P3/P4 personas
  |     P4: de-dup gate active — SEC-CONTAINER/SEC-IAC from this run are suppressed
  |
  +-- Pass 3: Aggregation + report
```

### Skip Path — no IaC files

```
Pre-Scan: IaC Scan
  +-- Step 0c: find returns 0 files
  +-- "IaC Scan: skipped — no IaC files found in scope"
  +-- [exits — no sub-agent invoked]

Pass 1 -> Pass 2 -> Pass 3 (unchanged behaviour)
```

### Error Path — sub-agent malformed output

```
Pre-Scan: IaC Scan
  +-- Step 0e: Sub-agent returns JSON with missing `fingerprint` field
  +-- validate-iac-findings.cjs (exit 1 = invalid)
       |
       +-- Write raw output to .claude/logs/iac-scan-{YYYY-MM-DD}.md
       +-- Raise advisory: "IaC scan output invalid — manual review required, see .claude/logs/iac-scan-{date}.md"
       +-- 0 findings written to ledger

Pass 1 continues normally.
```

---

## Rollback

This story is purely additive — no schema migrations, no database changes, no external state:

| File | Rollback action |
|---|---|
| `skills/security/SKILL.md` | Remove the three Pre-Scan step blocks (0c, 0d, 0e) — git revert or manual delete |
| `skills/security/references/iac-scan.md` | Delete file |
| `skills/security/references/cloud-checks.md` | `git revert` to restore the container checks that were removed |
| `skills/security/references/pass2-personas.md` | `git revert` to restore the P4 section before narrowing |
| `scripts/validate-iac-findings.cjs` | Delete file |
| `tests/validate-iac-findings.test.cjs` | Delete file |
| `_deploy-manifest.json` | Remove the `iac-scan.md` entry from the manifest |

Standard `git revert` of the ADO-9016 PR suffices for all changes.

---

## Handover

### QA Team

**What was added:** A new Pre-Scan step in the security skill that detects and scans Dockerfile, docker-compose, and Kubernetes YAML files. Findings appear in `security/security-ledger.md` as `SEC-CONTAINER` (Dockerfile/compose) or `SEC-IAC` (K8s) rows with FP fingerprints, severity, rule ID, evidence, and a `fix` snippet.

**How to test manually:**
1. Create a test repo with a `Dockerfile` that has no `USER` instruction. Run `/security --full`. Verify `security/security-ledger.md` contains a `SEC-CONTAINER` row with a `FP-xxxxxxxx` fingerprint and `Status: Open`.
2. Run `/security` on a repo with no Dockerfile, docker-compose, or k8s YAML. Verify "IaC Scan: skipped" message and no new ledger rows.
3. On a `SEC-CONTAINER` finding from step 1, run `/fix FP-{id}`. Verify a corrected Dockerfile snippet (with `USER appuser`) is produced.
4. With an OPEN `SEC-IAC` finding in the ledger, run `checkin`. Verify Check D fails and cites the FP fingerprint, file, and rule.
5. Verify UAT env path: create `pipelines/k8s/uat/deployment.yaml` with a plaintext `SECRET_KEY` env var. Run `/security --full`. Verify the ledger contains a `SEC-IAC` row citing the UAT path.

**Regression risk:** Low. Pass 1–3 behaviour is unchanged when no IaC files are present (skip path is <1s, no sub-agent). P4 de-dup gate is additive — P4 still produces all architectural findings; it only suppresses container content it did not own.

### DevOps / Platform Team

No Azure App Config changes, Key Vault secrets, new environment variables, Docker/AKS changes, pipeline changes, DB migrations, or health check impacts. This is a plugin skill/script change only. No infrastructure intervention required.

### Future Developer

**To update the rule catalog** (every 90 days or when `setup-status` flags amber/red):
1. Run `REFRESH RULES iac-scan.md` — the three-way diff flow will show what changed in the canonical plugin version vs. your local edits.
2. Update `Last-validated:` date in each affected rule section header.
3. Update the coverage map table if new rules were added or benchmarks bumped.

**If sub-agent starts producing malformed JSON frequently:**
- Check `.claude/logs/iac-scan-{date}.md` for the raw output to see what the sub-agent returned.
- Tighten the output schema instruction in SKILL.md Step 0e — make field types and required values explicit.
- Consider adding a schema reminder in the sub-agent prompt on retry.

**If adding new IaC file types** (e.g. Helm charts, Terraform):
- Add rules to `iac-scan.md` under a new section with Source/Last-validated/Stale-after metadata.
- Update the coverage map table.
- Update the `find` command glob in SKILL.md Step 0c.
- Add the new file type to the sub-agent's scope description.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `validateIacFindings()` | Array of 2 complete findings (all 8 fields, valid id/severity/fingerprint, real fixture file paths) | `{ valid: true, findings: [finding1, finding2] }` | AC-F11 |
| P-U2 | `validateIacFindings()` | Empty array `[]` | `{ valid: true, findings: [] }` | AC-F13 |
| P-U3 | `validateIacFindings()` | Finding with `id: "SEC-CONTAINER"` | `{ valid: true }` — SEC-CONTAINER accepted | AC-F5 |
| P-U4 | `validateIacFindings()` | Finding with `id: "SEC-IAC"` | `{ valid: true }` — SEC-IAC accepted | AC-F6 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `validateIacFindings()` | Batch of 2 findings where finding[1] has `fingerprint` field deleted | `{ valid: false, error: 'MISSING_FIELD', finding_index: 1, field: 'fingerprint' }` | AC-F12, AC-F13 |
| N-U2 | `validateIacFindings()` | Raw string `"this is not json"` | `{ valid: false, error: 'INVALID_JSON' }` | AC-F13 |
| N-U3 | `validateIacFindings()` | Batch where finding[0] has `fix` field deleted | `{ valid: false, error: 'MISSING_FIELD', finding_index: 0, field: 'fix' }` | AC-F11 |
| N-U4 | `validateIacFindings()` | Batch where finding[0] has `id: "SEC-OTHER"` | `{ valid: false, error: 'INVALID_ID', finding_index: 0 }` | AC-F5, AC-F6 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Dockerfile with no USER | Run `/security --full` on repo with Dockerfile lacking USER instruction | `security-ledger.md` contains SEC-CONTAINER row with FP fingerprint, Status: Open | AC-F7 |
| INT-2 | No IaC files present | Run `/security` on repo with no Dockerfile/docker-compose/k8s YAML | Output contains "IaC Scan: skipped — no IaC files found in scope"; no new ledger rows | AC-F3, AC-NF1 |
| INT-3 | UAT K8s path coverage | `pipelines/k8s/uat/deployment.yaml` contains plaintext SECRET env var; run `/security --full` | Ledger contains SEC-IAC row citing `pipelines/k8s/uat/deployment.yaml` | AC-F2, AC-F6 |
| INT-4 | checkin enforcement | OPEN `SEC-IAC` finding in ledger; run `checkin` | Check D fails and cites FP fingerprint, file path, and rule | AC-F10 |

> NF AC verification:
> **AC-NF1** (skip path <1s): Time the skip scenario manually — confirm no Agent tool call is observed in the session output. `time /security` on a repo with no IaC files; wall-clock time for the Pre-Scan step must be <1 second.
> **AC-NF2** (validate <=50 findings in <500ms): Add a timing assertion in `tests/validate-iac-findings.test.cjs` — generate a 50-finding fixture programmatically and assert `Date.now()` delta is <500ms.

---

### Revision Log
2026-10-07 — Initial draft
