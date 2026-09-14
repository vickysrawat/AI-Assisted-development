# Flag Prompt Specification
_Spec version: 1.0 · Last changed: 2026-09-14 · Applies to: every flag-taking command/skill_

The universal rule for how a flag-taking command behaves when invoked **without a flag**.
This is the general convention; `interactive-menu-spec.md` is its scan-scope instantiation
(code-review, security, dynamic-scan) and takes precedence for those skills' scan-scope menu.

---

## The rule

When a command/skill that accepts flags is invoked with **no flag or argument**, it MUST prompt
the developer to choose before proceeding — using `AskUserQuestion` (or the skill's own menu) —
with the **documented default as the first / recommended option**. Do not default silently.

The recommended option must reproduce the skill's previous default behaviour, so an interactive
developer can accept it in a single keystroke and nothing changes for people who relied on it.

---

## Skip conditions — do NOT prompt

Skip the prompt and use the documented default when **any** of these hold:

1. **A flag/argument is already present** — use it directly. (This is why internal callers never
   trigger a prompt: `checkin` passes `--changed` / `--compact`, `pr-create` passes `--compact`,
   etc. They always arrive with an explicit flag.)
2. **CI / non-interactive context** — `--ci` is present, the run is headless/piped, or the skill
   was invoked by another skill/gate. **This is a hard rule: never block a pipeline on a prompt.**
   Fall back to the documented default silently.
3. **The skill already requires a value it can prompt for separately** (e.g. a required ADO ID) —
   those skills follow their own "ask for the missing required input" flow, which already satisfies
   this convention.

If interactivity is unavailable at the moment the prompt would fire (no TTY / headless), treat it
as condition 2 and use the documented default.

---

## Authoring pattern (per skill Step 0)

Replace any "no flag → silent default X" row with:

| Invocation | Behaviour |
|---|---|
| flag provided | use it directly |
| no flag — interactive | `AskUserQuestion`: options with **X = recommended**; wait for a choice |
| no flag — CI / non-interactive | use **X** silently |

---

## Applies to

- **Scan-scope skills** (`code-review`, `security`, `dynamic-scan`) — via `interactive-menu-spec.md`.
- **Mode/value skills** — `app-readiness`, `update-arch`, `graph-sync`, `graph-viz`,
  `gitignore-sync`, `dream-audit`, `token-analysis` — via the authoring pattern above.
- Skills that already prompt for a missing required argument (`icea-*`, `bug`, `fix`, `dismiss`,
  `setup-teardown`, `critic`, `product-docs`, `sprint-metrics`, `dream-rollback`, `go-live`,
  `operations`, `ado-tasks`) already comply; no change required.

## Hard rules

- **NEVER default silently in an interactive session** when no flag was provided.
- **NEVER prompt in CI / non-interactive contexts** — fall back to the documented default.
- **The recommended option equals the prior default** — preserve existing behaviour on one keystroke.
