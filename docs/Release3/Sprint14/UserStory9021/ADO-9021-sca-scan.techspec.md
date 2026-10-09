# Tech Spec — Security Skill: SCA Dependency Vulnerability Scan
ADO #9021 · Release R3 · Sprint S14
Status: DRAFT
Prepared: 2026-10-08

---

## Overview

Adds a Software Composition Analysis (SCA) Pre-Scan step to `skills/security/SKILL.md` that runs after the IaC Scan Pre-Scan step (ADO-9016) and before Pass 1. The step detects package dependency manifests, invokes a sub-agent with a two-path design (CLI tool primary; OSV.dev WebSearch fallback), validates output via a new `validate-sca-findings.cjs`, and merges fingerprinted `SEC-DEP` findings to the security ledger. The pattern follows the IaC Scan Pre-Scan step (ADO-9016) exactly: detect → gate on reference doc → sub-agent → validate → merge. Six files are touched: two skill SKILL.md edits, one new reference doc, one new validator script, one new test file, and one manifest entry.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | SCA step after IaC scan, before Pass 1 | skills/security/SKILL.md | ✅ Covered |
| AC-F2 | Manifest detection: package.json / requirements.txt / *.csproj | skills/security/SKILL.md | ✅ Covered |
| AC-F3 | pom.xml → advisory stub; no sub-agent | skills/security/SKILL.md | ✅ Covered |
| AC-F4 | Skip if no manifests; <1s | skills/security/SKILL.md | ✅ Covered |
| AC-F5 | CLI primary path | skills/security/SKILL.md, sca-scan.md | ✅ Covered |
| AC-F6 | WebSearch fallback (absent OR non-zero + no parseable output) | skills/security/SKILL.md, sca-scan.md | ✅ Covered |
| AC-F7 | All findings ID = SEC-DEP | skills/security/SKILL.md, sca-scan.md | ✅ Covered |
| AC-F8 | FP-fingerprinted entries, Status Open, 8 required fields | skills/security/SKILL.md, sca-scan.md | ✅ Covered |
| AC-F9 | fix field required; /fix works | sca-scan.md (fix field in schema) | ✅ Covered |
| AC-F10 | /dismiss works | skills/security/SKILL.md (ledger merge format) | ✅ Covered |
| AC-F11 | checkin Check D fails on OPEN SEC-DEP | No code change — Assumption A3 | ✅ Covered |
| AC-F12 | validate-sca-findings.cjs: 8 fields, VALID_IDS=SEC-DEP, all-or-nothing | scripts/validate-sca-findings.cjs | ✅ Covered |
| AC-F13 | Invalid batch → log to .claude/logs/sca-scan-DATE.md; advisory; zero writes | scripts/validate-sca-findings.cjs | ✅ Covered |
| AC-F14 | tests/validate-sca-findings.test.cjs: 4 named TCs | tests/validate-sca-findings.test.cjs | ✅ Covered |
| AC-F15 | sca-scan.md: CLI specs + OSV.dev fallback + normalization table | skills/security/references/sca-scan.md | ✅ Covered |
| AC-F16 | sca-scan.md: Source + Last-validated + Stale-after per section | skills/security/references/sca-scan.md | ✅ Covered |
| AC-F17 | Severity normalization enforced | skills/security/references/sca-scan.md | ✅ Covered |
| AC-F18 | npm dev-deps included; documented in sca-scan.md | skills/security/references/sca-scan.md | ✅ Covered |
| AC-F19 | _deploy-manifest.json reference_files entry | .claude/rules/_deploy-manifest.json | ✅ Covered |
| AC-F20 | setup-status Section 1c-quin | skills/setup-status/SKILL.md | ✅ Covered |
| AC-NF1 | Skip path <1s | skills/security/SKILL.md | ✅ Covered |
| AC-NF2 | validate-sca-findings.cjs: 50 findings <500ms | scripts/validate-sca-findings.cjs, tests/validate-sca-findings.test.cjs | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| skills/security/SKILL.md | AC-F1, AC-F2, AC-F3, AC-F4, AC-F5, AC-F6, AC-F7, AC-F8, AC-F10, AC-NF1 |
| skills/security/references/sca-scan.md | AC-F5, AC-F6, AC-F7, AC-F9, AC-F15, AC-F16, AC-F17, AC-F18 |
| scripts/validate-sca-findings.cjs | AC-F12, AC-F13, AC-NF2 |
| tests/validate-sca-findings.test.cjs | AC-F14, AC-NF2 |
| .claude/rules/_deploy-manifest.json | AC-F19 |
| skills/setup-status/SKILL.md | AC-F20 |

