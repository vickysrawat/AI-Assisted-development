---
description: "Show current state for an ADO ID — ICEA status, Tech Spec open questions, tracker progress, bugs, and exact next action. The perfect re-entry point after a session gap.  Example: /icea-status ADO-1847"
argument-hint: "ADO-<id>  e.g.  ADO-1847  [--help]"
---

# /icea-status

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/icea-status — Show the current state of all ICEA artefacts for a work item.

Reports: ICEA status, Tech Spec open questions, tracker progress, bug log,
and the exact next action to take. The perfect re-entry point after a session gap.
Also triggered by typing: STATUS ADO-1847

Arguments:
  ADO-<id>        The work item ID to check (e.g. ADO-1847).
  --help, ?help   Show this help.

Example:
  /icea-status ADO-1847
```

<skill>ai-assisted-development:icea-status</skill>
