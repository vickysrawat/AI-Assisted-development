---
name: dream
description: >
  Run a Dream memory consolidation pass — reads Claude Code sessions, scores entries,
  proposes ADD/UPDATE/DELETE operations with justification, and waits for tiered
  approval before writing. Invoked by the /dream command.
---

# Dream Skill — Memory Consolidation

_Skill version: 1.0 · Last changed: 2026-08-30 · Plugin compatibility: ≥1.14.0 · Consent: C_

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

> **Related specs:** Consent Category C — reads Claude Code session history + memory files only, never application source (`skills/shared/source-file-consent.md`). Severity vocabulary for any finding-derived knowledge follows `skills/shared/business-context-severity.md`.

You are performing a **dream** — a reflective consolidation pass that reads directly
from Claude Code sessions. Sessions are the source of truth. MEMORY.md is optional
overflow for explicit manual notes only.

---

## Trigger

This command runs when the user types `/dream` or ends any prompt with `/dream`.
Do not run automatically. Always wait for explicit invocation.

---

## Before You Begin

Load the **canonical memory read set** from `$PLUGIN_DIR/skills/shared/dream-memory-reading-spec.md`
§1 before making any changes — `CLAUDE.md`, `memory/MEMORY.md`, `memory/topic-*.md`, and
`memory/dream-log.md` (applying the dream-log H2-vs-`[capture]` rule to find the last run date).
Then use `conversation_search` to read sessions since the last dream run (session-id → URL rules: §2).

---

## Phase 0 — Session Discovery

**This phase replaces MEMORY.md as the primary inbox.**

### Step 0: Concurrency guard

Before doing anything else, check for an in-progress dream run:

```bash
cat memory/.dream-lock 2>/dev/null || echo "NO_LOCK"
```

If a lock file exists:
```
⚠️  A dream consolidation appears to be in progress (or a previous run did not
   clean up its lock).

Lock created: {timestamp from lock file}
Lock owner  : {owner from lock file}

If no other session is actively running /dream, delete the lock and retry:
  rm memory/.dream-lock

If another session IS running /dream, wait for it to complete before running
again. Running /dream concurrently overwrites memory files with no merge —
one run's changes will be silently lost.
```
Stop.

If no lock exists, write one immediately:
```bash
mkdir -p memory
echo "{\"started\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"owner\": \"$(git config user.name 2>/dev/null || echo unknown)\"}" > memory/.dream-lock
```

At the end of Phase 6 (Log), always delete the lock:
```bash
rm -f memory/.dream-lock
```

Add `memory/.dream-lock` to `.gitignore` if not already present.

---

### Step 1: Determine the search window

Read `memory/dream-log.md` to find the date of the last dream run.
If no previous run exists, search the last 10 conversations.
If a previous run exists, search all conversations updated after that date.

> `memory/dream-log.md` may contain `### [capture]` lines written by the memory-log
> PostToolUse hook — these are lightweight audit events, not dream run records.
> When searching for the last dream run date, match only `## Dream run —` (H2) headers
> and skip all `### [capture]` lines.

### Token budget guard

Before searching sessions, assess the current memory size:

```bash
wc -l memory/MEMORY.md 2>/dev/null || echo "0"
wc -l memory/topic-*.md 2>/dev/null | tail -1 || echo "0"
ls memory/topic-*.md 2>/dev/null | wc -l || echo "0"
```

Apply the following limits:

| Condition | Action |
|---|---|
| MEMORY.md > 200 lines | Warn: "MEMORY.md is large. Consider archiving promoted entries to topic files before consolidating." |
| Topic files > 10 | Warn: "You have {N} topic files. Consider merging related topics before this run." |
| Session window > 30 conversations | Cap at the 30 most recent conversations. Warn: "Search window exceeds 30 conversations — processing the 30 most recent. Run more frequently (every 5–8 sessions) to avoid large windows." |
| Combined context (memory + sessions) estimated > 80K tokens | Stop and warn: "This consolidation would exceed the safe context budget. Archive older topic files first or run /dream with a narrower keyword to process one topic area at a time." |

These are soft warnings for the first three conditions — the run proceeds after
displaying the warning. The fourth condition (>80K tokens) is a hard stop.

### Step 2: Search sessions

Use `conversation_search` with project-relevant keywords to find conversations
from the search window. Run multiple searches to cover different topic areas:

