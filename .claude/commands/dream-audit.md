---
description: "Quarterly memory quality audit — flags uncited facts, contradictions, and rollback-prone categories.  Example: /dream-audit"
argument-hint: "[--days <N>] [--help]  — omit to be prompted for the citation window (90 recommended; CI uses 90)"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/dream-audit — Quarterly memory quality audit.

Reviews memory/MEMORY.md for uncited facts, internal contradictions, and entries
that are candidates for rollback. Run quarterly or after a major architecture change.

Arguments:
  (no flag)        Prompt for the citation window: 90 days (recommended) or a custom value. (CI / non-interactive: 90, no prompt.)
  --days <N>       Set the citation window in days (default 90).
  --help, ?help    Show this help.

Examples:
  /dream-audit
  /dream-audit --days 180
```

<skill>ai-assisted-development:dream-audit</skill>
