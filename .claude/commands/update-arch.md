---
description: "Targeted architecture doc refresh — updates architecture.md prose for changed areas, appends decisions, or refreshes a specific section. Omit the flag to be prompted for the mode (auto-detect recommended; CI auto-detects). For the module graph, use /graph-sync.  Example: /update-arch --decisions"
argument-hint: "[--data | --integrations | --security | --decisions | --deployment | <path> | --help]  — omit to be prompted (auto-detect recommended)"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/update-arch — Targeted architecture documentation refresh.

Arguments:
  (no flag)        Prompt to choose the mode (auto-detect recommended). (CI / non-interactive: auto-detect changed areas, no prompt.)
  --data           Refresh the data model section only.
  --integrations   Refresh the integrations section only.
  --security       Refresh the security section only.
  --decisions      Append a new architecture decision record (ADR).
  --deployment     Re-run the deployment questionnaire.
  <path>           Scope the refresh to a specific file or directory.
  --help, ?help    Show this help.

Note: For module graph changes, use /graph-sync instead.

Examples:
  /update-arch --decisions
  /update-arch --data
  /update-arch src/api/
```

<skill>ai-assisted-development:update-arch</skill>