- Search for decisions: `"decided"`, `"going with"`, `"we'll use"`
- Search for fixes: `"fixed"`, `"root cause"`, `"resolved"`, `"the issue was"`
- Search for failures: `"doesn't work"`, `"abandoned"`, `"do not"`, `"failed"`
- Search for patterns: `"pattern"`, `"convention"`, `"always"`, `"make sure"`
- Search for architecture: `"structure"`, `"approach"`, `"architecture"`, `"design"`

Run at least 3–5 searches. Collect all relevant conversation snippets.

### Step 3: Extract knowledge candidates

From each session found, extract knowledge that matches the 5 auto-capture triggers:

| Trigger | What to extract |
|---------|----------------|
| Plan approved | Approach agreed, tools chosen, constraints set |
| Task completed | Pattern that worked, conventions confirmed |
| Error resolved | Error + root cause + fix + gotcha to avoid |
| Approach abandoned | What failed, why, what to avoid retrying |
| Architecture decision | Decision + rationale + alternatives rejected |

**Also extract:** any explicit instructions the user gave Claude, corrections
the user made to Claude's suggestions, and preferences stated during work.

**Do not extract:** casual conversation, status updates, questions without answers,
or anything that doesn't represent durable project knowledge.

### Step 4: Check MEMORY.md

If `memory/MEMORY.md` has entries with `Trigger:` tags from auto-capture rules,
include those as additional candidates. These supplement session knowledge —
they don't replace it.

Mark each candidate with its source:
- `[session: conversation_search result]`
- `[manual: MEMORY.md entry]`

---

## Phase 1 — Inventory

Merge session candidates with existing knowledge from `topic-*.md` files.

For each distinct piece of knowledge, record:
- **Title** — short label
- **Content** — the actual knowledge
- **Source** — session reference + URL if found, or MEMORY.md entry
- **Existing?** — already in a topic file, or new from sessions
- **Conflicts** — does it contradict anything in existing files?
- **Last seen** — most recent session that mentioned it

Output a readable inventory grouped by topic. Show it before proceeding.

---

## Phase 2 — Score

Assign a confidence score (0.0 – 1.0) to each knowledge entry:

Apply the **confidence-scoring contract** in `$PLUGIN_DIR/skills/shared/dream-reference.md`
(§ Confidence scoring contract) — the single source of truth for: the score bands; base scores
(session-sourced 0.65, auto-capture 0.70); the age-based survival bonus with baseline+age capped at
0.85; +0.15 per additional confirming session (max 0.95); the −0.1-per-unreferenced-cycle decay; and
the PROMOTE ≥ 0.85 / watch < 0.5 / DELETE ≤ 0.2 thresholds. Entries already carrying a `Confidence:`
field start from that recorded value and take decay/bonus from there.

**Audit hints (feedback loop from /dream-audit):** if `memory/audit-hints.md`
exists, read it before scoring. Apply the listed confidence penalty (one band =
−0.1) to entries in any category the audit flagged for elevated rollback rates.
Note the applied penalty in the inventory line.

**Manifest-deviation harvest:** `[MANIFEST-DEVIATION]` entries in MEMORY.md
(written by checkin) are first-class knowledge candidates — "in this repo, a
new service always touches the DI registration" is exactly the codebase-
specific pattern the next manifest should predict. Consolidate recurring
deviations (2+ occurrences) into topic memory with elevated confidence;
single occurrences stay in the inbox one more cycle. Selected D decisions
("chose A over B because {evidence}") are harvested the same way — the
application-level decision history (icea-decisions-spec §7).

**Correction tagging:** when a session shows a developer explicitly correcting
something memory previously asserted (e.g. "no, we use X not Y" against a
promoted fact), write a `[CORRECTION]` entry to dream-log identifying the
contradicted fact and its topic file. /dream-audit aggregates these. The
contradicted entry's confidence drops to ≤ 0.4 immediately.

Show scores in the inventory. Explain any score below 0.5.

---

## Phase 3 — Propose Operations

For each entry, propose exactly one operation. Every ADD, UPDATE, DELETE,
PROMOTE, and DEMOTE must include a full structured justification block.
KEEP uses a compact one-line format.

### Justification block format

```
[OPERATION] <entry title> → <target>

  Reason:          <one sentence: why this operation is needed now>
  Evidence:        <sessions that support this — cite with URLs where found>
  Before:          <current state, or "none" for new entries>
  After:           <what it becomes, or "removed" for DELETE>
  Confidence:      <score> (<trajectory, e.g. ↑ from sessions this cycle>)
  Risk if skipped: <consequence of not applying this>
  Source:          <session URL or "MEMORY.md entry" or "unresolved">
```

