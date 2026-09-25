---
description: "Codebase Q&A from architecture docs only — no source scanning. Answers \"how does X work\" and \"where is Y\" questions instantly.  Example: /explain \"how does matter search work?\""
argument-hint: "\"<question>\" | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/explain — Codebase Q&A from architecture docs (no source scanning).

Arguments:
  "<question>"     Natural-language question about the codebase architecture.
  --help, ?help    Show this help.

Note: Answers are derived from architecture.md and graph context only — no source files are read.
For source-level analysis, use /code-review or run /graph-sync first.

Examples:
  /explain "how does matter search work?"
  /explain "where is the auth middleware?"
  /explain "what layers does the matter domain span?"
```

<skill>ai-assisted-development:explain</skill>
