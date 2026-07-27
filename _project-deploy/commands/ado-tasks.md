---
description: "Generate a complete Azure DevOps task breakdown from an approved ICEA document. Creates one task per Acceptance Criterion per layer (.NET, Angular, Node.js, QA, DB, Infra) with titles, tags, and effort estimates.  Example: /ado-tasks ADO-1847"
argument-hint: "ADO-<id>  e.g.  ADO-1847  [--help]"
---

# /ado-tasks

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/ado-tasks — Generate an Azure DevOps task breakdown from an approved ICEA.

Creates one task per Acceptance Criterion per layer (.NET, Angular, Node.js, QA, DB, Infra)
with titles, tags, and effort estimates.

Arguments:
  ADO-<id>        The approved work item ID (e.g. ADO-1847). ICEA must be on disk.
  --help, ?help   Show this help.

Example:
  /ado-tasks ADO-1847
```

<skill>ai-assisted-development:ado-tasks</skill>
