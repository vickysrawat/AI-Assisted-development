---
description: "One-time project setup — creates memory/, deploys rules/, seeds state files, populates architecture docs, and writes the VCS ignore file. Auto-detects Git vs TFVC. Safe to re-run.  Example: /setup-init"
argument-hint: "(no arguments) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/setup-init — One-time project setup for the AI Architect plugin.

Creates: memory/, .claude/rules/, file-cache.json, token-graph.json.
Populates architecture docs via the architect skill.
Writes the VCS ignore file (.gitignore on Git, .tfignore on TFVC) with managed entries.
Safe to re-run — never overwrites developer content.

Arguments:
  (no arguments)   Run the full setup.
  --help, ?help    Show this help.

Example:
  /setup-init
```

<skill>ai-assisted-development:setup-init</skill>
