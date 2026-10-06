# Epic Tech Spec — Upgrade Skill Simplification
ADO #9012 · Release 3 · Sprint 11
Status: DRAFT · EPIC · 22 SP total

---

## Overview

This epic streamlines the upgrade skill from 14 interaction gates to 3 real decision gates
(INTAKE CONFIRMED · APPROVE REPORT · APPROVE DESIGN), replaces the hand-authored
source-context-manifest.md with a skill-generated upgrade-intake.md (3-pass detection:
registry + knowledge cache + codebase grep), redesigns the research-cache.cjs exit codes
to be unambiguous (0=fresh / 1=miss / 2=stale), adds an --extract-bundle-to flag, rewrites
the fragile 30-line shell cache-lookup block in both upgrade and rewrite SKILL.md to 10
lines or fewer, and eliminates dead code (resolve-migration-roots.cjs removed from upgrade,
Step 4.5 design ceremony replaced with a lightweight decisions doc). All manual developer
actions are written to an upgrade-runbook.md document on disk rather than lost to chat
scroll. The epic does NOT add per-stack knowledge files (follow-up F-1), does NOT modify
the replatform skill, and does NOT change the rewrite skill beyond the research-cache block.

All changed artefacts are either Markdown SKILL.md files (read by Claude at runtime, no
compilation) or Node.js CommonJS scripts (.cjs). Rollback at any point is git revert.

---

## Story Breakdown

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Gate Reduction and Runbook | 3 | Yes | None | [ADO-9012-Story-1-tech.md]() | ⏳ Pending |
| 2 | research-cache Redesign | 3 | Yes | None | [ADO-9012-Story-2-tech.md]() | ⏳ Pending |
| 3 | Intake Redesign | 8 | Yes | Story 1 (gate structure) | [ADO-9012-Story-3-tech.md]() | ⏳ Pending |
| 4 | Dead Code, Checkpoint, Step 4.5 | 5 | Yes | Story 1 | [ADO-9012-Story-4-tech.md]() | ⏳ Pending |
| 5 | Step Boundary Cleanup and Migration Log | 3 | Yes | Story 1 | [ADO-9012-Story-5-tech.md]() | ⏳ Pending |

> Stories 1 and 2 are independent; Stories 3, 4, and 5 depend on Story 1's gate structure.
> Stories 3, 4, and 5 can be implemented in parallel once Story 1 ships.

---

## Auth & Security

This epic modifies developer-tooling artefacts only (SKILL.md Markdown files and Node.js
.cjs scripts). No end-user authentication, no PII, no regulated data.

**Self-approval prevention:** The three developer reply gates (INTAKE CONFIRMED · APPROVE
REPORT · APPROVE DESIGN) are enforced by the approval-capture.cjs hook (ADO-9007). The
hook requires the gate keyword to originate from a developer prompt — model-generated text
containing these phrases is intercepted and rejected. This is an existing cross-cutting
control; this epic does not change it.

**Cross-cutting security concerns:**

| Concern | Mitigation |
|---|---|
| Gate keywords in model output | approval-capture.cjs hook (ADO-9007) blocks self-approval; applies to all 3 gates |
| Registry queries in Pass 1 | No credentials used; read-only public registry endpoints; timeout per package; capped concurrency |
| Disk writes during intake | Incremental append only; no delete/overwrite of existing content; checkpoint ledger records progress |

---

## Overall Request Flow

The upgrade skill orchestration across all 5 stories:

```
Developer: UPGRADE ADO-<id>
  → Claude reads skills/upgrade/SKILL.md   [Story 1: gate structure]

Step 1: Classify, detect stack/version
  → upgrade-classify.cjs  [unchanged]
  → Create upgrade-runbook.md on disk  [Story 1: AC-F2]
  → Preflight tools check (hard BLOCK on missing tools)  [Story 1: AC-F3]

Step 2: Research cache lookup
  → node scripts/research-cache.cjs lookup --stack=X --from=Y --to=Z
        --extract-bundle-to=cache-bundle.json  [Story 2: AC-F4, AC-F5]
  → Exit 0 (fresh hit): use bundle
  → Exit 1 (miss): no bundle, proceed to agent reinvoke
  → Exit 2 (stale hit): print stale warning, use bundle  [Story 2: AC-F4]

Step 3: 3-pass intake generation  [Story 3]
  → Context budget check  [AC-NF1]
  → Pass 1: registry query per package → append to upgrade-intake.md  [AC-F8, AC-F12]
  → Pass 2: knowledge cache replacement mapping  [AC-F9]
  → Pass 3: grep codebase against behavioral change patterns  [AC-F9]
  → Summary banner written to upgrade-intake.md  [AC-F10]
  → upgrade-checkpoint.cjs intake-verify  [AC-F13]

Developer: INTAKE CONFIRMED ADO-<id>  [hook-enforced gate, Story 1: AC-F1]

Step 4: Gap/risk analysis (judge substrate inlined)  [Story 5: AC-F18]
  → upgrade-checkpoint.cjs set-gate report PASS

Developer: APPROVE REPORT ADO-<id>  [hook-enforced gate, Story 1: AC-F1]

Step 4.5: upgrade-decisions.md generation  [Story 4: AC-F16]
  → One entry per RED/BLOCKER item only

Developer: APPROVE DESIGN ADO-<id>  [hook-enforced gate, Story 1: AC-F1]

Steps 5-7: Hop execution via upgrade-orchestrate.cjs
  → Commands written to upgrade-runbook.md  [Story 1: AC-F2]
  → [RESIDUAL SUMMARY] entry in migration-log.md at end of Step 7  [Story 5: AC-F21]

Step 9: Artifact validation + completion summary  [Story 5: AC-F19]
  → Auto-proceed (no CONTINUE gate)
```

