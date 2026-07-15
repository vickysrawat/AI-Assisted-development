---
paths: skills/pr-describe
---
_Fingerprint: fc6183d1413e8828f3b8050c1c075a44e1f24a7e | Updated: 2026-07-13_

## Bounded context
Generates a complete, ICEA-compliant pull request description from git diff. Maps every changed file to an Acceptance Criterion, flags scope creep, outputs a self-review checklist.

## Key files
- `SKILL.md`

## Dependencies
- git diff (reads automatically)
- Approved ICEA on disk

## Patterns
- Triggers on: "write PR", "PR description", "ready to raise a PR"
