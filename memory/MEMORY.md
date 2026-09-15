# MEMORY.md — Project memory (dream-managed)

## 2026-09-14 — Decoupling audit + fixes (stack-neutral / company-agnostic)

**Architecture decision — coupling lives in *emitted templates*, not skill logic.**
A 3-iteration LLM-as-judge audit found the plugin's skill *headers/logic* were already
stack-neutral, but the **templates skills emit** still hardcoded `.NET/Angular/Node.js`
(the real leak). Pattern to remember: when auditing for stack/company coupling, check the
reference/template bodies a skill outputs — not just the SKILL.md prose.

**What worked / conventions confirmed:**
- Fixed Data Access Convention in `CLAUDE.md` + `_project-deploy/CLAUDE.md` to be
  stack-conditional (per-stack bullets), not an unconditional "Always use Dapper / never EF Core".
- Stack-context fallback in `icea-feature`, `critic`, `pr-describe` now says "No stack is
  assumed" → resolve via `architecture.md` → `.claude/dream-init-state.json`
  (`repo_type`/`detected_stacks[]`) → ask the developer. Never assume a default stack.
- Emitted templates (`ado-tasks/references/task-formats.md`,
  `icea-feature/references/ado-description-template.md`,
  `pr-describe/references/pr-description-template.md` + its SKILL checklist) now derive layers
  from the active stack ("one line/section per active layer"), with .NET/Angular shown only as
  labelled examples.
- Marketplace `owner.name` was the dev's personal name ("Vivek Rawat") in source and
  "Product Engineering" hardcoded in install.sh/.ps1/.cjs. Now: source uses "Your Company"
  placeholder; installers write `$COMPANY`; `sync-config.sh`/`.cjs` propagate `owner.name = cfg.company`.
- No "Kirkland/K&E" literals remain in shipping content (docs/ case-studies are exempt/expected).

**Gotcha:** `Grep` tool times out (~20s) on the OneDrive-synced repo path, especially with
parallel calls. Use per-file scoped greps, `Read`, or delegate to Explore agents that manage
their own search budget.

**Regression guard added** — `tests/validate.js` › "Decoupling guards" section:
(a) denylist scan for company/personal identity in shipping content;
(b) Data Access Convention must be stack-conditional;
(c) the 3 skills must say "No stack is assumed";
(d) the 3 emitted templates must be layer-driven (contain "active layer", no `.NET API:` / `EF Core Entity:` / `.NET: FluentValidation` / `Angular: OnPush`).
Validator: 309 passed / 0 failed after changes.

---

## 2026-09-14 — ADR 0062: migration family de-coupled from checkpoint-schema.md

**Decision (ADR 0062):** The Upgrade/Rewrite/Replatform family now owns its source/target
"mode" on its OWN ledger (`migration-ledger-schema.md`), not on `checkpoint-schema.md`.
Root cause: when the monolithic `migration` skill was retired (ADR 0061), two blocks describing
its old `.claude/migration-checkpoint.json` were left behind in `checkpoint-schema.md` (the
scan-resume checkpoint owned by code-review/security): the `mode` block (schema_version 1.11)
and the `goalLoop` block. Neither had a live writer in the family.

**Field reconciliation (proven before editing):** `mode.source_token/source_version/target_version`
already duplicated ledger CORE `source.{stack,from,to}`; `source_roots` was the ONLY field with no
ledger home; `graph`/`track`/`target_token` and the entire `goalLoop` block were dead (referenced
nowhere live).

**Change set:** (1) added additive optional `source.roots` to ledger CORE; (2) repointed
`tests/validate.js` multi-root assertion from checkpoint-schema → migration-ledger-schema
(`source.roots`); (3) realigned `feasibility-spec.md` + `migration-source-detect.cjs` comment to
`source.*` vocabulary; (4) realigned `goal-loop-spec.md` cross-drop guidance/R3 to parent-owned
checkpoint/ledger; (5) deleted both orphaned blocks from `checkpoint-schema.md`; catalogued ADR
0060/0061/0062 rows in `docs/adr/README.md`.

