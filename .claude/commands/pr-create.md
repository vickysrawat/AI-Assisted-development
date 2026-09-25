---
description: "Create a Pull Request in Azure DevOps directly from Claude Code, or save a complete PR draft for manual submission. Validates against ICEA and submits via ADO API.  Example: /pr-create"
argument-hint: "(no arguments — reads branch and ICEA automatically) | --help"
---

# /pr-create

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/pr-create — Create a Pull Request in Azure DevOps.

Reads the current branch and ICEA automatically. Generates the PR description,
validates it against the approved ICEA, and submits via the ADO API.
Optionally saves a PR draft for manual submission if ADO API is unavailable.

Arguments:
  (no arguments)   Create the PR for the current branch.
  --help, ?help    Show this help.

Example:
  /pr-create
```

<skill>ai-assisted-development:pr-create</skill>
