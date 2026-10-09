---
description: Humanize text in two modes. File mode deterministically scans generated documents (Markdown, HTML, plain text) for generic "AI-sounding" patterns and reports findings by tier with file:line locations before any rewrite. Direct-text mode rewrites provided text and returns it in chat/console with no report and no file changes. Never rewrites files silently — rewrites only flagged spans on explicit request.
argument-hint: "<path-or-text> [--json report.json] | --text <text> | --file <path-to-file-or-dir>  — auto-detect file path vs direct text when flags are omitted"
---

# /articulate-as-human

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

<skill>articulate-as-human</skill>

## Your task

Run `/articulate-as-human` in the correct mode and follow that mode's contract exactly.

---

### Step 1 — Parse arguments and choose mode

Resolve mode in this order:

1. `--text <text>` → **direct-text mode** (explicit override).
2. `--file <path>` → **file mode** (explicit override).
3. No override:
   - If the argument resolves to an **existing file or directory path**, use **file mode**.
   - Otherwise treat it as **direct text**.

If no argument was given in an interactive session, prompt via `AskUserQuestion` for either a
file/directory path or direct text; do not guess silently.

`--json report.json` is for **file mode only**.

---

### Step 2A — Direct-text mode (no file scan)

When in direct-text mode, humanize the provided text and return the rewritten result directly
in chat/console.

- Preserve meaning, facts, names, numbers, citations, and required structure.
- Remove generic AI/corporate phrasing and keep wording specific to the content.
- Do **not** create a report file.
- Do **not** modify any files.

---

### Step 2B — File mode: run the deterministic scan first

Always run the script before eyeballing the text — the point is repeatable, located findings:

```bash
node "$PLUGIN_DIR/scripts/check-tone.cjs" <path-to-file-or-dir> [--json report.json]
```

Pure Node built-ins (`fs`, `path`), no npm deps — runs under restricted egress.

---

### Step 3 — File mode: report before rewriting

Read `$PLUGIN_DIR/skills/articulate-as-human/SKILL.md` and follow its workflow exactly.
Present the script's findings grouped by tier (tier1 vocabulary, hedges, weasel attribution,
negation construction, tailing "-ing" clauses, bold-bullet lists, transition/em-dash density,
uniform rhythm, repeated openers), each with its `file:line` location and the per-file risk
band. **Do not rewrite anything at this stage** — some flagged phrasing may be intentional or
contractually required.

---

### Step 4 — File mode: add one qualitative pass

Read `$PLUGIN_DIR/skills/articulate-as-human/references/qualitative-review.md` and apply it —
catch the staging/inflation/mechanical-structure/leftover patterns regex can't. Mark these as
judgment calls separate from the script output, and only when a few co-occur in the same
passage.

---

### Step 5 — File mode: rewrite only on request

Only if the user explicitly asks to fix flagged spans: rewrite **only** those spans, preserve
every fact/name/number/citation and structural contract the document follows, replace each
flagged phrase with something specific to that sentence's content (not another generic
synonym), and show a before/after diff for each change. Never a silent full-document rewrite,
and never invent a fact to fill a gap.
