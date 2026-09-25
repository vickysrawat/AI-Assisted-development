# Spec: Golden-Master Behavioral Verification

_A **reusable behavioral-oracle capability** invoked by any migration-family skill
(**Upgrade · Rewrite · Replatform**) at its behavioral-verification point. Defines how to capture an
EXTERNAL behavioral oracle from the running SOURCE app and replay it against the TARGET. This is what
upgrades "compiles + unit tests pass" to "behaves identically."_

> **Developer-facing companion:** [`golden-master-runbook.md`](golden-master-runbook.md) — a
> plain-language, "you do X / the skill does Y" step-by-step for producing a golden master. This spec
> is the skill-facing contract; the runbook is the human operational guide.

---

## Who invokes this — per-skill binding

This capability has no stages of its own. Each invoking skill binds it at its own posture/mode and its
own capture/replay points:

| Skill | Oracle basis | Worklist / intent source | Pre-move capture | Post-move replay | Compensating control if skipped |
|---|---|---|---|---|---|
| **Upgrade** | pre-upgrade baseline (source self-runs) | baseline's observable surface + existing tests | at the baseline tag, before edits | verify vs baseline oracle | build + project test suite vs baseline |
| **Rewrite** | running source **or** stated intent | runnable source, else the behavioral-intent spec | at intake, before generation | per-cluster BAL | no-oracle caps BAL at C + completion gate |
| **Replatform** | running on-prem app | functional surface behind the NFR spec | at intake | behavioral-regression pass | NFR + Well-Architected assurance |

The **invoking skill** selects the oracle basis from its own posture/mode. There are two bases: a
**running source** (record its real responses) or a **stated intent** (a written behavioral spec, when
no runnable source exists). Verification results are recorded in the golden-master **report** (below),
never by rewriting a skill's approved intent baseline — if a skill keeps a signed baseline, **append,
never rewrite** it.

---

## Why

The single largest migration risk is silent behavioral drift. Unit and characterization tests written
by the same agent that did the migration share its blind spots. A golden master is an INDEPENDENT
oracle: recorded from the real source, replayed against the target, diffed.

**Scope.** This spec covers **REST/HTTP request→response APIs** and **pure-function / batch-job
input→output fixtures**. The following are **out of scope for this version** and must be excluded from
the oracle worklist with a note: GraphQL (body-based queries, mutations, introspection), gRPC /
Protocol Buffers, streaming / WebSocket / Server-Sent Events, and async/delayed batch jobs whose
results surface outside the HTTP response boundary. Treat any such surface as "excluded" in the
coverage report and rely on the invoking skill's compensating control for it.

Applicability:
- HTTP REST APIs (any source/target): record request→response pairs. STRONGEST signal.
- Pure functions / batch jobs with synchronous output: record input→output fixtures.
- If the tool cannot self-run the source: capture against a developer-provided **running instance URL**
  (Step 1, mode `provided-url`) — the strongest available oracle. If no instance is reachable but the
  source is understandable: author a **capture plan** (Step 1, mode `deferred-capture`) to record later.
  Only when none of these is possible: DEGRADE to inferred characterization tests and LOG that no
  external oracle was captured — never claim behavioral parity silently.

**Capture ↔ intent alignment (the through-line):** each recording is the *executable form* of a
behaviour the invoking skill cares about — the request encodes its **When**, the recorded response
encodes its **Then** (verbatim). Every recording carries the `feature_id` (or `gap_id`) of the intent
item it verifies, so match/drift maps straight back to a specific behaviour; results are recorded in the
golden-master report.

---

## Discovery — how the oracle knows *what* to call

A URL is not self-describing. **The questions come from the source; the answers come from the URL.**
Never infer the endpoint list from the base URL alone. Derive the worklist from these sources, in trust
order, and record where each request came from so a reviewer can see it:

1. **Existing regression suite / test bucket** — a curated, prioritized worklist QA already ranked by
   importance and past bugs. If automated (Selenium/Playwright, Postman/REST-assured/SoapUI) it is
   *executable*: re-point it at the SOURCE to record (`OBSERVED`). The **target** replay is re-authored
   at the stable layer — source UI locators do NOT transfer (see "Stable layer"). Provisioning + trust
   rules below under "Regression bucket as a seed".
