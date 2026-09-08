# Rewrite — Design-Quality Rubric (AC-F6)

> Loaded by `skills/rewrite/SKILL.md` Step 4. Design-Quality is gated at **two** points — the design
> gate (before generation) and the implementation gate (in the generated code) — and **verified by the
> shared judge** (`skills/shared/judge.md`), not self-attested. Design of record:
> `docs/plans/migrationSkill/rewrite.md` T3. Mirrors the project design philosophy in
> `.claude/rules/project-rules.md`.

## Why two gates

BAL measures *behavior*; Design-Quality measures *the shape of the code that produces it*. A cluster
can be behaviorally correct (high BAL) yet unmaintainable. Catching quality only after generation is
too late — so it is gated **at design time** (is the plan simple/testable?) **and** **at implementation
time** (did the generated code honor it?).

## The four dimensions (SRMT)

| Dimension | Design gate asks | Implementation gate asks (judge, in generated code) |
|---|---|---|
| **Simplicity** | Is this the simplest structure that meets the intent? No speculative abstraction? | Smallest correct solution? No dead/‑over-engineered layers? |
| **Readability** | Clear boundaries, names, and flow in the plan? | Names/idioms match the target stack; a new reader can follow it? |
| **Maintainability** | Explicit, self-contained units; low coupling? | No hidden global state; changeable without reading everything? |
| **Testability** | Are the seams testable (DI, no hidden side effects)? | Are units actually unit-testable as written? |

## Verdict + wiring

- The judge returns `PASS` / `REVISE` / `BLOCK` per `skills/shared/judge.md`, reading only the
  artifact (design doc, then generated diff) + this rubric + ground truth — never the generator's
  reasoning.
- **Design gate:** run before any code is generated for a cluster. `REVISE` → refine the design and
  re-judge (bounded); do not generate against a failing design.
- **Implementation gate:** run on the generated cluster diff. `REVISE` → regenerate the flagged units;
  `BLOCK` → stop and surface.
- A non-trivial design choice in generated code must carry a `// DECISION:` options-considered comment
  (project-rules.md) — its absence on a non-obvious choice is a Readability/Maintainability `REVISE`.

## Rules

- ALWAYS gate Design-Quality at BOTH design and implementation — never only one.
- The judge verifies in the **generated code**, not the generator's claims — no self-attestation.
- Record each design-quality verdict in the ledger (`judge_verdicts`) via `checkpoint-ledger.cjs`.
- Design-Quality composes with BAL: a cluster must clear **both** its BAL gate and its design-quality
  gate to merge/complete.
