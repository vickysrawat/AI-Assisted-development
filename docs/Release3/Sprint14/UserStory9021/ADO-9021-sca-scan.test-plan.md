# Test Plan — Security Skill: SCA Dependency Vulnerability Scan
ADO #9021 · Release R3 · Sprint S14
Document type: QA Test Plan
Prepared: 2026-10-08

---

## Overview

This plan covers functional, script-level, and regression testing for the SCA Dependency Vulnerability Scan Pre-Scan step added to the security skill. Run suites in order (Suite 1 → Suite 5) since Suite 2 (Actionability) depends on findings produced in Suite 1. Suite 3 (Validation Script) is fully automated. Suite 6 (Regression) confirms no side-effects on existing behavior.

## Environment Requirements

| Item | Requirement |
|---|---|
| Runtime | Node.js 20+ |
| Plugin version | ai-assisted-development v3.25.0+ |
| Test repo — npm | A local test repo with package.json containing at least one known-vulnerable package (e.g. lodash@4.17.15) |
| Test repo — pip | A local test repo with requirements.txt containing requests==2.27.1 |
| Test repo — dotnet | A local test repo with a *.csproj referencing a known-vulnerable NuGet package |
| Clean ledger | security/security-ledger.md reset or empty before Suite 1 to isolate findings |
| sca-scan.md present | skills/security/references/sca-scan.md must exist |
| validate-sca-findings.cjs present | scripts/validate-sca-findings.cjs must exist |

## Test Suites

| Suite | Title | When to run | Effort |
|---|---|---|---|
| Suite 1 | SCA Step Behavior | After SKILL.md and sca-scan.md changes are merged | ~30 min |
| Suite 2 | Actionability (fix / dismiss / checkin) | After Suite 1 passes (findings must be in ledger) | ~20 min |
| Suite 3 | Validation Script | After validate-sca-findings.cjs is merged | ~5 min (automated) |
| Suite 4 | Reference Doc | After sca-scan.md is merged | ~15 min |
| Suite 5 | Governance / Manifest | After _deploy-manifest.json and setup-status changes are merged | ~10 min |
| Suite 6 | Regression | After all changes are merged | ~15 min |

**Estimated total effort: ~1.5 hours for a full pass.**

---

## Suite 1 — SCA Step Behavior

> Verifies that the SCA Pre-Scan step detects the right manifests, invokes the correct tool path, produces SEC-DEP ledger entries, and skips correctly when no manifests are present.

### TC-SCA-01 — npm CLI path: SEC-DEP row written for known-vulnerable package

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F1, AC-F2, AC-F5, AC-F7, AC-F8

**Steps:**
1. In the test repo, confirm package.json contains `"lodash": "4.17.15"` (or another known-CVE version).
2. Ensure npm is on PATH (`npm --version` returns successfully).
3. Reset security/security-ledger.md to empty (or note current row count).
4. Run `/security`.
5. Open security/security-ledger.md.

**Expected:** At least one new row with `SEC-DEP`, file `package.json`, `Status: Open`, a `FP-xxxxxxxx` fingerprint (8 hex chars), severity `High`, and rule `CVE-2021-23337` (or the CVE for the package used). The SCA Pre-Scan output appears after the IaC scan output and before Pass 1.

---

### TC-SCA-02 — Skip message when no package manifests present

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F4, AC-NF1

**Steps:**
1. Use a test repo with no package.json, requirements.txt, pyproject.toml, *.csproj, or pom.xml.
2. Run `/security`.
3. Observe the chat output.
4. Check whether a sub-agent invocation occurred (observe Agent tool call in session output).

**Expected:** Output contains `SCA Scan: skipped — no package manifests found in scope`. No sub-agent Agent tool call is observed. Pass 1 proceeds normally. Step completes visibly fast (<1s).

**Fail condition:** Sub-agent is invoked when no manifests are present, or skip message is missing.

---

### TC-SCA-03 — Maven pom.xml detected: advisory stub emitted, sub-agent not invoked

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F3

**Steps:**
1. Use a test repo that has pom.xml but no package.json, requirements.txt, or *.csproj.
2. Run `/security`.
3. Observe the chat output.

**Expected:** Output contains advisory text referencing Maven SCA deferral to Sprint 15 and recommending manual review via `mvn dependency:tree`. No sub-agent invocation for Maven. No SEC-DEP entries written.

---

### TC-SCA-04 — WebSearch fallback activates when npm not on PATH

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F6

**Steps:**
1. Temporarily rename `npm` (or unset PATH entry) so npm is not findable.
2. Confirm `npm --version` fails.
3. Run `/security` against the test repo with package.json (lodash@4.17.15).
4. Observe the chat output for fallback advisory.
5. Check security/security-ledger.md.

**Expected:** Chat output contains an advisory noting that npm was unavailable and OSV.dev WebSearch fallback was used. At least one SEC-DEP entry is still written to the ledger (same CVE as TC-SCA-01).

---

## Suite 2 — Actionability (fix / dismiss / checkin)

> Verifies that SEC-DEP findings produced in Suite 1 are actionable via the existing /fix, /dismiss, and checkin skills.

### TC-SCA-05 — /fix resolves a SEC-DEP finding

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F9

**Steps:**
1. Confirm at least one SEC-DEP row with `Status: Open` exists in security/security-ledger.md (from TC-SCA-01).
2. Copy the `FP-xxxxxxxx` fingerprint from that row.
3. Run `/fix FP-xxxxxxxx`.

