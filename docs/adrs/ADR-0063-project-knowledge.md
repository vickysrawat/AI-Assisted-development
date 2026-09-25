# ADR-0063: Per-project ICEA learning loop via project-knowledge.md

**Status:** Accepted · 2026-09-20
**Related:** ADR-0065 (ICEA quality signals), ADR-0066 (Dream runner)

## Context

Every ICEA starts from the same blank slate regardless of how many ICEAs have been written
for a given codebase. Developer A's discovery that the Examples section must include dependency
contracts is lost when Developer B starts a new story months later. A mechanism is needed to
accumulate codebase-specific ICEA patterns and inject them into future ICEA drafts.

## Decision

A new committed file `.claude/project-knowledge.md` holds ICEA-quality patterns specific to
the target application. It is:
- Read by `icea-feature` at Step 3b during Codebase Orientation
- Managed by Dream (Phase 3.5 staleness pass — anchor check + age threshold)
- Populated via `LESSONS ADO-{ID}` promotion, `KNOWLEDGE ADD/REMOVE/UPDATE` commands,
  and (when threshold is met) auto-promotion from ICEA quality signals (ADR-0065)

Entry format includes: title, source ADOs, added date, optional code anchor for auto-validation.

Three-layer staleness defence:
1. Code anchor check at Dream time (if the anchored class/interface no longer exists → flag)
2. Age threshold (180 days / 2 releases → flag for revalidation)
3. LLM framing ("treat as point-in-time; verify before applying; flag conflicts")

## Rationale

**Separate file from `MEMORY.md`:** `MEMORY.md` captures developer decisions, errors, and
architecture choices for the application being built. ICEA patterns are a different concern —
they improve the quality of future specifications, not the implementation. Mixing them creates
a file that is neither a clear decision log nor a clear pattern library.

**Dream-managed over manually maintained:** patterns go stale as codebases evolve. Dream's
staleness check (anchor validation, age threshold) provides automated maintenance without
developer discipline.

**Committed file over per-developer memory:** ICEA patterns have team value. Developer A's
discovery should benefit Developer B. A committed file achieves team sharing without a server.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Extend `MEMORY.md` with ICEA patterns | Mixed concerns; Dream's memory cadence is optimised for decisions, not patterns |
| Per-developer local file | Patterns never shared across team |
| ICEA template boilerplate | Too generic; cannot capture codebase-specific dependency contracts |

## Consequences

- `icea-feature` Step 3b reads the file on every ICEA draft
- Dream Phase 3.5 validates staleness on every consolidation run
- `setup-init` seeds an empty skeleton; `setup-status` shows presence
- Patterns that match ICEA quality signals (ADR-0065) are promoted here automatically
