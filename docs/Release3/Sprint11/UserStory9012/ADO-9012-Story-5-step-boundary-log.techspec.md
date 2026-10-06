# Tech Spec — Story 5: Step Boundary Cleanup and Migration Log Scoping
ADO #9012 · Story 5 of 5 · Release 3 · Sprint 11
Status: DRAFT
Depends on: Story 1 (gate structure must be in place)

---

## Overview

Dissolves the standalone Step 8 (judge substrate reference doc) by inlining its content
into Steps 4 and 7 where judge verdicts are actually recorded. Removes the CONTINUE gates
from Steps 8a and 9 so both auto-proceed. Adds artifact validation to Step 9 and a
completion summary listing all created files with their paths. Scopes migration log entries
so that only unanticipated findings and non-obvious choices between multiple approaches
require [FINDING] and [DECISION] entries — routine intake-matched fixes do not require
individual entries. Adds a [RESIDUAL SUMMARY] batch entry at the end of Step 7.

Only `skills/upgrade/SKILL.md` is modified. No scripts changed.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F18 | No standalone Step 8; judge substrate inlined into Steps 4 and 7 | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F19 | Steps 8a and 9 auto-proceed (no CONTINUE gate); Step 9 validates artifacts and shows completion summary | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F20 | [FINDING]+[DECISION] required only for unanticipated finds and non-obvious decisions; routine fixes do not require entries | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F21 | [RESIDUAL SUMMARY] entry written to migration-log.md at end of Step 7 | skills/upgrade/SKILL.md | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| skills/upgrade/SKILL.md | AC-F18, AC-F19, AC-F20, AC-F21 |

**Coverage result:** All 4 ACs covered. No orphaned file changes. ✅

---

## Files Changed

### `skills/upgrade/SKILL.md` — Modify

**Change 1: Dissolve Step 8 (AC-F18)**

Remove the standalone Step 8 section. Inline its content as follows:
- Judge substrate documentation for Step 4 verdicts → inline into Step 4 as a prose note
  immediately before the `set-gate report PASS` call:
  ```
  Judge substrate (Step 4): record the verdict basis for each finding in the gap/risk report.
  Verdicts are recorded per-finding in the report; summary recorded in checkpoint.
  ```
- Judge substrate documentation for Step 7 verdicts → inline into Step 7 as a prose note
  before the [RESIDUAL SUMMARY] entry:
  ```
  Judge substrate (Step 7): per-hop verdicts recorded in upgrade-runbook.md as each hop completes.
  Summary of anticipated vs. unanticipated fixes recorded in migration-log.md ([RESIDUAL SUMMARY]).
  ```

After inlining, no standalone Step 8 heading exists. Steps previously numbered 8a and 9
become steps in the main sequence without CONTINUE gates.

**Change 2: Steps 8a and 9 auto-proceed (AC-F19)**

