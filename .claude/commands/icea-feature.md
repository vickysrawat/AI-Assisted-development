---
description: "Explicitly invoke the ICEA feature planning gate. Use when auto-trigger did not fire or to re-generate an existing ICEA.  Example: /icea-feature ADO-1847"
argument-hint: "ADO-<id>  e.g.  ADO-1847  (Release and Sprint numbers will be requested if not provided)  [--help]"
---

# /icea-feature

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/icea-feature — Invoke the ICEA feature planning gate.

Generates an ICEA draft (Intent · Context · Examples · Acceptance criteria) and
Tech Spec for the given work item. Prompts for Release and Sprint numbers if not supplied.
Use when the auto-trigger did not fire or to regenerate an existing ICEA.

Arguments:
  ADO-<id>        The work item ID (e.g. ADO-1847). Release and Sprint prompted if omitted.
  --help, ?help   Show this help.

Example:
  /icea-feature ADO-1847
```

<skill>ai-assisted-development:icea-feature</skill>
