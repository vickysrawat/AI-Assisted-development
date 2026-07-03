# Report Format

Self-contained HTML written to `dynamic-scan/dynamic-scan-<date>.html` (mirrors how the
`security` skill writes to `security/`). No external assets.

## Sections
1. **Header** — target URL, stack, scan type (passive/active), auth type + verified yes/no,
   scan date, ZAP version, duration.
2. **Summary** — counts by severity; dependency vuln counts (direct/transitive); health
   score /100 (GREEN/AMBER/RED).
3. **Diff** (if `--diff`) — findings NEW since the last report, highlighted.
4. **Findings** — per finding:
   - Severity (post business-override) + CVSS + CWE
   - URL + parameter
   - Attack payload / evidence (ZAP's request/response excerpt)
   - Source mapping: file:line (if Step 5 ran and consent given)
   - Concrete fix
   - Confidence + whether manual verification is advised
5. **Dependencies** — table: package, current, fixed, direct/transitive, advisory id, fix command.
6. **Suppressed** — baseline-suppressed alerts with reasons (auditable).
7. **Scope & limits** — what was/wasn't covered; v2-deferred items (WebSocket, headless OAuth).

## Per-finding fix block
State the file:line, what is missing, and the exact change — not "fix the SQL injection"
but the concrete parameterised-query replacement.

## Tone
Findings are facts with evidence. Flag low-confidence ZAP alerts as "verify manually"
rather than asserting them. Note this is a sensitive area; if the user is acting on
findings in production, recommend confirming each High/Critical before remediation work.
