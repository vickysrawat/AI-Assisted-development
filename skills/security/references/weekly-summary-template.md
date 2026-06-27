# Weekly Security Summary — HTML Template & Generation Guide

## Data Input Schema

Collect the following from the user before generating. If values are missing, use `"N/A"`.

```
week_start: "DD Mon YYYY"
week_end:   "DD Mon YYYY"
org_name:   "Acme Corp"          # optional

vulnerabilities:
  critical:  { open: N, new: N, closed: N, prev_open: N }
  high:      { open: N, new: N, closed: N, prev_open: N }
  medium:    { open: N, new: N, closed: N, prev_open: N }
  low:       { open: N, new: N, closed: N, prev_open: N }

incidents:
  active:   N
  new:      N
  resolved: N
  details:  [ { id, title, severity, status, summary } ]   # optional

compliance:
  - { framework: "SOC2",       pct_met: 87, prev_pct: 84, status: "Improving" }
  - { framework: "ISO 27001",  pct_met: 79, prev_pct: 79, status: "Stable"    }
  - { framework: "NIST CSF",   pct_met: 72, prev_pct: 75, status: "Degrading" }

findings_by_owner:
  - { owner: "Alice",    critical: 0, high: 2, medium: 4, low: 1 }
  - { owner: "Bob",      critical: 1, high: 1, medium: 2, low: 3 }

actions:
  - { id: "A1", title, owner, due_date, priority: "Critical|High|Medium" }
```

## Risk Trend Logic

Compute overall health score (0–100):
  score = 100
         − (critical_open × 20)
         − (high_open    × 8)
         − (medium_open  × 2)
         − (low_open     × 0.5)
         − (active_incidents × 10)
  Clamp to 0–100.