**Expected:** The fix skill applies the upgrade instruction from the `fix` field (e.g. "Upgrade to lodash@4.17.21"). The ledger entry Status changes to `Fixed` or the finding is resolved.

---

### TC-SCA-06 — /dismiss resolves a SEC-DEP finding

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F10

**Steps:**
1. Confirm a separate SEC-DEP finding with `Status: Open` in the ledger.
2. Run `/dismiss FP-xxxxxxxx` with a justification.

**Expected:** The dismiss skill updates the ledger entry Status to `Dismissed` with the justification recorded. No errors.

---

### TC-SCA-07 — checkin Check D blocks PR when OPEN SEC-DEP present

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F11

**Steps:**
1. Ensure at least one `SEC-DEP` row with `Status: Open` remains in security/security-ledger.md.
2. Run `/checkin` (or the checkin skill).

**Expected:** Check D fails and the PR is blocked. The failure message references the open SEC-DEP finding. No code change to the checkin skill was required — existing Check D logic picks up SEC-DEP automatically.

---

## Suite 3 — Validation Script

> Automated. Run the test file directly — all 7 assertions must pass.

### TC-SCA-08 — validate-sca-findings.test.cjs: 7 passed · 0 failed

**Priority:** Critical
**Type:** Automated
**AC:** AC-F12, AC-F13, AC-F14, AC-NF2

**Steps:**
1. Run: `node tests/validate-sca-findings.test.cjs`

**Expected output:**
```
  ✓ valid batch accepted
  ✓ missing-field batch rejected
  ✓ empty array accepted
  ✓ non-JSON string rejected
  ✓ invalid id rejected
  ✓ unresolvable path rejected
  ✓ 50 findings validated in <500ms (AC-NF2)

  7 passed · 0 failed
```

Exit code: 0.

**Fail condition:** Any test fails, or `50 findings validated in <500ms` fails (performance regression).

---

## Suite 4 — Reference Doc

> Verifies sca-scan.md is complete and accurate.

### TC-SCA-09 — sca-scan.md: coverage map table present and complete

**Priority:** High
**Type:** Manual review
**AC:** AC-F15, AC-F16

**Steps:**
1. Open `skills/security/references/sca-scan.md`.
2. Verify the coverage map table at the top lists npm, PyPI, NuGet, and Maven rows.
3. Check each section header for `Source:`, `Last-validated:`, and `Stale-after:` metadata lines.

**Expected:** All 4 ecosystems in coverage map. All section headers have all 3 metadata fields.

---

### TC-SCA-10 — sca-scan.md: severity normalization table complete

**Priority:** High
**Type:** Manual review
**AC:** AC-F17

**Steps:**
1. Open the Severity Normalization section of sca-scan.md.
2. Confirm all source tools and all severity values are mapped.

**Expected:** npm (critical/high/moderate/low), pip/dotnet CVSS bands (9.0+/7.0-8.9/4.0-6.9/<4.0), OSV.dev (CRITICAL/HIGH/MEDIUM/LOW) all present with correct schema values.

---

### TC-SCA-11 — sca-scan.md: npm v7+ JSON shape change documented

**Priority:** Medium
**Type:** Manual review
**AC:** AC-F15

**Steps:**
1. Open the npm section of sca-scan.md.
2. Confirm the v7+ breaking change note is present (advisories → vulnerabilities key).

**Expected:** Note present explaining that npm v7+ uses the `vulnerabilities` key instead of `advisories`. Implementer version check instruction is included.

---

## Suite 5 — Governance / Manifest

### TC-SCA-12 — _deploy-manifest.json has sca-scan.md reference_files entry

**Priority:** High
**Type:** Manual review
**AC:** AC-F19

**Steps:**
1. Open `.claude/rules/_deploy-manifest.json`.
2. Find the `reference_files` array.
3. Confirm it contains an entry with `"file": "skills/security/references/sca-scan.md"`.

**Expected:** Entry present with `category: "rule-catalog"` and a description field.

---

### TC-SCA-13 — setup-status Section 1c-quin flags sca-scan.md correctly

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F20

**Steps:**
1. Run `/setup-status`.
2. Find the `sca-scan.md (SCA spec)` line in the output.
3. Verify it shows green (current) since Last-validated was just set.

**Expected:** Green status shown. Then artificially back-date the Last-validated field to 95 days ago and re-run — amber status expected.

---

## Suite 6 — Regression

### TC-SCA-14 — Existing /security behavior unchanged when no SCA manifests

**Priority:** Critical
**Type:** Manual CLI

**Steps:**
1. Use a project with no package.json, requirements.txt, or *.csproj (but with source code for Pass 1 to scan).
2. Run `/security`.
3. Confirm Pass 1 findings are still produced normally.

**Expected:** Skip message for SCA scan, then Pass 1 runs and finds SEC-INJ / SEC-CONFIG / etc. findings as before. No behavioral change.

---

### TC-SCA-15 — IaC Scan Pre-Scan step still runs and is positioned before SCA step

**Priority:** High
**Type:** Manual CLI

**Steps:**
1. Use a project with both a Dockerfile and a package.json.
2. Run `/security`.
3. Observe output order.

**Expected:** IaC Scan output appears first (SEC-CONTAINER/SEC-IAC findings), then SCA Scan output (SEC-DEP findings), then Pass 1. Ordering is IaC → SCA → Pass 1.
