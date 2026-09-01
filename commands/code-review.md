---
description: Run a Coverity-style code review with persistent tracking. Detects new defects, marks previously-found defects as fixed (with who/when/what from git), and writes HTML + Markdown reports plus a running ledger into the CodeReviews/ folder.
argument-hint: [--changed | --pr | --full | --ci | path]
---

# /code-review

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/code-review/SKILL.md` and execute it in full, passing the provided scope flag.
