---
name: release-metrics
description: >
  Generate a comprehensive metrics report for all stories in a release or sprint.
  Produces two files: a Markdown report with Mermaid diagrams (for repos, wikis, PPT)
  and a self-contained HTML report with Chart.js (shareable with stakeholders).
  Triggers on: "METRICS RELEASE-{N}", "METRICS RELEASE-{N} SPRINT-{S}",
  "LESSONS RELEASE-{N}", or any request to generate release metrics, improvement
  trends, token analysis, or lessons learned across stories.
---

# Release Metrics Skill

_Skill version: 1.0 · Last changed: 2026-09-18 · Plugin compatibility: ≥3.25.0 · Consent: C_

## Purpose

Aggregate `ai-audit.md`, `tracker.md`, ICEA files, and ledgers across all ADOs in a
release or sprint. Produce:

1. **`release-metrics-R{N}-{date}.md`** — Markdown with Mermaid diagrams. Lives in the
   repo, renders in VS Code preview, ADO wikis, GitHub. Export to PPT via Marp or Pandoc.
2. **`release-metrics-R{N}-{date}.html`** — Chart.js self-contained HTML. Bundled inline,
   no internet required. Attach and share with stakeholders.

Both files are written to `release-metrics/` at the repo root.

---

## Resolve PLUGIN_DIR — do this first

Read `.claude/plugin-path.txt` to get PLUGIN_DIR. If absent or empty, use the §1a resolver
in CLAUDE.md. All `$PLUGIN_DIR` references below use this value.

---

## Pre-flight — Verify Chart.js vendor file

`chart.min.js` ships with the plugin and requires no setup — it lives at
`$PLUGIN_DIR/skills/release-metrics/vendor/chart.min.js` and is shared across
all target projects that use the plugin. This check is a corrupted-install guard only.

```bash
CHARTJS="$PLUGIN_DIR/skills/release-metrics/vendor/chart.min.js"
if [ -f "$CHARTJS" ]; then
  echo "CHARTJS_OK"
else
  echo "CHARTJS_MISSING"
fi
```

If `CHARTJS_MISSING`:
```
⛔ chart.min.js is missing from the plugin installation.
   This indicates a corrupted or incomplete plugin install.

   Repair options:
   1. Run /setup-sync to re-provision the plugin
   2. Or re-download manually (one-time):
      node "{PLUGIN_DIR}/skills/release-metrics/vendor/fetch-vendor.js"

   Then re-run:  METRICS RELEASE-{N}
```

**Stop immediately. Do not collect data or generate any output.**
Only proceed when `CHARTJS_OK` is confirmed.

---

## Step 1 — Resolve parameters

Extract from the triggering keyword:
- `RELEASE_ID` — e.g. `3` from `METRICS RELEASE-3`
- `SPRINT_ID` — optional, e.g. `12` from `METRICS RELEASE-3 SPRINT-12`
- `COMPARE_RELEASE` — optional, e.g. `2` from `METRICS RELEASE-3 VS RELEASE-2`

If RELEASE_ID is missing, ask:
```
Which release should I report on?
  Release #: [e.g. 3]
  Sprint #:  [optional — leave blank for the full release]
  Compare to release #: [optional — for trend charts]
```

Set output path:
```bash
mkdir -p release-metrics
REPORT_DATE=$(date '+%Y-%m-%d')
SCOPE_LABEL="R${RELEASE_ID}${SPRINT_ID:+-S${SPRINT_ID}}"
MD_FILE="release-metrics/release-metrics-${SCOPE_LABEL}-${REPORT_DATE}.md"
HTML_FILE="release-metrics/release-metrics-${SCOPE_LABEL}-${REPORT_DATE}.html"
```

---

## Step 2 — Discover all ADOs in scope

```bash
SCOPE_DIR="docs/Release${RELEASE_ID}${SPRINT_ID:+/Sprint${SPRINT_ID}}"

# Find all audit files in scope
AUDIT_FILES=$(find "$SCOPE_DIR" -name "ADO-*-*.ai-audit.md" 2>/dev/null | sort)
echo "ADOs found: $(echo "$AUDIT_FILES" | wc -l)"
```

For each audit file found, derive:
```bash
# Extract ADO_ID from filename pattern ADO-{ID}-{feature}.ai-audit.md
ADO_ID=$(basename "$f" | grep -oP 'ADO-\K[0-9]+')
STORY_DIR=$(dirname "$f")
```

