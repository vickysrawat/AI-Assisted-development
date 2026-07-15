---
description: "AI Architect production readiness assessment for the plugin. Evaluates 6 domains: infrastructure health, model routing, memory health, governance rails, skill quality, and session budget. Reads plugin state only — no application source files."
argument-hint: "(no arguments needed)"
---

# /plugin-readiness

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/plugin-readiness/SKILL.md` and execute it completely.

## Step 1 — Announce

```
🤖 Plugin Production Readiness Assessment
  Reading plugin state files only — no application source reads
```

## Step 2 — Execute the skill

Read `$PLUGIN_DIR/skills/plugin-readiness/SKILL.md` and follow every step.

## Step 3 — Write HTML report

```bash
mkdir -p prod-readiness
node -e "
const fs = require('fs');
const date = new Date().toISOString().slice(0,10);
const filename = 'prod-readiness/plugin-readiness-' + date + '.html';
const html = String.raw\`REPLACE_WITH_FULL_HTML\`;
fs.writeFileSync(filename, html, 'utf8');
console.log('Written: ' + filename);
"
```

## Step 4 — Confirm

```
Plugin readiness assessment complete → prod-readiness/plugin-readiness-<date>.html

Verdict  : {✅ Plugin ready | ⚠️ Conditionally ready | 🔶 Not ready | 🔴 Blocked}

Domain scores:
  AI-1 Infrastructure health : {score}/5  {RAG}
  AI-2 Model routing         : {score}/5  {RAG}
  AI-3 Memory health         : {score}/5  {RAG}
  AI-4 Governance rails      : {score}/5  {RAG}
  AI-5 Skill quality         : {score}/5  {RAG}
  AI-6 Session budget        : {score}/5  {RAG}

Top actions: {list or "none"}
```
