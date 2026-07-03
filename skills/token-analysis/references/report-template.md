# Token Analysis Report — HTML Template

The skill populates the data object then generates this report.
Replace all `{{PLACEHOLDER}}` values with real data before writing.

---

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Token Analysis — {{DATE}}</title>
  <style>
    :root {
      --primary: #1a3a5c; --primary-light: #2c5f8a; --accent: #c8a951;
      --bg: #f8f9fa; --card: #ffffff; --text: #2d3436; --muted: #636e72;
      --border: #dfe6e9; --green: #00b894; --amber: #fdcb6e; --red: #e17055;
      --blue: #74b9ff; --critical: #d63031; --high: #e17055;
      --medium: #fdcb6e; --low: #00b894;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',sans-serif; background:var(--bg); color:var(--text); line-height:1.6; }

    /* Hero */
    .hero { background:linear-gradient(135deg,var(--primary),var(--primary-light));
      color:#fff; padding:48px 40px; }
    .hero h1 { font-size:2rem; font-weight:700; margin-bottom:6px; }
    .hero h1 span { color:var(--accent); }
    .hero .meta { font-size:0.88rem; opacity:0.75; margin-top:8px; }
    .hero .kpi-row { display:flex; gap:32px; margin-top:24px; flex-wrap:wrap; }
    .kpi { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2);
      border-radius:10px; padding:16px 24px; min-width:140px; }
    .kpi .val { font-size:1.6rem; font-weight:700; }
    .kpi .lbl { font-size:0.78rem; opacity:0.8; text-transform:uppercase; letter-spacing:0.8px; margin-top:2px; }

    /* Status badge */
    .status { display:inline-block; padding:4px 12px; border-radius:20px;
      font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
    .status.green  { background:rgba(0,184,148,0.15); color:var(--green); border:1px solid var(--green); }
    .status.amber  { background:rgba(253,203,110,0.15); color:#c0882a; border:1px solid var(--amber); }
    .status.red    { background:rgba(225,112,85,0.15); color:var(--red); border:1px solid var(--red); }
    .status.critical { background:rgba(214,48,49,0.1); color:var(--critical); border:1px solid var(--critical); }
    .status.high   { background:rgba(225,112,85,0.1); color:var(--high); border:1px solid var(--high); }
    .status.medium { background:rgba(253,203,110,0.15); color:#c0882a; border:1px solid var(--amber); }
    .status.low    { background:rgba(0,184,148,0.1); color:var(--green); border:1px solid var(--green); }

    /* Container + layout */
    .container { max-width:1140px; margin:0 auto; padding:0 24px; }

    /* TOC */
    .toc { background:var(--card); border:1px solid var(--border); border-radius:12px;
      padding:24px 32px; margin:-28px auto 40px; position:relative; z-index:10;
      box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .toc h3 { font-size:0.75rem; text-transform:uppercase; letter-spacing:1.5px;
      color:var(--muted); margin-bottom:12px; }
    .toc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:6px; }
    .toc a { color:var(--primary); text-decoration:none; font-size:0.9rem;
      padding:5px 8px; border-radius:6px; display:block; }
    .toc a:hover { background:var(--bg); }

    /* Sections */
    .section { margin-bottom:48px; }
    .section-header { display:flex; align-items:center; gap:12px;
      margin-bottom:20px; padding-bottom:12px; border-bottom:2px solid var(--border); }
    .section-header .icon { width:38px; height:38px; background:var(--primary); color:#fff;
      border-radius:10px; display:flex; align-items:center; justify-content:center;
      font-size:1rem; flex-shrink:0; }
    .section-header h2 { font-size:1.4rem; color:var(--primary); }

    /* Cards */
    .card { background:var(--card); border:1px solid var(--border); border-radius:10px;
      padding:24px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
    .card h3 { font-size:1rem; color:var(--primary); margin-bottom:12px; font-weight:600; }
    .card p, .card li { font-size:0.93rem; color:var(--text); }
    .card ul { padding-left:20px; }
    .card ul li { margin-bottom:5px; }

    /* Tables */
    table { width:100%; border-collapse:collapse; background:var(--card);
      border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04);
      border:1px solid var(--border); margin-bottom:20px; font-size:0.88rem; }
    thead th { background:var(--primary); color:#fff; padding:11px 16px;
      text-align:left; font-weight:600; text-transform:uppercase;
      letter-spacing:0.4px; font-size:0.78rem; }
    tbody td { padding:11px 16px; border-bottom:1px solid var(--border); }
    tbody tr:last-child td { border-bottom:none; }
    tbody tr:hover { background:#f1f5f9; }

    /* Progress bar */
    .bar-wrap { background:#e9ecef; border-radius:4px; height:8px; overflow:hidden; }
    .bar { height:8px; border-radius:4px; }
    .bar.green { background:var(--green); }
    .bar.amber { background:var(--amber); }
    .bar.red   { background:var(--red);   }

    /* Prompt card */
    .prompt-card { background:var(--card); border:1px solid var(--border);
      border-radius:10px; padding:20px; margin-bottom:14px;
      box-shadow:0 2px 8px rgba(0,0,0,0.04); }
    .prompt-card .label { font-size:0.72rem; text-transform:uppercase;
      letter-spacing:1px; color:var(--muted); margin-bottom:6px; }
    .prompt-card .original { background:#fff5f5; border-left:3px solid var(--red);
      padding:10px 14px; border-radius:0 6px 6px 0; font-size:0.88rem;
      font-family:monospace; margin-bottom:12px; white-space:pre-wrap; }
    .prompt-card .reason { font-size:0.85rem; color:var(--muted); margin-bottom:12px; }
    .prompt-card .rewritten { background:#f0fdf8; border-left:3px solid var(--green);
      padding:10px 14px; border-radius:0 6px 6px 0; font-size:0.88rem;
      font-family:monospace; white-space:pre-wrap; }
    .prompt-card .saving { margin-top:10px; font-size:0.82rem; color:var(--green);
      font-weight:600; }

    /* Rec card */
    .rec-card { background:var(--card); border:1px solid var(--border);
      border-radius:10px; padding:20px 24px; margin-bottom:12px;
      display:flex; gap:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
    .rec-card .rec-num { width:32px; height:32px; background:var(--accent);
      color:var(--primary); border-radius:50%; display:flex; align-items:center;
      justify-content:center; font-size:0.82rem; font-weight:700; flex-shrink:0; }
    .rec-card .rec-body h4 { font-size:0.95rem; color:var(--primary);
      margin-bottom:4px; font-weight:600; }
    .rec-card .rec-body .finding { font-size:0.85rem; color:var(--muted); margin-bottom:8px; }
    .rec-card .rec-body .action { font-size:0.88rem; color:var(--text); }
    .rec-card .rec-meta { display:flex; gap:8px; align-items:flex-start;
      flex-shrink:0; flex-direction:column; }

    /* Trend indicator */
    .trend { display:inline-flex; align-items:center; gap:8px;
      padding:10px 20px; border-radius:10px; font-weight:600; font-size:0.95rem; }
    .trend.improving { background:rgba(0,184,148,0.1); color:var(--green); }
    .trend.stable    { background:rgba(116,185,255,0.1); color:#0984e3; }
    .trend.degrading { background:rgba(225,112,85,0.1); color:var(--red); }

    /* Session chart */
    .chart-row { display:flex; align-items:center; gap:12px; margin-bottom:8px;
      font-size:0.85rem; }
    .chart-row .session-name { width:200px; white-space:nowrap; overflow:hidden;
      text-overflow:ellipsis; color:var(--muted); flex-shrink:0; }
    .chart-row .bar-wrap { flex:1; }

    /* Footer */
    .footer { background:var(--primary); color:rgba(255,255,255,0.7);
      text-align:center; padding:20px; font-size:0.82rem; margin-top:60px; }

    @media (max-width:768px) {
      .hero { padding:32px 20px; }
      .kpi-row { gap:12px; }
      .toc-grid { grid-template-columns:1fr; }
      .container { padding:0 16px; }
    }
    @media print {
      .toc { display:none; }
      .hero { padding:24px 20px; }
    }
  </style>
</head>
<body>

<!-- HERO -->
<header class="hero">
  <h1>Token Analysis — <span>{{DATE}}</span></h1>
  <p class="meta">{{SESSIONS_ANALYSED}} sessions analysed &bull; Generated by ai-assisted-development plugin</p>
  <div class="kpi-row">
    <div class="kpi">
      <div class="val">~{{ALWAYS_TOKENS}}</div>
      <div class="lbl">Fixed tokens / session</div>
    </div>
    <div class="kpi">
      <div class="val">~{{AVG_SESSION_TOKENS}}</div>
      <div class="lbl">Avg session tokens</div>
    </div>
    <div class="kpi">
      <div class="val">{{AVG_TURNS}}</div>
      <div class="lbl">Avg turns / session</div>
    </div>
    <div class="kpi">
      <div class="val">{{CORRECTION_RATE}}%</div>
      <div class="lbl">Correction turn rate</div>
    </div>
    <div class="kpi">
      <div class="val {{OVERHEAD_STATUS_CLASS}}">{{OVERHEAD_STATUS}}</div>
      <div class="lbl">Overhead health</div>
    </div>
  </div>
</header>

<div class="container">

  <!-- TOC -->
  <nav class="toc">
    <h3>Contents</h3>
    <div class="toc-grid">
      <a href="#static">Fixed Session Overhead</a>
      <a href="#sessions">Session Analysis</a>
      <a href="#expensive">Most Expensive Operations</a>
      <a href="#prompts">Prompt Rewrites</a>
      <a href="#recs">Recommendations</a>
      <a href="#trend">Trend</a>
    </div>
  </nav>

  <!-- SECTION 1: STATIC OVERHEAD -->
  <section id="static" class="section">
    <div class="section-header">
      <div class="icon">⚖</div>
      <h2>Fixed Session Overhead</h2>
    </div>
    <div class="card">
      <p>These tokens are consumed on every session start, before any prompt is typed.
      <strong>Always-loaded total: ~{{ALWAYS_TOKENS}} tokens</strong>
      <span class="status {{OVERHEAD_STATUS_CLASS}}" style="margin-left:10px;">{{OVERHEAD_STATUS}}</span></p>
    </div>
    <table>
      <thead>
        <tr>
          <th>File</th><th>Characters</th><th>Est. Tokens</th>
          <th>Load Type</th><th>% of Always Total</th>
        </tr>
      </thead>
      <tbody>
        <!-- Repeat for each file -->
        {{#each STATIC_FILES as F}}
        <tr>
          <td><code>{{F.name}}</code></td>
          <td>{{F.chars}}</td>
          <td>~{{F.tokens}}</td>
          <td><span class="status {{F.loadTypeClass}}">{{F.loadType}}</span></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="bar-wrap" style="width:100px">
                <div class="bar {{F.barClass}}" style="width:{{F.pct}}%"></div>
              </div>
              <span>{{F.pct}}%</span>
            </div>
          </td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    <div class="card">
      <p><strong>Typical session:</strong> ~{{TYPICAL_TOKENS}} tokens (always-loaded + most common conditionals)</p>
      <p style="margin-top:6px;"><strong>Maximum possible:</strong> ~{{MAX_TOKENS}} tokens (all files loaded)</p>
    </div>
  </section>

  <!-- SECTION 2: SESSION ANALYSIS -->
  <section id="sessions" class="section">
    <div class="section-header">
      <div class="icon">📊</div>
      <h2>Session Analysis</h2>
    </div>

    <!-- Session token chart -->
    <div class="card">
      <h3>Estimated tokens per session</h3>
      {{#each SESSIONS as S}}
      <div class="chart-row">
        <span class="session-name" title="{{S.title}}">{{S.title}}</span>
        <div class="bar-wrap">
          <div class="bar {{S.barClass}}" style="width:{{S.barPct}}%"></div>
        </div>
        <span style="font-size:0.82rem;color:var(--muted);width:80px;text-align:right;">~{{S.estimatedTokens}}</span>
      </div>
      {{/each}}
    </div>

    <!-- Top skills -->
    <div class="card">
      <h3>Most invoked skills</h3>
      <table>
        <thead><tr><th>Skill</th><th>Invocations</th><th>Avg tokens loaded</th></tr></thead>
        <tbody>
          {{#each TOP_SKILLS as SK}}
          <tr><td>{{SK.name}}</td><td>{{SK.count}}</td><td>~{{SK.avgTokens}}</td></tr>
          {{/each}}
        </tbody>
      </table>
    </div>

    <!-- Top file reads -->
    <div class="card">
      <h3>Most-read files</h3>
      <table>
        <thead><tr><th>File</th><th>Times read</th><th>Token cost per read</th></tr></thead>
        <tbody>
          {{#each TOP_FILES as TF}}
          <tr><td><code>{{TF.file}}</code></td><td>{{TF.count}}</td><td>~{{TF.tokensPerRead}}</td></tr>
          {{/each}}
        </tbody>
      </table>
    </div>

    <!-- Prompt type distribution -->
    <div class="card">
      <h3>Prompt type distribution</h3>
      <table>
        <thead><tr><th>Type</th><th>Count</th><th>% of prompts</th><th>Impact</th></tr></thead>
        <tbody>
          <tr><td>Efficient</td><td>{{PT_EFFICIENT}}</td><td>{{PT_EFFICIENT_PCT}}%</td><td><span class="status low">Low cost</span></td></tr>
          <tr><td>Vague</td><td>{{PT_VAGUE}}</td><td>{{PT_VAGUE_PCT}}%</td><td><span class="status high">High cost</span></td></tr>
          <tr><td>Redundant context</td><td>{{PT_REDUNDANT}}</td><td>{{PT_REDUNDANT_PCT}}%</td><td><span class="status medium">Medium cost</span></td></tr>
          <tr><td>Multi-task</td><td>{{PT_MULTITASK}}</td><td>{{PT_MULTITASK_PCT}}%</td><td><span class="status medium">Medium cost</span></td></tr>
          <tr><td>Correction</td><td>{{PT_CORRECTION}}</td><td>{{PT_CORRECTION_PCT}}%</td><td><span class="status critical">Wasted cost</span></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- SECTION 3: EXPENSIVE OPERATIONS -->
  <section id="expensive" class="section">
    <div class="section-header">
      <div class="icon">🔥</div>
      <h2>Most Expensive Operations</h2>
    </div>
    <table>
      <thead>
        <tr><th>Rank</th><th>Operation</th><th>Trigger</th><th>Est. Tokens</th><th>Reused?</th></tr>
      </thead>
      <tbody>
        {{#each EXPENSIVE_OPS as OP}}
        <tr>
          <td><strong>{{OP.rank}}</strong></td>
          <td>{{OP.description}}</td>
          <td><code>{{OP.trigger}}</code></td>
          <td>~{{OP.estimatedTokens}}</td>
          <td>{{OP.reused}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </section>

  <!-- SECTION 4: PROMPT REWRITES -->
  <section id="prompts" class="section">
    <div class="section-header">
      <div class="icon">✏</div>
      <h2>Prompt Rewrites</h2>
    </div>
    <div class="card">
      <p>These are the highest-cost prompts found across your sessions, with rewritten
      versions that achieve the same goal more efficiently.</p>
    </div>
    {{#each PROMPT_REWRITES as PR}}
    <div class="prompt-card">
      <div class="label">From session: {{PR.sessionTitle}}</div>
      <div class="label" style="margin-top:8px;">Original prompt</div>
      <div class="original">{{PR.original}}</div>
      <div class="reason">⚠ {{PR.reason}}</div>
      <div class="label">Recommended rewrite</div>
      <div class="rewritten">{{PR.rewritten}}</div>
      <div class="saving">💰 Estimated saving: {{PR.estimateSaving}}</div>
    </div>
    {{/each}}
  </section>

  <!-- SECTION 5: RECOMMENDATIONS -->
  <section id="recs" class="section">
    <div class="section-header">
      <div class="icon">💡</div>
      <h2>Recommendations</h2>
    </div>
    {{#each RECOMMENDATIONS as R}}
    <div class="rec-card">
      <div class="rec-num">{{R.rank}}</div>
      <div class="rec-body">
        <h4>{{R.action}}</h4>
        <div class="finding">Finding: {{R.finding}}</div>
        <div class="action">{{R.detail}}</div>
        {{#if R.file}}<div style="margin-top:6px;font-size:0.82rem;color:var(--muted);">File: <code>{{R.file}}</code></div>{{/if}}
      </div>
      <div class="rec-meta">
        <span class="status {{R.priorityClass}}">{{R.priority}}</span>
        <span class="status {{R.savingClass}}">{{R.savingLevel}} saving</span>
      </div>
    </div>
    {{/each}}
  </section>

  <!-- SECTION 6: TREND -->
  <section id="trend" class="section">
    <div class="section-header">
      <div class="icon">📈</div>
      <h2>Trend</h2>
    </div>
    <div class="card">
      <div class="trend {{TREND_CLASS}}" style="margin-bottom:16px;">
        {{TREND_ICON}} {{TREND_DIRECTION}}
      </div>
      <p>{{TREND_EVIDENCE}}</p>
      <table style="margin-top:16px;">
        <thead><tr><th>Metric</th><th>First half</th><th>Second half</th><th>Direction</th></tr></thead>
        <tbody>
          <tr><td>Avg tokens / session</td><td>~{{TREND_TOKENS_FIRST}}</td><td>~{{TREND_TOKENS_SECOND}}</td><td>{{TREND_TOKENS_DIR}}</td></tr>
          <tr><td>Avg turns / session</td><td>{{TREND_TURNS_FIRST}}</td><td>{{TREND_TURNS_SECOND}}</td><td>{{TREND_TURNS_DIR}}</td></tr>
          <tr><td>Correction rate</td><td>{{TREND_CORR_FIRST}}%</td><td>{{TREND_CORR_SECOND}}%</td><td>{{TREND_CORR_DIR}}</td></tr>
        </tbody>
      </table>
    </div>
  </section>

</div>

<footer class="footer">
  <p>Token Analysis &bull; ai-assisted-development plugin &bull; {{DATE}} &bull;
  Estimates use chars ÷ 4 approximation — not exact API token counts</p>
</footer>

</body>
</html>
```
