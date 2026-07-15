---
description: Reverses a specific Dream consolidation run using the audit trail in memory/dream-log.md. Lists available runs, shows changes, confirms before reversing. The rollback itself is logged and is itself reversible.
argument-hint: (no arguments — interactive selection from run history)
---

<skill>dream-rollback</skill>

## Your task

Run the dream-rollback skill to reverse a specific Dream run.

Read `.claude/plugin-path.txt` to get `PLUGIN_DIR` (if absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`), then:

Read `$PLUGIN_DIR/skills/dream-rollback/SKILL.md` and follow its instructions exactly.
