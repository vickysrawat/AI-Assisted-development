---
name: token-analysis
description: >
  Analyses Claude Code token consumption across recent sessions. Uses a persistent
  token-graph.json cache so subsequent runs only process the delta — new sessions
  and changed files. Identifies expensive operations, long sessions, and costly
  prompt patterns. Produces prioritised recommendations for token savings and
  better prompt patterns.
  Triggered by /ai-assisted-development:token-analysis.
  Also triggers on: "analyse token usage", "token cost", "context window usage",
  "how much tokens am I using", "expensive prompts", "reduce token cost",
  "prompt efficiency", "session cost analysis".
---

# Token Analysis Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: C_
Uses a persistent graph cache at `token-analysis/token-graph.json` to avoid
re-processing work already done. On first run: full scan. On subsequent runs:
delta only — new sessions and changed files only.

Token estimation: **characters ÷ 4** throughout. Consistent methodology makes
comparisons valid even if absolute numbers are approximate.

See `references/graph-schema.md` for the full cache structure.

---

## Step 1 — Load or initialise the graph

```bash
cat token-analysis/token-graph.json 2>/dev/null || echo "NO_GRAPH"
```

**If `NO_GRAPH`** — this is a first run. Set all registries to empty and
proceed through all steps. Write the graph at the end.

**If graph exists** — parse it. Use stored data as the baseline.
Proceed only to steps where delta exists.

---

## Step 2 — File delta check

For each file type below, run `wc -c` and compare the result against the
`charCountAsHash` in the graph. Re-measure only files where the count differs
or the file is new. Skip files whose count is unchanged.

### 2a — CLAUDE.md

```bash
wc -c CLAUDE.md 2>/dev/null || echo "0"
```

If changed or new: read the file to extract any `@file` references and
measure those files too. Classify as `ALWAYS`.

### 2b — Rule files

```bash
find .claude/rules -name "*.md" 2>/dev/null | while read f; do
  echo "$(wc -c < "$f") $f"
done
```

For each file changed or new: read its frontmatter `paths:` value.
- `paths: ["**/*"]` → `ALWAYS`
- Anything else → `CONDITIONAL`, record the scope pattern

### 2c — Architecture docs

```bash
find .claude/architecture -name "*.md" 2>/dev/null | while read f; do
  echo "$(wc -c < "$f") $f"
done || echo "No architecture files found"
```

Classify all as `ON_DEMAND`. If folder missing: flag REC-T01.

### 2d — Plugin skill files (this plugin only)

```bash
find ~/.claude/plugins -path "*/ai-assisted-development/skills/*/SKILL.md" 2>/dev/null | while read f; do
  echo "$(wc -c < "$f") $f"
done
```

Classify all as `CONDITIONAL`.

### 2e — Knowledge graph files

```bash
# Index file — always loaded
wc -c .claude/graph/graph-index.md 2>/dev/null || echo "0"

# Module detail files — conditional
find .claude/graph -name "*.md" -not -name "graph-index.md" 2>/dev/null | while read f; do
  echo "$(wc -c < "$f") $f"
done
```

- `graph-index.md` → classify as `ALWAYS` (it has `paths: always` frontmatter)
- All module detail files → classify as `CONDITIONAL` with their `paths:` scope pattern

Include their token counts in `graph.staticStatus`:
- `alwaysTokens` includes graph-index.md
- `typicalTokens` includes graph-index.md + the 1–2 most-loaded module files
  (derive "most-loaded" from `filesRead` across recent sessions in the graph)
- `maxTokens` includes all graph files

If `.claude/graph/` is absent: skip silently — graph not yet generated.

### 2f — Rebuild static cost totals (only if any file changed)

If no files changed since last run, use `graph.staticStatus` directly — skip this step.

If any file changed:
- **Always-loaded tokens**: sum of `ALWAYS` files ÷ 4
- **Typical session tokens**: ALWAYS + most common CONDITIONAL skills (top 3 by invocation from graph)
- **Max possible tokens**: all files ÷ 4

RAG status for always-loaded total:
- 🟢 `GREEN` < 2,000 tokens
- 🟡 `AMBER` 2,000–5,000 tokens
- 🔴 `RED` > 5,000 tokens

Update `graph.staticStatus` and `graph.files`.

---

## Step 3 — Session delta check

```
Call recent_chats(n=N) to get the last N session IDs and titles.
```

Compare each returned session ID against `graph.sessions`.

- **Already in graph** → skip entirely. Use stored data.
- **Not in graph** → mark for analysis. Proceed to Step 4 for these only.

If all N sessions are already in the graph and no files changed → jump to Step 6.
Output: `"Graph fully up to date — generating report from cache."`

---

## Step 4 — Analyse new sessions only

For each session marked for analysis in Step 3:

```
Call conversation_search using keywords from the session title to
retrieve message content.
If content unavailable: record the session with title and date only,
mark all metrics as null, and continue.
```

For each session with content, compute:

**Volume metrics**
- Count human turns and assistant turns separately
- Sum characters: human messages, assistant responses, tool results
- `estimatedTokens` = total chars ÷ 4
- `costIndex` = estimatedTokens × (turns × (turns + 1) / 2 / turns)
  — accounts for context re-send accumulation per turn

**Skill invocations**
Scan human messages for: command prefixes (`/ai-assisted-development:`),
skill name keywords (icea-feature, pr-describe, pr-create, security, etc.).
Record each invocation.

**File reads**
Scan tool call content for file read patterns.
Extract file paths and count occurrences.

**Prompt classification**
For each human message classify as one of:
- `efficient` — clear scope, specific file/method reference, single task, > 20 words
- `vague` — < 20 words with no file/method reference and no command prefix
- `redundant` — restates facts already in CLAUDE.md (ADO org, branch names, stack)
- `multiTask` — contains "and also", "additionally", or multiple imperative verbs
  targeting different files or concerns