If zero ADOs found:
```
⚠ No audit files found under {SCOPE_DIR}.
  Ensure stories have been implemented with ai-audit.md files present.
  Check path: docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/
```

---

## Step 3 — For each ADO, build a data record

For every ADO discovered, read and parse these files (all Category C — no source files):

### 3a. Parse `ai-audit.md`

Read the audit file. Parse each table row. Extract:

| Field | Source |
|---|---|
| `plan_revisions` | count rows where Event = `plan-revised` |
| `icea_revisions` | count rows where Event = `icea-revised` |
| `icea_critic_retries` | count rows where Event = `icea-critic-revise` |
| `tech_revisions` | count rows where Event = `tech-revised` |
| `tech_critic_retries` | count rows where Event = `tech-critic-revise` |
| `code_critic_retries` | count rows where Event = `code-critic-revise` |
| `goal_loop_iters` | count rows where Event = `goal-loop-iter` |
| `build_issues` | count rows where Event = `build-issue` |
| `phase_timestamps` | ISO timestamps of `plan-generated`, `icea-saved`, `tech-saved`, `impl-started`, `story-complete`, `checkin-pass` |
| `revision_themes` | Summary column text from all `*-revised` and `*-critic-revise` rows |

**Phase durations** (minutes, computed from ISO timestamps):
- `plan_duration` = icea-saved − plan-generated
- `icea_duration` = tech-saved − icea-saved  
- `tech_duration` = impl-started − tech-saved
- `impl_duration` = story-complete − impl-started
- `review_duration` = checkin-pass − story-complete

### 3b. Parse `tracker.md`

```bash
TRACKER=$(find "$STORY_DIR" -name "ADO-${ADO_ID}-*.tracker.md" 2>/dev/null | head -1)
```

Extract:
- `follow_up_count` — count rows in each `### Follow-ups / bugs fixed` table (sum across all stories for EPICs)
- `story_status` — Status from each `## Story N` or `## Implementation` section
- `lessons_actions` — all `- [ ]` bullet lines from every `### Lessons learned` section

### 3c. Parse `icea.md`

```bash
ICEA=$(find "$STORY_DIR" -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null | head -1)
```

Extract:
- `sp_estimate` — Story Points from Tech Spec sizing (look for `Total SP:`)
- `ac_count` — count AC-F* lines
- `story_type` — `STORY` or `EPIC`

### 3d. Parse code-review and security ledgers

```bash
CR_LEDGER=$(find . -name "code-review-ledger.md" 2>/dev/null | head -1)
SEC_LEDGER=$(find . -name "security-ledger.md" 2>/dev/null | head -1)
```

For each ledger, count rows where the ADO ID appears in the finding entry:
- `cr_findings` — total code-review findings linked to this ADO
- `cr_high` / `cr_medium` / `cr_low` — by severity
- `sec_findings` / `sec_high` / `sec_medium` / `sec_low` — same for security

### 3e. Token estimation (if ISO timestamps available)

```bash
SESSION_DIR=$(node -e "const os=require('os'),path=require('path');
  const base=path.join(os.homedir(),'.claude','projects');
  const dirs=require('fs').readdirSync(base);
  process.stdout.write(dirs.map(d=>path.join(base,d)).join('\n'));" 2>/dev/null)
```

For each phase window (plan-generated → icea-saved, icea-saved → tech-saved, etc.),
find session JSONL files whose entries overlap the window. Sum `input_tokens` +
`output_tokens` from matching turns.

Store per-phase token counts: `tokens_plan`, `tokens_icea`, `tokens_tech`, `tokens_impl`,
`tokens_review`. If timestamps are missing or session files not found, set to `null` and
omit token charts from the report.

---

## Step 4 — Compute aggregated metrics

After building all per-ADO records, compute release-level aggregates:

```
avg_plan_revisions     = mean(plan_revisions) across all ADOs
avg_icea_revisions     = mean(icea_revisions)
avg_tech_revisions     = mean(tech_revisions)
avg_code_retries       = mean(code_critic_retries)
avg_build_issues       = mean(build_issues)
avg_follow_ups         = mean(follow_up_count)
avg_sp                 = mean(sp_estimate)
total_sp               = sum(sp_estimate)
rework_rate            = avg_follow_ups / avg_ac_count   (follow-ups per AC)
planning_depth         = avg_icea_revisions + avg_tech_revisions
```

