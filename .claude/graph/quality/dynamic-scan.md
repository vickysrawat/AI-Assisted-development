---
paths: skills/dynamic-scan
---
_Fingerprint: 6653e0d4a9ba6076dcabaa098279ba8df2969ff3 | Updated: 2026-07-13_

## Bounded context
DAST scan against a running web app/API using OWASP ZAP via Docker. Passive baseline + dependency audit by default; active scan via --scope flag. Writes HTML report to `dynamic-scan/`.

## Key files
- `SKILL.md`

## Dependencies
- Docker (local) — ZAP runs in container
- `dynamic-scan/dynamic-scan-ledger.md` — persistent finding ledger
- Target URL (--url flag)

## Patterns
- `.session`/`.context` files (plaintext-credential risk) are gitignored
- Requires running target app/API
