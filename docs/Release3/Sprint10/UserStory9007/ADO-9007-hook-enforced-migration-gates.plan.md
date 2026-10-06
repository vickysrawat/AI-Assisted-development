# Feature Plan — Hook-Enforced Migration Gates
ADO #9007 · Release 3 · Sprint 10
Status: ✅ Approved

---

## Problem Statement

The rewrite skill presents its gates as mandatory checkpoints, but nothing enforces them except
the model's willingness to follow prose. In the WCF → .NET 10 rewrite run, the model skipped
Step 2 entirely and self-approved both human gates (options_approved, design_approved) using
direct JSON writes and a CLI flag (--reason=) that the script rejects. As a result, code was
generated for a migration that had no approved options analysis or design documents — the
developer never reviewed the design before clusters were generated.

Success = a freshly-initialized target project has both hooks registered and a scripted rerun
of the WCF migration reaches APPROVE DESIGN with zero model-written human gates.

---

## Story

As a developer using the rewrite skill, I want gate enforcement to be mechanical rather than
prose-only, so that a migration cannot advance past the options or design gates without my
explicit approval — even if the model skips or misreads the skill instructions.

---

## Personas

Developer: Senior engineer running a migration · Has a working source app · Wants predictable
gate behavior · Frustrated when the model skips mandatory steps · Success = never sees a cluster
generated without first approving design.

---

## Feature Priority (MoSCoW)

### Must Have

**Phase 0 — Prerequisites**
- Fix 1: tolerant reader for `stage_gates.intake_context` in `intake-verify.cjs check-gate` (flat string or `{ verdict }` object)
- `--skill` required on `check-gate` with no fallback (exit 10 if absent)
- One ADO placeholder in SKILL.md — replace `{ADO_ID}` → `{ADO}` throughout
- Record `target_root` in Step 0 via `set-payload --key=target_root`
- Write `design_judge` gate in Step 2.5 after judge subagent returns
- Fix acknowledgement/override verdict strings: ACKNOWLEDGED → PASS, BLOCK_OVERRIDE → PASS
- Subagent hook spike: confirm PreToolUse fires in subagents before Phase 2 design

Rationale: Phase 1 hook depends on Fix 1. One-placeholder fix prevents dual-ledger split. design_judge write is required for APPROVE DESIGN to be reachable.

**Phase 1 — Options + design gates**
- `approval-capture.cjs` — UserPromptSubmit hook; records APPROVE OPTIONS, PROCEED, APPROVE DESIGN
- `migration-gate.cjs` — PreToolUse hook; blocks writes to gated paths until approvals exist
- ADO normalization shared function (ADO-1234 ↔ 1234)
- Plugin `.claude/settings.json` entries pointing at `_project-deploy/hooks/`
- Tests for both hooks + preflight test for REQUIRED_SCRIPTS

Rationale: Phase 1 alone would have stopped the WCF run at the first design-document write.

**Phase 2 — Cluster write gate**
- `cluster-merge.cjs` — prepare (commits worktree, writes pending-approval file) and merge (checks BAL + approved SHA)
- Capture `APPROVE CLUSTERS ADO-{ID}` and `SKIP CLUSTER ADO-{ID} {N}` in approval-capture.cjs
- Gate on writes to worktrees and target_root (table row 3 in migration-gate.cjs)
- Resume guard changes: handle commit_started without merged

**Phase 3 — Skill and rollout**
- SKILL.md: remove model-written approval instructions; add approval grammar in developer prompts
- Step 0 preflight: check both hooks deployed + registered; STOP if not
- `setup-init-bootstrap.cjs`: deploy both hooks and register in target settings.json
- PARTIAL-row rule amendment: named-row acknowledgement via PROCEED
- WCF migration rerun — verify all 15 acceptance criteria

### Should Have
- Subagent hook spike with result recorded before Phase 2 is designed (Phase 0)

### Could Have
- PARTIAL-row row-level acknowledgement at APPROVE DESIGN via PROCEED keyword

### Won't Have
- Per-wave independent judges (F3 — separate work item post v1 rerun)
- SKILL.md size reduction (priority 4 — maintenance, not runtime fix)
- Upgrade and replatform hook reuse (separate work items after v1 proven)

---

## Release Plan

**MVP (Phase 0 + Phase 1):** Fix intake gate bug + block design-doc writes without APPROVE OPTIONS.
Stops the WCF failure class immediately.

**V1 (Phase 2 + Phase 3):** Full cluster gate + skill alignment + WCF rerun verifying all 15 ACs.

---

## Assumptions

[1] PreToolUse hooks fire for tool calls inside subagents in the deployed Claude Code version.
    Status: UNVERIFIED — Phase 0 spike required before Phase 2 is designed.
[2] Exit code 2 from a hook blocks the action (not just logs).
    Status: UNVERIFIED — to be confirmed in Phase 0 spike.
[3] checkpoint-ledger.cjs set-gate writes stage_gates as an object when --artifact-path is supplied.
    Status: VERIFIED (DECISION comment in checkpoint-ledger.cjs lines 88–96).
[4] ADO normalization function is a new shared utility (no existing implementation).
    Status: VERIFIED.

---

## Risks

[1] Subagent hooks — if PreToolUse does not fire in subagents, AC-3 (cluster write gate) falls
    back to the merge path only. Probability: M | Impact: M
[2] Hook timeout/crash lets write through — mitigated by catch-all exit 2; keep re-validation fast.
    Probability: L | Impact: H
[3] Indirect Bash writes (cp, variables) bypass Bash pattern checks — accepted for v1 (model is
    not adversarial; merge path still enforced). Probability: L | Impact: L

---

## Pre-mortem

"This shipped and the WCF rerun still had model-written gates." Most likely failure: the SKILL.md
change (Phase 3) still contains instructions that tell the model to write gate state, or the hook's
Bash block pattern misses a specific node -e form. Mitigation: AC-4 tests every write route
(set-gate, Write, Edit, node -e) in isolation before the rerun.

---

## Dependencies

[1] Fix 1 (tolerant reader) must land before migration-gate.cjs is enabled. Blocking: yes
[2] One-placeholder fix must land before hooks are enabled (dual ledger breaks hook path matching). Blocking: yes
[3] Phase 0 spike result determines AC-3 enforcement strategy. Blocking: yes (for Phase 2)
[4] setup-init-bootstrap.cjs hook deployment (Phase 3) requires hook files to exist in _project-deploy/hooks/. Blocking: yes (for Phase 3)

---

## Open Questions

None — all resolved in docs/plans/migrationSkill/rewrite-hook-gates-v1.md.
