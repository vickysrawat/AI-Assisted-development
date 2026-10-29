---
description: "Scan changed files against deployed DO NOT rules in .claude/rules/. Run after IMPLEMENT or on demand before code review. Example: CHECK RULES  or  CHECK RULES ADO-1847"
argument-hint: "(no arguments) | ADO-{ID} | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/rule-check — Rule file violation scan.

Reads all DO NOT rules from deployed .claude/rules/ files and scans
recently changed files for violations.

Arguments:
  (no arguments)   Scan files changed in the working tree (git diff HEAD).
  ADO-{ID}         Scan files changed on the feature branch for that ADO.
  --help, ?help    Show this help.

Examples:
  CHECK RULES
  CHECK RULES ADO-1847
```

<skill>ai-assisted-development:rule-check</skill>
