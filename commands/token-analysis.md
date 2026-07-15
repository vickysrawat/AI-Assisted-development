---
description: Analyses token consumption across recent Claude Code sessions. Uses a persistent graph cache so subsequent runs only process new sessions and changed files. Identifies expensive operations and prompts. Writes token-analysis-<date>.html to token-analysis/ in the project root.
argument-hint: [sessions=N — number of sessions to analyse, default 10]
---

# /token-analysis

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

<skill>token-analysis</skill>

## Your task

Produce a token consumption analysis report and write it to
`token-analysis/token-analysis-<YYYY-MM-DD>.html`.
**Write the file and update the graph first. Output only the confirmation summary.**

---

### Step 1 — Parse arguments

Extract `sessions=N` from the invocation arguments if present.
Default to `sessions=10` if not provided.

---

### Step 2 — Ensure token-analysis/ folder exists

```bash
mkdir -p token-analysis
```

---

### Step 3 — Run the token-analysis skill

Read `$PLUGIN_DIR/skills/token-analysis/SKILL.md` and follow its instructions exactly.
The skill reads and updates `token-analysis/token-graph.json` automatically.

---

### Step 4 — Write the HTML report

The skill produces structured data. Write the complete HTML report using the
template in `$PLUGIN_DIR/skills/token-analysis/references/report-template.md`.

```bash
node -e "
const fs = require('fs');
const date = new Date().toISOString().slice(0,10);
const filename = 'token-analysis/token-analysis-' + date + '.html';
const html = String.raw\`REPLACE_WITH_FULL_HTML\`;
fs.writeFileSync(filename, html, 'utf8');
console.log('Written: ' + filename);
"
```

---

### Step 5 — Ensure token-analysis/ is gitignored

Check whether `token-analysis/` is in `.gitignore`. If not, append it:

```bash
grep -q "token-analysis/" .gitignore 2>/dev/null || echo "token-analysis/" >> .gitignore && echo "Added token-analysis/ to .gitignore"
```

---

### Step 6 — Confirm

Output to the conversation:

```
Token analysis complete → token-analysis/token-analysis-<date>.html
Open in any browser to view.

Fixed session overhead  : ~N tokens  [GREEN / AMBER / RED]
Sessions analysed       : N  (N new, N from cache)
Most expensive session  : <title> (~N tokens estimated)
Top recommendation      : <one line>
Graph updated           : token-analysis/token-graph.json
```
