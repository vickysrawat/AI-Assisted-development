---
description: "Pre-commit quality gate — code-review + ICEA compliance + secrets check in one pass. Outputs a pre-filled git commit command when all checks pass.  Example: /checkin"
argument-hint: "(no arguments) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/checkin — Pre-commit quality gate.

Runs code-review, ICEA compliance check, and secrets scan against staged changes.
Outputs a pre-filled git commit command when all checks pass.

Arguments:
  (no arguments)   Run the full pre-commit gate against staged changes.
  --help, ?help    Show this help.

Example:
  /checkin
```

<skill>ai-assisted-development:checkin</skill>
