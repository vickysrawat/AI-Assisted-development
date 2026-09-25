---
description: "Generate and write implementation code for an approved ICEA. Reads all state from disk. For Epics, implement story by story.  Example: /icea-implement ADO-1847  or  /icea-implement ADO-1847 Story-2"
argument-hint: "ADO-<id> [Story-N]  e.g.  ADO-1847  or  ADO-1847 Story-2  [--help]"
---

# /icea-implement

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/icea-implement — Generate implementation code for an approved ICEA.

Reads the approved ICEA and Tech Spec from disk and generates all implementation
files. For Epics, generates code story by story.
Also triggered by typing: IMPLEMENT ADO-1847  or  IMPLEMENT ADO-1847 Story-2

Arguments:
  ADO-<id>         The approved work item ID (e.g. ADO-1847).
  Story-<N>        (Epic only) Implement a specific story (e.g. Story-2).
  --help, ?help    Show this help.

Examples:
  /icea-implement ADO-1847
  /icea-implement ADO-1847 Story-2
```

<skill>ai-assisted-development:icea-implement</skill>
