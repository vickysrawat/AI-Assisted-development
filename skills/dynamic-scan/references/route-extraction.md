# Route Extraction — Seeding ZAP Beyond the Spider

Spiders miss lazy-loaded SPA routes and attribute-routed API endpoints. Extract a known
route list from source and feed it to ZAP as seed URLs. Reading these route files is
Category B consent (announce file + why) per source-file-consent.

## Angular
Grep routing modules for `path:` entries:
```bash
grep -rhoE "path:\s*'[^']*'" --include="*routing*.ts" --include="app.routes.ts" . \
  | sed -E "s/path:\s*'([^']*)'/\1/" | sort -u
```
Compose full URLs against the base. Note lazy `loadChildren` modules — their child paths
need the parent prefix.

## ASP.NET MVC / Razor Pages
```bash
grep -rhoE "\[Route\(\"[^\"]+\"\)\]" --include="*.cs" .
grep -rhoE "\[Http(Get|Post|Put|Delete|Patch)\(\"[^\"]*\"\)\]" --include="*.cs" .
```
Add conventional `{controller}/{action}` and `[Area]` prefixes.

## ASP.NET Web API / minimal API
```bash
grep -rhoE "\[Route\(\"[^\"]+\"\)\]" --include="*.cs" .
grep -rhoE "app\.Map(Get|Post|Put|Delete|Patch)\(\"[^\"]+\"" --include="*.cs" .
```
Prefer Swagger if available. If derived from source, CONFIRM the endpoint list with the
user before scanning — derived lists can be incomplete.

## Java / Spring Boot
```bash
# class-level base paths and method-level mappings
grep -rhoE "@RequestMapping\(\"?[^\")]*\"?\)" --include="*.java" .
grep -rhoE "@(Get|Post|Put|Delete|Patch)Mapping\(\"?[^\")]*\"?\)" --include="*.java" .
```
Compose method paths against the controller's class-level `@RequestMapping` base.
Prefer the OpenAPI spec at `/v3/api-docs` if springdoc is present.

## Python — FastAPI
```bash
# router/app decorators with path as first arg
grep -rhoE "@(app|router)\.(get|post|put|delete|patch)\(\"[^\"]+\"" --include="*.py" .
```
Account for `APIRouter(prefix=...)` — prepend the router prefix to each path.
Prefer the OpenAPI spec at `/openapi.json`.

## Python — Django
```bash
grep -rhoE "path\(\s*['\"][^'\"]*['\"]" --include="urls.py" .
grep -rhoE "re_path\(\s*r?['\"][^'\"]*['\"]" --include="urls.py" .
```
Compose against included URLconf prefixes (`include(...)`).

## Python — Flask
```bash
grep -rhoE "@(app|[a-z_]+)\.route\(\"[^\"]+\"" --include="*.py" .
```
Account for `Blueprint(url_prefix=...)` — prepend the blueprint prefix.

For all source-derived route lists: CONFIRM with the user before scanning — derived
lists can be incomplete.
