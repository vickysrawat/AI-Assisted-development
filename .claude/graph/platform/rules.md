---
paths: rules
---
_Fingerprint: 203eb969519ed6a103b765988d59e121753d9e39 | Updated: 2026-07-13_

## Bounded context
Rule files deployed to `.claude/rules/` in target projects by Bootstrap Phase 2. 4-layer frontmatter selection: Layer 0 (always), Layer 1 (backend-only), Layer 3a (file glob), Layer 3b (npm deps).

## Key files
- `project-rules.md` — Layer 0, always deployed (design philosophy, scope control, decision transparency)
- `javascript-rules.md` — ES2015+/CJS/ESM patterns
- `nodejs-typescript-rules.md` — Node.js + TypeScript patterns
- `csharp-dotnet-rules.md` — .NET 8+ patterns
- Plus 40+ other ecosystem-specific rule files

## Patterns
- Rules are loaded by Claude Code automatically on every file edit (via `.claude/rules/`)
- Bootstrap Phase 2 deploys based on detected `repo_type` and stack signals
