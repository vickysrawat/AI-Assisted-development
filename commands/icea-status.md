---
description: Show current state of all ICEA files for an ADO ID — ICEA status,
  Tech Spec open questions, tracker progress, open bugs, and exact next action.
  The perfect re-entry point after a session gap. Also triggered by
  STATUS ADO-{ID} without a slash command.
argument-hint: ADO-<id>  e.g.  ADO-1847
---

## Model routing
This command uses the fast tier — no generation needed, read-only.

---

# /icea-status — Show ICEA state

## Step 1 — Load the skill
```
Read skills/icea-status/SKILL.md and execute it.
```

Pass any arguments directly:
- ADO ID (required — ask if missing)

## Hard Rules
- Read-only — never write anything
- Always end with a clear "Next action" directive
- Never guess state — read every file fresh from disk
