---
paths: skills/plugin-readiness
---
_Fingerprint: 7e54639f5530c7b03723ebdf4fa81c384f8a86eb | Updated: 2026-07-13_

## Bounded context
Plugin production readiness assessment. Evaluates 6 domains: infrastructure health, model routing, memory health, governance rails, skill quality, session budget. Reads plugin state only — no application source.

## Key files
- `SKILL.md`

## Dependencies
- `.claude/` plugin state files
- `.claude-plugin/plugin.json` — model routing and version

## Patterns
- Produces an HTML report
- Triggers on: "is the plugin production ready", "plugin health"
