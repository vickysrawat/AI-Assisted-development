# Feature Plan — Upgrade Skill Simplification
ADO #9012 · Release 3 · Sprint 11
Status: DRAFT

---

## Problem Statement

The upgrade skill has accumulated 14 gates (11 boilerplate CONTINUE gates borrowed from
the Rewrite skill), requires a hand-authored source-context-manifest.md that adds no
safety for in-place upgrades, uses a fragile 30-line shell block with multiple inline
node -e JSON parsing calls for the research cache, applies Rewrite design ceremony
(target-design-spec.md, design-revision-spec.md) to a step where architecture does not
change, carries dead code (resolve-migration-roots.cjs output is written but never
consumed downstream), and inconsistently calls two different checkpoint scripts. The
result is unnecessary developer friction, inflated session length, and manual steps that
get lost in chat. Success: the upgrade skill completes a clean run with ≤ 3 required
developer replies, a skill-generated intake document, and all manual steps in a
persistent on-disk runbook.

---

## Story

As a developer running the upgrade skill, I want a streamlined flow that generates
the intake analysis automatically, surfaces only meaningful decision gates, and keeps
manual steps in a persistent document, so that upgrades complete faster with less
friction and no lost context.

---

## Personas

**Developer (upgrade user):** runs /upgrade to bump a project's framework version;
frustrated by 11 CONTINUE prompts and hand-authored manifests; success = upgrade
completes cleanly with clear audit trail and no lost instructions.

**Plugin maintainer:** must keep skills correct and testable; frustrated by fragile
inline shell scripts and duplicated patterns; success = clean, testable, maintainable
skill code with consistent abstractions.

---

## Feature Priority (MoSCoW)

### Must Have
- Remove 11 boilerplate CONTINUE gates; keep 3 real gates (INTAKE CONFIRMED · APPROVE REPORT · APPROVE DESIGN)
- Replace source-context-manifest with skill-generated upgrade-intake.md (3-pass: registry + cache + grep)
- Write upgrade-runbook.md for persistent manual developer actions
- Fix research-cache.cjs exit codes (0=fresh/1=miss/2=stale) + --extract-bundle-to flag
- Remove resolve-migration-roots.cjs from upgrade
- Consolidate all checkpoint calls through upgrade-checkpoint.cjs
- Rewrite SKILL.md research-cache block rewrite (ships with script change — same story; leaving rewrite on old pattern after script changes would be a broken state)

### Should Have
- Replace Step 4.5 design ceremony with lightweight upgrade-decisions.md (one entry per RED/BLOCKER item)
- Dissolve Step 8 (reference doc) into Steps 4+7; remove Steps 8a+9 CONTINUE gates
- Scope migration log entries to unanticipated finds + non-obvious decisions; add [RESIDUAL SUMMARY] batch entry

### Could Have
(none this iteration)

### Won't Have
(see Follow-up Items)

---

## Release Plan

**MVP:** Developer can run the upgrade skill end-to-end with ≤ 3 required replies,
a skill-generated intake doc, and all manual steps in a persistent runbook.

**V1:** Same + research-cache redesign applied to both upgrade and rewrite skills;
decision log replaces design ceremony; migration log scoped correctly.

---

## Assumptions

[1] All 8 planning decisions are final — documented in
    docs/plans/migrationSkill/upgrade-skill-simplification.md — verified
[2] Per-stack knowledge file creation is out of scope for this ADO — verified
[3] rewrite SKILL.md research-cache block rewrite is in scope (promoted to Must Have) — verified

---

## Risks

[1] research-cache exit code change (0→2 for stale) breaks one test assertion —
    Probability: certain | Impact: L (1-line fix, known location: tests/research-cache.test.cjs line 99)

[2] Registry queries may time out or be rate-limited (Pass 1, ~N calls per project) —
    Probability: M | Impact: M
    Mitigations:
    - Concurrency-capped with per-package timeout
    - DEVELOPER REVIEW label carries reason code: (registry timeout) vs
      (no compatible version) vs (registry unavailable) — different actions required
    - Intake file written incrementally — compaction loses at most one in-flight query
    - Context budget check before Pass 1 begins; COMPACT path offered if near capacity
    - If all registry calls fail: note "registry unreachable — compatibility check
      skipped" in intake header; Passes 2+3 still run

[3] 12-section intake may overwhelm developer on first encounter —
    Probability: M | Impact: L
    Mitigations:
    - Summary banner at top of intake doc:
      ⛔ N blockers · ⚠ N migration required · ⚠ N behavioral changes · ✅ N compatible · N sections not applicable
    - INTAKE CONFIRMED prompt enumerates exactly what developer is confirming
      (baseline correct · statuses correct · not-applicable evidence holds)
    - Incremental write means document is readable even mid-generation
    - Sections 0–2 (anchors) orient developer before risk sections 3–11

[4] Resume mechanics — checkpoint ledger must track pass + package index —
    Probability: L (well-defined pattern) | Impact: M if not implemented
    Mitigation: intake_pass + intake_progress_index recorded in ledger payload
    before each package query; on resume skill reads both and skips to correct position

---

## Pre-mortem

Not applicable — no auth, payments, or irreversible data changes. Skill changes are
Markdown instruction files and Node.js scripts; rollback is a git revert.

---

## Dependencies

[1] docs/plans/migrationSkill/upgrade-skill-simplification.md — all decisions
    documented; Owner: self | Blocking: no (already complete)

---

## Open Questions

None — planning session complete. All decisions captured in planning doc.

---

## Follow-up Items (not in this ADO — captured for next sprint planning)

### F-1: Per-stack knowledge files

Context: The upgrade intake (3-pass detection) is stack-agnostic — SKILL.md defines
what to detect; per-stack knowledge files define how. New stacks get support by adding
a knowledge file, not by modifying SKILL.md.

Current state: Only dotnet-upgrade.md exists (partial — missing behavioral_changes
section). Five stacks need new files.

Files needed:
- skills/shared/migration-knowledge/refs/mappings/java-upgrade.md      (new)
- skills/shared/migration-knowledge/refs/mappings/angular-upgrade.md   (new)
- skills/shared/migration-knowledge/refs/mappings/react-upgrade.md     (new)
- skills/shared/migration-knowledge/refs/mappings/nodejs-upgrade.md    (new)
- skills/shared/migration-knowledge/refs/mappings/python-upgrade.md    (new)
- skills/shared/migration-knowledge/refs/mappings/dotnet-upgrade.md    (update — add behavioral_changes section)

Each file provides per-version-hop entries for: registry endpoint, replacement
mappings (package renames/SDK merges), behavioral change patterns (detection grep +
required action), and which of the 12 intake sections apply to this stack.

Dependency: This ADO (intake structure must land first).
Effort: ~2 SP per stack file; ~12 SP total.
Risk: Knowledge accuracy — behavioral change patterns require validation against
official release notes for each stack + target version.

### F-2: Replatform skill — confirmed no changes required

Confirmed: replatform SKILL.md does not use research-cache.cjs. No follow-up needed.
