# Golden Master — Developer Runbook

_The plain-language, "**you** do X / the **skill** does Y" companion to
[`golden-master-spec.md`](golden-master-spec.md). The spec is the skill-facing contract; this is your
step-by-step for actually producing a golden master on a real app._

---

## What you're producing

An **answer key recorded from the OLD app.** You capture the old app's real responses (**pre-move**),
then the skill replays the same requests against the NEW app (**post-move**) and flags anything that
changed. A change it can't explain is a silent regression — exactly what golden master exists to catch.

> The one rule that makes it trustworthy: the answers must come from the **real running source**, not
> from anyone's guess. Everything below is about getting real answers (or, when you can't yet, preparing
> to get them later without pretending you have them).

---

## Before you start — gather these

- [ ] **Source app location** (repo path) — the skill needs it to detect the stack and find your tests.
- [ ] **Can the old app run?** locally (build + start), or is there a **dev/test URL** already up?
- [ ] **A regression suite / test cases?** in the source repo, a separate repo, or an export from
      Xray / Zephyr / TestRail / qTest.
- [ ] **Auth** to call it — the *scheme* (Bearer / API-key / cookie / Windows-NTLM) and a
      **non-production test credential**.
- [ ] **Test data** — does a running instance have records (deals, etc.), or is it empty?

---

## Step 0 — Provide your seeds (before picking a mode)

The oracle-mode decision (Step 1) depends on what you have. Give these to the skill **now**:

- **Regression suite:** if it's inside the source repo, the skill auto-finds it (Playwright, Cypress,
  Postman, REST-assured, SoapUI, JUnit test files in standard locations). If it's elsewhere, give the
  **folder path or an export file** (Xray/Zephyr/TestRail/qTest CSV or JSON). **No suite?** That's
  fine — say so; the skill discovers the surface from source code instead.
- **Source repo path** — always required.

The seed tells the skill whether test data is already available (affects whether you can reach Mode A
or B with coverage FULL) and gives it a curated worklist to start from.

---

## Step 1 — Pick your oracle mode (the one big decision)

Answer top-down; take the **first** that fits:

| # | Question | Mode | What it means |
|---|---|---|---|
| 1 | Can you build + run the old app locally, **with data**? | **A · self-run** | Best — full capture from a local instance |
| 2 | Not locally, but is a **dev/test URL** reachable? | **B · provided-URL** | Capture against that instance (common for WCF/IIS/Windows-auth apps) |
| 3 | Neither — but you have the **source code / a regression suite**? | **C · deferred-capture** | The skill authors a capture *plan* now; you record later when a source is reachable |
| 4 | None of the above | **D · skip** | Last resort — the migration relies on its other safety nets |

Tell the skill the mode. **Never point at production.**

---

## Step 2 — Hand the skill what you have

- **Source path** — always.
- **Mode B:** the dev/test **base URL** + how it authenticates. Put the credential in an **environment
  variable, or type it when prompted — never paste it into a file.**
- **Regression suite:** if it's in the source repo, the skill **auto-finds it**; otherwise give the
  **folder path or the export file**.

The skill probes the URL for reachability and records your choice (mode, URL, auth *scheme* — never the
secret) in its ledger.

---

## Step 3 — Confirm "what to call" (the skill discovers; you check)

You don't hand-list endpoints. The skill derives the worklist from, in order: **your regression suite →
the source code / API contract (Swagger/WSDL/Postman) → your unit tests → driving the UI.** It shows you
the proposed list — **add anything business-critical it missed**, drop anything irrelevant.

> Why not from the URL? A base URL tells the skill nothing about `GET /api/deals`. The *questions* come
> from the source; the URL only provides the *answers*.

---

## Step 4 — Make sure there's data (or let it seed)

- **Instance has data:** the skill calls the list endpoint (e.g. `GET /api/deals`), takes **real IDs**,
  and drills into them (`GET /api/deals/{id}` — what "Edit" loads).
- **Instance is empty:** point it at your **regression suite's seed / setup scripts**, or let it create
  **throwaway records** via the app's own create flow.
- Confirm the datastore is **dev/test, not production**.

---

## Step 5 — Approve the capture worklist

Review the proposed requests (and any UI flows). Confirm the **mutation rule**: destructive actions
(Edit-save, Delete) run **only against throwaway records the skill created — never your real data**.
Flag anything to exclude.

---

## Step 6 — Capture from the SOURCE (pre-move)

