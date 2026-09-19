---
description: "Humanize text in two modes. File mode deterministically scans a generated document for generic \"AI-sounding\" writing patterns and reports findings by tier with file:line locations before any rewrite. Direct-text mode rewrites provided text and returns it in chat/console with no report and no file changes. Rewrites to files are only for flagged spans on explicit request; never silently."
argument-hint: "<path-or-text> [--json report.json] | --text <text> | --file <path-to-file-or-dir> | --help  — auto-detect file path vs direct text when flags are omitted"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/articulate-as-human — scan a document for generic "AI-sounding" writing patterns.

Arguments:
  <path-or-text>       Auto-detect mode: existing file/dir path => file mode; non-path => text mode.
  --text <text>        Direct-text mode: humanize and return text in chat/console (no report, no file edits).
  --file <path>        File mode: scan file/dir first, then report findings.
  --json <report>      Also emit a machine-readable JSON report (file mode only).
  --help, ?help       Show this help.

File mode reports findings by tier with file:line locations before any rewrite.
Never rewrites files silently — rewrites only flagged spans, only on explicit request,
with before/after changes shown.

Examples:
  /articulate-as-human "This approach leverages a robust framework to drive seamless outcomes."
  /articulate-as-human --text "This approach leverages a robust framework to drive seamless outcomes."
  /articulate-as-human docs/Release1/Sprint1/ADO-9000-story.icea.md
  /articulate-as-human --file docs/Release1/Sprint1/ADO-9000-story.icea.md
  /articulate-as-human docs/ --json tone-report.json
```

<skill>ai-assisted-development:articulate-as-human</skill>
