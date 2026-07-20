---
paths: scripts
---
<!-- auto-generated — edit graph.json then run /graph-sync -->
_Fingerprint: c176ca3c42a8c1f717b60e59f1d69a50c3d8ddbe | Updated: 2026-07-18_

## Bounded context
Node.js CJS scripts that handle all mechanical plugin work. The central script is
`setup-init-bootstrap.cjs` — the single deterministic pass that provisions a target project.

## Key files
- `setup-init-bootstrap.cjs` — creates dirs, deploys stubs/hooks/rules, wires settings, seeds state files, writes manifest; VSTO entries added: `ARCH_TEMPLATE_FOLDER['VSTO']`, `BACKEND_LAYER3_RULES['csharp-vsto-rules.md']`, `STACK_SIGNALS['csharp-vsto-rules.md']`, `hasProjectContent` regex includes `VSTO|Office`
- `external-stack-detection.cjs` — detects stacks in `additionalDirectories`; VSTO detection added BEFORE `isFramework` check (VSTO csproj contains `Microsoft.Office.Tools`/`Microsoft.Office.Interop`, not `System.Web`); forces `dotnet_framework=true` when VSTO detected
- `graph-extract-edges.js` — deterministic EXTRACTED edge derivation (ADR 0041); never touches nodes/fingerprints
- `plugin-state.cjs` — semver-aware plugin version drift detection

## Dependencies
- Node.js built-ins: `fs`, `path`, `crypto`, `child_process`
- `pptxgenjs` (devDependency) — gen-story-pptx.cjs only
- Reads `_project-deploy/` for source files to deploy

## Patterns
- All scripts use CJS (`require`) — no ES module syntax
- GOTCHA: VSTO csproj lacks `System.Web`/`System.ServiceModel` — without the VSTO-first check, `external-stack-detection.cjs` would emit `dotnet` (modern .NET) instead of `dotnet_framework`
- Bootstrap Phase 2 (`--mode post-detect`) triggered by architect after repo type detection

**Depended on by:** architect (Phase 2), setup-sync, setup-teardown.
