---
paths: scripts
---
<!-- auto-generated — edit graph.json then run /graph-sync -->
_Fingerprint: c60fe5c6200e2fdf40cfd45fd50d2ed8eea2db07 | Updated: 2026-07-13_

## Bounded context
Node.js CJS scripts that handle all mechanical plugin work. The central script is
`setup-init-bootstrap.cjs` — the single deterministic pass that provisions a target project.

## Key files
- `setup-init-bootstrap.cjs` — creates dirs, deploys stubs/hooks/rules, wires settings, seeds state files, writes manifest; supports `--mode init|sync|post-detect`
- `graph-extract-edges.js` — deterministic EXTRACTED edge derivation from source imports (ADR 0041); never touches nodes/fingerprints
- `plugin-state.cjs` — semver-aware plugin version drift detection (provisioned vs installed)
- `bump-version.js` — bumps version across all plugin files
- `check-version-consistency.js` — validates version is consistent
- `setup-teardown.cjs` — removes plugin-managed content from a target project
- `gen-story-pptx.cjs` — PowerPoint story slide generation (uses pptxgenjs)

## Dependencies
- Node.js built-ins: `fs`, `path`, `crypto`, `child_process`
- `pptxgenjs` (devDependency) — gen-story-pptx.cjs only
- Reads `_project-deploy/` for source files to deploy

## Patterns
- All scripts use CJS (`require`) — no ES module syntax
- `setup-init-bootstrap.cjs` is crash-safe: writes manifest after every step; re-run skips completed steps
- Bootstrap Phase 2 (`--mode post-detect`) is triggered by the architect skill after repo type detection

**Depended on by:** architect (Phase 2), setup-sync, setup-teardown.
