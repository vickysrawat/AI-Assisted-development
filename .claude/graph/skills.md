---
paths: skills/**
---

<!-- Hub module — high dependency degree -->
_Fingerprint: 2f595bfa50942a1ae07a803681ab479b3cb3a813 | Updated: 2026-09-23_

## Bounded context
Markdown SKILL.md instruction files executed by Claude at runtime. Each skill is a directory under `skills/` containing a `SKILL.md` with step-by-step instructions. `skills/shared/` holds cross-skill specifications (write gate, model routing, consent, migration knowledge, etc.).

## Key files
- `skills/setup-init/SKILL.md` — plugin provisioning orchestration
- `skills/architect/SKILL.md` — architecture doc generation
- `skills/icea-feature/SKILL.md` — ICEA feature planning gate
- `skills/shared/plugin-path-resolution.md` — canonical PLUGIN_DIR resolver (referenced by every skill)
- `skills/shared/write-gate-spec.md` — Write Gate specification

## Dependencies
- `scripts/**` — skills invoke scripts via Bash tool calls
- `_project-deploy/**` — setup-init provisions template files from _project-deploy into target projects

## Patterns
- Skills reference each other via `$PLUGIN_DIR/skills/<name>/SKILL.md` absolute paths
- Cross-skill specs in `skills/shared/` are the single source of truth (SRP)
- No compiled code — plain Markdown executed by Claude's reasoning
