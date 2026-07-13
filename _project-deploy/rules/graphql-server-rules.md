---
paths: ["**/graphql/**", "**/*.graphql", "**/*.gql", "**/resolvers/**", "**/schema/**"]
detect:
  dependencies: ["apollo-server-core", "@apollo/server", "graphql", "@nestjs/graphql", "strawberry-graphql", "graphene"]
---

# GraphQL Server Rules — Schema design, resolvers, and API serving

> For consuming GraphQL APIs from the frontend see `graphql-client-rules.md`.

## Schema Design (SDL-First)
- Define the schema in `.graphql` / `.gql` SDL files — not programmatically as code strings
- One schema file per domain area: `user.graphql`, `filter.graphql` — merged at server startup
- Types named in PascalCase; fields in camelCase; enums in SCREAMING_SNAKE_CASE
- Never expose internal database IDs or implementation details in the schema — design for the client's needs
- Use interfaces and unions to model polymorphic types — not optional fields that are conditionally present

## Queries and Mutations
- Queries are read-only and side-effect-free — mutations own all writes
- Mutation names as verb + noun: `createUser`, `updateFilter`, `deleteAuditLog`
- Query names as noun (possibly qualified): `user`, `users`, `userFilterConfig`
- Input types for mutations: `CreateUserInput`, `UpdateFilterInput` — never inline mutation arguments beyond a scalar ID

## Resolvers
- Thin resolvers: validate context (auth), call a service, return the result — no business logic in resolvers
- Each resolver field accounted for — no implicit `undefined` returns (use `null` for nullable fields)
- Resolver functions typed with generated types from `graphql-codegen` — never hand-write resolver type maps

## N+1 Prevention (DataLoader mandatory)
- Never query the database inside a field resolver that may be called N times for a list
- DataLoader for every batched lookup: `userLoader.load(id)` batches per-request and deduplicates
- One DataLoader per entity per request context — never share DataLoader instances across requests
- Log slow resolver execution (> 500 ms) — N+1 is usually the culprit

## Authentication and Authorisation
- Auth resolved in the request context before any resolver executes — `context.user` available to all resolvers
- Field-level auth via a directive (`@auth(requires: ADMIN)`) or guard — not ad-hoc checks inside resolver functions
- Unauthenticated access to any protected type throws `UNAUTHENTICATED` error (not 401 — GraphQL returns 200 with error)

## Error Handling
- Use `GraphQLError` with an `extensions.code` for all expected errors: `NOT_FOUND`, `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`
- Unexpected errors caught at the executor boundary, logged with full detail, returned as `INTERNAL_SERVER_ERROR` — never expose stack traces
- Never throw native `Error` from a resolver — always `GraphQLError` with a code
- `formatError` hook to sanitize error messages before they reach the client

## Persisted Queries / Depth Limiting
- Query depth limit enforced to prevent deeply nested abuse: `graphql-depth-limit` or equivalent
- Query complexity limit for large schemas: `graphql-query-complexity`
- Persisted queries for production clients where possible — blocks arbitrary query execution

## Out of bounds
- No business logic in resolver functions — call services
- No database calls inside field resolvers without DataLoader
- No hand-written resolver type maps — use codegen
- No native `Error` throws — use `GraphQLError`
- No unlimited query depth without a depth-limit plugin
