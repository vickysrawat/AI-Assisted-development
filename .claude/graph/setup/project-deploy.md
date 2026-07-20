---
paths: _project-deploy
---
_Fingerprint: 138bc120d5b988667abb353faad7edd68eb48038 | Updated: 2026-07-18_

## Bounded context
Canonical deploy sources for all hook files, gitignore base, and rules deployed to target projects. Bootstrap reads from here and copies to `.claude/hooks/` and `.claude/rules/` in target projects.

## Key files
- `hooks/icea-floor.sh` — ICEA feature gate (PreToolUse); exemptions updated: review/analysis output dirs (`*/CodeReviews/*`, `*/security/*`, `*/dynamic-scan/*`, `*/token-analysis/*`, `*/prod-readiness/*`) and all guide files (`*guide*`)
- `rules/csharp-vsto-rules.md` — VSTO coding rules (COM disposal, lifecycle, Ribbon, TaskPane, thread safety, testing); deployed to VSTO target projects; `detect:` frontmatter uses VSTO fingerprint files
- `hooks/check-settings-secrets.cjs` — secret guard for settings.json
- `hooks/findings-gate-precommit.sh` — pre-commit findings gate
- `hooks/memory-capture.sh` — UserPromptSubmit memory capture hook

## Patterns
- GOTCHA: hooks exist in TWO places: `_project-deploy/hooks/` (canonical) AND `.claude/hooks/` (deployed). Both must be kept identical.
- `csharp-vsto-rules.md` uses `excludeIfFiles` in `csharp-dotnet-rules.md` to prevent modern .NET rules from deploying to VSTO projects (VSTO fingerprint files act as exclusion signal)
