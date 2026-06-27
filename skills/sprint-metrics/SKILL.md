---
name: sprint-metrics
description: >
  Measures three KPIs after a sprint to assess how well the ICEA workflow is working:
  ICEA compliance rate, PR rejection rate, and rework hours. Queries Azure DevOps REST
  API directly. Trigger on: "sprint metrics", "measure sprint", "ICEA compliance rate",
  "PR rejection rate", "rework hours", "sprint KPIs", "plugin health check",
  "how did the sprint go", or any request to report on sprint quality or plugin
  effectiveness after a sprint completes.
---

## Purpose

Produce a three-metric KPI report for a completed sprint by querying Azure DevOps.
Use after every sprint to track whether the ICEA workflow is improving code quality
and reducing rework over time.

**Metrics produced:**
1. **ICEA Compliance Rate** — % of tickets that reached Active with an approved ICEA
2. **PR Rejection Rate** — % of PRs abandoned or never merged
3. **Rework Hours** — hours logged on Bug work items created during the sprint

See `references/metrics-guide.md` for manual measurement instructions and threshold
interpretation guidance.

---

## Step 1 — Resolve PAT and Connection

Check the environment for `$AZURE_DEVOPS_PAT`:

```bash
echo $AZURE_DEVOPS_PAT
```

- If set and non-empty: use it silently
- If not set: prompt —
  > "Your `AZURE_DEVOPS_PAT` environment variable is not set. Paste your ADO Personal
  > Access Token (required scopes: **Work Items → Read**, **Code → Read**). It will
  > not be stored."

ADO coordinates — read from CLAUDE.md:

```bash
grep -E "^- Organization\s*:" CLAUDE.md 2>/dev/null | sed 's/.*: *//'
grep -E "^- Project\s*:" CLAUDE.md 2>/dev/null | sed 's/.*: *//'
```

Extract `ADO_ORG` and `ADO_PROJECT` from these values. If CLAUDE.md is missing or
the fields are absent, ask the developer:
> "What is your ADO organization name and project name?"

Build the base URL: `https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}`

Build the auth header for all subsequent calls:
```bash
AUTH=$(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)
# Use as: -H "Authorization: Basic $AUTH"

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: C_
```


---

## Step 2 — Get Sprint Scope

Accept arguments in this priority order:

| Input form | Example | Resolution |
|---|---|---|
| `sprint=<name>` | `sprint=Sprint 5` | Call ADO Iterations API to get start/finish dates |
| `from=<date> to=<date>` | `from=2026-05-01 to=2026-05-31` | Use directly as date range |
| Neither | — | Ask: "Provide sprint name (e.g. sprint=Sprint 5) or date range (from=YYYY-MM-DD to=YYYY-MM-DD)" |

**Resolving sprint name to dates:**
```bash
curl -s --ssl-no-revoke -4 \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/work/teamsettings/iterations?api-version=7.1" \
  -H "Authorization: Basic $AUTH"
```
Find the iteration where `.name` matches the provided sprint name. Extract
`.attributes.startDate` and `.attributes.finishDate`.

If no iteration matches, output the available sprint names and ask the user to
pick one.

Hold `SPRINT_START` and `SPRINT_END` (ISO 8601 date strings) for use in Steps 3–5.

---

## Step 3 — ICEA Compliance Rate

**Query work items that moved to Active during the sprint:**

```bash
curl -s --ssl-no-revoke -4 -X POST \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/wit/wiql?api-version=7.1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "query": "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.TeamProject] = '\''${ADO_PROJECT}'\'' AND [System.State] = '\''Active'\'' AND [System.ChangedDate] >= '\''SPRINT_START'\'' AND [System.ChangedDate] <= '\''SPRINT_END'\'' ORDER BY [System.Id]"
  }'
```

For each work item ID returned, fetch its description:
```bash
curl -s --ssl-no-revoke -4 \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/wit/workitems/{id}?fields=System.Description,System.Title&api-version=7.1" \
  -H "Authorization: Basic $AUTH"
```

Mark an item as **ICEA-compliant** if its description contains BOTH:
- The string `Intent:` (case-insensitive)
- The string `Acceptance:` (case-insensitive)

Track non-compliant item IDs for the report.

**Calculate:**
```
ICEA Compliance Rate = (compliant_count / total_count) × 100
```

If total_count is 0: output "No work items moved to Active during this period."

---

## Step 4 — PR Rejection Rate

**Query all PRs created during the sprint:**

```bash
curl -s --ssl-no-revoke -4 \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/git/pullrequests?searchCriteria.status=all&searchCriteria.minTime=SPRINT_START&searchCriteria.maxTime=SPRINT_END&\$top=200&api-version=7.1" \
  -H "Authorization: Basic $AUTH"
```

From the response array, count:
- `completed_count` — items where `.status == "completed"`
- `abandoned_count` — items where `.status == "abandoned"`

Track abandoned PR IDs and titles for the report.

**Calculate:**
```
PR Rejection Rate = (abandoned_count / (abandoned_count + completed_count)) × 100
```

If abandoned + completed = 0: output "No PRs were completed or abandoned in this period."
Active/open PRs are excluded — they have not been decided yet.

---

## Step 5 — Rework Hours

**Query Bug work items created during the sprint:**

```bash
curl -s --ssl-no-revoke -4 -X POST \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/wit/wiql?api-version=7.1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "query": "SELECT [System.Id], [System.Title], [Microsoft.VSTS.Scheduling.CompletedWork] FROM WorkItems WHERE [System.TeamProject] = '\''${ADO_PROJECT}'\'' AND [System.WorkItemType] = '\''Bug'\'' AND [System.CreatedDate] >= '\''SPRINT_START'\'' AND [System.CreatedDate] <= '\''SPRINT_END'\'' ORDER BY [System.Id]"
  }'
```

