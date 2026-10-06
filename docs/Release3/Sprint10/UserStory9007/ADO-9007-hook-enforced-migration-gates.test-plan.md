# QA Test Plan — Hook-Enforced Migration Gates
ADO #9007 · Release 3 · Sprint 10
Source: ICEA + Tech Specs (4 stories)
Generated: 2026-10-02

---

## Scope

This test plan covers all 15 ACs (12 functional + 3 non-functional) across 4 stories. Each story's tech spec contains a detailed Test Cases table; this plan consolidates them into a runnable QA structure with cross-cutting suites added.

**Entry point:** `node tests/<name>.test.cjs` for all automated suites. Manual verification required for AC-NF3 (WCF rerun).

---

## Suite Index

| Suite | Story | Type | AC(s) | Entry Point |
|---|---|---|---|---|
| S1 — intake-verify tolerant reader | 1 | Unit | AC-F1 (enables) | `node tests/intake-verify.test.cjs` |
| S2 — options + design gate (approval-capture) | 2 | Unit + Integration | AC-F4, AC-F5, AC-F6, AC-F7 | `node tests/approval-capture.test.cjs` |
| S3 — migration-gate hook | 2 | Unit + Fault Injection | AC-F1, AC-F2, AC-F9, AC-NF1, AC-NF2 | `node tests/migration-gate.test.cjs` |
| S4 — cluster-merge prepare + merge | 3 | Unit + Integration | AC-F3, AC-F8 | `node tests/cluster-merge.test.cjs` |
| S5 — setup-init hook deployment | 4 | Integration | AC-F12 | Manual + `node scripts/setup-init-bootstrap.cjs` |
| S6 — SKILL.md hook preflight | 4 | Manual | AC-F11 | Manual shell test |
| S7 — WCF migration rerun | 4 | End-to-End | AC-NF3 | Manual rerun |
| S8 — Regression: existing upgrade runs | Cross-cutting | Regression | AC-F1 | `node tests/intake-verify.test.cjs --skill=upgrade` |

---

## Suite S1 — intake-verify tolerant reader

**File:** `tests/intake-verify.test.cjs`
**Run:** `node tests/intake-verify.test.cjs`

| TC | Input | Expected | Pass criteria |
|---|---|---|---|
| P-U1 | `check-gate --skill=rewrite` · flat string `intake_context: 'PASS'` | Exit 0 | Exit code = 0 |
| P-U2 | `check-gate --skill=rewrite` · object `intake_context: { verdict: 'PASS' }` | Exit 0 | Exit code = 0 |
| N-U1 | `check-gate` (no `--skill`) | Exit 10; output contains `skill-required` | Exit code = 10 AND stdout/stderr contains "skill-required" |
| N-U2 | `check-gate --skill=rewrite` · `intake_context: { verdict: 'REVISE' }` | Exit 1 | Exit code = 1 |
| N-U3 | `check-gate --skill=rewrite` · no `intake_context` key | Exit 1 | Exit code = 1 |

---

## Suite S2 — approval-capture (options + design)

**File:** `tests/approval-capture.test.cjs`
**Run:** `node tests/approval-capture.test.cjs`

| TC | Scenario | Input prompt | Expected |
|---|---|---|---|
| P-U1 | APPROVE OPTIONS — valid | `APPROVE OPTIONS ADO-0001 A` · options.md exists · no PARTIAL | `options_approved` written; `additionalContext` confirms option A |
| P-U2 | PROCEED — valid with acknowledged PARTIAL | `PROCEED ADO-0001 A` · options.md exists · PARTIAL row named | `options_approved` + acknowledged row written |
| P-U3 | APPROVE DESIGN — all 7 docs present, no UNVERIFIED | `APPROVE DESIGN ADO-0001` | `design_approved` + `target_root` written |
| N-U1 | APPROVE OPTIONS — options.md missing | `APPROVE OPTIONS ADO-0001 A` · no options file | REJECT; message names missing file |
| N-U2 | APPROVE OPTIONS — PARTIAL rows unacknowledged | `APPROVE OPTIONS ADO-0001 A` · PARTIAL row in inventory | REJECT; message lists PARTIAL rows |
| N-U3 | APPROVE DESIGN — design doc missing | `APPROVE DESIGN ADO-0001` · one of 7 missing | REJECT; message names missing doc |
| N-U4 | APPROVE DESIGN — target_root not recorded | `APPROVE DESIGN ADO-0001` · all docs present | REJECT; message: "target_root not recorded" |
| N-U5 | APPROVE DESIGN — UNVERIFIED row | `APPROVE DESIGN ADO-0001` · UNVERIFIED in inventory | REJECT; message lists UNVERIFIED rows |
| N-U6 | Unrecognized prompt | `RANDOM TEXT` | No action; exits 0; no audit entry |

---

## Suite S3 — migration-gate hook

**File:** `tests/migration-gate.test.cjs`
**Run:** `node tests/migration-gate.test.cjs`

| TC | Scenario | Input | Expected |
|---|---|---|---|
| P-U1 | Write to options.md — intake_context PASS | Write `docs/migrations/ADO-0001/ADO-0001-options.md` · intake PASS | Exit 0 (allowed) |
| P-U2 | Write to design doc — options_approved present | Write `target-component-architecture.md` · `options_approved` in file | Exit 0 |
| N-U1 | Write to options.md — intake_context not PASS | Write options.md · intake absent | Exit 2; message includes gate name |
| N-U2 | Write to design doc — options_approved absent | Write design doc · no approval | Exit 2 |
| N-U3 | Bash write to approvals.json | Bash `echo > .claude/migration/ADO-0001.approvals.json` | Exit 2 |
| N-U4 | Bash `set-gate` with protected gate name | Bash `node scripts/checkpoint-ledger.cjs set-gate --gate=options_approved` | Exit 2 |
| NF-1 | Fault injection: hook crash | Force hook error path | Exit 2 (fail-closed; never 0 or 1) |
| NF-2 | active-task.json read | Grep hook source for `active-task` | Zero matches |

