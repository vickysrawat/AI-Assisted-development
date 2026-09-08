# Tech Spec — Story 3: Replatform Skill + Standalone Packaging + Retire Legacy
ADO #9000 · Story 3 · Release 1 · Sprint 1
Status: DRAFT · 21 SP

> Artifact: a new markdown skill (`skills/replatform/`) + CI-enforced standalone packaging
> (vendored-copy + drift-check) + a `MIGRATE` router + retirement of legacy `skills/migration/` +
> a future-autonomy feature flag (default OFF). App-shaped sections mapped to plugin equivalents.
> Design of record: `docs/plans/migrationSkill/replatform.md` (R1–R5) + README (governance).

---

## Overview

Story 3 delivers the **Replatform** skill (hosting axis: on-prem → cloud) and completes the family.
Where Rewrite's oracle is behavioral, Replatform's **primary oracle is non-functional** — an
**NFR spec** (latency, cost, availability, failover, RTO/RPO) graded against **Well-Architected**,
with a **measurability ceiling** (an NFR that cannot be measured caps the assurance it can claim —
symmetric to BAL). Decomposition is by **cloud capability** (not source modules), with the
**landing-zone as Tier-0**. The skill **authors** IaC + config + pipeline plus **human-executable
runbooks** for data migration, reconciliation, cutover, and rollback — and, per the family
invariant, the **LLM never executes** real infra/data. Data-reconciliation strategies are presented
as **options** with a human-executable step plan. A **future-autonomy feature flag** sits behind an
**executor seam**, ships **OFF**, and — if ever enabled — still bars prod + regulated actions and
graduates only by risk tier.

This story also completes the platform work: it **CI-enforces** the vendored-copy + drift-check seam
built in Story 2 (standalone packaging), and it **retires the legacy `migration` skill** — replacing
the `MIGRATE` keyword with a **router** that selects Upgrade / Rewrite / Replatform, shipping a
one-version deprecation notice, and guaranteeing **zero orphaned invocations**.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F7 | NFR spec; cloud-capability decomposition (landing-zone Tier-0); IaC + human-executable migration/reconciliation/cutover/rollback runbooks; LLM never executes prod | `skills/replatform/SKILL.md`, `skills/replatform/references/nfr-spec.md`, `skills/replatform/references/cloud-capability-decomposition.md`, `skills/replatform/references/runbooks.md`, `scripts/replatform-plan.cjs` | ✅ Covered |
| AC-F8 | NFR assurance (measurability-ceilinged) + Well-Architected grade + behavioral regression (reused golden-master) | `skills/replatform/references/nfr-assurance.md`, `skills/replatform/references/well-architected.md`, `scripts/replatform-nfr-assess.cjs` | ✅ Covered |
| AC-F11 | Standalone build vendors substrate w/ version+hash manifest; CI drift-check fails on vendored ≠ canonical | `scripts/vendor-substrate.cjs` (CI wiring), `scripts/substrate-drift-check.cjs`, `tests/substrate-drift.test.cjs`, CI config | ✅ Covered (CI-enforced) |
| AC-F12 | Retire legacy `migration`; `MIGRATE` → router; deprecation notice; zero orphaned invocations | `skills/migrate-router/SKILL.md`, `CLAUDE.md` §0a, `.claude-plugin/plugin.json`, `skills/migration/` (removed), `docs/migrations/*` | ✅ Covered |
| Future-autonomy flag (deferred capability) | Executor seam + flag default OFF; prod/regulated always barred | `skills/shared/executor-seam.md`, `scripts/replatform-plan.cjs` | ✅ Seam present, OFF |
| AC-NF1 | `tests/validate.js` green after merge | `tests/replatform.test.cjs`, `tests/migrate-router.test.cjs`, `tests/fixtures/replatform/*` | ✅ Covered |
| AC-NF2 | Write Gate on all source/config writes | (process — existing hook) | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `skills/replatform/SKILL.md` | AC-F7, AC-F8 |
| `skills/replatform/references/nfr-spec.md` | AC-F7 |
| `skills/replatform/references/cloud-capability-decomposition.md` | AC-F7 |
| `skills/replatform/references/runbooks.md` | AC-F7 |
| `scripts/replatform-plan.cjs` | AC-F7, future-autonomy seam |
| `skills/replatform/references/nfr-assurance.md`, `scripts/replatform-nfr-assess.cjs` | AC-F8 |
| `skills/replatform/references/well-architected.md` | AC-F8 |
| `scripts/vendor-substrate.cjs`, `scripts/substrate-drift-check.cjs`, `tests/substrate-drift.test.cjs` | AC-F11 |
| `skills/migrate-router/SKILL.md`, `CLAUDE.md` §0a, `.claude-plugin/plugin.json` | AC-F12 |
| `skills/shared/executor-seam.md` | future-autonomy flag |
| `tests/replatform.test.cjs`, `tests/migrate-router.test.cjs`, `tests/fixtures/replatform/*` | AC-NF1 |

