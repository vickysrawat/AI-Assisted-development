---
description: "Lightweight bug fix flow — Root Cause / Fix / Regression Test spec with one approval cycle. Use for defects on existing behaviour.  Example: /bug ADO-1847 \"null reference on filter\""
argument-hint: "ADO-<id> \"<description>\" | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/bug — Lightweight bug fix flow with one approval cycle.

Arguments:
  ADO-<id>         The work item ID to log the bug against (e.g. ADO-1847).
  "<description>"  Short description of the defect.
  --help, ?help    Show this help.

Examples:
  /bug ADO-1847 "null reference on matter filter"
  /bug ADO-2001 "login redirect loop on token expiry"
```

<skill>ai-assisted-development:bug</skill>
