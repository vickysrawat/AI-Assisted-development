---
paths: tests/**
---

_Fingerprint: 1ff78a239c520f221de8add96218600445ec95ca | Updated: 2026-09-23_

## Bounded context
Jest-based test suite for all plugin scripts. Raw `*.test.cjs` files use a custom `assert()` + `process.exit()` pattern. `jest.suite.test.cjs` is the wrapper that spawns each test file as a child process to prevent process.exit killing Jest. `c8` wraps the entire Jest run for coverage via NODE_V8_COVERAGE.

## Key files
- `jest.suite.test.cjs` — Jest wrapper spawning each raw test file
- `migration-validation/run-selftest.cjs` — migration skill self-test suite
- `fixtures/` — static test fixtures
- `skill-scenarios/` — scenario-based skill test data

## Dependencies
- `scripts/**` — each test file spawns its corresponding script (EXTRACTED)

## Patterns
- Run a single test: `node tests/<name>.test.cjs`
- All tests pass when exit code is 0
- Coverage via: `npm run test:coverage` (c8 + jest)
