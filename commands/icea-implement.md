---
description: Generate and write implementation code for an approved ICEA.
  Reads all state from disk — works in any session. For Epics, implement
  story by story. Also triggered by IMPLEMENT ADO-{ID} or
  IMPLEMENT ADO-{ID} Story-{N} without a slash command.
argument-hint: ADO-<id> [Story-N]  e.g.  ADO-1847  or  ADO-1847 Story-2
---

## Model routing
This command uses the generation tier — ICEA_MODEL (default: claude-opus-4-6).

---

# /icea-implement — Implement approved ICEA

## Step 1 — Load the skill
```
Read skills/icea-implement/SKILL.md and execute it.
```

Pass any arguments directly:
- ADO ID (required — ask if missing)
- Story number (optional — for Epic story-by-story implementation)

## Hard Rules
- Never generate code if ICEA Status is not `✅ Approved`
- All source code and config files gated behind APPROVE ADO-{ID}
- Read all state from disk — check tracker for already-implemented ACs
- Never implement an AC already marked ✅ Done in the tracker
- Update tracker after every write — never leave it stale
