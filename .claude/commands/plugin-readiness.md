---
description: "AI Architect plugin readiness — evaluates 6 domains (infrastructure health, model routing, memory health, governance, skill quality, session budget). Reads plugin state only.  Example: /plugin-readiness"
argument-hint: "(no arguments) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/plugin-readiness — AI Architect plugin health check across 6 domains.

Evaluates: infrastructure health, model routing, memory health, governance,
skill quality, and session budget. Read-only — never modifies anything.

Arguments:
  (no arguments)   Run the full readiness check.
  --help, ?help    Show this help.

Example:
  /plugin-readiness
```

<skill>ai-assisted-development:plugin-readiness</skill>
