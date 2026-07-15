---
paths: skills/dream-rollback
---
_Fingerprint: f497f2a53a9a844d2a1b8a9b20f16324ccb565e9 | Updated: 2026-07-13_

## Bounded context
Reverses a specific Dream consolidation run using the audit trail in `memory/dream-log.md`. Lists available runs, shows changes, confirms before reversing. The rollback itself is logged and is reversible.

## Key files
- `SKILL.md`

## Dependencies
- `memory/dream-log.md` — audit trail of dream runs

## Patterns
- Triggered by: "rollback dream", "undo dream", "reverse dream run"
