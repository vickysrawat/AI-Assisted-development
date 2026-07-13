---
paths: ["**/*.sql", "**/migrations/**", "**/db/**"]
detect:
  dependencies: ["pg", "Npgsql", "asyncpg", "psycopg2", "psycopg", "@neondatabase/serverless"]
---

# PostgreSQL Rules — PostgreSQL-specific dialect and feature usage

> Applies on top of `sql-relational-rules.md` (schema design, indexing, migrations).
> Covers PostgreSQL-specific features, functions, and operational considerations.

## Data Types
- `uuid` (or `gen_random_uuid()`) for primary keys when global uniqueness is required; `bigserial` for high-volume append-only tables
- `timestamptz` (timestamp with time zone) always — never `timestamp` (without time zone); store in UTC, display in local time at the application layer
- `jsonb` for semi-structured data — not `json` (jsonb is indexed and binary-stored); not `text` with manual JSON parsing
- `text` for variable-length strings — avoid `varchar(n)` length constraints without a business reason; `char(n)` almost never appropriate
- `boolean` not a `tinyint` or `char(1)` — PostgreSQL has a native boolean type

## JSONB Usage
- Index JSONB columns with GIN index for containment queries (`@>`, `?`, `?&`, `?|`)
- Use generated columns (`GENERATED ALWAYS AS (jsonb_col->>'field') STORED`) to index specific JSONB paths efficiently
- Keep JSONB schemas consistent — document the expected shape; validate at the application layer
- Avoid deep nesting in JSONB — more than 3 levels suggests the data should be normalized

## Indexes
- Partial indexes for filtered queries: `CREATE INDEX ON orders (user_id) WHERE status = 'pending'`
- GIN index for full-text search (`tsvector`) and JSONB
- GiST or SP-GiST for geometric/range types and nearest-neighbour queries
- `pg_trgm` extension for ILIKE / similarity searches: `CREATE INDEX ON users USING GIN (name gin_trgm_ops)`
- BRIN index for large append-only tables with naturally ordered data (time-series, logs)
- Index bloat: run `REINDEX` or use `CREATE INDEX CONCURRENTLY` for online rebuilds on large tables

## Extensions
- Declare required extensions in the migration that first uses them: `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- `pgvector` for vector similarity search — index with `ivfflat` or `hnsw` operator class
- `pg_stat_statements` enabled in production for query performance monitoring

## Query Patterns
- `RETURNING` clause for insert/update operations to avoid a follow-up SELECT
- CTEs are optimisation fences in PostgreSQL ≤ 11 — use `MATERIALIZED` / `NOT MATERIALIZED` explicitly in PG 12+
- Window functions (`ROW_NUMBER()`, `RANK()`, `LAG()`) for ranking and pagination — not correlated subqueries
- `EXPLAIN (ANALYZE, BUFFERS)` reviewed before merging queries touching tables > 100k rows

## Connection Pooling
- Use `PgBouncer` (transaction pooling mode) between the application and PostgreSQL for serverless or high-concurrency deployments
- Never open more connections than `max_connections` — connection exhaustion crashes all clients
- `pg_stat_activity` monitored in production — idle connections holding locks are a common source of incidents

## Maintenance
- `autovacuum` enabled and tuned — never disable it
- `VACUUM ANALYZE` run after large bulk inserts or deletes
- Table bloat monitored with `pgstattuple` or `pg_relation_size`

## Out of bounds
- No `timestamp` (without time zone) columns — always `timestamptz`
- No `json` type — use `jsonb`
- No `NOLOCK` hint (SQL Server pattern — does not exist in PostgreSQL and signals a misunderstanding)
- No disabling `autovacuum` on individual tables without documented justification
- No `SELECT *` in production queries
