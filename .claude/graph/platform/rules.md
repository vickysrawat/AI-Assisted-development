---
paths: rules
---
_Fingerprint: d5f57ce5251c2c206846a80546b899e2f37d5f8c | Updated: 2026-07-18_

## Bounded context
Rule files deployed to `.claude/rules/` in target projects by Bootstrap Phase 2. 4-layer frontmatter selection: Layer 0 (always), Layer 1 (backend-only), Layer 3a (file glob), Layer 3b (npm deps).

## Key files
- `project-rules.md` — Layer 0, always deployed (design philosophy, scope control, decision transparency)
- `csharp-vsto-rules.md` — VSTO coding rules in plugin root; `paths:` only (no `detect:`); for plugin development context
- `javascript-rules.md` — ES2015+/CJS/ESM patterns
- `nodejs-typescript-rules.md` — Node.js + TypeScript patterns
- `csharp-dotnet-rules.md` — .NET 8+ patterns; `excludeIfFiles` updated to include VSTO fingerprint files so modern .NET rules don't deploy to VSTO projects

## Patterns
- Rules are loaded by Claude Code automatically on every file edit (via `.claude/rules/`)
- Bootstrap Phase 2 deploys based on detected `repo_type` and stack signals
- VSTO exclusion: `csharp-dotnet-rules.md` excludes itself when `ThisAddIn.cs`/`ThisWorkbook.cs`/`ThisDocument.cs` are present; `csharp-vsto-rules.md` (in `_project-deploy/rules/`) deploys instead
