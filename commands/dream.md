---
description: Run a Dream memory consolidation pass — reads Claude Code sessions, scores entries, proposes ADD/UPDATE/DELETE operations with justification, and waits for tiered approval before writing.
argument-hint: (no arguments needed)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /dream

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/dream/SKILL.md` and execute it in full.