**Recurring lessons** — aggregate all `lessons_actions` bullets across ADOs:
Group by theme. Count occurrences. Sort descending. Top 8 = Pareto data.

**Compare with previous release** (if `COMPARE_RELEASE` set or previous release data exists):
```bash
PREV_REPORT=$(find release-metrics/ -name "release-metrics-R${COMPARE_RELEASE}-*.md" 2>/dev/null | sort | tail -1)
```
Parse previous report's summary table to extract prior averages for trend deltas.

---

## Step 5 — Generate Markdown report with Mermaid diagrams

Write `$MD_FILE`. Structure:

```markdown
# Release {N} Metrics Report{Sprint suffix}
Generated: {YYYY-MM-DD} · ADOs: {count} · Total SP: {total_sp}

## Executive Summary
| Metric | This Release | {Prev Release} | Δ |
|---|---|---|---|
| Avg ICEA revisions / story | {avg} | {prev} | {delta %} |
| Avg code critic retries / story | {avg} | ... | ... |
| Avg follow-ups / story | {avg} | ... | ... |
| Avg build issues / story | {avg} | ... | ... |
| Rework rate (follow-ups/AC) | {avg} | ... | ... |

## Chart 1 — Revision depth per story
{Mermaid xychart-beta bar — one bar per ADO, value = total revisions across all phases}

## Chart 2 — Revision by phase (stacked approximation)
{Three Mermaid xychart-beta bar charts side-by-side in MD — one per major phase group:
 Planning (plan+icea+tech revisions), Code (critic retries), Build (build issues)}

## Chart 3 — Release trend
{Mermaid xychart-beta line — only if previous release data available;
 three lines: ICEA revisions, follow-ups, build issues across releases}

## Chart 4 — Story quality matrix
{Mermaid quadrantChart — x=ICEA revisions (normalised), y=follow-ups (normalised),
 one data point per ADO labelled with ADO ID}

## Chart 5 — Top recurring issues (Pareto)
{Mermaid xychart-beta bar — top 8 lesson themes by story count}

## Chart 6 — Token distribution
{Mermaid pie — only if token data available; segments = phase names}

## Chart 7 — Phase timeline (sample story)
{Mermaid gantt — for the ADO with most phases populated; shows phase durations}

## Chart 8 — Lessons mindmap
{Mermaid mindmap — root = Release {N} Lessons; branches = top themes;
 leaves = specific actionable items from lessons_actions}

## Per-Story Detail
| ADO | Type | SP | ICEA rev | Tech rev | Code retries | Follow-ups | Build issues | Status |
|---|---|---|---|---|---|---|---|---|
| ADO-{ID} | STORY | {SP} | {N} | {N} | {N} | {N} | {N} | ✅ Done |

## Release Lessons Synthesis
{Narrative paragraph summarising the top 3 recurring patterns and their release-level
 recommendations — derived from recurring lessons_actions themes}
```

**Mermaid syntax rules:**
- `xychart-beta`: always include `title`, `x-axis`, `y-axis` with explicit range, then `bar` or `line`
- `pie`: always include `title` and at least 2 segments
- `quadrantChart`: always include `title`, axis labels, and quadrant labels
- `mindmap`: root in double-parens `((root))`; max 3 levels deep for readability
- `gantt`: use `dateFormat YYYY-MM-DDTHH:mm:ss` when ISO timestamps are available

---

## Step 6 — Generate self-contained HTML report with Chart.js

Write `$HTML_FILE`. The file must be fully self-contained — no external URLs.

### Chart.js bundling

Chart.js is guaranteed present by the pre-flight check. Read and embed it inline:

```bash
CHARTJS_INLINE=$(cat "$PLUGIN_DIR/skills/release-metrics/vendor/chart.min.js")
```

