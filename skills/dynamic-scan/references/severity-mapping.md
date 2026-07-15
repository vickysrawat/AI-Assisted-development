# Severity Mapping — ZAP Risk → CVSS/CWE → Business Override

ZAP rates alerts High / Medium / Low / Informational with a confidence level. Normalise to
the plugin's Critical/High/Medium/Low/Info scale, then apply business overrides.

| ZAP risk | ZAP confidence | Normalised | Notes |
|---|---|---|---|
| High | High/Medium | High | Confirmed injection/authz → candidate for Critical after B-override |
| High | Low | Medium | Verify manually before calling it High |
| Medium | High/Medium | Medium | |
| Medium | Low | Low | |
| Low | any | Low | |
| Informational | any | Info | Often header/best-practice; baseline-suppress noise |

Each ZAP alert carries a CWE id — carry it through to the report. Map common ones:
SQLi → CWE-89, XSS → CWE-79, path traversal → CWE-22, command injection → CWE-78,
IDOR/BOLA → CWE-639, open redirect → CWE-601, missing authz → CWE-862.

## Business-context override (mandatory)
After normalising, apply `$PLUGIN_DIR/skills/shared/business-context-severity.md`. Any finding that
exposes immigration IDs, privileged matter data, or vulnerable-client data is escalated to
**Critical** regardless of ZAP's rating, with the B-flag cited (e.g. B2).
