---
paths: skills/security
---
_Fingerprint: 773364be7ae2e0959a9951ad5ce0f8dadf9bbc8f | Updated: 2026-07-18_

## Bounded context
OWASP/CWE security scan with persistent ledger. Three-pass: static asset audit, SAST, free-flow adversarial. Writes HTML report to `security/` and updates `security/security-ledger.md`.

## Key files
- `SKILL.md` — Step 0b detects VSTO; loads `vsto-checks.md` in addition to `pass1-patterns.md` for VSTO projects
- `references/vsto-checks.md` — VSTO-specific Pass 1 patterns: COM trust elevation, ClickOnce MITM (HTTP deploymentProvider), self-signed cert in prod, unconstrained macro trust (AutomationSecurity=Low), data exfiltration via Office OM, TLS bypass

## Dependencies
- `security/security-ledger.md` — persistent finding ledger
- `skills/shared/findings-gate.md`

## Patterns
- Flags B1–B7 sensitive data exposure
- /fix and /dismiss operate on FP-fingerprinted findings
- VSTO checks are additive — both `pass1-patterns.md` and `vsto-checks.md` applied for VSTO projects