**Coverage result:** all 22 ACs covered, no orphaned file changes ✅

---

## Files Changed

### 1. `skills/security/SKILL.md` — INSERT new Pre-Scan section

**Position:** Insert `## Pre-Scan — SCA Dependency Scan` immediately after the existing `## Pre-Scan — IaC Scan` section, before `## Pass 1`.

**Section content (3 sub-headings):**

#### Package Manifest Detection

```bash
# Detect package dependency manifests
MANIFESTS=""
[ -f "package.json" ] && MANIFESTS="$MANIFESTS package.json(npm)"
[ -f "requirements.txt" ] && MANIFESTS="$MANIFESTS requirements.txt(pip)"
[ -f "pyproject.toml" ] && MANIFESTS="$MANIFESTS pyproject.toml(pip)"
[ -f "setup.py" ] && MANIFESTS="$MANIFESTS setup.py(pip)"
CSPROJ_FILES=$(find . -name "*.csproj" 2>/dev/null | head -5)
[ -n "$CSPROJ_FILES" ] && MANIFESTS="$MANIFESTS *.csproj(dotnet)"
POM_FILE=""
[ -f "pom.xml" ] && POM_FILE="pom.xml"
```

If no MANIFESTS and no POM_FILE:
```
SCA Scan: skipped — no package manifests found in scope
```
Skip to Pass 1.

If POM_FILE present, emit advisory stub:
```
SCA Scan: detected pom.xml (Maven) — automated Maven SCA deferred to Sprint 15.
  Manual review recommended: run mvn dependency:tree and check against osv.dev.
```

#### SCA Reference Doc Gate

```bash
[ -f "skills/security/references/sca-scan.md" ] || {
  echo "⛔ SCA Scan halted — skills/security/references/sca-scan.md not found."
  echo "   Run: REFRESH RULES sca-scan.md or restore from plugin."
  exit 1
}
```

#### SCA Sub-Agent Invocation

Delegate to sub-agent with:
- Context: detected manifest files + `skills/security/references/sca-scan.md`
- WebSearch tool enabled (required for OSV.dev fallback path)
- Instructions:
  1. For each detected ecosystem, attempt CLI primary path per `sca-scan.md`
  2. If CLI absent OR exits non-zero with no parseable output: activate WebSearch fallback (OSV.dev batch query per `sca-scan.md` Fallback section)
  3. Normalize all findings to 8-field SEC-DEP schema
  4. Apply severity normalization per `sca-scan.md` table
  5. Output: JSON array (empty array if no vulnerabilities found)
  6. Deduplicate: one finding per (package@version, CVE-ID) pair
- Output schema (write to `/tmp/sca-findings-$$.json`): same 8-field array as `validate-iac-findings.cjs`

After sub-agent completes:
```bash
node scripts/validate-sca-findings.cjs --input-file=/tmp/sca-findings-$$.json
```
- Exit 0 (VALID N): merge N SEC-DEP rows to `security/security-ledger.md` in standard ledger format; announce `SCA Scan: N finding(s) written to ledger (SEC-DEP)`
- Exit 1: advisory shown; zero ledger writes; raw output already logged by script

**ACs satisfied:** F1, F2, F3, F4, F5, F6, F7, F8, F10, NF1

---

### 2. `skills/security/references/sca-scan.md` — NEW file

**Structure:**

