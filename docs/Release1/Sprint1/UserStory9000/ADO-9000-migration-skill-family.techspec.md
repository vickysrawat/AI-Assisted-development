# Epic Tech Spec — Migration Skill Family (Upgrade · Rewrite · Replatform)
ADO #9000 · Release 1 · Sprint 1
Status: DRAFT · EPIC · 76 SP total

> Artifact note: this epic ships **markdown skills + CJS scripts + JS test fixtures** inside the
> `ai-assisted-development` plugin — not an application. App-shaped template sections (Auth &
> Security, Request Flow, DB rollback) are mapped to the plugin's real equivalents: the Write
> Gate, the secrets guard, the LLM-authors-human-executes invariant, skill-invocation flow, and
> git-based reversibility. Sections with no plugin equivalent are marked "N/A — {reason}".
> Source design of record: `docs/plans/migrationSkill/` (README + upgrade.md + rewrite.md +
> replatform.md) and dated ADRs in `memory/MEMORY.md`.
>
> Epic-level spec note: per the icea-feature EPIC branch, the AC Coverage Matrix, Files Changed,
> Error Handling, and Test Cases sections are intentionally **not** in this epic-level spec — they
> live in each per-story spec (ADO-9000-Story-{N}-*.techspec.md).

---

## Overview

This epic replaces the single one-shape `migration` skill with **three fit-for-purpose,
isolation-deployable skills** over a shared, drift-checked substrate. **Upgrade** handles in-place
version bumps (same stack, higher version) as an *orchestrator of deterministic tools* against a
pre-upgrade baseline-commit oracle. **Rewrite** handles out-of-place code translation as a
*generative author*, decomposing in target space with per-cluster Behavioral Assurance Levels
(BAL) and an Enterprise-Readiness Level (ERL). **Replatform** handles the *hosting axis* (on-prem →
cloud) with a Non-Functional-Requirement / Well-Architected oracle and human-executed IaC, data,
and cutover runbooks. The governing pattern is **carve-on-locality** (in-place vs out-of-place vs
hosting axis) plus a **walking skeleton**: build Upgrade first, extract the shared substrate at the
second consumer (Rewrite, rule-of-three), then finish with Replatform + standalone packaging.

The family-wide invariant is **"LLM authors, human executes"** — anything touching real
infrastructure or data is authored (and rehearsed) by the LLM and executed by a human via
runbooks. Every skill surfaces an explicit assurance grade (BAL / ERL / NFR) with a mechanically
derived coverage denominator; **assurance honesty is gated, not advisory, for regulated/B-series
paths**.

**Scope boundaries — this epic deliberately does NOT:**
- Enable autonomous execution of prod infrastructure/data by default (a future-autonomy flag ships OFF).
- Support source stacks with no mapping reference (e.g. Python-as-source) — hard-stop, no fabrication.
- Bundle deterministic upgrade-tool binaries in the plugin — it checks + guides installation instead.
- Parallel-run the legacy `migration` skill — it is retired, not kept alongside.

---

## Story Breakdown

All implementation detail (AC Coverage Matrix, Files Changed, Test Cases) lives in each story's
individual tech spec linked below.

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Upgrade skill (MVP) + minimal inline substrate | 21 | Yes | None | [ADO-9000-Story-1-upgrade.techspec.md]() | ⏳ Pending |
| 2 | Rewrite skill + **extract** shared substrate (ledger, cache, judge, gate grammar) + vendored-copy seam | 34 | Yes | Story 1 | [ADO-9000-Story-2-rewrite.techspec.md]() | ⏳ Pending |
| 3 | Replatform skill + standalone packaging (CI drift-check) + retire legacy `migration` + future-autonomy flag | 21 | Yes | Story 2 | [ADO-9000-Story-3-replatform.techspec.md]() | ⏳ Pending |

