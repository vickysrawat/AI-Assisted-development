---
description: "Re-provision an existing project after a plugin upgrade. Applies only version-sensitive migrations, re-copies hooks, refreshes ignore file, seeds new state files. Idempotent and safe to re-run.  Example: /setup-sync"
argument-hint: "(no arguments) | --commands | --reinstall | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/setup-sync — Re-provision an existing project after a plugin upgrade.

Compares the provisioned plugin version against the installed version and applies
only the version-sensitive changes (hooks, ignore file, state files, rule files).
Safe to re-run — never overwrites developer content.

Use when /setup-status reports UPGRADE PENDING.

Arguments:
  (no arguments)   Run the full upgrade migration.
  --commands       Deploy only command stubs from plugin → this project.
                   Deterministic: runs a script, no LLM reasoning. Target-only
                   files (e.g. dream-init.md) are never deleted.
  --reinstall      Push plugin source changes to the installed copy
                   (~/.claude/plugins/.../ai-assisted-development/).
                   Run from the plugin source directory only.
                   Deterministic: runs node install.cjs --update.
  --help, ?help    Show this help.

Examples:
  /setup-sync
  /setup-sync --commands
  /setup-sync --reinstall
```

<skill>ai-assisted-development:setup-sync</skill>
