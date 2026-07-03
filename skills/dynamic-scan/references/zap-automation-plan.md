# ZAP Automation Framework — Plan Templates

The skill generates one `zap-plan.yaml` and runs it with
`zap.sh -cmd -autorun /zap/wrk/zap-plan.yaml`. This is the maintained path; the packaged
`zap-baseline.py` / `zap-full-scan.py` scripts are being migrated onto this framework.

All plans mount the working dir at `/zap/wrk/`. Reports land in `dynamic-scan/`.

---

## Base plan skeleton

```yaml
env:
  contexts:
    - name: target
      urls:
        - "http://host.docker.internal:PORT"
      includePaths:
        - "http://host.docker.internal:PORT.*"
  parameters:
    failOnError: true
    failOnWarning: false
    progressToStdout: true

jobs:
  - type: passiveScan-config
    parameters:
      scanOnlyInScope: true

  # --- spider job(s) inserted here per stack ---

  - type: passiveScan-wait
    parameters:
      maxDuration: 5

  # --- activeScan inserted ONLY for --full or --scope ---

  - type: report
    parameters:
      template: traditional-html
      reportDir: /zap/wrk
      reportFile: dynamic-scan-report
  - type: report
    parameters:
      template: traditional-json
      reportDir: /zap/wrk
      reportFile: dynamic-scan-report
```

---

## Spider job by stack

**MVC / Razor Pages (server-rendered) — traditional spider:**
```yaml
  - type: spider
    parameters:
      maxDuration: 10        # --max-duration
      maxDepth: 10
    # seed extra routes extracted in skill Step 2:
    urls:
      - "http://host.docker.internal:PORT/Home/Index"
      - "http://host.docker.internal:PORT/{controller}/{action}"
```

**Angular / Blazor (JS-rendered) — ajax spider:**
```yaml
  - type: spiderAjax
    parameters:
      maxDuration: 10
      maxCrawlDepth: 10
      browserId: firefox-headless
```

**Web API with OpenAPI/Swagger — import, no spider needed (`--swagger`):**
```yaml
  - type: openapi
    parameters:
      apiFile: /zap/wrk/swagger.json
      targetUrl: "http://host.docker.internal:PORT"
```

---

## Active scan job (ONLY for --full or --scope)

```yaml
  - type: activeScan
    parameters:
      maxRuleDurationInMins: 10     # --max-duration
      maxScanDurationInMins: 60
      threadPerHost: 2              # --rate-limit (low = gentle on local IIS)
      policy: "Default Policy"
```

For `--scope /api/v1/payments`, narrow the context `includePaths` to that path so the
attack payloads only hit the intended area.

---

## Authentication block

Inserted into the context. See `zap-auth.md` for per-type detail. Form-based example:

```yaml
  contexts:
    - name: target
      urls: ["http://host.docker.internal:PORT"]
      authentication:
        method: "browser"          # or "form" / "json" / "script"
        parameters:
          loginPageUrl: "http://host.docker.internal:PORT/Account/Login"
          loginPageWait: 5
      sessionManagement:
        method: "cookie"
      verification:
        method: "poll"
        loggedInRegex: "\\bLogout\\b"
        loggedOutRegex: "\\bLogin\\b"
        pollFrequency: 60
        pollUnits: "requests"
      users:
        - name: tester
          credentials:
            username: "${ZAP_USER}"     # system-level env var, not inline
            password: "${ZAP_PASS}"
```

The `verification` block is mandatory for authenticated scans — without a logged-in or
logged-out regex, ZAP will not run the auth script (skill Step 1d gate).

---

## Exit status job (CI gating, --fail-on)

```yaml
  - type: exitStatus
    parameters:
      errorLevel: "High"      # --fail-on High → non-zero exit if any High+ finding
      warnLevel: "Medium"
```

ZAP exits non-zero so the pipeline fails. Use with `--ci`.

---

## HTTPS / self-signed dev cert

For `https://localhost` targets, pass `-config certificate.use=false` on the command line,
or accept the dev cert. Most local IIS / `dotnet run` targets need this or every request
fails TLS validation.

---

## Run commands

Interactive (Windows/macOS):
```bash
docker run --rm --add-host=host.docker.internal:host-gateway \
  -v "$(pwd)/dynamic-scan:/zap/wrk/:rw" \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -cmd -autorun /zap/wrk/zap-plan.yaml
```

CI (smaller bare image, addon update first for AF):
```bash
docker run --rm -v "$(pwd)/dynamic-scan:/zap/wrk/:rw" \
  -t ghcr.io/zaproxy/zaproxy:bare \
  bash -c "zap.sh -cmd -addonupdate; zap.sh -cmd -autorun /zap/wrk/zap-plan.yaml"
```
