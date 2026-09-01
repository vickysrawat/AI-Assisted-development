---
description: Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context in one pass so you can start working immediately without re-establishing context manually.
argument-hint: (no arguments needed)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /session-start

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/session-start/SKILL.md` and execute it in full.
