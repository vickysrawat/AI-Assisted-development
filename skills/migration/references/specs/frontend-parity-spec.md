# Spec: Frontend-Parity Verification (two-tier)

_Loaded by migration SKILL.md at Stage 5.4 (frontend runs only), the frontend sibling of the API
golden-master (Stage 5.0). Golden-master stops at the HTTP boundary; this spec covers UI / navigation
/ validation parity. It has two tiers: a **Tier-1 manual parity session** that always runs (no source
dependency) and a **Tier-2 advisory automated oracle** that runs when the source frontend can be
driven live._

---

## Why (and how it differs from golden-master)

The largest frontend migration risk is silent UI/navigation behavioral drift. The generated E2E
(Steps 5.3/6.2) is characterization written from *target-side* knowledge — it verifies what the target
is *supposed* to do, not what the source *actually* did, so it shares the migrator's blind spots.
This spec adds a **source-anchored** parity check keyed to the Stage 0.6 feature-ID spine.

Three deliberate divergences from `golden-master-spec.md`, each forced by the frontend's nature:

1. **Two layers, not one.** The API oracle records the whole response body (a *discovery* oracle). A
   hand-authored assertion set is only a *confirmation* oracle — it inherits the inventory's blind
   spots. So the automated tier captures BOTH a **discovery layer** (a normalized ARIA / accessibility
   snapshot — the whole accessible surface) AND an **assertion layer** (the feature-ID's verbatim
   observable outcome). Discovery catches regressions no one wrote an assertion for.
2. **Advisory, not a hard gate.** HTTP replay is byte-deterministic, so golden-master hard-gates
   completion. Frontend drift is irreducibly noisy (animation, virtualized lists, async ordering); a
   hard gate on that signal would false-block good migrations. Drift here is **reported and
   human-dispositioned**, never an auto-block.
3. **Semantic projection only — NEVER DOM or pixels.** An Angular source and a React target emit
   intentionally different markup, and a migration legitimately restyles. Diffing DOM or screenshots
   would flag the *intended* change as failure. Compare only: **ARIA snapshot · URL after navigation ·
   visible text · outbound network calls · validation messages.**

**Applicability:** `mode.track = frontend` only. Backend/upgrade runs skip this entirely (their parity
is golden-master Stage 5.0).

**Capture ↔ inventory alignment:** each recording/checklist row is the executable form of a Stage 0.6
UI behaviour — the journey encodes its **When**, the observed projection encodes its **Then**
(verbatim). Every item carries the inventory `feature_id`/`gap_id` it verifies; results are recorded
in the frontend-parity report and appended to the inventory §13 Review Log (the approved inventory
stays immutable — see Tier 2, Step 4).

---

## Tier 1 — Structured manual parity session (ALWAYS runs; no source dependency)

This is the primary, always-available parity guarantee. It needs no runnable source — the developer
verifies the TARGET against the inventory's stated outcomes (and cross-checks the source if it runs).

**Row source:** every Stage 0.6 inventory feature-ID whose Layers include UI **and** is either
`GM-verifiable = yes` or high-risk, PLUS every `mappings/angular-react.md` **RED** behavioral-risk
item (auto-tracking vs. manual deps, Zone.js re-render model, two-way binding, complex RxJS
orchestration) — the paradigm-shift areas where silent frontend drift hides.

**Generate `## Frontend Parity Session — ADO-{ADO_ID}` grouped by cluster:**
```
### Cluster: {ClusterName}
  [ ] F-07 reject empty order name
        expected: stay on /orders/new; show "Name is required"   (verbatim, from the inventory G/W/T)
        check:    target — submit empty form; {source — same, if runnable}
        result:   PASS | DRIFT: {note} | BLOCKED: {reason}
  [ ] F-19 sign-in redirect  (HIGH — RED: guard→loader paradigm shift)
        expected: navigate to /dashboard; greet user; nav shows Orders/Invoices/Admin
        check:    target — sign in; {source — same, if runnable}
        result:   PASS | DRIFT | BLOCKED
```

**Disposition = the human gate.** Every high-risk / must-preserve feature-ID must be `PASS` or
`DRIFT-accepted: {reason}` before the Stage 6 completion banner. Items left unmarked BLOCK completion.
This is the honest gate — a human dispositioning a checklist — deliberately in place of an automated
gate on a noisy signal. Any Tier-2 drift (below) is injected here as a mandatory row.

---

## Tier 2 — Advisory automated oracle (OPPORTUNISTIC; only when the source runs live)

Mirrors golden-master's four steps. The live capture/replay is a per-migration Playwright harness the
LLM writes; execution is 100% script, zero LLM tokens during the run.

### Step 1 — Can the source frontend run (with a backend)?

A frontend is meaningless without a backend (it renders error states everywhere). Confirm the source
frontend builds/serves AND has a backend to talk to (the source's own, a recorded/stubbed one, or —
only if contract-compatible — the migrated backend).

