---
description: Run a static-analysis code review with persistent tracking. Detects new defects, marks previously-found defects as fixed (with who/when/what from git), and writes HTML + Markdown reports plus a running ledger into the CodeReviews/ folder. Invoked with no flag, it presents an interactive scope menu (skipped in CI).
argument-hint: [--changed | --pr | --full | --ci | path | --with-deps]  — omit to pick from the interactive scope menu (--with-deps also reviews additionalDirectories dependency repos)
---

# /code-review

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/code-review/SKILL.md` and execute it in full, passing the provided scope flag.

If **no flag** was provided, do not default silently — the skill presents the interactive scope
menu (Step 0a) and waits for a choice. The **only** exception is CI / non-interactive runs
(`--ci`, headless, or gate-invoked), which skip the menu and use the cache-aware full scan.
