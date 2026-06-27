---
description: Approve an ICEA and Tech Spec by ADO ID. Works in any session —
  reads state from disk. Use after receiving approval from Tech Lead or Product
  team. Also triggered by the keyword APPROVE ADO-{ID} without a slash command.
argument-hint: ADO-<id>  e.g.  ADO-1847
---

## Model routing
This command uses the generation tier — ICEA_MODEL (default: claude-opus-4-6).

---

# /icea-approve — Approve ICEA from any session

## Step 1 — Load the skill
```
Read skills/icea-approve/SKILL.md and execute it.
```

Pass any arguments directly:
- If an ADO ID was provided, use it
- If a Story number was provided (e.g. Story-2), pass it for Epic story approval
- If ADO ID is missing, the skill will ask for it

## Hard Rules
- Never write `Status: ✅ Approved` without presenting a summary first
- Never generate implementation code — that is icea-implement's responsibility
- Read all state from disk — never rely on conversation context
