---
paths: ["**/models/**", "**/repositories/**", "**/db/**"]
detect:
  dependencies: ["mongodb", "mongoose", "@azure/cosmos", "cosmosdb", "dynamoose", "@aws-sdk/client-dynamodb"]
---

# NoSQL Document Rules — Document database design and query patterns

Covers MongoDB, Azure Cosmos DB, and other document databases. Where rules differ
between platforms they are marked.

## Document Model Design
- Embed related data that is always accessed together and has a bounded size — do not normalize everything into references
- Reference (link by ID) data that is large, frequently updated independently, or shared across many documents
- Avoid unbounded arrays — arrays that grow without limit cause document bloat and exceed the 16 MB document limit (MongoDB) or 2 MB item limit (Cosmos DB)
- One document = one aggregate root — do not spread a single business entity across multiple documents that must be updated atomically

## Schema Consistency
- Define and enforce a schema at the application layer even though the database is schema-less — use Mongoose schemas, Zod validation, or equivalent
- Never insert documents without validating their shape first
- Add a `schemaVersion` field to documents to enable safe migrations when the shape changes
- Indexes must be created before the collection grows — retroactive index creation on large collections causes long blocking operations

## Indexes
- Index every field used in a `WHERE` / `filter` clause or sort
- Compound indexes cover the full query shape — column order matters (equality fields first, range fields last)
- Partial indexes (filtered indexes) for sparse fields — e.g. index only documents where `status = 'active'`
- Text / search indexes for full-text search — not regex queries on large collections (full scan)
- Monitor index usage — remove unused indexes; they slow writes

## Aggregation and Queries
- Use the aggregation pipeline for multi-stage transformations — not multiple round trips
- Projection: always specify which fields to return — never return full documents when only a few fields are needed
- `$lookup` (MongoDB join) used sparingly — if you find yourself joining frequently, reconsider the document model
- Paginate all list queries with `limit` and `skip` (offset) or cursor-based pagination for large collections

## Transactions
- Multi-document transactions available in MongoDB 4.0+ and Cosmos DB — use them for operations that must be atomic across documents
- Keep transactions short — no external HTTP calls, no user-facing delays inside a transaction
- For Cosmos DB: transactions are scoped to a single logical partition — design partition keys accordingly

## Cosmos DB Specifics
- Partition key chosen for even data distribution and query efficiency — never use a field with low cardinality (e.g. `country`) for a globally distributed system
- Request Unit (RU) cost monitored per operation — unbounded queries without filters can exhaust provisioned throughput
- Point reads (by ID + partition key) are cheapest — design access patterns around them

## Data Integrity
- No relying on the database for referential integrity — validate foreign references in the application layer
- Idempotent writes: use `upsert` with a deterministic document ID for operations that may be retried
- Soft deletes via a `deletedAt` field — hard deletes lose audit history

## Out of bounds
- No unbounded arrays in documents
- No schema-less inserts without application-layer validation
- No regex queries on large unindexed fields — use text indexes or a search service
- No multi-document operations without a transaction when atomicity is required
- No partition key chosen for convenience over distribution (Cosmos DB)
