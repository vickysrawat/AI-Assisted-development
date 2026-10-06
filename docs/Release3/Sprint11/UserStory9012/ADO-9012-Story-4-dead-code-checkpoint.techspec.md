# Tech Spec — Story 4: Dead Code Removal, Checkpoint Consolidation, Step 4.5
ADO #9012 · Story 4 of 5 · Release 3 · Sprint 11
Status: DRAFT
Depends on: Story 1 (gate structure must be in place)

---

## Overview

Removes `resolve-migration-roots.cjs` from the upgrade skill's required scripts preflight
and SKILL.md invocation (the script is never called; its output — migrationRoots — is written
to the ledger and settings.local.json but consumed by no downstream upgrade step). Consolidates
all checkpoint operations in `skills/upgrade/SKILL.md` through `upgrade-checkpoint.cjs`,
eliminating any remaining direct `checkpoint-ledger.cjs` calls. Replaces the Step 4.5 design
ceremony (target-design-spec.md, design-revision-spec.md, graph-derive-documents.cjs) with a
lightweight `upgrade-decisions.md` — one entry per RED or BLOCKER item requiring a migration
pattern decision.

Only `skills/upgrade/SKILL.md` is modified. `resolve-migration-roots.cjs` itself is not
deleted (other skills may use it); it is simply not invoked by the upgrade skill.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F14 | resolve-migration-roots.cjs not invoked; not in required scripts preflight | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F15 | All checkpoint ops route through upgrade-checkpoint.cjs; zero direct checkpoint-ledger.cjs calls | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F16 | Step 4.5 generates upgrade-decisions.md; one entry per RED/BLOCKER; if none: "No architectural decisions required" | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F17 | target-design-spec.md, design-revision-spec.md, graph-derive-documents.cjs not referenced in Step 4.5 | skills/upgrade/SKILL.md | ✅ Covered |
| AC-NF3 | node tests/upgrade-checkpoint.test.cjs passes unchanged; no contract change | tests/upgrade-checkpoint.test.cjs | ✅ Covered |
| AC-NF4 | npm test passes — no regressions | tests/ (all) | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| skills/upgrade/SKILL.md | AC-F14, AC-F15, AC-F16, AC-F17 |
| tests/upgrade-checkpoint.test.cjs | AC-NF3 (no change — verified by running test unchanged) |

**Coverage result:** All 6 ACs covered. No orphaned file changes. ✅

Note: `tests/upgrade-checkpoint.test.cjs` is listed because AC-NF3 requires verifying it
passes unchanged — it is NOT modified in this story.

---

## Files Changed

### `skills/upgrade/SKILL.md` — Modify

**Change 1: Remove resolve-migration-roots.cjs (AC-F14)**

Remove the invocation block:
```bash
# Remove this block entirely:
node scripts/resolve-migration-roots.cjs --ado=<ADO-ID> ...
```

Remove `resolve-migration-roots.cjs` from the required scripts preflight list (Step 1).

The dependency repo version constraints that this script was intended to surface are now
addressed in the intake Section 2 (upgrade path / version coupling) generated in Story 3.
No functional gap — the data is surfaced via the intake 3-pass process.

**Change 2: Consolidate checkpoint calls (AC-F15)**

Audit all `checkpoint-ledger.cjs` direct calls remaining in SKILL.md and replace each with
the equivalent `upgrade-checkpoint.cjs` subcommand:

| Current direct call | Replace with |
|---|---|
| `node scripts/checkpoint-ledger.cjs set --key=... --value=...` | `node scripts/upgrade-checkpoint.cjs set-field --ado=<ADO-ID> --key=... --value=...` |
| `node scripts/checkpoint-ledger.cjs get --key=...` | `node scripts/upgrade-checkpoint.cjs get-field --ado=<ADO-ID> --key=...` |

No new functionality — purely a routing change. upgrade-checkpoint.cjs already wraps
checkpoint-ledger.cjs; this change removes the direct bypass.

**Change 3: Replace Step 4.5 design ceremony (AC-F16, AC-F17)**

Remove references to:
- target-design-spec.md
- design-revision-spec.md
- graph-derive-documents.cjs

Replace the Step 4.5 section with:

