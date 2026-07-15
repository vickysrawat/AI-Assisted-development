---
paths: tests
---
_Fingerprint: 887a0228f9abc6bacf8d813ad96c4a2ddf9a7f6a | Updated: 2026-07-13_

## Bounded context
Test suite for the plugin. Two tiers: offline structural validation and API-backed skill invocation tests.

## Key files
- `validate.js` — offline gate (259 assertions, no API/network): commands, skills, rules, scenarios, hooks, version consistency. Must be 259✓/0✗ before any release.
- `runner.js` — end-to-end tests (requires Claude API + network)
- `validate.py` — Python port of validate.js (mirrors logic)
- `skill-scenarios/` — fixture files for scenario tests

## Patterns
- `validate.js` is the **only** offline gate runnable in air-gapped/corporate environments
- Validators hardcoding exact phrases rot on every rename — prefer regex alternatives (lesson from v3.8.0 restore)
