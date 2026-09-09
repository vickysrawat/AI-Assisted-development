# NFR Assurance — measurability-ceilinged grading (AC-F8)
_Reference · skills/replatform · ADO-9000 Story 3_

Replatform's "done" is proven, not asserted. NFR assurance is graded like BAL: **weakest-link** across
mechanical dimensions, with a **measurability ceiling**. Computed by `scripts/replatform-nfr-assess.cjs`.

## Assurance lattice
`measured (4) > drilled-partial (3) > projected (2) > modeled-only (1)`

## Dimensions (weakest-link)
1. **measurability-ceiling** — from the NFR's tag: `testable`/`auditable` → can reach *measured*;
   `projected` (or absent) → capped at *projected*.
2. **evidence** — what was actually done: `measured` / `drilled-partial` / `projected` / `modeled-only`.
3. **load-profile** — the oracle analog: `real` → measured · `synthetic` → drilled-partial · `none` → modeled-only.

Assurance = the **weakest** of the three. No averaging, no judgment grade (symmetric to BAL).

## Honest report
Report measured-vs-projected explicitly. When `ceiling_flagged` (measurability = projected OR
load-profile ≠ real), **state the ceiling** — never present a capped result as fully measured.

## The "done" gate
```bash
node "$PLUGIN_DIR/scripts/replatform-nfr-assess.cjs" gate --assurance=<> --floor=<> --regulated=<true|false> --json
```
- **regulated** NFR below floor → **HARD BLOCK** (exit 16; named approver + written reason; no silent pass).
- non-regulated below floor → **warn** (explicit note).
- meets floor → **pass**.

## Staged (shift-left)
projected@design → measured@post-deploy → validated. Cost is **provisional until steady-state**.

## Composes with
- Well-Architected grade → `references/well-architected.md`
- Behavioral regression (secondary) → reuse the golden-master (pre-move → post-move smoke).
