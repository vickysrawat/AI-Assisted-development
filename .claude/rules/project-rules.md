---
paths: ["**/*"]
detect:
  always: true
---

# Project Rules — Applied to all files

## Scope control
- Do not suggest architectural changes unless explicitly asked
- Do not add third-party libraries without flagging them first
- Do not modify `.gitignore`, CI/CD pipelines, or auth policies automatically — flag and ask
- If uncertain whether something is in scope, stop and ask rather than assume
- **Do not assume.** If a requirement, instruction, or expected behaviour is vague, ambiguous, or complex enough to have more than one reasonable interpretation — stop and ask. Never guess and proceed. A wrong assumption costs more to unwind than the question costs to ask.

## Design philosophy
- **Simplicity first** — do not over-complicate. Prefer the simplest solution that correctly solves the problem.
- **Readability** — code is read far more often than it is written. Optimise for the reader, not the writer.
- **Maintainability** — favour explicit, self-contained code over clever abstractions. A future developer should be able to understand and change any piece without reading the whole codebase.
- **Testability** — write code that can be verified. Avoid hidden side effects, global state, and deep coupling that make unit testing hard.
- If a simpler approach exists, take it — even if it means writing more lines. Complexity that cannot be justified by a concrete requirement is a defect.
- **Decision transparency** — for any complex logic or non-trivial design choice (algorithm selection, data structure, architectural pattern, library choice), document the decision inline before the implementation using this format:

  ```
  // DECISION: <what is being decided>
  // Options considered:
  //   A) <option> — rejected: <reason>
  //   B) <option> — rejected: <reason>
  //   C) <chosen option> — chosen: <reason>
  ```

  Example:
  ```typescript
  // DECISION: How to store filter state across tab switches
  // Options considered:
  //   A) localStorage — rejected: persists across sessions, risks stale state on version deploy
  //   B) URL query params — rejected: exposes PII-adjacent filter state, breaks deep links
  //   C) In-memory component state — chosen: simple, cleared on reload, no persistence concerns
  private filterState = new Map<string, FilterModel>();
  ```

  Apply when: choosing between two or more viable approaches, selecting a data structure, picking an algorithm, or making an architectural call that is not immediately obvious from the surrounding code. Skip for trivial or self-evident choices. The goal is that the next developer understands **why**, not just **what**.

## Code quality
- No `console.log` / `Debug.WriteLine` in production code
- No hardcoded secrets, connection strings, or credentials anywhere in source
- No `TODO` comments without a linked ADO item number
- No `any` type in TypeScript — always type explicitly
