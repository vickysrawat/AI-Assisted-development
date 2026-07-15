---
paths: _project-deploy
---
_Fingerprint: ac75a9cd79cf51186abe98a07bc552085502b718 | Updated: 2026-07-13_

## Bounded context
Canonical deploy sources for all hook files and gitignore base. These are the authoritative copies — bootstrap reads from here and copies to `.claude/hooks/` in target projects.

## Key files
- `hooks/icea-floor.sh` — ICEA feature gate (PreToolUse)
- `hooks/check-settings-secrets.cjs` — secret guard for settings.json
- `hooks/findings-gate-precommit.sh` — pre-commit findings gate
- `hooks/memory-capture.sh` — UserPromptSubmit memory capture hook
- `hooks/graph-stale-detect.sh` — post-merge graph staleness flag
- `commands/` — command stub source files

## Patterns
- GOTCHA: hooks exist in TWO places: `_project-deploy/hooks/` (canonical) AND `.claude/hooks/` (deployed). Both must be kept identical. `.claude/hooks/.hashes` tracks SHA256 of the deploy-source. Editing only the deployed copy = latent regression on next setup-sync.
