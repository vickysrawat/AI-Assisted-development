# ICEA — Upgrade Skill Simplification
ADO #9012 · Release 3 · Sprint 11
Status: ✅ Approved · EPIC · 22 SP

---

## Intent

### Goal
Reduce the upgrade skill from 14 gates to 3 real decision gates, replace the
hand-authored source-context-manifest with a skill-generated intake document, fix a
fragile research cache shell block in both upgrade and rewrite skills, and eliminate
dead code — so developers complete upgrades faster with less friction and no lost context.

### Problem Statement
The upgrade skill has accumulated 14 gates (11 boilerplate CONTINUE gates borrowed from
the Rewrite skill), requires a hand-authored source-context-manifest.md that adds no
safety for in-place upgrades, uses a fragile 30-line shell block with multiple inline
node -e JSON parsing calls for the research cache, applies Rewrite design ceremony to a
step where architecture does not change, carries dead code (resolve-migration-roots.cjs
output is written but never consumed downstream), and inconsistently calls two different
checkpoint scripts. The result is unnecessary developer friction, inflated session length,
and manual steps that get lost in chat. Success: the upgrade skill completes a clean run
with 3 or fewer required developer replies, a skill-generated intake document, and all
manual steps in a persistent on-disk runbook.

### Business Impact
Every unnecessary CONTINUE gate adds friction and increases the chance a developer
abandons a session mid-upgrade; the hand-authored manifest blocks adoption for new
projects; the fragile shell block breaks on Windows and under context compaction. Removing
these barriers makes the upgrade skill usable for all supported stacks without specialist
knowledge of the skill's internal ceremony.

### Story
As a developer running the upgrade skill, I want a streamlined flow that generates the
intake analysis automatically, surfaces only meaningful decision gates, and keeps manual
steps in a persistent document, so that upgrades complete faster with less friction and
no lost context.

### Success Metrics
- Upgrade skill completes with 3 or fewer mandatory developer replies (INTAKE CONFIRMED, APPROVE REPORT, APPROVE DESIGN); zero CONTINUE gates remain
- Developer never hand-authors any intake document — skill generates upgrade-intake.md automatically via 3-pass detection
- All manual steps written to the upgrade runbook document on disk; none lost to chat scroll
- research-cache.cjs lookup uses exit codes (0 = fresh, 1 = miss, 2 = stale); upgrade and rewrite SKILL.md cache blocks are 10 lines or fewer with no inline node -e parsing

---

## Context

### Personas

**Developer (upgrade user):** Runs /upgrade to bump a project's framework version to a
higher supported version. Currently frustrated by 11 CONTINUE prompts that interrupt flow,
a hand-authored manifest that requires reading every source file, and instructions that get
lost mid-discussion. Success = upgrade completes cleanly in one session with a clear audit
trail and no lost instructions.

**Plugin maintainer:** Must keep skills correct, testable, and maintainable across supported
stacks. Currently frustrated by fragile inline shell scripts that break on Windows and under
context compaction, and by duplicated patterns between upgrade and rewrite skills. Success =
clean, testable, maintainable skill code with consistent abstractions across the migration
skill family.

### System Context

| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| L0 Skill | `skills/upgrade/SKILL.md` | Modify | Remove 11 CONTINUE gates; add intake generation, runbook, decision log, incremental write; dissolve Step 8; consolidate checkpoint calls |
| L0 Skill | `skills/rewrite/SKILL.md` | Modify | Rewrite research-cache lookup block only (30 lines → 10 or fewer) |
| L1 Script | `scripts/research-cache.cjs` | Modify | Add --extract-bundle-to flag; change stale exit code from 0 to 2 |
| L1 Script | `scripts/resolve-migration-roots.cjs` | Remove from upgrade | No longer called by upgrade SKILL.md; removed from required scripts preflight |
| L1 Script | `scripts/upgrade-checkpoint.cjs` | No code change | SKILL.md now routes all checkpoint ops through it; consolidation is SKILL.md-only |
| Test | `tests/research-cache.test.cjs` | Modify | Stale-hit exit code assertion updated from 0 to 2 (line 99) |
| Doc | `docs/plans/migrationSkill/upgrade-skill-simplification.md` | Reference | Planning decisions source; not modified by this ADO |

### Constraint Context