**Gotcha (critical):** `validate.js:209` HARD-asserted `checkpoint-schema.md` contains `source_roots`
— deleting the block WITHOUT repointing that assertion would have failed the build. Always grep
tests/validate.js for a string before deleting the doc that carries it. Verified: deleting the block
makes checkpoint-schema lack `source_roots` (old assertion would fail), ledger now carries it (new
passes).

**Gotcha:** `validate.js` `ok()` is silent unless `VERBOSE` — per-assertion passes don't print; only
the final count and `bad()` failures show. Don't grep its stdout for a passing assertion label.

**Verification:** validate.js 309/0; migration-retirement 8/0; migration-specs 4/0; substrate-drift
6/0; graph-multiroot 4/0. Zero dangling refs to migration-checkpoint.json/goalLoop/mode.* remain in
skills/shared.

**Note:** No mechanical Write Gate in the plugin's OWN dev session — the enforcement hooks
(script-review-gate.cjs, findings-gate-precommit.*, context-budget-tech-write.cjs) live in
`_project-deploy/hooks/` and only deploy to TARGET projects. The `APPROVE ADO-{ID}` gate here is a
CLAUDE.md prompt convention, not hook-enforced.

---

## 2026-09-15 — ADR 0063: bundled-substrate manifest truth + real-artifact test (steps 1-2)

