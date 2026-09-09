# Parity Mapping: Node.js/Express → .NET Core

_Unidirectional — Node.js/Express as source, .NET Core as target._

---

## GREEN — Migrates Cleanly

| Node.js / Express | .NET Core equivalent | Confidence |
|---|---|---|
| `app.use(middleware)` | `app.Use(async (ctx, next) => { ... await next(); })` | Verified |
| `app.use('/path', router)` | `app.Map("/path", ...)` or `MapGroup("/path")` | Verified |
| `async/await` request handlers | `async Task<IActionResult>` controllers | Verified |
| `req.body` JSON | `[FromBody]` model binding | Verified |
| `req.params.id` | `[FromRoute] int id` or `{id}` route param | Verified |
| `req.query.search` | `[FromQuery] string search` | Verified |
| `process.env.KEY` | `IConfiguration["key"]` or `IOptions<T>` | Verified |
| `console.log(msg, data)` | `ILogger<T>.LogInformation("{Msg} {Data}", msg, data)` | Verified |
| `express.json()` middleware | Built-in — `AddControllers()` handles JSON by default | Verified |
| `express.static('./public')` | `app.UseStaticFiles()` | Verified |
| `app.use(cors())` | `app.UseCors()` + `AddCors()` service registration | Verified |
| `app.use(helmet())` | `app.UseHsts()` + `UseHttpsRedirection()` | Verified |
| JWT `jsonwebtoken` | `Microsoft.AspNetCore.Authentication.JwtBearer` | Verified |
| Jest `test()` / `expect()` | xUnit `[Fact]` + FluentAssertions `.Should().Be()` | Verified |
| Supertest HTTP assertion | `WebApplicationFactory<T>` integration tests | Verified |
| `npm run build/start/test` | `dotnet build/run/test` | Verified |
| `package.json` scripts | `.csproj` + `dotnet` CLI commands | Verified |

---

## YELLOW — Needs Rework

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Passport.js strategy model | ASP.NET Core auth middleware + JWT bearer. Strategy-per-auth-type → one auth scheme per provider via `.AddAuthentication().AddJwtBearer(...)`. | M | MEDIUM |
| `express-session` | `Microsoft.AspNetCore.Session` + `IDistributedCache`. No cookieless mode. Async API (no sync session reads). | M | MEDIUM |
| Sequelize / Prisma / TypeORM ORM | EF Core (if permitted) or Dapper. Check CLAUDE.md "Dapper only" rule — if present, EF Core is off the table. Every ORM method must become explicit Dapper SQL. | L | HIGH |
| `socket.io` | ASP.NET Core SignalR. Different wire protocol — JS client must be updated to `@microsoft/signalr`. Cannot use `socket.io-client`. | M | HIGH |
| `bull` / `bullmq` background jobs | Hangfire or Quartz.NET. Redis-backed queue in both cases. Hangfire has a built-in dashboard UI. | M | LOW |
| `morgan` request logging | `ILogger<T>` + Serilog. Structured logging format differs from Morgan's text format. | S | LOW |
| npm packages (lodash, moment, sharp) | LINQ / NodaTime / ImageSharp — see full table in `stacks/nodejs-express.md`. | S–M | LOW |
| `dotenv` | `appsettings.json` + env vars — already built in; no package needed. | S | LOW |
| pm2 cluster mode | Kestrel is a single process exploiting all cores via thread pool. No forking needed. | S | LOW |
| Rate limiting (`express-rate-limit`) | Built-in `RateLimiter` middleware (.NET 7+). | S | LOW |

---

## RED — Will Break

**`express-session` cookieless mode**
- What breaks: ASP.NET Core does NOT support passing session IDs via query strings or hidden form fields. Any legacy code relying on cookieless sessions must be redesigned.
- Options: (A) Require cookies (standard modern approach). (B) Use JWT bearer tokens (stateless — no session needed). (C) Distributed cache with explicit session token in header.
- Recommendation: (B) JWT bearer — eliminates session management entirely, scales better.
- Behavioral risk: HIGH if code depends on cookieless; MEDIUM if cookie sessions only.

**`socket.io` → SignalR protocol break**
- What breaks: The `socket.io` protocol is proprietary. Existing browser clients using `socket.io-client` CANNOT connect to a SignalR hub. All clients must update to `@microsoft/signalr`.
- Options: (A) Migrate to SignalR — requires client update. (B) Keep socket.io server with Node.js as a sidecar — hybrid architecture. (C) Use WebSocket directly (lowest common denominator).
- Recommendation: (A) — clean cut. Coordinate client and server migration simultaneously.
- Behavioral risk: HIGH — existing clients completely break until updated.

**`async/await` model difference — deadlock risk in .NET**
- What breaks: In Node.js, `async/await` runs on the event loop — no thread pool. In .NET, calling `.Result` or `.Wait()` on a Task in a synchronous context deadlocks the thread pool under concurrent load.
- Any code calling Node.js functions synchronously (fire-and-forget) must be reviewed.
- Fix: Every async call must be properly `await`-ed all the way up the call stack. Never `.Result`/`.Wait()`.
- Behavioral risk: HIGH (silent under low load; catastrophic under production load).

---

## Middleware Ordering Requirement (.NET)

ASP.NET Core middleware has a REQUIRED registration order (unlike Express where order is purely positional):

1. `UseExceptionHandler` / `UseHsts`
2. `UseHttpsRedirection`
3. `UseStaticFiles`
4. `UseRouting`
5. `UseCors` ← **must be here — AFTER UseRouting, BEFORE UseAuthentication**
6. `UseAuthentication`
7. `UseAuthorization`
8. `MapControllers` / endpoint mapping

Violating this order causes silent auth or CORS failures — no exception, wrong behavior.
