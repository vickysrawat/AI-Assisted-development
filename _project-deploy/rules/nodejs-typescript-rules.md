---
paths: ["**/*.ts", "**/routes/**", "**/middleware/**", "**/controllers/**", "**/services/**"]
detect:
  dependencies: ["express", "fastify", "hono", "@nestjs/core"]
---

# Node.js / TypeScript Backend Rules — Applied to all Node.js backend services

Covers Express, NestJS, Fastify, and Hono. Framework-specific patterns are in dedicated
sections below. Universal patterns apply regardless of framework choice.

## TypeScript
- Strict mode enabled — no implicit `any`, strict null checks, strict function types
- File naming: `camelCase.ts` for services/utils; `kebab-case.controller.ts` for NestJS
- `ts-node` / `tsx` for development; always compile to `dist/` for production — never run `ts-node` in production

## Architecture (all frameworks)
- Thin route handlers / controllers: validate input → call service → return response — no business logic in handlers
- Service layer owns business logic — stateless, framework-agnostic
- Repository / data-access layer owns persistence — see `data-access-rules.md`

## Validation (Zod — all frameworks)
- Zod schema for every request body, query param, and path param
- Validate at the route/middleware level before any business logic runs
- Return 400 with field-level Zod error details on validation failure
- Schemas co-located with the route or in a shared `schemas/` directory if reused

## Error Handling (all frameworks)
- Custom `AppError` class: `{ message, errorCode, httpStatus }` for domain errors
- Centralised error-handling middleware / exception filter catches `AppError` and maps to structured response
- Never expose stack traces in API responses — log fully, return sanitized message
- Unhandled promise rejections caught at the process level: `process.on('unhandledRejection', ...)`

## Logging (Winston or Pino — all frameworks)
- Structured JSON logger — never `console.log` in production code
- Log `{ service, operation, userId, traceId, duration }` on every request
- Never log PII — mask emails, names, and sensitive IDs
- Log levels: `info` for normal flow, `warn` for recoverable errors, `error` for exceptions

## Express Specifics
- Route handlers registered via `express.Router()` — never directly on `app` in feature code
- Error handling via a 4-argument middleware `(err, req, res, next)` registered last
- `helmet()` and `cors()` middleware registered before all route handlers
- `express.json()` with a `limit` option — never unbounded request bodies
- Graceful shutdown: `server.close()` on `SIGTERM` — drain active connections before exit

## NestJS Specifics
- One module per domain feature — no monolithic `AppModule` with everything registered
- `@Controller` thin: delegates to `@Injectable` services; no business logic in controllers
- `@UseGuards(AuthGuard)` on every protected endpoint — not on individual actions ad-hoc
- `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` globally — strip unknown fields
- `@Interceptor` for cross-cutting: logging, response transformation — not scattered in controllers
- DTOs with `class-validator` decorators — Zod preferred for new code; `class-validator` acceptable if already established

## Fastify Specifics
- Schema validation via Fastify's built-in JSON Schema or `zod-fastify-type-provider` — always declare `schema.body`, `schema.querystring`, `schema.params`
- Plugins for cross-cutting concerns: auth, logging, DB connection — register at server level
- `fastify.decorateRequest('user', null)` for request-scoped data — not a module-level variable
- `reply.send()` returns a Promise — await it or return it; never call after an async `reply.send`

## Hono Specifics
- `Context` (`c`) is the single source of truth per request — `c.req`, `c.env`, `c.var` for request-scoped data
- Middleware registered with `app.use(path, middleware)` — not inline in route handlers
- `c.json()` / `c.text()` for typed responses — always return from the handler
- Bindings typed via `Env` generic: `const app = new Hono<{ Bindings: Env }>()` — no `process.env` in Cloudflare Workers

## Testing
- Jest with `ts-jest` (or Vitest) — mock all external HTTP and DB calls
- `supertest` / `@nestjs/testing` for HTTP integration tests against the actual router
- Test ICEA scenarios: happy path, validation error, not-found, permission boundary
- No secrets in test configuration — environment-specific test `.env.test`

## See also
- `backend-base-rules.md` — universal backend guardrails
- `rest-api-rules.md` — HTTP design conventions
- `auth-rules.md` — AuthN/AuthZ patterns
- `api-security-rules.md` — OWASP and attack surface
- `data-access-rules.md` — repository and connection patterns
- `observability-rules.md` — structured logging principles

## Out of bounds
- No `console.log` in production — use the structured logger
- No business logic in route handlers or controllers
- No unvalidated request bodies — always use Zod (or equivalent) before business logic
- No synchronous file I/O in request handlers — use async equivalents
- No `ts-node` in production — compile to JS first