**Coverage result:** all listed ACs covered; no orphaned file changes ✅.

---

## Schema Changes

> Extends the shared ledger from Story 2 — see ADO-9000-Story-2-rewrite.techspec.md. Adds the
> replatform payload only; core unchanged (additive-only honored).

| Artifact | Change | Detail |
|---|---|---|
| Checkpoint payload | ADD | `replatform{resources, IaC, NFR, cutover_state}` (opaque to other skills) |
| Checkpoint core | none | No core change — additive-only invariant preserved; tolerant-reader handles skew |

---

## Files Changed

| File | Type | Purpose |
|---|---|---|
| `skills/replatform/SKILL.md` | new | Skill entry: NFR intake → cloud-capability decomposition (landing-zone Tier-0) → author IaC + runbooks → human executes → NFR assurance + Well-Architected + behavioral regression |
| `skills/replatform/references/nfr-spec.md` | new | NFR capture schema (latency, cost, availability, failover, RTO/RPO) + measurability ceiling rule |
| `skills/replatform/references/cloud-capability-decomposition.md` | new | Decomposition by cloud capability; landing-zone = Tier-0 |
| `skills/replatform/references/runbooks.md` | new | Human-executable runbook format (per-step transparency + PASS/FAIL gate) for migration/reconciliation/cutover/rollback; reconciliation strategies as options |
| `skills/replatform/references/nfr-assurance.md` | new | NFR assurance grading, measurability-ceilinged (symmetric to BAL) |
| `skills/replatform/references/well-architected.md` | new | Well-Architected pillar grading (reuses app-readiness where applicable) |
| `scripts/replatform-plan.cjs` | new | Emits cloud-capability plan + IaC scaffold + runbook set; routes execution through the executor seam (flag OFF → author-only) |
| `scripts/replatform-nfr-assess.cjs` | new | Computes NFR assurance with measurability ceiling |
| `skills/shared/executor-seam.md` | new | Executor seam contract + future-autonomy flag (default OFF; prod/regulated always barred; cost caps, kill-switch, audit if ever enabled) |
| `skills/migrate-router/SKILL.md` | new | `MIGRATE` router: detect + classify shape → select Upgrade/Rewrite/Replatform; deprecation redirect from legacy |
| `skills/migration/` | remove | Retire legacy skill (after router covers mapped cases) |
| `scripts/vendor-substrate.cjs` | modify | Wire into CI build (standalone packaging) |
| `scripts/substrate-drift-check.cjs` | modify | Wire into CI; fail build on drift/manifest mismatch |
| `CLAUDE.md` §0a | modify | `MIGRATE ADO-{ID}` → router; add `REPLATFORM ADO-{ID}`; deprecation note for legacy behavior |
| `.claude-plugin/plugin.json` | modify | Register `/replatform` + router; deregister legacy `migration` |
| `docs/migrations/*` | new | One-version deprecation notice + migration guide for the `MIGRATE` change |
| CI config (`.github/` or ADO pipeline) | modify | Add drift-check job + keep `tests/validate.js` gate |
| `tests/replatform.test.cjs`, `tests/migrate-router.test.cjs`, `tests/substrate-drift.test.cjs` | new | Tests (see Test Cases) |
| `tests/fixtures/replatform/onprem-to-cloud/` | new | On-prem fixture targeting a cloud |

---

## Auth & Security

**Auth pattern:** N/A (plugin). Cloud credentials for a replatform *run* are the human executor's —
the LLM never handles or applies them.

**Security/safety analysis (Replatform-specific):**

