# Angular SPA — Dynamic Scan Notes

Angular renders client-side, so the traditional spider sees almost nothing. Use the
**Ajax spider** (drives a real headless browser inside the ZAP container).

```yaml
  - type: spiderAjax
    parameters:
      maxDuration: 10
      maxCrawlDepth: 10
      browserId: firefox-headless
```

## Route discovery
Ajax spider still misses lazy-loaded and guard-protected routes. Extract routes from
`app.routes.ts` / `*-routing.module.ts` (`route-extraction.md`) and seed them.

## IIS hosting
Built Angular (`ng build`) served by IIS → target `http://host.docker.internal:PORT`.
Self-signed HTTPS dev cert → `--accept-cert` (default on for localhost).

## Auth
Azure AD / JWT / cookie → `zap-auth.md`. Azure AD headless is not reliable (manual step).

## Key runtime risks
DOM XSS in bindings/`[innerHTML]`, token stored in localStorage, missing security headers,
open redirects, API calls that bypass the SPA's own authz.
