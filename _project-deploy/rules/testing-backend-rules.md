---
paths: ["**/*.test.*", "**/*.spec.*", "**/tests/**", "**/test/**"]
detect:
  always: false
---

# Testing Backend Rules — Test strategy, structure, and ICEA coverage

> Deployed automatically alongside any backend Layer 3 language file.
> Covers test strategy and structure; language-specific tooling (xUnit, pytest, Jest) is in
> the Layer 3 language file. For E2E browser testing see `playwright-rules.md` / `cypress-rules.md`.

## Test Pyramid
- Unit tests: the majority — test a single function/class with all dependencies mocked; fast, deterministic
- Integration tests: a smaller set — test a slice (handler → service → repository → real DB); use an in-memory or test DB
- E2E / contract tests: the fewest — test the deployed API from the outside; run in CI against a staging environment
- Do not invert the pyramid — a slow integration test suite that runs for 20 minutes defeats the purpose

## ICEA Coverage (mandatory)
- Every ICEA Acceptance Criterion has at least one test scenario
- Always test these four boundaries for every endpoint or operation:
  1. Happy path — valid input, expected output
  2. Validation error — invalid or missing input returns the correct error shape
  3. Not found / empty — resource does not exist; returns the correct status and body
  4. Permission boundary — unauthenticated or unauthorised caller is rejected correctly

## Test Structure (Arrange / Act / Assert)
- Blank lines between Arrange, Act, and Assert sections — no exceptions
- One assertion concept per test — multiple `expect` / `assert` lines for the same concept are fine
- Test names describe the scenario: `getUserById — when user does not exist — returns 404 with body`
- No logic in tests (no `if`, `for`, `switch`) — if logic is needed, split into separate tests

## Mocking
- Mock all external dependencies in unit tests: HTTP clients, email services, queues, external APIs
- Do NOT mock the database in integration tests — use a real (test) database to catch schema and query issues
- Use constructor injection (not service locator or static calls) so dependencies are mockable
- One mock setup per test — do not share mutable mock state across tests in the same suite

## Test Data
- Minimum test data: set up only what the test needs — no shared large fixtures that tests mutate
- Factory functions / builders for test objects — not copy-pasted raw objects
- Test DB cleaned between test runs: transaction rollback or truncate — never depend on database state from a previous run
- No production data in test databases — use synthetic data that matches the production schema

## Performance
- Unit tests must complete in < 100 ms each — slow unit tests indicate a missing mock or hidden I/O
- Integration test suite target: < 5 minutes for a full backend suite — parallelize where the framework supports it
- No `Thread.Sleep` / `asyncio.sleep` / `setTimeout` in tests — use event-driven assertions or polling with a short timeout

## Out of bounds
- No `//TODO: add test` without a linked ADO item
- No empty `catch` blocks in test code (swallowing assertion errors)
- No tests that depend on execution order — every test must be independently runnable
- No mocking the database in integration tests
- No production connection strings in test configuration
