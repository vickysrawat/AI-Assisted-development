# Inventory Scoring Rubric — Stage 0.6 validation (session-driven)

_The LLM-judged half of inventory scoring. Runs INSIDE a Claude Code session — the session
orchestrates; a scoring **subagent** is the judge. There is deliberately NO API-calling script here
(see MEMORY 2026-08-26): a standalone script re-calling the model would be redundant when an LLM is
already in the loop. The deterministic half is `verify-inventory-trace.cjs`._

## Two axes
1. **Deterministic (script):** `node verify-inventory-trace.cjs --inventory <inv> --source <src> [--feasibility <f>] [--recordings <dir>]`
   → citation resolution, parse-coverage, spine integrity. This IS the citation-precision signal:
   a "hallucinated citation" = a hard failure here.
2. **LLM-judged (subagent):** recall, tier-correctness, verbatim fidelity, gap-flagging, trap-handling.
   The session spawns a scoring subagent with the rubric below.

## Procedure (orchestrator = the session)
1. Run the deterministic verifier. If it reports hard failures, record them — citations are unreliable.
2. Spawn a **fresh** scoring subagent (Agent tool) **N times** (default N=3) with the rubric prompt
   below + the answer key + the candidate inventory. Fresh each run and blind of any prior scorecard
   (no teach-to-the-test). N runs give a distribution over judge variance for a fixed inventory.
3. Aggregate: median recall %, median tier ratio, and pass-rate for gap-flag / verbatim / traps.
4. Verdict — PASS when: deterministic verifier passes AND median recall ≥ 90% AND median tier ratio
   ≥ 80% AND no hallucinations in any run AND gap-flag & verbatim pass in a majority of runs.
   (Thresholds are guidance, not gospel — tune per fixture; record the numbers, don't hide them.)

## Rubric prompt (hand this verbatim to the scoring subagent)
> You are a rigorous, skeptical grader. Compare a reverse-engineered behavioral inventory (CANDIDATE)
> against a known ground-truth answer key (TRUTH). You may open the SOURCE to adjudicate disputes.
>
> Tier mapping: has-test ↔ OBSERVED · structural ↔ STATIC · logic-only ↔ INFERRED · ambiguous ↔
> should be a §11 GAP (not asserted). Cut-line: an element being PRESENT is STATIC; its
> DECISION / OUTCOME / VALUES is INFERRED (or OBSERVED if a passing test covers it).
>
> Grade five axes and return ONLY a JSON object, no prose:
> `{"recall_pct": <0-100>, "missed": [<truth ids>], "tier_matches": <int>, "tier_total": <int>,`
> `"over_claims": [<truth ids tiered too-confidently>], "hallucinations": [<asserted-but-false>],`
> `"traps_ok": <bool — did it avoid asserting the TRAPS as real behaviour>,`
> `"gap_flag_pass": <bool — did the ambiguous behaviour land as a GAP>,`
> `"verbatim_pass": <bool — exact status codes / messages / thresholds>}`
>
> Be skeptical: an "extra" finding is only a hallucination if the SOURCE does not support it (a real
> behaviour the answer key simply didn't enumerate is NOT a hallucination). Flag over-claims (a
> lower-confidence truth tiered higher) specially — those understate needed verification.

## Notes
- Blindness: the author, the extractor, and the scorer must be **different** subagents/sessions.
- Precision has two parts: citation-precision (deterministic verifier) + semantic-precision
  (`hallucinations` from the judge). Report both.
- Headless CI (no session) is the only place a raw-API scorer belongs — that's the `runner.js` /
  `migration.yaml` lane (Approach 4), not this rubric.
