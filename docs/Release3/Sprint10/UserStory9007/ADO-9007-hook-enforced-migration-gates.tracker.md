# Tracker — Hook-Enforced Migration Gates
ADO #9007 · EPIC · Release 3 · Sprint 10
Status: PENDING IMPLEMENTATION

---

## Story Board

| Story | Title | SP | Status | Depends on | PR |
|---|---|---|---|---|---|
| 1 | Phase 0 — Prerequisites | 5 | ✅ Done | None | — |
| 2 | Phase 1 — Options + Design Gates | 5 | ✅ Done | Story 1 | — |
| 3 | Phase 2 — Cluster Write Gate | 3 | ✅ Done | Story 2 | — |
| 4 | Phase 3 — Skill + Rollout | 5 | ✅ Done | Story 3 | — |
| **Total** | | **18** | | | |

---

## Story 1 — Phase 0 Prerequisites

**Status:** ✅ Done — 2026-10-02
**SP:** 5
**Branch:** feature/ADO-9007-story-1-phase0-prerequisites

### Files
- `scripts/intake-verify.cjs` — add `gateVerdict()` helper; `--skill` required with exit 10
- `tests/intake-verify.test.cjs` — add `--skill=rewrite` to existing calls; add 2 new test cases
- `skills/rewrite/SKILL.md` — `{ADO_ID}` → `{ADO}`; `target_root` payload; `design_judge` gate write

### Definition of Done
- [ ] `gateVerdict()` helper added; all `intake_context` comparisons use it
- [ ] `--skill` required on `check-gate`; exit 10 if absent; `led.skill || 'upgrade'` removed
- [ ] All `{ADO_ID}` replaced with `{ADO}` in SKILL.md — verified by grep returning no output
- [ ] `set-payload --key=target_root` added in Step 0 after checkpoint init
- [ ] `set-gate --gate=design_judge` added in Step 2.5 after judge returns
- [ ] `--verdict=ACKNOWLEDGED` and `--verdict=BLOCK_OVERRIDE` replaced with `--verdict=PASS`
- [ ] `node tests/intake-verify.test.cjs` passes — all existing + 2 new test cases
- [ ] Phase 0 spike result (D-1) documented in `docs/plans/migrationSkill/rewrite-hook-gates-v1.md`

### Open Questions
- D-1: Does PreToolUse fire in subagents? (Phase 0 spike — gates Story 3 design)

---

## Story 2 — Phase 1 Options + Design Gates

**Status:** ✅ Done — 2026-10-02
**SP:** 5
**Branch:** feature/ADO-9007-story-2-phase1-options-design-gates

### Files
- `_project-deploy/hooks/approval-capture.cjs` — new UserPromptSubmit hook
- `_project-deploy/hooks/migration-gate.cjs` — new PreToolUse hook
- `scripts/ado-normalize.cjs` — new shared ADO normalization utility
- `.claude/settings.json` — add UserPromptSubmit + PreToolUse hook entries
- `tests/approval-capture.test.cjs` — new test file
- `tests/migration-gate.test.cjs` — new test file

### Definition of Done
- [ ] `approval-capture.cjs` handles APPROVE OPTIONS, PROCEED, APPROVE DESIGN with all precondition checks
- [ ] `migration-gate.cjs` blocks rows 1+2 (options write, design write) and Bash gate
- [ ] `ado-normalize.cjs` used by both hooks — no inline normalization
- [ ] All hooks exit 2 on crash (fail-closed)
- [ ] No `active-task.json` reads for enforcement decisions
- [ ] `node tests/approval-capture.test.cjs` passes (10 negative + 6 positive tests)
- [ ] `node tests/migration-gate.test.cjs` passes (fault-injection, Bash pattern, Write/Edit blocking)
- [ ] NF1 fault-injection: hook crash → exit 2 (never exit 0 or 1)
- [ ] NF2 active-task.json: grep confirms no `active-task` reference in hook files

---

## Story 3 — Phase 2 Cluster Write Gate

**Status:** ✅ Done — 2026-10-02
**SP:** 3
**Branch:** feature/ADO-9007-story-3-phase2-cluster-gate

### Files
- `scripts/cluster-merge.cjs` — new: prepare + merge subcommands
- `_project-deploy/hooks/approval-capture.cjs` — add APPROVE CLUSTERS + SKIP CLUSTER handlers
- `_project-deploy/hooks/migration-gate.cjs` — add row 3 (cluster worktree write gate; D-1 path)
- `tests/cluster-merge.test.cjs` — new test file

### Definition of Done
- [ ] `cluster-merge.cjs prepare` commits worktree branches, records SHAs, writes pending-approval.json
- [ ] `cluster-merge.cjs merge` gates on `cluster_N_approved` + SHA match + BAL check
- [ ] `cluster_N_commit_started` idempotency marker written before merge
- [ ] APPROVE CLUSTERS handler reads pending-approval.json, records per-cluster approvals, deletes file
- [ ] SKIP CLUSTER handler records `cluster_N_skipped`
- [ ] migration-gate.cjs row 3 blocks Write/Edit to worktrees/cluster-N paths until approved or skipped
- [ ] `node tests/cluster-merge.test.cjs` passes (SHA mismatch, missing approval, idempotency, double-merge protection)

