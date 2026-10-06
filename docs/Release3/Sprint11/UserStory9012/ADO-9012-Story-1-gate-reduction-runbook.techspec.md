# Tech Spec — Story 1: Gate Reduction and Runbook
ADO #9012 · Story 1 of 5 · Release 3 · Sprint 11
Status: DRAFT

---

## Overview

Removes the 11 boilerplate CONTINUE gates inherited from the Rewrite skill, leaving exactly
3 mandatory developer reply gates in skills/upgrade/SKILL.md (INTAKE CONFIRMED · APPROVE
REPORT · APPROVE DESIGN). Creates upgrade-runbook.md at Step 1 so all manual developer
actions are written to disk rather than lost to chat. Adds a hard BLOCK (not a gate) when a
required tool is missing, with install steps written to the runbook. This story establishes
the gate structure that Stories 3, 4, and 5 depend on.

Only `skills/upgrade/SKILL.md` is modified. No scripts, no tests.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | Exactly 3 mandatory gates; zero CONTINUE gates | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F2 | upgrade-runbook.md created at Step 1; each step appends manual actions | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F3 | Tool-not-found = hard BLOCK; install steps to runbook + chat; skill stops | skills/upgrade/SKILL.md | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| skills/upgrade/SKILL.md | AC-F1, AC-F2, AC-F3 |

**Coverage result:** All 3 ACs covered. No orphaned file changes. ✅

---

## Files Changed

### `skills/upgrade/SKILL.md` — Modify

**What changes:**

1. **Remove 11 CONTINUE gates** — every `[CONTINUE]` / `[CONTINUE ADO-{ID}]` prompt block
   in the current file is deleted. No replacement gate is added.

2. **Add gate declarations for the 3 real gates** — at the top of the skill, document:
   ```
   Developer reply gates (3 total):
     INTAKE CONFIRMED ADO-<ADO-ID>   — Step 3 gate (after intake review)
     APPROVE REPORT ADO-<ADO-ID>     — Step 4 gate (after gap/risk report)
     APPROVE DESIGN ADO-<ADO-ID>     — Step 4.5 gate (after decisions doc)
   All other steps auto-proceed.
   ```

3. **Step 1: Create upgrade-runbook.md** — immediately after stack/version detection and
   ADO-ID confirmation, write:
   ```
   docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md
   ```
   Initial content: ADO ID, stack, source version, target version, date, empty sections for
   each subsequent step. This file is exempt from the Write Gate (it is a migration artefact,
   not source code).

4. **Step 1: Tool preflight** — check for required tools (e.g. dotnet CLI, node, npm, mvn
   per detected stack). On missing tool:
   - Write install steps to upgrade-runbook.md
   - Print to chat: `⛔ Required tool not found: <tool>. Install steps written to upgrade-runbook.md. Re-invoke after installing.`
   - Stop skill. This is a hard BLOCK — not a CONTINUE gate.

5. **Subsequent steps: append to runbook** — each step that produces a manual developer
   action (e.g. "run npm install", "verify build passes", "review these breaking changes")
   appends a markdown section to upgrade-runbook.md rather than printing only to chat.

**What does NOT change:**
- upgrade-classify.cjs invocation (false-upgrade detection remains unchanged)
- upgrade-checkpoint.cjs invocation pattern (consolidation is Story 4)
- Any step logic beyond gate/runbook mechanics

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Tool not found during Step 1 preflight | Hard BLOCK: install steps written to runbook + chat; skill stops; developer re-invokes after installing |
| upgrade-runbook.md write fails (disk full) | Skill stops: `Cannot write upgrade-runbook.md: disk full. Free space and re-invoke.` |
| Developer sends CONTINUE gate keyword that no longer exists | Skill does not respond to it; continues from current state or re-orients |

---

## Request Flow

```
Developer: UPGRADE ADO-<id>
  → SKILL.md Step 1: classify (upgrade-classify.cjs)
  → SKILL.md Step 1: create upgrade-runbook.md
  → SKILL.md Step 1: tool preflight
      [tool missing] → write to runbook → print ⛔ → STOP
      [all present]  → continue
  → SKILL.md Step 2... (auto-proceed)
  → ... (Stories 2–5 add content here)
  → INTAKE CONFIRMED ADO-<id>  [Gate 1 — hook-enforced]
  → APPROVE REPORT ADO-<id>    [Gate 2 — hook-enforced]
  → APPROVE DESIGN ADO-<id>    [Gate 3 — hook-enforced]
  → Steps 5-9 auto-proceed
```