> Deviation from the ≤5 SP shippable-slice heuristic is **intentional and developer-approved**: each
> story is a whole skill, not an app feature. Story 1 is the foundation story — it owns the *minimal
> inline substrate* (checkpoint envelope, gate grammar, feasibility spine, model-routing, minimal
> LLM-as-judge). Story 2 is where that substrate is **extracted** to `skills/shared/` at the second
> consumer (rule-of-three), so it owns the shared contracts later stories depend on. Each story's
> implementation ADO is expected to be further decomposed into tasks at `IMPLEMENT` time.

**Epic-level AC → Story allocation** (per-story ACs detailed in each story spec):

| AC | Story 1 | Story 2 | Story 3 |
|---|---|---|---|
| AC-F1 classify + reject false-upgrades | ● | | |
| AC-F2 tool preflight + install guidance | ● | | |
| AC-F3 gap/risk report + baseline/branch/commit-per-hop | ● | | |
| AC-F4 posture + options + BYO-design | | ● | |
| AC-F5 per-cluster BAL + ERL + gated completion | | ● | |
| AC-F6 design-quality gated (design + implementation) | | ● | |
| AC-F7 NFR spec + cloud-capability decomposition + human-executable runbooks | | | ● |
| AC-F8 NFR assurance + Well-Architected + behavioral regression | | | ● |
| AC-F9 LLM-as-judge separate model, risk-scaled routing | ◐ inline | ● extracted | |
| AC-F10 shared checkpoint ledger (envelope+core / payload) | ◐ inline | ● extracted | |
| AC-F11 vendored-copy + CI drift-check | | ◐ seam | ● CI-enforced |
| AC-F12 retire legacy + `MIGRATE` router | | | ● |
| AC-NF1 `tests/validate.js` green | ● | ● | ● |
| AC-NF2 Write Gate on all source/config writes | ● | ● | ● |

● = fully owned · ◐ = partial (seam/inline, completed in a later story).

---

## Auth & Security

> Mapped to the plugin's real safety model — there is no application auth here. The "actors" are the
> developer, the LLM, and CI.

**Authentication pattern:** N/A — the plugin runs inside the developer's authenticated Claude Code
session. Azure DevOps access (read-only, for `MIGRATE`/ICEA metadata) uses the existing
`AZURE_DEVOPS_PAT` env var / gitignored `settings.local.json` — **never** committed `settings.json`
(enforced by the existing write-time + pre-commit secrets guard).

