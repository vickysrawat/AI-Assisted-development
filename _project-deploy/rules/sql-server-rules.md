---
paths: ["**/*.sql", "**/migrations/**", "**/db/**"]
detect:
  dependencies: ["mssql", "Microsoft.Data.SqlClient", "System.Data.SqlClient", "pyodbc", "tedious"]
---

# SQL Server Rules — T-SQL dialect, Azure SQL, and SQL Server-specific patterns

> Applies on top of `sql-relational-rules.md` (schema design, indexing, migrations).
> Covers SQL Server and Azure SQL Database-specific features and anti-patterns.

## T-SQL Patterns
- Use `MERGE` cautiously — it has known edge cases with concurrent workloads; prefer explicit `INSERT/UPDATE` with existence check when in doubt
- `OUTPUT` clause for returning inserted/updated rows without a follow-up `SELECT`
- `TRY...CATCH` for error handling in stored procedures and batch scripts — check `ERROR_NUMBER()`, `ERROR_MESSAGE()`
- `@@ROWCOUNT` checked immediately after a DML statement — a subsequent statement resets it
- `SET NOCOUNT ON` at the top of every stored procedure — suppresses spurious "N rows affected" messages

## Temporary Objects
- `#temp` tables preferred over `##global_temp` tables — global temp tables are session-shared and a concurrency hazard
- CTEs for readable multi-step queries; `#temp` tables when the intermediate result is large and referenced multiple times
- Table variables (`DECLARE @t TABLE`) for small row sets only — the optimizer cannot update statistics on them

## Locking and Concurrency
- Never use `WITH (NOLOCK)` / `READ UNCOMMITTED` to "fix" blocking — it causes dirty reads and phantom reads; diagnose and fix the underlying lock contention instead
- Row-version-based concurrency (`READ_COMMITTED_SNAPSHOT` isolation level) for OLTP workloads — reduces lock contention without dirty reads
- Index lock hints (`WITH (ROWLOCK)`, `WITH (UPDLOCK)`) only with a documented justification — they bypass the optimizer's judgment
- Monitor blocking with `sys.dm_exec_requests` and `sys.dm_os_wait_stats` — never guess at the lock holder

## Indexes
- Clustered index on the primary key by default; consider a non-default clustered index for time-series or range-scan tables
- Covering indexes (`INCLUDE` columns) to avoid key lookups on high-frequency queries
- `FILLFACTOR` tuned for insert-heavy tables to reduce page splits — default (0 = 100%) is rarely optimal
- Index fragmentation monitored — `ALTER INDEX ... REORGANIZE` for < 30% fragmentation; `REBUILD` for > 30%
- Never create more than 5 non-clustered indexes per table without profiler evidence that each is used

## Azure SQL Specifics
- Elastic pools for multi-tenant databases that share bursty workloads
- `sys.dm_db_resource_stats` for DTU/vCore consumption monitoring
- Geo-redundant backup retention enabled — not the minimum (7 days)
- `MAXDOP` and `Cost Threshold for Parallelism` configured explicitly — Azure SQL defaults are not always appropriate for OLTP

## Linked Servers
- Avoid linked servers in new designs — they create brittle, difficult-to-test cross-server dependencies
- If a linked server is unavoidable, wrap calls in `TRY...CATCH` — linked server failures are not surfaced as normal SQL errors

## Migrations
- Migrations via a controlled tool (DbUp, Flyway, EF Core migrations in maintenance-only projects) — never `SSMS "Generate Scripts"` run directly on production
- Column renames done in stages on live tables: add new column → backfill → update application → drop old column
- `ALTER TABLE ... ALTER COLUMN` never on a column with a `NOT NULL` constraint and large row count without an offline window — it can cause full table rebuild

## Out of bounds
- No `WITH (NOLOCK)` — fix the blocking instead
- No `##global` temp tables in application code
- No `SELECT *` in stored procedures or production queries
- No linked servers in new designs
- No direct `ALTER TABLE` column type changes on large live tables without a maintenance window
