# Rewrite — Behavioral Assurance Level (BAL) (AC-F5)

> Loaded by `skills/rewrite/SKILL.md`. The computation is deterministic in `scripts/rewrite-bal.cjs`;
> this reference is the definitions + rules. Design of record: `docs/plans/migrationSkill/rewrite.md`
> T3. BAL answers *"how confident are we the target behaves like the source?"* — per cluster, measured,
> never assumed.

## Grades

| BAL | Meaning |
|---|---|
| **A** | Runnable oracle + near-complete behavioral coverage verified against it (golden-master). |
| **B** | Runnable oracle + good coverage; a bounded set of behaviors unverified. |
| **C** | No runnable oracle (spec/inventory-only) OR low coverage — behavior not actually observed end-to-end. |
| **D** | Essentially unverified — no oracle and no meaningful coverage. |

## Weakest-link rule

A cluster's BAL is the **weakest** of its assurance dimensions — you cannot average a strong dimension
against a weak one. Dimensions:
- **oracle ceiling** — a **runnable** oracle can reach A; **no runnable oracle caps the cluster at C**.
- **coverage** — `behaviors_verified / behaviors_total` (mechanical), banded A≥0.9 · B≥0.7 · C≥0.4 · D<0.4.
- **tests** (optional) — `tests_passing / tests_total`, same bands.

`BAL = min(oracle_ceiling, coverage, tests)`. Example: runnable oracle + 7/10 verified → **B** (coverage
is the weakest link). No oracle + 10/10 → **C** (oracle ceiling wins).

## Mechanical denominators — no talking it up

Every grade is derived from **actual counts** with the denominator surfaced (`8/10 = 0.80 → B`), so BAL
is auditable and cannot be inflated by judgment. `rewrite-bal.cjs bal` prints each dimension's counts.

## Staged lifecycle

BAL is captured early and tightened as evidence arrives — the value never appears from nowhere at the end:
1. **Ceiling** — at options time, the *best achievable* BAL is stated (e.g. no oracle → C). Shown BEFORE commit.
2. **Provisional** — after generation, before merge, from partial coverage.
3. **Measured** — after the cluster's tests + golden-master run.
4. **Validated** — at completion, final BAL recorded in the ledger.

## The two gates (friction proportional to risk)

- **Merge gate** — provisional BAL must be **≠ D**. A D cluster cannot merge; raise assurance or re-scope
  (`rewrite-bal.cjs merge-gate`, exit 12 on block).
- **Completion gate** — final BAL vs a floor. A **B-series** cluster below floor is a **hard block** —
  a named approver + written reason are required; **no silent pass** (`rewrite-bal.cjs completion-gate`,
  exit 13). A non-B-series cluster below floor is a warn (allowed with an explicit note).

Hybrid rule: gate friction scales with risk — B-series/regulated clusters get the hard gate; routine
clusters get the lighter one. Record every BAL + gate verdict in the ledger (`payload.rewrite.BAL`).
