---
description: Generate a complete, ICEA-compliant pull request description. Reads git diff automatically, maps every changed file to an Acceptance Criterion, flags scope creep, and outputs a self-review checklist.
argument-hint: (no arguments needed — reads git diff automatically)
---

## Model routing
This command uses the generation tier — ICEA_MODEL (default: claude-opus-4-6).

# /pr-describe

Read skills/pr-describe/SKILL.md and execute it in full.

## Hard Rules
- Never generate a PR description without reading the actual git diff
- Never mark an AC as implemented without finding the corresponding code
- Never skip the scope creep check
