---
paths: ["cypress.config.*", "**/cypress/**", "**/*.cy.ts", "**/*.cy.js"]
detect:
  dependencies: ["cypress"]
---

# Cypress Rules — Applied to all Cypress E2E test projects

## Test Organisation
- Tests in `cypress/e2e/` — one spec file per user journey (e.g. `user-filter.cy.ts`)
- Organise by feature, not by page URL
- `cypress/support/` for shared commands and setup — not business logic
- `cypress/fixtures/` for static test data JSON files

## Selectors (in priority order)
1. `cy.findByRole('button', { name: 'Submit' })` — via `@testing-library/cypress`; accessibility-based
2. `cy.findByLabelText('Email address')` — for form inputs
3. `cy.findByText('Confirm')` — for content
4. `data-cy` attribute: `cy.get('[data-cy="submit-btn"]')` — last resort; add to markup explicitly
- Never use CSS class selectors, element tags, or XPath — they couple tests to implementation

## Custom Commands
- Custom commands in `cypress/support/commands.ts` — one command per reusable action
- Commands named with verb: `cy.loginAs(role)`, `cy.seedUser(overrides)`
- Always return `cy` or a chainable from custom commands to maintain chain-ability
- Document command parameters with a JSDoc comment

## Fixtures
- One fixture file per domain entity or scenario: `cypress/fixtures/users.json`
- Load with `cy.fixture('users').then(...)` — not inline hardcoded JSON in tests
- Never PUT secrets or real credentials in fixture files

## Network Interception
- `cy.intercept()` to stub API calls for deterministic tests — not depending on a live backend
- Alias intercepts: `cy.intercept('GET', '/api/users').as('getUsers')` and wait: `cy.wait('@getUsers')`
- Verify request payloads in the intercept for mutation tests: `cy.wait('@createUser').its('request.body').should('include', { name: 'Alice' })`

## Authentication
- Use `cy.session()` to cache and reuse authenticated state across tests — not full login flow in every `beforeEach`
- Read credentials from `Cypress.env()` — never hardcode in test files
- Test auth boundaries explicitly: verify that unauthenticated routes redirect

## Assertions
- Use `should()` for synchronous assertions on Cypress subjects — Cypress retries automatically
- Prefer explicit assertions over implicit: `cy.get(...).should('be.visible')` not just `cy.get(...)`
- Chain multiple assertions where they test the same element: `.should('be.visible').and('have.text', 'Active')`
- Never use arbitrary `cy.wait(ms)` — use `cy.wait('@alias')` or assertion-based waiting

## CI Configuration
- `video: false` in CI for speed unless debugging flaky tests
- `screenshotOnRunFailure: true` — always capture evidence of failures
- `retries: { runMode: 2, openMode: 0 }` — retry in CI only
- Run with `--browser chrome` for consistent cross-environment results

## Out of bounds
- No CSS class or element tag selectors — use `data-cy` or Testing Library queries
- No `cy.wait(ms)` with a fixed timeout — use intercept aliases or assertion retries
- No hardcoded credentials — use `Cypress.env()`
- No business logic in `cypress/support/commands.ts` — commands are interaction helpers only
- No shared mutable state between tests — reset via `beforeEach`
