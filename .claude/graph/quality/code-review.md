---
paths: skills/code-review
---
_Fingerprint: e3af202cd18c5074fdca10ee6fa6ba02b762ac13 | Updated: 2026-07-18_

## Bounded context
Coverity-style static analysis with persistent tracking. Detects new defects, marks previously-found defects as fixed. Writes HTML + Markdown reports + running ledger into `CodeReviews/`. Cache-aware — only re-scans changed files.

## Key files
- `SKILL.md` — Step 0b detects VSTO; Step 0g checker table loads `checkers-vsto.md` for VSTO projects in addition to `checkers-dotnet.md`
- `references/checkers-vsto.md` — VSTO-specific checkers: RESOURCE_LEAK (COM not released, foreach on COM collections), THREAD_SAFETY (Office OM off UI thread), MEMORY_LEAK (unsubscribed events), API_MISUSE, LOGIC_ERROR, SECURITY (ClickOnce HTTP, cert bypass)

## Dependencies
- `.claude/file-cache.json` — per-file SHA fingerprints (cache-aware re-scan)
- `skills/shared/scope-flags-spec.md` — --full/--changed/--pr/--ci flags
- `CodeReviews/code-review-ledger.md` — persistent finding ledger

## Patterns
- Findings tracked with FP-fingerprints; /fix and /dismiss operate on these
- VSTO checker table is additive — both `checkers-dotnet.md` and `checkers-vsto.md` load for VSTO projects
