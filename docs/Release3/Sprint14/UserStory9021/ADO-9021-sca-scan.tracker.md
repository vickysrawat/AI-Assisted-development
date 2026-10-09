# Tracker — Security Skill: SCA Dependency Vulnerability Scan
ADO #9021 · Release R3 · Sprint S14

**Type:** STORY
**Last Updated:** 2026-10-08

## Acceptance Criteria

| AC | Description | Status |
|---|---|---|
| AC-F1 | SCA Pre-Scan step positioned after IaC Scan step, before Pass 1 | ✅ Done |
| AC-F2 | Manifest detection covers package.json (npm), requirements.txt / pyproject.toml / setup.py (pip), *.csproj (.NET NuGet) | ✅ Done |
| AC-F3 | pom.xml detected → advisory stub emitted; sub-agent not invoked for Maven | ✅ Done |
| AC-F4 | Skip message if no package manifest found; sub-agent not invoked; step completes in under 1 second | ✅ Done |
| AC-F5 | Sub-agent primary path: CLI tool invoked when available on PATH and exits successfully | ✅ Done |
| AC-F6 | Sub-agent fallback path: activates when CLI tool absent OR exits non-zero with no parseable output; queries OSV.dev via WebSearch; advisory emitted | ✅ Done |
| AC-F7 | All SCA findings emitted with ID SEC-DEP; no other ID values accepted | ✅ Done |
| AC-F8 | Findings produce FP-fingerprinted ledger entries with Status: Open; 8 required fields | ✅ Done |
| AC-F9 | fix field required in validated batch; /fix FP-id resolves SEC-DEP findings | ✅ Done |
| AC-F10 | /dismiss FP-id works on SEC-DEP findings; correct ledger format ensured | ✅ Done |
| AC-F11 | checkin Check D fails on any OPEN SEC-DEP finding in security ledger | ✅ Done |
| AC-F12 | validate-sca-findings.cjs validates JSON batch; 8 required fields; VALID_IDS = SEC-DEP only; all-or-nothing | ✅ Done |
| AC-F13 | Missing-field or invalid batch: entire batch rejected; raw output to .claude/logs/sca-scan-DATE.md; advisory; zero ledger writes | ✅ Done |
| AC-F14 | tests/validate-sca-findings.test.cjs passes with 4 named test cases | ✅ Done |
| AC-F15 | sca-scan.md documents CLI invocation + JSON schema for npm/pip/dotnet; OSV.dev fallback format; severity normalization table | ✅ Done |
| AC-F16 | Each sca-scan.md section header carries Source, Last-validated, and Stale-after metadata | ✅ Done |
| AC-F17 | Severity normalization enforced: npm moderate → Medium; CVSS 9.0+ → Critical etc. | ✅ Done |
| AC-F18 | npm dev-dependencies included by default; documented in sca-scan.md | ✅ Done |
| AC-F19 | _deploy-manifest.json reference_files entry added for sca-scan.md | ✅ Done |
| AC-F20 | setup-status Section 1c-quin: sca-scan.md missing → red; amber at 90 days, red at 180 days | ✅ Done |
| AC-NF1 | Skip path completes in under 1 second; sub-agent not invoked | ✅ Done |
| AC-NF2 | validate-sca-findings.cjs validates 50 findings in under 500ms | ✅ Done |

## Implementation — ADO #9021

**Status:** ✅ Done

### Delivered

| File | Change | ACs |
|---|---|---|
| `skills/security/SKILL.md` | Inserted `## Pre-Scan — SCA Dependency Scan` section after IaC Scan, before Pass 1 (120 lines) | F1–F9, F17, F18 |
| `skills/security/references/sca-scan.md` | New reference doc — npm/pip/dotnet CLI invocation + JSON paths, OSV.dev fallback, severity normalization, SEC-DEP schema, Maven stub | F15, F16, F17, F18 |
| `scripts/validate-sca-findings.cjs` | New validator — 8-field schema, VALID_IDS = SEC-DEP, all-or-nothing, failure log to .claude/logs/sca-scan-DATE.md | F7, F12, F13 |
| `tests/validate-sca-findings.test.cjs` | New test file — 7 TCs (AC-F14 + AC-NF2 performance) | F14, NF2 |
| `.claude/rules/_deploy-manifest.json` | Appended sca-scan.md entry to reference_files array | F19 |
| `skills/setup-status/SKILL.md` | Inserted Section 1c-quin after 1c-quad — staleness check for sca-scan.md (amber 90 days, red 180 days) | F20 |

### Tests added

- `tests/validate-sca-findings.test.cjs` — 7 test cases
  - TC-1: valid batch accepted (2 SEC-DEP findings, real fixture paths)
  - TC-2: missing-field batch rejected (MISSING_FIELD, index 1, field fingerprint)
  - TC-3: empty array accepted
  - TC-4: non-JSON string rejected (INVALID_JSON)
  - TC-5: invalid id rejected (SEC-CONTAINER → INVALID_ID since only SEC-DEP valid)
  - TC-6: unresolvable path rejected (UNRESOLVABLE_PATH)
  - TC-7: 50 findings validated in <500ms (AC-NF2 performance gate)
- Result: **7 passed · 0 failed** (verified 2026-10-08)

### Design decisions

- **Two-path sub-agent:** CLI primary + OSV.dev WebSearch fallback. Fallback activates on CLI absent OR CLI non-zero exit with no parseable output. This removes CLI-on-PATH as a blocking dependency (AC-F6 precision from critic).
- **VALID_IDS = SEC-DEP only:** validate-sca-findings.cjs rejects any other id value (SEC-CONTAINER, SEC-IAC, etc.). Mirrors validate-iac-findings.cjs pattern — only the constant changes.
- **checkin Check D:** Treats all security ledger IDs uniformly — SEC-DEP is picked up automatically with no changes required to the checkin skill (Assumption A3, confirmed from ADO-9016 tracker).
- **Maven pom.xml:** Sprint 14 stub only — detect, emit advisory, no sub-agent. Sprint 15 handover note included in sca-scan.md (OWASP Dependency-Check or `mvn dependency:tree`).
- **npm dev-deps included by default:** No `--omit dev` flag passed. Dev-dep vulnerabilities affect the build pipeline and should be visible. Documented in sca-scan.md (AC-F18).
- **npm v7+ JSON shape change:** Documented in sca-scan.md — `advisories` key changed to `vulnerabilities` in npm v7+. Sub-agent instructed to check `npm --version` before parsing.

### Known gaps

- Maven pom.xml: automated SCA deferred to Sprint 15. Advisory stub emitted but no SEC-DEP findings produced. Sprint 15 should implement OWASP Dependency-Check CLI integration.
- OSV.dev rate-limit recovery: retries once; no exponential backoff. Acceptable for Sprint 14 scope.
- pip `pyproject.toml` / `setup.py` detection: manifests are detected and passed to sub-agent, but pip audit reads from the environment — the sub-agent may fall back to OSV.dev for these if pip is not installed or the virtualenv is inactive.

## Follow-ups

| # | Issue | Fix applied | File(s) |
|---|---|---|---|