```
# SCA Dependency Scan — Tool Integration Spec
_Used by the SCA Pre-Scan step of the security skill._

## Coverage Map

| Ecosystem | Manifest | CLI Tool | Fallback | Finding ID |
|---|---|---|---|---|
| npm (Node.js) | package.json | npm audit --json | OSV.dev (npm) | SEC-DEP |
| PyPI (Python) | requirements.txt / pyproject.toml / setup.py | pip audit --format=json | OSV.dev (PyPI) | SEC-DEP |
| NuGet (.NET) | *.csproj | dotnet list package --vulnerable | OSV.dev (NuGet) | SEC-DEP |
| Maven (Java) | pom.xml | advisory stub — Sprint 14 | — | — |

## npm — CLI Tool Invocation

Source: npm audit documentation (npmjs.com/cli)
Last-validated: 2026-10-08
Stale-after: 90

**Command:** `npm audit --json`

**Output JSON path (per vulnerability):**
- severity: `advisories[*].severity` → normalize (critical→Critical, high→High, moderate→Medium, low→Low)
- package: `advisories[*].module_name` + `findings[*].version`
- CVE: `advisories[*].cves[0]` OR `advisories[*].url` (use GHSA ID if no CVE)
- description: `advisories[*].title`
- fix version: `advisories[*].patched_versions` (first range)

**Note:** npm audit includes dev-dependencies by default. This is intentional (AC-F18) — dev tools
sometimes run in production build environments. Pass `--omit dev` to exclude (future option, not current default).

**npm v7+ breaking change:** Audit output moved from `advisories` to `vulnerabilities` key.
Check `npm --version` first; if v7+, use `vulnerabilities[*]` path instead.

## pip (PyPI) — CLI Tool Invocation

Source: pip audit (pypa/pip-audit)
Last-validated: 2026-10-08
Stale-after: 90

**Command:** `pip audit --format=json`

**Availability check:** `pip audit --version` — if exits non-zero, tool is absent; activate WebSearch fallback.

**Output JSON path (per vulnerability):**
- package: `dependencies[*].name` + `dependencies[*].version`
- CVE: `dependencies[*].vulns[*].id` (GHSA or CVE)
- description: `dependencies[*].vulns[*].description` (first 200 chars)
- fix version: `dependencies[*].vulns[*].fix_versions[0]`
- CVSS score: `dependencies[*].vulns[*].aliases` — map to severity band

**Alternative:** safety check --json (requires API key for full DB — note in advisory if used as secondary fallback)

## dotnet (NuGet) — CLI Tool Invocation

Source: .NET NuGet Audit (learn.microsoft.com/dotnet)
Last-validated: 2026-10-08
Stale-after: 90

**Command:** `dotnet list package --vulnerable --format json`

**Note:** Requires internet access to query NuGet advisory feed. If network unavailable, exits non-zero — activate WebSearch fallback.

**Output JSON path (per vulnerability):**
- package: `projects[*].frameworks[*].transitivePackages[*].id` + `version`
- severity: `projects[*].frameworks[*].transitivePackages[*].resolvedSeverity` → CVSS band mapping
- advisory URL: `projects[*].frameworks[*].transitivePackages[*].vulnerabilities[*].advisoryurl`
- CVE: extract from advisory URL (NVD URLs contain CVE-YYYY-NNNNN)
- fix: `projects[*].frameworks[*].transitivePackages[*].latestVersion`

## OSV.dev Fallback — WebSearch Query

Source: OSV.dev API v1 (osv.dev)
Last-validated: 2026-10-08
Stale-after: 90

**When to use:** CLI tool absent OR exits non-zero with no parseable output.

**Approach:** The sub-agent uses WebSearch to query OSV.dev for each ecosystem.
One batch query per ecosystem (not per package) to minimise latency.

**Query strategy:**
1. Parse manifest to extract all `{package}@{version}` pairs
2. For each ecosystem, query OSV.dev via WebSearch:
   - Search: `site:osv.dev {package} {version} {ecosystem}`
   - OR: search the OSV.dev vulnerability database for the package/version combination
3. For each vulnerability found: extract CVE/GHSA ID, severity, description, fix version
4. Normalize to 8-field SEC-DEP schema

**Severity mapping from OSV.dev:**
- CRITICAL → Critical
- HIGH → High
- MEDIUM → Medium
- LOW → Low
- (unrated) → Medium (conservative default)

**Rate limiting:** If search returns HTTP 429, retry once after a brief pause.
If second attempt fails: emit advisory "SCA scan skipped — OSV.dev rate limited" and proceed to Pass 1.

## Severity Normalization

| Source | Source value | Schema value |
|---|---|---|
| npm audit | critical | Critical |
| npm audit | high | High |
| npm audit | moderate | Medium |
| npm audit | low | Low |
| pip/dotnet CVSS 9.0+ | — | Critical |
| pip/dotnet CVSS 7.0–8.9 | — | High |
| pip/dotnet CVSS 4.0–6.9 | — | Medium |
| pip/dotnet CVSS below 4.0 | — | Low |
| OSV.dev CRITICAL | — | Critical |
| OSV.dev HIGH | — | High |
| OSV.dev MEDIUM | — | Medium |
| OSV.dev LOW | — | Low |

## Finding Schema (required for validate-sca-findings.cjs)

| Field | Rule |
|---|---|
| fingerprint | FP-[0-9a-f]{8} — deterministic hash of (file + rule + evidence) |
| id | SEC-DEP — fixed value for all SCA findings |
| file | Absolute or repo-relative path to the package manifest |
| line | 1 — dependency line numbers are not meaningful; always use 1 |
| severity | Critical / High / Medium / Low — per normalization table above |
| rule | CVE-YYYY-NNNNN or GHSA-xxxx-xxxx-xxxx |
| evidence | "{package}@{version} — {vulnerability description}" |
| fix | "Upgrade to {package}@{fix_version}" |

## Governance

To refresh this rule catalog when tooling or OSV.dev API changes:
```
REFRESH RULES sca-scan.md
```
setup-status Section 1c-quin flags amber at 90 days, red at 180 days from Last-validated date.
```

