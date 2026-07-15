---
description: "Enterprise / Solution Architect production readiness assessment for the application. Evaluates 8 domains: deployment pipeline (ADO), resilience, observability, security posture, scalability, data integrity, operational runbook, and test coverage. Requires architecture-deployment.md — run the architect skill first. Flags: --quick (no source reads, ~12K tokens) | --full (targeted source reads for Red domains, ~25K tokens)"
argument-hint: "[--quick | --full]"
---

# /app-readiness

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/app-readiness/SKILL.md` and execute it completely.

## Step 0 — Resolve scope flag

| User typed | Mode |
|---|---|
| `--full` | Full assessment including targeted source reads for Red domains |
| `--quick` | No source reads — bash evidence + ADO API + architecture docs only |
| (nothing) | Default: `--quick` |

Announce:
```
🏗 App Production Readiness Assessment — {mode}
```

## Step 1 — Execute the skill

Read `$PLUGIN_DIR/skills/app-readiness/SKILL.md` and follow every step.
Pass the resolved scope flag into Step 0 of the skill.

## Step 2 — Write HTML report

After the skill completes, write the report:

```bash
mkdir -p prod-readiness
node -e "
const fs = require('fs');
const date = new Date().toISOString().slice(0,10);
const filename = 'prod-readiness/app-readiness-' + date + '.html';
const html = String.raw\`REPLACE_WITH_FULL_HTML\`;
fs.writeFileSync(filename, html, 'utf8');
console.log('Written: ' + filename);
"
```

## Step 3 — Confirm

```
App readiness assessment complete → prod-readiness/app-readiness-<date>.html

Verdict  : {✅ Production ready | ⚠️ Conditionally ready | 🔶 Not ready | 🔴 Blocked}

Domain scores:
  EA-1 Deployment pipeline  : {score}/5  {RAG}
  EA-2 Resilience           : {score}/5  {RAG}
  EA-3 Observability        : {score}/5  {RAG}
  EA-4 Security posture     : {score}/5  {RAG}
  EA-5 Scalability          : {score}/5  {RAG}
  EA-6 Data integrity       : {score}/5  {RAG}
  EA-7 Operational runbook  : {score}/5  {RAG}
  EA-8 Test coverage        : {score}/5  {RAG}

Top blockers: {list or "none"}
```
