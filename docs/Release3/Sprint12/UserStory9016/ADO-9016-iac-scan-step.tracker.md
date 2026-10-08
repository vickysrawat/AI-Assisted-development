# Tracker — Security Skill: Dedicated IaC Scan Step
ADO #9016 · Release R3 · Sprint S12

**Type:** STORY
**Last Updated:** 2026-10-07

## Acceptance Criteria

| AC | Description | Status |
|---|---|---|
| AC-F1 | IaC Scan Pre-Scan step positioned after .gitignore Coverage, before Pass 1 | ✅ Done |
| AC-F2 | `find` glob covers Dockerfile, docker-compose*.yml, *.yaml under k8s/pipelines/deploy/manifests/ | ✅ Done |
| AC-F3 | Skip message + exit if no IaC files found; sub-agent not invoked | ✅ Done |
| AC-F4 | Sub-agent context scoped to IaC files, iac-scan.md, fingerprint-spec.md, output schema only | ✅ Done |
| AC-F5 | Dockerfile/docker-compose findings emitted with ID `SEC-CONTAINER` | ✅ Done |
| AC-F6 | K8s YAML findings emitted with ID `SEC-IAC` | ✅ Done |
| AC-F7 | Both IDs produce FP-fingerprinted ledger entries with Status: Open | ✅ Done |
| AC-F8 | `/fix FP-{id}` works on SEC-CONTAINER findings; `fix` field required in validated batch | ✅ Done |
| AC-F9 | `/dismiss FP-{id}` works on SEC-IAC findings; correct ledger format ensured | ✅ Done |
| AC-F10 | `checkin` Check D fails on any OPEN SEC-CONTAINER or SEC-IAC finding in ledger | ✅ Done |
| AC-F11 | `validate-iac-findings.cjs` validates JSON; 8 required fields enumerated | ✅ Done |
| AC-F12 | Missing-field batch: entire batch rejected; raw output to .claude/logs/; advisory raised; zero ledger writes | ✅ Done |
| AC-F13 | `tests/validate-iac-findings.test.cjs` passes with 4 named test cases | ✅ Done |
| AC-F14 | `iac-scan.md` contains ≥5 Dockerfile + 5 docker-compose + 9 K8s rules | ✅ Done |
| AC-F15 | Each rule section header: Source + Last-validated + Stale-after | ✅ Done |
| AC-F16 | Coverage map table at top of `iac-scan.md` | ✅ Done |
| AC-F17 | `pass2-personas.md` P4 de-dup gate excludes SEC-CONTAINER/SEC-IAC from current scan run | ✅ Done |
| AC-F18 | `cloud-checks.md` per-rule Dockerfile/docker-compose checks not present; scope explicit | ✅ Done |
| AC-F19 | `_deploy-manifest.json` entry for `iac-scan.md` (REFRESH RULES tooling) | ✅ Done |
| AC-F20 | `setup-status` flags `iac-scan.md` amber/red when Last-validated > 90 days (Section 1c-quad) | ✅ Done |
| AC-NF1 | Skip path completes <1s; sub-agent not invoked when no IaC files found | ✅ Done |
| AC-NF2 | `validate-iac-findings.cjs` validates ≤50 findings in <500ms | ✅ Done |

## Implementation — ADO #9016

**Status:** ✅ Done

### Delivered

