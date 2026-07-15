---
paths: skills/token-analysis
---
_Fingerprint: e3968b33d71b267b53f6058106c664433702e8c3 | Updated: 2026-07-13_

## Bounded context
Analyses token consumption across recent Claude Code sessions. Persistent cache so subsequent runs only process delta. Identifies expensive operations, costly prompt patterns. Writes HTML to `token-analysis/`.

## Key files
- `SKILL.md`

## Dependencies
- `token-analysis/token-graph.json` — persistent cache
- Claude Code session transcript files

## Patterns
- Subsequent runs only process new sessions and changed files (delta)
