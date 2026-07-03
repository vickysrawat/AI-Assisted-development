# 0037 — Roadmap proposals live in docs/proposals/, outside shared specs
Status: Accepted · Date: 2026-07-01
Governs: `docs/proposals/`, `.claude-plugin/plugin.json` `components.shared`

## Problem
`skills/shared/` (ADR 0003) is the single source of truth for conventions that
*live skills actually consume*, and every entry is registered in `plugin.json`
`components.shared`. A forward-looking design that is written but **not yet
implemented** — e.g. the async-checkpoint-queue spec (ADR 0024, v0.9) — does not
fit: no skill references it, yet sitting in `skills/shared/` and the manifest it
reads as an active primitive. In a v2.6.0 audit it surfaced as an "orphan" (zero
references) precisely because a roadmap RFC was miscategorised as a shipping spec.

## Decision
Unimplemented proposals live in `docs/proposals/`, not `skills/shared/`, and are
**excluded** from `plugin.json` `components.shared`. The manifest therefore lists
only shipping components. A proposal graduates into `skills/shared/` (and the
manifest) the moment a skill begins to reference it — at which point ADR 0003's
"two or more skills" rule applies. Each proposal keeps its governing ADR (the RFC
and its decision record are separate artifacts).

`docs/proposals/README.md` indexes the proposals; `validate.py` check 20 enforces
that `skills/shared/*.md` and `components.shared` stay in exact agreement, so a
proposal can no longer hide among live specs.

## Rationale
- **Manifest honesty** — `components.shared` should describe what ships, so audits,
  version tracking, and readiness checks are trustworthy.
- **Design is not lost** — relocation, not deletion, preserves the thinking; the
  governing ADR still points at it.
- **Clear graduation path** — "a skill references it" is a bright line for when a
  proposal becomes a primitive.

## Consequences
- ADR 0024 now governs `docs/proposals/async-checkpoint-queue.md` (path updated).
- `validate.py` check 34 (every shared spec needs an ADR) no longer applies to
  relocated proposals, since they leave `skills/shared/`.

## Revisit when
A proposal is implemented and consumed by a skill — promote it to `skills/shared/`,
add it to `components.shared`, and note the promotion in its ADR.