- **`skills/security/SKILL.md`** — New `## Pre-Scan — IaC Scan` section inserted between `.gitignore Coverage` and `## Pass 1`: IaC File Detection (`find` glob), Rule Catalog Gate (checks iac-scan.md exists), and Sub-Agent Invocation (delegates scan, calls validate-iac-findings.cjs, merges to ledger). Covers AC-F1–F4, AC-F7, AC-NF1.
- **`skills/security/references/iac-scan.md`** — New rule catalog file with coverage map table, 5 Dockerfile rules (DOCKER-001–005, CIS Docker Benchmark v1.6), 5 docker-compose rules (COMPOSE-001–005), and 9 K8s YAML rules (K8S-001–009, CIS Kubernetes Benchmark v1.8). Each section has Source + Last-validated + Stale-after metadata. Covers AC-F5, AC-F6, AC-F14, AC-F15, AC-F16.
- **`skills/security/references/pass2-personas.md`** — P4 persona updated: removed per-file container checks from scope; added SEC-CONTAINER/SEC-IAC de-duplication gate (current scan session only); added explicit scope exclusion for Dockerfile/docker-compose/K8s per-rule content. Covers AC-F17.
- **`skills/security/references/cloud-checks.md`** — Added scope note blockquote at top clarifying Dockerfile/docker-compose/K8s per-rule checks are owned by the IaC Scan Pre-Scan step (`iac-scan.md`), not P4. Covers AC-F18.
- **`scripts/validate-iac-findings.cjs`** — New Node.js validator: accepts pre-parsed or JSON-string input; validates 8 required fields per finding (all-or-nothing semantics); checks `SEC-CONTAINER`/`SEC-IAC` IDs, severity enum, `FP-[0-9a-f]{8}` fingerprint pattern, and file path existence on disk; on CLI failure writes raw output to `.claude/logs/iac-scan-{date}.md`. Covers AC-F8, AC-F9, AC-F11, AC-F12, AC-NF2.
- **`tests/validate-iac-findings.test.cjs`** — New standalone test file; 7 test cases covering: valid batch, missing field, empty array, non-JSON string, invalid id, unresolvable path, and 50-finding performance (<500ms). Result: **7 passed · 0 failed**. Covers AC-F13, AC-NF2.
- **`.claude/rules/_deploy-manifest.json`** — Added `reference_files[]` array with entry for `iac-scan.md` (category: `rule-catalog`). Covers AC-F19.
- **`skills/setup-status/SKILL.md`** — Added Section 1c-quad (IaC scan rule catalog staleness): reads `Last-validated:` + `Stale-after:` directly from `iac-scan.md` header; amber ≥90 days, red ≥180 days. Added output report line for `iac-scan.md (rule catalog)`. Covers AC-F20.

### Tests added

- `tests/validate-iac-findings.test.cjs` — 7 test cases, 7 passed, 0 failed
  - TC-1: valid batch accepted (2 findings, real fixture paths)
  - TC-2: missing-field batch rejected (MISSING_FIELD, finding_index=1, field=fingerprint)
  - TC-3: empty array accepted (valid=true, findings=[])
  - TC-4: non-JSON string rejected (INVALID_JSON)
  - TC-5: invalid id rejected (SEC-OTHER → INVALID_ID)
  - TC-6: unresolvable path rejected (UNRESOLVABLE_PATH)
  - TC-7: 50 findings validated in <500ms (AC-NF2 performance assertion)

### Design decisions

- **All-or-nothing batch validation** — a single malformed finding rejects the entire batch. Prevents partial or unactionable findings reaching the security ledger. Consistent with how the other validators in the skill operate.
- **Dual input type for `validateIacFindings()`** — accepts both JSON string (CLI path) and pre-parsed value (test path) via `typeof input === 'string'` check. Avoids forcing tests to re-serialise fixtures; avoids forcing CLI caller to pre-parse. Option C chosen over string-only (A) or parsed-only (B).
- **AC-F20 via setup-status rather than `_deploy-manifest.json`** — `_deploy-manifest.json` schema has `deployed_rules[]` as a string array with no `stale_after_days` field. Adding one would require schema change across all deployed projects. Instead, staleness check reads `Last-validated:` + `Stale-after:` directly from `iac-scan.md` header in Section 1c-quad. Zero schema drift.
- **SEC-CONTAINER/SEC-IAC de-dup gate scoped to current scan session only** — historical entries in the security ledger from prior runs are unaffected and remain queryable. Gate checks only rows written during the current `/security` invocation to prevent double-reporting without breaking historical search.

### Known gaps

None. All 22 ACs (AC-F1–F20, AC-NF1–NF2) delivered. AC-F10 (checkin Check D) is enforced by the existing `checkin` skill's OPEN-findings gate which treats any pattern ID from the security ledger uniformly — `SEC-CONTAINER` and `SEC-IAC` entries are picked up automatically without code change.

## Follow-ups

| # | Issue | Fix applied | File(s) |
|---|---|---|---|
