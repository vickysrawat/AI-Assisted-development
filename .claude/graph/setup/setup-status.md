---
paths: skills/setup-status
---
_Fingerprint: 72c18a27925087050d0af583a1ac4ad7ed5ea2b1 | Updated: 2026-07-13_

## Bounded context
Green/amber/red health check for all plugin infrastructure: CLAUDE.md, memory, rules, commands, hooks, architecture docs, knowledge graph, file-cache, token-graph, gitignore coverage, plugin version drift. Read-only — never modifies anything.

## Key files
- `SKILL.md`

## Dependencies
- `.claude/dream-init-state.json` — reads `deployed_rules[]`, `dream_init_plugin_version`
- `scripts/plugin-state.cjs` — for version drift detection
- All `.claude/` subdirs

## Patterns
- Run before setup-init on an existing project to see what's already done
- Check 1i: RED = "secret present in settings.json" (v3.12.0)
