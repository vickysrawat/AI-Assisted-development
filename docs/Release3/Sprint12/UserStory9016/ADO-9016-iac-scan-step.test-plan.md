# Test Plan — Security Skill: Dedicated IaC Scan Step (Sub-Agent)
ADO #9016 · Release R3 · Sprint S12
Document type: QA Test Plan
Prepared: 2026-10-07

---

## Overview

This plan covers functional, script-level, and regression testing for the IaC Scan Pre-Scan step added to the security skill. Suites should be run in order (Suite 1 → Suite 6) since Suite 2 (Actionability) depends on findings produced in Suite 1, and Suite 7 (Regression) confirms no side-effects on existing behavior.

## Environment Requirements

| Item | Requirement |
|---|---|
| Runtime | Node.js 20+ |
| Plugin version | ai-assisted-development v3.25.0 |
| Repo under test | A local test repo with at least one Dockerfile, one docker-compose.yml, and one K8s YAML under `pipelines/k8s/` |
| Clean ledger | `security/security-ledger.md` reset or empty before Suite 1 to isolate findings |
| `iac-scan.md` present | `skills/security/references/iac-scan.md` must exist (AC-F14 implementation complete) |
| `validate-iac-findings.cjs` present | `scripts/validate-iac-findings.cjs` must exist (AC-F11 implementation complete) |

## Test Suites

| Suite | Title | When to run | Effort |
|---|---|---|---|
| Suite 1 | IaC Scan Step Behavior | After SKILL.md and iac-scan.md changes are merged | ~30 min |
| Suite 2 | Actionability (fix / dismiss / checkin) | After Suite 1 passes (findings must be in ledger) | ~20 min |
| Suite 3 | Validation Script | After validate-iac-findings.cjs is merged | ~15 min |
| Suite 4 | Rule Catalog | After iac-scan.md and cloud-checks.md changes are merged | ~20 min |
| Suite 5 | P4 De-duplication | After pass2-personas.md change is merged | ~15 min |
| Suite 6 | Governance / Manifest | After _deploy-manifest.json change is merged | ~10 min |
| Suite 7 | Regression | After all changes are merged | ~20 min |

**Estimated total effort: ~2.2 hours for a full pass.**

---

## Suite 1 — IaC Scan Step Behavior

> Verifies that the IaC Scan Pre-Scan step detects the right files, skips correctly when none are found, gates on iac-scan.md presence, and produces fingerprinted ledger entries.

### TC-IAC-01 — Dockerfile with no USER: SEC-CONTAINER row written to ledger

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F1, AC-F2, AC-F5, AC-F7

**Steps:**
1. In the test repo, create (or confirm existence of) a `Dockerfile` that has no `USER` instruction before `CMD`.
2. Ensure `security/security-ledger.md` is reset to empty (or note the current row count).
3. Run `/security --full`.
4. Open `security/security-ledger.md`.

**Expected:** At least one new row with `SEC-CONTAINER`, file `Dockerfile`, `Status: Open`, a `FP-xxxxxxxx` fingerprint (8 hex chars), severity `High`, and rule `DOCKER-001`.

---

### TC-IAC-02 — K8s UAT path finds SEC-IAC finding

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F2, AC-F6, AC-F7

**Steps:**
1. Create `pipelines/k8s/uat/deployment.yaml` with an `env:` block containing `SECRET_KEY: plaintext_value` (key contains SECRET, value is not a `${...}` reference).
2. Reset the ledger.
3. Run `/security --full`.
4. Open `security/security-ledger.md`.

**Expected:** New row with `SEC-IAC`, file `pipelines/k8s/uat/deployment.yaml`, rule `K8S-001`, `Status: Open`, and a valid FP fingerprint. The UAT subdirectory path is cited — no hardcoded environment name is required in the `find` command.

---

### TC-IAC-03 — Skip message when no IaC files present

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F3, AC-NF1

**Steps:**
1. Use a test repo with no `Dockerfile`, no `docker-compose*.yml`, and no `*.yaml` under `k8s/`, `pipelines/`, `deploy/`, or `manifests/`.
2. Run `/security`.
3. Observe the chat output.
4. Check whether a sub-agent invocation occurred (observe Agent tool call in session output).

**Expected:** Output contains the exact string `IaC Scan: skipped — no IaC files found in scope`. No sub-agent Agent tool call is observed. Pass 1 proceeds normally.

**Fail condition:** Sub-agent is invoked when no IaC files are present, or skip message is missing.

---

### TC-IAC-04 — IaC Scan step is positioned before Pass 1

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F1