| Concern | Mitigation |
|---|---|
| "Passing" without ever measuring an NFR | NFR assurance is measurability-ceilinged — an unmeasurable NFR caps the claimable assurance; no green report without a stated ceiling (AC-F8) |
| LLM creating/applying real cloud resources or executing cutover | LLM **authors + rehearses** only; execution is human via runbooks; executor seam flag OFF by default; prod/regulated always barred (AC-F7) |
| Data-cutover mis-design / data loss | Reconciliation strategies presented as options; human-executable step plan with PASS/FAIL gates; tested rollback; pre-cutover reconciliation gate |
| Retiring legacy strands in-progress migrations / breaks `MIGRATE` | Retire only after router covers mapped cases; router redirects `MIGRATE`; one-version deprecation notice; zero-orphan test (AC-F12) |
| Vendored bundle drifts from canonical in the wild | CI drift-check fails the build on any vendored ≠ canonical or manifest mismatch (AC-F11) |
| Future-autonomy flag flipped on carelessly | Flag OFF by default; even ON it bars prod + regulated, enforces cost caps + kill-switch + audit, graduates by risk tier |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| An NFR target cannot be measured in the target env | Assurance for that NFR is capped; the ceiling is shown; not reported as a pass |
| Any actor attempts to apply real cloud resources / execute prod cutover | Denied — LLM authors + rehearses only; execution requires human action (or the future-autonomy flag, OFF by default and prod-barred) |
| A data-reconciliation step fails pre-cutover | Cutover blocked; the runbook shows the failing PASS/FAIL step; human decides |
| A legacy `MIGRATE` invocation shape has no route | Test fails (zero-orphan requirement); router must map every shape before legacy removal |
| Vendored ≠ canonical at build | CI build fails with the drift report |
| Landing zone (Tier-0) not established | Dependent capabilities blocked until Tier-0 is in place |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F7 | NFR spec + cloud-capability decomposition + IaC/runbook authoring + executor seam | 8 |
| AC-F8 | NFR assurance (measurability ceiling) + Well-Architected + behavioral regression reuse | 5 |
| AC-F11 | CI-enforce vendored-copy + drift-check (standalone packaging) | 3 |
| AC-F12 | `MIGRATE` router + retire legacy + deprecation notice + zero-orphan | 3 |
| AC-NF1 | Fixtures + replatform/router/drift tests | 2 |
| **Total** | | **21** |

**Total SP: 21**
**Type: STORY** (child of EPIC ADO-9000) — a whole skill + platform + retirement; larger than the
app-feature heuristic by design. Decomposed at `IMPLEMENT ADO-9000 Story-3`.

---

## Definition of Done

**Implementation**
- [ ] All files in Files Changed created/modified/removed as specified
- [ ] LLM-authors-human-executes enforced everywhere real infra/data is touched; no autonomous apply path reachable with the flag OFF
- [ ] Future-autonomy flag ships OFF; prod/regulated barred even when ON
- [ ] `MIGRATE` router maps every legacy invocation shape (zero orphans)
- [ ] No hardcoded secrets/cloud creds; no `console.log` in production script paths
- [ ] `// DECISION:` comments on non-trivial choices (measurability ceiling, reconciliation-strategy selection, router classification)

**Quality**
- [ ] Positive + negative unit tests pass (see Test Cases)
- [ ] Integration tests pass (on-prem→cloud fixture; router routing; drift-check)
- [ ] `node tests/validate.js` = 0 failures (AC-NF1)
- [ ] CI drift-check job fails on a deliberately mutated vendored copy (proves enforcement)

**Review readiness**
- [ ] PR title: `[ADO-9000] Replatform skill + packaging + retire legacy migration (Story 3)`
- [ ] PR description maps each changed file to its ACs
- [ ] ICEA + this story spec committed in the feature branch

### Reviewer Checklist

- [ ] No reachable code path applies real cloud resources / executes cutover with the flag OFF
- [ ] NFR assurance is measurability-ceilinged (unmeasurable ⇒ capped, not passed)
- [ ] Reconciliation presented as options with human-executable PASS/FAIL step plan + tested rollback
- [ ] `MIGRATE` router: zero orphaned invocations (test proves it)
- [ ] Legacy `skills/migration/` removed only after router covers mapped cases; deprecation notice shipped
- [ ] CI drift-check actually fails the build on vendored ≠ canonical
- [ ] Checkpoint core unchanged (additive-only preserved); only replatform payload added

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None. | — | — | Resolved |

> NFR-primary oracle, cloud-capability decomposition, human-executed data/cutover/IaC, and the
> future-autonomy flag were decided in design (`docs/plans/migrationSkill/replatform.md` R1–R5) and
> recorded in `memory/MEMORY.md`.

---

## Request Flow

```
REPLATFORM ADO-{ID}   (or MIGRATE ADO-{ID} → router selects Replatform)
  → NFR intake (latency, cost, availability, failover, RTO/RPO) + measurability tagging
  → cloud-capability decomposition (landing-zone = Tier-0 first)
  → replatform-plan.cjs → author IaC + config + pipeline + runbooks
       (executor seam: flag OFF → author-only; LLM never applies)
  → HUMAN executes runbooks (migration → reconciliation gate → cutover → rollback if needed)
  → replatform-nfr-assess.cjs → NFR assurance (measurability-ceilinged)
  → Well-Architected grade + behavioral regression (reused golden-master)
  → checkpoint written to the SHARED ledger (replatform payload)
```

