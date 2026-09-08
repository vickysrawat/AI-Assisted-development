# Tech Spec — Story 2: Rewrite Skill + Extract Shared Substrate
ADO #9000 · Story 2 · Release 1 · Sprint 1
Status: DRAFT · 34 SP

> Artifact: a new markdown skill (`skills/rewrite/`) + the **extraction** of the shared substrate
> from Upgrade (Story 1) + Rewrite (this story) into `skills/shared/` (rule-of-three: two consumers
> now exist). App-shaped sections mapped to plugin equivalents; N/A sections state why.
> Design of record: `docs/plans/migrationSkill/rewrite.md` (T1–T4) + README (shared substrate).

---

## Overview

Story 2 delivers the **Rewrite** skill: out-of-place, generative, source → new-target-folder code
translation. Posture (`port` / `re-architecture` / `rewrite-from-spec`) auto-resolves from stack
distance — `port` only when same-language + same-framework; any language or framework change forces
re-architecture, at which point the skill asks whether to keep or redesign the architecture and
platform. The developer is shown **options with pros/cons** across three axes — **assurance ceiling
× effort × TCO** (onboarding + web-grounded recurring run-cost) — plus a **BYO-design escape hatch**
(image or design doc) held to the *same* scrutiny. Work is decomposed **in target space**, ordered
by a declared **dependency DAG**, and generated **one cluster per git worktree**. Each cluster gets
a **Behavioral Assurance Level (BAL, A→D, weakest-link, mechanical denominators)** and the whole
target an **Enterprise-Readiness Level (ERL)** reusing the `app-readiness` 8 domains, designed-in at
Tier 0. A **Design-Quality** layer (Simplicity / Readability / Maintainability / Testability) is
gated at both design and implementation and verified in generated code by the judge. A **two-gate**
model governs progress: a **merge gate** (provisional BAL, must be ≠ D) and a **completion gate**
(final BAL; hard-block for B-series below floor).

This story also performs the **rule-of-three extraction**: the minimal inline substrate from Story 1
plus Rewrite's needs are promoted into a single canonical `skills/shared/` — the **checkpoint ledger**
(envelope+core shared / skill-owned payload), the **migration-knowledge cache** (three content
classes), the **LLM-as-judge** layer (separate agent + separate model, risk-scaled routing), the
**gate-keyword grammar**, and **model-routing**. It establishes the **vendored-copy + drift-check
seam** (fully CI-enforced in Story 3).

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F4 | Target-space decomposition; posture from stack distance; options (assurance×effort×TCO); BYO-design | `skills/rewrite/SKILL.md`, `skills/rewrite/references/posture.md`, `skills/rewrite/references/options-and-tco.md`, `skills/rewrite/references/byo-design.md`, `scripts/rewrite-decompose.cjs` | ✅ Covered |
| AC-F5 | Per-cluster BAL (weakest-link, mechanical denominators) + ERL; gated completion (B-series hard-block) | `skills/rewrite/references/bal.md`, `skills/rewrite/references/erl.md`, `scripts/rewrite-bal.cjs`, `skills/rewrite/SKILL.md` | ✅ Covered |
| AC-F6 | Design-Quality gated at design + implementation; verified in generated code by judge | `skills/rewrite/references/design-quality.md`, `skills/shared/judge.md` | ✅ Covered |
| AC-F9 | LLM-as-judge extracted to shared: separate model, risk-scaled routing | `skills/shared/judge.md`, `skills/shared/model-routing-spec.md` | ✅ Covered (extracted) |
| AC-F10 | Shared checkpoint ledger (envelope+core / payload); skew-safe | `skills/shared/checkpoint-schema.md`, `scripts/checkpoint-ledger.cjs` | ✅ Covered (extracted) |
| AC-F11 (◐ seam) | Vendored-copy + drift-check seam (CI-enforced in Story 3) | `skills/shared/README.md`, `scripts/vendor-substrate.cjs`, `scripts/substrate-drift-check.cjs` | ✅ Seam covered |
| AC-NF1 | `tests/validate.js` green after merge (incl. no-behavior-change for existing consumers) | `tests/rewrite.test.cjs`, `tests/substrate-drift.test.cjs`, `tests/fixtures/rewrite/*` | ✅ Covered |
| AC-NF2 | Write Gate on all source/config writes | (process — existing hook) | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `skills/rewrite/SKILL.md` | AC-F4, AC-F5 |
| `skills/rewrite/references/posture.md` | AC-F4 |
| `skills/rewrite/references/options-and-tco.md` | AC-F4 |
| `skills/rewrite/references/byo-design.md` | AC-F4 |
| `scripts/rewrite-decompose.cjs` | AC-F4 |
| `skills/rewrite/references/bal.md`, `scripts/rewrite-bal.cjs` | AC-F5 |
| `skills/rewrite/references/erl.md` | AC-F5 |
| `skills/rewrite/references/design-quality.md` | AC-F6 |
| `skills/shared/judge.md` | AC-F6, AC-F9 |
| `skills/shared/model-routing-spec.md` | AC-F9 |
| `skills/shared/checkpoint-schema.md`, `scripts/checkpoint-ledger.cjs` | AC-F10 |
| `skills/shared/README.md`, `scripts/vendor-substrate.cjs`, `scripts/substrate-drift-check.cjs` | AC-F11 (seam) |
| `tests/rewrite.test.cjs`, `tests/substrate-drift.test.cjs`, `tests/fixtures/rewrite/*` | AC-NF1 |

