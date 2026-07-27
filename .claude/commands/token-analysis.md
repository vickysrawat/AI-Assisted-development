---
description: "Analyse token consumption across recent Claude Code sessions. Persistent graph cache means subsequent runs only process new sessions. Writes token-analysis-<date>.html to token-analysis/.  Example: /token-analysis sessions=5"
argument-hint: "[sessions=<N>] [--help]  —  default: 10 sessions"
---

# /token-analysis

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/token-analysis — Analyse token consumption across recent Claude Code sessions.

Uses a persistent graph cache — subsequent runs only process new sessions and
changed files. Writes token-analysis-<date>.html to token-analysis/ in the project root.

Arguments:
  sessions=<N>     Number of recent sessions to analyse (default: 10).
  --help, ?help    Show this help.

Examples:
  /token-analysis
  /token-analysis sessions=5
  /token-analysis sessions=20
```

<skill>ai-assisted-development:token-analysis</skill>