**ACs satisfied:** F5, F6, F7, F9, F15, F16, F17, F18

---

### 3. `scripts/validate-sca-findings.cjs` — NEW file

**Pattern:** Mirrors `scripts/validate-iac-findings.cjs` exactly. Only difference: `VALID_IDS = new Set(['SEC-DEP'])`.

**Key constants:**
```javascript
const REQUIRED_FIELDS = ['fingerprint', 'id', 'file', 'line', 'severity', 'rule', 'evidence', 'fix'];
const VALID_IDS = new Set(['SEC-DEP']);
const VALID_SEVERITIES = new Set(['Critical', 'High', 'Medium', 'Low']);
const FINGERPRINT_RE = /^FP-[0-9a-f]{8}$/;
```

**Validation checks (in order per finding):**
1. All 8 `REQUIRED_FIELDS` present and non-null → error: `MISSING_FIELD`
2. `id` in `VALID_IDS` → error: `INVALID_ID`
3. `severity` in `VALID_SEVERITIES` → error: `INVALID_SEVERITY`
4. `fingerprint` matches `FINGERPRINT_RE` → error: `INVALID_FINGERPRINT`
5. `fs.existsSync(f.file)` → error: `UNRESOLVABLE_PATH`

**All-or-nothing semantics:** first failure rejects entire batch.

**Return values:**
- Valid: `{ valid: true, findings }`
- Invalid: `{ valid: false, error, finding_index, field?, file? }`
- Empty array: `{ valid: true, findings: [] }` — clean scan result

**CLI entry point (`runCli`):**
- Reads `--input-file=<path>`
- On valid: prints `VALID N`, exits 0
- On invalid: writes `.claude/logs/sca-scan-{YYYY-MM-DD}.md` with raw input + error detail; prints advisory; exits 1

**SCRIPT REVIEW header** (mandatory for script-review-gate hook):
```javascript
// SCRIPT REVIEW
// What it does:        Validates a batch of SCA findings produced by the security skill's
//                      SCA sub-agent before any findings are written to the security ledger.
//                      8 required fields per finding; VALID_IDS = SEC-DEP; all-or-nothing.
//                      On failure, writes raw output to .claude/logs/sca-scan-{date}.md.
// What it touches:     Reads --input-file=<path>. On failure: writes .claude/logs/sca-scan-*.md.
// What it does NOT do: No network calls. No git operations. Does not write to security ledger.
// APIs / commands:     Node stdlib: fs.readFileSync, fs.writeFileSync, fs.existsSync, JSON.parse.
// How to verify:       node scripts/validate-sca-findings.cjs --input-file=/tmp/test.json
//                      with valid JSON array → exits 0, prints "VALID N".
```

**Module export:** `module.exports = { validateSacFindings };`
**CLI guard:** `if (require.main === module) { runCli(); }`

**ACs satisfied:** F12, F13, NF2

---

### 4. `tests/validate-sca-findings.test.cjs` — NEW file

