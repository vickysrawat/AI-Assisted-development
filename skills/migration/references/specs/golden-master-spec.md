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
- If the tool cannot self-run the source: capture against a developer-provided **running instance URL**
  (Step 1, mode `provided-url`) — the strongest available oracle. Only when neither self-run nor a
  reachable URL is available: DEGRADE to inferred characterization tests and LOG that no external oracle
  was captured — never claim behavioral parity silently.

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

## Step 1 — Is a source oracle reachable?

> **Can't self-run ≠ no oracle.** A *running* source is the strongest oracle. If the tool cannot launch
> the source itself but the source is **reachable at a developer-provided URL** (a dev/test instance the
> developer has running — common for WCF/IIS/Windows-auth services the AI can't start), capture from
> that. SKIP (inferred-only parity) is a **last resort**, valid only when neither self-run nor a
> reachable URL is available.

Confirm whether the source builds and starts, whether seed/test data exists, and — if the tool cannot
start it — whether the developer can point at an already-running instance.

Decision (ordered strongest-first — take the first that applies):
1. **Source self-runnable by the tool + has seed/test data** → full golden-master capture (Step 2).
2. **Source self-runnable, no data** → capture a smoke subset from whatever endpoints respond; coverage
   `PARTIAL`.
3. **Source NOT self-runnable, but reachable at a provided base URL** → ask the developer for the
   source base URL, **probe reachability**, and capture against it (Step 2). Coverage `FULL` if its
   datastore has data, else `PARTIAL` (smoke). This is **preferred over SKIP**.
   ```bash
   # Reachability probe — a health/any endpoint on the provided instance (dev/test only)
   curl -sf --max-time 5 "{SOURCE_BASE_URL}/{health-or-any-known-endpoint}" >/dev/null \
     && echo "✅ source reachable @ {SOURCE_BASE_URL}" \
     || echo "❌ not reachable — fall through to SKIP"
   ```
   **Dev/test instance only.** If the URL is not `localhost`/loopback or contains `prod`, warn loudly
   and require explicit confirmation before capturing (real responses carry real PII — masking rules in
   Step 2 apply).
4. **Neither self-runnable nor a reachable URL** → **SKIP** capture (last resort); emit and record in
   the report:
   `⚠ No external oracle captured — behavioral parity is INFERRED only (characterization tests).`
   **When SKIPPED, the Stage 6 mechanical as-built audit becomes the REQUIRED compensating control**
   (`specs/asbuilt-reconciliation-spec.md`) — a SKIPPED golden-master otherwise leaves NO structural
   net. **External integrations are the highest-risk unverified set** in this case (transport type is
   invisible at the I/O boundary even when GM runs) — they must be ground-truth-verified at Stage 0.6
   (`specs/integration-verification-spec.md`) and covered by the Stage 6 manual gate before
   `MIGRATION COMPLETE`.

Record the decision in the checkpoint (merge, do not overwrite existing fields) as
`decision_log.golden_master = { mode: "self-run" | "provided-url" | "skipped", source_base_url,
auth_scheme, reachable, coverage }`. **NEVER store credentials or tokens** — persist the auth *scheme*
only (the secret lives in an env var / interactive input, never on disk).

## Step 2 — Record from SOURCE

**Capture target.** For `mode = self-run`, launch the source locally and record against it (as before).
For **`mode = provided-url`**, the harness targets `decision_log.golden_master.source_base_url`
directly — **no build/start**; the Step-1 reachability probe stands in for the health check. Everything
downstream (recordings, normalization, `feature_id` linkage) is identical — only the HTTP base changes.

**Source authentication (multi-scheme).** Acquire auth for the SOURCE per the scheme detected in the
Stage 0 auth/integration analysis (this mirrors the target-side token acquisition at Stage 6.2, but for
the source). **Credentials come from env vars / an interactive prompt ONLY — never persisted** to the
checkpoint or fixtures; only the *scheme* is recorded.
```bash
# Bearer / JWT
curl -sf -H "Authorization: Bearer $SRC_TOKEN" "$SRC_URL/api/..."
# API key header
curl -sf -H "X-Api-Key: $SRC_API_KEY" "$SRC_URL/api/..."
# Session cookie (login once, reuse the jar; jar is a temp file, git-ignored, deleted after capture)
curl -sf -c /tmp/gm-cookies.txt -d "$SRC_LOGIN_BODY" "$SRC_URL/login" && \
curl -sf -b /tmp/gm-cookies.txt "$SRC_URL/api/..."
# NTLM / Windows-auth (classic internal WCF/IIS services)
curl -sf --ntlm -u "$SRC_USER:$SRC_PASS" "$SRC_URL/api/..."
```
Mask every credential/PII value in the persisted fixture (the normalization rules below already require
this); a live source returns real data, so masking is mandatory, not optional.

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
- Oracle basis: `self-run` | `captured from running source @ {source_base_url}` | `SKIPPED (inferred)`
  (from `decision_log.golden_master.mode`).
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
with a recorded reason, is required to proceed to the completion banner. **If GM was SKIPPED**, the
Stage 6 as-built reconciliation (`stage_gates.asbuilt_reconciled`) must have run and passed as the
compensating control before the completion banner — it is not optional in that case.

---

## Hard rules

- NEVER claim behavioral parity without a captured oracle — say "INFERRED" if none was captured.
- Capture from a REACHABLE running source (provided URL) before falling back to SKIP/inferred parity —
  can't-self-run ≠ no oracle. SKIP is a last resort (neither self-run nor a reachable URL).
- NEVER persist source credentials/tokens — env var / interactive only; record the auth *scheme* only.
  Capture only against a dev/test instance; a prod-looking URL requires explicit confirmation.
- The oracle is recorded from SOURCE, replayed against TARGET — never the reverse.
- Normalizations are part of the contract — show them in the report.
- Replay execution is 100% OS process (script), zero LLM tokens during the run.
- Each recording carries the inventory `feature_id`/`gap_id` it verifies — capture ↔ inventory stay 1:1.
- NEVER normalize away an outcome the inventory asserts verbatim (status code / error string / threshold).
- Verification results live in the golden-master REPORT (keyed by `feature_id`); the approved inventory is IMMUTABLE — at most APPEND a "Stage 5.0 verification" note to its §13 Review Log, never rewrite §5/§11.
