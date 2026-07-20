---
paths: skills/dynamic-scan
---
_Fingerprint: d5508953d707a6357560bc10d78aee29c3cccc64 | Updated: 2026-07-18_

## Bounded context
DAST scan against a running web app/API using OWASP ZAP via Docker. Passive baseline + dependency audit by default; active scan via --scope flag. Writes HTML report to `dynamic-scan/`. VSTO add-ins exit gracefully — they have no HTTP surface for ZAP to scan.

## Key files
- `SKILL.md` — VSTO Guard section at the top: detects ThisAddIn.cs/ThisWorkbook.cs/ThisDocument.cs fingerprint files and outputs a clear "no web surface" message instead of attempting ZAP

## Dependencies
- Docker (local) — ZAP runs in container
- `dynamic-scan/dynamic-scan-ledger.md` — persistent finding ledger
- Target URL (--url flag)

## Patterns
- `.session`/`.context` files (plaintext-credential risk) are gitignored
- Requires running target app/API
- VSTO projects: redirects to `/code-review --full` and `/security-review` as appropriate alternatives