```
MIGRATE ADO-{ID}  (router — replaces legacy migration skill)
  → detect source + intent → classify shape
       → in-place same-stack higher-version → UPGRADE
       → out-of-place source≠target        → REWRITE
       → hosting axis on-prem→cloud         → REPLATFORM
  → legacy invocation shapes redirected (deprecation notice); zero orphans
```

---

## Rollback

Additive skills + a **removal** (legacy `migration`) + a **router replacement**. Rollback = revert
the feature-branch merge, which restores `skills/migration/` and the prior `MIGRATE` handler in
`CLAUDE.md` §0a + `.claude-plugin/plugin.json`; re-run `node tests/validate.js` (0 failures). A
replatform *run's* infrastructure rollback is a runtime concern handled by the human-executed
rollback runbook the skill authors — not an epic-rollback concern.

---

## Handover

### QA Team
On-prem→cloud fixture under `tests/fixtures/replatform/`. Assert NFR spec capture, cloud-capability
decomposition (landing-zone Tier-0 first), IaC + human-executable runbooks produced, and the
**LLM-does-not-apply** assertion (no apply path reachable with the flag OFF). Assert the `MIGRATE`
router routes every legacy shape with zero orphans, and the CI drift-check fails on a mutated
vendored copy.

### DevOps / Platform Team
New CI jobs: substrate **drift-check** (fails build on vendored ≠ canonical) + retained
`tests/validate.js` gate. Standalone build vendors `skills/shared/` stamped `{version, hash}`,
banner-marked GENERATED. One-version deprecation notice for `MIGRATE` shipped under `docs/migrations/`.
No new runtime infra for the plugin itself.

### Future Developer — Follow-on Work
The **future-autonomy flag** is intentionally OFF and out of scope to enable in this epic. Graduating
it (per risk tier, non-prod first) must re-enter the ICEA gate as its own work item with cost caps,
kill-switch, and audit. The executor seam (`skills/shared/executor-seam.md`) is the single place that
would ever gate execution — keep prod + regulated permanently barred there.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `replatform-plan.cjs` | on-prem app + target cloud | cloud-capability plan with landing-zone as Tier-0; IaC + runbooks authored | AC-F7 |
| P-U2 | `replatform-nfr-assess.cjs` | measurable latency NFR with data | NFR assurance graded to its measured ceiling | AC-F8 |
| P-U3 | `migrate-router` logic | in-place same-stack higher-version | routes to Upgrade | AC-F12 |
| P-U4 | `migrate-router` logic | on-prem→cloud | routes to Replatform | AC-F12 |
| P-U5 | `substrate-drift-check.cjs` (CI) | vendored == canonical | exit 0; build proceeds | AC-F11 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `replatform-plan.cjs` | apply/cutover requested, flag OFF | denied — author-only; no apply path executed | AC-F7 |
| N-U2 | `replatform-nfr-assess.cjs` | unmeasurable NFR | assurance capped (not passed); ceiling stated | AC-F8 |
| N-U3 | `migrate-router` logic | legacy shape with no mapped route | test fails — zero-orphan requirement forces a route before legacy removal | AC-F12 |
| N-U4 | `substrate-drift-check.cjs` (CI) | vendored mutated ≠ canonical | non-zero exit; CI build fails | AC-F11 |
| N-U5 | reconciliation gate | a reconciliation step fails | cutover blocked; failing PASS/FAIL step shown | AC-F7 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | On-prem→cloud replatform | run skill on `fixtures/replatform/onprem-to-cloud` | NFR spec + capability plan + IaC + human-executable runbooks; LLM does not apply | AC-F7/F8 |
| INT-2 | Router coverage | invoke `MIGRATE` across all legacy shapes | every shape routes to a skill; zero orphaned invocations | AC-F12 |
| INT-3 | Standalone bundle drift | vendor substrate → mutate a copy → run CI drift-check | build fails with drift report | AC-F11 |
| INT-4 | Full-family regression | run `tests/validate.js` with all three skills + router | 0 failures; legacy `migration` cleanly removed | AC-NF1 |

> NF AC verification:
> AC-NF1 (`validate.js` green): verified by CI run — 0 failures with all three skills + router present and legacy removed.
> AC-NF2 (Write Gate): verified by inspection — no source/config write before `APPROVE ADO-9000`; all IaC/runbooks are authored artifacts, never applied by the LLM.

---

### Revision Log
2026-09-07 — Story 3 (Replatform + packaging + retire) tech spec drafted from ADO-9000 ICEA + replatform.md.
