---
description: Lightweight bug fix flow — produces a trimmed Root Cause / Fix / Regression Test spec and generates the fix after one approval. Bypasses the full ICEA gate for confirmed bugs. Use for defects on existing behaviour that do not require new design.
argument-hint: ADO-<id> "<one-line description>"  e.g.  ADO-2341 "Filter crashes when user has no roles"
---

# /bug

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/bug/SKILL.md` and execute it in full, passing the provided arguments.
