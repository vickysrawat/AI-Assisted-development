# 0017 — Domain-map: architecture orientation in one read
Status: Superseded by [0038](0038-knowledge-graph-orientation.md) (2026-07-02) · Date: 2026-02 (retroactive, 2026-06-11)
Governs: `skills/shared/domain-map-spec.md` (retired in v3.0.0)

> **Superseded.** `domain-map.md` was retired in v3.0.0. The codebase knowledge
> graph (`.claude/graph/`) — the "hierarchical split by module" this ADR's *Revisit
> when* anticipated — is now the single orientation layer. See [ADR 0038](0038-knowledge-graph-orientation.md).
> The decision below is retained for historical context.

## Problem
The AI re-read the whole codebase every morning to figure out where things live.
Senior engineers don't; the tooling shouldn't either.

## Decision
domain-map.md maps feature areas to entry-point files. The architect skill
generates and refreshes it. Every skill that needs codebase orientation reads
this file instead of scanning raw source. Includes a staleness rule and a
fingerprint contract for cache invalidation.

## Revisit when
Codebases grow large enough that domain-map.md itself becomes unwieldy (>500
lines) — may need a hierarchical split by module.