**Decision (ADR 0063):** `plugin.json → components.shared` is the SINGLE manifest of record for shared
specs; docs must stop hand-duplicating derivable facts. Terminology: "vendored" → "bundled" (keep the
noun "substrate"; reserve "vendored" for genuine third-party libs like graph-viz's mermaid/WebGL).

**Drift found (evidence README is NOT source of truth):** spec count claimed 41 (README) / 42
(DEVELOPER-GUIDE) / 45 (plugin.json) vs 46 on disk — four numbers, none matched. `multi-root-scan.md`
shipped on disk but was UNREGISTERED in components.shared.

**Applied (steps 1-2):** (1) registered `multi-root-scan` in plugin.json (now 46); (2) added a
`validate.js` guard asserting components.shared (as .md set) == `skills/shared/*.md` on disk minus
README, BOTH directions — CI now fails on manifest≠disk; (3) added a REAL-substrate test to
`substrate-drift.test.cjs`: vendors the actual skills/shared, asserts file_count==disk + drift-check
clean (the pre-existing synthetic cases only tested the drift ALGORITHM, not the real artifact).

**Deferred to a follow-up pass (steps 3-4):** the "vendored"→"bundled" rename across scripts/docs/ADRs,
and rebuilding README as current-state-only with the spec-list section GENERATED from plugin.json
(don't retype the drift-prone structure — make it un-driftable, preserve hand-prose like ADO-PAT
degraded mode + "rules for adding").

**Gotcha:** in `validate.js`, `p` (the parsed plugin.json) is BLOCK-scoped to section 1 — re-read via
`readJson('.claude-plugin/plugin.json')` when adding checks in later sections. `fs`/`path`/`ROOT` are
module-level.

**Note (source-of-truth hierarchy, learned this session):** trust executable code > plugin.json
manifest (verified vs disk) > tests > prose docs LAST. README/DEVELOPER-GUIDE/CHANGELOG are projections
that drift; do not cite them as authoritative.

**Verification:** validate.js 311/0; all 23 tests/*.test.cjs green (substrate-drift now 9/0 incl. 3 REAL
assertions).

---

## 2026-09-15 — ADR 0063 steps 3-4: "bundled" terminology + generated/rebuilt README

**Step 3 (terminology):** renamed the misleading verb "vendored/vendoring" → "bundled/bundling" for the
first-party substrate SEAM across `scripts/vendor-substrate.cjs`, `scripts/substrate-drift-check.cjs`,
`tests/substrate-drift.test.cjs`, and `migration-ledger-schema.md`. Per the agreed MINIMAL scope, KEPT
the filenames (`vendor-substrate.cjs`), the `.vendor/` default dir, and `substrate_version` key as
retained identifiers (flagged in README for an optional deeper rename). Genuine third-party "vendored"
usages (graph-viz's 3d-force-graph lib, stack-signals/module-derive dir pruning) were left untouched.

**Gotcha (lockstep):** the drift REASON strings (`'bundled copy edited'`, `'canonical changed since
bundling'`) are asserted by `substrate-drift.test.cjs` — rename script + test together or the test fails.
Also renamed manifest key `vendored_at`→`bundled_at` (no reader, safe). The banner still starts with
`<!-- GENERATED — DO NOT EDIT` so `stripBanner` + the banner-marked assertion still pass.

**Step 4 (README rebuild):** recreated `skills/shared/README.md` as CURRENT-STATE-ONLY (history →
CHANGELOG/ADRs). New `scripts/gen-shared-index.cjs` GENERATES the "Shared specs" table from
`plugin.json` → components.shared + each spec's H1, between `<!-- BEGIN/END GENERATED: shared-specs -->`
markers (modes: default print / --write inject / --check CI guard). Removed the orphaned migration
consumer rows + "Migration:" narrative + the unimplemented "prefer vendored at runtime" claim (replaced
with an accurate "seam is packaging-time only, not consumed at runtime" note). Preserved hand-prose
(ADO-PAT degraded mode, rules for adding). Also fixed the same drift class in `DEVELOPER-GUIDE.md`
(hardcoded "42 specs" count; the now-doubly-wrong checkpoint-schema="Migration checkpoint 1.11"
description; personas "used by migration" claim).

**New CI guards in validate.js (ADR 0063):** (a) components.shared == disk both directions;
(b) `gen-shared-index.cjs --check` (README table not stale). Removed the redundant hardcoded `SHARED`
existence array (superseded by the manifest==disk guard) — this is why validate.js count went 311→300.

**Verification:** validate.js 300/0; all 23 tests/*.test.cjs green (substrate-drift 9/0 post-rename);
gen --check clean. Only genuine 3rd-party "vendored" mentions remain.

---

## 2026-09-15 — Goal-loop/rubric-score: removed orphaned `migration` refs (investigated adopt-vs-remove)

**Question investigated:** should the migration family (upgrade/rewrite/replatform) ADOPT the shared
goal-loop engine (goal-loop-spec + rubric-score-schema), or are the `migration (Stage 4)` refs pure
orphans? Two Explore passes → **adopting would be a category mismatch; remove the refs.**

**Why the goal-loop does NOT fit the family (decision record):**
- goal-loop measures functional COMPLETENESS: score an in-context artefact vs a verbatim rubric
  (percentDone + blocking), regenerate until 100% or a hard ceiling. That's icea-implement's domain
  (code vs ACs). Real consumers today: only `goal-loop` skill + `icea-implement` Step 4b.
- Family uses DIFFERENT completion models: rewrite = judge verdicts (PASS/REVISE/BLOCK) at design/impl
  gates + BAL (mechanical assurance MEASUREMENT, one-shot) + ERL + two-gate; upgrade = deterministic
  tool + one-shot verify + judge gates; replatform = NFR measurability ceilings + human reconciliation
  gate + judge gates. Bounded-revise is already served by the judge ladder (judge.md) — verdict-based,
  not rubric-score-based. Retargeting refs to the family would fabricate a non-existent consumer
  (the prose-vs-code drift ADR 0063 fights).

**Applied (Remove):** stripped `migration (Stage 4)` / `Shared by: migration` + generalized the
migration-specific body examples in `goal-loop-spec.md`, `rubric-score-schema.md`, and
`model-routing-spec.md:42`. Consumers now read `goal-loop` + `icea-implement` only.

**Gotcha:** rubric-score-schema had capital-`M` "Migration:" lines (L35, L37) a lowercase grep MISSED —
always re-grep case-insensitively before declaring an orphan sweep complete.

**Verification:** validate.js 300/0; gen-shared-index --check clean. Only correct family refs remain
(goal-loop-spec L177 "migration-family skill"; model-routing §CRITIC_MODEL_MAX "migration family").

**Flagged (out of scope):** rewrite's design/impl judge REVISE loops are "(bounded)" but the ceiling is
unquantified (unlike design-revision-spec's 5 / goal-loop's 3) — candidate future hardening.