```
Step 4.5 — Upgrade Decisions Document

For each item in the gap/risk report with status RED or BLOCKER that requires a
migration pattern decision (not a routine find):

  Write one entry to docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-decisions.md:
  ---
  ## Decision: <package or API name>
  Status: RED / BLOCKER
  Finding: <what was found in the report>
  Options:
    A) <option> — tradeoffs
    B) <option> — tradeoffs
  Recommended: <A or B> — <rationale>
  ---

If no RED or BLOCKER items exist:
  Write to upgrade-decisions.md: "No architectural decisions required — all items are routine fixes."

This document is a migration artefact (exempt from the Write Gate).
Proceed to APPROVE DESIGN gate.
```

The design ceremony artefacts (target-design-spec.md, design-revision-spec.md) are NOT
generated for upgrade — architecture does not change in an in-place version upgrade.
graph-derive-documents.cjs is not invoked.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| upgrade-decisions.md write fails (disk full) | Skill stops: "Cannot write upgrade-decisions.md: disk full. Free space and run UPGRADE RESUME ADO-<ADO-ID>." |
| No RED or BLOCKER items in gap/risk report | upgrade-decisions.md states "No architectural decisions required — all items are routine fixes."; APPROVE DESIGN prompt shown immediately |
| Direct checkpoint-ledger.cjs call detected (review) | Not a runtime error — this is a static SKILL.md audit; all direct calls are removed before ship |

---

## Request Flow

```
After INTAKE CONFIRMED:

Step 4: Gap/risk analysis (judge substrate inlined — see Story 5)
  → upgrade-checkpoint.cjs set-gate report PASS  [AC-F15: through upgrade-checkpoint]

APPROVE REPORT gate

Step 4.5: upgrade-decisions.md generation
  For each RED/BLOCKER item:
    → write decision entry to upgrade-decisions.md
  If none:
    → write "No architectural decisions required..."
  → upgrade-checkpoint.cjs set-gate design PASS  [AC-F15: through upgrade-checkpoint]

APPROVE DESIGN gate
```

---

## Rollback

Revert `skills/upgrade/SKILL.md`. No script changes, no test changes.
`resolve-migration-roots.cjs` is not deleted — no file restoration needed.
Run `npm test` + `node tests/upgrade-checkpoint.test.cjs` after revert.

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F14 | Remove resolve-migration-roots.cjs from SKILL.md invocation and preflight | 0.5 |
| AC-F15 | Audit and replace all direct checkpoint-ledger.cjs calls with upgrade-checkpoint.cjs | 1 |
| AC-F16, AC-F17 | Replace Step 4.5 design ceremony with upgrade-decisions.md generation | 2.5 |
| AC-NF3, AC-NF4 | Run tests/upgrade-checkpoint.test.cjs and npm test to confirm no regressions | 1 |
| **Total** | | **5** |

**Total SP: 5**
**Type: STORY** — single SKILL.md change; no child ADOs.

---

## Handover

### QA Team

**What was added:**
- resolve-migration-roots.cjs no longer called during upgrade skill
- All checkpoint operations go through upgrade-checkpoint.cjs
- Step 4.5 generates upgrade-decisions.md (one entry per RED/BLOCKER; "No decisions required" if none)

**How to verify:**
1. Run upgrade skill; confirm resolve-migration-roots.cjs is never invoked (no log entry)
2. Grep skills/upgrade/SKILL.md for `checkpoint-ledger.cjs` — should be 0 matches
3. Grep skills/upgrade/SKILL.md for `target-design-spec.md` and `design-revision-spec.md` — 0 matches
4. Run `node tests/upgrade-checkpoint.test.cjs` — all pass, unchanged
5. Run upgrade skill with 2 BLOCKER items in report; verify upgrade-decisions.md has 2 entries
6. Run upgrade skill with no RED/BLOCKER items; verify upgrade-decisions.md says "No architectural decisions required"

**Regression risk:** upgrade-checkpoint.cjs interface is not changed (AC-NF3). If any
checkpoint calls were missed in the audit, they would break at runtime — verify with a full
upgrade skill run.

### DevOps / Platform Team

No infrastructure changes.

### Future Developer

