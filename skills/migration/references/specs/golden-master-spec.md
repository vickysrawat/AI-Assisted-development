# Spec: Golden-Master Behavioral Verification

_Loaded by migration SKILL.md at Stage 5.0 (before characterization tests). Defines how to
capture an EXTERNAL behavioral oracle from the running SOURCE app and replay it against the
TARGET. This is what upgrades "compiles + unit tests pass" to "behaves identically."_

---

## Why

The single largest migration risk is silent behavioral drift. Unit and characterization tests
written by the same agent that did the migration share its blind spots. A golden master is an
INDEPENDENT oracle: recorded from the real source, replayed against the target, diffed.

Applicability:
- HTTP APIs (any source/target): record request→response pairs. STRONGEST signal.
- Pure functions / batch jobs: record input→output fixtures.
- If the source cannot be run (no build, no data): DEGRADE to inferred characterization tests
  and LOG that no external oracle was captured — never claim behavioral parity silently.

The migration posture (Stage 0.5) selects the oracle basis:
- port / re-architecture → oracle is the running SOURCE app (this spec, full flow).
- rewrite-from-spec → oracle is the **Stage 0.6 Source Behavioral Inventory**; still capture source
  I/O where the source runs, but drift is judged against the inventory's stated (Given/When/Then)
  behaviour, not source quirks.

**Capture ↔ inventory alignment (the through-line):** each recording is the *executable form* of a
Stage 0.6 inventory behaviour — the request encodes its **When**, the recorded response encodes its
**Then** (verbatim). Every recording carries the inventory `feature_id` (or `gap_id`) it verifies, so
match/drift maps straight back to a specific inventory item; results are recorded in the golden-master
report (the approved inventory itself stays immutable — see Step 4).

---

## Step 1 — Can the source run?

Confirm the source builds and starts, and whether seed/test data exists.

Decision:
- Source runs + has seed/test data → full golden-master capture (Step 2).
- Source runs, no data → capture a smoke subset from whatever endpoints respond; mark coverage
  PARTIAL.
- Source does NOT run → SKIP capture; emit and record in the report:
  `⚠ No external oracle captured — behavioral parity is INFERRED only (characterization tests).`

Record the decision and the reason in the checkpoint `decision_log` (do not overwrite existing
fields — merge).

## Step 2 — Record from SOURCE

**Worklist — drive from the Stage 0.6 inventory, in priority order:** (1) INFERRED behaviours marked
`GM-verifiable` — reproducing them promotes INFERRED→OBSERVED; (2) HIGH-risk / RED items; (3) gaps
tagged `run the source` in the inventory Gaps Report (§11) — reproducing resolves the gap; (4) the
remaining GM-verifiable OBSERVED/STATIC behaviours for regression coverage. Prefer an existing
integration-test corpus or request log; otherwise synthesise representative requests per behaviour
and **cover the happy path AND its error/edge paths** (the inventory's G/W/T already lists them).
Record each to `tests/golden-master/recordings/`:

```json
{
  "id": "GET_users_1",
  "feature_id": "F-03",
  "verifies_gwt": "Given user 1 exists / When GET /api/users/1 / Then 200 + {id,name,email}",
  "request":  { "method": "GET", "path": "/api/users/1", "headers": {}, "body": null },
  "response": { "status": 200, "body_normalized": {} },
  "captured_from": "source",
  "normalizations": ["strip: Date header", "sort: array by id", "mask: token fields"]
}
```

Normalization rules — agree BEFORE recording; they define what "same" means:
- Strip non-deterministic fields: timestamps, generated IDs, correlation IDs, server headers.
- Canonicalize: sort unordered collections; round floats to an agreed precision.
- Mask secrets/PII in the fixture (never persist a real token or PII value).
- **Never normalize away an ASSERTED outcome.** If the inventory G/W/T asserts an exact status code,
  error string, or threshold, that value IS the assertion — normalize only the non-deterministic
  envelope around it, never the asserted outcome itself.
- **Asserted value with a dynamic/PII sub-part:** assert the STABLE shape/prefix and mask or normalize
  only the variable slice inside it — e.g. `404 "user {…} not found"` asserts the shape while masking
  the echoed email. Record which slice was masked. Never mask the whole asserted outcome to dodge a diff.

Record every normalization in the fixture so a reviewer can see exactly what was ignored.
Unexplained normalization hides drift.

## Step 3 — Replay against TARGET

After the target build passes (Stage 6.1), start the target, replay each recording against it,
and diff the normalized response:

```json
{
  "id": "GET_users_1",
  "feature_id": "F-03",
  "verdict": "match | drift | error",
  "asserts": "200 + {id,name,email}",
  "diff": "response.body.email: source='a@b.com' target=null",
  "risk_tie": "feasibility YELLOW #4 (email projection)"
}
```

Replay is a deterministic harness (script), not LLM inference — the LLM writes the harness and
reads the summary, exactly like the Playwright flow.

## Step 4 — Report + gate

Write `docs/.../ADO-{ADO_ID}-golden-master-report.md`:
- Coverage: N recordings / M source behaviours (FULL | PARTIAL | NONE), each mapped to a `feature_id`.
- Verdicts: match / drift / error counts.
- Every `drift`/`error` MUST link to its inventory `feature_id`/`gap_id` and a feasibility RED/YELLOW
  item (or be raised as a NEW finding added to the feasibility doc).

**Record results in the report — do NOT rewrite the approved inventory.** The Stage 0.6 inventory is a
human-signed baseline (with a recorded source SHA); it stays immutable after `APPROVE INVENTORY`.
Keyed by `feature_id`/`gap_id`, record in the golden-master report:
- a reproduced INFERRED behaviour → **verified OBSERVED @ Stage 5.0**;
- a reproduced `run-the-source` gap → **gap resolved**;
- a drift against an asserted (verbatim) outcome → the drift + its `feature_id`.
Then APPEND a single **"Stage 5.0 verification results"** block to the inventory's §13 Review Log
(GM-verified / gap-resolved / drifted item IDs) — the only post-approval addition; NEVER edit §5
confidence or §11 in place. Human-verify-only items (`GM-verifiable = no` — internal rules with no
observable output) are OUT of golden-master scope; never mark them verified here.

Gate: any `drift` on a HIGH-risk item (or any `error`) → STOP, report to the developer, and do
NOT mark the migration COMPLETE. `match` on all HIGH/MEDIUM items, or explicitly accepted drift
with a recorded reason, is required to proceed to the completion banner.

---

## Hard rules

- NEVER claim behavioral parity without a captured oracle — say "INFERRED" if none was captured.
- The oracle is recorded from SOURCE, replayed against TARGET — never the reverse.
- Normalizations are part of the contract — show them in the report.
- Replay execution is 100% OS process (script), zero LLM tokens during the run.
- Each recording carries the inventory `feature_id`/`gap_id` it verifies — capture ↔ inventory stay 1:1.
- NEVER normalize away an outcome the inventory asserts verbatim (status code / error string / threshold).
- Verification results live in the golden-master REPORT (keyed by `feature_id`); the approved inventory is IMMUTABLE — at most APPEND a "Stage 5.0 verification" note to its §13 Review Log, never rewrite §5/§11.
