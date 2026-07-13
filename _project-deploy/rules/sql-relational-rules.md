---
paths: ["**/*.sql", "**/migrations/**", "**/schema/**"]
detect:
  files: ["**/*.sql"]
  dependencies: ["mssql", "pg", "mysql2", "Npgsql", "Microsoft.Data.SqlClient", "psycopg2", "asyncpg", "pyodbc"]
---

# SQL Relational Rules — WHAT you access: schema design, query craft, and migration discipline

> Covers relational database design and SQL writing conventions.
> For HOW to access data (connection lifecycle, parameterisation, repositories) see `data-access-rules.md`.
> For database-specific dialect rules see `postgresql-rules.md` or `sql-server-rules.md`.

## Schema Design
- Table names in `snake_case`, plural: `users`, `filter_configurations`, `audit_log_entries`
- Column names in `snake_case`: `first_name`, `created_at`, `deleted_at`
- Every table has a surrogate primary key (`id`) — UUID or identity integer, documented choice per project
- Foreign keys declared in the schema with explicit `ON DELETE` behaviour — never rely on application-level cascade
- Nullable columns documented: a `NULL` must have a meaningful semantic (unknown vs absent vs soft-deleted)

## Normalisation
- Aim for 3NF as the default — denormalise only with a documented performance justification
- No repeated groups of columns (`phone1`, `phone2`, `phone3`) — use a related table
- Composite keys only when the composite is the natural business identity — otherwise use a surrogate key

## Indexes
- Index every foreign key column — most ORMs do not do this automatically
- Index columns that appear in `WHERE`, `JOIN ON`, and `ORDER BY` clauses for high-traffic queries
- Composite index column order matters: highest-cardinality or most-selective column first
- Never index a boolean column alone — the cardinality is too low to be useful
- Unused indexes documented and removed — they slow writes without benefiting reads

## Query Writing
- `SELECT` only the columns needed — never `SELECT *` in production queries
- Explicit `JOIN` type: `INNER JOIN`, `LEFT JOIN` — never implicit comma-join syntax
- Correlated subqueries avoided for large tables — prefer a `JOIN` or CTE
- CTEs (`WITH ...`) for readable multi-step queries — not nested subqueries more than 2 levels deep
- `EXPLAIN` / `EXPLAIN ANALYZE` reviewed before merging queries that touch large tables

## Transactions and Concurrency
- Multi-step writes wrapped in a transaction — never assume sequential statements are atomic
- Optimistic concurrency via a `row_version` / `updated_at` timestamp — checked in `WHERE` clause on updates
- Deadlock prevention: consistent lock ordering across all transactions that touch multiple tables
- Avoid long-running transactions — no user-facing waits inside a transaction

## Migrations
- One logical change per migration file — never bundle unrelated changes
- Reversible migrations preferred — include a `down` script or note why reversal is unsafe
- Migrations reviewed and tested on a copy of production data before deploying to production
- Column renames done in three stages: add new column → backfill → drop old column (never rename in one step on live tables)
- Never drop a column without confirming no code reads it (two-stage: deprecate + verify, then drop)

## Out of bounds
- No `SELECT *` in production queries
- No implicit comma-join syntax (`FROM a, b WHERE a.id = b.a_id`)
- No un-indexed foreign key columns
- No correlated subqueries for large tables — use JOINs or CTEs
- No one-step column renames on live tables
