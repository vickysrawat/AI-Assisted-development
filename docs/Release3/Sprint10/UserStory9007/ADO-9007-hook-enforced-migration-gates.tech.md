# Epic Tech Spec — Hook-Enforced Migration Gates
ADO #9007 · Release 3 · Sprint 10
Status: DRAFT · EPIC · 18 SP total

---

## Overview

This epic moves rewrite skill gate enforcement from prose instructions to Claude Code hooks and scripts, closing the class of failures demonstrated by the WCF → .NET 10 run where the model self-approved human gates and skipped the options step. Four phases are delivered across four stories: Phase 0 fixes the prerequisites that unblock the gate system (tolerant gate reader, design_judge write, placeholder normalization, target_root recording, subagent hook spike); Phase 1 deploys `approval-capture.cjs` and `migration-gate.cjs` to block design-document writes until the developer explicitly approves options; Phase 2 adds `cluster-merge.cjs` to gate cluster worktree merges behind `APPROVE CLUSTERS`; Phase 3 aligns SKILL.md with the hook system, deploys hooks via `setup-init-bootstrap.cjs`, and verifies the full gate chain with a WCF migration rerun. The epic deliberately does NOT cover per-wave independent judge gates, hook reuse for upgrade/replatform skills, or SKILL.md size reduction — all deferred to follow-up work items.

---

## Story Breakdown

All implementation detail (AC Coverage Matrix, Files Changed, Test Cases) lives in each story's individual tech spec.

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Phase 0 — Prerequisites | 5 | Yes — fixes latent defects; unblocks Phase 1 | None | [ADO-9007-Story-1-phase0-prerequisites.techspec.md]() | ⏳ Pending |
| 2 | Phase 1 — Options + Design gates | 5 | Yes — MVP; stops WCF failure class | Story 1 | [ADO-9007-Story-2-phase1-options-design-gates.techspec.md]() | ⏳ Pending |
| 3 | Phase 2 — Cluster write gate | 3 | Yes — cluster writes gated end-to-end | Story 2 | [ADO-9007-Story-3-phase2-cluster-gate.techspec.md]() | ⏳ Pending |
| 4 | Phase 3 — Skill + rollout | 5 | Yes — V1 complete; WCF rerun verifies all 15 ACs | Story 3 | [ADO-9007-Story-4-phase3-skill-rollout.techspec.md]() | ⏳ Pending |

> Stories broken by logical completion — Phase 2 ships before Phase 3 because `cluster-merge.cjs` is needed for the WCF rerun.

---

## Auth & Security

**Authentication pattern:** None — this is a local developer tool. Hooks run as the developer's own OS process; no external authentication or authorization.

**Cross-cutting security concerns:**

| Concern | Mitigation |
|---|---|
| Hook crash lets a gated write through | All hooks catch all errors and exit 2 (fail-closed); exit 1 is explicitly not used |
| Model writes approval state via Bash | `migration-gate.cjs` blocks Bash commands matching `.approvals.json` path OR `--gate=` with a protected gate name OR `.checkpoint.json` + protected gate name |
| Model writes approval state via Write/Edit | `migration-gate.cjs` blocks Write/Edit to `.claude/migration/*.approvals.json` |
| Hook reads model-controlled state for enforcement decisions | Hooks derive the ADO from file path patterns only; `.claude/active-task.json` (model-written) is never read for enforcement |
| ADO identifier mismatch creates dual ledgers | One shared normalization function used by both hooks and `cluster-merge.cjs`; canonical form `ADO-<id>` throughout |
| Indirect writes (cp, variable expansion) bypass Bash pattern match | Accepted for v1 (model is not adversarial; merge path still enforced by `cluster-merge.cjs`); noted in migration log risk table |

---

## Overall Request Flow