---

## Rollback

**Schema migrations:** None — no database changes.

**Rollback procedure:**
1. `git revert <commit>` for any story — each story's changes are in SKILL.md and/or .cjs scripts, fully reversible
2. If research-cache.cjs is reverted, also revert tests/research-cache.test.cjs line 99 (stale.code assertion)
3. Run `npm test` to verify no regressions after revert

**Per-story rollback:** Each story tech spec contains story-level rollback detail.
**Irreversibility:** None — confirmed in ICEA.

---

## Handover

### QA Team

**What was added (across all stories):**
- Upgrade skill runs with exactly 3 developer replies: INTAKE CONFIRMED · APPROVE REPORT · APPROVE DESIGN
- upgrade-intake.md auto-generated (3-pass detection)
- upgrade-runbook.md persists all manual steps on disk
- upgrade-decisions.md generated for RED/BLOCKER items only
- research-cache.cjs has unambiguous exit codes 0/1/2

**Test entry points:**

| Story | How to verify |
|---|---|
| 1 | Run upgrade skill on a sample project; confirm only 3 developer reply prompts appear; verify upgrade-runbook.md exists after Step 1 |
| 2 | Run `node scripts/research-cache.cjs lookup --stack=dotnet --from=6 --to=8 --extract-bundle-to=out.json`; verify exit code and file |
| 2 | Run `node tests/research-cache.test.cjs`; all assertions pass including stale-hit = exit 2 |
| 3 | Run upgrade skill; verify upgrade-intake.md is created with all 12 sections and a summary banner; simulate compaction and resume |
| 4 | Verify `resolve-migration-roots.cjs` is not called during upgrade skill run; verify upgrade-decisions.md is created with one entry per RED/BLOCKER |
| 5 | Verify no standalone Step 8 prompt; verify artifact validation runs and lists all created files at end of Step 9 |

**Regression risk:** Rewrite skill cache lookup block is modified — verify rewrite skill still correctly invokes research-cache.cjs and handles all 3 exit codes after Story 2 ships.

**Test data:** Any project with a package.json or .csproj targeting a lower version of a supported framework. No sensitive data required — plugin operates on developer project metadata only.

### DevOps / Platform Team

No Azure App Config changes, Key Vault secrets, environment variables, Docker/AKS changes,
pipeline changes, DB migrations, or health check impact.

| Item | Story | Detail |
|---|---|---|
| npm test | Stories 2, 4 | Run after each script change; `node tests/research-cache.test.cjs` and `node tests/upgrade-checkpoint.test.cjs` must pass |

### Future Developer — Follow-on Work

The primary follow-on is **F-1: Per-stack knowledge files** (see ICEA Out of Scope).

The intake structure this epic defines is stack-agnostic. Adding a new stack:
1. Create `skills/shared/migration-knowledge/refs/mappings/<stack>-upgrade.md` with:
   - Registry endpoint (Pass 1 URL pattern)
   - Replacement mappings for SDK renames/merges (Pass 2)
   - Behavioral change patterns with detection grep + required action (Pass 3)
   - Which of the 12 intake sections apply to this stack
2. No SKILL.md changes needed — the skill reads the per-stack file at runtime

Known gap: dotnet-upgrade.md is missing the `behavioral_changes` section (update in F-1).

---

## Definition of Done — Epic

The epic is done when ALL of the following are true:

**Delivery**
- [ ] All 5 story tech specs generated and saved (tracker shows all ✅)
- [ ] All stories implemented, reviewed, and merged (tracker Child ADO # filled)
- [ ] All child ADOs closed in Azure DevOps

**Quality**
- [ ] `node tests/research-cache.test.cjs` passes (stale-hit exit code = 2)
- [ ] `node tests/upgrade-checkpoint.test.cjs` passes unchanged
- [ ] `npm test` passes — all existing tests green, no regressions
- [ ] Upgrade skill runs with exactly 3 mandatory developer replies end-to-end
- [ ] upgrade-runbook.md persists manual steps on disk (not in chat only)
- [ ] upgrade-intake.md auto-generated with all 12 sections and summary banner
- [ ] Rewrite skill cache lookup block ≤10 lines, no node -e inline parsing

**Review**
- [ ] Epic tech spec reviewed by Tech Lead and Product
- [ ] Each story PR maps changed files to ACs (AC Coverage Matrix)
- [ ] ICEA and all story tech specs committed in the feature branch

---

## Reviewer Checklist

- [ ] Story 1: confirm 0 CONTINUE gates remain in skills/upgrade/SKILL.md
- [ ] Story 2: confirm research-cache.cjs exits 0/1/2 only (no other exit paths)
- [ ] Story 2: confirm both upgrade and rewrite SKILL.md cache blocks are ≤10 lines
- [ ] Story 3: confirm upgrade-intake.md has all 12 sections; no section silently skipped
- [ ] Story 3: confirm intake_pass and intake_progress_index written to ledger before each query
- [ ] Story 4: confirm resolve-migration-roots.cjs not invoked or listed in preflight
- [ ] Story 4: confirm all checkpoint calls in SKILL.md route through upgrade-checkpoint.cjs
- [ ] Story 5: confirm no standalone Step 8; Steps 8a and 9 auto-proceed
- [ ] All stories: `npm test` passes after each merge

---

## Open Questions

None — all planning decisions resolved. See docs/plans/migrationSkill/upgrade-skill-simplification.md.

---

## Revision Log

2026-10-03 — Epic tech spec drafted from approved ICEA (ADO-9012, 22 SP, 5 stories).
             Stack: nodejs/javascript (plugin dev repo). No overlay (base only).
             Critic: PASS (no concerns at epic level).
