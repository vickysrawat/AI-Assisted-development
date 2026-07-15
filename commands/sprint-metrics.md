---
description: Measures three post-sprint KPIs by querying Azure DevOps — ICEA compliance rate, PR rejection rate, and rework hours. Run after every sprint to track whether the ICEA workflow is improving code quality over time.
argument-hint: [sprint=<name> | from=<YYYY-MM-DD> to=<YYYY-MM-DD>] [capacity=<hours>]
---

<skill>sprint-metrics</skill>

## Your task

Run the sprint-metrics skill to produce a three-KPI report for the specified sprint.

---

### Step 1 — Parse arguments

Extract from invocation arguments (in priority order):
- `sprint=<name>` — e.g. `sprint=Sprint 5`
- `from=<date> to=<date>` — e.g. `from=2026-05-01 to=2026-05-31`
- `capacity=<hours>` — optional, enables rework % calculation

If neither sprint name nor date range is provided, ask:
> "Provide sprint name (e.g. `sprint=Sprint 5`) or date range (`from=YYYY-MM-DD to=YYYY-MM-DD`)"

---

### Step 2 — Run the sprint-metrics skill

Read `.claude/plugin-path.txt` to get `PLUGIN_DIR` (if absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`), then:

Read `$PLUGIN_DIR/skills/sprint-metrics/SKILL.md` and follow its instructions exactly,
passing through the resolved sprint scope and optional capacity.

---

### Step 3 — Confirm

After outputting the KPI report, end with:

```
Run /sprint-metrics again after the next sprint to track trend.
Log these results in your sprint retrospective.
```
