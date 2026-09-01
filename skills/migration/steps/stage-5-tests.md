# Migration Step — Stage 5: Test Coverage

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Continues from Stage 4._

**Persona:** [SE] Elena Fischer — Senior Software Engineer. **Model tier:** `${REVIEW_MODEL:-claude-sonnet-4-6}` (golden-master harness) / `${ICEA_MODEL:-claude-opus-4-8}` (test authoring).
**Checkpoint:** single source of truth (schema 1.9). Characterization tests are Write-Gated (`APPROVE MIGRATION ADO-{ID}`).

---

## Stage 5 — Test Coverage

### Step 5.0 — Golden-master behavioral verification (external oracle)

Capture an INDEPENDENT behavioral oracle from the running SOURCE and replay it against the TARGET.
This is stronger than characterization tests (which the migrating agent writes from its own
reading of the source) because the oracle is recorded from the real source, not inferred.

```
Read $PLUGIN_DIR/skills/migration/references/specs/golden-master-spec.md
```

**Staging note — this step spans two points in the flow; do NOT try to complete it in one sitting
at 5.0.** At Step 5.0 you only decide runnability (Step 1) and **capture** the recordings from the
SOURCE (Step 2) — the TARGET is not built yet, so there is nothing to replay against. The **replay +
diff + report** (Steps 3–4) run **after the Stage 6.1 Release build**; return here from Step 6.1 to
execute them. Concretely: decide whether the source can run (Step 1), record request→response
recordings from SOURCE (Step 2) now; then AFTER Step 6.1, replay against the built TARGET (Step 3)
and write `docs/.../ADO-{ADO_ID}-golden-master-report.md` (Step 4). The replay harness is a script —
the LLM writes it and reads the summary, no LLM during the run.

- If the source cannot be run: SKIP capture and record `⚠ No external oracle — parity is INFERRED
  only` in the report and the checkpoint `decision_log`. Do NOT claim behavioral parity.
- Any `drift` on a HIGH-risk item or any `error` → carry to the Stage 6 completion gate: the
  migration is NOT COMPLETE until each is explained (linked to a feasibility RED/YELLOW) or
  explicitly accepted with a recorded reason.

The migration posture from Stage 0.5 selects the oracle basis: port/re-architecture judges drift
against source behaviour; rewrite-from-spec judges it against the feature-parity inventory.

Where a Stage 0.6 Source Behavioral Inventory exists, its GM-verifiable INFERRED items and its
`run-the-source` gaps are the recordings to prioritise; each recording carries the item's
`feature_id`/`gap_id`. Record verdicts in the golden-master **report** (verified / gap-resolved /
drift) and APPEND a "Stage 5.0 verification results" note to the inventory's §13 Review Log — do NOT
rewrite the approved §5/§11 (the signed inventory is an immutable baseline). Internal rules the
inventory marks human-verify-only are out of golden-master scope.

### Step 5.1 — Characterization tests (verify behavioral preservation)

These tests document SOURCE behavior and verify the migrated code preserves it.
They run against the TARGET code — not the source.

For each YELLOW / RED item from Stage 2 feasibility:
1. Read source behavior by reading `{SOURCE_PATH}` files
2. Write the test in the profile `TEST_FRAMEWORK` at the profile `LAYOUT` characterization/unit-tests path
3. Mark: `// CHARACTERIZATION: {literal | inferred} — {behavior description}`

Write Gate: `APPROVE MIGRATION ADO-{ADO_ID}`.
After writing: `git add && git commit -m "test(characterization): behavioral contract [ADO-{ADO_ID}]"`

If no HIGH/MEDIUM risk items: skip.

### Step 5.2 — Unit tests per layer

Follow the profile `TEST_FRAMEWORK`.

Risk-aligned coverage targets (enforced):
| Layer | Target | FAIL threshold |
|---|---|---|
| Domain / pure logic | 95%+ | <90% → STOP |
| Application / use cases | 90%+ | <85% → STOP |
| Infrastructure / I/O | 70%+ | <60% → STOP |
| Host / bootstrap | excluded | N/A |

**Measure coverage — the thresholds above are enforced only if measured. Never assert a
percentage you did not measure.** Run the profile `COVERAGE` command(s), parse the report as the
profile specifies, and compare per-layer line coverage to the table. Any layer below its FAIL
threshold → STOP and report which layer + the measured %.

### Step 5.3 — E2E tests (Playwright — generated from migration knowledge)

Install and configure the profile `E2E` harness. Then generate the test files from migration
knowledge (no LLM involvement during execution):
- `tests/e2e/health.spec.ts` — from INFRASTRUCTURE-ARCHITECTURE.md health check config
- `tests/e2e/auth.spec.ts` — from SECURITY-ARCHITECTURE.md auth flow
- `tests/e2e/api-contract.spec.ts` — from integration-contract.md (one test per endpoint)
- `tests/e2e/navigation.spec.ts` — from the Angular routing module (frontend run)
- `tests/e2e/forms.spec.ts` — from cluster specs with data-testid attributes

Configure the E2E harness headless with screenshot-on-failure (per the profile `E2E`).

Write Gate: `APPROVE MIGRATION ADO-{ADO_ID}`.
After writing: `git add && git commit -m "test(e2e): Playwright tests [ADO-{ADO_ID}]"`

### Step 5.4 — Frontend-parity oracle (frontend run only — the UI sibling of Step 5.0)

**Only when `mode.track = frontend`** (a backend/upgrade run skips this — its parity is golden-master
Step 5.0). Golden-master stops at the HTTP boundary; this covers UI / navigation / validation parity,
keyed to the same Stage 0.6 feature-IDs. It has two tiers.

```
Read $PLUGIN_DIR/skills/migration/references/specs/frontend-parity-spec.md
```

- **Tier 1 — manual parity session (ALWAYS runs, no source dependency):** generated at **Step 6.4**
  (see there). This is the primary, human-dispositioned parity gate.
- **Tier 2 — advisory automated oracle (opportunistic):** if the source frontend can be driven live
  **with a backend**, **capture now** (spec Step 2) the semantic projection per GM-verifiable UI
  feature-ID — a normalized ARIA snapshot (discovery layer) + verbatim url/text/network outcomes
  (assertion layer), via role/text locators. **Defer replay to after the Step 6.1 build** (same
  capture-now/replay-later split as golden-master). If the source can't be driven live, record
  `⚠ No frontend oracle — parity is manual/INFERRED only (Tier 1)` in the report + checkpoint
  `decision_log` (merge) and rely on Tier 1.

**Never diff DOM markup or pixels — semantic projection only** (ARIA · URL · visible text · network ·
validation messages). Drift is **ADVISORY**: it is dispositioned by a human in the Tier-1 session,
never an automated hard block (frontend drift is too noisy to gate on). Results go to the
frontend-parity report and an append-only §13 note — the signed inventory stays immutable (identical
to golden-master's rule).

---

