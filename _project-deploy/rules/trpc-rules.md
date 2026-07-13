---
paths: ["**/trpc/**", "**/server/api/**", "**/*.ts", "**/*.tsx"]
detect:
  dependencies: ["@trpc/client", "@trpc/server"]
---

# tRPC Rules — Applied to all tRPC projects

## Router Organisation
- One router file per domain: `server/api/routers/user.ts`, `server/api/routers/filter.ts`
- Merge domain routers into a single `appRouter` in `server/api/root.ts`
- Never put business logic directly in router files — call service functions
- Export `AppRouter` type from root — import it in the client for end-to-end type safety

## Procedures
- Use `publicProcedure` only for endpoints that genuinely need no authentication
- Create a `protectedProcedure` base with auth middleware — apply to all authenticated endpoints
- One procedure per intent — do not combine unrelated operations in a single handler
- Procedure handler is thin: validate → call service → return

## Input Validation
- Every mutation and query with parameters has a `.input(z.object({ ... }))` Zod schema
- Zod schemas extracted to a shared `schemas/` directory when reused across procedures and components
- Never trust `ctx.input` types without the `.input()` validator — tRPC's type safety depends on it

## Error Handling
- Throw `TRPCError` with the correct `code`: `'NOT_FOUND'`, `'UNAUTHORIZED'`, `'FORBIDDEN'`, `'BAD_REQUEST'`
- Never throw plain `Error` from a procedure — it maps to a generic 500 on the client
- `'INTERNAL_SERVER_ERROR'` code for unexpected failures — log the full error server-side, surface a sanitized message

## Client Usage
- Use the tRPC React Query integration (`api.resource.operation.useQuery`, `.useMutation`)
- Always handle `isLoading`, `isError`, and `data` states
- Invalidate via `utils.resource.operation.invalidate()` after mutations — not broad `invalidateQueries`
- Never call tRPC procedures directly server-to-server in the same process — call the service function directly

## Context
- `createTRPCContext` owns all request-scoped dependencies: session, DB client, logger
- Never access `process.env` inside procedure handlers — resolve config in context creation
- Auth resolved once in context — procedures read from `ctx.user`, not re-validated per call

## Out of bounds
- No business logic in router files — delegate to services
- No plain `Error` throws from procedures — use `TRPCError`
- No `publicProcedure` for authenticated endpoints
- No tRPC client calls from server-side code in the same process — call services directly
- No Zod schemas defined inline in `.input()` when the schema is reused elsewhere
