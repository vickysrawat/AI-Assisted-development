---
paths: skills/architect
---
<!-- auto-generated — edit graph.json then run /graph-sync -->
_Fingerprint: d19bcfdceee242b2cb61217b7647d23475b7afee | Updated: 2026-07-18_

## Bounded context
Detects repo type, runs Bootstrap Phase 2 (deploys templates + rules), populates 8 architecture
docs, generates the initial knowledge graph. Triggered by setup-init; also invokable manually.

## Key files
- `SKILL.md` — full instruction set: Step 0.5 (deployment questionnaire with VSTO branch), Step 1 (repo detection incl. VSTO), Steps 3–6 (doc population), Step 7 (graph + additionalDirectories scaffolding)
- `prompts/` — per-stack prompts (12 stacks: dotnet-api, angular-nx, angular-standard, react, js-library, aspnet-framework, aspnet-mvc, spring-boot, python-fastapi, python-django, python-flask, **vsto**)
- `templates/_shared/` — shared base templates (data, integrations, security, decisions); security now has Mermaid trust-zone diagram
- `templates/<stack>/` — stack-specific templates; `templates/vsto/` added (architecture.md, flows, reference, deployment, **security**)

## Dependencies
- `scripts/setup-init-bootstrap.cjs` — Phase 2 triggered after repo type detection
- `scripts/graph-extract-edges.js` — called in Step 7-2 after writing graph.json
- `skills/shared/arch-populated-detect.md` — two-signal population detector

## Patterns
- Bootstrap Phase 2 compose: `_shared/` base + `<stack>/` overrides (stack wins collisions)
- `<!-- TEMPLATE -->` marker retained through all copy paths; removed ONLY in Step 5 after real population (ADR 0053)
- Deployment questionnaire (Step 0.5) requires explicit `APPROVED` reply before writing; VSTO projects get a ClickOnce-specific questionnaire instead of IIS/Docker questions
- Step 7 additionalDirectories: reads `.claude/settings.local.json`, detects repo type for each dir, deploys architecture scaffold into `<dir>/.claude/architecture/`
- All Mermaid diagrams in templates wrapped in `<div style="background-color: white; padding: 25px; border-radius: 8px;">`

**Depended on by:** setup-init (orchestrates), graph-sync (refines EXTRACTED edges after architect).
