---
description: Deterministically scan a generated document (Markdown, HTML, or plain text) for generic "AI-sounding" writing patterns — stock vocabulary, weasel attribution, the "not just X, it's Y" negation, dangling "-ing" clauses, bold-lead-in bullet lists, transition/em-dash density, uniform rhythm, and repeated openers. Reports findings by tier with file:line locations. Never rewrites silently — rewrites only flagged spans, only on explicit request.
argument-hint: "<path-to-file-or-dir> [--json report.json]  —  the document (or folder) to scan; omit to be prompted"
---

# /articulate-as-human

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

<skill>articulate-as-human</skill>

## Your task

Run a tone pass over the target document and **report structurally — do not rewrite anything
unless the user later asks for it.**

---

### Step 1 — Parse arguments

Take the file or directory path from the invocation arguments. If no path was given **in an
interactive session**, prompt via `AskUserQuestion` for the path (or the current selection /
most recently generated document) before proceeding; do not guess a target silently. Pass
`--json report.json` through to the script if the user asked for a machine-readable report.

---

### Step 2 — Run the deterministic scan first

Always run the script before eyeballing the text — the point is repeatable, located findings:

```bash
node "$PLUGIN_DIR/scripts/check-tone.cjs" <path-to-file-or-dir> [--json report.json]
```

Pure Node built-ins (`fs`, `path`), no npm deps — runs under restricted egress.

---

### Step 3 — Report before rewriting

Read `$PLUGIN_DIR/skills/articulate-as-human/SKILL.md` and follow its workflow exactly.
Present the script's findings grouped by tier (tier1 vocabulary, hedges, weasel attribution,
negation construction, tailing "-ing" clauses, bold-bullet lists, transition/em-dash density,
uniform rhythm, repeated openers), each with its `file:line` location and the per-file risk
band. **Do not rewrite anything at this stage** — some flagged phrasing may be intentional or
contractually required.

---

### Step 4 — Add one qualitative pass

Read `$PLUGIN_DIR/skills/articulate-as-human/references/qualitative-review.md` and apply it —
catch the staging/inflation/mechanical-structure/leftover patterns regex can't. Mark these as
judgment calls separate from the script output, and only when a few co-occur in the same
passage.

---

### Step 5 — Rewrite only on request

Only if the user explicitly asks to fix flagged spans: rewrite **only** those spans, preserve
every fact/name/number/citation and structural contract the document follows, replace each
flagged phrase with something specific to that sentence's content (not another generic
synonym), and show a before/after diff for each change. Never a silent full-document rewrite,
and never invent a fact to fill a gap.
