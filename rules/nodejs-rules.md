---
paths: ["**/*.ts", "**/services/**", "**/middleware/**", "**/routes/**"]
---

# Node.js Rules — Applied to Node.js service files

## TypeScript
- Strict mode enabled — no implicit `any`, strict null checks, strict function types

## File Naming
- Files: `camelCase.ts` (e.g. `userFilterService.ts`, `userFilterService.test.ts`)

## Error Handling
- Never let an unhandled error crash the process — wrap all async handlers in try/catch
- Always return { statusCode, errorCode, message } — never expose stack traces
- Use custom AppError class for domain errors with errorCode and httpStatus

## Validation
- Zod schema for every request body, query param, and path param
- Validate at the route/middleware level before business logic runs
- Return 400 with field-level Zod error details on validation failure

## Async Patterns
- async/await throughout — no raw Promise chains
- Graceful shutdown: drain connections on SIGTERM before exiting

## Logging
- Winston structured logger — always log { service, operation, userId, duration }
- Never log PII — mask emails, names, and IDs in log output
- Log at appropriate levels: info for normal flow, warn for recoverable errors, error for exceptions

## Testing
- Jest with ts-jest
- Mock all external HTTP calls and DB connections
- Test all ICEA scenarios: happy path, edge cases, error states, permission boundary
