---
paths: ["**/*.cs", "**/Data/**", "**/Repositories/**"]
detect:
  dependencies: ["System.Data"]
  files: ["**/*.cs"]
---

> ⚠️ LEGACY — MAINTENANCE ONLY. These are dated ADO.NET patterns found in older codebases.
> Do not introduce `DataSet`, `DataTable`, or manual `SqlConnection` lifecycle patterns in new code.
> For new code in any .NET project, use Dapper with parameterised SQL per `data-access-rules.md`.
> Parameterised queries are MANDATORY regardless of age — this file does not override that rule.

# ADO.NET Legacy Rules — Dated ADO.NET patterns (DataSet, DataAdapter, manual connections)

## Parameterised Queries (mandatory — no exception)
- Every SQL statement uses `SqlCommand.Parameters.AddWithValue(...)` or `SqlParameter` — never string concatenation or interpolation of user-supplied values
- `AddWithValue` acceptable for maintenance; prefer typed `SqlParameter` with explicit `SqlDbType` for stored procedures
- This rule overrides nothing — it is the non-negotiable baseline regardless of the surrounding legacy patterns

## Manual Connection Lifecycle
- Open connections as late as possible, close (or return to pool) as early as possible
- Always wrap `SqlConnection`, `SqlCommand`, and `SqlDataReader` in `using` statements — even in legacy code
- Never store `SqlConnection` as a field on a long-lived object — connection pooling depends on prompt return
- `ConnectionString` read from configuration (web.config / app.config) — never hardcoded

## SqlDataAdapter and DataSet
- `SqlDataAdapter.Fill(DataSet)` acceptable for read-only reporting queries where the data shape is dynamic
- `DataSet` only for genuine multi-table, schema-discovery scenarios — not as a general-purpose data container
- Typed `DataSet` (generated or hand-written) preferred over untyped — `row["ColumnName"]` casting is a runtime error waiting to happen
- Never return a `DataSet` or `DataTable` from the Repository layer to business logic — map to a typed domain object at the Repository boundary

## SqlDataReader
- Always check `reader.IsDBNull(ordinal)` before reading nullable columns
- Close the reader before executing another command on the same connection
- `CommandBehavior.CloseConnection` on `ExecuteReader` when the reader owns the connection lifetime

## Stored Procedures
- Prefer stored procedures over inline SQL in legacy codebases — but parameterise the call, not the procedure internals
- `CommandType.StoredProcedure` set explicitly — not `CommandType.Text` calling `EXEC ProcName @param`
- Output parameters typed explicitly with `SqlParameter.Direction = ParameterDirection.Output`

## Error Handling
- Catch `SqlException` — check `SqlException.Number` for database-specific error codes (deadlock: 1205, unique constraint: 2627)
- Rollback transactions in `catch` blocks — never leave a transaction open on exception
- Log `SqlException.Message` and `SqlException.Number` — never swallow DB errors silently

## Out of bounds
- No string-concatenated SQL — parameterised queries always
- No `DataSet` returned from Repository methods — map to domain objects
- No `SqlConnection` stored as a class field
- No missing `using` blocks on connection/reader/command objects
- No `ExecuteNonQuery` without checking the return value when exactly one row is expected

## See also
- `data-access-rules.md` — modern data-access principles; use these for any new code in the same project
- `csharp-framework48-rules.md` — the ASP.NET Framework 4.8 project context
