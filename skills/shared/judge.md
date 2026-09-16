# Shared LLM-as-Judge Layer (migration family)

_Spec version: 1.0 · Last changed: 2026-09-08 · Applies to: upgrade, rewrite, replatform_

> The canonical LLM-as-judge for the migration family. Extracted from Story-1's inline
> `skills/upgrade/references/judge-inline.md` at the second consumer (Rewrite — rule-of-three).
> Design of record: `docs/plans/migrationSkill/README.md` "LLM-as-judge layer".

## Purpose

A migration skill both authors artifacts (reports, designs, generated code) and remediates them. A
same-context self-review rubber-stamps its own work. The judge is an **independent check** at each
gate: it sees only the **artifact + rubric + ground truth**, never the generator's reasoning, and it
is **adversarial by default** — it tries to *refute*, defaulting to skeptical when uncertain.

## Independence at two levels

1. **Separate agent** — the judge reads only the artifact + rubric + ground truth (test/oracle
   result, cached VERIFIED facts, the ICEA/spec). NOT the author's chain of thought.
2. **Separate model** — routed to a different model from the author so failure modes differ, not just
   the context. See the three-tier ladder in `model-routing-spec.md`.

## Per-gate verdict grammar

| Verdict | Meaning | Effect |
|---|---|---|
| `PASS` | artifact meets the rubric; claims trace to ground truth | proceed to the next gate |
| `REVISE` | fixable gaps — unproven claim, missing coverage, weak source, rubric miss | regenerate + re-judge (bounded) |
| `BLOCK` | a hard problem — fabricated fact, edit without a passing verify, B-series below floor, merge on a failing gate | STOP; surface to the developer |

## Risk-scaled routing (friction proportional to risk)

Judge depth AND judge capability scale with the gate's risk:

| Gate risk | Creator | Judge |
|---|---|---|
| Low / routine | `ICEA_MODEL` | `CRITIC_MODEL` |
| High-risk / B-series | `ICEA_MODEL` | `CRITIC_MODEL_MAX` (strongest available @ max effort) |
| Top-risk / B-series | — | + different-family **panel** {`CRITIC_MODEL_MAX` + a different model}, agree-or-escalate |

Effort buys *thoroughness*; a different model buys *diverse blind spots* — they compose.

## Session-level meta-judge

Beyond per-gate verdicts, a session-level meta-judge runs at end-of-run: **cross-stage consistency**
(do the gate verdicts + payloads agree?) and a **completeness critic** (what was claimed but never
verified? which modality/oracle never ran?). Its findings become the next round of work.

## Rules

- The judge NEVER writes code/artifacts and NEVER issues `APPROVE` — it only returns a verdict.
- Default to `REVISE`/`BLOCK` when evidence is missing — an unproven claim is not a `PASS`.
- Record every verdict in the ledger (`judge_verdicts` / `stage_gates`) via `checkpoint-ledger.cjs`.

## Per-skill gate rubrics

Each skill supplies its own gate list + rubric essentials; this layer supplies the mechanism:
- **Shared (all three)** — source-context **intake gate**: unwired-candidate confirmation +
  cross-cutting **completeness** (a concern class present in source but absent from the manifest scan →
  REVISE; a **security** concern — authN/authZ, secrets — present but unaddressed → BLOCK). Rubric:
  `migration-knowledge/refs/specs/source-context-intake-spec.md` § Judge rubric — intake gate.
- **Upgrade** — report gate (VERIFIED/INFERRED integrity), residual gate (scoped diff), verify gate (all hops pass before merge).
- **Rewrite** — design-quality gate (design + impl), BAL merge gate (provisional ≠ D), completion gate (final BAL; B-series hard-block).
- **Replatform** — NFR/Well-Architected gate; human-executed runbook PASS/FAIL gates.