- Source frontend + backend run → full capture (Step 2).
- Runs but no seed data / partial backend → capture the reachable subset; mark coverage PARTIAL.
- Source cannot be driven live → **SKIP Tier 2**; record
  `⚠ No frontend oracle — parity is manual/INFERRED only (Tier 1)` in the report and the checkpoint
  `decision_log` (merge, don't overwrite). Never claim UI parity silently. Tier 1 still runs.

### Step 2 — Record from SOURCE via Playwright

Worklist priority (same spirit as golden-master): (1) INFERRED UI behaviours marked `GM-verifiable`
(reproducing promotes INFERRED→OBSERVED in the *report*); (2) HIGH-risk / RED items; (3) `run the
source` gaps; (4) remaining GM-verifiable OBSERVED/STATIC for regression. Cover happy AND error/edge
paths (empty/invalid input, missing auth, not-found).

**Drive with role/text locators** (`getByRole`, `getByText`, `getByLabel`) — framework-agnostic and
usually valid on both source and target. Where the migration legitimately changed copy/structure,
record a per-journey **source↔target locator map** so the same journey binds on both.

For each feature-ID journey capture BOTH layers into one observed projection and record to
`tests/frontend-parity/recordings/` keyed by `feature_id`:
```json
{
  "id": "login_redirect",
  "feature_id": "F-19",
  "risk": "HIGH",
  "tier": "INFERRED",
  "verifies_gwt": "Given valid creds / When sign in / Then /dashboard + greeting + nav Orders|Invoices|Admin",
  "journey": { "description": "sign in then land on dashboard",
               "locators": ["getByLabel('Email')","getByLabel('Password')","getByRole('button',{name:'Sign in'})"] },
  "observed_normalized": {
    "url": "/dashboard",
    "text": ["Welcome, <user>"],
    "aria": ["banner", "nav: Orders | Invoices | Admin", "heading: Dashboard"],
    "network": ["POST /api/auth/login", "GET /api/me"]
  },
  "normalizations": ["strip:toast"]
}
```
- `aria` = the **discovery layer** (normalized ARIA snapshot / accessible tree of the region).
- `url` / `text` / `network` = the **assertion layer** (verbatim observable outcomes).
- `observed_normalized` is the projection AFTER normalizations were applied at capture.

**Normalization rules — agree BEFORE recording (they define "same"):**
- Strip volatile fields: toasts with timestamps, generated IDs, correlation IDs.
- Mask the dynamic slice of an asserted string, keeping its stable shape (`"Welcome, <user>"`), exactly
  like golden-master's dynamic-sub-part rule. Never mask away the asserted outcome itself.
- **Ignore pure styling / layout / class names** — a migration restyles legitimately; that is not drift.
- **Never normalize away an outcome the inventory asserts verbatim** (a validation message, a target
  URL, a required network call).
Record every normalization in the fixture so a reviewer sees exactly what was ignored.

### Step 3 — Replay against TARGET (after the Stage 6.1 build)

Start the target (profile `SERVE`), run each journey with the same (or mapped) locators, capture its
observed projection to `tests/frontend-parity/target/`, apply the recording's normalizations, and diff
per `feature_id` → `match | drift | error`. A drift in `aria` is a **discovery** catch; a drift in
`url`/`text`/`network` is an **assertion** catch. Replay is a deterministic script (the LLM writes it,
reads the summary) — no LLM during the run.

### Step 4 — Report (ADVISORY) + disposition

Write `docs/.../ADO-{ADO_ID}-frontend-parity-report.md`:
- Coverage: N journeys / M GM-verifiable UI behaviours (FULL | PARTIAL | NONE/manual-only), each mapped
  to a `feature_id`.
- Verdicts: match / drift (aria=discovery vs. assertion) / error counts.
- Every `drift`/`error` links to its `feature_id` + a feasibility RED/YELLOW (or is raised as a NEW
  finding), AND is injected as a mandatory row into the **Tier-1 disposition**.

**ADVISORY — drift does NOT auto-block COMPLETE.** Unlike golden-master, a HIGH-risk frontend drift
does not hard-stop the migration; it becomes a required human disposition in Tier 1 (`DRIFT-accepted`
with a reason, or fixed). This is because the signal is noisy — a false hard-block is worse than a
dispositioned advisory.

**Immutability (identical to golden-master):** record results in the REPORT, keyed by `feature_id`.
Never rewrite the approved inventory. At most APPEND a single "Stage 5.4 frontend-parity results" block
to the inventory §13 Review Log (verified / drifted item IDs) — never edit §5 confidence or §11 in
place. A reproduced INFERRED behaviour is noted `verified OBSERVED @ Stage 5.4` in the report only.
Human-verify-only items (`GM-verifiable = no`) are out of scope here.

**Flake control (so flake never masquerades as drift):** disable animations, fixed viewport,
network-idle waits, seeded/frozen data; run each journey N times and treat only *stable* differences
as drift. Report anything unstable as `flaky`, not `drift`.

---

## Hard rules

- Frontend parity is ADVISORY + human-dispositioned — NEVER an automated hard gate, NEVER a silent claim.
- Tier 1 (manual session) ALWAYS runs; Tier 2 (automated oracle) runs only when the source frontend +
  backend can be driven live, and degrades to `manual/INFERRED only` otherwise.
- Compare the SEMANTIC projection only — ARIA snapshot · URL · visible text · network calls ·
  validation messages. NEVER diff DOM markup or pixels/screenshots.
- The oracle is recorded from SOURCE, replayed against TARGET — never the reverse.
- Drive via role/text locators; where copy/structure changed, record a source↔target locator map.
- Normalizations are part of the contract — show them in the report; never normalize away an asserted
  verbatim outcome.
- Results live in the frontend-parity REPORT (keyed by `feature_id`); the approved inventory is
  IMMUTABLE — at most APPEND a "Stage 5.4 frontend-parity" note to its §13 Review Log.
- Applies to `mode.track = frontend` only.
