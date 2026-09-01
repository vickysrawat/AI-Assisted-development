---
description: Show the current status of an in-progress migration for an ADO work item — phase, stage-gate progress, per-cluster status, and the next command to resume. Read-only; renders the on-disk migration checkpoint.
argument-hint: ADO-<id>  e.g.  ADO-1847   (run from the TARGET project folder)
---

## Model routing
This command uses the infrastructure tier — INFRA_MODEL (default: claude-sonnet-4-6).

# /migration-status

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/migration-status/SKILL.md` and execute it in full.
