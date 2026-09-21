# ADR-0065: ICEA quality signals — per-event inbox cleared by Dream

**Status:** Accepted · 2026-09-20
**Related:** ADR-0060 (audit trail), ADR-0063 (project-knowledge), ADR-0066 (Dream runner)

## Context

To auto-promote ICEA patterns to `project-knowledge.md` (ADR-0063), the system must detect
when the same gap or revision reason recurs across multiple ADOs. Three candidate approaches
were evaluated: writing signals to `MEMORY.md`, reading existing artefacts (ICEA files + git
history), and a dedicated signal store.

Key constraints:
- Team-shared: all developers must contribute signals
- No merge conflicts: multiple developers writing simultaneously
- No unbounded accumulation: files must not grow forever
- Dream must distinguish "already processed" from "new"
- 100s of ICEA files over time → cannot scan all on every Dream run

## Decision

Dedicated `.claude/signals/` directory with per-event JSON files:
- Written by `scripts/signal-write.cjs` at the point of signal generation
- Naming: `{ms-timestamp}-{type}-ADO-{ID}.json` (unique, no conflicts)
- **Committed** to git (team-shared, not gitignored)
- **Cleared by Dream after each run** — files are ephemeral input, not permanent records

Three signal types and their emitters:
- `gap` — written by `icea-implement` when an Example cannot produce a real assertion
- `revision` — written by `icea-revise` when sections change (inferred from before/after diff)
- `story-quality` — written by `icea-feature` at SAVE PLAN time when clarifying questions were needed

Running tally across Dream runs: `memory/topic-signals.md` (committed, Dream-managed).
Dream increments counts per category, proposes project-knowledge ADD when count ≥ threshold.
Threshold: `gap_promotion_threshold` in `dream-init-state.json` (default: 2, configurable).

## Rationale

**Per-event files (not `MEMORY.md`):** `MEMORY.md` is a single file. Multiple developers
appending signals simultaneously causes merge conflicts at team scale. Per-event files are
independent paths — git merges them cleanly.

**Cleared by Dream (not permanent):** unlike governance events (ADR-0060) which must be
permanently auditable, signals are ephemeral processing input. Once tallied in
`topic-signals.md`, the raw files serve no further purpose. Keeping them accumulates hundreds
of files per sprint.

**Not reading ICEA files directly:** with hundreds of ICEA files across releases, Dream
cannot know which have already been processed. There is no "processed" marker on ICEA files —
reading all of them on every Dream run is expensive and produces duplicate counts.

**`topic-signals.md` tally (not in-memory only):** patterns must accumulate across Dream runs.
If the threshold is 2 and only 1 occurrence exists at the time of each Dream run, the count
must persist between runs. `topic-signals.md` is the cross-run accumulator.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Signals written to `MEMORY.md` | Single file → merge conflicts at team scale |
| Read ICEA files + git history directly | 100s of files; no way to track "already processed" |
| Permanent signal files (never deleted) | Unbounded accumulation; unmanageable over years |
| Signals in `.claude/audit/` | Audit events are governance records; signals are processing input — different concerns |

## Consequences

- `.claude/signals/` must be committed (not gitignored)
- `memory/topic-signals.md` must be committed; written by Dream runner only (ADR-0066)
- Dream Phase 3.6 processes signals, clears files, updates tally, proposes promotions
- `gap_promotion_threshold` in `dream-init-state.json` controls sensitivity
