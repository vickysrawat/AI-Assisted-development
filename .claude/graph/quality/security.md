---
paths: skills/security
---
_Fingerprint: d0703e47180f9e2b9be614d14c7e9aff71ce4f5c | Updated: 2026-07-13_

## Bounded context
OWASP/CWE security scan with persistent ledger. Three-pass: static asset audit, SAST, free-flow adversarial. Writes HTML report to `security/` and updates `security/security-ledger.md`.

## Key files
- `SKILL.md`
- `skills/shared/arch-populated-detect.md` — loads architecture-security.md for context (Step 0g)

## Dependencies
- `security/security-ledger.md` — persistent finding ledger
- `skills/shared/findings-gate.md`

## Patterns
- Flags B1–B7 sensitive data exposure
- /fix and /dismiss operate on FP-fingerprinted findings
