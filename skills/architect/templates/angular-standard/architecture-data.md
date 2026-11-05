<!-- TEMPLATE -->
# Architecture — Data Model (client state & API contracts)

> Load this file when adding or changing client state, a store/slice, or an API DTO, or when
> reasoning about which component owns which piece of state.

## Client State Model

| Store / Slice / Service | State shape (key fields) | Owning feature | Persistence (memory/localStorage/none) |
|-------------------------|--------------------------|----------------|----------------------------------------|

## API DTO Shapes

> The request/response models the app exchanges with the backend (from typed models/interfaces).

| DTO / Interface | Used by (component/service) | Endpoint | Direction (req/res) |
|-----------------|-----------------------------|----------|---------------------|

## State Ownership & Flow

> Which feature/module owns each piece of state, and how it flows (inputs/props, selectors,
> events/actions). Note derived vs source-of-truth state.

## Data Lineage

> Where this application's data comes from, how it is transformed, where it is stored, and where
> it leaves the system. **No fixed shape** — the diagrams, tables, and sub-sections follow this
> application (one flow or several, by data kind or by journey). Load this section when changing a
> field, its calculation, where it is stored, who can export it, or how long it is kept.
>
> Must answer, from the code:
> - Where does each important data element enter (user input, upload, upstream system, job, bulk load)?
> - What changes it on the way (calculation, mapping, masking, aggregation), and in which code?
> - Where is it stored, and for how long (retention / purge)?
> - Where does it leave (exports, reports, downstream systems, browser storage, logs, telemetry),
>   and what must never leave?
> - Which elements are sensitive (confidential, PII, B-series — see `.claude/business-context.md`)?

> ⚠ Could not determine — needs manual input

## Caching / Invalidation

> Client-side caching (query cache, store hydration) and how it is invalidated.

> ⚠ Could not determine — needs manual input
