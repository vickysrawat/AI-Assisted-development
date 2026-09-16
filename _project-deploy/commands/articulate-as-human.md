---
description: "Deterministically scan a generated document for generic \"AI-sounding\" writing patterns — stock vocabulary, weasel attribution, \"not just X, it's Y\" negation, dangling \"-ing\" clauses, bold-lead-in bullets, em-dash/transition density, uniform rhythm. Reports by tier with file:line; rewrites only flagged spans on request, never silently.  Example: /articulate-as-human docs/my-spec.md"
argument-hint: "<path-to-file-or-dir> [--json report.json] | --help  — omit to be prompted for the target"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/articulate-as-human — scan a document for generic "AI-sounding" writing patterns.

Arguments:
  <path>              File or directory to scan.
  --json <report>     Also emit a machine-readable JSON report.
  --help, ?help       Show this help.

Reports findings by tier with file:line locations. Never rewrites silently —
rewrites only flagged spans, only on explicit request.

Examples:
  /articulate-as-human docs/Release1/Sprint1/ADO-9000-story.icea.md
  /articulate-as-human docs/ --json tone-report.json
```

<skill>ai-assisted-development:articulate-as-human</skill>
