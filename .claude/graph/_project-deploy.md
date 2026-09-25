---
paths: _project-deploy/**
---

_Fingerprint: 3a59cba002fe219b94ee7f8db2eef66bd2023ce0 | Updated: 2026-09-23_

## Bounded context
Deployment template files copied by `setup-init-bootstrap.cjs` into target projects during provisioning. Contains the authoritative CLAUDE.md template (with all plugin-managed sections) and any other bootstrap source files.

## Key files
- `_project-deploy/CLAUDE.md` — bootstrap source CLAUDE.md template (copied verbatim to target projects)

## Dependencies
- `scripts/setup-init-bootstrap.cjs` — reads and copies these templates into target projects (INFERRED)

## Patterns
- Changes to `_project-deploy/CLAUDE.md` affect all future `setup-init` runs
- The plugin's own `CLAUDE.md` is a separate file (governs plugin dev sessions); `_project-deploy/CLAUDE.md` governs target projects