---

## Rollback

Purely additive / in-place Markdown edit. Rollback: `git revert <commit>`.
No scripts, no tests, no data changes.

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F1 | Identify and remove 11 CONTINUE gates from SKILL.md; document 3 real gates at top | 1 |
| AC-F2 | Add runbook creation at Step 1; add append calls in each subsequent step | 1 |
| AC-F3 | Add tool preflight with hard BLOCK + runbook write | 1 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — single in-place SKILL.md edit; no child ADOs.

---

## Handover

### QA Team

**What was added:** 3 real gates only (INTAKE CONFIRMED, APPROVE REPORT, APPROVE DESIGN);
11 CONTINUE prompts removed; upgrade-runbook.md created at Step 1.

**How to verify:**
1. Run upgrade skill on any project
2. Confirm no `[CONTINUE]` or `[CONTINUE ADO-...]` prompt appears at any point
3. Confirm `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md` exists after Step 1
4. Remove a required tool and confirm the hard BLOCK message appears with runbook updated

**Regression risk:** Rewrite skill is unaffected (separate SKILL.md). upgrade-classify.cjs
is unaffected (invocation unchanged).

### DevOps / Platform Team

No infrastructure changes. No script or test changes.

### Future Developer

To add manual developer actions in a new upgrade step: append a markdown section to
`docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md` using the same pattern
established in Steps 1 and 5-7. Do not print instructions only to chat.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | SKILL.md gate count | Grep skills/upgrade/SKILL.md for CONTINUE | 0 matches | AC-F1 |
| P-U2 | SKILL.md gate count | Grep for INTAKE CONFIRMED, APPROVE REPORT, APPROVE DESIGN | 3 matches (one each) | AC-F1 |
| P-U3 | upgrade-runbook.md | Run skill Step 1 on sample project | File exists at docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md | AC-F2 |
| P-U4 | Tool preflight (all present) | Run skill with dotnet/node available | Step 1 completes; no BLOCK message | AC-F3 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | Tool preflight (missing) | Run skill with required tool removed from PATH | Hard BLOCK printed; runbook has install steps; skill stops | AC-F3 |
| N-U2 | SKILL.md (no partial gates) | Grep for [CONTINUE] in SKILL.md | 0 matches (no partial/conditional CONTINUE variants) | AC-F1 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full upgrade skill run (stubbed intake) | Invoke UPGRADE ADO-9012 on a Node.js test project | Only 3 developer prompts appear (INTAKE CONFIRMED, APPROVE REPORT, APPROVE DESIGN); runbook exists | AC-F1, AC-F2 |

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] `skills/upgrade/SKILL.md` modified: 11 CONTINUE gates removed (zero remain)
- [ ] `skills/upgrade/SKILL.md` modified: 3 real gate declarations at top of skill
- [ ] `skills/upgrade/SKILL.md` modified: upgrade-runbook.md created at Step 1
- [ ] `skills/upgrade/SKILL.md` modified: tool preflight with hard BLOCK on missing tool
- [ ] `skills/upgrade/SKILL.md` modified: subsequent steps append manual actions to runbook

**Quality**
- [ ] Grep `skills/upgrade/SKILL.md` for CONTINUE — 0 matches
- [ ] Grep `skills/upgrade/SKILL.md` for `INTAKE CONFIRMED`, `APPROVE REPORT`, `APPROVE DESIGN` — exactly 1 match each
- [ ] Run upgrade skill on a sample project — exactly 3 developer prompts appear
- [ ] upgrade-runbook.md exists at `docs/migrations/<ADO-ID>/` after Step 1
- [ ] Tool-not-found hard BLOCK confirmed (manual test)

**Review readiness**
- [ ] PR title: `[ADO-9012] Gate Reduction and Runbook — remove 11 CONTINUE gates, add runbook`
- [ ] PR description maps each changed section to its AC (AC-F1, AC-F2, AC-F3)
- [ ] ICEA committed in the same branch

### Reviewer Checklist

- [ ] Confirm 0 CONTINUE gates in skills/upgrade/SKILL.md (grep)
- [ ] Confirm 3 real gate declarations present at top of skill
- [ ] Confirm upgrade-runbook.md is created at Step 1 (not at Step 3 or later)
- [ ] Confirm tool-not-found is a hard BLOCK with descriptive message, not a CONTINUE gate

---

## Open Questions

None.

---

## Revision Log

2026-10-03 — Story 1 tech spec drafted. Added Definition of Done (critic REVISE → auto-revised).
