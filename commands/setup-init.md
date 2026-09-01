---
description: Per-project setup — runs the bootstrap script to handle all mechanical work (dirs, stubs, hooks, state files, gitignore, CLAUDE.md sections), then guides Claude through LLM-only tasks in order (CLAUDE.md content via /init, architect skill which auto-triggers Bootstrap Phase 2 to deploy rules and pre-copy architecture templates, graph-sync). Safe to re-run — manifest tracks progress; completed steps are skipped.
argument-hint: (no arguments needed)
---

# /setup-init

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/setup-init/SKILL.md` and execute it in full.