```
Developer runs rewrite skill for ADO-1234
  │
  ├─[Story 1] intake-verify.cjs check-gate --skill=rewrite
  │   reads stage_gates.intake_context tolerantly (object or string)
  │   exits 10 if --skill absent (no fallback)
  │
  ├─[Story 2] Model tries to write docs/migrations/ADO-1234/ADO-1234-options.md
  │   migration-gate.cjs intercepts (PreToolUse)
  │   → re-runs intake-verify.cjs check-gate --skill=rewrite (exits 0?)
  │   → re-runs coupling-resolution-validate.cjs (exits 0?)
  │   → both pass: write allowed
  │   → either fails: exit 2, write blocked
  │
  │  Developer replies "APPROVE OPTIONS ADO-1234 B"
  │   approval-capture.cjs intercepts (UserPromptSubmit)
  │   → checks ADO-1234-options.md exists + no unacknowledged PARTIAL rows
  │   → appends options_approved + option B to .claude/migration/ADO-1234.approvals.json
  │   → mirrors gate into ledger via checkpoint-ledger.cjs set-gate
  │   → returns additionalContext confirming approval
  │
  ├─[Story 2] Model tries to write docs/migrations/ADO-1234/target-component-architecture.md
  │   migration-gate.cjs intercepts → checks options_approved in approvals file
  │   → found: write allowed
  │
  ├─[Story 1] Model writes design_judge gate after Step 2.5 judge pass
  │   SKILL.md: set-gate --gate=design_judge --verdict=PASS|REVISE|BLOCK
  │
  │  Developer replies "APPROVE DESIGN ADO-1234"
  │   approval-capture.cjs intercepts
  │   → validates all 7 design docs exist, target_root recorded,
  │     no unknown/UNVERIFIED rows, all PARTIAL rows acknowledged by name
  │   → appends design_approved + target_root to approvals file
  │   → mirrors gate into ledger
  │   → returns additionalContext confirming approval
  │
  ├─[Story 3] Model runs cluster-merge.cjs prepare --ado=ADO-1234 --clusters=1,2,3
  │   commits each worktree branch → records branch head SHAs
  │   writes .claude/migration/ADO-1234.pending-approval.json
  │
  │  Developer replies "APPROVE CLUSTERS ADO-1234"
  │   approval-capture.cjs intercepts → reads pending-approval.json
  │   → records cluster_N_approved + approved SHA for each cluster
  │
  ├─[Story 3] Model runs cluster-merge.cjs merge --ado=ADO-1234 --cluster=1
  │   → checks cluster_1_approved + SHA match + BAL merge gate
  │   → writes cluster_1_commit_started → merges → records merge SHA
  │   → writes cluster_1_merged
  │
  └─[Story 4] Step 0 preflight at rewrite skill start
      → checks both hooks deployed + registered in target settings.json
      → checks REQUIRED_SCRIPTS (every script SKILL.md invokes)
      → STOP if any missing
```

---

## Rollback

**Schema migrations:** None — no database or shared ledger schema changes in v1.

**Rollback procedure (any story):**
1. Remove the `UserPromptSubmit` and `PreToolUse` entries for `approval-capture.cjs` and `migration-gate.cjs` from the target project's `settings.json`
2. Optionally remove `_project-deploy/hooks/approval-capture.cjs` and `migration-gate.cjs`
3. Revert `scripts/intake-verify.cjs` if Story 1 is being rolled back (restore the `led.skill || 'upgrade'` fallback and string comparison)
4. The approvals files (`.claude/migration/*.approvals.json`) are append-only logs — they can be left in place or deleted manually

**Rollback is safe:** all changes are additive. Removing the hook registrations from `settings.json` immediately disables enforcement without affecting any other system.

---

## Handover

### QA Team

**What was added across all stories:**
- 2 new Claude Code hooks deployed to `_project-deploy/hooks/` and registered in project `settings.json`
- 1 new script `scripts/cluster-merge.cjs` for cluster worktree management
- Modified `scripts/intake-verify.cjs` (tolerant reader + `--skill` required)
- Modified `skills/rewrite/SKILL.md` (target_root, design_judge, placeholder fix, approval grammar, hook preflight)
- Modified `scripts/setup-init-bootstrap.cjs` (deploys hooks to target projects)
- 3 new test files + 1 modified test file

**Test entry points:**
- Story 1: `node tests/intake-verify.test.cjs` — confirm object-form gate exits 0; missing `--skill` exits 10
- Story 2: `node tests/approval-capture.test.cjs` and `node tests/migration-gate.test.cjs`
- Story 3: `node tests/cluster-merge.test.cjs`
- Story 4: Fresh `setup-init` on a test target project → verify both hooks registered; scripted Step 0 run → verify STOP on missing hook

**Manual smoke test (Story 2 MVP gate):**
1. Initialize a test migration session (create a rewrite checkpoint for ADO-0001)
2. Attempt to write `docs/migrations/ADO-0001/target-component-architecture.md` via the Write tool
3. Confirm hook exits 2 and write is blocked with the correct message
4. Reply `APPROVE OPTIONS ADO-0001 A` (with `ADO-0001-options.md` existing)
5. Confirm approval recorded in `.claude/migration/ADO-0001.approvals.json`
6. Retry the write — confirm it proceeds