### Operations

**ADD** — New knowledge extracted from sessions, not in any topic file.
Session-sourced ADDs require the content to be actionable and durable
(not a one-time status or transient fact).

**UPDATE** — A session shows a newer, better version of an existing entry.
Always show the old → new diff.

**DELETE** — Entry not referenced in any session this cycle AND confidence ≤ 0.2,
OR a session explicitly supersedes it.

**PROMOTE** — Confidence ≥ 0.85 AND the entry is needed at the start of
every session. Max 3 per dream run.

**DEMOTE** — CLAUDE.md entry has become stale or project-specific noise.

**KEEP** — Entry is healthy. Compact format only:
```
[KEEP] "Redis required for integration tests" — confidence 0.80, no change
```

---

## Framework-fact promotion (migration self-learning)

Stage 0.6 of the migration skill writes `Framework-fact` entries to `MEMORY.md` when it web-grounds a
framework attribute's guaranteed behaviour (`attribute · framework@version · guaranteed outcome ·
official-doc URL · date`). Handle these specially — they feed a self-learning cache in the migration
`stacks/{stack}.md` LEARNED block, not an ordinary topic file.

**Recognise** by the `Framework-fact` tag (entry carries `attribute` + `framework@version` + URL).

**Guardrails — reject the promotion if any fail:**
- Must carry an **official-doc URL** (learn.microsoft.com, docs.spring.io, nodejs.org, react.dev,
  angular.dev, docs.python.org, or the framework's canonical docs). No URL → not promoted; drop after
  one cycle in the inbox.
- Must be **version-keyed** (`framework@version` or a range).
- **Dedup by `attribute@version`** against the existing LEARNED block — update in place, never duplicate.

**Operation `STACK-PROMOTE` (Tier 2 — show diff, wait for approval):**
1. Map the framework to `skills/migration/references/stacks/{stack}.md` (`dotnet` · `dotnet-framework`
   · `java-spring` · `nodejs-express` · `react` · `angular` · `python`). If the file or its
   `<!-- LEARNED:BEGIN/END -->` markers are missing, skip with a note.
2. Append/update a row **inside** the LEARNED markers with `trust: learned`.
3. **Also DEMOTE the fact to `memory/topic-framework-facts.md`** — the DURABLE source of truth. The
   LEARNED block is a rebuildable projection: a plugin upgrade replaces `stacks/*.md` wholesale, so on
   a later run, re-promote any `topic-framework-facts.md` fact whose row is absent from the (fresh)
   LEARNED block. Never rely on the block alone for durability.

A human moving a `learned` row above the markers (→ `curated`) is the trust upgrade — `/dream` never
writes `curated`.

## Phase 4 — Semi-Auto Review

Operations are split into three tiers based on blast radius.

### Tier 1 — Auto-apply immediately

| Operation | Condition |
|-----------|-----------|
| KEEP | Any score |
| TIMESTAMP | Replacing relative dates with ISO dates |
| UPDATE minor | Formatting, typos, date fields only |
| ADD new topic | Score ≥ 0.70, new file, session-sourced |

Apply silently. Report in aggregate at the end.

### Tier 2 — Show diff, wait for approval

| Operation | Condition |
|-----------|-----------|
| UPDATE major | Content change |
| ADD to existing | Appending to existing topic file |
| MERGE | Collapsing duplicates |
| DELETE borderline | Score 0.2–0.4 |

Show before/after. Wait for: `approve` / `skip` / `apply all tier 2` /
`apply except <N>` / `revise: <instruction>`

### Tier 3 — Always human, one at a time

| Operation | Why |
|-----------|-----|
| PROMOTE | Writes to CLAUDE.md |
| DEMOTE | Removes from CLAUDE.md |
| DELETE low | Score ≤ 0.2, permanent |
| CONFLICT | Requires human context |

Wait for explicit `yes` / `no` / `revise:` per item.

**CLAUDE.md is the hard boundary.** PROMOTE and DEMOTE are always Tier 3
regardless of confidence score.

---

## Phase 5 — Apply

Apply in this order:
1. Tier 1 (already done)
2. Approved Tier 2: DELETEs → UPDATEs → ADDs → MERGEs
3. Approved Tier 3: DEMOTEs → PROMOTEs last

Show brief before/after for each Tier 2/3 file change.

**After applying:** if MEMORY.md has entries that were processed into topic
files this run, remove them from MEMORY.md (they no longer need to be there).
MEMORY.md should stay lean — only unprocessed manual notes should remain.

---

## Phase 6 — Write Dream Log

Append to `memory/dream-log.md`:

```markdown
## Dream run — <ISO date> <time>

**Sessions searched:** <N> conversations since last run
**Sessions with knowledge:** <N>
**Trigger:** manual /dream
**This conversation:** https://claude.ai/chat/<current-conversation-id>

### Sources this run
| Session | Date | URL | Knowledge extracted |
|---------|------|-----|---------------------|
| session-NNN | YYYY-MM-DD | [link](url) | <brief description> |
| MEMORY.md | — | manual | <N entries processed> |

### Score rationale
- Entry N: 0.XX base (<source type>) [± adjustment (<reason>)] = <final> [— note]
- Entry N: 0.70 base (auto-capture) + 0.15 (confirmed 3+ sessions) = 0.85 — capped
- Entry N: 0.65 base (session-sourced) → decay −0.10 (1 cycle unreferenced) = 0.55
- (Omit entries that land at their raw base score with no adjustments)

### Operations applied

#### [ADD] "<entry>" → memory/topic-<slug>.md
| Field | Value |
|-------|-------|
| Reason | <why> |
| Evidence | <session references with URLs> |
| Before | none |
| After | "<content>" |
| Confidence | 0.XX |
| Risk if skipped | <consequence> |
| Source | [session-NNN](url) |

### Summary table
| Operation | Entry | Confidence | Source |
|-----------|-------|------------|--------|
| ADD | ... | 0.XX | [session-NNN](url) |

### Conflicts resolved
- **<topic>**: "<old>" vs "<new>" → kept "<new>" because <reason>

### Memory health
- Entries before: N
- Entries after: N
- CLAUDE.md lines before: N
- CLAUDE.md lines after: N
- Average confidence: 0.XX
- MEMORY.md entries processed: N (removed from inbox)

### Notes
<Patterns noticed, recurring topics, things worth watching>
```

## Phase 7 — Write Last Run Summary

After appending to `dream-log.md`, **overwrite** `memory/dream-last-run.md` with a
human-readable summary of what this run found and decided. This file is overwritten every
run — it is not an audit trail (that is `dream-log.md`); it is a quick post-run reference.

```markdown
# Dream Last Run Summary
**Run date:** <ISO date time>
**Sessions searched:** N | **Sessions with knowledge:** N | **Trigger:** manual /dream

## Candidate inventory
| # | Title | Source | Existing? | Score |
|---|-------|--------|-----------|-------|
| 1 | <title> | <short session ref or MEMORY.md> | No | 0.XX |
| 2 | <title> | MEMORY.md ×N + sessions | Yes | 0.XX |

(One row per knowledge candidate. "Existing?" = Yes if already in a topic file.)

## Score rationale
- Entry 2: 0.70 base (auto-capture) + 0.15 (confirmed 3+ sessions) = 0.85 — capped
- Entry 6: 0.70 base → decay −0.30 (3 cycles unreferenced) = 0.40
- (Omit entries at their raw base with no adjustments)

## Tier breakdown
**Tier 1 (auto-applied):** N operations
- [ADD] "ADO-87708 UnitIdentifier feature" → memory/topic-ado-87708.md (score 0.85)
- [ADD] "Plugin infrastructure notes" → memory/topic-plugin-infra.md (score 0.75)

**Tier 2 (shown for approval):** N operations
- [UPDATE] "Test runner convention" → memory/topic-testing.md (score 0.80)

**Tier 3 (human review):** N operations
- (none)

---
_Overwritten by every `/dream` run. For the full audit trail see `memory/dream-log.md`._
```

Rules:
- Always include all three tier headings, even when count is 0 — use `- (none)` as the body.
- Use the same short session ref format as the inventory table (e.g. `session 429f88e2`), not full URLs.
- The inventory table covers ALL candidates (including those with KEEP operations), not just those with applied changes.

---

## Rules

- Sessions are the primary source. MEMORY.md is supplementary only.
- Run at least 3 `conversation_search` calls with different keywords.
- Never silently modify files. Every change appears in the dream log.
- Never DELETE without showing the full entry being removed.
- Never PROMOTE more than 3 entries per run.
- Always use real ISO dates — replace relative terms.
- If a conflict cannot be resolved with confidence, mark as
  `[CONFLICT — needs human review]` and do not apply.
- The dream log is append-only. Never edit previous entries.
- Do not add session conversation snippets verbatim to topic files.
  Extract the knowledge, not the conversation.
