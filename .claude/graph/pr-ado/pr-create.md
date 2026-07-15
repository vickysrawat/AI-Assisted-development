---
paths: skills/pr-create
---
_Fingerprint: 17af1711bbacf3280667d5ac617260667920a433 | Updated: 2026-07-13_

## Bounded context
Creates a Pull Request in Azure DevOps via REST API, or saves a PR draft artifact for manual submission. Validates against ICEA before submitting.

## Key files
- `SKILL.md`

## Dependencies
- ADO REST API — `AZURE_DEVOPS_PAT` required
- git diff + ICEA on disk
- `skills/shared/` — findings gate, ICEA compliance check

## Patterns
- `--ssl-no-revoke -4` required on corporate network
- Flags: --skip-icea-check, --skip-security-gate, --offline
