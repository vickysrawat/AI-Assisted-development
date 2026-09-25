---
description: "Approve an ICEA and Tech Spec by ADO ID. Works across sessions — reads state from disk. Use after receiving approval from Tech Lead or Product. Also triggered by: APPROVE ADO-{ID}.  Example: /icea-approve ADO-1847"
argument-hint: "ADO-<id>  e.g.  ADO-1847  [--help]"
---

# /icea-approve

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/icea-approve — Approve an ICEA and Tech Spec.

Marks the ICEA as approved (Status: ✅ Approved) and unlocks code generation.
Reads all state from disk — safe to run in a new session.
Also triggered by typing: APPROVE ADO-1847

Arguments:
  ADO-<id>        The work item ID of the ICEA to approve (e.g. ADO-1847).
  --help, ?help   Show this help.

Example:
  /icea-approve ADO-1847
```

<skill>ai-assisted-development:icea-approve</skill>