2. **Source code / knowledge graph** — routes/controllers declare the *full* surface
   (`[HttpGet("api/deals/{id}")]`, `router.put('/api/deals/:id')`, Angular `http.get('/api/deals')`).
   Use to cross-check the bucket's coverage and find what it misses.
3. **API contract** — Swagger/OpenAPI, WCF WSDL, Postman collection, integration tests, request logs.
4. **Existing unit tests** — a lower-layer seed (see "Unit tests as a seed"): pure-function input→output
   fixtures + edge-case/business-rule discovery.
5. **The running UI** — drive it and observe the network calls it fires (feeds the UI-smoke mode).
6. **Ask the developer** — last resort for undocumented surface.

---

## Data — a list→detail crawl, not a flat call list

Data-dependent endpoints (`GET /api/deals/{id}`) can't be called cold — you don't know a valid id.
Follow the data the way the UI does:

1. **List first** — call the collection endpoint (`GET /api/deals`); the response is both a recording
   **and** the source of **real IDs** that exist on the instance.
2. **Drill in** — take real IDs from the list and record the detail / edit-load calls
   (`GET /api/deals/{id}`) for a representative few (a normal record + any edge the list reveals).
3. **Seed when empty** — if the instance has no data, seed it from the regression bucket's
   fixtures / setup scripts / test accounts (known IDs, repeatable), or failing that create disposable
   records via the app's own create flow ("Mutation safety" below). Never guess IDs.

Coverage is stamped `FULL` / `PARTIAL` by how much of the discovered surface the available data reaches.

---

## Capture modes + the stable-layer principle

**Stable-layer principle.** A migration changes element IDs, CSS, component trees, and often routes.
Golden master therefore diffs at the **most stable, implementation-independent layer available**:

> **API response (selector-free — the backbone) › semantic UI state (via a per-side locator map) ›
> raw DOM / selectors / pixels (NEVER diff here — this is what breaks).**

| Mode | Captures | How | Role |
|---|---|---|---|
| **API-level** (backbone) | request → response | discovery + list→detail crawl; record HTTP; deterministic, selector-free replay | precise behavioral diff; the primary oracle |
| **UI-level** (smoke) | (a) the **network calls** each interaction fires; (b) semantic state ("row 4471 shows View+Edit, not Delete") | drive the browser; record the fired API traffic (portable → replayed at the API layer) + assert semantic state via a **per-side locator map** | front-end-only behavior HTTP recording can't see |

**A source UI regression script is NOT a drop-in target replay harness.** Its locators are tied to the
source DOM and break on the target. So UI-driving is primarily a way to *exercise the real,
correctly-sequenced API calls* (which ARE portable) and feed the API backbone; only genuine
front-end-only behavior uses the per-side-mapped semantic assertion. **Never replay source selectors
against the target.**

The deals example: list-render + edit-load = the API calls the UI fires (API-level, portable); "which
of View/Edit/Delete each row shows" (permission/role rendering) = the thin, per-side-mapped UI smoke.

### UI-smoke locator map

For UI-level semantic assertions the harness needs to know how to locate the same semantic element on
both the source DOM and the target DOM. Because a migration changes selectors, classes, and IDs, a
per-side map must be authored. File: `tests/golden-master/ui-locator-map.json`.

```json
{
  "source": {
    "deal_row_edit_btn":   "button[data-id='{{id}}'].edit-action",
    "deal_row_delete_btn": "button[data-id='{{id}}'].delete-action"
  },
  "target": {
    "deal_row_edit_btn":   "a.deal-action[data-entity='{{id}}'][data-action='edit']",
    "deal_row_delete_btn": "a.deal-action[data-entity='{{id}}'][data-action='delete']"
  }
}
```