---

## Story 4 — Phase 3 Skill + Rollout

**Status:** ✅ Done — 2026-10-02
**SP:** 5
**Branch:** feature/ADO-9007-story-4-phase3-skill-rollout

### Files
- `skills/rewrite/SKILL.md` — Step 0 hook preflight; approval grammar Steps 1.5, 2.5, 3+
- `scripts/setup-init-bootstrap.cjs` — add `deployHooks()` function
- `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` — AC-NF3 verification record (post-rerun)

### Definition of Done
- [ ] SKILL.md Step 0 preflight checks both hooks (file + registration); STOP if missing
- [ ] SKILL.md approval grammar updated in Steps 1.5, 2.5, 3+
- [ ] `deployHooks()` copies both hooks + registers in settings.json (idempotent)
- [ ] No hardcoded paths in deployHooks — all from pluginDir parameter
- [ ] AC-NF3 WCF rerun recorded: zero self-approvals; design revision count captured

---

## Epic Definition of Done

**Delivery**
- [ ] All 4 story tech specs generated and reviewed
- [ ] All 4 stories implemented, reviewed, and merged to feature branch
- [ ] D-1 decision recorded before Story 3 implementation starts

**Quality**
- [ ] `npm test` passes — all new and modified tests green
- [ ] WCF migration rerun completes with zero model-written human gates (AC-NF3 verified)
- [ ] Design revision count from WCF rerun recorded and compared to original 27
- [ ] Regression: existing upgrade runs unaffected by intake-verify.cjs changes (check with `--skill=upgrade` on flat-string ledger)

**Review**
- [ ] Epic tech spec and all 4 story tech specs reviewed by Tech Lead
- [ ] Each story PR maps changed files to ACs (AC Coverage Matrix in each spec)
- [ ] ICEA and all tech specs committed in the feature branch
- [ ] D-1 decision (Option A or B) recorded in `rewrite-hook-gates-v1.md` before Story 3 starts

---

## AC Traceability Matrix — Epic View

| AC | Description | Story | Status |
|---|---|---|---|
| AC-F1 | intake-verify check-gate blocks options write when intake_context not PASS | 2 (enabled by 1) | ✅ |
| AC-F2 | Hook derives ADO from file path pattern only; no active-task.json reads | 2 | ✅ |
| AC-F3 | Cluster merge gated behind APPROVE CLUSTERS + SHA match | 3 | ✅ |
| AC-F4 | APPROVE OPTIONS recorded with selected option letter + precondition checks | 2 | ✅ |
| AC-F5 | PROCEED recorded as implicit options approval (fallback grammar) | 2 | ✅ |
| AC-F6 | Design write blocked until options_approved in approvals file | 2 | ✅ |
| AC-F7 | APPROVE DESIGN validates 7 design docs + target_root recorded + no UNVERIFIED rows | 2 | ✅ |
| AC-F8 | cluster-merge.cjs merge checks cluster_N_approved + SHA + BAL gate | 3 | ✅ |
| AC-F9 | All hooks exit 2 on any uncaught error (fail-closed) | 2 | ✅ |
| AC-F10 | design_judge gate written in SKILL.md after Step 2.5 judge returns | 1 | ✅ |
| AC-F11 | SKILL.md Step 0 preflight STOPs if either hook missing from target project | 4 | ✅ |
| AC-F12 | setup-init-bootstrap.cjs deploys both hooks + registers in target settings.json | 4 | ✅ |
| AC-NF1 | Fault injection: hook crash exits 2 (not 0 or 1); write is blocked | 2 | ✅ |
| AC-NF2 | active-task.json never read for enforcement decisions | 2 | ✅ |
| AC-NF3 | WCF rerun: zero model-written self-approvals; all gates triggered by developer prompts | 4 | ⏳ (pending rerun) |

---

## Revision Log
2026-10-02 — Tracker generated from Epic tech spec + 4 story tech specs
2026-10-02 — Story 2 implemented: ado-normalize.cjs, approval-capture.cjs, migration-gate.cjs, settings.json entries, 2 test files. 67 tests passed.
2026-10-02 — Story 3 implemented: cluster-merge.cjs (prepare + merge subcommands), approval-capture.cjs additions (APPROVE CLUSTERS + SKIP CLUSTER), migration-gate.cjs row 3 (cluster worktree gate), tests/cluster-merge.test.cjs. 26 tests passed. Regression: 67 Story 2 tests still green.
2026-10-02 — Story 4 implemented: SKILL.md Step 0 hook preflight (AC-F11), SKILL.md approval grammar for Steps 1.5/2.5/3+ (APPROVE OPTIONS, APPROVE DESIGN, APPROVE CLUSTERS/SKIP CLUSTER), deployHooks() in setup-init-bootstrap.cjs with require.main guard + module.exports (AC-F12), AC-NF3 verification section in rewrite-hook-gates-v1.md (pending rerun), tests/setup-init-bootstrap.test.cjs. 24 tests passed. AC-NF3 pending WCF rerun.
