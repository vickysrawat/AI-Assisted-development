---
description: "Measures three post-sprint KPIs via Azure DevOps — ICEA compliance rate, PR rejection rate, and rework hours. Run after every sprint to track workflow quality over time.  Example: /sprint-metrics sprint=Sprint-23"
argument-hint: "[sprint=<name> | from=<YYYY-MM-DD> to=<YYYY-MM-DD>] [capacity=<hours>] [--help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/sprint-metrics — Post-sprint KPI measurement via Azure DevOps.

Measures: ICEA compliance rate, PR rejection rate, and rework hours.
Queries ADO directly — requires AZURE_DEVOPS_PAT to be set.

Arguments:
  sprint=<name>              Sprint name as it appears in ADO (e.g. sprint=Sprint-23).
  from=<YYYY-MM-DD>          Date range start (alternative to sprint=).
  to=<YYYY-MM-DD>            Date range end (use with from=).
  capacity=<hours>           Total team capacity in hours (for rework % calculation).
  --help, ?help              Show this help.

Examples:
  /sprint-metrics sprint=Sprint-23
  /sprint-metrics from=2026-07-01 to=2026-07-31
  /sprint-metrics sprint=Sprint-23 capacity=160
```

<skill>ai-assisted-development:sprint-metrics</skill>