**Steps:**
1. Run `/security --full` on a repo with IaC files.
2. Observe the session output in order.

**Expected:** The IaC Scan Pre-Scan output (detection announcement, sub-agent invocation, ledger merge message) appears BEFORE the Pass 1 SAST output. The existing `.gitignore Coverage` Pre-Scan output appears BEFORE IaC Scan output.

---

### TC-IAC-05 — iac-scan.md missing: gate fires, Pass 1 continues

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F3 (error state)

**Steps:**
1. Temporarily rename `skills/security/references/iac-scan.md` to `iac-scan.md.bak`.
2. Create a test repo with a Dockerfile.
3. Run `/security`.
4. Restore the file after the test.

**Expected:** Output contains `⛔ IaC Scan blocked — iac-scan.md not found. Run /setup-sync to repair.` Pass 1 proceeds normally. No sub-agent invoked.

---

### TC-IAC-06 — Sub-agent context does NOT include source code files

**Priority:** High
**Type:** Manual CLI + Observation
**AC:** AC-F4

**Steps:**
1. Run `/security --full` on a repo with IaC files.
2. In the session output, find the sub-agent invocation block.
3. Inspect what files are listed in the sub-agent's input context.

**Expected:** The sub-agent input context includes: IaC file contents, `iac-scan.md` content, `fingerprint-spec.md` content, and the output JSON schema. It does NOT include any `.cjs`, `.js`, `.py`, `.cs`, or skill `.md` source files.

---

### TC-IAC-07 — docker-compose with privileged: false does not fire COMPOSE-001

**Priority:** Medium
**Type:** Manual CLI
**AC:** AC-F3 edge case (COMPOSE-001 fires on `true` only)

**Steps:**
1. Create `docker-compose.yml` with `privileged: false` set explicitly.
2. Run `/security --full`.
3. Check ledger for COMPOSE-001 finding.

**Expected:** No `SEC-CONTAINER` row for COMPOSE-001 — the rule does not fire when `privileged: false` is explicitly set.

---

## Suite 2 — Actionability (fix / dismiss / checkin)

> Verifies that SEC-CONTAINER and SEC-IAC findings in the ledger can be actioned via /fix, /dismiss, and enforce checkin Check D.

**Pre-condition:** Suite 1 must have produced at least one `SEC-CONTAINER` and one `SEC-IAC` finding in the ledger. Note their FP fingerprints.

### TC-ACT-01 — /fix on SEC-CONTAINER produces corrected Dockerfile snippet

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F8

**Steps:**
1. From Suite 1, note the FP fingerprint of a `SEC-CONTAINER` finding for DOCKER-001 (no USER).
2. Run `/fix FP-{fingerprint}`.
3. Observe the output.

**Expected:** A corrected Dockerfile snippet is produced showing `USER appuser` (or the relevant non-root user) added before the final `CMD`/`ENTRYPOINT`.

---

### TC-ACT-02 — /dismiss on SEC-IAC updates ledger status

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F9

**Steps:**
1. From Suite 1, note the FP fingerprint of a `SEC-IAC` finding.
2. Run `/dismiss FP-{fingerprint}` with a justification reason.
3. Open `security/security-ledger.md`.

**Expected:** The ledger row for that finding changes `Status: Open` to `Status: Dismissed`. The FP fingerprint is unchanged.

---

### TC-ACT-03 — checkin Check D fails when OPEN SEC-CONTAINER finding exists

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F10

**Steps:**
1. Ensure an `OPEN` `SEC-CONTAINER` finding is in the ledger (from Suite 1 — do not dismiss it).
2. Run `checkin`.
3. Observe the Check D output.

**Expected:** `checkin` Check D fails and its output cites the FP fingerprint, file path, and rule ID of the open `SEC-CONTAINER` finding.

---

### TC-ACT-04 — checkin Check D fails when OPEN SEC-IAC finding exists

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F10

**Steps:**
1. Ensure an `OPEN` `SEC-IAC` finding is in the ledger (from Suite 1 — do not dismiss it).
2. Run `checkin`.
3. Observe the Check D output.

**Expected:** `checkin` Check D fails and cites the `SEC-IAC` finding. Both `SEC-CONTAINER` and `SEC-IAC` open findings independently trigger Check D.

---

## Suite 3 — Validation Script

> Unit-level testing of validate-iac-findings.cjs. Primarily executed via the test file, with one manual CLI smoke test.

### TC-VAL-01 — npm test passes all 4 named test cases

**Priority:** Critical
**Type:** Automated (run via npm test)
**AC:** AC-F11, AC-F12, AC-F13

