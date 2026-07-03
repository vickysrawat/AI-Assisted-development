# Baseline / False-Positive Tuning

First scans produce noise (missing headers on static assets, CSP-on-JSON-API). Suppress
known-accepted alerts so the report stays trusted, via the Automation Framework
`alertFilter` job or a `--baseline` file.

## Baseline file format
```yaml
# dynamic-scan/baseline.yaml
- ruleId: 10038          # CSP header not set
  url: "http://host.docker.internal:PORT/api/.*"
  reason: "JSON API endpoints — CSP applies to HTML pages, accepted"
- ruleId: 10020          # X-Frame-Options
  url: ".*/health"
  reason: "Health endpoint returns no sensitive data"
```

## alertFilter job
```yaml
  - type: alertFilter
    parameters: {}
    alertFilters:
      - ruleId: 10038
        newRisk: "False Positive"
        url: "http://host.docker.internal:PORT/api/.*"
        urlRegex: true
```

## Rules
- A suppression needs a written reason — no blanket mutes.
- Suppress on (ruleId + URL pattern), never globally by ruleId alone.
- The report lists what was suppressed and why, so suppressions stay auditable.
- With `--diff`, suppressed alerts never count as "new".
