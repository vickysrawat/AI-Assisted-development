---
description: "Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context. Checks for plugin version drift and surfaces an upgrade notice if needed. Run at the start of every session.  Example: /session-start"
argument-hint: "(no arguments) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/session-start — Zero-cost session warm-up.

Loads CLAUDE.md, memory/MEMORY.md, and architecture context in one pass.
Also checks for plugin version drift — surfaces a notice if the installed
plugin is newer than the provisioned version (run /setup-sync to upgrade).

Run at the start of every Claude Code session for this project.

Arguments:
  (no arguments)   Run the warm-up.
  --help, ?help    Show this help.

Example:
  /session-start
```

<skill>ai-assisted-development:session-start</skill>
