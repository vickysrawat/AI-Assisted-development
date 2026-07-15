---
paths: skills/setup-teardown
---
_Fingerprint: 1bbb914c25fdb09782a04f98560cc86964e6c756 | Updated: 2026-07-13_

## Bounded context
Removes plugin-managed content from a target project by scope (--full, --skills, --hooks, --rules, --commands, --state). Always dry-runs first; requires explicit CONFIRM before removing. memory/ is never removed.

## Key files
- `SKILL.md`

## Dependencies
- `scripts/setup-teardown.cjs`

## Patterns
- Use to clean up after version changes or fully exit the plugin workflow
