---
description: "Generate a complete, ICEA-compliant pull request description. Maps every changed file to an Acceptance Criterion, flags scope creep, and outputs a self-review checklist.  Example: /pr-describe"
argument-hint: "(no arguments — reads git diff automatically) | --help"
---

# /pr-describe

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/pr-describe — Generate an ICEA-compliant PR description.

Reads the current git diff automatically. Maps every changed file to an
Acceptance Criterion, flags scope creep (changes with no matching AC),
and outputs a self-review checklist.

Arguments:
  (no arguments)   Generate the PR description for the current branch diff.
  --help, ?help    Show this help.

Example:
  /pr-describe
```

<skill>ai-assisted-development:pr-describe</skill>