**Steps:**
1. From the plugin repo root, run `npm test`.
2. Observe the test output for `validate-iac-findings.test.cjs`.

**Expected:** All 4 named test cases pass:
- `valid batch accepted`
- `missing-field batch rejected`
- `empty array accepted`
- `non-JSON string rejected`

No new test failures in any other test file.

---

### TC-VAL-02 — Missing-field batch: zero findings written to ledger

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F12

**Steps:**
1. Construct a JSON array where finding[1] is missing the `fingerprint` field (save to a temp file).
2. Run `node scripts/validate-iac-findings.cjs --input-file /path/to/temp-findings.json`.
3. Observe: exit code, console output, log file.

**Expected:**
- Process exits with code 1.
- Console output contains the advisory: `IaC scan output invalid — manual review required, see .claude/logs/iac-scan-{date}.md`.
- `.claude/logs/iac-scan-{YYYY-MM-DD}.md` contains the raw input.
- `security/security-ledger.md` has no new rows (0 findings written).

---

### TC-VAL-03 — Empty array input: valid result, no error

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F13

**Steps:**
1. Run `node scripts/validate-iac-findings.cjs --input-file /dev/stdin` with input `[]`, or write `[]` to a temp file and pass the path.
2. Observe exit code and output.

**Expected:** Process exits with code 0. No advisory raised. No log file written.

---

### TC-VAL-04 — validate-iac-findings.cjs validates 50 findings in <500ms

**Priority:** Medium
**Type:** Automated (assertion in test file)
**AC:** AC-NF2

**Steps:**
1. The `tests/validate-iac-findings.test.cjs` test file includes a timing assertion for a 50-finding fixture.
2. Run `node tests/validate-iac-findings.test.cjs` directly.

**Expected:** The 50-finding validation completes and the timing assertion passes (delta < 500ms).

---

## Suite 4 — Rule Catalog

> Verifies iac-scan.md content, cloud-checks.md cleanup, and coverage map accuracy.

### TC-RUL-01 — iac-scan.md contains minimum required rules

**Priority:** High
**Type:** Manual File Review
**AC:** AC-F14

**Steps:**
1. Open `skills/security/references/iac-scan.md`.
2. Count rules in each section: Dockerfile, docker-compose, Kubernetes YAML.

**Expected:**
- Dockerfile section: >= 5 rules (DOCKER-001 through DOCKER-005 minimum)
- docker-compose section: >= 5 rules (COMPOSE-001 through COMPOSE-005 minimum)
- Kubernetes YAML section: >= 9 rules (K8S-001 through K8S-009 minimum)

---

### TC-RUL-02 — Each rule section header has Source, Last-validated, Stale-after

**Priority:** High
**Type:** Manual File Review
**AC:** AC-F15

**Steps:**
1. Open `skills/security/references/iac-scan.md`.
2. For each of the three rule sections (Dockerfile, docker-compose, Kubernetes YAML), check the section header block.

**Expected:** Each section header contains:
- `Source:` — benchmark name and version (e.g. `CIS Docker Benchmark v1.6`)
- `Last-validated:` — in `YYYY-MM-DD` format
- `Stale-after:` — integer (days, should be 90)

---

### TC-RUL-03 — Coverage map table present at top of iac-scan.md

**Priority:** High
**Type:** Manual File Review
**AC:** AC-F16

**Steps:**
1. Open `skills/security/references/iac-scan.md`.
2. Check the area immediately below the header and before the first rule section.

**Expected:** A Markdown table with columns: `Source`, `Total checks`, `Automated here`, `Excluded (reason)`. All three sources (CIS Docker Benchmark, CIS K8s Benchmark, Docker Compose) appear as rows. Total counts and exclusion reasons are populated.

---

### TC-RUL-04 — cloud-checks.md no longer contains Dockerfile/docker-compose per-rule checks

**Priority:** High
**Type:** Manual File Review
**AC:** AC-F18

**Steps:**
1. Open `skills/security/references/cloud-checks.md`.
2. Search for any heading or section containing: `Dockerfile`, `docker-compose`, `DOCKER-`, `COMPOSE-`, or `container image`.

**Expected:** No sections referencing Dockerfile or docker-compose rules. AWS/GCP/Azure cloud posture checks remain present.

---

### TC-RUL-05 — SEC-CONTAINER finding with DOCKER-001 produces correct evidence and fix

**Priority:** Medium
**Type:** Manual CLI (derived from Suite 1)
**AC:** AC-F14, AC-F15