**Authorisation / execution boundary (the epic's core control):** the LLM **authors and rehearses**;
a **human executes** anything that touches real infrastructure or data (Replatform IaC apply, data
migration, prod cutover). A future-autonomy feature flag sits behind an executor seam, ships **OFF**,
and — if ever enabled — still bars prod + regulated actions and graduates only by risk tier.

**Cross-cutting security / safety concerns:**

| Concern | Mitigation |
|---|---|
| LLM mutating a working app it should not (false-upgrade) | Story 1 classification + false-upgrade guard routes cross-runtime changes to Rewrite; in-place work runs on a branch off a baseline tag, commit-per-hop, reversible |
| Green report hiding an unverified risk (confidence failure) | Every completion report carries an assurance grade (BAL/ERL/NFR) with a mechanical coverage denominator; regulated/B-series hard-block below floor |
| Autonomous execution of prod infra/data | LLM authors + rehearses only; human executes via runbooks; future-autonomy flag OFF by default, prod/regulated always barred |
| Secrets leaking into committed config | Reuse existing secrets guard (write-time + pre-commit); PAT in env / gitignored local settings only |
| Un-gated source/config writes | Write Gate — no source/config file written to disk until `APPROVE ADO-9000` (AC-NF2) |
| Substrate drift across standalone bundles | Vendored-copy + `{version, content-hash}` manifest; CI drift-check fails the build on any vendored ≠ canonical (AC-F11) |
| Fabricated migration for an unsupported source | Hard-stop at intake when no mapping reference exists — no invented mapping |

---

## Overall Request Flow

```
Developer → MIGRATE ADO-{ID}  (or a skill keyword directly)
   → [Router — Story 3] detect source stack + intent
        → classify migration shape (locality + hosting axis)
             → in-place, same stack, higher version  → UPGRADE  (Story 1)
             → out-of-place, source ≠ target         → REWRITE  (Story 2)
             → hosting axis, on-prem → cloud          → REPLATFORM (Story 3)

UPGRADE:    detect → classify (reject false-upgrade → route to Rewrite)
            → web-grounded gap/risk report (cached, source-verified)
            → baseline TAG + branch → tool orchestration (commit-per-hop)
            → LLM residual remediation (per-fix Write Gate)
            → verify vs baseline oracle → post-upgrade recommendations

REWRITE:    intake → posture from stack distance → options (assurance×effort×TCO) or BYO design
            → decompose in TARGET space → dependency DAG → worktree-per-cluster
            → generate + design-quality gate + per-cluster BAL + ERL
            → merge gate (provisional BAL) → completion gate (final BAL, hard-block for B-series)

REPLATFORM: NFR intake → cloud-capability decomposition (landing-zone Tier-0 first)
            → author IaC + migration/reconciliation/cutover/rollback runbooks
            → HUMAN executes (LLM never applies prod) → NFR assurance + Well-Architected grade
            → behavioral regression (reused golden-master)

All skills read/write ONE shared checkpoint ledger (envelope+core shared, payload skill-owned);
every gate emits an LLM-as-judge verdict (separate model, risk-scaled routing).
```

---

## Rollback

**Schema migrations:** N/A — the plugin has no database. All artifacts are markdown/CJS/JSON files
under version control.

**Rollback procedure (per story merge):**
1. Revert the story's feature branch merge (`git revert` / branch delete) — all skill files are additive under `skills/`.
2. For Story 3 only: restore the legacy `skills/migration/` directory and revert the `MIGRATE` keyword handler in `CLAUDE.md` §0a + `.claude-plugin/plugin.json` until the router is re-validated.
3. Run `node tests/validate.js` — must return 0 failures (AC-NF1) to confirm the plugin is coherent post-rollback.

**Migrations the *produced* skills author** (Upgrade/Replatform) carry their **own** rollback inside
the runbooks/baseline-tag they generate — that is a runtime concern of a migration *run*, not of
shipping this epic.

**Per-story rollback:** each story tech spec contains story-level rollback detail.

---

## Handover

### QA Team

**What was added:** three new skills (`skills/upgrade/`, `skills/rewrite/`, `skills/replatform/`),
an extracted shared substrate under `skills/shared/`, a `MIGRATE` router, standalone-packaging build
+ CI drift-check, and retirement of the legacy `skills/migration/`.

**Test entry points:**
- Story 1: fixture repos per stack (.NET, Angular, Java, Python, Node) at a known version under `tests/fixtures/upgrade/`; assert correct classification (incl. false-upgrade rejection), tool selection, baseline-tag + commit-per-hop, and a well-formed gap/risk report; assert graceful RED handling. Run `node tests/validate.js`.
- Story 2: fixture source projects with a runnable oracle and a no-oracle case; assert target-space decomposition, posture selection, options presentation, per-cluster BAL weakest-link math, ERL grade, and the two-gate (merge/completion) behavior incl. B-series hard-block. Substrate extraction verified by drift-check.
- Story 3: on-prem fixture targeting a cloud; assert NFR spec capture, cloud-capability decomposition (landing-zone Tier-0 first), IaC + human-executable runbooks produced, LLM-does-not-apply assertion, standalone bundle passes CI drift-check, `MIGRATE` router routes with zero orphaned invocations.

**Regression risk:** the `MIGRATE` keyword and any in-flight migration checkpoints (Story 3
retirement). Verify existing plugin skills (icea-feature, code-review, app-readiness, critic) are
unaffected — the substrate extraction (Story 2) refactors `skills/shared/` and must not change
behavior for existing consumers.

**Test data:** committed fixture repos under `tests/fixtures/`; no external services required
(web-grounding is mocked/cached in tests).

### DevOps / Platform Team

| Item | Story | Detail |
|---|---|---|
| CI job: substrate drift-check | Story 3 | New `tests/` check fails the build on any vendored ≠ canonical or manifest mismatch (reuses `.hashes` pattern) |
| CI job: `node tests/validate.js` | All | Must stay green (0 failures) after each story merge (AC-NF1) |
| Standalone build step (vendor substrate) | Story 3 | Vendors `skills/shared/` into a bundle stamped `{substrate-version, content-hash}`, banner-marked GENERATED — DO NOT EDIT |
| Deprecation notice for `migration` skill | Story 3 | One-version deprecation notice; `MIGRATE` redirects to router |
| No new runtime infra / secrets / env vars | All | The plugin adds no services; reuses existing `AZURE_DEVOPS_PAT` |

### Future Developer — Follow-on Work

- The **shared substrate** lives at `skills/shared/` after Story 2 (extracted at the second
  consumer per rule-of-three). Extension points: the checkpoint **core** is additive-only (bump
  `schema_version`, keep tolerant-reader + merge-write); the migration-knowledge **cache** has three
  content classes (immutable breaking-change facts / volatile pricing / decision-precedent ADRs);
  the LLM-as-judge **model-routing** ladder is configurable via `CRITIC_MODEL` / `CRITIC_MODEL_MAX`.
- The **future-autonomy flag** is a Could-Have deferred capability — the executor seam exists
  (Story 3) but ships OFF; graduating it is out of scope for this epic and must re-enter the ICEA
  gate as its own work item.
- Adding a new source→target mapping: extend the mapping reference; never fabricate a mapping for an
  unsupported source (hard-stop is intentional).

---

## Definition of Done — Epic

The epic is done when ALL of the following are true:

**Delivery**
- [ ] All 3 story tech specs generated and saved (tracker shows all ✅)
- [ ] All stories implemented, reviewed, and merged (tracker Child ADO # filled)
- [ ] All child ADOs closed in Azure DevOps

**Quality**
- [ ] All story-level fixture and validation tests pass; `node tests/validate.js` = 0 failures (AC-NF1)
- [ ] Regression verified: existing plugin skills unaffected by substrate extraction; `MIGRATE` router has zero orphaned invocations
- [ ] No hardcoded secrets/PAT in any committed file (secrets guard green)

**Review**
- [ ] Epic tech spec reviewed by Tech Lead and Product
- [ ] Each story's PR maps changed files to ACs (AC Coverage Matrix)
- [ ] ICEA and all story tech specs committed in the feature branch
- [ ] Every completion report path surfaces an assurance grade with a mechanical denominator (no green report without a stated ceiling)

---

## Reviewer Checklist

- [ ] Story 1 minimal inline substrate is genuinely minimal — not a speculative abstraction (extraction deferred to Story 2)
- [ ] Story 2 substrate extraction changes NO behavior for existing consumers (icea-feature, critic, app-readiness) — drift-check + `validate.js` green
- [ ] Checkpoint core is additive-only; tolerant-reader + merge-write preserved (skew-safe across skill versions)
- [ ] "LLM authors, human executes" holds everywhere real infra/data is touched — no autonomous apply path reachable with the flag OFF
- [ ] Assurance honesty is **gated** (hard-block), not advisory, on regulated/B-series paths — not value-engineered into a warning
- [ ] False-upgrade guard rejects all cross-runtime cases in fixtures (.NET Framework→.NET, AngularJS→Angular, Py2→3, WebForms→Blazor)
- [ ] Vendored copies are byte-identical to canonical (drift-check) and banner-marked GENERATED
- [ ] `MIGRATE` router: every legacy invocation shape maps to Upgrade/Rewrite/Replatform — no orphans
- [ ] No AC Coverage Matrix gaps in any story (all ACs → files, all files → ACs)

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None. All major architectural forks were decided during design and recorded in `docs/plans/migrationSkill/` + `memory/MEMORY.md`. The future-autonomy flag is a deferred capability (default OFF), not an open decision. | — | — | Resolved |

> All open questions must be resolved before SAVE TECH. No CONFIRM bypass. — None remain.

---

## Revision Log

2026-09-07 — Epic tech spec drafted from ADO-9000 ICEA + design docs (docs/plans/migrationSkill/).