---

## Suite S4 — cluster-merge

**File:** `tests/cluster-merge.test.cjs`
**Run:** `node tests/cluster-merge.test.cjs`

| TC | Scenario | Expected |
|---|---|---|
| P-U1 | prepare clusters 1,2 — clean branches | `pending-approval.json` written with SHAs; exits 0 |
| P-U2 | merge cluster 1 — approved + SHA match | Merge executes; `cluster_1_merged` appended; exits 0 |
| P-U3 | APPROVE CLUSTERS handler | Per-cluster `cluster_N_approved` entries written; `pending-approval.json` deleted |
| P-U4 | SKIP CLUSTER handler | `cluster_2_skipped` appended; exits 0 |
| N-U1 | merge — no `cluster_1_approved` | Exit 2; message: "cluster_1_approved not found" |
| N-U2 | merge — SHA mismatch | Exit 2; shows approved vs current SHA |
| N-U3 | merge — `cluster_1_commit_started` exists | Exit 2; "already merged or in progress" |
| N-U4 | APPROVE CLUSTERS — no `pending-approval.json` | REJECT; "run prepare first" |
| N-U5 | row 3 gate — write to worktrees/cluster-1 before approved | Exit 2; message includes "APPROVE CLUSTERS" |
| INT-1 | Full prepare → approve → merge flow | Both clusters merged; `cluster_N_merged` entries present |
| INT-2 | Fault: `cluster_1_commit_started` exists at merge start | Exit 2; no double-merge |

---

## Suite S5 — setup-init hook deployment

**Run:** `node scripts/setup-init-bootstrap.cjs --target {test-target-dir}`

| TC | Scenario | Expected |
|---|---|---|
| P-U1 | Clean target (no hooks, no settings.json) | Both hook files copied; settings.json created with both entries; exits 0 |
| P-U2 | Idempotency: run twice | Second run: "already registered (skipped)" for both; settings.json unchanged |
| N-U1 | Hook source missing from `_project-deploy/hooks/` | Exit 1; message names missing file |
| N-U2 | settings.json malformed JSON | Exit 1; parse error message |

---

## Suite S6 — SKILL.md hook preflight (manual)

| TC | Step | Action | Expected |
|---|---|---|---|
| M-1 | Delete `approval-capture.cjs` from test target | Start rewrite skill Step 0 | STOP message; "approval-capture.cjs not found"; skill exits 1 |
| M-2 | File present but not in settings.json | Start rewrite skill Step 0 | STOP message; "not registered in settings.json"; skill exits 1 |
| M-3 | Both hooks present + registered | Start rewrite skill Step 0 | "Hook preflight passed."; skill continues to Step 1 |

---

## Suite S7 — WCF Migration Rerun (AC-NF3)

**Type:** Manual end-to-end verification
**Prerequisite:** All 4 stories merged; setup-init run on WCF test repo; D-1 = Option A confirmed.

| Check | Method | Pass criteria |
|---|---|---|
| Zero model-written self-approvals | Inspect `.claude/migration/*.approvals.json` — all entries written by `approval-capture.cjs` only | Count of model-written gate entries = 0 |
| Options gate fires | Attempt to write design docs before APPROVE OPTIONS | migration-gate.cjs blocks with exit 2 |
| Design gate fires | Attempt to write cluster worktree before APPROVE DESIGN | migration-gate.cjs blocks with exit 2 |
| Cluster gate fires | Attempt to merge cluster before APPROVE CLUSTERS | cluster-merge.cjs exits 2 |
| Design revision count | Count Edits to design docs in session | Record count; compare to original run (27 revisions) |

---

## Suite S8 — Regression: existing upgrade runs

**Run:** `node tests/intake-verify.test.cjs` (all tests must still pass with `--skill=upgrade`)

| TC | Input | Expected |
|---|---|---|
| R-1 | `check-gate --skill=upgrade` · flat string `intake_context: 'PASS'` | Exit 0 |
| R-2 | `check-gate --skill=upgrade` · no `intake_context` | Exit 1 |

---

## Cross-Cutting Checks

| Check | Method |
|---|---|
| No `console.log` in hook production paths | `grep -rn 'console.log' _project-deploy/hooks/` → zero matches |
| No `active-task.json` read in hooks | `grep -rn 'active-task' _project-deploy/hooks/` → zero matches |
| All hooks exit 2 on crash | Fault injection test in Suite S3 NF-1 |
| ADO normalization: no inline normalization | `grep -rn 'ADO-' _project-deploy/hooks/ scripts/cluster-merge.cjs` · all via `normalizeAdo()` |
| CommonJS only | `grep -rn '^import\|^export' _project-deploy/hooks/ scripts/cluster-merge.cjs` → zero matches |

---

## Definition of Done — Test Plan

- [ ] Suites S1–S4 automated: `npm test` passes with all new test files included
- [ ] Suite S5 verified on a clean test target project
- [ ] Suite S6 verified manually (3 preflight scenarios)
- [ ] Suite S7 (WCF rerun) recorded in `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` after Story 4 merge
- [ ] Suite S8 regression: existing upgrade run unaffected
- [ ] Cross-cutting checks all pass

---

### Revision Log
2026-10-02 — Test plan generated from ICEA + 4 story tech specs on SAVE TECH ADO-9007