For each bug ID, fetch `Microsoft.VSTS.Scheduling.CompletedWork`:
```bash
curl -s --ssl-no-revoke -4 \
  "https://dev.azure.com/{ADO_ORG}/{ADO_PROJECT}/_apis/wit/workitems/{id}?fields=System.Title,Microsoft.VSTS.Scheduling.CompletedWork&api-version=7.1" \
  -H "Authorization: Basic $AUTH"
```

Sum all `CompletedWork` values.

If all values are 0 or null (time tracking not in use):
- Fall back: `estimated_hours = bug_count × 2`
- Note in output: "Time tracking fields are empty — showing estimate at 2h per bug."

**Rework % (if sprint capacity is known):**
```
Rework % = (rework_hours / sprint_capacity_hours) × 100
```
If sprint capacity is unknown, show hours only and omit the %.

---

## Step 5b — Cost-Side Metrics (local artifacts, no ADO needed)

The three KPIs above measure the plugin's benefits. These four measure its
costs — without both sides, "is the team better off?" is unanswerable.
All four come from artifacts the plugin already writes:

**Time-in-gate** — for each ICEA file in `docs/Release*/Sprint*/`, the gap
between the file's creation timestamp and the timestamp of its `Status: Approved`
line (git log on the file gives both events: `git log --follow --format="%aI" -- {file}`).
Report median and p90 across the sprint.

**Critic retries** — count REVISE verdicts in the sprint's session logs
(`grep -c "REVISE" {session files}` scoped to the sprint window). Retries per
generated artifact > 1.0 average suggests over-strict critic or under-specified ICEAs.

**Gate overrides** — count `--skip-icea-check` and `--skip-security-gate` and
`SKIP_FINDINGS_GATE` occurrences in commit messages and PR draft artifacts for
the sprint window: `git log --since={start} --until={end} --grep="skip-icea\|skip-security\|SKIP_FINDINGS"`.
Rising overrides are the earliest warning that a gate has become friction.

**Manifest predictability** — for each ICEA in the sprint with a recorded
`Manifest accuracy:` line, aggregate precision and recall (median, per tier and
per feature area from the domain-map). This is the trust-calibration trend
(change-manifest-spec §6): sustained high accuracy per category is the evidence
basis for any future flow-mode recommendation; it is reported as
PREDICTABILITY, never as correctness.

**Dismissal churn** — count dismiss → re-open → re-dismiss cycles in the three
ledgers' Dismissed sections (entries whose history note shows a prior dismissal).
Churn > 2 per sprint means the verify-flag flow is generating busywork.

---

## Step 6 — Output KPI Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sprint Metrics — {sprint name or date range}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BENEFIT SIDE
1. ICEA Compliance Rate
   Tickets moved to Active : {total}
   With approved ICEA      : {compliant}
   Rate                    : {rate}%   {✅ / ⚠️ / ❌}

2. PR Rejection Rate
   PRs completed           : {completed}
   PRs abandoned           : {abandoned}
   Rate                    : {rate}%   {✅ / ⚠️ / ❌}

3. Rework Hours
   Bug items raised        : {count}
   Completed Work logged   : {hours}h  {estimated if time tracking empty}
   Rework %                : {rate}%   {✅ / ⚠️ / ❌}  (if capacity known)

COST SIDE
4. Time-in-gate            : median {m}min · p90 {p}min   {✅ ≤15m / ⚠️ / ❌ >60m}
5. Critic retries          : {r} per artifact              {✅ ≤0.5 / ⚠️ / ❌ >1.0}
6. Gate overrides          : {n} this sprint               {✅ 0 / ⚠️ 1–2 / ❌ ≥3}
7. Dismissal churn         : {c} re-dismiss cycles         {✅ 0–1 / ⚠️ 2 / ❌ ≥3}
8. Manifest predictability : P {p} · R {r} (median, {n} ICEAs)  — trend per category below

NET-VALUE TREND (vs previous sprint, if prior report exists in docs/)
   {metric}: {arrow} {delta}   — publish the trend, not a victory number.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thresholds:
  ICEA compliance  ✅ ≥ 90% | ⚠️ 70–89% | ❌ < 70%
  PR rejection     ✅ ≤ 10% | ⚠️ 11–25% | ❌ > 25%
  Rework %         ✅ ≤ 5%  | ⚠️ 6–10%  | ❌ > 10%
```

**Follow with detail lists:**

If any non-compliant work items: list each with ID and title.
If any abandoned PRs: list each with ID and title.
If any bug items: list each with ID, title, and hours logged.

End with:
```
Next: run /sprint-metrics again after Sprint {n+1} to track trend.
Log these results in your sprint retrospective.
```

---

## Invocation Examples

```
/sprint-metrics sprint=Sprint 1
/sprint-metrics from=2026-05-01 to=2026-05-31
/sprint-metrics sprint=Sprint 3 capacity=320
```

The optional `capacity=` argument sets total sprint capacity in hours for
the rework % calculation (e.g. 8 developers × 5 days × 8h = 320h).

---

## Model routing

This skill is in the **infrastructure tier** — it uses `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

ADO KPI reporting — reads work items and PRs via REST API

To override for this project:
```json
{ "env": { "INFRA_MODEL": "claude-opus-4-6" } }
```

See `../shared/model-routing-spec.md` for the full routing specification.

---

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`../shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.

---

## Hard Rules

- NEVER fabricate metric values — if a query returns an error, show the HTTP status
  and message, mark that metric as ❓ Unavailable, and continue with the others
- ALWAYS show raw counts alongside percentages — never percentages alone
- NEVER skip the detail lists — the IDs are what the team acts on
- If sprint capacity is not provided, omit the rework % row entirely rather than
  guessing capacity