`{{id}}` is interpolated at runtime with the record ID from the recording. **Authorship:** the LLM
authors a template with source selectors filled from the source DOM; the developer reviews and supplies
the target-side selectors before replay (the target DOM doesn't exist during source capture). A UI
smoke recording references a locator key instead of a raw selector:

```json
{
  "id": "UI_deals_row_4471_actions",
  "feature_id": "F-15",
  "risk": "MEDIUM",
  "tier": "OBSERVED",
  "captured_from": "ui-network",
  "ui_assertions": [
    { "locator_key": "deal_row_edit_btn",   "id": "4471", "expected_visible": true },
    { "locator_key": "deal_row_delete_btn", "id": "4471", "expected_visible": false }
  ],
  "network_recordings": ["GET_deals_4471"]
}
```

### UI-driver preflight

The plugin **never bundles** Playwright or browser binaries — that is a target-project dependency.
Mirror the Upgrade tool-preflight pattern (`scripts/upgrade-tool-preflight.cjs` + `references/tool-matrix.md`):
- A UI-driver preflight **probes** for a browser-automation tool the project already uses
  (**Playwright / Cypress / Selenium** — prefer what's present; default Playwright). Missing → **print
  install + verify steps and PAUSE** (a graceful pause, not a failure); the developer installs it in the
  target repo.
- The **LLM authors** the driver script into the target's `tests/golden-master/`; the **developer
  executes** it (authors + rehearses / human executes). Replay stays a script, not LLM inference.

---

## Seeds — reusing existing tests as oracle input

Provide seeds to the skill **before Step 1** — they inform the mode decision (a regression suite
tells you whether data is available) and directly feed the Step 2 worklist and data-seeding strategy.

### Regression bucket as a seed

A regression suite seeds three gaps: the worklist (Discovery), the data (crawl/seed), and — when
automated — the **source-side** capture mechanism.

**How the developer provides it (intake mechanism):**
- **Auto-discovery (in-repo):** scan the `--roots=<source>` the skill already takes for `e2e/`,
  `tests/`, `*.spec.ts`, `*.cy.ts`, `*.feature`, `*.postman_collection.json`, `*.side`, JUnit/NUnit
  projects. The developer supplies nothing beyond the source path.
- **Explicit input (out-of-repo):** one intake question — "path to the regression suite or test
  export?" — accepting a folder (wired via `additionalDirectories`) or a single export file. None →
  proceed and log the reduced seed.
- **Accepted formats:** in-repo automated suites (Playwright/Cypress/Postman/REST-assured/SoapUI/JUnit)
  and test-management exports (Xray/Zephyr/TestRail/qTest, CSV/JSON) — normalized into the worklist by a
  per-format parser.
- **Ledger record** (location/type only, never secrets):
  `decision_log.golden_master.seed = { type: "in-repo" | "provided-path" | "tool-export", location, format, executable }`.

**Trust treatment (keeps it honest):**
- **Automated test run green against the live source** → record the actual response → **`OBSERVED`**.
- **A documented "expected result"** (manual case) → **`INFERRED`** — a strong hint, confirmed against
  the source before it counts as parity.
- **Coverage is bounded by QA's choices** — cross-check against the code/graph surface and **log what
  the bucket does not reach**; "all regression passed" ≠ "behavior fully verified".
- **Stale/disabled/failing tests are not oracles** — only green-against-source tests seed `OBSERVED`.
- **No parity without confirmation:** even if the source is decommissioned and can never be re-run,
  bucket expectations stay `INFERRED` and are **never** auto-promoted to a parity baseline. A sunset
  source with no reachable instance = `deferred-capture` / SKIP + the skill's compensating control.

### Unit tests as a seed (lower layer)

Usable, but narrower than integration/e2e regression, and governed by the stable-layer principle.
- **Good uses:** (1) **pure-function input→output fixtures** — a unit assertion IS a function-level
  recording; (2) **edge-case / business-rule discovery** to enrich the worklist and the intent plan.
- **Limits:** (a) unit tests bind to **internal structure** — the *least* stable layer — so they do NOT
  replay against a rewritten target (same failure mode as source UI selectors); (b) they are isolated +
  mock-based + assertion-based → `INFERRED`, not the integrated ground truth golden master targets. A
  green unit test ≠ behavioral parity.
- **Tier:** pure-logic test run green vs source → `OBSERVED` (flagged *isolated*, unit-level);
  assertion-only / mock-heavy / can't-run → `INFERRED`.
- **Mode transferability:** Upgrade / Replatform (structure preserved) → transfer fully, already part of
  the baseline/verify oracle (golden master is the secondary smoke); Rewrite·port → pure-logic transfers;
  Rewrite·re-arch/cross-stack → harvest inputs + edge cases as `INFERRED` seeds only.

---

## App-specific golden-master plan (generated from the source)

At intake the invoking skill generates a per-application playbook by **analyzing the actual source**
(reusing family source detection + the knowledge graph — never guessed from a URL) and writes it to
`docs/.../ADO-{ID}-golden-master-plan.md`:
- Detected stack + run mode → recommended oracle mode.
- Detected auth scheme (from source config) → what credential to supply, via env only.
- Discovered regression suite → path + format, folded into the worklist.
- Entity/resource map with list→detail relationships (from routes/controllers) → the concrete crawl.
- Proposed recordings per endpoint with `risk` + `tier`, traced to a `feature_id`/regression case.
- UI-only behavior detected in the front-end → flagged for UI-smoke + per-side map.
- Mutation guards — write paths flagged with the `POST`/`PUT`/`DELETE` safety classification.
- Recommended mode + coverage target for THIS app.

**One artifact, two roles:** for reachable sources it's the worklist the skill executes; for unreachable
sources it *is* the `deferred-capture` plan — requests filled, answers blank/`INFERRED` — handed to the
developer/QA to run later.

---

## Step 1 — Is a source oracle reachable?

> **Can't self-run ≠ no oracle.** A *running* source is the strongest oracle. If the tool cannot launch
> the source itself but the source is **reachable at a developer-provided URL** (a dev/test instance the
> developer has running — common for WCF/IIS/Windows-auth services the AI can't start), capture from
> that. If no instance is reachable but the source is understandable, author a **capture plan** to run
> later. Full SKIP (inferred-only parity) is the true last resort.

Confirm whether the source builds and starts, whether seed/test data exists, and — if the tool cannot
start it — whether the developer can point at an already-running instance.

### Developer presentation (STOP — required before recording any mode)

Before recording any oracle mode to the checkpoint, STOP and present all options with their
consequences. Never auto-select silently.

1. Probe whether the source is self-runnable (can the build/run tools start it locally?).
2. Present the following and wait for the developer's explicit response:

```
🔍 ORACLE MODE — {ADO} · {migration name}

The oracle mode sets the behavioral verification approach and directly caps the assurance ceiling.

Auto-detected so far: {source self-runnable: yes/no} — {reason}

| Mode             | What it requires                        | What you get                                    | Assurance ceiling                                     |
|------------------|-----------------------------------------|-------------------------------------------------|-------------------------------------------------------|
| self-run         | Source buildable + launchable locally   | Full capture from local instance                | BAL A (Rewrite) · NFR measurable (Replatform)        |
| provided-url     | A running dev/test instance URL from you| Full capture from that instance                 | BAL A (Rewrite) · NFR measurable (Replatform)        |
| deferred-capture | Nothing now                             | Capture plan authored; you or QA run it later   | NONE until the plan is executed against a live source |
| skipped          | Nothing                                 | Inferred characterization tests only            | BAL capped at C (Rewrite) · NFR projected (Replatform)|

⚠ If deferred or skipped:
  · Rewrite: BAL caps at C — a B-series cluster below assurance floor is a HARD BLOCK at the
    completion gate (named approver + written reason required).
  · Replatform: NFR assurance degrades to 'projected' — a regulated NFR below the measured
    floor is a HARD BLOCK (exit 16, named approver + written reason required).

Do you have a running dev/test instance of the SOURCE application available at a URL?
  YES — provide the URL below (dev/test only; never production)
  NO  — we will use {self-run if available | deferred-capture if source is understandable | skip}
```

3. **Developer's explicit response determines the mode — never override it:**
   - YES + URL provided AND source self-runnable → ask which the developer prefers (both give BAL A);
     default to `provided-url` if the developer has real data there, `self-run` if they prefer the
     controlled local instance. Record the choice and the reason.
   - YES + URL provided AND source NOT self-runnable → `provided-url`.
   - NO + self-run available → `self-run`.
   - NO + not self-runnable + source understandable → `deferred-capture`.
   - NO + none of the above apply → `skipped`; explain consequences once more before confirming.
4. For `provided-url`: probe reachability (`curl -sf -k --max-time 5 {URL}/{health-endpoint}`) and
   confirm the URL is not a production endpoint before proceeding.

Decision (ordered strongest-first — take the first that applies):

1. **Source self-runnable by the tool + has seed/test data** → full golden-master capture (Step 2).
   Mode `self-run`, coverage `FULL`.
2. **Source self-runnable, no data** → capture a smoke subset from whatever endpoints respond; mode
   `self-run`, coverage `PARTIAL`.
3. **Source NOT self-runnable, but reachable at a provided base URL** → ask the developer for the source
   base URL, **probe reachability**, and capture against it (Step 2). Mode `provided-url`; coverage
   `FULL` if its datastore has data, else `PARTIAL`. **Preferred over deferred/skip.**
   ```bash
   # Reachability probe — a health/any endpoint on the provided instance (dev/test only)
   # -k disables cert validation for dev/test self-signed certs; NEVER use against production
   curl -sf -k --max-time 5 "{SOURCE_BASE_URL}/{health-or-any-known-endpoint}" >/dev/null \
     && echo "✅ source reachable @ {SOURCE_BASE_URL}" \
     || echo "❌ not reachable — fall through to deferred-capture / skip"
   ```
   **Dev/test instance only.** If the URL is not `localhost`/loopback or contains `prod`, warn loudly
   and require explicit confirmation before capturing (real responses carry real PII — masking rules in
   Step 2 apply).
4. **No reachable instance, but the source is understandable** (code / regression suite / contract
   available) → **`deferred-capture`**: author a CAPTURE PLAN — the full request set + auth + normalization
   rules from Discovery — with **expected answers left `TBD`**, pre-filled only where confident and tagged
   `INFERRED`. Coverage `NONE`-yet; this is **not a parity claim**. Write it to
   `tests/golden-master/capture-plan/capture-plan.json` for a human/QA to run against a real source
   later; matches then **promote INFERRED→OBSERVED**. Preferred over full SKIP. Coverage `NONE` until
   promotion completes (the `mode: deferred-capture` ledger field is the signal that coverage is pending).
   File structure: `{ "version": "1.0", "created_at": "<ISO-8601>", "entries": [...recordings...] }`.
   On re-run against a live source, merge by `id` — never overwrite a filled (non-TBD) entry.
5. **Neither self-runnable, nor a reachable URL, nor understandable enough to plan** → **SKIP** (true
   last resort); emit and record:
   `⚠ No external oracle captured — behavioral parity is INFERRED only (characterization tests).`

**When the oracle is SKIPPED or only deferred, the invoking skill's final assurance gate carries the
compensating control** (Upgrade → build + tests vs baseline; Rewrite → no-oracle caps BAL at C +
completion gate; Replatform → NFR + Well-Architected assurance) — a skipped oracle otherwise leaves no
net. **External integrations are the highest-risk unverified set** in that case (transport type is
invisible at the I/O boundary even when GM runs) — they must be ground-truth-verified and covered by the
skill's completion gate before the migration is declared done. Deeper structural cross-check is available
via [`asbuilt-reconciliation-spec.md`](asbuilt-reconciliation-spec.md) as an **optional** compensating
control the skill may invoke. Feasibility ties are per [`feasibility-spec.md`](feasibility-spec.md).

Record the decision in the checkpoint (merge, do not overwrite existing fields) as
`decision_log.golden_master = { mode: "self-run" | "provided-url" | "deferred-capture" | "skipped",
source_base_url, auth_scheme, reachable, coverage: "FULL" | "PARTIAL" | "NONE", seed }`.
**NEVER store credentials or tokens** —
persist the auth *scheme* only (the secret lives in an env var / interactive input, never on disk).

## Step 2 — Record from SOURCE

**Capture target.** For `mode = self-run`, launch the source locally and record against it. For
`mode = provided-url`, the harness targets `decision_log.golden_master.source_base_url` directly — **no
build/start**; the Step-1 reachability probe stands in for the health check. For `mode = deferred-capture`,
author the plan (requests + `TBD`/`INFERRED` expectations) — no live target yet. Everything downstream
(recordings, normalization, `feature_id` linkage) is identical — only the HTTP base changes.

**Source authentication (multi-scheme).** Acquire auth for the SOURCE per the scheme detected in the
source's auth/integration analysis. **Credentials come from env vars / an interactive prompt ONLY —
never persisted** to the checkpoint or fixtures; only the *scheme* is recorded.
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

**Operational error handling during capture:**

- **Auth failure mid-capture** — if any recording returns 401/403 after initial auth succeeded (token
  expired mid-run), suspend capture, log the affected `id` as `tier: "auth-expired"`, attempt to
  re-acquire tokens using the same scheme, and resume. If re-acquire fails, abort and report which
  recordings completed vs which did not; do not silently skip.
- **Capture interrupted** (network timeout, process kill, etc.) — move completed recordings to
  `tests/golden-master/recordings/` with coverage re-stamped `PARTIAL`. On the next run, skip
  already-recorded `id`s (deduplication by `id`). Log how many remain unfilled.
- **Disposable record cleanup fails** (DELETE blocked by referential integrity, record locked) — log
  the record ID as a known pollutant, escalate to the developer before continuing, and never silently
  leave orphaned test records on a shared instance.
- **Temp-file cleanup** — after all recordings complete (or if capture is interrupted), delete
  `/tmp/gm-cookies.txt` and any browser profiles used by the UI driver. These may contain session
  tokens and must not persist on disk.

**Worklist — from the intent source (Discovery), in priority order:** (1) INFERRED behaviours marked
`GM-verifiable` — reproducing them promotes INFERRED→OBSERVED; (2) HIGH-risk / RED items; (3) gaps
tagged `run the source` — reproducing resolves the gap; (4) the remaining GM-verifiable behaviours for
regression coverage. Prefer an existing integration-test corpus, regression suite, or request log;
otherwise synthesise representative requests per behaviour and **cover the happy path AND its
error/edge paths**. Record each to `tests/golden-master/recordings/`:

```json
{
  "id": "GET_deals_4471",
  "feature_id": "F-12",
  "risk": "HIGH",
  "tier": "OBSERVED",
  "captured_from": "source",
  "verifies_gwt": "Given deal 4471 exists / When GET /api/deals/4471 / Then 200 + {id,name,stage,owner}",
  "request":  { "method": "GET", "path": "/api/deals/4471", "headers": {}, "body": null },
  "response": { "status": 200, "body_normalized": "{\"id\":4471,\"name\":\"Acme Deal\",\"stage\":\"Active\",\"owner\":\"u-88\"}" },
  "normalizations": ["strip: Date header", "sort: array by id", "mask: token fields"]
}
```

Field contract (read by `golden-master-replay.cjs`):
- `id` — unique key (filename-independent).
- `feature_id` — the intent item this recording verifies (traceability).
- `risk` — `HIGH` | `MEDIUM` | `LOW`; a `HIGH`-risk drift or any `error` fails the replay gate.
  **Assignment rule:** use the invoking skill's feasibility/intent assessment when available — RED items
  → `HIGH`, YELLOW → `MEDIUM`, GREEN → `LOW`. When no assessment exists, assign by endpoint sensitivity:
  auth, payment, data-write, and business-critical read paths → `HIGH`; primary entity reads (list,
  detail) → `MEDIUM`; reference/lookup/configuration → `LOW`. Always assign explicitly — never omit.
- `tier` — `OBSERVED` | `INFERRED` | `STATIC`:
  - `OBSERVED` — response recorded from a real running source; the strongest evidence.
  - `INFERRED` — response authored from understanding (code-reading, regression case docs, unit test
    assertions); not yet confirmed against a live source. A matched `INFERRED` recording is promotable
    to `OBSERVED` by re-running against a real source.
  - `STATIC` — the endpoint always returns the same response regardless of data state (e.g. a
    configuration or version endpoint, `GET /api/version`). Safe to author directly; not promotable
    because there is nothing to confirm against a live source that differs from the authored value.
    Does NOT count toward the INFERRED→OBSERVED promotion tally. **`STATIC` recordings ARE replayed
    and included in the gate diff** — a mismatch (e.g. the target returns a different version string)
    IS a gate failure, treated at the risk level assigned to that recording.
- `captured_from` — `source` | `ui-network` | `authored-plan`. Optional if the recording is authored
  (deferred-capture); required for live captures.
- `verifies_gwt` — narrative Given/When/Then string. Optional but strongly recommended for traceability.
- `request.headers` — JSON object of header key→value pairs; omit or use `{}` if no custom headers.
- `request.body` — JSON string or `null` for GET/DELETE; JSON-serialised object string for POST/PUT.
- `response.body_normalized` — **always a JSON-serialised string** (never a raw object). For live
  captures: serialize the normalized response body as JSON. For `INFERRED` pre-fills: serialize the
  expected object as JSON. For `deferred-capture` recordings: the literal string `"TBD"`. For error
  responses (4xx/5xx): serialize the error body as JSON (e.g. `"{\"error\":\"Not found\"}"`).
- `normalizations` — array of normalization instructions (`"strip: X"`, `"mask: Y"`, `"sort: Z"`).
  Use `[]` if no normalization is needed — never omit the field.

Normalization rules — agree BEFORE recording; they define what "same" means:
- Strip non-deterministic fields: timestamps, generated IDs, correlation IDs, server headers.
- Canonicalize: sort unordered collections; round floats to an agreed precision.
- Mask secrets/PII in the fixture (never persist a real token or PII value).
- **Never normalize away an ASSERTED outcome.** If the intent asserts an exact status code, error
  string, or threshold, that value IS the assertion — normalize only the non-deterministic envelope
  around it, never the asserted outcome itself.
- **Asserted value with a dynamic/PII sub-part:** assert the STABLE shape/prefix and mask or normalize
  only the variable slice inside it — e.g. `404 "user {…} not found"` asserts the shape while masking
  the echoed email. Record which slice was masked. Never mask the whole asserted outcome to dodge a diff.

Record every normalization in the fixture so a reviewer can see exactly what was ignored.
Unexplained normalization hides drift.

### Mutation safety (state-changing actions)

Reads (list, view, edit-load) are safe to record and replay. State-changers require care:

- **`POST` (create a new resource)** — the mechanism for safe throwaway seeding. Use it to create
  a throwaway record, then operate on that record. Safe when the resource is one the tool created and
  will clean up.
- **`POST` with irreversible external side-effects** (emails sent, payments processed, external webhook
  triggers, bulk operations) — **ALWAYS excluded from the oracle**. A throwaway record does NOT prevent
  the side-effect from firing. Flag these explicitly in the report as "excluded — irreversible
  side-effects"; cover them by other means (contract tests, manual sign-off).
- **`PUT` / `PATCH` / `DELETE` against existing records** — **NEVER** on a record the tool didn't
  create, especially on a provided shared instance.

The safe pattern for capturing a write path:
`POST (create throwaway) → PUT/DELETE the throwaway → record the read-back → DELETE/clean up`.

If disposable creation isn't possible, the write path is **excluded** from the oracle and flagged for
other coverage — explicitly, never silently.

## Step 3 — Replay against TARGET

After the invoking skill's target build/deploy, start the target, replay each recording against it, and
diff the normalized response:

```json
{
  "id": "GET_deals_4471",
  "feature_id": "F-12",
  "verdict": "match | drift | error | pending",
  "asserts": "200 + {id,name,stage,owner}",
  "diff": [
    "response.body.owner: expected 'u-88', got null",
    "response.body.stage: expected 'Active', got 'Pending'"
  ],
  "risk_tie": "feasibility YELLOW #4 (owner projection)"
}
```

`diff` is an **array of strings**, one entry per diverged field. Empty array `[]` when verdict is
`match`. `pending` verdict is used only for `TBD` recordings (deferred-capture, not yet filled).

Replay is a deterministic harness (script) — `golden-master-replay.cjs` — not LLM inference. The LLM
writes/authors the harness and reads the summary. UI locators are **re-mapped for the target** (per-side
map); source selectors are never reused against the target. The target-side token acquisition the skill
performs at replay mirrors the source-side acquisition in Step 2.

**`deferred-capture` recordings with `response.body_normalized: "TBD"` are excluded from the diff.**
They are counted separately in the report as `pending` (not `match`, `drift`, or `error`) and do NOT
contribute to GATE PASS — the gate only fires on filled recordings. Coverage stays `NONE` until all
`TBD` recordings are filled by running the capture plan against a real source and promoting
`INFERRED→OBSERVED`. Never treat a `TBD`-skipped replay as a passing gate.

## Step 4 — Report + gate

Write `docs/.../ADO-{ADO_ID}-golden-master-report.md`:
- Oracle basis: `self-run` | `captured from running source @ {source_base_url}` | `deferred-capture` |
  `SKIPPED (inferred)` (from `decision_log.golden_master.mode`).
- Coverage: N recordings / M source behaviours (FULL | PARTIAL | NONE), each mapped to a `feature_id`.
- Verdicts: match / drift / error counts; INFERRED→OBSERVED promotions.
- Every `drift`/`error` MUST link to its `feature_id`/`gap_id` and a feasibility RED/YELLOW item (or be
  raised as a NEW finding).

**Record results in the report — do NOT rewrite a skill's approved intent baseline.** If the invoking
skill maintains a signed baseline (with a recorded source SHA), it stays immutable after approval;
keyed by `feature_id`/`gap_id`, record in the golden-master report: a reproduced INFERRED behaviour →
verified `OBSERVED`; a reproduced `run-the-source` gap → gap resolved; a drift against an asserted
outcome → the drift + its `feature_id`. If the skill's baseline has a review log, **APPEND** a single
verification-results note; never edit confidence or gap sections in place. Human-verify-only items
(`GM-verifiable = no` — internal rules with no observable output) are OUT of golden-master scope.

**Gate rules:**
- **HIGH-risk drift or any `error` → hard STOP.** Do not declare the migration done. Resolve or
  explicitly accept with a recorded reason before the gate can pass.
- **MEDIUM-risk drift → warn; gate passes only with documented acceptance.** Record in the report:
  `accepted_drift: { feature_id, reason, accepted_by }`. The developer (or invoking skill caller) is
  responsible for this decision; it must be explicit — never inferred or silent.
- **LOW-risk drift → reportable, never gate-blocking.**
- **`error` definition:** an `error` verdict is recorded when (a) the target returns 5xx; (b) the
  request times out after 30 s; (c) the target returns a status code not present in the recording (e.g.
  source=200, target=401); (d) the response body fails JSON parsing. All four are gate-blocking
  regardless of risk level.
- **If the oracle was SKIPPED or only deferred,** the invoking skill's compensating control (per the
  binding table) must have run and passed before completion — it is not optional in that case. A gate
  in `PENDING` state (TBD recordings unfilled) cannot reach PASS; the compensating control must cover
  the gap.

---

## Hard rules

- NEVER auto-select or silently record an oracle mode — ALWAYS present all options with their
  assurance-ceiling consequences and wait for the developer's explicit response before recording.
- The developer's choice overrides the auto-detected recommendation — never infer YES for
  `provided-url` from silence or from the fact that the source is self-runnable.
- NEVER claim behavioral parity without a captured oracle — say "INFERRED" if none was captured.
- The questions come from the SOURCE (code / contract / suite / UI); the answers come from the URL —
  NEVER infer the endpoint list from the base URL alone.
- Capture from a REACHABLE running source (provided URL) before deferring; author a capture plan before
  full SKIP. SKIP is the true last resort.
- NEVER persist source credentials/tokens — env var / interactive only; record the auth *scheme* only.
  Capture only against a dev/test instance; a prod-looking URL requires explicit confirmation.
- NEVER `PUT`/`PATCH`/`DELETE` a record the tool didn't create. `POST` (create new resource) is safe for seeding throwaway records. `POST` with irreversible external side-effects (emails, payments, webhook triggers) is ALWAYS excluded — a throwaway does not prevent the side-effect from firing.
- Diff at the most stable layer (API › semantic-UI › never raw DOM/selectors). NEVER replay source UI
  selectors against the target — re-author at the stable layer.
- The oracle is recorded from SOURCE, replayed against TARGET — never the reverse.
- Normalizations are part of the contract — show them in the report.
- Replay execution is 100% OS process (script), zero LLM tokens during the run.
- Each recording carries the `feature_id`/`gap_id` it verifies — capture ↔ intent stay 1:1.
- NEVER normalize away an outcome the intent asserts verbatim (status code / error string / threshold).
- Verification results live in the golden-master REPORT (keyed by `feature_id`); a skill's approved
  intent baseline is IMMUTABLE — at most APPEND a verification note, never rewrite it.
- NEVER guess or infer data IDs for detail-endpoint calls — extract real IDs from list-endpoint responses.
- A regression suite being green does NOT prove full coverage — cross-check suite breadth against the
  source code surface and log what the bucket does not reach.
- Deferred-capture (TBD recordings) is NOT a parity claim — gate pass requires filled recordings only;
  TBD entries are `pending`, not pass.
- On capture interruption, clean up temp files immediately and move partial recordings to `recordings/`
  marked `partial-run` — never leave the capture in an undefined state.
- `POST` with irreversible external side-effects (emails, payments, webhook triggers) is ALWAYS excluded
  from the oracle — a throwaway record does NOT prevent the side-effect from firing.
