---
paths: ["playwright.config.*", "**/e2e/**", "**/*.spec.ts"]
detect:
  dependencies: ["@playwright/test", "playwright"]
---

# Playwright Rules — Applied to all Playwright E2E test projects

## Test Organisation
- Tests in `e2e/` or `tests/e2e/` — separated from unit tests
- One spec file per user journey / feature area (e.g. `user-filter.spec.ts`)
- Test file name matches the feature, not the URL: `user-filter.spec.ts` not `users-page.spec.ts`
- Group related tests in `test.describe('Feature Name', () => { ... })`

## Selectors (in priority order)
1. `getByRole('button', { name: 'Submit' })` — accessibility-tree query; most resilient
2. `getByLabel('Email address')` — for form inputs
3. `getByText('Confirm')` — for text content
4. `getByTestId('submit-btn')` — last resort; requires `data-testid` attribute in markup
- Never use CSS class selectors (`.btn-primary`), XPath, or element tag selectors — they break on styling changes

## Page Object Model
- One Page Object class per application page or major feature area
- Page Objects own all selectors and interaction methods — tests call PO methods, not `page.locator` directly
- Page Objects do not contain assertions — assertions stay in the test
- Locate the PO file alongside the spec: `e2e/user-filter/UserFilterPage.ts`

## Assertions
- Use Playwright's async assertions — `await expect(locator).toBeVisible()` — not manual `waitFor` loops
- Prefer state-based assertions over timeout-based: `toBeVisible()`, `toHaveText()`, `toHaveValue()`
- Never `await page.waitForTimeout(ms)` — it is a flakiness magnet; use `expect(...).toBeVisible()` instead
- Assert the outcome the user cares about, not implementation details (DOM structure, CSS classes)

## Test Data and State
- Reset application state between tests using `beforeEach` — never rely on state from a previous test
- Use `page.route()` to mock API calls for deterministic tests — do not depend on live backend data
- Seed only the minimum data needed for the test — no shared global fixtures that tests mutate

## Authentication
- Authenticate once per browser context and reuse the saved state via `storageState`
- Never hard-code credentials in test files — read from environment variables or `.env.test`
- Test auth boundaries: verify protected pages redirect unauthenticated users

## CI Configuration
- Run tests headless in CI: `headless: true` in `playwright.config.ts`
- Set `retries: 2` in CI — surface flaky tests rather than masking them with high retry counts
- Capture screenshots and traces on failure: `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`
- Run against a fixed base URL from env: `baseURL: process.env.BASE_URL`

## Out of bounds
- No CSS class or XPath selectors — use role / label / text / testId
- No `page.waitForTimeout()` — use async assertions
- No hard-coded credentials in test files
- No shared mutable fixtures between tests
- No assertions inside Page Object methods