**Steps:**
1. Review the SEC-CONTAINER finding in the ledger from Suite 1 (TC-IAC-01).
2. Confirm the `rule` field matches a rule ID in `iac-scan.md` (e.g. `DOCKER-001`).
3. Confirm the `evidence` field contains the verbatim Dockerfile excerpt that triggered the rule.
4. Confirm the `fix` field contains a corrected Dockerfile snippet.

**Expected:** All three fields are non-empty and consistent with the rule definition in `iac-scan.md`.

---

## Suite 5 — P4 De-duplication

> Verifies that Pass 2 P4 persona does not re-report findings already logged by the IaC Scan step.

### TC-P4D-01 — P4 does not re-report Dockerfile finding already in ledger

**Priority:** High
**Type:** Manual CLI + Observation
**AC:** AC-F17

**Steps:**
1. Run `/security --full` on a repo with a Dockerfile (no USER instruction) — the IaC Scan step logs a `SEC-CONTAINER` row for this file.
2. In the Pass 2 output, locate the P4 persona's findings section.
3. Inspect whether P4 raised a finding for the same Dockerfile + vulnerability class (running as root / no USER).

**Expected:** P4 output does NOT contain a finding for the Dockerfile's running-as-root concern. P4 produces only architectural cloud IAM / network topology / trust boundary findings.

---

### TC-P4D-02 — P4 still produces architectural cloud findings

**Priority:** High
**Type:** Manual CLI + Observation
**AC:** AC-F17

**Steps:**
1. Same run as TC-P4D-01.
2. Inspect P4's output for any cloud IAM, network topology, or cross-service trust boundary findings.

**Expected:** P4 produces findings for architectural concerns unrelated to container file content. The de-dup gate narrows P4's scope without silencing it entirely.

---

## Suite 6 — Governance / Manifest

> Verifies _deploy-manifest.json registration and setup-status staleness detection.

### TC-GOV-01 — _deploy-manifest.json contains iac-scan.md entry with stale_after_days: 90

**Priority:** High
**Type:** Manual File Review
**AC:** AC-F19

**Steps:**
1. Open `_deploy-manifest.json`.
2. Search for an entry referencing `skills/security/references/iac-scan.md`.

**Expected:** Entry exists with `"stale_after_days": 90`. The JSON is syntactically valid. The entry format is consistent with other existing manifest entries.

---

### TC-GOV-02 — setup-status flags iac-scan.md amber when Last-validated > 90 days

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F20

**Steps:**
1. In `skills/security/references/iac-scan.md`, temporarily change all `Last-validated:` dates to a date > 90 days ago (e.g. `2025-01-01`).
2. Run `/setup-status`.
3. Restore the `Last-validated:` dates after the test.

**Expected:** `setup-status` output flags `iac-scan.md` as `⚠ Amber` or `🔴 Red` (stale — last validated more than 90 days ago).

**Note:** If TC-GOV-02 fails because `setup-status` does not read `stale_after_days`, this confirms OQ-1 from the Tech Spec — a follow-on task is needed to update `setup-status`.

---

## Suite 7 — Regression

> Verifies that existing security skill behaviour is unchanged when IaC files are absent, and that existing ledger findings are unaffected by the new step.

### TC-REG-01 — Pass 1 SAST output unchanged when no IaC files present

**Priority:** Critical
**Type:** Manual CLI
**AC:** AC-F3 (regression guard)

**Steps:**
1. Use a repo with no IaC files and known source code vulnerabilities.
2. Run `/security --full`.
3. Compare Pass 1 SAST output with pre-implementation baseline (or verify Pass 1 findings are unchanged and complete).

**Expected:** Pass 1 SAST findings are identical to the pre-implementation baseline. The IaC Scan skip path adds no latency perceivable in the session (< 1s per AC-NF1).

---

### TC-REG-02 — Existing Open ledger findings not modified by IaC Scan step

**Priority:** High
**Type:** Manual CLI
**AC:** AC-F7 (regression — append-only)

**Steps:**
1. Ensure `security/security-ledger.md` contains 2+ existing rows (SEC-AUTH or similar, from prior scans).
2. Run `/security --full` on a repo with IaC files.
3. Open the ledger and compare existing rows to their pre-scan state.

**Expected:** All pre-existing ledger rows are unchanged (same FP, status, severity, content). New SEC-CONTAINER/SEC-IAC rows are appended at the bottom. The ledger is append-only — no modification to existing rows.

---

### TC-REG-03 — Pass 2 P3 and P2 personas unaffected

**Priority:** Medium
**Type:** Manual CLI + Observation
**AC:** AC-F17 (regression — other personas unchanged)

