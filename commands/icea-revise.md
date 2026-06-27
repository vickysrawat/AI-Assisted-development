---
description: Revise an existing ICEA and Tech Spec — answer open questions,
  incorporate Tech Lead or Product feedback, or update any section. Re-gates
  code generation until revised documents are re-approved. Locates files by
  ADO ID; Release and Sprint inferred from existing path. Also triggered by
  REVISE ADO-{ID} without a slash command.
argument-hint: ADO-<id>  e.g.  ADO-1847
---

## Model routing
This command uses the generation tier — ICEA_MODEL (default: claude-opus-4-6).

---

# /icea-revise — Revise existing ICEA and Tech Spec

## Step 1 — Load the skill
```
Read skills/icea-revise/SKILL.md and execute it.
```

Pass any arguments directly:
- ADO ID (required — ask if missing)

## Hard Rules
- Never overwrite files without showing a diff-style preview first
- Always reset ICEA Status to `DRAFT — Revising` before writing
- Always re-gate code generation after any revision
- Never proceed past path confirmation without developer reply YES
- Never proceed past mid-implementation guard without developer reply CONFIRM
- Read open questions from Section 10 table — not inline ❓ block counting
- Do not proceed if no existing ICEA is found — direct to /icea-feature