| Constraint | Type | Bounds the solution how? |
|---|---|---|
| Node.js 20+ / CommonJS (.cjs) | Technical | All new scripts must use CommonJS require(); no ESM imports |
| No third-party dependencies | Technical | All scripts use Node.js stdlib only; no npm packages added |
| SKILL.md files are Markdown read by Claude at runtime | Technical | No compilation step; changes take effect immediately on next skill invocation |
| Existing test pattern (custom assert + process.exit) | Technical | New/modified tests follow the same self-contained node script pattern |
| upgrade-checkpoint.cjs owns the upgrade payload namespace | Technical | No direct checkpoint-ledger.cjs calls for upgrade-namespace fields in SKILL.md |
| Intake file written incrementally | Technical | Each finding appended immediately; session compaction must not lose more than one in-flight query result |

### Change Tier
**T2** — Modifies existing skill behaviour and supporting scripts; no new external
dependencies, no schema changes, no database migrations. Rollback = git revert.

---

## Examples

### Happy Path

| Given | When | Then (observable outcome) |
|---|---|---|
| Developer invokes UPGRADE ADO-9012 on a Node.js project targeting a higher major version | Step 1 runs | Skill detects stack and version; confirms target; classifies as upgrade; creates upgrade-runbook.md; no CONTINUE gate shown |
| Intake generation begins (Pass 1) | Skill queries registry for each dependency | Each result appended immediately to upgrade-intake.md; checkpoint ledger records intake_pass=1 and intake_progress_index after each write |
| Pass 1 complete; Passes 2 and 3 run | Skill scans knowledge cache and greps codebase | Intake doc fully populated with all 12 sections; summary banner shows blocker and warning counts |
| Developer reads intake doc | Developer replies INTAKE CONFIRMED ADO-9012 | Skill proceeds to gap/risk analysis; no further intake ceremony |
| APPROVE REPORT ADO-9012 received | Skill generates upgrade-decisions.md | One entry per RED/BLOCKER item only; if none: document states "No architectural decisions required" |
| APPROVE DESIGN ADO-9012 received | Skill runs upgrade-orchestrate.cjs plan | Hop execution commands written to upgrade-runbook.md; skill proceeds to tool execution |

### Edge Cases

| Given | When | Then (expected behaviour) |
|---|---|---|
| Registry unavailable during Pass 1 | Skill attempts package registry query and times out | Package labeled with DEVELOPER REVIEW (registry timeout); Pass 1 continues for remaining packages; intake header notes registry unreachable count |
| Context near capacity before Pass 1 | Skill checks context budget | Developer offered COMPACT path with UPGRADE RESUME recovery command; skill does not start Pass 1 until budget confirmed |
| Session compacted mid-Pass 1 after 20 of 50 packages | Developer resumes with UPGRADE RESUME ADO-9012 | Skill reads existing intake file; reads intake_progress_index from ledger; skips first 20 packages; continues from package 21 |
| All packages compatible; no RED or BLOCKER items in report | Step 4.5 runs | upgrade-decisions.md states "No architectural decisions required — all items are routine fixes"; APPROVE DESIGN prompt shown immediately |
| research-cache lookup returns stale hit (exit 2) | Skill receives exit code 2 | Stale warning printed to chat; bundle used without agent reinvocation; stale reason visible in output |

### Error States

| Given | When | Then (user-visible message and system behaviour) |
|---|---|---|
| Intake file already partially written from a previous run | Developer runs UPGRADE ADO-9012 again | Skill reads existing file; reads intake_progress_index from ledger; resumes from last recorded package; does not restart from scratch |
| All Pass 1 registry queries fail (registry completely down) | Skill cannot resolve any package | Intake header: "Registry unreachable — compatibility check skipped. All packages labeled DEVELOPER REVIEW (registry unavailable). Passes 2 and 3 still run." |
| upgrade-decisions.md write fails due to disk full | Step 4.5 attempts to write | Skill stops: "Cannot write upgrade-decisions.md: disk full. Free space and re-run from UPGRADE RESUME ADO-9012." |
| INTAKE CONFIRMED sent before intake file exists | Developer sends keyword prematurely | upgrade-checkpoint.cjs check-gate exits non-zero; skill reports: "Intake not recorded — generate intake first (Step 1 must complete)" |

### Permission Boundary

| Given | When | Then (observable outcome) |
|---|---|---|
| Claude model generates text containing "INTAKE CONFIRMED ADO-9012" in its response | approval-capture.cjs hook (ADO-9007) intercepts | Gate not recorded — hook requires the phrase to originate from a developer prompt, not model output; self-approval blocked |
| Model attempts self-approval of APPROVE REPORT or APPROVE DESIGN at any gate | Hook intercepts the model-generated text | All three gates blocked; model cannot advance the upgrade skill past any gate without an explicit developer-typed reply |

---

## Acceptance

### Acceptance Criteria

