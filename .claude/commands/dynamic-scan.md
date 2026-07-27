---
description: "Run a dynamic (DAST) scan against a running app/API with OWASP ZAP via Docker. Default: passive baseline + dependency audit.  Example: /dynamic-scan --url https://localhost:5001"
argument-hint: "[--url <target> | --deps-only] [--stack ...] [--auth ...] [--full | --scope <path>] [--ci | --help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/dynamic-scan — OWASP ZAP DAST scan against a running app/API (requires Docker).

Arguments:
  --url <target>       Base URL of the running app to scan (e.g. https://localhost:5001).
  --stack <type>       Force stack detection (e.g. dotnet, angular, node).
  --auth <token>       Auth header value for authenticated scans.
  --swagger <url>      OpenAPI/Swagger spec URL for API-aware scanning.
  --scope <path>       Restrict active scan to this path prefix.
  --deps-only          Dependency audit only — no active or passive scan.
  --full               Active scan + dependency audit (default: passive baseline only).
  --diff               Scan only changed files/routes.
  --ci                 CI mode — exits with non-zero on findings above threshold.
  --fail-on <severity> Severity threshold for CI failure (low|medium|high|critical).
  --help, ?help        Show this help.

Examples:
  /dynamic-scan --url https://localhost:5001
  /dynamic-scan --url https://localhost:5001 --full
  /dynamic-scan --deps-only
  /dynamic-scan --url https://localhost:5001 --ci --fail-on high
```

<skill>ai-assisted-development:dynamic-scan</skill>
