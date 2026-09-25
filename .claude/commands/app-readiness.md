---
description: "Enterprise / Solution Architect production readiness — evaluates 8 domains (ADO pipeline, resilience, observability, security, scalability, data integrity, runbook, tests). Requires architect skill to be run first. Omit the flag to be prompted (--quick recommended; CI uses --quick).  Example: /app-readiness --full"
argument-hint: "[--quick | --full | --with-deps | --help]  — omit to be prompted (--quick recommended)"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/app-readiness — Enterprise / Solution Architect production readiness check.

Arguments:
  (no flag)        Prompt to choose: --quick (recommended) or --full. (CI / non-interactive: --quick, no prompt.)
  --quick          Fast check covering 4 core domains.
  --full           Full check across all 8 domains.
  --help, ?help    Show this help.

Note: Run /graph-sync (architect) before this command to populate architecture context.

Examples:
  /app-readiness --full
  /app-readiness --quick
```

<skill>ai-assisted-development:app-readiness</skill>
