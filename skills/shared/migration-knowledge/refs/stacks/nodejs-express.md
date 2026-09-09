# Stack Reference: Node.js / Express

_For migration skills — loaded when source or target stack token = `nodejs`_

---

## Core Patterns

**Concurrency Model**
Single-threaded event loop + libuv I/O thread pool. `async/await` is syntactic sugar over Promises — everything still runs on the event loop's microtask queue sequentially. CPU-bound work blocks the event loop; must offload to `worker_threads`.

**Express Middleware**
```javascript
app.use((req, res, next) => { /* do work */ next(); });  // pass-through
app.use((req, res) => { res.json({ok: true}); });        // terminal
app.use('/api', router);                                  // path-scoped
```
Middleware runs in registration order. Express has no enforced ordering rule — order is purely positional.

**Routing**
```javascript
const router = express.Router();
router.get('/users/:id', asyncHandler(async (req, res) => { ... }));
app.use('/api', router);
```

**Configuration**
- `process.env` for environment variables.
- `.env` files via `dotenv` (dev only — never commit).
- Structured config with `convict` or `nconf` for typed config objects.

**Authentication**
- Passport.js: strategy-based (`passport-jwt`, `passport-local`, `passport-oauth2`).
- Each strategy is middleware: `passport.authenticate('jwt', { session: false })`.
- JWT: `jsonwebtoken` library — `jwt.sign(payload, secret)` · `jwt.verify(token, secret)`.

**Session Handling**
- `express-session`: server-side session stored in memory (dev) or Redis (`connect-redis`) for production.
- `cookie-session`: client-side encrypted cookie session.
- No cookieless session mode (query string session) recommended — security risk.

**Data Access (common patterns)**
- Sequelize: ORM with model definitions + migrations.
- Prisma: schema-first ORM with auto-generated client.
- TypeORM: decorator-based ORM similar to Hibernate.
- Knex: query builder (lower level).
- `pg` / `mysql2` / `mssql`: raw drivers.

**Background Jobs**
- `bull` / `bullmq`: Redis-backed job queues with retry and scheduling.
- `agenda`: MongoDB-backed scheduler.

**Real-time**
- `socket.io`: WebSocket server with fallbacks (polling, SSE). Custom protocol — clients must use the `socket.io-client` library.

**Process Management**
- `pm2` cluster mode: forks N processes (one per CPU core) and load-balances between them.
- `nodemon` / `tsx --watch`: hot reload for development.

**Testing Stack**
- Jest: `test()`, `describe()`, `expect()`. Mock with `jest.fn()`, `jest.spyOn()`.
- Vitest: faster Jest alternative (ESM-native).
- Supertest: HTTP assertion library for testing Express routes.
- `nock`: HTTP mock for outbound calls.

---

## Anti-Patterns

Enforced anti-patterns + coding conventions for this stack live in `rules/nodejs-typescript-rules.md`
(authoritative — `## Anti-patterns` / `## Out of bounds`). This reference adds only the
migration-specific context below.

---

## npm Packages → .NET Equivalents

| npm Package | .NET Equivalent | Notes |
|---|---|---|
| `lodash` | LINQ | Not needed — LINQ provides equivalent operations |
| `moment.js` / `date-fns` | NodaTime (NuGet) | NodaTime is the community standard |
| `nodemailer` | MailKit | Direct equivalent |
| `sharp` (image processing) | ImageSharp / SkiaSharp | Direct equivalents |
| `socket.io` | ASP.NET Core SignalR | Different wire protocol — JS client must switch to SignalR client |
| `bull` / `bullmq` | Hangfire or Quartz.NET | Both have UI dashboards |
| `joi` / `yup` (validation) | FluentValidation | Community standard |
| `winston` / `pino` | Serilog | Structured logging; more mature |
| `dotenv` | appsettings.json + env vars | `IConfiguration` reads multiple sources automatically |
| `passport` | `Microsoft.AspNetCore.Authentication.*` | First-party NuGet packages per provider |
| `jsonwebtoken` | `Microsoft.AspNetCore.Authentication.JwtBearer` | Built-in |
| `express-rate-limit` | Built-in `RateLimiter` (.NET 7+) | Native |
| `multer` (file upload) | `IFormFile` / `[FromForm]` | Built-in |
| `compression` | `app.UseResponseCompression()` | Built-in |

**Genuine gaps (no direct .NET equivalent):**
- `socket.io` protocol compatibility — SignalR uses a different wire protocol; clients must be updated.
- `pm2` cluster mode mental model — Kestrel is a single process exploiting all cores via thread pool (no forking needed).

---

## Key Gotchas for Outbound Migration (Node.js → .NET)

1. **Async model difference** — Node.js `async/await` doesn't release the event loop thread between awaits (it yields back to microtask queue on the same thread). .NET `await` genuinely releases the thread back to the thread pool. This means .NET handles CPU-bound + I/O-bound concurrency better, but you must NEVER `.Result`/`.Wait()` — causes deadlocks.
2. **`express-session` cookieless mode** — does NOT exist in ASP.NET Core. Any code relying on session IDs in query strings must be redesigned.
3. **Middleware ordering is enforced in ASP.NET Core** — unlike Express where order is purely positional, ASP.NET Core has documented requirements (CORS must come after UseRouting, before UseAuthentication). Violations cause silent auth failures.
4. **`socket.io` → SignalR protocol break** — existing `socket.io` browser clients CANNOT connect to a SignalR hub without being updated to the SignalR JavaScript client. Plan a client-side update alongside the migration.
5. **npm scripts → `dotnet` CLI** — `npm start` / `npm test` / `npm run build` map to `dotnet run` / `dotnet test` / `dotnet build`. CI/CD pipelines must be updated.