**Coverage result:** all 8 ACs covered; no orphaned file changes ✅.

---

## Schema Changes

> Extends Story 1's inline checkpoint — see ADO-9000-Story-1-upgrade.techspec.md. This story
> promotes it to the **shared ledger** and adds the Rewrite payload. Not a DB schema — a JSON
> checkpoint contract.

| Artifact | Change | Detail |
|---|---|---|
| Checkpoint **core** (`skills/shared/checkpoint-schema.md`) | EXTRACT + versionise | `schema_version` · `skill` discriminator · `ado_id`/timestamps · source descriptor · `stage_gates` · `decision_log` · `judge_verdicts` · `phase_history`. **Additive-only**; tolerant-reader + merge-write |
| Checkpoint **payload** | ADD | `rewrite{clusters, BAL, ERL, DAG, posture}` (opaque to other skills) |
| Migration-knowledge cache | ADD 3rd class | decision-precedent ADRs (alongside immutable breaking-change facts + volatile pricing) |

---

## Files Changed

| File | Type | Purpose |
|---|---|---|
| `skills/rewrite/SKILL.md` | new | Skill entry: intake → posture → options/BYO → target-space decompose → DAG → worktree-per-cluster → generate + design-quality gate + BAL + ERL → merge gate (provisional BAL) → completion gate (final BAL) |
| `skills/rewrite/references/posture.md` | new | Posture resolution from stack distance (port only for same-lang+same-fw); re-architecture question set (keep vs redesign architecture/platform) |
| `skills/rewrite/references/options-and-tco.md` | new | Option presentation with pros/cons across assurance ceiling × effort × web-grounded onboarding + recurring run-cost (TCO); every price cited + dated |
| `skills/rewrite/references/byo-design.md` | new | BYO-design intake (image / design doc) held to the same critic scrutiny as generated options |
| `skills/rewrite/references/bal.md` | new | BAL A→D definitions; weakest-link rule; mechanical denominators; staged lifecycle (ceiling→provisional→measured→validated); hybrid + friction-proportional-to-risk gate |
| `skills/rewrite/references/erl.md` | new | ERL grade reusing app-readiness 8 domains; designed-in at Tier 0 (readiness backbone), not audited at the end |
| `skills/rewrite/references/design-quality.md` | new | Simplicity/Readability/Maintainability/Testability rubric; gated at design + implementation |
| `scripts/rewrite-decompose.cjs` | new | Target-space decomposition + dependency DAG emission + worktree scheduling plan |
| `scripts/rewrite-bal.cjs` | new | Computes per-cluster BAL (weakest-link) with mechanical coverage denominators |
| **Substrate extraction** | | |
| `skills/shared/checkpoint-schema.md` | modify (extract) | Promote Story-1 inline envelope to the shared core + payload split; document skew-safety |
| `skills/shared/judge.md` | new | LLM-as-judge layer: separate agent (artifact+rubric+ground-truth only) + separate model; adversarial-by-default; per-gate PASS/REVISE/BLOCK + session meta-judge |
| `skills/shared/model-routing-spec.md` | modify | Add three-tier judge ladder: `CRITIC_MODEL` → `CRITIC_MODEL_MAX` (Opus 4.8 @ max effort) → different-family panel for top-risk |
| `skills/shared/README.md` | modify | Document vendored-copy + drift-check governance + path resolution (canonical in-plugin / vendored standalone) |
| `scripts/checkpoint-ledger.cjs` | new | Shared single-writer ledger read/write with tolerant-reader + merge-write |
| `scripts/vendor-substrate.cjs` | new | Build step: vendor `skills/shared/` into a bundle, stamp `{substrate-version, content-hash}`, banner-mark GENERATED — DO NOT EDIT (seam; wired into CI in Story 3) |
| `scripts/substrate-drift-check.cjs` | new | Compare vendored vs canonical via `.hashes`; non-zero exit on drift (seam) |
| `skills/upgrade/**` | modify | Repoint Upgrade from its inline substrate to `skills/shared/` (behavior-preserving) |
| `commands/rewrite.md` + `.claude-plugin/plugin.json` | modify | Register `/rewrite`; skill metadata |
| `CLAUDE.md` §0a | modify | Add `REWRITE ADO-{ID}` keyword handler |
| `tests/rewrite.test.cjs`, `tests/substrate-drift.test.cjs` | new | Fixture + drift tests (see Test Cases) |
| `tests/fixtures/rewrite/{runnable-oracle,no-oracle}/` | new | One source with a runnable oracle, one without (caps BAL C/D) |

