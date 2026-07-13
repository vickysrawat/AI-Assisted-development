---
paths: ["**/repositories/**", "**/data/**", "**/db/**", "**/persistence/**"]
detect:
  always: false
---

# Data Access Rules — HOW to access data (patterns, abstractions, connection management)

> Deployed automatically alongside any backend Layer 3 language file.
> Covers the data access layer: repository pattern, connection lifecycle, transaction scope,
> and query discipline. For WHAT you access (schema design, SQL query craft) see `sql-relational-rules.md`.

## Repository Pattern
- One repository per aggregate root / domain entity — `UserRepository`, `FilterRepository`
- Repositories are the only layer that knows about the persistence technology (SQL, ORM, cache)
- Service layer calls repositories — never accesses the DB client or ORM directly
- Repository interface defined separately from implementation — enables test doubles without mocking infrastructure:
  - .NET: `IUserRepository` + `DapperUserRepository`
  - Python: `AbstractUserRepository` + `SqlUserRepository`
  - Node.js: `UserRepository` interface + `PgUserRepository` class

## Parameterised Queries (mandatory)
- Every SQL query uses parameters — never string concatenation or interpolation of user-supplied values
- In Dapper: `connection.QueryAsync<User>("SELECT * FROM users WHERE id = @id", new { id })`
- In raw SQL (Node.js / Python): `db.query('SELECT * FROM users WHERE id = $1', [id])`
- ORM: use the ORM's parameterised API — never `.fromRawSql()` with interpolation

## Connection Lifecycle
- Connection pool managed by the framework/library — never open/close connections manually per request
- One logical "unit of work" per request — not one connection per query
- Connections returned to the pool promptly — no long-held connections during business logic
- Connection pool size configured explicitly — not left at library defaults for production workloads
- Health check includes a DB connectivity probe — fail the health endpoint if the pool is exhausted or DB is unreachable

## Transaction Scope
- Wrap multi-step writes (insert + update + audit log) in a single transaction — never assume sequential awaited calls are atomic
- Transactions kept as short as possible — no external HTTP calls, no user-facing delays inside a transaction
- Explicit commit and rollback — never rely on implicit commit on connection close
- Nested transactions: use savepoints if supported; otherwise flatten to a single transaction

## Dapper-Specific (where applicable)
- `QueryAsync` / `ExecuteAsync` — never the synchronous `Query` / `Execute` in async server code
- `splitOn` named explicitly when multi-table mapping — never rely on positional column order
- `DynamicParameters` for conditional WHERE clauses — never build SQL strings conditionally

## ORM-Specific (Prisma / Drizzle / EF Core)
- `SELECT` only the fields needed — never `findMany()` / `.all()` without specifying required columns for wide tables
- `N+1` prevention: use `include` / `with` / `joinedLoad` explicitly — never lazy load in APIs
- Migrations only through the ORM CLI — never hand-edit generated migration files

## Sensitive Data
- Never log query parameters that contain PII — log operation name and entity ID only
- Encrypt sensitive fields before storing if required by data classification policy
- Never return ORM model objects from repository methods — map to a domain object at the repository boundary

## Out of bounds
- No DB client or ORM access outside the repository layer
- No string-concatenated SQL
- No synchronous DB calls in async server code
- No unbounded queries — always paginate list operations
- No ORM model objects returned to the service or handler layer

## See also
- `sql-relational-rules.md` — schema design, index strategy, and SQL query craft
- `prisma-drizzle-rules.md` — Prisma and Drizzle ORM-specific rules
