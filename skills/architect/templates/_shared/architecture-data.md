<!-- TEMPLATE -->
# Architecture — Data Model

> Load this file when adding or changing an entity, table, or query, when reasoning about
> data ownership, or when a feature touches persistence.

## Entity Relationship Diagram

> One diagram covering all entities. Include PK/FK annotations and column types.
> Update this diagram whenever the schema changes — it is the visual source of truth.

```mermaid
erDiagram
    EntityA {
        int id PK "Primary key — identity"
        string name "NOT NULL"
        int entityBId FK "References EntityB.id"
        datetime createdAt "UTC — set on insert"
        datetime updatedAt "UTC — set on update"
    }
    EntityB {
        int id PK "Primary key — identity"
        string code "UNIQUE NOT NULL"
        string description "Nullable"
    }
    EntityC {
        int id PK "Primary key — identity"
        int entityAId FK "References EntityA.id"
        decimal amount "NOT NULL — 2 decimal places"
        string status "e.g. Pending / Active / Closed"
    }

    EntityB ||--o{ EntityA : "categorises (one EntityB to many EntityA)"
    EntityA ||--o{ EntityC : "has many (one EntityA to many EntityC)"
```

> ⚠ Replace the example entities above with the actual schema from this project.

---

## Entities / Tables

| Entity / Table | Owning Module | Key Columns | Purpose |
|----------------|---------------|-------------|---------|

## Relationships

| From | To | Cardinality | Foreign Key | On Delete |
|------|----|-------------|-------------|-----------|

## Data Ownership

> Which module/service is the system-of-record for each table. Others read via its API/
> repository, not by writing the table directly.

| Table / Aggregate | Owner | Written by | Read by |
|-------------------|-------|-----------|---------|

## Key Aggregates

> The main consistency boundaries — the root entity and what is loaded/saved with it.

## Access Patterns

> Document the data-access approach actually used (ORM entities/repositories or a query
> surface). List which components run which queries against which tables.

| Repository / DAO | Query / operation | Tables touched | Read/Write |
|------------------|-------------------|----------------|------------|

## Migrations / Schema Source

> Where the schema is defined (migration tool, SQL scripts, ORM migrations, DBA-managed).

> ⚠ Could not determine — needs manual input