---

## Auth & Security

**Auth pattern:** N/A. **Security/safety analysis (Rewrite-specific):**

| Concern | Mitigation |
|---|---|
| Reporting success on a partial inventory / non-runnable oracle | BAL weakest-link with mechanical denominators; no-oracle clusters capped at C/D; ceiling shown in options **before** the developer commits (AC-F5, AC-F4) |
| B-series/regulated cluster shipped below assurance floor | Completion gate **hard-blocks**; named approver + reason required; no silent pass (AC-F5) |
| Judge rubber-stamping the generator's output | Judge is a **separate model** reading only artifact + rubric + ground-truth (not the generator's reasoning); adversarial-by-default; panel for top-risk (AC-F9) |
| Substrate extraction silently changing existing-consumer behavior | Drift-check + `tests/validate.js` must stay green; Upgrade repoint is behavior-preserving (AC-NF1) |
| Generated code that is untestable / unmaintainable | Design-Quality gated at design AND implementation; judge verifies in generated code (AC-F6) |
| BYO design smuggling in an unassessed architecture | BYO design held to the same critic scrutiny as generated options (AC-F4) |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Source cannot run and no reachable URL | Affected clusters capped at BAL C/D; ceiling surfaced in options before commit; not a hard failure |
| Same-lang+same-fw detected | Posture `port` offered; larger stack distance forces re-architecture with keep-vs-redesign questions |
| Developer supplies a BYO design | Runs the same critic scrutiny; if it fails the rubric, REVISE is surfaced — design is not silently accepted |
| A cluster is at provisional BAL D at merge | Merge gate **blocks** (provisional BAL must be ≠ D); developer must raise assurance or re-scope |
| B-series cluster below final BAL floor at completion | Completion gate hard-blocks with the named-approver message; no override without audit |
| Vendored copy ≠ canonical | `substrate-drift-check.cjs` exits non-zero; build/test fails (seam; CI-enforced in Story 3) |
| Extraction changes an existing consumer's behavior | `tests/validate.js` fails → extraction rejected until behavior-preserving |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F4 | Posture + options/TCO (web-grounded run-cost) + BYO + target-space decompose + DAG/worktree | 8 |
| AC-F5 | Per-cluster BAL engine + ERL (app-readiness reuse) + two-gate model | 8 |
| AC-F6 | Design-Quality rubric + judge verification in generated code | 5 |
| AC-F9/F10 (extract) | Extract judge + checkpoint ledger to `skills/shared/`; repoint Upgrade; skew-safety | 8 |
| AC-F11 (seam) | Vendor + drift-check scripts (seam) | 3 |
| AC-NF1 | Fixtures + rewrite/drift tests + no-behavior-change verification | 2 |
| **Total** | | **34** |

