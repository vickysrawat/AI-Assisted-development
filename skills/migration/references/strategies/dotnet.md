# Target Execution Profile: dotnet (.NET 10)

STATUS: implemented
ROLE: backend (single-track) or backend track (two-track)

_The concrete, stack-specific commands/paths/examples for a .NET 10 target. SKILL.md Stages 3–6 are
stack-agnostic and reference the `{TOKEN}`s below; this file is the ONLY place the .NET specifics
live. See `strategies/README.md` for the token contract._

---

## STACK
.NET 10 · C# 13 · ASP.NET Core

## SKELETON (project structure the orchestrator scaffolds in Step 3.3)
```
{Name}.sln
{Name}.Domain/{Name}.Domain.csproj             ← entities, value objects (no framework deps)
{Name}.Application/{Name}.Application.csproj    ← use cases, interfaces, DTOs
{Name}.Infrastructure/{Name}.Infrastructure.csproj ← data access, external clients
{Name}.Api/{Name}.Api.csproj                    ← controllers, Program.cs, DI, middleware
tests/{Name}.Tests/{Name}.Tests.csproj
```
(Simplified structure: a single `{Name}/{Name}.csproj` with Domain/Services/Infrastructure folders —
see `shared/clean-architecture.md` proportionality.)

## STANDARDS_EXAMPLE (idioms for the ~20-line Architecture Standards block, Step 3.2 §1)
```
AUTH:    Entra ID — AddMicrosoftIdentityWebApiAuthentication() in Program.cs
DB:      Dapper — parameterised SQL, IDbConnection injected
LOGGING: Serilog — structured: _logger.LogInformation("{Action} {Id}", action, id)
ERRORS:  RFC 7807 ProblemDetails on all 4xx/5xx
ASYNC:   NEVER .Result or .Wait(). Async all the way up.
```

## BUILD
```bash
dotnet build {Name}.sln --configuration {Debug|Release} 2>&1 | tail -5
```
- Skeleton verify (Step 3.3): `dotnet build {Name}.sln --no-incremental 2>&1 | tail -5`
- Cluster work: `--configuration Debug` · Stage 6.1 verify: `--configuration Release`

## TEST_CLUSTER
```bash
dotnet test {Name}.sln --filter "FullyQualifiedName~{Cluster}" --no-build 2>&1 | tail -10
```

## TEST_ALL
```bash
dotnet test {Name}.sln --no-build --configuration Release 2>&1 | tail -20
```

## TEST_FRAMEWORK
xUnit (`[Fact]`/`[Theory]`) + NSubstitute + FluentAssertions.

## COVERAGE
```bash
dotnet test {Name}.sln --collect:"XPlat Code Coverage" --results-directory ./coverage 2>&1 | tail -5
dotnet tool run reportgenerator -reports:"./coverage/**/coverage.cobertura.xml" \
  -targetdir:./coverage/report -reporttypes:TextSummary 2>&1 | tail -30
# Read ./coverage/report/Summary.txt — compare per-assembly Line coverage to the Step 5.2 table.
```

## LAYOUT
| Slot | Path |
|---|---|
| Shared kernel | `src/Shared/` |
| Shared-kernel tests | `tests/SharedKernel.Tests/` |
| Cluster source | `src/{ClusterName}/` |
| Cluster tests | `tests/{ClusterName}.Tests/` |
| Characterization / unit tests | `tests/{Name}.Tests/` |

## COMPOSITION (integration layer — Step 4.5 writes these)
- `Program.cs` — DI wiring + middleware pipeline + auth per SECURITY-ARCHITECTURE.md
- `appsettings.json` — configuration skeleton (placeholders only, no secrets)
- `README.md` — structure, build/run instructions, link to architecture docs

## CONFIG (dev configuration + Step 6.2 pre-flight)
Dev config file: `appsettings.Development.json`. Pre-flight before E2E is **DB-aware** — it skips
cleanly when the app declares no datastore (no `ConnectionStrings`, or no dev config), and fails
only when a connection string is declared but empty or still a `{placeholder}`:
```bash
node -e '
const fs=require("fs");
let s; try{ s=JSON.parse(fs.readFileSync("appsettings.Development.json","utf8")); }
catch(e){ console.log("ℹ️  no/invalid appsettings.Development.json — skipping DB pre-flight"); process.exit(0); }
const cx=s.ConnectionStrings;
if(!cx || Object.keys(cx).length===0){ console.log("ℹ️  DB-less (no ConnectionStrings) — skipping DB pre-flight"); process.exit(0); }
const bad=Object.entries(cx).filter(([k,v])=>!v || String(v).includes("{"));
if(bad.length){ console.error("❌ Populate these connection strings before E2E: "+bad.map(([k])=>k).join(", ")); process.exit(1); }
console.log("✅ connection strings populated");'
```

## BUILD_UNIT (per-cluster FORBIDDEN set — agents must not touch these)
`{Name}.sln` · any `*.csproj` · `Program.cs` · `appsettings.json`

## RULES (guardrail rule files deployed to .claude/rules/ at Step 3.3a)
`project-rules.md` (always) · `csharp-dotnet-rules.md`

## PKG_ADD (skeleton-amendment path)
```bash
dotnet add {ProjectDir}/{Project}.csproj package {PackageId} --version {ver}
```
Requested via the orchestrator; clusters never edit `.csproj` directly.

## SERVE (Stage 6.2 startup + health probe)
```bash
dotnet run --project {Name}.Api --no-build --environment Development > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
timeout 30 bash -c 'until curl -sf http://localhost:{port}/healthz>/dev/null 2>&1;do sleep 1;done' \
  || { echo "❌ Backend failed to start"; tail -20 /tmp/backend.log; kill $BACKEND_PID; exit 1; }
```
Health endpoint: `/healthz`. Dev-run command (Step 6.4 checklist): `dotnet run --project {Name}.Api`.

## E2E
Playwright (language-agnostic, drives the running target):
```bash
npm init playwright@latest tests/e2e -- --lang=ts --quiet
npx playwright install --with-deps chromium
npx playwright test tests/e2e/ --reporter=html,list --timeout=30000
```
Token acquisition per SECURITY-ARCHITECTURE.md (Entra ID client_credentials / custom-JWT endpoint /
API key env var / none).

## FITNESS
```bash
dotnet test {Name}.sln --filter "Category=Architecture" --no-build 2>&1 | tail -20
```
NetArchTest layer-dependency tests (see `shared/clean-architecture.md`).