### HTML structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Release {N} Metrics — {date}</title>
  <style>
    /* Dark-mode aware, print-friendly, tab navigation */
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px;
           background: #f8f9fa; color: #212529; }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a2e; color: #e0e0e0; }
      .card { background: #16213e; border-color: #0f3460; }
    }
    @media print { .tab-nav { display: none; } .tab-panel { display: block !important; } }
    .tab-nav { display: flex; gap: 4px; margin-bottom: 20px; }
    .tab-btn { padding: 8px 16px; border: 1px solid #dee2e6; border-radius: 4px;
               cursor: pointer; background: white; }
    .tab-btn.active { background: #0d6efd; color: white; border-color: #0d6efd; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .card { background: white; border: 1px solid #dee2e6; border-radius: 8px;
            padding: 20px; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 16px; margin-bottom: 24px; }
    .kpi { background: white; border: 1px solid #dee2e6; border-radius: 8px;
           padding: 16px; text-align: center; }
    .kpi-value { font-size: 2rem; font-weight: 700; color: #0d6efd; }
    .kpi-delta.pos { color: #198754; }  /* improvement */
    .kpi-delta.neg { color: #dc3545; }  /* regression */
    .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    canvas { max-height: 320px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 12px; border: 1px solid #dee2e6; text-align: left; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:nth-child(even) { background: #f8f9fa; }
  </style>
</head>
<body>

<h1>Release {N} Metrics Report{Sprint suffix}</h1>
<p style="color:#6c757d">{YYYY-MM-DD} · {count} ADOs · {total_sp} SP total</p>

<!-- KPI cards -->
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-value">{avg_icea_revisions}</div>
    <div>Avg ICEA revisions</div>
    <div class="kpi-delta {pos|neg}">{delta vs prev}</div>
  </div>
  <!-- repeat for: avg_code_retries, avg_follow_ups, avg_build_issues, rework_rate -->
</div>

<!-- Tab navigation -->
<nav class="tab-nav">
  <button class="tab-btn active" onclick="showTab('summary')">Summary</button>
  <button class="tab-btn" onclick="showTab('story')">Per-Story</button>
  <button class="tab-btn" onclick="showTab('trends')">Trends</button>
  <button class="tab-btn" onclick="showTab('lessons')">Lessons</button>
  <button class="tab-btn" onclick="showTab('tokens')">Tokens</button>
</nav>

<!-- Tab: Summary -->
<div id="tab-summary" class="tab-panel active">
  <div class="chart-row">
    <div class="card"><canvas id="chartRevisionByPhase"></canvas></div>
    <div class="card"><canvas id="chartRadar"></canvas></div>
  </div>
  <div class="card"><canvas id="chartQualityScatter"></canvas></div>
</div>

<!-- Tab: Per-Story -->
<div id="tab-story" class="tab-panel">
  <div class="card"><canvas id="chartStackedBar"></canvas></div>
  <div class="card">
    <!-- Sortable per-ADO table: ADO | Type | SP | ICEA rev | Tech rev |
         Code retries | Follow-ups | Build issues | Status -->
  </div>
</div>

<!-- Tab: Trends -->
<div id="tab-trends" class="tab-panel">
  <div class="card"><canvas id="chartTrendLines"></canvas></div>
  <div class="card"><canvas id="chartAreaTokenTrend"></canvas></div>
</div>

<!-- Tab: Lessons -->
<div id="tab-lessons" class="tab-panel">
  <div class="chart-row">
    <div class="card"><canvas id="chartPareto"></canvas></div>
    <div class="card"><!-- Lessons narrative text --></div>
  </div>
</div>

<!-- Tab: Tokens -->
<div id="tab-tokens" class="tab-panel">
  <div class="chart-row">
    <!-- One donut per ADO (or combined donut for release) -->
  </div>
  <div class="card"><canvas id="chartTokenByPhase"></canvas></div>
</div>

<script>{CHARTJS_INLINE}</script>
<script>
/* Tab switching */
function showTab(id) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  event.target.classList.add('active');
}

/* Data — injected by skill */
const DATA = {SERIALISED_JSON_DATA_MODEL};

/* Chart: Stacked bar — revision by phase per ADO (Tab: Per-Story) */
new Chart(document.getElementById('chartStackedBar'), {
  type: 'bar',
  data: {
    labels: DATA.ados.map(a => 'ADO-' + a.id),
    datasets: [
      { label: 'Plan revisions',     data: DATA.ados.map(a => a.plan_revisions),     backgroundColor: '#adb5bd' },
      { label: 'ICEA revisions',     data: DATA.ados.map(a => a.icea_revisions),     backgroundColor: '#0d6efd' },
      { label: 'Tech revisions',     data: DATA.ados.map(a => a.tech_revisions),     backgroundColor: '#6610f2' },
      { label: 'Code critic retries',data: DATA.ados.map(a => a.code_critic_retries),backgroundColor: '#fd7e14' },
      { label: 'Build issues',       data: DATA.ados.map(a => a.build_issues),       backgroundColor: '#dc3545' },
    ]
  },
  options: { plugins: { title: { display: true, text: 'Revision depth by phase — per story' }},
             scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'Count' }}},
             responsive: true }
});