**Pattern:** Mirrors `tests/validate-iac-findings.test.cjs`. Same `assert(name, condition, detail)` + `passed`/`failed` + `process.exit()` pattern. No Jest assertion syntax.

**Fixture setup:** Create temp dir `os.tmpdir()/sca-test-{pid}/`. Write `package.json` and `requirements.txt` as fixture files (must exist on disk for UNRESOLVABLE_PATH checks).

**Test cases:**

| TC | Name | Input | Expected |
|---|---|---|---|
| TC-1 | valid batch accepted | 2 complete SEC-DEP findings, real fixture paths | valid=true, findings.length=2 |
| TC-2 | missing-field batch rejected | finding[1] missing fingerprint | valid=false, error=MISSING_FIELD, finding_index=1, field=fingerprint |
| TC-3 | empty array accepted | [] | valid=true, findings.length=0 |
| TC-4 | non-JSON string rejected | "this is not json" | valid=false, error=INVALID_JSON |
| TC-5 | invalid id rejected | finding with id=SEC-CONTAINER | valid=false, error=INVALID_ID, finding_index=0 |
| TC-6 | unresolvable path rejected | finding with file=/nonexistent/path | valid=false, error=UNRESOLVABLE_PATH, finding_index=0 |
| TC-7 | 50 findings validated in <500ms | Array(50) of valid SEC-DEP findings | elapsed<500 (AC-NF2) |

**Cleanup:** `fs.rmSync(TMP_DIR, { recursive: true, force: true })` at end.

**Exit:** `process.exit(failed > 0 ? 1 : 0)`

**ACs satisfied:** F14, NF2

---

### 5. `.claude/rules/_deploy-manifest.json` — MODIFY

Add to existing `reference_files[]` array (already has iac-scan.md entry):

```json
{
  "file": "skills/security/references/sca-scan.md",
  "category": "rule-catalog",
  "description": "SCA dependency scan spec — npm/pip/dotnet tool invocation, OSV.dev fallback, severity normalization"
}
```

**Implementer note:** Read the file before editing. The `reference_files` array was added by ADO-9016 — append to the existing array, do not create a new key.

**ACs satisfied:** F19

---

### 6. `skills/setup-status/SKILL.md` — INSERT Section 1c-quin

**Position:** Insert `### 1c-quin` immediately after `### 1c-quad` (IaC scan rule catalog staleness check added by ADO-9016), before whatever section follows.

**Section content:**

```markdown
### 1c-quin — SCA reference doc existence and staleness

```bash
SCA_REF="skills/security/references/sca-scan.md"
if [ ! -f "$SCA_REF" ]; then
  echo "🔴 sca-scan.md (SCA spec) — MISSING"
