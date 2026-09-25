---
description: "Revise an existing ICEA and Tech Spec after Tech Lead or Product feedback. Locates files by ADO ID. Re-gates code generation after any revision.  Example: /icea-revise ADO-1847"
argument-hint: "ADO-<id>  e.g.  ADO-1847  [--help]"
---

# /icea-revise

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/icea-revise — Revise an existing ICEA and Tech Spec.

Use after receiving Tech Lead or Product feedback, or to resolve open questions.
Locates the files by ADO ID (Release and Sprint inferred from the existing path).
Re-gates code generation after any revision.
Also triggered by typing: REVISE ADO-1847

Arguments:
  ADO-<id>        The work item ID of the ICEA to revise (e.g. ADO-1847).
  --help, ?help   Show this help.

Example:
  /icea-revise ADO-1847
```

<skill>ai-assisted-development:icea-revise</skill>
