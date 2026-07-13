---
paths: ["**/*.tsx", "**/*.ts", "**/graphql/**", "**/*.graphql"]
detect:
  dependencies: ["@apollo/client", "graphql"]
  excludeIfDependencies: ["apollo-server-core", "@apollo/server"]
---

# GraphQL Client Rules — Applied to all Apollo Client / frontend GraphQL projects

For GraphQL server rules (schema design, resolvers) see `graphql-server-rules.md`.

## Apollo Client Configuration
- Single `ApolloClient` instance per app — created once and provided via `ApolloProvider`
- `InMemoryCache` with explicit `typePolicies` for non-standard ID fields — never rely on accidental cache hits
- Auth headers injected via an `authLink` — never added to individual query options
- Error handling via `onError` link — log globally, surface user-friendly messages via `errorVar`

## Query and Mutation Files
- Co-locate `.graphql` files with the component that uses them — `UserFilter.graphql` alongside `UserFilter.tsx`
- Use named operations — never anonymous queries: `query GetUserFilter { ... }` not `query { ... }`
- Generate TypeScript types from schema with `graphql-codegen` — never hand-write operation types
- Use the generated hooks (`useGetUserFilterQuery`, `useUpdateFilterMutation`) — not raw `useQuery`/`useMutation` with inline documents

## Data Fetching Patterns
- Always handle three states in every query consumer: `loading`, `error`, and `data`
- `networkStatus` for fine-grained loading states (polling, refetch vs initial load)
- `fetchPolicy: 'cache-and-network'` for list pages where freshness matters; `'cache-first'` for stable reference data
- Never use `fetchPolicy: 'no-cache'` unless you have a documented reason — defeats Apollo's cache

## Mutations
- Call `refetchQueries` or update the cache directly after mutations — never leave stale data
- Optimistic responses for low-latency UX — always paired with an `update` function to handle rollback on error
- One mutation per user intent — do not combine unrelated updates into a single mutation call

## Fragments
- Shared field sets extracted as fragments — co-located with the component that owns them
- Fragment names: `{ComponentName}Fields` — e.g. `UserCardFields`
- Import fragments using `graphql` tagged template or `.graphql` file — never inline string duplication

## Error Handling
- Distinguish GraphQL errors (`error.graphQLErrors`) from network errors (`error.networkError`)
- Never display raw GraphQL error messages to users — map to user-facing text
- Log `extensions.code` for monitoring — structured log including operation name and variables (mask PII)

## Out of bounds
- No anonymous operations
- No hand-written TypeScript types for operation results — use codegen
- No `fetchPolicy: 'no-cache'` without documented justification
- No raw `useQuery` with inline `gql` strings — use `.graphql` files and generated hooks
- No PII in logged variables
