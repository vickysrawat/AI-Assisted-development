---
description: "Sprint governance & quality report — governance events, token efficiency, and auto-generated lessons for the tech lead."
argument-hint: "[--since YYYY-MM-DD | --days N | --sprint N]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop:

```
/governance-report — Sprint governance & quality report

Reads .claude/audit/, token-graph.json, and finding ledgers to produce:
  • Governance events (ICEA approvals, bypasses, RBAC blocks, dismissals, config changes)
  • Model configuration summary (per-invocation tracking: Item 15)
  • Token efficiency signals (requires /token-analysis to have run)
  • Auto-generated sprint lessons grounded in the data
  • project-knowledge.md promotion offer for recurring ICEA patterns

Consumer: tech lead — run at sprint end or before go-live review.

Arguments:
  --since YYYY-MM-DD   Include events from this date onwards
  --days N             Include events from the last N days (default: 30)
  --sprint N           Scope to Sprint N (reads sprint dates from docs/)
  --help, ?help        Show this help

Output saved to: governance/governance-report-{date}.md

Also triggered by: GOVERNANCE REPORT [flags]
```

<skill>ai-assisted-development:governance-report</skill>
