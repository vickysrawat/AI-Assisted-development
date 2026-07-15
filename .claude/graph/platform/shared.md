---
paths: skills/shared
---
<!-- auto-generated — edit graph.json then run /graph-sync -->
_Fingerprint: 3e0e394d152d15b8eee983dd751968fb5aa7e436 | Updated: 2026-07-13_

## Bounded context
Shared specification files consumed by all skills. Acts as the plugin's internal API contract
layer — defines schemas, consent gates, model routing, persona rules, and shared algorithms.
No skill runs without referencing at least one file here.

## Key files
- `graph-json-schema.md` — authoritative schema for `.claude/graph/graph.json`
- `graph-index-schema.md` — schema for `graph-index.md` breadth projection
- `graph-module-schema.md` — schema for per-module detail files
- `model-routing-spec.md` — ICEA_MODEL / REVIEW_MODEL / INFRA_MODEL routing table
- `source-file-consent.md` — Category B consent gate (required before any source read)
- `write-gate-spec.md` — WRITE PENDING gate (required before any source/config file write)
- `business-context-severity.md` — B1–B7 sensitivity classification
- `arch-populated-detect.md` — two-signal detector for populated architecture files (ADR 0053)
- `dream-reference.md` — Dream memory system reference

## Dependencies
None — this is the leaf node that all other skills depend on.

## Patterns
All skills load shared specs at instruction-read time (not via import — Claude reads markdown files).
Shared specs are **never** auto-loaded; skills explicitly read what they need.

**Depended on by:** icea-feature, icea-implement, architect, graph-sync, code-review, security, setup-status, setup-sync, pr-create, sprint-metrics, critic, and all other skills.
