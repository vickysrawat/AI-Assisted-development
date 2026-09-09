# Shared Reference: EF6 → EF Core Migration

_Loaded when source has .edmx files or EF6 detected. Used across any migration path involving EF6._

---

## Fundamental Rule

**EF Core is NOT a drop-in replacement for EF6.** It is a ground-up rewrite. The official Microsoft guidance states: "just because your application compiles does not mean it is successfully ported to EF Core." Many behavioral differences cause runtime exceptions or, worse, **silent incorrect data**.

---

## 9 Silent Behavioral Differences (Verify Before Migrating)

### 1. Client-side evaluation throws (EF Core 3.0+)
**EF6 behavior:** When a LINQ expression can't translate to SQL, silently loads ALL rows then filters in C#.
**EF Core behavior:** Throws `InvalidOperationException` at runtime.
**Affected patterns:** Any `Where()` clause calling a custom C# method or using string operations not in `System.Linq.Expressions`.
**Pre-migration audit:** Search for `Where(x => MyCustomMethod(x.Field))` patterns in the entire source codebase.
**Fix:** Rewrite as SQL-translatable LINQ, OR add explicit `.AsEnumerable()` before the filter (understanding it loads all rows first).

### 2. Lazy loading disabled by default
**EF6 behavior:** Lazy loading enabled by default for virtual navigation properties.
**EF Core behavior:** Opt-in only — requires `UseLazyLoadingProxies()` + `virtual` keyword on navigation properties + `Microsoft.EntityFrameworkCore.Proxies` package.
**Without opt-in:** Navigation properties return `null` silently — **no exception thrown**. This causes silent null bugs in code that assumed navigation properties load automatically.
**Recommended fix:** Add explicit `.Include()` / `.ThenInclude()` on every query that accesses navigation properties. Do NOT use lazy loading proxies as a permanent solution — they re-introduce N+1 problems.

### 3. Table naming convention change
**EF6 behavior:** Pluralises entity class names: `Order` entity → `Orders` table.
**EF Core behavior:** Uses the `DbSet<T>` property name: if `DbSet<Order>` is named `ActiveOrders`, maps to `ActiveOrders` table.
**Silent failure:** Queries the wrong table with no error if names differ.
**Fix:** Explicitly configure `.ToTable("TableName")` in `OnModelCreating` for every entity, matching the existing database table names.

### 4. GroupBy with element projection
**EF6 behavior:** `GroupBy` followed by projecting group elements (not just aggregates) works.
**EF Core behavior:** Throws in EF Core 3–5. Partial support in EF Core 7+. Aggregates (`Sum`, `Count`, `Max`) translate correctly.
**Fix:** Rewrite group-then-project patterns as sub-selects, or load then group in memory with `.AsEnumerable()`.

### 5. Cascade delete behavior changed (EF Core 6/7)
**EF Core 7 change:** When severing an optional dependent from its principal, EF Core 7 no longer deletes the dependent (EF Core 6 did). **Silent behavior change** in delete-heavy workloads.
**Also:** First migration after upgrading to EF Core 7 may generate cascade delete constraints that don't exist in the current DB schema.
**Fix:** Explicitly configure cascade behavior: `.OnDelete(DeleteBehavior.Cascade)` or `.OnDelete(DeleteBehavior.Restrict)`.

### 6. String comparison collation differences
**EF6 on SQL Server:** Comparisons always run through the database collation (case-insensitive by default).
**EF Core on PostgreSQL:** Default collation is case-sensitive — the same EF query returns zero rows where EF6 on SQL Server would have returned matches.
**Fix:** Use `EF.Functions.Collate()` for explicit collation control on string comparisons.

### 7. `DbSet.Add` graph traversal changed
**EF6 behavior:** `Add()` recursively marks all reachable entities as `Added`.
**EF Core behavior:** Uses key detection — entities with store-generated keys at CLR default → `Added`; entities with non-default keys → `Unchanged`.
**Silent failure in disconnected scenarios (Web API):** Entities expected to be added are treated as unchanged.

### 8. Pending model changes throw (EF Core 9+)
**EF Core 9 change:** Throws if `Migrate()` is called when the model has un-scaffolded changes. Previously a silent no-op.
**Impact:** CI pipelines that assumed migrations were always current will now throw on first deploy. Add explicit migration check to CI.

### 9. Optional dependents with no required properties — silent data loss
If owned types or table-splitting configurations have nested optional dependents with NO required properties, EF Core silently loses their data. **Add at least one required property** to each dependent, or avoid this configuration.

---

## .edmx Migration Procedure

1. **If live DB connection available:** Use `dotnet ef dbcontext scaffold` against the database:
   ```bash
   cd "{TARGET_PATH}"
   dotnet ef dbcontext scaffold \
     "Server=localhost;Database=mydb;Trusted_Connection=True;" \
     Microsoft.EntityFrameworkCore.SqlServer \
     --output-dir Models \
     --context AppDbContext
   ```
   Record which connection string approach was used in `TARGET-ARCHITECTURE.md`.

2. **If no DB connection:** Parse the `.edmx` XML to extract entity definitions manually:
   - Read `<EntityType>` elements for entity names and properties
   - Read `<Association>` elements for relationships
   - Read `<EntityContainerMapping>` for table name mappings
   - Regenerate EF Core entities manually from this structure

3. **Migration baseline (always):**
   - There is NO path from EF6 migration files to EF Core. Start fresh.
   - Assume all EF6 migrations have been applied to the current database.
   - Scaffold an initial EF Core migration, then empty its `Up()` and `Down()` methods.
   - All subsequent schema changes flow through EF Core migrations from that baseline.
   ```bash
   cd "{TARGET_PATH}"
   dotnet ef migrations add InitialCreate
   # Then empty the Up() and Down() methods in the generated file
   ```

---

## EF6 Features with No EF Core Equivalent

| EF6 Feature | EF Core Status |
|---|---|
| EDMX (XML model format + visual designer) | Not supported |
| Visual Studio "Update Model from Database" wizard | Not supported |
| Entity SQL text-based query language | Not supported |
| Independent associations (relationship without FK property) | Not supported |
| Automatic database initialization (`IDatabaseInitializer`) | Not supported — use explicit `Migrate()` |
| `ObjectContext` API | Not supported |
| T4 templates for code generation | Not supported |

---

## Pre-Migration Audit Checklist

Before migrating any EF6 code, search the codebase for:
- [ ] `Where(x => CustomMethod(x.Property))` — client-evaluation risk
- [ ] `GroupBy(...)` followed by accessing group elements (not just `.Sum()`, `.Count()`) — broken in EF Core
- [ ] Virtual navigation properties without `UseLazyLoadingProxies` configured — will return null silently
- [ ] Table names that differ from entity class names (check `OnModelCreating` overrides)
- [ ] `ObjectContext` usage — must be rewritten
- [ ] `BinaryFormatter` serialization of entities — removed in .NET 8
- [ ] `((IObjectContextAdapter)context).ObjectContext` calls — must be rewritten
- [ ] Cascade delete expectations (test against a real DB after migration)