**Regression risk:** `intake-verify.cjs` changes affect all rewrite runs. Confirm existing upgrade runs are unaffected (`intake-verify.cjs check-gate` with `--skill=upgrade` on a flat-string ledger must still exit 0).

### DevOps / Platform Team

| Item | Story | Detail |
|---|---|---|
| New files deployed to target projects | Story 4 | `_project-deploy/hooks/approval-capture.cjs`, `_project-deploy/hooks/migration-gate.cjs` — deployed by `setup-init-bootstrap.cjs` |
| New `settings.json` entries in plugin | Story 2 | `UserPromptSubmit` hook entry for `approval-capture.cjs`; `PreToolUse` hook entry for `migration-gate.cjs` — local Claude Code config only |
| No network calls, no env vars, no secrets | All | All operations are local filesystem reads/writes + node process spawns |

### Future Developer — Follow-on Work

1. To add a new approval form (e.g. `APPROVE ARCHITECTURE ADO-NNN`): add a case to the switch in `approval-capture.cjs`, add the corresponding path pattern and approval check to `migration-gate.cjs`, add tests in `tests/approval-capture.test.cjs` and `tests/migration-gate.test.cjs`
2. To extend hook reuse to `upgrade` or `replatform` skills: the ADO normalization function is shared; the path patterns in `migration-gate.cjs` would need new rows for those skills' folder structures
3. The pending F3 work (`artifact-gate.cjs`, `set-judge`) should build on the approvals file pattern established here — see `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` §F3
4. Phase 0 spike result (D-1 in ICEA) must be recorded before Story 3 design is finalized — if PreToolUse does not fire in subagents, `migration-gate.cjs` row 3 still ships but its AC-F3 coverage is merge-time only via `cluster-merge.cjs`

---

## Definition of Done — Epic

**Delivery**
- [ ] All 4 story tech specs generated and reviewed (tracker shows all ✅)
- [ ] All 4 stories implemented, reviewed, and merged to feature branch
- [ ] Child ADO numbers recorded in Story Breakdown table when `IMPLEMENT` runs

**Quality**
- [ ] `npm test` passes with all new tests (approval-capture, migration-gate, cluster-merge) and the modified intake-verify tests
- [ ] WCF migration rerun completes with zero model-written human gates (AC-NF3 verified)
- [ ] Design-phase revision count from WCF rerun recorded and compared to first run's 27
- [ ] Regression: existing rewrite and upgrade runs unaffected by intake-verify.cjs changes

**Review**
- [ ] D-1 decision (OPTION A or OPTION B) recorded after Phase 0 spike result — Tech Lead selects before Story 3 starts
- [ ] Epic tech spec and all story tech specs reviewed by Tech Lead
- [ ] Each story PR maps changed files to ACs (AC Coverage Matrix)
- [ ] ICEA and all tech specs committed in the feature branch

---

## Reviewer Checklist

- [ ] All hooks exit 2 (never exit 1 or 0) on any uncaught error — verify fault-injection test covers this
- [ ] No hook reads `.claude/active-task.json` for any enforcement decision — grep `active-task` in hook files
- [ ] ADO normalization uses one shared function across both hooks and `cluster-merge.cjs` — verify no inline normalization
- [ ] All `approval-capture.cjs` approval forms require a precondition check before recording — verify no silent "always record" paths
- [ ] `migration-gate.cjs` Bash block pattern covers all three write routes from the WCF run: `set-gate --gate=`, direct `.checkpoint.json` write via `node -e`, direct `.approvals.json` write
- [ ] `cluster-merge.cjs merge` checks the branch head SHA before merging — no approval-without-SHA-check path
- [ ] CommonJS only — no `import` or `export` syntax in any new file
- [ ] No `console.log` in hooks (use `process.stderr.write` for error messages, `additionalContext` JSON for success)
- [ ] Story 4: SKILL.md Step 0 preflight verifies BOTH hooks deployed + registered + REQUIRED_SCRIPTS — not just one condition

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| ❓[1] | D-1: Does PreToolUse fire for tool calls inside subagents on the deployed Claude Code version? (Phase 0 spike required — determines AC-F3 enforcement path; Story 3 design cannot be finalized until answered) | Developer (Phase 0 spike) | Before Story 3 starts | Open |

---

## Revision Log
2026-10-02 — Epic tech spec drafted from ADO-9007 ICEA (18 SP, 4 stories, base-only template; no matching overlay for dotnet_framework + nodejs without angular)
