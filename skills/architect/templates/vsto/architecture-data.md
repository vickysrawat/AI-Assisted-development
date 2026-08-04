<!-- TEMPLATE -->
# Architecture — Data Model

> Load this file when adding or changing how the add-in reads or writes document data,
> application settings, or any external data store, or when reasoning about data ownership.
>
> VSTO add-ins rarely own a relational schema — they primarily work with the Office document
> model (workbook ranges, worksheet cells, document properties, custom XML parts) and
> optionally a backing store (SQL Server, SharePoint, REST API, local file).

## Document Data Model

> Describe the in-document data structures the add-in reads or writes.

| Host object | Location | Data stored | Read by | Written by |
|-------------|----------|-------------|---------|------------|
| `Worksheet` | | | | |
| `Range` / named range | | | | |
| Custom XML part | | | | |
| Document property | | | | |
| ListObject (table) | | | | |

> ⚠ Could not determine — populate from actual Office object model usage in codebase

## Application Settings & Persistence

> Where the add-in stores configuration or user preferences outside the document.

| Setting store | Kind | Location | Access pattern |
|---------------|------|----------|----------------|
| Registry | `HKCU\Software\…` | | |
| Isolated storage | | | |
| App.config / settings file | | | |
| SQL Server | | | |
| SharePoint list | | | |
| REST API | | | |

> ⚠ Could not determine — populate from actual settings/persistence code

## Backing Store (if any)

> Complete this section only if the add-in talks to an external database or store.

| Entity / Table | Store | Owner module | Key columns | Purpose |
|----------------|-------|--------------|-------------|---------|

## COM Object Lifecycle & Data Access

> Document how the add-in acquires, uses, and releases Office COM objects to avoid memory
> leaks and the "two-dot rule" (never chain COM calls without releasing intermediates).

| COM object | Acquired via | Released via | Notes |
|------------|-------------|--------------|-------|
| `Application` | `Globals.ThisAddIn.Application` | — (host-owned) | |
| `Workbook` | | | |
| `Worksheet` | | | |
| `Range` | | | |

> ⚠ Could not determine — populate from actual COM interop patterns in codebase

## Data Ownership

| Data / aggregate | Owner | Written by | Read by |
|-----------------|-------|-----------|---------|
