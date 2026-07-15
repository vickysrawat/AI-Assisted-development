---
paths: docs/adr
---
_Fingerprint: 324a2925351cb0b5d8903660bab1e193c9dc9213 | Updated: 2026-07-13_

## Bounded context
Architecture Decision Records — append-only log of non-obvious design choices. ADR 0001–0053+. Each ADR documents: decision, context, consequences, alternatives rejected.

## Key files
- `0041-deterministic-edge-extraction.md` — EXTRACTED edges via script, not LLM
- `0046-dream-init-bootstrap-pattern.md` — two-phase bootstrap pattern
- `0050-architecture-doc-set-expansion.md` — 4→8 architecture docs
- `0051-architect-template-dedup.md` — _shared/ template dedup
- `0052-critic-planning-gates.md` — critic at ICEA + Tech Spec drafts
- `0053-arch-doc-populated-detection.md` — two-signal TEMPLATE detector

## Patterns
- Append-only — never modify existing entries
- ADR 0038+ document the graph system (node types, edge types, fingerprinting)