else
  node -e "
  const fs = require('fs');
  const content = fs.readFileSync('${SCA_REF}', 'utf8');
  const lv = (content.match(/Last-validated:\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
  const sa = parseInt((content.match(/Stale-after:\s*(\d+)/) || [])[1] || '90');
  if (!lv) { process.stdout.write('🟡 sca-scan.md — Last-validated not found\n'); process.exit(0); }
  const days = Math.floor((Date.now() - new Date(lv).getTime()) / 86400000);
  if (days >= sa) process.stdout.write('🔴 sca-scan.md (SCA spec) — stale (' + days + ' days, limit ' + sa + ')\n');
  else if (days >= Math.floor(sa / 2)) process.stdout.write('🟡 sca-scan.md (SCA spec) — aging (' + days + ' days)\n');
  else process.stdout.write('🟢 sca-scan.md (SCA spec) — current (' + days + ' days)\n');
  "
fi
```

Also add output report line (Step 3 output template), after the `iac-scan.md (rule catalog)` line:
```
  sca-scan.md (SCA spec)       → {green/amber/red status}
```

**ACs satisfied:** F20

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No package manifests found | Skip message emitted; sub-agent not invoked; Pass 1 continues |
| sca-scan.md not found | ⛔ halt message; developer must restore file |
| CLI tool absent | WebSearch fallback activates; advisory emitted noting fallback |
| CLI tool exits non-zero, no parseable output | WebSearch fallback activates; advisory emitted |
| OSV.dev returns 429 (rate limited) | Retry once; if second failure: skip with advisory "SCA scan skipped — OSV.dev rate limited" |
| validate-sca-findings.cjs rejects batch | Advisory + log to .claude/logs/sca-scan-DATE.md; zero ledger writes |
| Package manifest exists but is empty | Sub-agent reports 0 findings; valid=true, findings=[]; no ledger writes |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| skills/security/SKILL.md | Manifest detection (4 types), skip, Maven stub, two-path sub-agent invocation (CLI + WebSearch fallback), validate, ledger merge | 3 |
| skills/security/references/sca-scan.md | Coverage map, npm/pip/dotnet CLI specs + JSON paths, OSV.dev fallback API spec, severity normalization table, finding schema, governance section | 2 |
| scripts/validate-sca-findings.cjs | Batch validator (mirrors iac version), CLI entry point, log-on-failure, SCRIPT REVIEW header | 1 |
| tests/validate-sca-findings.test.cjs | 7 test cases, fixture setup/teardown, performance assertion (TC-7) | 1 |
| .claude/rules/_deploy-manifest.json + skills/setup-status/SKILL.md | reference_files entry + Section 1c-quin staleness check | 1 |
| **Total** | | **8** |

**Total SP: 8**
**Type: STORY** — single implementation ADO; 6 files; follows established IaC scan pattern.

---

## Definition of Done

**Implementation**
- [ ] All 6 files changed as specified in Files Changed section
- [ ] `validate-sca-findings.cjs` has SCRIPT REVIEW header with all 5 required fields
- [ ] No `console.log` in production code paths (use `process.stdout.write` or `process.stderr.write`)
- [ ] No hardcoded secrets, connection strings, or credentials

**Quality**
- [ ] `node tests/validate-sca-findings.test.cjs` → 7 passed · 0 failed
- [ ] `npm test` → all 38 tests pass (37 existing + 1 new)
- [ ] Regression verified: existing `/security` behaviour unchanged when no SCA manifests present

**Review readiness**
- [ ] PR title: `[ADO-9021] Add SCA dependency vulnerability scan Pre-Scan step`
- [ ] PR description maps each changed file to its ACs (AC Coverage Matrix)
- [ ] ICEA committed in the same branch

### Reviewer Checklist

- [ ] `VALID_IDS` in `validate-sca-findings.cjs` contains only `'SEC-DEP'` — confirm no bleed from iac version
- [ ] WebSearch fallback path is explicitly documented in SKILL.md sub-agent instructions
- [ ] `sca-scan.md` npm section documents the v7+ JSON shape change (`advisories` → `vulnerabilities`)
- [ ] Section 1c-quin in setup-status is positioned AFTER 1c-quad (IaC) — confirm ordering
- [ ] `_deploy-manifest.json` reference_files array has both iac-scan.md AND sca-scan.md entries

---

## Open Questions

None — all resolved in plan and ICEA.

---

## Request Flow

```
/security invoked
  → IaC Scan Pre-Scan step (ADO-9016)
  → SCA Pre-Scan step (ADO-9021):
      detect: package.json / requirements.txt / pyproject.toml / setup.py / *.csproj / pom.xml
      if none found → skip message → Pass 1
      if pom.xml only → Maven advisory stub → Pass 1
      gate: skills/security/references/sca-scan.md exists? → halt if missing
      sub-agent (WebSearch enabled):
        for each ecosystem:
          try: CLI tool (npm audit / pip audit / dotnet list) → parse JSON
          fallback if CLI absent or failed: WebSearch OSV.dev batch query
          normalize → deduplicate → append to findings list
        output: JSON array → write /tmp/sca-findings-$$.json
      validate: node scripts/validate-sca-findings.cjs --input-file=/tmp/sca-findings-$$.json
        exit 0 (VALID N): merge N SEC-DEP rows to security/security-ledger.md
        exit 1: advisory + .claude/logs/sca-scan-DATE.md + zero ledger writes
  → Pass 1 (application code scan)
  → Pass 2 / Pass 3 ...
```

---

## Rollback

Purely additive — no data migrations, no schema changes, no environment variables. Rollback procedure:
1. Revert the `## Pre-Scan — SCA Dependency Scan` section from `skills/security/SKILL.md`
2. Delete `skills/security/references/sca-scan.md`
3. Delete `scripts/validate-sca-findings.cjs` and `tests/validate-sca-findings.test.cjs`
4. Remove `sca-scan.md` entry from `_deploy-manifest.json` `reference_files[]`
5. Remove Section 1c-quin from `skills/setup-status/SKILL.md`

Existing SEC-DEP ledger entries remain in `security/security-ledger.md` — dismiss before rollback to avoid checkin Check D blocking the revert PR.

---

## Handover

### QA Team

Test with a repo containing known-vulnerable packages. Suite 3 (Validation Script) and Suite 1 (SCA Step Behavior) from the test plan are the primary suites. Key verifications:
- Create a repo with `lodash@4.17.15` in package.json → confirm SEC-DEP entry written after `/security`
- Remove npm from PATH → confirm WebSearch fallback activates and finds the same vulnerability
- Empty project (no manifests) → confirm skip message, Pass 1 proceeds, no sub-agent call

### DevOps / Platform Team

No environment changes. No new npm dependencies. No pipeline changes. No Azure App Config or Key Vault changes. Node.js subprocess only (`validate-sca-findings.cjs`). The WebSearch tool is enabled for the sub-agent in the SKILL.md instruction — no infrastructure changes needed.

### Future Developer — Sprint 15: Maven support

Replace the advisory stub (AC-F3) with a real sub-agent invocation for pom.xml:
1. Try: `mvn dependency-check:check -Dformat=JSON` (OWASP Dependency-Check — downloads NVD DB on first run, ~10 min; cache in `.dependency-check/`)
2. Fallback: WebSearch OSV.dev (Maven ecosystem)
3. Same validate-sca-findings.cjs pipeline applies (SEC-DEP id, 8-field schema)
Note: OWASP Dependency-Check NVD download may need network access in CI — coordinate with DevOps on caching strategy.

---

## Test Cases

### Positive Unit Tests — validate-sca-findings.cjs

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | validateSacFindings() | 2 valid SEC-DEP findings, real file paths | valid=true, findings.length=2 | AC-F12 |
| P-U2 | validateSacFindings() | [] | valid=true, findings.length=0 | AC-F12 |
| P-U3 | validateSacFindings() | 50-element valid batch | valid=true, elapsed<500ms | AC-NF2 |

### Negative Unit Tests — validate-sca-findings.cjs

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | validateSacFindings() | finding[1] missing fingerprint | valid=false, error=MISSING_FIELD, field=fingerprint | AC-F12, F13 |
| N-U2 | validateSacFindings() | "this is not json" | valid=false, error=INVALID_JSON | AC-F12 |
| N-U3 | validateSacFindings() | finding with id=SEC-CONTAINER | valid=false, error=INVALID_ID | AC-F12 |
| N-U4 | validateSacFindings() | finding with file=/nonexistent | valid=false, error=UNRESOLVABLE_PATH | AC-F12 |

### Integration Tests (manual)

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | npm audit CLI path | Repo with lodash@4.17.15; run /security | SEC-DEP entry in ledger, FP-fingerprint, High severity, CVE-2021-23337 | AC-F2, F5, F7, F8 |
| INT-2 | WebSearch fallback | Same repo; remove npm from PATH; run /security | Same SEC-DEP entry written via OSV.dev query | AC-F6 |
| INT-3 | Skip path | Repo with no manifests; run /security | Skip message; no sub-agent; Pass 1 immediately | AC-F4, NF1 |
| INT-4 | Maven stub | Repo with only pom.xml; run /security | Advisory stub; no sub-agent; no SEC-DEP entries | AC-F3 |
| INT-5 | /fix resolves finding | SEC-DEP entry in ledger; run /fix FP-id | Upgrade applied per fix field | AC-F9 |
| INT-6 | /dismiss resolves finding | SEC-DEP entry in ledger; run /dismiss FP-id | Entry status changed to Dismissed | AC-F10 |
| INT-7 | checkin Check D blocks | OPEN SEC-DEP in ledger; run checkin | Check D fails; PR blocked | AC-F11 |

> NF AC verification:
> AC-NF1 (skip <1s): time the skip path manually — `time` or stopwatch. Sub-agent call absence is observable in Claude Code tool output.
> AC-NF2 (50 findings <500ms): TC-7 in validate-sca-findings.test.cjs asserts elapsed<500ms automatically.

---

### Revision Log
2026-10-08 — Initial draft