- `correction` — starts with "no", "that's wrong", "not quite", "actually",
  or "I meant" — indicates prior response missed the mark

Flag the top 3 most expensive prompts (by length + whether they triggered
a file read or a correction chain) for the prompt rewrite section.

Add the completed session object to `graph.sessions`.

---

## Step 5 — Recompute aggregates

Recompute `graph.aggregates` using ALL sessions in the graph
(not just new ones — the full picture):

- `avgTokens` — mean estimatedTokens across all sessions with data
- `avgTurns` — mean turns
- `correctionRate` — total correction turns ÷ total turns
- `topSkills` — skills ranked by invocation count
- `topFiles` — files ranked by read count
- `promptTypeDistribution` — fraction of each type across all prompts
- **Trend** — compare first half of sessions vs second half:
  - avgTokens first half vs second half
  - correctionRate first half vs second half
  - direction: `improving` if both metrics better, `degrading` if both worse, else `stable`

---

## Step 6 — Recommendations

Load `references/recommendations.md`.

For each recommendation entry, evaluate its trigger condition against
the current graph data. Apply only triggered recommendations.

For each triggered recommendation:
- Check `graph.recommendations` — was it open last run?
  - Yes → status `open`, update `lastSeen`
  - No → status `new`, set `firstSeen` to today
- Update `graph.recommendations`

For recommendations previously in the graph but no longer triggered:
- Set status to `resolved`, set `resolvedAt` to today

**Prompt rewrite section**
Collect the flagged expensive prompts from new sessions in Step 4.
For each, apply the rewrite principles:
- Remove redundant context (facts already in CLAUDE.md)
- Scope the ask (file + method + line if applicable)
- One task per prompt
- Reference don't paste (file path instead of pasted content)
- Use command prefix instead of natural language for skill tasks
- Avoid re-explaining context already established in the session

Produce: original (truncated to 200 chars), reason it was expensive,
rewritten version, estimated saving.

---


> **Single-writer assumption**: This skill writes to a persistent cache file. See `../shared/single-writer-assumption.md` for concurrency constraints and CI guidance.

## Step 7 — Write updated graph

Serialise the updated graph object and write it:

```bash
node -e "
const fs = require('fs');
const graph = REPLACE_WITH_GRAPH_JSON;
fs.mkdirSync('token-analysis', { recursive: true });
fs.writeFileSync('token-analysis/token-graph.json', JSON.stringify(graph, null, 2));
console.log('Graph updated: token-analysis/token-graph.json');
"
```

---

## Step 8 — Produce report data structure

Assemble the final data object for the report template:

```
{
  generatedAt, sessionsAnalysed, newSessionsAnalysed, cachedSessions,
  static: { alwaysTokens, typicalTokens, maxTokens, status, files[] },
  sessions: [ ...from graph, sorted by date desc ],
  aggregates: { ...from graph.aggregates },
  expensiveOperations: [ top 5 by estimatedTokens across all sessions ],
  promptRewrites: [ from new sessions this run ],
  recommendations: [ triggered recs, sorted by priority ],
  trend: { ...from graph.aggregates.trend }
}
```

Pass to `references/report-template.md`.

---

## Step 4b — Skill usage telemetry

As part of Step 4 session analysis, extract plugin skill invocations and build a usage profile.

### Detection

Scan human messages in each new session for:
- Command prefixes: `/ai-assisted-development:<skill>`
- Skill name keywords: `icea-feature`, `icea-review`, `pr-describe`, `pr-create`,
  `pr-spec-review`, `ado-tasks`, `code-review`, `security-review`, `architect`,
  `dream-status`, `sprint-metrics`, `token-analysis`, `product-docs`
- Natural language triggers: "build a feature", "review this PR", "ICEA", "dream"

Record per session: list of skills invoked and invocation count per skill.

### Aggregate across all sessions

Maintain in `graph.skillUsage`:
```json
{
  "icea-feature": { "invocations": 42, "lastSeen": "2026-05-30", "firstSeen": "2026-01-15" },
  "code-review":  { "invocations": 18, "lastSeen": "2026-05-28", "firstSeen": "2026-02-01" },
  "pr-describe":  { "invocations": 0,  "lastSeen": null,         "firstSeen": null }
}
```

### Report section: Skill Usage

Include in the HTML report after the Session Analysis section:

```
## Skill Usage (all-time)

| Skill | Invocations | Last used | Status |
|---|---|---|---|
| icea-feature | 42 | 2026-05-30 | 🟢 Active |
| code-review  | 18 | 2026-05-28 | 🟢 Active |
| pr-describe  | 5  | 2026-04-10 | 🟡 Occasional |
| ado-tasks    | 0  | —          | 🔴 Never used |
```

Status thresholds:
- 🟢 Active: ≥1 invocation in last 30 days
- 🟡 Occasional: invocations exist but none in last 30 days
- 🔴 Never used: 0 invocations across all sessions

Highlight "Never used" skills as candidates for removal or better documentation.

## Hard rules

- NEVER re-analyse a session already in the graph — check ID first
- NEVER re-measure a file whose charCount hasn't changed — check count first
- NEVER fabricate session data — skip and note if content unavailable
- NEVER show prompt text that may contain secrets — truncate at 200 chars
- NEVER overwrite the graph if Step 7 fails — keep the previous version intact
- Token estimates are approximations — always label as "~N tokens (estimated)"
- Recommendations must be data-driven — never apply if trigger condition not met


## Model routing

This skill is in the **infrastructure tier** — it uses `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

token consumption analysis — processes session graphs and generates reports

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
