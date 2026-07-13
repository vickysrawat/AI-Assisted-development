---
paths: ["**/prisma/**", "**/db/**", "**/*.prisma", "**/schema/**"]
detect:
  dependencies: ["@prisma/client", "drizzle-orm"]
---

# Prisma / Drizzle Rules — Applied to all JS/TS ORM projects

Covers Prisma ORM and Drizzle ORM. Where rules differ between the two, they are marked.

## Schema Design
- **Prisma**: schema in `prisma/schema.prisma`; one model per domain entity; explicit `@@map` for table names in snake_case
- **Drizzle**: schema in `db/schema.ts`; table definitions co-located by domain; column names in snake_case via `.name()` override
- Soft deletes via a `deletedAt DateTime?` field — never hard-delete user-facing records without explicit decision
- Timestamps on every table: `createdAt` and `updatedAt` — populated automatically
- Foreign keys declared in the schema — never rely on application-level referential integrity alone

## Migrations
- **Prisma**: `prisma migrate dev` for development; `prisma migrate deploy` in CI/CD — never edit migration files by hand
- **Drizzle**: `drizzle-kit generate` then review generated SQL before applying — never apply to production without review
- Migration files committed to the repository — never `.gitignore` them
- One logical change per migration — no bundling unrelated schema changes

## Query Patterns
- Always use parameterised queries — Prisma and Drizzle do this by default; never use `$queryRawUnsafe` or `sql` tagged template with interpolated user input
- Select only needed fields — never `SELECT *` via `findMany()` without `select:` when the model has large/sensitive fields
- Use `include:` / `with:` sparingly — prefer explicit joins; never chain more than 2 levels of nested includes
- Paginate all list queries — never return unbounded lists: always `take` + `skip` (Prisma) or `limit` + `offset` (Drizzle)

## Transactions
- Wrap multi-step writes in a transaction — never assume sequential awaited calls are atomic:
  - **Prisma**: `prisma.$transaction([...])`  or interactive `prisma.$transaction(async (tx) => { ... })`
  - **Drizzle**: `db.transaction(async (tx) => { ... })`
- Keep transactions short — no external HTTP calls or long computations inside a transaction
- Roll back explicitly on error — never swallow exceptions inside a transaction block

## Connection Management
- **Prisma**: one `PrismaClient` instance per process (singleton pattern) — never create per-request
- **Drizzle**: one `db` instance per process — connection pool configured via the driver (e.g. `pg`, `mysql2`)
- In serverless environments, use `@prisma/adapter-neon` / connection pooling proxy — never open a new raw connection per invocation

## Sensitive Data
- Never log query results containing PII — log only record IDs and operation names
- Encrypt sensitive fields at the application layer before storing — the ORM is not responsible for encryption
- Never expose Prisma/Drizzle model objects directly via API responses — map to a DTO

## Out of bounds
- No `$queryRawUnsafe` or raw SQL with string interpolation of user input
- No unbounded list queries — always paginate
- No `PrismaClient` instantiated per request
- No ORM model objects returned directly from API handlers
- No migration files edited by hand after generation
