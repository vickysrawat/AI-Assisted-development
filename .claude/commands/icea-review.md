---
description: "Review a pull request or code diff against an approved ICEA document. Produces a structured pass/fail compliance report mapping every change to an Acceptance Criterion.  Example: /icea-review"
argument-hint: "(no arguments — reads git diff and ICEA automatically) | --help"
---

# /icea-review

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/icea-review — Review code changes against an approved ICEA.

Reads the current git diff and the approved ICEA automatically.
Produces a structured pass/fail compliance report mapping every changed file
to an Acceptance Criterion. Flags scope creep (changes with no matching AC).

Arguments:
  (no arguments)   Run the review against the current diff.
  --help, ?help    Show this help.

Example:
  /icea-review
```

<skill>ai-assisted-development:icea-review</skill>
