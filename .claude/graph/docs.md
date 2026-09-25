---
paths: docs/**
---

_Fingerprint: 9bc724c554e4e11f1fa7bbc06919cbb9aeaff8cd | Updated: 2026-09-23_

## Bounded context
Plugin developer documentation: ADRs (architecture decision records), migration guides (version-to-version upgrade instructions for provisioned projects), DEVELOPER-GUIDE.md, changelogs, and plans.

## Key files
- `docs/adr/` — architecture decision records (ADR 0001–ADR 0059+)
- `docs/migrations/` — per-version migration instructions for setup-sync
- `docs/plans/` — planning documents

## Dependencies
None — documentation only.

## Patterns
- ADRs are numbered sequentially (0001, 0039, 0041, 0056, etc.) and referenced from code comments and SKILL.md files
- Migration docs drive `setup-sync` version-sensitive changes