**Total SP: 34**
**Type: STORY** (child of EPIC ADO-9000) — the flagship; larger than the app-feature heuristic by
design. Decomposed at `IMPLEMENT ADO-9000 Story-2`.

---

## Definition of Done

**Implementation**
- [ ] All files in Files Changed created/modified as specified
- [ ] Substrate extracted to a single canonical `skills/shared/`; Upgrade repointed and behavior-preserving
- [ ] Checkpoint core is additive-only; tolerant-reader + merge-write implemented
- [ ] No hardcoded secrets; no `console.log` in production script paths
- [ ] `// DECISION:` comments on non-trivial choices (posture resolution, BAL weakest-link math, extraction boundary)

**Quality**
- [ ] Positive + negative unit tests pass (see Test Cases)
- [ ] Integration tests pass (runnable-oracle and no-oracle fixtures; two-gate behavior; B-series hard-block)
- [ ] `node tests/validate.js` = 0 failures, including **no behavior change** for existing consumers (icea-feature, critic, app-readiness) (AC-NF1)
- [ ] Drift-check passes on a freshly vendored bundle (seam)

**Review readiness**
- [ ] PR title: `[ADO-9000] Rewrite skill + shared-substrate extraction (Story 2)`
- [ ] PR description maps each changed file to its ACs
- [ ] ICEA + this story spec committed in the feature branch

### Reviewer Checklist

- [ ] Extraction changes NO behavior for existing consumers (drift-check + validate.js green)
- [ ] BAL denominators are mechanical (not judgment); weakest-link enforced per cluster
- [ ] No-oracle clusters are capped at C/D and the ceiling is shown BEFORE commit
- [ ] Completion gate hard-blocks B-series below floor (not a warning)
- [ ] Judge uses a separate model and reads only artifact+rubric+ground-truth
- [ ] Design-Quality is gated at BOTH design and implementation
- [ ] Posture `port` is offered ONLY for same-lang+same-fw

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None. | — | — | Resolved |

> Posture model, options/TCO, BAL two-gate, ERL shift-left, design-quality placement, and the
> extraction boundary were all decided in design (`docs/plans/migrationSkill/rewrite.md` T1–T4 +
> README shared-substrate) and recorded in `memory/MEMORY.md`.

---

## Request Flow

```
REWRITE ADO-{ID}
  → migration-source-detect.cjs (reuse) → source stack
  → posture from stack distance (port | re-architecture | rewrite-from-spec)
  → present OPTIONS (assurance ceiling × effort × web-grounded TCO)  OR  accept BYO design
       → BYO design → same critic scrutiny
  → rewrite-decompose.cjs → TARGET-space clusters + dependency DAG
  → for each cluster (worktree, scheduled by DAG):
       generate → design-quality gate (design+impl) → rewrite-bal.cjs (provisional BAL)
       → MERGE GATE (provisional BAL ≠ D)
  → ERL assembled from app-readiness domains (Tier-0 backbone)
  → COMPLETION GATE (final BAL; B-series hard-block below floor)
  → all gates emit an LLM-as-judge verdict (shared judge, risk-scaled model)
  → checkpoint written to the SHARED ledger (single-writer, merge-write)
```