**Adding a new checkpoint field for the upgrade namespace:**
Always use `upgrade-checkpoint.cjs` — never call `checkpoint-ledger.cjs` directly from
`skills/upgrade/SKILL.md`. upgrade-checkpoint.cjs is the exclusive interface for the
upgrade payload namespace.

**upgrade-decisions.md format:**
One `## Decision:` H2 per item. The ICEA-implement skill reads this file during Step 5
(hop execution) to know which items require a specific migration pattern vs. routine fix.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | SKILL.md preflight | Grep for resolve-migration-roots in upgrade SKILL.md | 0 matches | AC-F14 |
| P-U2 | SKILL.md checkpoint calls | Grep for checkpoint-ledger.cjs in upgrade SKILL.md | 0 matches | AC-F15 |
| P-U3 | SKILL.md Step 4.5 | Grep for target-design-spec.md in upgrade SKILL.md | 0 matches | AC-F17 |
| P-U4 | upgrade-decisions.md (with RED items) | Run with 2 BLOCKER findings | File has 2 ## Decision entries | AC-F16 |
| P-U5 | upgrade-decisions.md (no RED items) | Run with all ✅ items | File says "No architectural decisions required" | AC-F16 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | upgrade-checkpoint.cjs test | Run tests/upgrade-checkpoint.test.cjs | All assertions pass; no interface change | AC-NF3 |
| N-U2 | Disk full scenario | Mock disk-full write attempt | Skill stops with descriptive message; UPGRADE RESUME recovery command shown | AC-F16 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | npm test after Story 4 | Run `npm test` | All tests pass; no regressions | AC-NF4 |
| INT-2 | Full upgrade skill run | Run upgrade skill end-to-end on sample project | No resolve-migration-roots invocation; checkpoint-ledger.cjs not called directly; upgrade-decisions.md generated | AC-F14, AC-F15, AC-F16 |

> AC-NF3 verification: `node tests/upgrade-checkpoint.test.cjs` — all assertions pass without any modification to the test file.
> AC-NF4 verification: `npm test` — zero failures.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] `skills/upgrade/SKILL.md` modified: `resolve-migration-roots.cjs` invocation removed
- [ ] `skills/upgrade/SKILL.md` modified: `resolve-migration-roots.cjs` removed from required scripts preflight
- [ ] `skills/upgrade/SKILL.md` modified: all `checkpoint-ledger.cjs` direct calls replaced with `upgrade-checkpoint.cjs` equivalents
- [ ] `skills/upgrade/SKILL.md` modified: Step 4.5 design ceremony replaced with `upgrade-decisions.md` generation
- [ ] `skills/upgrade/SKILL.md` modified: references to target-design-spec.md, design-revision-spec.md, graph-derive-documents.cjs removed

**Quality**
- [ ] Grep `skills/upgrade/SKILL.md` for `resolve-migration-roots` — 0 matches
- [ ] Grep `skills/upgrade/SKILL.md` for `checkpoint-ledger.cjs` — 0 matches
- [ ] Grep `skills/upgrade/SKILL.md` for `target-design-spec.md` — 0 matches
- [ ] `node tests/upgrade-checkpoint.test.cjs` — all tests pass (unchanged)
- [ ] `npm test` — all tests pass, no regressions
- [ ] upgrade-decisions.md generated with correct entries in test run

**Review readiness**
- [ ] PR title: `[ADO-9012] Dead Code, Checkpoint Consolidation, Step 4.5 — remove roots, consolidate checkpoint`
- [ ] PR description maps changes to ACs (AC-F14 through AC-F17, AC-NF3, AC-NF4)
- [ ] ICEA committed in the same branch

### Reviewer Checklist

- [ ] Confirm `resolve-migration-roots.cjs` file still exists in scripts/ (not deleted — other skills may use it)
- [ ] Confirm all checkpoint calls in SKILL.md use `upgrade-checkpoint.cjs` (no direct calls remain)
- [ ] Confirm `upgrade-checkpoint.cjs` interface is unchanged (no new subcommands added without test coverage)
- [ ] Confirm upgrade-decisions.md format: `## Decision:` H2 per item, or "No architectural decisions required" if none

---

## Open Questions

None.

---

## Revision Log

2026-10-03 — Story 4 tech spec drafted. Added Definition of Done (critic REVISE → auto-revised).