**Steps:**
1. Run `/security --full` on a repo with IaC files.
2. Observe Pass 2 output for P1, P2, P3 personas.

**Expected:** P1, P2, and P3 persona outputs are unchanged — they produce the same findings they would without the IaC Scan step. Only P4 has the de-dup gate; other personas are unaffected.

---

### TC-REG-04 — npm test suite passes with no regressions

**Priority:** Critical
**Type:** Automated
**AC:** Overall regression

**Steps:**
1. From the plugin repo root, run `npm test`.
2. Verify all existing tests pass, including the new `validate-iac-findings.test.cjs`.

**Expected:** All tests pass. Zero regressions introduced.

---

## Test Execution Tracker

| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-IAC-01 | Suite 1 — IaC Scan Step | Critical | | | ⬜ | |
| TC-IAC-02 | Suite 1 — IaC Scan Step | Critical | | | ⬜ | |
| TC-IAC-03 | Suite 1 — IaC Scan Step | Critical | | | ⬜ | |
| TC-IAC-04 | Suite 1 — IaC Scan Step | High | | | ⬜ | |
| TC-IAC-05 | Suite 1 — IaC Scan Step | High | | | ⬜ | |
| TC-IAC-06 | Suite 1 — IaC Scan Step | High | | | ⬜ | |
| TC-IAC-07 | Suite 1 — IaC Scan Step | Medium | | | ⬜ | |
| TC-ACT-01 | Suite 2 — Actionability | Critical | | | ⬜ | |
| TC-ACT-02 | Suite 2 — Actionability | High | | | ⬜ | |
| TC-ACT-03 | Suite 2 — Actionability | Critical | | | ⬜ | |
| TC-ACT-04 | Suite 2 — Actionability | Critical | | | ⬜ | |
| TC-VAL-01 | Suite 3 — Validation Script | Critical | | | ⬜ | |
| TC-VAL-02 | Suite 3 — Validation Script | Critical | | | ⬜ | |
| TC-VAL-03 | Suite 3 — Validation Script | High | | | ⬜ | |
| TC-VAL-04 | Suite 3 — Validation Script | Medium | | | ⬜ | |
| TC-RUL-01 | Suite 4 — Rule Catalog | High | | | ⬜ | |
| TC-RUL-02 | Suite 4 — Rule Catalog | High | | | ⬜ | |
| TC-RUL-03 | Suite 4 — Rule Catalog | High | | | ⬜ | |
| TC-RUL-04 | Suite 4 — Rule Catalog | High | | | ⬜ | |
| TC-RUL-05 | Suite 4 — Rule Catalog | Medium | | | ⬜ | |
| TC-P4D-01 | Suite 5 — P4 De-dup | High | | | ⬜ | |
| TC-P4D-02 | Suite 5 — P4 De-dup | High | | | ⬜ | |
| TC-GOV-01 | Suite 6 — Governance | High | | | ⬜ | |
| TC-GOV-02 | Suite 6 — Governance | High | | | ⬜ | Blocked if OQ-1 unresolved |
| TC-REG-01 | Suite 7 — Regression | Critical | | | ⬜ | |
| TC-REG-02 | Suite 7 — Regression | High | | | ⬜ | |
| TC-REG-03 | Suite 7 — Regression | Medium | | | ⬜ | |
| TC-REG-04 | Suite 7 — Regression | Critical | | | ⬜ | |

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## Exit Criteria

### Minimum for story to close

- [ ] TC-IAC-01 passed — SEC-CONTAINER finding written to ledger after Dockerfile scan
- [ ] TC-IAC-02 passed — SEC-IAC finding citing UAT K8s path written to ledger
- [ ] TC-IAC-03 passed — skip path fires correctly with no IaC files
- [ ] TC-ACT-01 passed — `/fix` produces corrected Dockerfile snippet for SEC-CONTAINER
- [ ] TC-ACT-03 passed — `checkin` Check D fails on OPEN SEC-CONTAINER finding
- [ ] TC-ACT-04 passed — `checkin` Check D fails on OPEN SEC-IAC finding
- [ ] TC-VAL-01 passed — all 4 named test cases in validate-iac-findings.test.cjs pass
- [ ] TC-VAL-02 passed — malformed batch: zero ledger writes, log file created
- [ ] TC-REG-01 passed — Pass 1 SAST unchanged when no IaC files present
- [ ] TC-REG-04 passed — `npm test` passes with no regressions
- [ ] All Critical TCs passed
- [ ] Zero open Critical defects
- [ ] OQ-1 resolved (setup-status / stale_after_days verification or follow-on task created)
