---
paths: skills/icea-implement
---
_Fingerprint: 7b15ce69deb9783677a660439adcfd0043e3f168 | Updated: 2026-07-13_

## Bounded context
Generates implementation code for an approved ICEA. Code gate uses critic in `code` mode before writing. Blocked by WRITE GATE until APPROVE ADO-{ID}.

## Key files
- `SKILL.md`

## Dependencies
- `skills/critic/SKILL.md` — code gate at Step 4a
- `skills/shared/write-gate-spec.md` — WRITE PENDING gate
- Approved ICEA on disk at `docs/...`

## Patterns
- Keyword: `IMPLEMENT ADO-{ID}` or `IMPLEMENT ADO-{ID} Story-{N}`
- For Epics: implement story by story
- Critic CODE gate fires after code generation, before disk write
