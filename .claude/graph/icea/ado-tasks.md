---
paths: skills/ado-tasks
---
_Fingerprint: 84f064a533acec94e98c9c8821553f58037c1f0b | Updated: 2026-07-13_

## Bounded context
Generates a complete Azure DevOps task breakdown from an approved ICEA. Creates one task per Acceptance Criterion per active layer with titles, tags, and effort estimates.

## Key files
- `SKILL.md`

## Dependencies
- Approved ICEA on disk
- ADO REST API (creates tasks)
- `AZURE_DEVOPS_PAT` env var

## Patterns
- Triggered by: "break down this story", "create tasks", "generate ADO tasks"
- Stack layers detected from architecture.md
