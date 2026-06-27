# Sprint Metrics — Measurement Guide

This guide explains what each KPI means, how the `/sprint-metrics` skill collects it,
how to measure it manually in ADO if needed, and how to interpret and act on the results.

---

## 1. What Each Metric Means

### ICEA Compliance Rate

**Definition:** The percentage of work items that moved to "Active" state during the
sprint with an approved ICEA document (Intent, Context, Examples, Acceptance) attached.

**Why it matters:** ICEA compliance is the primary gate of this workflow. A low rate
means tickets are being activated without clear requirements — the root cause of most
spec drift and rework. A high rate means the team is following the process.

**Example:** 8 of 10 tickets had ICEA → 80% compliance (⚠️ Warning).

---

### PR Rejection Rate

**Definition:** The percentage of pull requests created during the sprint that were
abandoned (closed without merging) rather than completed.

**Why it matters:** Abandoned PRs indicate rework at the code level — a developer
started implementing something, then had to stop, either because the code was wrong,
the spec changed, or review feedback was significant enough to require a restart.
High rejection rates correlate with incomplete ICEAs.

**Example:** 3 PRs abandoned out of 20 created → 15% rejection rate (⚠️ Warning).

---

### Rework Hours

**Definition:** The total hours logged on Bug-type work items that were created during
the sprint. These bugs represent defects introduced by features delivered in this or
previous sprints.

**Why it matters:** Rework hours are the most direct measure of quality cost. Every
hour spent on a bug is an hour not spent on new features. A rising rework trend
indicates the ICEA process is not catching enough acceptance criteria upfront.

**Note:** This metric requires the team to log `Completed Work` on bug items in ADO.
If time tracking is not in use, the skill estimates at 2 hours per bug.

---

## 2. How to Run /sprint-metrics

Open Claude Code in your project and type:

```
/sprint-metrics sprint=Sprint 1
```

Or using a date range instead of a sprint name:

```
/sprint-metrics from=2026-05-01 to=2026-05-31
```

To include rework % (requires total sprint capacity in hours):

```
/sprint-metrics sprint=Sprint 1 capacity=320
```

The capacity figure is: number of developers × working days × 8 hours.
Example: 5 developers × 8 days × 8h = 320h.

The skill will prompt for your `AZURE_DEVOPS_PAT` if it is not already set in
your environment. See the README Prerequisites section for setup instructions.

---

## 3. How to Measure Manually in ADO

Use these steps if the `/sprint-metrics` skill is unavailable or you need to
verify the automated numbers.

### Manual: ICEA Compliance Rate

1. In ADO, go to **Boards → Work Items**.
2. Create a query:
   - Work Item Type = User Story (or Feature, Task — whichever your team activates)
   - State = Active
   - Changed Date >= sprint start date
   - Changed Date <= sprint end date
3. Run the query. Note the total count.
4. Open each work item and check whether the **Description** field contains both
   an **Intent** section and an **Acceptance Criteria** section.
5. Count the items that have both. Divide by total and multiply by 100.

### Manual: PR Rejection Rate

1. In ADO, go to **Repos → Pull Requests**.
2. Switch to the **Completed** tab. Filter by date range (Created Date during sprint).
   Note the count.
3. Switch to the **Abandoned** tab. Apply the same date filter.
   Note the count.
4. Formula: `abandoned / (abandoned + completed) × 100`.

### Manual: Rework Hours

1. In ADO, go to **Boards → Work Items**.
2. Create a query:
   - Work Item Type = Bug
   - Created Date >= sprint start
   - Created Date <= sprint end
3. Run the query. Note the count of bugs.
4. For each bug, open the work item and check the **Completed Work** field
   (in the Effort section on the right panel).
5. Sum all Completed Work values. If empty, use count × 2 hours as an estimate.

---

## 4. Interpreting the Thresholds

| Metric | ✅ Target | ⚠️ Warning | ❌ Action required |
|---|---|---|---|
| ICEA Compliance | ≥ 90% | 70 – 89% | < 70% |
| PR Rejection | ≤ 10% | 11 – 25% | > 25% |
| Rework % of capacity | ≤ 5% | 6 – 10% | > 10% |

**✅ All green:** The workflow is operating as intended. Continue and look for
opportunities to raise the bar (e.g. target 95% ICEA compliance next sprint).

**⚠️ Any warning:** Investigate the specific items flagged in the report.
One or two non-compliant tickets or abandoned PRs often trace back to a single
root cause (a specific developer, a process gap, or unclear scope from a PM).

**❌ Any red:** Stop and hold a process review before the next sprint starts.
Red scores indicate the workflow is not being followed consistently enough to
deliver the benefit. Use the detail lists to identify patterns.

---

## 5. Improving Each Metric

### Improving ICEA Compliance

Low compliance usually has one of three causes:
- Tickets are being moved to Active before the PM has finished the ICEA
- Developers are starting work informally before the ticket is formally activated
- The ICEA template is not being used consistently

**Actions:** Run `/icea-review` on each non-compliant ticket to identify what
is missing. Block ADO state transitions with a workflow rule requiring the
ICEA checklist to be completed before Active is allowed.

### Reducing PR Rejection Rate

High rejection rates correlate with thin ICEAs — developers hit ambiguity mid-sprint
and abandon or restart. They also appear when PR descriptions are written without
running `/pr-describe`, leading to incomplete scope documentation that reviewers
push back on.

**Actions:** Review abandoned PR titles against their source tickets. If the ICEA
acceptance criteria were too vague to implement, update the ICEA template. If PRs
are being abandoned due to reviewer feedback, run `/pr-spec-review` before requesting
human review.

### Reducing Rework Hours

Rework hours spike when acceptance criteria miss edge cases, when QA tasks are
not generated from the ICEA (run `/ado-tasks`), or when integration testing is
skipped. The bug item list in the report will show which features are generating
the most defects.

**Actions:** For each bug, trace it back to its parent feature and check whether
its scenario was covered by an ICEA example. Add the missed scenario as a
new ICEA example for similar future features.

---

## 6. Tracking Over Time

Record each sprint's results in a shared document or spreadsheet with these columns:

| Sprint | ICEA Compliance | PR Rejection | Rework Hours | Rework % | Notes |
|---|---|---|---|---|---|
| Sprint 1 | | | | | Baseline |
| Sprint 2 | | | | | |

**What to watch for:**
- ICEA compliance should reach ≥ 90% by Sprint 3 as the team builds the habit
- PR rejection should drop steadily as ICEA quality improves
- Rework hours may initially rise slightly (better visibility of existing debt)
  before declining by Sprint 4–5

Share the trend table in your sprint retrospective. The goal is not a perfect
score — it is a consistent improvement trajectory.
