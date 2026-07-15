---
paths: skills/setup-sync
---
_Fingerprint: ea63d165bbaf9ae2fb4f8390db46180c39b7954f | Updated: 2026-07-13_

## Bounded context
Re-provisions a target project after a plugin upgrade. Compares provisioned vs installed version; applies migration notes from `docs/migrations/`; re-copies hooks, refreshes ignore-file managed block, seeds new state/rule files; re-stamps the provisioned version. Idempotent.

## Key files
- `SKILL.md`

## Dependencies
- `scripts/setup-init-bootstrap.cjs` (`--mode sync`)
- `docs/migrations/` — per-version migration notes
- `.claude/dream-init-state.json` — `dream_init_plugin_version`

## Patterns
- Never overwrites developer content — only managed blocks and generated artifacts
- Alias: setup-init --upgrade
