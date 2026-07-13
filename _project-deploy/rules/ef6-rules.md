---
paths: ["**/*.cs", "**/Migrations/**", "**/Data/**"]
detect:
  dependencies: ["EntityFramework"]
  excludeIfDependencies: ["Microsoft.EntityFrameworkCore"]
---

> ⚠️ LEGACY — MAINTENANCE ONLY. Entity Framework 6 is in maintenance mode.
> Do not use EF6 in new projects. For new .NET projects, use Dapper with parameterised SQL
> (the project standard) or EF Core if the team decides to use an ORM.
> `data-access-rules.md` principles still apply; the sections below override only where
> EF6's API diverges from the general data-access guidance.

# Entity Framework 6 Rules — EF6 maintenance patterns

## DbContext Lifecycle
- One `DbContext` per request — register with `PerRequestLifetimeManager` in Unity / `PerLifetimeScope` in Autofac
- Never share a `DbContext` across threads or requests — it is not thread-safe
- Dispose `DbContext` explicitly (or via the DI container lifetime) — do not rely on GC

## Repository Pattern
- Wrap `DbContext` inside Repository classes — no direct `DbContext` or `DbSet<T>` access outside the Repository layer
- Repository interfaces returned to the service layer — the EF implementation is hidden behind the interface

## Querying
- `AsNoTracking()` for all read-only queries — avoids unnecessary change-tracking overhead
- `Include()` for eager loading — no lazy loading in API code (N+1 queries)
- Disable lazy loading globally: `context.Configuration.LazyLoadingEnabled = false`
- `Select()` to project only needed fields — never return full entity graphs to the service layer

## LINQ-to-Entities Limitations
- Not all LINQ methods translate to SQL — test with a real database; `InvalidOperationException` at runtime means the query is evaluated in memory (full table scan)
- `ToString()` and string formatting do not translate — use `SqlFunctions` or raw SQL for formatting
- Use `SqlQuery<T>()` for raw SQL when LINQ cannot express the query — always with parameterised inputs

## Migrations (EF6 Code First)
- Run migrations via `Update-Database` or in code at startup (`context.Database.Migrate()`) — never hand-edit generated migration files
- One migration per logical schema change — never bundle unrelated changes
- Review the generated SQL before applying to production: `Update-Database -Script`
- `Down` methods maintained — always ensure the migration is reversible unless documented otherwise

## Concurrency
- Optimistic concurrency via `[ConcurrencyCheck]` or a `[Timestamp]` / `rowversion` column
- Catch `DbUpdateConcurrencyException` in the service layer and return a `409 Conflict` response

## Out of bounds
- No lazy loading in APIs — always `AsNoTracking()` + explicit `Include()`
- No raw SQL without parameterisation: `context.Database.ExecuteSqlCommand("DELETE FROM Users WHERE Id = " + id)` is forbidden
- No direct `DbContext` access outside Repository classes
- No hand-editing of EF6 migration files
- No `DbContext` shared across threads

## See also
- `data-access-rules.md` — general data-access principles that still apply
- `csharp-framework48-rules.md` — the ASP.NET Framework 4.8 project context in which EF6 is typically used