---

## Rollback

Additive at the plugin level plus a **refactor** (substrate extraction). Rollback = revert the
feature-branch merge, which restores Upgrade's inline substrate and removes `skills/rewrite/`; re-run
`node tests/validate.js` (0 failures). Because extraction is behavior-preserving and drift-checked,
a mid-way failure is caught by CI before merge, not after.

---

## Handover

### QA Team
Two fixture sources under `tests/fixtures/rewrite/`: one with a runnable oracle, one without. Assert
target-space decomposition, posture selection, options+TCO presentation, per-cluster BAL weakest-link
math, ERL grade, and the two-gate behavior (merge blocks provisional D; completion hard-blocks
B-series below floor). Assert the substrate extraction leaves existing skills unchanged.

### DevOps / Platform Team
No new runtime infra/secrets. New scripts `vendor-substrate.cjs` + `substrate-drift-check.cjs` are the
**seam** — wired into CI in Story 3. `node tests/validate.js` must stay green (now also covers
no-behavior-change for existing consumers).

### Future Developer — Follow-on Work
`skills/shared/` is now the single canonical substrate. To change it: bump the substrate semver,
re-vendor, run drift-check, write an ADR, re-validate consumers (governance is a change process, not
just anti-drift). The checkpoint core is additive-only — never remove or repurpose a core field.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `rewrite-decompose.cjs` | source module graph | target-space clusters + acyclic dependency DAG | AC-F4 |
| P-U2 | `skills/rewrite/references/posture.md` logic | same-lang+same-fw | posture `port` offered | AC-F4 |
| P-U3 | `rewrite-bal.cjs` | cluster with full runnable oracle coverage | BAL A/B with mechanical denominator | AC-F5 |
| P-U4 | `checkpoint-ledger.cjs` | write rewrite payload alongside upgrade payload | both payloads preserved (merge-write); core additive | AC-F10 |
| P-U5 | `substrate-drift-check.cjs` | vendored == canonical | exit 0 (no drift) | AC-F11 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `rewrite-bal.cjs` | cluster with no runnable oracle | BAL capped at C/D; ceiling flagged | AC-F5 |
| N-U2 | posture logic | different language | `port` refused; re-architecture forced with keep-vs-redesign questions | AC-F4 |
| N-U3 | completion gate | B-series cluster below floor | hard-block; named-approver+reason message; no silent pass | AC-F5 |
| N-U4 | `checkpoint-ledger.cjs` | reader sees unknown newer core field | tolerant-reader ignores unknown; does not corrupt | AC-F10 |
| N-U5 | `substrate-drift-check.cjs` | vendored edited (≠ canonical) | non-zero exit; drift reported | AC-F11 |
| N-U6 | judge | generated code fails Design-Quality rubric | REVISE verdict; not merged | AC-F6 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Runnable-oracle rewrite | run skill on `fixtures/rewrite/runnable-oracle` | options+TCO shown; clusters generated; merge+completion gates pass; report shows per-cluster BAL + ERL | AC-F4/F5/F6 |
| INT-2 | No-oracle rewrite | run skill on `fixtures/rewrite/no-oracle` | affected clusters capped at C/D; ceiling shown before commit | AC-F5 |
| INT-3 | Extraction regression | run full `tests/validate.js` after extraction | 0 failures; existing skills behave identically | AC-NF1 |
| INT-4 | Vendored bundle | vendor substrate → drift-check | bundle stamped + banner-marked; drift-check exit 0 | AC-F11 |

> NF AC verification:
> AC-NF1 (`validate.js` green incl. no-behavior-change): verified by CI run — 0 failures + existing-consumer snapshot unchanged.
> AC-NF2 (Write Gate): verified by inspection — no source/config write before `APPROVE ADO-9000`.

---

### Revision Log
2026-09-07 — Story 2 (Rewrite + substrate extraction) tech spec drafted from ADO-9000 ICEA + rewrite.md.
