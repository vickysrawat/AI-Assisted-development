---
description: "Remove plugin-managed content from a target project by scope. Always dry-runs first and requires CONFIRM before removing anything. memory/, .claude/architecture/, and .claude/graph/ are never removed.  Example: /setup-teardown --commands"
argument-hint: "[--full | --skills | --hooks | --rules | --commands | --state | --help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/setup-teardown — Remove plugin-managed content from this project (scoped).

Always performs a dry-run first and requires you to type CONFIRM before anything is deleted.
memory/ is never removed.

Arguments:
  --full        Remove all plugin-managed content (hooks, rules, commands, state).
  --skills      Remove command stub files only (.claude/commands/).
  --hooks       Remove hook files only (.claude/hooks/).
  --rules       Remove rule files only (.claude/rules/).
  --commands    Remove command files only (.claude/commands/).
  --state       Remove state files only (dream-init-state.json, file-cache.json, etc.).
  --help, ?help Show this help.

Examples:
  /setup-teardown --commands
  /setup-teardown --full
```

<skill>ai-assisted-development:setup-teardown</skill>