RAG status:
  ≥ 80  → GREEN  (#22c55e)  "Good"
  60–79 → AMBER  (#f59e0b)  "Needs Attention"
  < 60  → RED    (#ef4444)  "At Risk"

Week-on-week delta: compare score to previous week's equivalent calculation.
  Δ > 0  → ▲ Improving
  Δ = 0  → → Stable
  Δ < 0  → ▼ Degrading

---

## HTML Template

Generate the following complete HTML. Substitute all `{{placeholders}}` with real data.
The file must be fully self-contained (no external CSS/JS dependencies).

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Weekly Security Summary — {{week_start}} to {{week_end}}</title>
<style>
  /* ── Reset & Base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f1f5f9;
    color: #1e293b;
    font-size: 14px;
    line-height: 1.6;
  }
  a { color: inherit; text-decoration: none; }

  /* ── Layout ── */
  .page { max-width: 1100px; margin: 0 auto; padding: 24px 20px 48px; }

  /* ── Header ── */
  .header {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 12px;
    padding: 28px 32px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }
  .header-left h1 { color: #f8fafc; font-size: 22px; font-weight: 700; }
  .header-left p  { color: #94a3b8; font-size: 13px; margin-top: 4px; }
  .header-badge {
    display: flex; align-items: center; gap: 12px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px; padding: 12px 20px;
  }
  .health-score { font-size: 40px; font-weight: 800; line-height: 1; }
  .health-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .08em; }
  .health-status { font-size: 15px; font-weight: 600; margin-top: 2px; }
  .trend { font-size: 12px; color: #94a3b8; margin-top: 3px; }
  .trend.up   { color: #4ade80; }
  .trend.down { color: #f87171; }

  /* ── Section title ── */
  .section-title {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .1em; color: #64748b;
    margin: 28px 0 12px; padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }

  /* ── Cards grid ── */
  .cards { display: grid; gap: 16px; }
  .cards-4 { grid-template-columns: repeat(4, 1fr); }
  .cards-3 { grid-template-columns: repeat(3, 1fr); }
  .cards-2 { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 768px) {
    .cards-4, .cards-3, .cards-2 { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 480px) {
    .cards-4, .cards-3, .cards-2 { grid-template-columns: 1fr; }
  }

  .card {
    background: #fff;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    padding: 18px 20px;
  }
  .card-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
                letter-spacing: .08em; color: #64748b; margin-bottom: 6px; }
  .card-value { font-size: 34px; font-weight: 800; line-height: 1; }
  .card-sub   { font-size: 12px; color: #64748b; margin-top: 6px; }
  .card-sub .up   { color: #16a34a; font-weight: 600; }
  .card-sub .down { color: #dc2626; font-weight: 600; }
  .card-sub .neu  { color: #64748b; font-weight: 600; }

  .sev-critical { color: #dc2626; }
  .sev-high     { color: #ea580c; }
  .sev-medium   { color: #d97706; }
  .sev-low      { color: #65a30d; }
  .sev-info     { color: #0891b2; }

  /* ── Vulnerability detail table ── */
  .vuln-table { width: 100%; border-collapse: collapse; background: #fff;
                border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; }
  .vuln-table th {
    background: #f8fafc; text-align: left; padding: 10px 14px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: #64748b; border-bottom: 1px solid #e2e8f0;
  }
  .vuln-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .vuln-table tr:last-child td { border-bottom: none; }
  .vuln-table tr:hover td { background: #f8fafc; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 99px;
    font-size: 11px; font-weight: 600;
  }
  .badge-critical { background: #fee2e2; color: #991b1b; }
  .badge-high     { background: #ffedd5; color: #9a3412; }
  .badge-medium   { background: #fef3c7; color: #92400e; }
  .badge-low      { background: #dcfce7; color: #166534; }
  .badge-green    { background: #dcfce7; color: #166534; }
  .badge-amber    { background: #fef3c7; color: #92400e; }
  .badge-red      { background: #fee2e2; color: #991b1b; }

  /* ── Compliance bars ── */
  .compliance-list { display: flex; flex-direction: column; gap: 12px; }
  .comp-row { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
  .comp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .comp-name  { font-weight: 600; font-size: 13px; }
  .comp-pct   { font-weight: 700; font-size: 16px; }
  .comp-bar-bg { height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
  .comp-bar-fill { height: 100%; border-radius: 99px; transition: width .3s; }
  .bar-green  { background: #22c55e; }
  .bar-amber  { background: #f59e0b; }
  .bar-red    { background: #ef4444; }
  .comp-footer { display: flex; justify-content: space-between; margin-top: 6px;
                  font-size: 11px; color: #94a3b8; }

  /* ── Incidents ── */
  .incident-list { display: flex; flex-direction: column; gap: 10px; }
  .incident-card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 14px 18px; display: flex; align-items: flex-start; gap: 14px;
  }
  .incident-icon {
    width: 36px; height: 36px; border-radius: 8px; display: flex;
    align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;
  }
  .ic-critical { background: #fee2e2; }
  .ic-high     { background: #ffedd5; }
  .ic-medium   { background: #fef3c7; }
  .incident-body { flex: 1; }
  .incident-title { font-weight: 600; font-size: 13px; }
  .incident-meta  { font-size: 12px; color: #64748b; margin-top: 3px; }

  /* ── Workload table ── */
  .workload-table { width: 100%; border-collapse: collapse; background: #fff;
                    border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; }
  .workload-table th {
    background: #f8fafc; text-align: left; padding: 10px 14px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: #64748b; border-bottom: 1px solid #e2e8f0;
  }
  .workload-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .workload-table tr:last-child td { border-bottom: none; }

  /* ── Actions ── */
  .action-list { display: flex; flex-direction: column; gap: 10px; }
  .action-item {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 14px 18px; display: flex; align-items: center; gap: 14px;
  }
  .action-id   { font-size: 11px; font-weight: 700; color: #94a3b8; width: 32px; flex-shrink: 0; }
  .action-body { flex: 1; }
  .action-title { font-weight: 600; font-size: 13px; }
  .action-meta  { font-size: 12px; color: #64748b; margin-top: 3px; }
  .action-due   { font-size: 12px; font-weight: 600; color: #0f172a; white-space: nowrap; }

  /* ── Footer ── */
  .footer {
    margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8;
    border-top: 1px solid #e2e8f0; padding-top: 20px;
  }
</style>
</head>
<body>
<div class="page">

  <!-- ── HEADER ── -->
  <div class="header">
    <div class="header-left">
      <h1>🔒 Weekly Security Summary</h1>
      <p>{{org_name}} &nbsp;·&nbsp; {{week_start}} – {{week_end}}</p>
    </div>
    <div class="header-badge">
      <div>
        <div class="health-label">Health Score</div>
        <div class="health-score" style="color: {{rag_color}}">{{health_score}}</div>
      </div>
      <div>
        <div class="health-status" style="color: {{rag_color}}">{{rag_label}}</div>
        <div class="trend {{trend_class}}">{{trend_arrow}} {{trend_label}} ({{delta_sign}}{{delta}} pts)</div>
      </div>
    </div>
  </div>

  <!-- ── VULNERABILITY OVERVIEW ── -->
  <div class="section-title">Vulnerability Overview</div>
  <div class="cards cards-4">
    <div class="card">
      <div class="card-label">Critical</div>
      <div class="card-value sev-critical">{{crit_open}}</div>
      <div class="card-sub">
        Open &nbsp;·&nbsp;
        <span class="{{crit_new_class}}">+{{crit_new}} new</span> &nbsp;·&nbsp;
        <span class="up">−{{crit_closed}} closed</span>
      </div>
    </div>
    <div class="card">
      <div class="card-label">High</div>
      <div class="card-value sev-high">{{high_open}}</div>
      <div class="card-sub">
        Open &nbsp;·&nbsp;
        <span class="{{high_new_class}}">+{{high_new}} new</span> &nbsp;·&nbsp;
        <span class="up">−{{high_closed}} closed</span>
      </div>
    </div>
    <div class="card">
      <div class="card-label">Medium</div>
      <div class="card-value sev-medium">{{med_open}}</div>
      <div class="card-sub">
        Open &nbsp;·&nbsp;
        <span class="{{med_new_class}}">+{{med_new}} new</span> &nbsp;·&nbsp;
        <span class="up">−{{med_closed}} closed</span>
      </div>
    </div>
    <div class="card">
      <div class="card-label">Low</div>
      <div class="card-value sev-low">{{low_open}}</div>
      <div class="card-sub">
        Open &nbsp;·&nbsp;
        <span class="{{low_new_class}}">+{{low_new}} new</span> &nbsp;·&nbsp;
        <span class="up">−{{low_closed}} closed</span>
      </div>
    </div>
  </div>

  <!-- Vuln detail table -->
  <div style="margin-top: 16px;">
    <table class="vuln-table">
      <thead>
        <tr>
          <th>Severity</th>
          <th>Open This Week</th>
          <th>Opened</th>
          <th>Closed</th>
          <th>vs Last Week</th>
          <th>Trend</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge badge-critical">Critical</span></td>
          <td>{{crit_open}}</td><td>{{crit_new}}</td><td>{{crit_closed}}</td>
          <td>{{crit_delta_display}}</td><td>{{crit_trend}}</td>
        </tr>
        <tr>
          <td><span class="badge badge-high">High</span></td>
          <td>{{high_open}}</td><td>{{high_new}}</td><td>{{high_closed}}</td>
          <td>{{high_delta_display}}</td><td>{{high_trend}}</td>
        </tr>
        <tr>
          <td><span class="badge badge-medium">Medium</span></td>
          <td>{{med_open}}</td><td>{{med_new}}</td><td>{{med_closed}}</td>
          <td>{{med_delta_display}}</td><td>{{med_trend}}</td>
        </tr>
        <tr>
          <td><span class="badge badge-low">Low</span></td>
          <td>{{low_open}}</td><td>{{low_new}}</td><td>{{low_closed}}</td>
          <td>{{low_delta_display}}</td><td>{{low_trend}}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ── INCIDENT ACTIVITY ── -->
  <div class="section-title">Incident Activity</div>
  <div class="cards cards-3" style="margin-bottom: 16px;">
    <div class="card">
      <div class="card-label">Active Incidents</div>
      <div class="card-value" style="color: {{incidents_active > 0 ? '#dc2626' : '#22c55e'}}">{{incidents_active}}</div>
    </div>
    <div class="card">
      <div class="card-label">New This Week</div>
      <div class="card-value">{{incidents_new}}</div>
    </div>
    <div class="card">
      <div class="card-label">Resolved This Week</div>
      <div class="card-value" style="color: #16a34a;">{{incidents_resolved}}</div>
    </div>
  </div>

  <!-- Incident details (render one block per incident; omit section if none) -->
  {{#if incidents_detail}}
  <div class="incident-list">
    {{#each incident}}
    <div class="incident-card">
      <div class="incident-icon ic-{{severity_class}}">{{severity_icon}}</div>
      <div class="incident-body">
        <div class="incident-title">{{id}} — {{title}}</div>
        <div class="incident-meta">
          <span class="badge badge-{{severity_class}}">{{severity}}</span>
          &nbsp; Status: <strong>{{status}}</strong>
          &nbsp; · &nbsp; {{summary}}
        </div>
      </div>
    </div>
    {{/each}}
  </div>
  {{/if}}

  <!-- ── COMPLIANCE POSTURE ── -->
  <div class="section-title">Compliance Posture</div>
  <div class="compliance-list">
    {{#each framework}}
    <div class="comp-row">
      <div class="comp-header">
        <span class="comp-name">{{framework_name}}</span>
        <span class="comp-pct" style="color: {{bar_color}}">{{pct_met}}%</span>
      </div>
      <div class="comp-bar-bg">
        <div class="comp-bar-fill {{bar_class}}" style="width: {{pct_met}}%"></div>
      </div>
      <div class="comp-footer">
        <span>{{controls_met}} of {{controls_total}} controls met</span>
        <span class="badge badge-{{status_badge}}">{{status}}</span>
      </div>
    </div>
    {{/each}}
  </div>

  <!-- ── FINDINGS BY OWNER ── -->
  {{#if findings_by_owner}}
  <div class="section-title">Findings by Owner</div>
  <table class="workload-table">
    <thead>
      <tr>
        <th>Owner / Team</th>
        <th>Critical</th>
        <th>High</th>
        <th>Medium</th>
        <th>Low</th>
        <th>Total Open</th>
      </tr>
    </thead>
    <tbody>
      {{#each owner}}
      <tr>
        <td><strong>{{owner_name}}</strong></td>
        <td><span class="{{crit > 0 ? 'sev-critical' : ''}}">{{crit}}</span></td>
        <td><span class="{{high > 0 ? 'sev-high' : ''}}">{{high}}</span></td>
        <td>{{medium}}</td>
        <td>{{low}}</td>
        <td><strong>{{total}}</strong></td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{/if}}

  <!-- ── TOP ACTIONS REQUIRED ── -->
  <div class="section-title">Top Actions Required</div>
  <div class="action-list">
    {{#each action}}
    <div class="action-item">
      <div class="action-id">{{action_id}}</div>
      <div class="action-body">
        <div class="action-title">{{action_title}}</div>
        <div class="action-meta">Owner: <strong>{{owner}}</strong> &nbsp;·&nbsp; Priority: <span class="badge badge-{{priority_badge}}">{{priority}}</span></div>
      </div>
      <div class="action-due">Due {{due_date}}</div>
    </div>
    {{/each}}
  </div>

  <!-- ── FOOTER ── -->
  <div class="footer">
    Generated by Claude Security Skill &nbsp;·&nbsp; {{week_start}} – {{week_end}} &nbsp;·&nbsp; Confidential
  </div>

</div>
</body>
</html>
```

---

## Generation Instructions

1. Parse all user-supplied data into the schema above.
2. Calculate `health_score` and RAG status using the formula in the Risk Trend Logic section.
3. Compute week-on-week deltas for each severity tier: `delta = prev_open − open` (positive = improvement).
4. Set `trend_class`: `up` if delta > 0, `down` if delta < 0, empty if 0.
5. For compliance bars: green ≥ 80%, amber 60–79%, red < 60%.
6. For incident severity icons: 🔴 Critical, 🟠 High, 🟡 Medium.
7. Replace every `{{placeholder}}` with real values. Remove `{{#if}}` / `{{#each}}` blocks that
   have no data (e.g. no incidents = remove the incident detail list entirely).
8. Output the complete HTML as a single file. Do not truncate or summarise the HTML.
9. Name the output file: `security-summary-{{week_end_YYYYMMDD}}.html`
