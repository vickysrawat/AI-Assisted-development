---
description: Dismiss a finding from any ledger as a false positive, won't-fix, accepted risk, or by-design. Takes a fingerprint ID (FP-xxxxxxxx), a reason category, and a required justification. Dismissed findings are suppressed on future scans but re-flagged for review if the code at their location changes.
argument-hint: <FP-xxxxxxxx> <false-positive|wont-fix|accepted-risk|by-design> "<justification>" [--undo]
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /dismiss

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/dismiss/SKILL.md` and execute it in full, passing the provided arguments.