/* Chart: Radar — quality dimensions per release (Tab: Summary) */
new Chart(document.getElementById('chartRadar'), {
  type: 'radar',
  data: {
    labels: ['Planning quality', 'Code quality', 'Build quality', 'Rework rate', 'Goal-loop efficiency'],
    datasets: [{
      label: 'Release {N}',
      data: [DATA.scores.planning, DATA.scores.code, DATA.scores.build,
             DATA.scores.rework, DATA.scores.goalloop],
      fill: true, backgroundColor: 'rgba(13,110,253,0.2)', borderColor: '#0d6efd'
    }]
  },
  options: { plugins: { title: { display: true, text: 'Quality dimensions — Release {N}' }},
             scales: { r: { min: 0, max: 10 }}, responsive: true }
});

/* Chart: Scatter — ICEA revisions vs follow-ups (Tab: Summary) */
new Chart(document.getElementById('chartQualityScatter'), {
  type: 'scatter',
  data: {
    datasets: [{
      label: 'Stories',
      data: DATA.ados.map(a => ({ x: a.icea_revisions, y: a.follow_up_count, label: 'ADO-' + a.id })),
      backgroundColor: '#0d6efd', pointRadius: 6
    }]
  },
  options: {
    plugins: {
      title: { display: true, text: 'ICEA revision depth vs rework (follow-ups)' },
      tooltip: { callbacks: { label: ctx => ctx.raw.label + ' — ICEA: ' + ctx.raw.x + ', Follow-ups: ' + ctx.raw.y }}
    },
    scales: {
      x: { title: { display: true, text: 'ICEA revisions' }},
      y: { title: { display: true, text: 'Follow-ups' }}
    },
    responsive: true
  }
});

/* Chart: Trend lines (Tab: Trends) — only when previous release data available */
new Chart(document.getElementById('chartTrendLines'), {
  type: 'line',
  data: {
    labels: DATA.releases,   /* e.g. ['R1','R2','R3'] */
    datasets: [
      { label: 'Avg ICEA revisions', data: DATA.trends.icea_revisions, borderColor: '#0d6efd', tension: 0.3 },
      { label: 'Avg follow-ups',     data: DATA.trends.follow_ups,     borderColor: '#dc3545', tension: 0.3 },
      { label: 'Avg build issues',   data: DATA.trends.build_issues,   borderColor: '#fd7e14', tension: 0.3 },
      { label: 'Avg code retries',   data: DATA.trends.code_retries,   borderColor: '#6610f2', tension: 0.3 },
    ]
  },
  options: { plugins: { title: { display: true, text: 'Key metrics trend across releases' }},
             scales: { y: { title: { display: true, text: 'Avg per story' }}}, responsive: true }
});

/* Chart: Pareto — recurring issues (Tab: Lessons) */
new Chart(document.getElementById('chartPareto'), {
  type: 'bar',
  data: {
    labels: DATA.issues.map(i => i.theme),
    datasets: [
      { label: 'Stories affected', data: DATA.issues.map(i => i.count),
        backgroundColor: '#0d6efd', yAxisID: 'y' },
      { label: 'Cumulative %', data: DATA.issues.map(i => i.cumulative_pct),
        type: 'line', borderColor: '#dc3545', yAxisID: 'y2', tension: 0 }
    ]
  },
  options: {
    plugins: { title: { display: true, text: 'Top recurring issues — stories affected' }},
    scales: {
      y:  { title: { display: true, text: 'Stories' }},
      y2: { position: 'right', title: { display: true, text: 'Cumulative %' }, max: 100,
             grid: { drawOnChartArea: false }}
    },
    responsive: true
  }
});

