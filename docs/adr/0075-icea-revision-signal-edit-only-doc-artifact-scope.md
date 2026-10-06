# 0075 — ICEA revision signal: Edit-only, doc-artifact-only scope
Status: Accepted · Date: 2026-10-06
Governs: `.claude/hooks/icea-revision-signal.cjs`, `_project-deploy/hooks/icea-revision-signal.cjs`, `scripts/signal-write.cjs`
Relates to: [[0065-icea-quality-signals]], [[0049-memory-capture-stop-hook]], [[0068-end-to-end-audit-trail-and-rich-tracker]]

## Problem

ADR 0065 established ICEA quality signals: a per-event inbox (`signals/`) that Dream
consolidates each sprint. The signal capture hook (`icea-revision-signal.cjs`) was intended
to detect post-approval edits to ICEA artefacts as quality signals — "the developer had to
revise this document after it was approved, indicating a gap in the original ICEA."

The initial implementation used two broad catch conditions:

1. `toolName === 'Edit' || toolName === 'Write'` — capturing both edit and file creation.
2. A catch-all for any file under a `UserStory{N}` folder path.

This produced a signal-volume explosion: during a session involving the plugin's own
development (editing skills/, scripts/, tests/), the hook captured 492 files as ICEA
revision signals. Skills, scripts, and test files are not ICEA artefacts. Plugin development
work is not an ICEA quality signal.

Additionally, `signal-write.cjs` wrote one file per event, producing hundreds of small
`.json` files in `signals/` per session. Git commit and Dream consolidation had to handle
hundreds of files where a handful were expected.

## Decision

**Two changes: scope the capture filter; change the signal file format.**

### Change 1 — Capture filter: Edit-only on ADO doc artifacts

The hook now captures signals only when ALL of the following are true:

| Condition | Rationale |
|---|---|
| `toolName === 'Edit'` (not Write) | Write = new file creation. New files are normal flow (SAVE ICEA, SAVE TECH). Not a revision signal. Edit on an existing ICEA/plan/techspec/test-plan = post-approval manual change = genuine quality signal. |
| File matches ADO doc artifact pattern | Pattern: `*.icea.md`, `*.techspec.md`, `*.plan.md`, `*.test-plan.md`. These are the ICEA artefacts the signal is designed to track. |
| ADO ID is extractable from the path | Null-ADO signals are unattributable. Drop them. |

**Removed catch conditions:**
- `toolName === 'Write'` — file creation is normal workflow, not a revision signal.
- UserStory folder catch-all — too broad; captures source code, plugin files, scripts.
- Source code catch-all — implementation choices are not ICEA quality deficiencies.
- Plugin files (skills/, scripts/, tests/) — plugin development is not customer ICEA signals.

### Change 2 — Signal file format: append-only JSONL

`signal-write.cjs` changed from one-file-per-event to append-only JSONL.

| Before | After |
|---|---|
| One `.json` file per signal event | One `.jsonl` file per ADO: `ADO-{ID}-signals.jsonl` |
| N events = N files in `signals/` | N events = 1 file with N lines for that ADO |
| Git commit: N new files | Git commit: 1 modified file |

Each line in the JSONL file is a self-contained JSON object with the same schema as the
previous per-event files. Dream reads JSONL and processes line by line.

## Rationale

- **The signal must match the claim.** ADR 0065 defines ICEA quality signals as "a
  post-approval edit to an ICEA artefact." Source code edits, script changes, and skill
  development are not ICEA artefacts and cannot constitute ICEA quality signals. The
  original broad catch was a misapplication of the signal definition.
- **Write vs Edit distinction is semantic.** Creating a new file (Write) is the normal
  outcome of SAVE ICEA / SAVE TECH. Editing an existing approved artefact (Edit) is the
  anomaly — the signal. Using the tool name as the primary filter aligns with actual intent.
- **Null-ADO signals are waste.** A signal that cannot be attributed to an ADO cannot be
  used in any governance report, sprint metric, or Dream consolidation. Capturing and storing
  unattributable signals adds file volume and processing cost with zero analytical value.
- **JSONL over one-file-per-event.** One file per event was chosen for simplicity at the
  time. In practice, high-event sessions produced Git commits with hundreds of new files,
  making the commit history noisy. JSONL is the idiomatic format for append-only event logs
  and is directly supported by most log analysis tooling.

## Alternatives rejected

- **Keep Write in the capture filter but scope to doc artifacts only.**
  Rejected — even with doc-artifact scoping, Write captures the initial SAVE ICEA / SAVE TECH
  file creation, which is not a revision. The ICEA was just approved; there is nothing to
  revise yet. Write events on doc artifacts are false positives by definition at creation
  time.
- **Capture all Edit events and filter in Dream consolidation.**
  Rejected — Dream runs at most every 5–8 sessions. Deferring the filter to Dream means
  storing and git-committing hundreds of noise signals per session before they are ever
  filtered. The hook is the right place to apply the filter: discard noise at the source.
- **Keep one-file-per-event but add a cleanup script.**
  Rejected — a cleanup script is a maintenance burden and a second failure point. JSONL
  eliminates the problem at the source without requiring cleanup.

## Consequences

- Signal volume drops dramatically. A session that previously produced 492 signal files now
  produces 0–5 entries per session (one per genuinely revised ICEA artefact).
- `signals/` directory remains but contains one `.jsonl` file per ADO with recorded
  revisions. Dream consolidation reads these files unchanged.
- Existing one-file-per-event `.json` files in `signals/` are not migrated automatically.
  Dream consolidation should handle both formats during the transition period; after one
  Dream run they are processed and the old files can be cleared.
- The signal scope change is a breaking semantic change: signals that were previously
  captured for source code edits are no longer captured. This is intentional — those were
  false signals.

## Revisit when

- If a legitimate ICEA quality signal is identified that requires capturing Write events
  (e.g., an ICEA file is deleted and recreated rather than edited as a revision strategy),
  add a specific condition rather than re-broadening the filter.
- If Dream consolidation shows consistently low signal counts despite known ICEA revision
  activity, audit whether the doc artifact pattern is matching actual file paths in the
  target projects. Path patterns may need adjustment if project ICEA folder structures
  differ from the plugin's expected layout.
