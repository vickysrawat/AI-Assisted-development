---
paths: skills/graph-sync
---
_Fingerprint: 61e31c5a3195bba8faae60cf8f8c54d93925b4ec | Updated: 2026-07-13_

## Bounded context
Incremental knowledge graph refresh. Recomputes module-wide fingerprints, regenerates only stale modules, reconciles removed/renamed/orphaned modules, derives EXTRACTED dependency edges, updates graph.json and its markdown projections. Deletes the `.stale` flag on success.

## Key files
- `SKILL.md` v2.0

## Dependencies
- `.claude/graph/graph.json` — authoritative (must exist; run /setup-init if missing)
- `scripts/graph-extract-edges.js` — called in Step 8a for EXTRACTED edges

## Patterns
- Incremental: only stale modules (fingerprint changed) are regenerated
- Flat→domain restructure triggers automatically past 30 modules
- git hook `graph-stale-detect.sh` sets `.claude/graph/.stale` on post-merge
