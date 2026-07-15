---
paths: skills/graph-viz
---
_Fingerprint: 330d42cd91beda6123af1b4b01ea6c3f389c9f0a | Updated: 2026-07-13_

## Bounded context
Renders the knowledge graph as a self-contained offline HTML visualization at `.claude/graph/graph.html`. Reads graph.json only — never source files. Nodes colored by type, edges styled by type/confidence, hubs flagged. --3d for WebGL mode.

## Key files
- `SKILL.md`

## Dependencies
- `.claude/graph/graph.json` — read-only input
