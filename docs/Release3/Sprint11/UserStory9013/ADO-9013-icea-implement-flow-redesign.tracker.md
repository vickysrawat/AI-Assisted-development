# Tracker — icea-implement Flow Redesign
ADO #9013 · Release 3 · Sprint 11 · STORY · 8 SP
Status: 🔄 In Progress

---

## AC Status

| AC | Description | Status |
|---|---|---|
| AC-F1 | BUDGET_OK auto-proceeds — no CONTINUE prompt | ✅ Done |
| AC-F2 | BUDGET_WARN: two-option stop, no FORCE | ✅ Done |
| AC-F3 | BUDGET_STOP: two-option stop, no CONTINUE | ✅ Done |
| AC-F4 | Pre-existing bug rows: hard block | ✅ Done |
| AC-F5 | Fix loop: 3-cycle automated loop with audit | ✅ Done |
| AC-F6 | Test command detection: hybrid order | ✅ Done |
| AC-F7 | Gap signal at ceiling-hit (before diagnostic) | ✅ Done |
| AC-F8 | Ceiling-hit diagnostic: 5-element format | ✅ Done |
| AC-F9 | Option A guidance: full new 3-cycle loop | ✅ Done |
| AC-F10 | REVISE from ceiling: set Revised status | ✅ Done |
| AC-F11 | IMPLEMENT re-entry: Revised → reset ACs | ✅ Done |
| AC-F12 | Epic auto-advance after Write Gate | ✅ Done |
| AC-F13 | Epic start banner: count + APPROVE ALL + PAUSE | ✅ Done |
| AC-F14 | PAUSE stops Epic auto-flow | ✅ Done |
| AC-F15 | PAUSE reminder in each inter-story advance | ✅ Done |
| AC-F16 | Test plan missing: auto-generate | ✅ Done |
| AC-NF1 | Audit row format unchanged | ✅ Done |
| AC-NF2 | Gap signal exits 0 always | ✅ Done |
| AC-NF3 | Revised status additive; no regression | ✅ Done |
| AC-NF4 | PAUSE keyword: no CLAUDE.md §0a conflict | ✅ Done |

---

## Implementation — ADO #9013

**Status:** ✅ Done
**File:** `skills/icea-implement/SKILL.md`
**Changes:** 8 targeted section replacements/additions

### Delivered

- `skills/icea-implement/SKILL.md` — Change 1: Bug rows hard block — replaces warn+CONTINUE with ⛔ stop at tracker path + re-run command; no CONTINUE escape
- `skills/icea-implement/SKILL.md` — Change 2: `🔄 Revised` status detection — resets all ACs to ⏳ Pending before Step 4 when Story is Revised
- `skills/icea-implement/SKILL.md` — Change 3: Epic start banner — EPIC_AUTO_FLOW flag; banner with story count + `APPROVE ALL ADO-{ID}` + PAUSE tip
- `skills/icea-implement/SKILL.md` — Changes 4+5: BUDGET_OK auto-proceeds (no CONTINUE prompt); BUDGET_WARN/STOP two-option stop with no FORCE/CONTINUE escape
- `skills/icea-implement/SKILL.md` — Change 6: Epic auto-advance — loops to Story N+1 after Write Gate if EPIC_AUTO_FLOW=true; PAUSE stops and shows resume command in every advance message
- `skills/icea-implement/SKILL.md` — Change 7: Test plan auto-generate — SKIP_GATE=0 now runs `SAVE TEST --subagent` instead of hard-stopping; hard-stops only on generation failure
- `skills/icea-implement/SKILL.md` — Change 8: Bounded fix loop — 3-cycle ceiling per invocation; test command hybrid detection; gap signal + 5-element diagnostic at ceiling; Option A/B/C; Option A resets full 3-cycle loop

### Tests added
_(SKILL.md-only story — manual scenario verification per test plan suites; no compiled test files added)_

### Design decisions
_(no non-trivial design choices — all changes are spec-driven replacements per Tech Spec)_

### Known gaps
_(none — all ACs fully met)_

### Follow-ups

| # | Issue | Fix applied | Files |
|---|---|---|---|

### Lessons learned
_(Clean delivery — no recurring patterns identified in this story)_
