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

## Caching / Invalidation

> Client-side caching (query cache, store hydration) and how it is invalidated.

> ⚠ Could not determine — needs manual input