**Must Have — Gate reduction and runbook (Story 1)**
- [ ] AC-F1: `skills/upgrade/SKILL.md` contains exactly 3 mandatory developer reply gates: INTAKE CONFIRMED, APPROVE REPORT, and APPROVE DESIGN; no CONTINUE gates exist anywhere in the skill
- [ ] AC-F2: Skill generates `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md` at Step 1; each subsequent step that produces manual developer actions appends to it; the file is not subject to the Write Gate
- [ ] AC-F3: Tool-not-found in Step 2 is a hard BLOCK that prints install steps to the runbook and chat; skill stops until developer re-invokes; it is not a CONTINUE gate

**Must Have — research-cache redesign (Story 2)**
- [ ] AC-F4: `research-cache.cjs lookup` exits 0 (fresh hit: age 30 days or fewer), 1 (miss: not found, corrupt, or expired), or 2 (stale hit: 30–90 days); the prior exit 0 for stale hits is removed
- [ ] AC-F5: `research-cache.cjs lookup --extract-bundle-to=<file>` writes `entry.bundle` as standalone JSON to the specified file on hit (exit 0 or 2); writes nothing on miss (exit 1)
- [ ] AC-F6: Upgrade SKILL.md cache lookup block is 10 lines or fewer; no `node -e` inline JSON parsing; no intermediate temp result file
- [ ] AC-F7: Rewrite SKILL.md cache lookup block is 10 lines or fewer; no `node -e` inline JSON parsing; no intermediate temp result file; all other rewrite SKILL.md content unchanged

**Must Have — Intake redesign (Story 3)**
- [ ] AC-F8: Skill generates `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md` automatically without developer authoring any content; developer confirms with INTAKE CONFIRMED
- [ ] AC-F9: Intake document contains all 12 sections (0 through 11); every section renders with findings or "Not applicable — evidence: X"; no section is silently skipped
- [ ] AC-F10: Intake document includes a summary banner at the top showing blocker count, migration-required count, behavioral change count, compatible count, and not-applicable section count
- [ ] AC-F11: DEVELOPER REVIEW label includes a reason code: registry timeout, no compatible version, or registry unavailable
- [ ] AC-F12: Intake file written incrementally — each package result appended immediately after its registry query completes; skill does not wait for all queries before writing
- [ ] AC-F13: Checkpoint ledger records `intake_pass` (1, 2, or 3) and `intake_progress_index` before each package query; on UPGRADE RESUME, skill reads these values and skips already-processed packages

**Must Have — Dead code removal and checkpoint consolidation (Story 4, partial)**
- [ ] AC-F14: `resolve-migration-roots.cjs` is not invoked in `skills/upgrade/SKILL.md` and is not listed in the required scripts preflight; dependency repo version constraints surfaced in intake Section 2 instead
- [ ] AC-F15: All checkpoint operations in `skills/upgrade/SKILL.md` route through `upgrade-checkpoint.cjs`; zero direct `checkpoint-ledger.cjs` calls remain in the upgrade skill

**Should Have — Design ceremony replacement and step cleanup (Stories 4 and 5)**
- [ ] AC-F16: Step 4.5 generates `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-decisions.md`; one entry per RED or BLOCKER item from the gap/risk report requiring a migration pattern decision; if no RED or BLOCKER items exist, document states "No architectural decisions required — all items are routine fixes"
- [ ] AC-F17: `target-design-spec.md`, `design-revision-spec.md`, and `graph-derive-documents.cjs` are not referenced in Step 4.5 of the upgrade skill
- [ ] AC-F18: No standalone Step 8 exists in the upgrade skill; judge substrate documentation is inlined into Steps 4 and 7 where judge verdicts are recorded
- [ ] AC-F19: Steps 8a and 9 auto-proceed without a CONTINUE gate; Step 9 includes artifact validation confirming each expected file exists on disk, and a completion summary listing all artifacts with their paths
- [ ] AC-F20: Migration log FINDING and DECISION entries required only for finds not anticipated by the intake, or non-obvious choices between multiple approaches; routine intake-matched fixes do not require individual log entries
- [ ] AC-F21: A RESIDUAL SUMMARY entry is written to migration-log.md at the end of Step 7 containing the count of anticipated fixes and the count of unanticipated fixes

