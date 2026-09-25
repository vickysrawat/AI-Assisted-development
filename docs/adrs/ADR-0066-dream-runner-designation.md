# ADR-0066: Designated Dream runner for team projects

**Status:** Accepted · 2026-09-20
**Related:** ADR-0063 (project-knowledge), ADR-0065 (ICEA signals)

## Context

Dream writes to multiple committed files: `memory/MEMORY.md`, `memory/topic-*.md`,
`memory/topic-signals.md`, and `.claude/project-knowledge.md`. If multiple developers run
`/dream` independently in the same sprint, they each write their own consolidation pass —
resulting in concurrent modifications to the same files, which produce git merge conflicts.

The signal inbox (`.claude/signals/`) solves write-side conflicts for signal capture (ADR-0065),
but Dream's output files remain single-writer by nature.

## Decision

**Designate one team member per sprint to run `/dream`.** This is the Dream runner,
typically the Tech Lead.

Division of responsibilities:
- **All developers:** write to `.claude/signals/` (auto, per-event files), append to
  `memory/MEMORY.md` (manual notes), commit signal files
- **Dream runner (Tech Lead):** runs `/dream` once per 5–8 sessions or sprint boundary,
  consolidates all team signals, clears signal inbox, writes updated topic files and
  project-knowledge, commits the result

This designation is documented in CLAUDE.md and `_project-deploy/CLAUDE.md` so every
session is aware of the convention.

## Rationale

**Single runner over concurrent runners:** there is no merge strategy for Dream's narrative
output. `topic-*.md` files contain prose knowledge entries — merging two independent
consolidations of the same signal set produces duplicates and contradictions that require
manual resolution. A single runner eliminates this entirely.

**Tech Lead as default runner:** the Tech Lead already runs `GOVERNANCE REPORT` and approves
ICEAs. Running Dream fits naturally in the sprint retrospective cadence. Tech leads also have
the best context for evaluating which signals warrant project-knowledge promotion.

**Convention over enforcement:** this is a team agreement, not a technical lock. A team that
wants multiple runners can coordinate externally (e.g., one runner per domain). The plugin
documents the convention; it does not enforce it.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Any developer can run Dream at any time | Concurrent writes to topic files cause merge conflicts |
| Technical lock on Dream (only one user can run it) | Requires an auth system the plugin doesn't have; too restrictive |
| Separate Dream output files per developer | Defeats the purpose of shared team memory |

## Consequences

- CLAUDE.md includes a "Designated Dream runner" note in the Dream section
- `_project-deploy/CLAUDE.md` includes the same note
- No code change — this is a documented convention, not a technical constraint
- Teams with larger rosters may want to increase `gap_promotion_threshold` to reduce noise
