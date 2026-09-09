# Rewrite — BYO-Design Intake (AC-F4)

> Loaded by `skills/rewrite/SKILL.md` Step 2 when the developer supplies their own target design
> instead of choosing a generated option. Design of record: `docs/plans/migrationSkill/rewrite.md` T2.

## The escape hatch — same scrutiny, no free pass

A developer may bring their own target design — an architecture **image/diagram** or a **design doc** —
rather than pick from the generated options. This is supported, but the BYO design is held to the
**same critic scrutiny** as a generated option. It is never silently accepted just because a human
authored it.

## Intake steps

1. **Ingest** the design (parse the diagram / read the doc) into the same shape as a generated option:
   target stack, architecture, platform/topology, and the implied cluster boundaries.
2. **Assess** it on the same three axes — assurance ceiling × effort × TCO (`options-and-tco.md`).
3. **Judge** it with the shared LLM-as-judge (`skills/shared/judge.md`) against the option rubric
   (feasibility, design-quality, does it meet the intent). Verdict `PASS` / `REVISE` / `BLOCK`.
   - `REVISE` → surface the gaps; the design is not accepted until addressed.
   - `BLOCK` → a hard problem (e.g. an architecture that cannot meet a B-series requirement).

## Rules

- ALWAYS run the same critic scrutiny on a BYO design as on generated options — a human author is not
  evidence of soundness.
- ALWAYS surface the BYO design's assurance ceiling (e.g. no runnable oracle → BAL C/D) before commit.
- NEVER let a BYO design smuggle in an unassessed architecture or platform — assess both explicitly.
- Record the accepted design + its judge verdict in the shared ledger `payload.rewrite`.