**Non-functional**
- [ ] AC-NF1: Context budget check fires before Pass 1 begins; if context is near capacity, developer is offered the COMPACT path with UPGRADE RESUME as the recovery command; skill does not start Pass 1 until budget is confirmed
- [ ] AC-NF2: `node tests/research-cache.test.cjs` passes after the exit code change; the stale-hit assertion updated from `stale.code === 0` to `stale.code === 2`; all other assertions unchanged
- [ ] AC-NF3: `node tests/upgrade-checkpoint.test.cjs` passes unchanged; no contract change to the upgrade-checkpoint interface
- [ ] AC-NF4: `npm test` passes — all existing tests green; no regressions introduced

### Out of Scope
- We will NOT create per-stack knowledge files (java-upgrade.md, angular-upgrade.md, react-upgrade.md, nodejs-upgrade.md, python-upgrade.md, or the dotnet-upgrade.md behavioral_changes section) — these are follow-up ADO work; intake structure must land first
- We will NOT modify the replatform skill — confirmed it does not use research-cache.cjs; no changes required
- We will NOT add new registry endpoint implementations — registry endpoint format per stack is defined in per-stack knowledge files, which are follow-up work
- We will NOT change the rewrite skill's overall gate structure, intake flow, or any section beyond the research-cache lookup block replacement

### Assumptions
- All 8 planning decisions are final, documented in `docs/plans/migrationSkill/upgrade-skill-simplification.md` — **verified**
- Per-stack knowledge file creation is out of scope for this ADO — **verified**
- rewrite SKILL.md research-cache block rewrite is in scope as Must Have, in the same story as the script change — **verified**
- The existing `upgrade-classify.cjs` false-upgrade detection in Step 1 remains unchanged — **verified**

### Open Questions
None — planning session complete. All decisions captured in planning doc.

### Risks & Pre-Mortem

| Risk | Probability | Impact |
|---|---|---|
| research-cache exit code change breaks one test assertion | Certain | L — 1-line fix, known location: tests/research-cache.test.cjs line 99 |
| Registry queries time out or are rate-limited during Pass 1 | M | M — mitigated: concurrency cap, per-package timeout, reason-coded labels, incremental write, context check before pass |
| 12-section intake overwhelms developer on first encounter | M | L — mitigated: summary banner, INTAKE CONFIRMED prompt enumerates confirmations, incremental write makes doc readable mid-generation |
| Resume mechanics require accurate pass and index tracking in ledger | L | M — mitigated: intake_pass and intake_progress_index recorded before each query; on resume skill reads and skips correctly |

**Pre-mortem:** Not applicable — no auth, payments, or irreversible data changes. All changes are Markdown instruction files and Node.js scripts; rollback is a git revert. Most likely failure mode: intake incremental write has an off-by-one in progress_index causing one package to be re-queried on resume, which is harmless as the result overwrites with the same value.

### Dependencies
- Blocked by: None — planning complete
- Blocks: F-1 per-stack knowledge files (those cannot be tested without the intake structure this ADO defines)

### Irreversibility Flags
None identified — all changes are reversible via git revert.

### D-Blocks
None — all architectural decisions resolved in the planning session on 2026-10-03. See `docs/plans/migrationSkill/upgrade-skill-simplification.md` for the full decision record.

---

## Story Breakdown

**Type:** EPIC
**Total SP:** 22

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | TBD | Developer runs upgrade skill with zero CONTINUE gates; all manual steps in upgrade-runbook.md | 3 | Yes | None | ⏳ Pending |
| 2 | TBD | research-cache.cjs uses exit codes 0/1/2 plus --extract-bundle-to; upgrade and rewrite SKILL.md cache blocks rewritten | 3 | Yes | None | ⏳ Pending |
| 3 | TBD | Skill auto-generates upgrade-intake.md via 3-pass detection, 12 sections, incremental write, and resume support | 8 | Yes — replaces source-context-manifest | Story 1 gate structure must be in place | ⏳ Pending |
| 4 | TBD | Step 4.5 replaced with decision log; resolve-migration-roots.cjs removed; all checkpoint ops through upgrade-checkpoint.cjs | 5 | Yes | Story 1 | ⏳ Pending |
| 5 | TBD | Step 8 dissolved into Steps 4 and 7; Steps 8a and 9 auto-proceed; migration log scoped to non-routine finds only | 3 | Yes | Story 1 | ⏳ Pending |

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---

### Revision Log
2026-10-03 — ICEA drafted from planning session (upgrade-skill-simplification.md, 2026-10-03). All 8 planning decisions incorporated. Critic: PASS WITH NOTES (permission boundary documented as hook-enforced gate approval constraint from ADO-9007). Curly-brace placeholders replaced with angle-bracket notation to avoid context-budget hook false positive.
2026-10-03 — Approved (EPIC · 22 SP · 5 stories · Tech Spec package complete · Test Plan skeleton generated)
