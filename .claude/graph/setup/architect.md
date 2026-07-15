---
paths: skills/architect
---
<!-- auto-generated — edit graph.json then run /graph-sync -->
_Fingerprint: 7dd655b54f0a08b12066acf7cded2ef962dd0f75 | Updated: 2026-07-13_

## Bounded context
Detects repo type, runs Bootstrap Phase 2 (deploys templates + rules), populates 8 architecture
docs, generates the initial knowledge graph. Triggered by setup-init; also invokable manually.

## Key files
- `SKILL.md` — full instruction set including Step 0.5 (deployment questionnaire), Step 1 (repo detection), Steps 3–6 (doc population), Step 7 (graph generation)
- `prompts/` — per-stack prompts (11 stacks: dotnet-api, angular-nx, angular-standard, react, js-library, aspnet-framework, aspnet-mvc, spring-boot, python-fastapi, python-django, python-flask)
- `templates/_shared/` — shared base architecture templates (4 files: data, integrations, security, decisions)
- `templates/<stack>/` — stack-specific templates + overrides (each resolves to 8 files via compose)

## Dependencies
- `scripts/setup-init-bootstrap.cjs` — Phase 2 triggered after repo type detection
- `scripts/graph-extract-edges.js` — called in Step 7-2 after writing graph.json
- `skills/shared/arch-populated-detect.md` — two-signal population detector

## Patterns
- Bootstrap Phase 2 compose: `_shared/` base + `<stack>/` overrides (stack wins collisions); 88→56 template files (ADR 0051)
- `<!-- TEMPLATE -->` marker retained through all copy paths; removed ONLY in Step 5 after real population (ADR 0053)
- Deployment questionnaire (Step 0.5) requires explicit `APPROVED` reply before writing

**Depended on by:** setup-init (orchestrates), graph-sync (refines EXTRACTED edges after architect).