The skill records the old app's real responses into `tests/golden-master/recordings/`. For **UI-only
behavior** (e.g. *which* of View/Edit/Delete a row shows), it drives the browser — **install
Playwright/Cypress when it prompts you** (it won't bundle one). Nothing about the new app happens yet.

- **Mode C (deferred):** instead of recordings you get a **capture plan** under
  `tests/golden-master/capture-plan/` — requests filled in, expected answers left as `TBD` or marked
  `INFERRED` where the skill is confident. It is **not** a parity claim; the gate treats all `TBD`
  recordings as `pending` (not pass, not fail). See "Running the capture plan later" below.

---

## Step 6.5 — (Mode C only) Run the capture plan when a source becomes reachable

When you later have a reachable source (dev/test URL or the app running locally):

1. **Tell the skill** you now have a source — it switches to `provided-url` / `self-run` and reads
   the existing plan from `tests/golden-master/capture-plan/capture-plan.json`.
2. **The skill replays each plan entry against the real source**, fills in the actual responses, and
   moves completed recordings to `tests/golden-master/recordings/`.
3. **`INFERRED` entries that match the real response are promoted to `OBSERVED`** automatically.
   Entries where the real response **differs** from the `INFERRED` pre-fill: the real value wins
   (truth beats the guess), and the mismatch is flagged in the report under **"Promotion mismatches"**
   for you to review — a mismatch means the source behaves differently from what was assumed, which
   is valuable information.
4. **`TBD` entries** are filled with the real response and set to `OBSERVED`.
5. **Coverage is re-stamped** (`FULL`/`PARTIAL`) after promotion. The gate now applies to filled
   recordings — HIGH-risk drift or error → STOP.

You do **not** need to restart the migration flow. The skill resumes here and proceeds to Step 7.

---

## Step 7 — Replay against the TARGET (post-move)

**Your role:**
1. **Start the new app** (or confirm the target dev/test instance is running).
2. **Provide the target base URL** when the skill asks — same format as the source URL in Step 2.
3. **Provide target-side auth** if the new app uses a different auth scheme than the source (the skill
   will ask; credentials via env var / prompt, never a file).
4. The skill replays the same requests and diffs the answers.

Note: it **re-maps UI locators for the new app** — your old app's selectors are not reused (they won't
exist in the rewrite). The diff happens at the most stable layer (API responses first).

**If any recordings have `TBD` expected responses** (Mode C capture plan not yet completed), those
recordings are skipped in the diff and shown separately as `pending` in the report — they do not
contribute to GATE PASS. Fill them first by running the capture plan against a real source.

---

## Step 8 — Read the report and act on drift

The report lands at `docs/.../ADO-{ID}-golden-master-report.md`:
- **match** → behavior preserved. ✅
- **HIGH-risk drift or any error → hard STOP.** Do not mark the migration done until it's fixed or
  explicitly accepted with a written reason (`accepted_drift: { feature_id, reason, accepted_by }`
  in the report).
- **MEDIUM-risk drift → warning.** Gate passes only after you record an explicit acceptance in the
  report. It is never a silent pass.
- **LOW-risk drift → reported only,** never blocks.
- **`pending`** → TBD recordings not yet filled. Gate cannot pass until they are promoted (Step 6.5).

---

## If you genuinely can't get an oracle (Mode D)

**Mode D is risky.** Only choose it if you truly cannot access the source in any form. You lose the
strongest behavioral check — real-world response comparison — and accept that silent behavioral
regressions may escape until production testing. If the compensating control also fails, the migration
is blocked.

Record **why**. The compensating control kicks in — the skill's own final gate carries the assurance
instead:
- **Upgrade** → the pre-upgrade build + project test suite vs the baseline.
- **Rewrite** → the Behavioral Assurance Level caps at C (no runnable oracle) + the completion gate.
- **Replatform** → NFR + Well-Architected assurance.

There is **no silent "it's fine."**

---

## Safety rules (always)

- **Dev/test only — never production.**
- **Credentials via env var or prompt — never in a file.**
- **Never delete or modify data you didn't create.**

---

## How the modes map to your migration

| You're running… | Golden master is… |
|---|---|
| **Upgrade** (same stack, higher version) | your existing tests largely transfer; GM is a *secondary* smoke on top of "verify vs baseline" |
| **Rewrite** (new stack / re-architecture) | the *primary* behavioral net — old-app answers vs new-app answers; UI/unit tests are seeds, not the harness |
| **Replatform** (same code, new host) | a *secondary* regression smoke behind NFR/readiness assurance |
