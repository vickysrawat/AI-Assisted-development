---
paths: skills/code-review
---
_Fingerprint: cc0c07862ce70dad388052d477f9f9cae2018ee0 | Updated: 2026-07-13_

## Bounded context
Coverity-style static analysis with persistent tracking. Detects new defects, marks previously-found defects as fixed. Writes HTML + Markdown reports + running ledger into `CodeReviews/`. Cache-aware — only re-scans changed files.

## Key files
- `SKILL.md`

## Dependencies
- `.claude/file-cache.json` — per-file SHA fingerprints (cache-aware re-scan)
- `skills/shared/scope-flags-spec.md` — --full/--changed/--pr/--ci flags
- `CodeReviews/code-review-ledger.md` — persistent finding ledger

## Patterns
- Findings tracked with FP-fingerprints; /fix and /dismiss operate on these
- Cap removed in v3.6.0 — scans all files (like security)
