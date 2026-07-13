---
paths: ["**/*.js", "**/*.mjs", "**/*.cjs", "**/scripts/**", "**/src/**"]
detect:
  files: ["**/*.js", "**/*.mjs", "**/*.cjs"]
  excludeIfDependencies: ["typescript"]
---

# JavaScript Rules — Applied to vanilla JS / ES2015+ files

Applies to plain JavaScript projects (ES2015+, ESM, CommonJS). Does NOT apply
to TypeScript files (covered by `nodejs-rules.md` and `angular-rules.md`) or
framework-specific files. Where a rule is module-format-specific it is marked.

## Module System
- Use ES Modules (`import` / `export`) for all new files in ESM projects
- Use CommonJS (`require` / `module.exports`) only in legacy projects or tooling config files — never mix both in the same file
- Never use global variables to share state between modules — export explicitly
- Default exports only for single-responsibility modules; named exports preferred when a module exports multiple things

## Code Style
- `const` by default; `let` only when reassignment is required; never `var`
- Arrow functions for callbacks and short expressions; named `function` declarations for top-level functions
- Destructuring for objects and arrays whenever it improves clarity — avoid destructuring chains deeper than 2 levels
- Template literals instead of string concatenation
- Optional chaining (`?.`) and nullish coalescing (`??`) instead of `&&` guards or `||` defaults
- No ternary nesting — use `if/else` when more than one condition is involved

## Error Handling
- All async functions wrapped in `try/catch` — never let a rejected promise go unhandled
- `process.on('unhandledRejection', ...)` registered in entry point for Node.js scripts
- Never swallow errors silently (`catch(e) {}`) — at minimum log before re-throw
- Throw `Error` objects (or subclasses) — never throw raw strings or plain objects

## Async Patterns
- `async/await` throughout — no raw `.then().catch()` chains except when composing parallel calls with `Promise.all`
- `Promise.all` for independent parallel calls; `Promise.allSettled` when partial failure is acceptable
- Never `await` inside a `forEach` — use `for...of` or `Promise.all(array.map(...))`

## Validation
- Validate all external inputs (API responses, user input, environment variables) at the boundary before use
- Check for `null` / `undefined` explicitly — never assume a value exists because it was truthy last time
- Provide sensible defaults for optional config with `??` rather than silent undefined propagation

## DOM (browser JS only)
- Query selectors cached in variables — never re-query the same element multiple times in a function
- Event listeners added with `addEventListener` — never inline `onclick=` attributes
- `DOMContentLoaded` or `defer` attribute to ensure DOM is ready before script runs
- No direct manipulation of `innerHTML` with untrusted content — use `textContent` or DOM APIs to prevent XSS

## Logging
- Use a structured logger (e.g. `pino`, `winston`) in Node.js — never `console.log` in production code
- Browser scripts: `console.log` acceptable in development; strip with a build step (e.g. Terser `drop_console`) before production
- Never log PII, tokens, or secrets

## File Naming
- Files: `camelCase.js` (e.g. `userFilterService.js`, `userFilterService.test.js`)
- Entry points: `index.js` or descriptive name at the package root
- Config files: `{tool}.config.js` (e.g. `jest.config.js`, `webpack.config.js`)

## Linting and Formatting
- ESLint with `eslint:recommended` as the base ruleset, extended per project
- Prettier for formatting — never argue about style in code review, let the formatter decide
- `no-unused-vars`, `no-console`, and `no-undef` must be errors (not warnings) in production config

## Testing Pattern
- Jest (preferred) or Mocha + Chai; Arrange / Act / Assert with blank lines between sections
- Mock all external HTTP calls with `jest.mock` / `nock` / `msw`
- Test file co-located with source: `userFilterService.test.js` alongside `userFilterService.js`
- Test name: `"methodName — when condition — should expected behaviour"`
- Always test: error path, null/undefined input, and the ICEA permission boundary

## Security
- Never `eval()` — use `JSON.parse` for data, `Function` constructor is also forbidden
- Never construct SQL or shell commands via string concatenation — use parameterised queries or child_process with argument arrays
- Sanitise any value that reaches the DOM or a shell — treat all external input as untrusted

## Out of bounds
- No `var` — use `const` / `let`
- No `==` — always `===` for comparisons
- No `arguments` object — use rest parameters (`...args`)
- No `with` statement
- No synchronous file I/O (`fs.readFileSync`) in request handlers or hot paths — use async equivalents
- No secrets or tokens hardcoded in source — read from environment variables or a secrets manager