/* Chart: Token donut per story (Tab: Tokens) — only when token data available */
/* One Chart.js doughnut per ADO using tokens_plan/icea/tech/impl/review */
/* Skip entirely if all token values are null */
</script>
</body>
</html>
```

### Serialised data model

Before closing `</script>`, replace `{SERIALISED_JSON_DATA_MODEL}` with the actual JSON
object built from all ADO records in Step 3. Structure:

```json
{
  "release": 3,
  "sprint": null,
  "generated": "2026-09-18",
  "releases": ["R1", "R2", "R3"],
  "ados": [
    {
      "id": "1847", "type": "STORY", "sp": 3,
      "plan_revisions": 1, "icea_revisions": 5, "icea_critic_retries": 1,
      "tech_revisions": 2, "tech_critic_retries": 0,
      "code_critic_retries": 2, "goal_loop_iters": 1,
      "build_issues": 1, "follow_up_count": 4,
      "ac_count": 6, "status": "Done",
      "tokens_plan": 8200, "tokens_icea": 22400,
      "tokens_tech": 18100, "tokens_impl": 42000,
      "tokens_review": 7300
    }
  ],
  "aggregates": {
    "avg_icea_revisions": 2.8, "avg_tech_revisions": 1.4,
    "avg_code_retries": 1.6, "avg_build_issues": 1.1, "avg_follow_ups": 3.9
  },
  "scores": {
    "planning": 7.2, "code": 6.8, "build": 8.1, "rework": 6.5, "goalloop": 8.4
  },
  "trends": {
    "icea_revisions": [5.1, 4.2, 2.8],
    "follow_ups": [5.2, 4.8, 3.9],
    "build_issues": [1.8, 1.4, 1.1],
    "code_retries": [2.3, 2.0, 1.6]
  },
  "issues": [
    { "theme": "Auth context missing", "count": 8, "cumulative_pct": 40 },
    { "theme": "Null guard (service)", "count": 6, "cumulative_pct": 70 },
    { "theme": "Neg test missing",     "count": 4, "cumulative_pct": 90 },
    { "theme": "Open Q saved to TECH", "count": 2, "cumulative_pct": 100 }
  ]
}
```

**Score computation (0–10, higher = better):**
- `planning` = 10 − min(avg_icea_revisions, 10)
- `code`     = 10 − min(avg_code_retries × 2, 10)
- `build`    = 10 − min(avg_build_issues × 2, 10)
- `rework`   = 10 − min(avg_follow_ups, 10)
- `goalloop` = 10 − min(avg_goal_loop_iters − 1, 10)  _(1 iteration = perfect; each extra = −1)_

---

## Step 7 — Write both files

Write `$MD_FILE` and `$HTML_FILE`. Both are TEMP_WRITE_EXEMPT — tracking artefacts, no
Write Gate needed.

```bash
mkdir -p release-metrics
# Write Markdown
# Write HTML
```

Confirm:
```
✅ Release {N} metrics generated{sprint suffix}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ADOs analysed : {count}
  Total SP      : {total_sp}
  Date range    : {earliest plan-generated} → {latest story-complete}

  Markdown  → release-metrics/release-metrics-{SCOPE_LABEL}-{date}.md
              Open in VS Code preview (Ctrl+Shift+V) — Mermaid renders inline.

  HTML      → release-metrics/release-metrics-{SCOPE_LABEL}-{date}.html
              Open in browser — Chart.js charts, tabbed navigation, shareable.

  ⚠ Token data: {available for N ADOs / not available — ISO timestamps required}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Vendor setup — one-time step

`$PLUGIN_DIR/skills/release-metrics/vendor/chart.min.js` must exist for HTML charts to
render offline. Run this once after plugin installation:

```bash
node "$PLUGIN_DIR/skills/release-metrics/vendor/fetch-vendor.js"
```

The `fetch-vendor.js` script downloads Chart.js 4.x minified from the official CDN and
saves it to the vendor directory. See `vendor/README.md` for the exact URL and hash
verification.

---

## Hard Rules

- NEVER write source code or config files — this skill writes only to `release-metrics/`
- NEVER fabricate metrics — every number must come from a parsed file; if data is missing
  write `N/A` and note the missing source
- NEVER omit the Markdown file — HTML alone is not sufficient; Markdown is the repo artefact
- ALWAYS include a `⚠ Token data not available` note if token windows cannot be computed
- ALWAYS show the per-ADO detail table in both outputs so individual story data is visible
- ALWAYS compute scores from the formula above — never hard-code quality scores
- ALWAYS include trend charts only when at least one previous release report exists on disk;
  if none found, omit trend tab and note: "Trend data available from Release {N+1} onward"
- ALWAYS handle the case where ai-audit.md exists but has no revision rows (clean story) —
  all revision counts = 0, not null

## Model routing

This skill is in the **review tier** — it uses `REVIEW_MODEL` (default: `claude-sonnet-4-6`).
Data parsing and aggregation are deterministic; generation tier is not needed.