Remove the CONTINUE gate from the step previously known as 8a (currently: "review and
approve hop execution plan before running tools"). The skill proceeds to tool execution
without waiting for developer input once APPROVE DESIGN has been received.

Step 9 (artifact validation + completion summary) also auto-proceeds:

```
Step 9: Artifact Validation and Completion Summary

Verify each expected artifact exists on disk:
  ✅ / ⛔ docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md
  ✅ / ⛔ docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md
  ✅ / ⛔ docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-decisions.md
  ✅ / ⛔ docs/migrations/<ADO-ID>/ADO-<ADO-ID>-migration-log.md

Completion summary:
  ✅ Upgrade complete — ADO-<ADO-ID>
     Runbook    : docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md
     Intake     : docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md
     Decisions  : docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-decisions.md
     Log        : docs/migrations/<ADO-ID>/ADO-<ADO-ID>-migration-log.md
     Anticipated fixes: N
     Unanticipated fixes: N

If any artifact is missing:
  ⚠ Missing: <path>. Check runbook for the step that was supposed to create it.
```

**Change 3: Migration log scoping (AC-F20)**

Replace the existing per-fix [FINDING]+[DECISION] mandate with a scoped rule:

```
Migration log entries are required for:
  [FINDING]  — a fix that was NOT anticipated by the intake (unexpected find)
  [DECISION] — a non-obvious choice between two or more viable approaches

Migration log entries are NOT required for:
  Routine fixes anticipated by the intake (e.g. package version bumps, API renames
  listed in upgrade-decisions.md). The Write Gate diff is the record for these.
```

This scoped rule is added as a note to the Step 7 section of SKILL.md, replacing the
prior blanket mandate.

**Change 4: [RESIDUAL SUMMARY] entry (AC-F21)**

At the end of Step 7 (after all hops complete), write to migration-log.md:

```
[RESIDUAL SUMMARY]
Date: <YYYY-MM-DD>
ADO: <ADO-ID>
Anticipated fixes: N (matched intake findings; no individual log entries required)
Unanticipated fixes: N (each has a [FINDING] entry above)
Non-obvious decisions: N (each has a [DECISION] entry above)
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Artifact missing at Step 9 validation | ⚠ Missing: <path>. Check runbook. Skill completes (not a hard stop); developer is informed which artifact to check. |
| migration-log.md write fails (disk full) | Skill prints: "Cannot write [RESIDUAL SUMMARY] to migration-log.md: disk full. Free space and append manually." |
| Developer sends CONTINUE during Steps 8a/9 | Keyword is not a recognised gate; skill continues as if not received (no effect) |

---

## Request Flow

```
After APPROVE DESIGN:

[Steps 5-7: hop execution — commands to upgrade-runbook.md]

  For each unanticipated fix during hop execution:
    → write [FINDING] to migration-log.md  [AC-F20]
  For each non-obvious decision:
    → write [DECISION] to migration-log.md  [AC-F20]
  Routine fixes: no log entry (Write Gate diff is the record)

  Judge substrate note (Step 7 inline)  [AC-F18]

  → write [RESIDUAL SUMMARY] to migration-log.md  [AC-F21]

Step 9 (auto-proceed):  [AC-F19]
  → validate artifacts exist on disk
  → print completion summary with counts and paths
  → DONE
```

---

## Rollback

Revert `skills/upgrade/SKILL.md`. No script changes, no test changes.
Run `npm test` after revert to confirm no regressions.

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F18 | Dissolve Step 8; inline judge substrate into Steps 4 and 7 | 1 |
| AC-F19 | Remove Steps 8a+9 CONTINUE gates; add artifact validation + completion summary to Step 9 | 1 |
| AC-F20 | Rewrite migration log mandate to scope entries to unanticipated finds + non-obvious decisions | 0.5 |
| AC-F21 | Add [RESIDUAL SUMMARY] entry at end of Step 7 | 0.5 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — single SKILL.md change; no child ADOs.

---

## Handover

### QA Team

**What was added:**
- Step 8 dissolved; its content inlined into Steps 4 and 7
- Steps 8a and 9 auto-proceed (no CONTINUE gates)
- Step 9 validates all artifacts and prints completion summary
- Migration log entries scoped to unanticipated finds + non-obvious decisions
- [RESIDUAL SUMMARY] entry at end of Step 7

**How to verify:**
1. Grep skills/upgrade/SKILL.md for "Step 8" — confirm no standalone Step 8 heading
2. Run upgrade skill end-to-end; confirm no CONTINUE prompt after APPROVE DESIGN
3. Confirm Step 9 prints artifact validation results and completion summary
4. Run with 2 unanticipated finds; confirm migration-log.md has 2 [FINDING] entries + [RESIDUAL SUMMARY]
5. Run with only routine (intake-matched) fixes; confirm migration-log.md has no per-fix entries, only [RESIDUAL SUMMARY]

**Regression risk:** Steps 4 and 7 are modified (judge substrate inlined) — verify gap/risk
analysis and hop execution still record verdicts correctly in the checkpoint ledger.

### DevOps / Platform Team

No infrastructure changes.

### Future Developer

**To add a new judge verdict type:**
Inline the documentation into the step where the verdict is recorded (Steps 4 or 7).
Do not create a new standalone "reference step" — this pattern is what this story eliminates.

**Migration log format:**
- Routine fix: no entry (diff is the record)
- Unanticipated fix: `[FINDING] <date> — <description of unexpected find + what fixed it>`
- Non-obvious decision: `[DECISION] <date> — <what was decided, options considered, rationale>`
- End of upgrade: `[RESIDUAL SUMMARY] <date> — anticipated N / unanticipated N / decisions N`

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | SKILL.md Step 8 | Grep for standalone "## Step 8" heading | 0 matches | AC-F18 |
| P-U2 | Judge substrate | Grep for judge substrate content in Steps 4 and 7 | Content present inline in both steps | AC-F18 |
| P-U3 | Step 9 artifact validation | Run upgrade skill end-to-end | Each expected artifact shows ✅ or ⛔; completion summary printed | AC-F19 |
| P-U4 | [RESIDUAL SUMMARY] | Run upgrade with 3 routine + 1 unanticipated fix | migration-log.md has 1 [FINDING] + [RESIDUAL SUMMARY] (anticipated: 3, unanticipated: 1) | AC-F20, AC-F21 |
| P-U5 | Routine fix (no log entry) | Run upgrade with all intake-matched fixes | migration-log.md has [RESIDUAL SUMMARY] only (no per-fix entries) | AC-F20 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | No CONTINUE after APPROVE DESIGN | Run upgrade; observe prompts after APPROVE DESIGN | No CONTINUE prompt appears before Steps 8a/9 | AC-F19 |
| N-U2 | Missing artifact at Step 9 | Delete upgrade-intake.md before Step 9 | Step 9 reports ⚠ Missing for that artifact; skill completes (not blocked) | AC-F19 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full upgrade skill run (all stories complete) | Run upgrade skill end-to-end with all 5 stories shipped | 3 gates only; all artifacts validated; completion summary shown; [RESIDUAL SUMMARY] in log | All ACs |
| INT-2 | npm test | Run `npm test` after Story 5 | All tests pass; no regressions | AC-NF4 |

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] `skills/upgrade/SKILL.md` modified: standalone Step 8 removed; judge substrate inlined into Steps 4 and 7
- [ ] `skills/upgrade/SKILL.md` modified: Steps 8a and 9 CONTINUE gates removed; both auto-proceed
- [ ] `skills/upgrade/SKILL.md` modified: Step 9 includes artifact validation for all 4 expected files
- [ ] `skills/upgrade/SKILL.md` modified: Step 9 includes completion summary with file paths and counts
- [ ] `skills/upgrade/SKILL.md` modified: migration log mandate scoped to unanticipated finds + non-obvious decisions
- [ ] `skills/upgrade/SKILL.md` modified: [RESIDUAL SUMMARY] entry written at end of Step 7

**Quality**
- [ ] Grep `skills/upgrade/SKILL.md` for standalone `## Step 8` heading — 0 matches
- [ ] Judge substrate content present inline in both Step 4 and Step 7
- [ ] Run upgrade skill end-to-end — no CONTINUE prompt after APPROVE DESIGN
- [ ] Step 9 prints ✅/⛔ for each of the 4 artifacts and the completion summary
- [ ] Run with 1 unanticipated fix — migration-log.md has [FINDING] + [RESIDUAL SUMMARY]
- [ ] Run with routine-only fixes — migration-log.md has [RESIDUAL SUMMARY] only
- [ ] `npm test` — all tests pass, no regressions

**Review readiness**
- [ ] PR title: `[ADO-9012] Step Boundary Cleanup and Migration Log — dissolve Step 8, scope log entries`
- [ ] PR description maps changes to ACs (AC-F18 through AC-F21)
- [ ] ICEA committed in the same branch

### Reviewer Checklist

- [ ] Confirm no CONTINUE gates exist anywhere in skills/upgrade/SKILL.md after all 5 stories merge (final check)
- [ ] Confirm [RESIDUAL SUMMARY] format matches spec: anticipated/unanticipated/decisions counts
- [ ] Confirm artifact validation at Step 9 checks all 4 expected files (runbook, intake, decisions, log)
- [ ] Confirm completion summary is printed unconditionally (not only on success)

---

## Open Questions

None.

---

## Revision Log

2026-10-03 — Story 5 tech spec drafted. Added Definition of Done (critic REVISE → auto-revised).
