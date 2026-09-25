---
paths: scripts/**
---

<!-- Hub module — high dependency degree -->
_Fingerprint: 10152b1bec5b5c256d3d8e0f6e89ca0df838d1a0 | Updated: 2026-09-23_

## Bounded context
Node.js utility scripts (.cjs) that perform all deterministic mechanical work for the plugin — provisioning, detection, graph generation, migration orchestration, upgrade checkpointing, and audit writing. Invoked by skills via Bash tool calls; never called directly by users.

## Key files
- `setup-init-bootstrap.cjs` — all mechanical provisioning (dirs, stubs, hooks, state files, gitignore)
- `repo-detect.cjs` — deterministic 12-type repo classification
- `stack-signals.cjs` — canonical signal→stack_key detection map
- `module-derive.cjs` — knowledge graph module skeleton derivation
- `graph-extract-edges.js` — EXTRACTED edge derivation from source imports (ADR 0041)

## Dependencies
- Node.js stdlib (fs, path, crypto, child_process, os) — runtime only, no npm deps
- `scripts/lib/source-classifier.cjs` — shared source classification helper
- `scripts/stack-signals.cjs` — imported by repo-detect, setup-init-bootstrap, external-stack-detection

## Patterns
- All writes are atomic where possible (`.tmp` → rename)
- Scripts include a "SCRIPT REVIEW" header documenting: what it does, touches, does NOT do, APIs used, how to verify
- Test coverage: each `.cjs` has a mirrored `tests/*.test.cjs`

**Depended on by:** tests (EXTRACTED), skills (INFERRED)
