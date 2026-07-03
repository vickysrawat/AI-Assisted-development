# ASP.NET Web API / Minimal API — Dynamic Scan Notes

APIs return JSON/XML, not HTML — a spider finds little. Drive coverage from the endpoint
list instead.

## Prefer OpenAPI/Swagger import (--swagger)
```yaml
  - type: openapi
    parameters:
      apiFile: /zap/wrk/swagger.json
      targetUrl: "http://host.docker.internal:PORT"
```
This gives full method + parameter coverage with no spider. ZAP's API scan also supports
GraphQL (`-f graphql`) if relevant.

## No Swagger? Source-route fallback
Extract routes from controller attributes (`route-extraction.md`): `[Route("api/[controller]")]`,
`[HttpGet("{id}")]`, `[HttpPost]`, minimal-API `app.MapGet/MapPost(...)`. Build the endpoint
list, CONFIRM it with the user, then seed it as requestor targets.

## HTTP verb coverage
Test GET/POST/PUT/PATCH/DELETE on each endpoint — APIs often forget to restrict verbs.

## Content-Type
Send both `application/json` and `application/xml` where accepted, to probe XXE.

## Mass assignment
Inject extra unexpected fields into POST/PUT bodies to test model-binding exposure.

## Versioned APIs
If `/api/v1` and `/api/v2` both exist, scan both and diff — old versions often retain
unpatched issues.

## Auth
Usually JWT Bearer → `zap-auth.md` token section (system-level `ZAP_AUTH_HEADER_VALUE`).

## Key runtime risks
BOLA/IDOR on resource IDs, missing authz on individual endpoints, JWT alg/expiry issues,
verb tampering, mass assignment, rate-limit absence.
