# 0068 — End-to-end AI audit trail and rich implementation tracker
Status: Accepted · Date: 2026-09-18
Governs: `skills/icea-feature/SKILL.md`, `skills/icea-implement/SKILL.md`
Relates to: [[0034-interactive-draft-save-flow]], [[0035-plan-feeds-icea]],
[[0052-critic-planning-gates]], [[0012-critic-layer]], [[0028-write-gate]]

## Problem

The plugin produced two partially-useful tracking artefacts but captured almost none of the
work done between their creation points:

- `ai-audit.md` logged exactly 3 events per feature: plan saved, ICEA saved, Tech Spec saved.
  Every revision round, every critic REVISE retry, all code-generation rework, build failures,
  and story completions were invisible.
- `tracker.md` held a flat status board (AC rows or story rows) and nothing else. Once
  `icea-implement` flipped a row from ⏳ to ✅ there was no record of what was built, what
  tests covered it, what bugs were found and fixed during the session, or what was deferred.

The result: no basis for release-level metrics (rework rate, revision depth, build quality),
and no implementation journal a future developer could read to understand why a story shipped
the way it did.

## Decision

**Two artefacts, one scope each.**

### 1. `ai-audit.md` — structured event log (metrics layer)

Expand the schema from a 6-column save-point log to an 8-column machine-readable event stream:

```
| # | Date | Actor | Category | Event | Artifact | Iter | Summary |
```

- **Category**: metrics bucket — `plan` · `icea` · `tech-spec` · `implementation` · `build`
- **Event**: kebab-case event type — 18 distinct values across all categories
- **Artifact**: what was affected (plan, ICEA, Tech Spec, Story N, AC-Fx)
- **Iter**: revision/retry counter within the current phase; `-` when N/A

**Logging points added:**

| Phase | Events |
|---|---|
| Plan review (Step 3) | `plan-revised` after each correction round |
| ICEA draft critic (Step 5) | `icea-critic-revise` per retry · `icea-critic-pass` on PASS |
| ICEA review (Step 6) | `icea-revised` after each correction round |
| ICEA save (Step 7) | `icea-critic-{pass\|revise}` · `icea-saved` |
| Tech Spec draft critic (Step 8) | `tech-critic-revise` per retry · `tech-critic-pass` on PASS |
| Tech Spec review (Step 9) | `tech-revised` after each correction round |
| Tech Spec save (Step 10) | `tech-critic-{pass\|revise}` · `tech-saved` |
| Implementation start (Step 4) | `impl-started` |
| Code critic (Step 4a) | `code-critic-revise` per retry · `code-critic-pass` · `code-critic-accept` |
| Goal loop (Step 4b) | `goal-loop-iter` per iteration · `goal-loop-complete` |
| Story complete (Step 6) | `story-complete` |
| Build gate (Step 7) | `build-issue` per failure · `build-fixed` after fix · `checkin-pass` |

### 2. `tracker.md` — rich implementation journal (narrative layer)

Expand the tracker format beyond the flat status board to include one implementation section
per story (EPIC) or one implementation section for the whole feature (STORY). Each section
is initialised with placeholders by `icea-feature` and progressively filled by
`icea-implement` after the Write Gate:

- **Delivered** — one bullet per module/file cluster written (layer, class, purpose, path)
- **Tests added** — one line per spec file (name + case count + scope)
- **Follow-ups / bugs fixed** — one row per rework event (issue, fix, files); populated by
  critic REVISE+fix cycles (Step 4a) and checkin failure+fix cycles (Step 7)
- **Design decisions** — extracted from `// DECISION:` blocks in the written code
- **Known gaps** — deliberately deferred items and ACCEPT AS-IS outcomes

The Follow-ups table is the primary rework signal — every row represents a defect found and
fixed during the AI-assisted session, before the code reaches human review.

## Rationale

- **Two artefacts, two consumers.** The audit log is for aggregated metrics queries (filter
  by Category/Event across ADOs; group by release). The tracker is for humans reading a single
  story — it should read like the implementation history shown in the progress-tracker example
  that motivated this decision, not like a CSV export.
- **Round-level granularity, not message-level.** Logging every chat message would produce
  noise. Logging at the round level (one correction = one revision row) preserves the signal
  without burying it.
- **Follow-ups as the rework proxy.** Rework happens in two places: the critic REVISE loop
  (pre-write) and the checkin failure loop (post-write). Both create Follow-ups rows with
  issue+fix+files. The count of Follow-ups rows per story is the closest proxy to "how much
  was wrong on first pass."
- **Progressive fill, not upfront generation.** Tracker sections are stubs until
  `icea-implement` runs. Populating them upfront from the Tech Spec would create false
  confidence (the plan, not the reality). Only the written code produces the Delivered list
  and test summary.

## Alternatives rejected

- **Single flat audit log, no rich tracker.** Rejected — the audit log's event stream is
  not human-readable as an implementation story; the narrative layer (what was built, why
  decisions were made, what bugs were caught) needs prose and tables, not CSV rows.
- **Single rich tracker, no audit log.** Rejected — aggregating rework metrics from rich
  markdown across hundreds of ADOs requires parsing; a structured event log with fixed columns
  is directly query-able by Category and Event.
- **Log only at save events (existing behaviour).** Rejected — save events record that work
  was done but not how much. A feature with zero plan revisions and five ICEA revisions looks
  identical to one with four plan revisions and zero ICEA revisions; both record only
  "ICEA saved."
- **Log every interactive message.** Rejected — the audit file would grow faster than it
  provides value; the per-round model (one correction = one row) captures depth without
  verbosity.
- **Populate tracker from Tech Spec at feature-planning time.** Rejected — the Tech Spec
  describes the plan, not the outcome. Delivered and Tests must come from what was actually
  written and run, not from what was intended.

## Consequences

- Every interactive correction in Steps 3, 6, and 9 appends a row to `ai-audit.md`. Context
  overhead is one small bash write per correction round — negligible relative to the content
  being generated.
- `icea-implement` must now read and edit the tracker in place (update Status, fill sections,
  append Follow-ups rows). It already located the tracker file; the new instructions extend
  that into structured edits.
- Release metrics become derivable by aggregating `ai-audit.md` rows across all ADOs in a
  sprint/release: revision depth per phase, rework rate (code-critic-revise count), build
  quality (build-issue count), and follow-up density (Follow-ups rows / story).
- The Follow-ups table in the tracker provides the same end-to-end narrative that the
  progress-tracker example showed — an auditable history of every bug found and fixed during
  AI-assisted implementation, visible to the next developer who reads the story folder.

## Revisit when

- If `ai-audit.md` grows large enough to be a context burden during long sessions, consider
  offloading append operations to the audit-append hook rather than inline writes.
- If Follow-ups rows generated by the critic loop are consistently trivial (typos, formatting),
  raise the threshold for what warrants a Follow-ups entry to meaningful defects only.
- If per-story tracker sections become redundant with a dedicated sprint-metrics dashboard,
  simplify back to the flat status board for the tracker and keep only the audit log.
