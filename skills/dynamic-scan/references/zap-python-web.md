# Python Web (FastAPI / Django / Flask) — Dynamic Scan Notes

Coverage strategy depends on which framework is serving — detect first, then choose
spider vs endpoint import.

## FastAPI — prefer OpenAPI import
FastAPI auto-generates an OpenAPI spec, usually at `/openapi.json`:
```yaml
  - type: openapi
    parameters:
      apiUrl: "http://host.docker.internal:PORT/openapi.json"
      targetUrl: "http://host.docker.internal:PORT"
```
Full method + parameter coverage with no spider. The interactive docs at `/docs`
and `/redoc` confirm the surface.

## Django — traditional spider + route fallback
Django apps are often server-rendered. Run the traditional spider. For DRF APIs,
import the browsable-API or schema endpoint if `drf-spectacular`/`drf-yasg` exposes
one. Extract routes from `urls.py` `path()`/`re_path()` entries (`route-extraction.md`).
Check that `DEBUG` is not enabled (a DEBUG error page leaks stack traces and settings).

## Flask — spider + decorator route fallback
Run the traditional spider. Extract routes from `@app.route` / `@blueprint.route`
decorators and their `methods=[...]`. Probe `render_template_string` paths for SSTI.

## Auth
Token (FastAPI OAuth2/JWT), session cookie (Django/Flask), or DRF token →
`zap-auth.md`. For session auth, capture the login form/flow; for token auth, seed
`ZAP_AUTH_HEADER_VALUE`.

## HTTP verb coverage
Test GET/POST/PUT/PATCH/DELETE per endpoint — verb restrictions are commonly missed.

## Framework-specific risks to confirm at runtime
- **All**: SQL injection where raw queries/`.raw()`/string-formatted SQL are reachable
- **FastAPI**: missing `response_model` leaking internal fields; sync blocking handlers
- **Django**: `DEBUG=True` in production; CSRF disabled on state-changing views; SSTI;
  IDOR on object views without permission checks
- **Flask**: `debug=True`; SSTI via `render_template_string`; open redirects
- **All**: mass assignment, missing rate limiting, verbose error pages
