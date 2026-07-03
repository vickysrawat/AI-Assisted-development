# Spring Boot — Dynamic Scan Notes

Spring Boot serves REST APIs (JSON), server-rendered pages (Thymeleaf), or both.
Drive coverage from the endpoint list; a spider alone finds little on a JSON API.

## Prefer OpenAPI import (--swagger)
If springdoc-openapi is present, the spec is usually at `/v3/api-docs`:
```yaml
  - type: openapi
    parameters:
      apiUrl: "http://host.docker.internal:PORT/v3/api-docs"
      targetUrl: "http://host.docker.internal:PORT"
```
This gives full method + parameter coverage with no spider.

## No OpenAPI? Source-route fallback
Extract routes from controller annotations (`route-extraction.md`):
`@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`,
class-level base paths, and `@PathVariable`/`@RequestParam`. Build the endpoint
list, CONFIRM it with the user, then seed it as requestor targets.

## Server-rendered pages (Thymeleaf/JSP)
If the app returns HTML, run the traditional spider in addition to the endpoint
import, and probe for SSTI in `th:utext`/template-rendered values.

## Actuator exposure
Check whether Spring Boot Actuator endpoints are exposed (`/actuator`, `/actuator/env`,
`/actuator/heapdump`, `/actuator/mappings`). Exposed actuator endpoints in production
are a common, high-impact misconfiguration — flag any reachable without auth.

## HTTP verb coverage
Test GET/POST/PUT/PATCH/DELETE on each endpoint — verb restrictions are often missed.

## Auth
Usually JWT Bearer or session cookie → `zap-auth.md`. For OAuth2 resource servers,
seed a Bearer token via the system-level `ZAP_AUTH_HEADER_VALUE`.

## Key runtime risks
BOLA/IDOR on path variables, missing `@PreAuthorize` on individual handlers,
exposed actuator endpoints, mass assignment via `@RequestBody` binding,
SSTI in templates, verb tampering, missing rate limiting.
