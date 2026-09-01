---
description: Pre-commit quality gate — code-review, ICEA compliance, secrets scan, and open security/DAST findings check (Check D). Single pass against staged and modified files. Unified pass/fail result with pre-filled commit command. Check D gates on open Critical/High findings in all ledgers.
argument-hint: (no arguments needed — operates on staged and unstaged modified files)
---

## Model routing
This command uses the infrastructure tier — INFRA_MODEL (default: claude-sonnet-4-6).

# /checkin

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/checkin/SKILL.md` and execute it in full.
