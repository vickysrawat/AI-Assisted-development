---
description: "Health check for all plugin infrastructure. Shows green/amber/red for CLAUDE.md, memory, rules, commands, architecture docs, graph, file-cache, token-graph, and .gitignore. Read-only.  Example: /setup-status"
argument-hint: "(no arguments) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/setup-status — Plugin infrastructure health check.

Shows green/amber/red status for: CLAUDE.md, memory/, rules, command stubs,
architecture docs, knowledge graph, file-cache, token-graph, and .gitignore coverage.
Also reports plugin version drift (UPGRADE PENDING → run /setup-sync).

Read-only — never modifies anything.

Arguments:
  (no arguments)   Run the health check.
  --help, ?help    Show this help.

Example:
  /setup-status
```

<skill>ai-assisted-development:setup-status</skill>
