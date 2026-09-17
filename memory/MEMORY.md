# MEMORY.md — Project memory (dream-managed)

## 2026-09-17 — Migration architecture docs refreshed for the source-context intake gate + exit-range drift

**Root cause of staleness.** `docs/architecture/{upgrade,rewrite,replatform,legacy-migration,migration-glossary}.md`
were written 2026-09-14; the 2026-09-16 refactor (commit `9532c9f`, ADR 0062) added the fail-closed
**source-context intake gate** (`scripts/intake-verify.cjs` + `source-context-intake-spec.md` +
Source Context Manifest) and ledger `source.roots`/`source_context` — none of which the docs
captured. The docs' only use of "intake" was the R1/Step-1 *stage* name, never the new *gate*.

**Gate mechanics (verified, for future doc/skill work).** `intake-verify.cjs verify` exits
**0/2–9** (9 = cross-cutting scan missing/empty/uncited); `check-gate` re-validates from the ledger
(0/10/11) so a hand-set gate isn't trusted. Per-skill fail-closed chain point: rewrite = Step 1.5,
`rewrite-decompose.cjs decompose` calls check-gate first; replatform = R1, `replatform-plan.cjs plan`
calls it first; upgrade = Step 3, the **report gate** is the keystone (`upgrade-checkpoint.cjs
set-gate --gate=report` refuses unless PASS — upgrade has no options stage to guard).

**Convention confirmed.** These 5 files are prose+Mermaid *explainers* (not the skill source) and
carry a consistent extended metaphor — rewrite = building a house, replatform = relocating a
business, upgrade = a medical visit. Match that voice when editing. `legacy-migration-skill.md`
documents the RETIRED monolithic skill (schema 1.10) — the intake gate does not apply retroactively;
leave it. There is **no Mermaid linter** in the repo (diagrams render on GitHub) — verify diagram
edits manually (node ids declared before use, balanced `{}`/`[]`, intact flow direction).

**Drift also found + fixed in source.** All three SKILL.md files understated the verify range as
`2–8`; corrected to `2–9` (rewrite:133, replatform:103, upgrade:161) through the Write Gate. ADR
0062 filename is `0062-migration-mode-on-ledger.md` (not `...-source-target-mode.md`). Verified:
`node tests/validate.js` → 324/0; `node tests/intake-verify.test.cjs` → 17/0; all newly cited paths
resolve.

## 2026-09-16 — Plugin version single-source model + which docs are tracked vs. intentionally untracked

**Convention confirmed.** `.claude-plugin/plugin.json` "version" is the SINGLE SOURCE OF TRUTH.
Version references fall into three tiers: (1) **hard-enforced derived copies** — CLAUDE.md
`# Plugin version:` label and CHANGELOG `[X.Y.Z]` entry (auto-propagated by
`scripts/bump-version.js`; `marketplace.json` must carry NO version); (2) **warn-only narrative
docs** — `guides/*.html` `documents-plugin-version:` stamps + inline `vX.Y.Z` markers, and (now)
the `README.md` `**Version X.Y.Z**` prose header; (3) **intentionally untracked** —
`WHITEPAPER.md` is a point-in-time essay and is deliberately NOT flagged by the guard (user
directive). `scripts/check-version-consistency.js` is the drift guard; `bump-version.js` wraps it.

**Recurring cause of drift.** `bump-version.js` only auto-writes tier 1 — guides + README only get
a *reminder*, so they silently lag each release. Fix when re-stamping guides: also add the new
`[X.Y.Z]` row to each guide's "What's new since 3.0.0" `<ul>` (developer-guide.html has NO such
list — stamp-only). Re-stamping alone is dishonest per the guard's own "update content AND stamp".

**Action (3.24.0→3.25.0 catch-up).** Re-stamped all 3 guides + README to 3.25.0 (added 3.25.0
multi-root-scanner changelog rows to user- & plugin-guide), and hardened the guard + bump script
to warn on README drift (whitepaper excluded per user). Verified: `check-version-consistency.js`
exits 0 clean; README regex confirmed to fire on simulated drift.

## 2026-09-16 — Retired legacy `skills/command-stubs/`; deployable stubs live only in `_project-deploy/commands/`

**Convention confirmed.** There are three parallel stub sets and they are NOT interchangeable:
top-level `commands/` = the plugin's OWN dev-session slash commands (rich: model routing,
`$PLUGIN_DIR` resolution, full task steps); `_project-deploy/commands/` = the CANONICAL
deployable stubs shipped into target projects (quoted `description` + `Example:`, `argument-hint`,
`--help` verbatim block, fully-qualified `<skill>ai-assisted-development:X</skill>`);
`skills/command-stubs/` = LEGACY, thin old-format (`<command>X</command>` / bare `<skill>X</skill>`),
superseded per DEVELOPER-GUIDE.md:44 and docs/migrations/017-3.7.0.md:12.

**Action.** Deleted `skills/command-stubs/` entirely (34 tracked files). Verified safe first:
description-diff showed every legacy stub was a strict *subset* of its deploy counterpart (nothing
to back-port), and no `scripts/`/hooks/config reference the folder (only changelog/tracker mentions).
The ONE legacy-exclusive file, `articulate-as-human.md` (added today to the wrong folder), was ported
to `_project-deploy/commands/articulate-as-human.md` in deploy format BEFORE deleting.

**Reusable heuristic.** When a new command stub is added, it goes in `_project-deploy/commands/`
(deploy format) — never `skills/command-stubs/`. Before deleting a "legacy" folder, diff its files
against the successor to prove it's a subset, and grep scripts/hooks/config for live references.

## 2026-09-16 — Replatform R5 wired to the NFR oracle (docs-vs-code drift closed) — IMPLEMENTED

**Lesson — a shipped engine can be silently disowned by its own skill's prose.** The same
LLM-as-judge fact-check pass found that `skills/replatform/SKILL.md` Step R5 still read
**"Deferred to Inc C (AC-F8)"** even though the AC-F8 machinery had *already shipped and was tested*:
`scripts/replatform-nfr-assess.cjs` (assess weakest-link + gate regulated-hard-block exit 16, **9/0**),
`references/nfr-assurance.md`, `references/well-architected.md`, and the `payload.replatform.NFR` ledger
field. The engine was cross-referenced by both reference docs, the architecture doc, the tracker, AND the
tech spec (AC-F8 "✅ Covered") — **everywhere except the skill's own stage flow.** The tracker even said
"Story 3 COMPLETE / AC-F8 delivered" while the skill's headline "prove-done" oracle was never invoked.

**Reusable heuristic:** "AC ✅ Covered" at the artifact level ≠ wired. When auditing, check that the
skill's **stage flow actually invokes** the script an AC claims — a passing unit test on a script proves
the engine, not that any skill calls it. This is the mirror of the earlier intake-gate lesson (a rule
gets skipped when nothing downstream depends on it) — here, an engine gets stranded when the stage flow
that should call it still says "deferred."

**Fix (D2 — wire it; skill + governance docs, NO new code):** R5 now invokes the existing tested engines:
per-NFR `replatform-nfr-assess assess`→`gate` (regulated-below-floor HARD BLOCK exit 16; `ceiling_flagged`
must be stated, never reported as fully measured) + Well-Architected assembly (reuse `app-readiness` ERL +
NFR pillars, no re-grade, no double-count) + golden-master pre→post smoke (execution-profile verify
subset) + two-gate "done" recorded to `payload.replatform.NFR` with per-gate judge verdicts. Removed the
`← Inc C` stage-flow marker + the "even while R5 is Inc C" caveat; added a Hard Rule. **No new script —
pure orchestration over already-tested engines, symmetric to Rewrite Step 4/5 calling `rewrite-bal`.**
R5 necessarily runs *after* the human-executed R4 cutover (the target must be deployed) — that's a runtime
dependency, not a missing capability.

**Decisions rejected:** flipping the tech spec's reviewer checkbox (that's a human PR-time action — used a
dated Revision Log entry instead); rebuilding any grader (the engine + WAF-assembly spec already existed);
docs-truth-up only (D1 — rejected: it would document the oracle as unwired rather than turn it on, when
turning it on cost only orchestration prose).

**Status:** IMPLEMENTED (scope: skill/scripts + governance docs, per developer). Shipped: `SKILL.md` R5
rewrite (invokes assess/gate/WAF/golden-master/two-gate/ledger) + stage-flow/caveat cleanup + new Hard
Rule; tech-spec Revision Log 2026-09-16; tracker fix-forward note; contest `06-migration-family.md` §6
updated (oracle now runs, honest "no real-move numbers yet"). Engine/refs/tests UNCHANGED. validate.js
green; replatform-nfr-assess 9/0.

---

## 2026-09-16 — Rewrite decomposition: per-option target-space DAG (drift fixed) — IMPLEMENTED

**Architecture decision — differentiation lives in the INPUT graph, not a flag; the script stays a
pure topo-sorter.** An LLM-as-judge fact-check of the migration-family contest entry, followed by a
code trace, found two spec-vs-code drifts in `scripts/rewrite-decompose.cjs`:
1. **"Target-space decomposition" was actually source-space** — `decompose` only ever topo-sorted the
   source `graph.json`. No target-space graph is produced anywhere (`graph-derive-documents.cjs` builds
   only a *document-authoring* DAG, not a target component graph).
2. **`--option=<A|B|C>` was a silent no-op** — `SKILL.md` Step 2 told you to run decompose "per option"
   with `--option`, but `opDecompose()` never read it. Every option got an identical DAG; the only real
   axis of variation was `--group-by-domain`.

**Root cause (single, reusable lesson):** `decompose` is a *generic topo-sorter* fed one input (the
source graph) identically for every option. "Target-space" and "per-option" are properties of the
**input graph**, not of the sorter or a flag. The user's key insight: at the options phase there is
**no target application yet**, so reusing the source graph for every option is wrong — it's neither
target-space nor differentiated.

**Locked design (skill/scripts scope only — tech spec + tracker left as historical, per developer):**
- The per-option DAG is an **LLM design act fed to a pure sorter**: for each candidate option, project
  the source graph through *that option's* posture (a `port` ≈ source seams; `re-architecture`
  merges/splits/re-layers) and feed it via `--modules/--edges` or a small per-option graph file.
  Different option ⇒ different projection ⇒ genuinely different DAG.
- **`port` is the ONE honest source≈target case** (same lang+fw) where reusing the source graph is
  legitimate; `re-architecture`/`rewrite-from-spec` require a reshaped projection.
- **Provenance labeled:** DAG basis is `INFERRED` at options time (no target app exists), re-derived and
  promoted to `computed` after `APPROVE DESIGN` from the authored `target-component-architecture.md`
  (new SKILL Step 2.5 step 5).
- Script gained only a `--space=source|target` **provenance** flag (echoed into output, default
  `source` for back-compat); `readGraph()`/`topoWaves()` reused unchanged — their generality was the
  whole point. **No `--option` flag added** (it was the wrong mechanism).

**Decisions rejected:** wiring `--option` as a real flag (differentiation belongs in the input, not a
flag); making the script itself do target-space transformation (that's LLM design judgment, must stay
behind the gates); downscoping the docs to "source-space" (the user correctly wanted the capability made
*real*, not the claim shrunk); emitting a concrete `git worktree add` runbook from decompose (rejected —
worktree lifecycle is a gated, verdict-dependent generation loop, not a static runbook, and decompose
has no target-folder knowledge).

**Status:** IMPLEMENTED (plan-mode approved, skill/scripts scope). Shipped: `--space` flag + header
rewrite in `rewrite-decompose.cjs`; `SKILL.md` Step 2 (per-option projection, `--option` removed),
Step 2.5 step 5 (re-derive committed DAG), description/stage-flow/Step 3 + 2 new Hard Rules;
`references/options-and-tco.md` (DAG-shape row + posture→projection table + rule); 5 new tests in
`tests/rewrite-decompose.test.cjs` (16/16 pass, incl. different-input→different-DAG and `--option`-is-a-no-op).
validate.js 300/0. Contest entry `06-migration-family.md` refreshed (claim now backed, not hedged).
**Gotcha:** in bash, `--edges=a>b` triggers shell redirection — quote it (`"--edges=a>b"`); tests are
unaffected because they use `spawnSync` (no shell).

---

## 2026-09-15 — Source-Context Intake Gate (migration family) — DESIGN LOCKED

**Architecture decision — make intake reads unskippable via a fail-closed shared gate.**
A migration run produced gappy design docs because intake made decisions BEFORE reading the
source's own CLAUDE.md, architecture docs, and `additionalDirectories` (Tier 2 deps). Root cause
(the reusable lesson): **a rule gets skipped when nothing downstream depends on it having been
done** — `integration-verification-spec.md` already said "Tier 2 REQUIRED" and it was still
skipped. Prose hard rules are necessary but insufficient.

**Locked design** (design of record: `docs/plans/migrationSkill/source-context-intake-gate.md`):
- Shared substrate across all 3 skills (upgrade · rewrite · replatform), not rewrite-only.
- Turn "reading" into a verifiable **Source Context Manifest** with resolvable `PROV: path#line`
  citations (no citation / dangling citation = not read).
- New `scripts/intake-verify.cjs` (pure/read-only like `strategy-resolve.cjs`): `verify` (exits
  0/2/3/4/5/6) + `check-gate`. Reuses `scanRoots()` from `multi-root-scan.md` — never re-improvise
  root logic.
- **Keystone = ledger chaining:** downstream step refuses without `stage_gates.intake_context=PASS`.
  rewrite → `rewrite-decompose decompose`; replatform → `replatform-plan plan`; upgrade (asymmetric,
  no downstream script — report is LLM-authored) → `upgrade-checkpoint set-gate --gate=report` refuses.
- Ledger fields are **core** (shared, additive): `stage_gates.intake_context` + `core.source_context`.
- Unwired-dependency detection = **script heuristic + judge** (deps named in source docs but not in
  `additionalDirectories` → exit 6). Per-skill manifest depth (upgrade lighter, rewrite deepest).
- **Source-coverage dimension (D7, full accounting — all three skills):** the deepest root cause is
  that migration skills are architected to AVOID reading full source (token economy — they lean on
  `graph.json` + targeted reads), so they translate a *description* of the code, not the code.
  Fix: manifest gains a Source Coverage section; `intake-verify.cjs` reads `graph.json` as the
  denominator (degrade to file enumeration if absent) — every module must be `mapped` or
  `out-of-scope` (exit 7 on a silent drop), and behavior-bearing units must cite an actual **source**
  `file#line`, not a doc (exit 8). `check-gate` re-validates `mapped+out_of_scope==total`. Rejected:
  risk-weighted / per-skill coverage (both reopen the silent-drop gap). Ledger `core.source_context`
  now carries `modules_total/mapped/out_of_scope`.

**Decisions rejected:** prose-only enforcement; rewrite-only scope; gating upgrade at the baseline
tag (too late); judge-only unwired detection; per-skill payload ledger placement.

**Status:** IMPLEMENTED (skip-ICEA path, behind Write Gate, ADO-9000). Shipped: new spec
`source-context-intake-spec.md`; new `scripts/intake-verify.cjs` (verify/check-gate) + `tests/intake-verify.test.cjs`
(9/9 pass); ledger schema core fields; wiring in all 3 SKILL.md (rewrite Step1.5+Step2, upgrade
Step3+report-gate, replatform R1+R2) + integration-verification-spec cross-link. validate.js 300/0.
CI auto-runs the test via `azure-pipelines.yml` glob `tests/*.test.cjs` (no manifest to update).
**Gotcha (script bug caught in test design):** the first citation extractor matched ANY filename-like
token in prose → false-positive dangling-citation on real manifests. Fix: only treat `path#anchor`
tokens (with an explicit #line/#section) as PROV citations. Lesson: an over-broad citation regex
punishes legitimate prose — require the anchor.
**Gotcha confirmed again:** post-code-gen oracle runbook + comparison script belong to
`golden-master-spec.md`, NOT this intake gate — kept out of scope deliberately.

---

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
- Marketplace `owner.name` was the dev's personal name in source and a team name hardcoded
  in install.sh/.ps1/.cjs. Now: source uses "Your Company"
  placeholder; installers write `$COMPANY`; `sync-config.sh`/`.cjs` propagate `owner.name = cfg.company`.
- No company/personal identity literals remain in shipping content (docs/ case-studies are exempt/expected).
  The `validate.js` identity guard derives its denylist at runtime (git identity + `IDENTITY_DENYLIST`)
  rather than hardcoding any name, so the guard itself carries no literal.

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

## 2026-09-16 — ADO-9000: hardened intake-verify.cjs cross-cutting scan enforcement (exit 9)

**Audit finding (fix #4 of the rewrite-intake gap set):** the cross-cutting concern scan was
NOT mechanically enforced. `intake-verify.cjs` had zero "cross-cutting" logic — an EMPTY scan
section passed `verify` silently (exit 8 only flags *existing* behaviour rows cited to docs; it
can't detect an absent/blank scan). The judge was assigned the check by
`source-context-intake-spec.md:54` but `judge.md`'s rewrite rubric list omits the intake gate and
NO rubric artifact backs it → the check was a naked, unrubriced LLM instruction. This is exactly
how errorHandler/eventTracer/conversationTracer infra behaviors slipped through the failed rewrite.

**Applied:** added exit code 9 to `verify` — cross-cutting section must be PRESENT; deep-scan skills
(rewrite/replatform) require ≥1 table row AND ≥1 resolvable **source** (non-doc) citation; upgrade is
lenient (delta-only: blank section must carry an explicit none/no-delta/N/A marker or it's a stub).
Reasons: `cross-cutting-missing|empty|uncited|stub`. Mirrored a re-validation into `check-gate`
(keystone — a hand-set `intake_context=PASS` still can't bypass it), reading `sc.skill` from the ledger.

**Convention confirmed:** intake-verify keys on markdown TABLE rows (`tableRows()` parses only
`|`-delimited lines) — free-form prose in a manifest section is invisible to the script. Any new
manifest section that must be enforced has to be authored as a keyword-tagged table with `file#line`
PROV citations. Happy-path test fixture (`goodManifest`) must include every enforced section or the
new check breaks the existing exit-0 test.

**Verification:** `node tests/intake-verify.test.cjs` → 14 passed · 0 failed (5 new: missing/empty/
doc-only → 9, upgrade none-note → 0, check-gate keystone → 11).

**Still open (NOT fixed here — judge's job):** completeness (were ALL real concerns found?) is not
verifiable mechanically. Follow-ups: broaden exit-8 behaviour keyword set to include infra terms
(logging/auth/tracing/error-handling/interceptor/middleware/filter); author a real intake-gate judge
rubric enumerating concern classes + a "source has package X ⇒ scan must address X" mapping; ship a
Source Context Manifest template so authored manifests are parseable.

## 2026-09-16 — ADO-9000: intake cross-cutting hardening follow-ups 1–3 (completeness layer)

Landed the three follow-ups flagged after the exit-9 fix:
1. **Broadened exit-8 keywords** (`intake-verify.cjs`) to include infra concern terms
   (logging·auth·authentication·authorization·authn·authz·tracing·telemetry·error-handling·
   exception·interceptor·middleware·aspect·cross-cutting·caching·resilience·retry·validation).
   An infra row cited to a doc now trips exit 8, same as `business-logic` did.
2. **Authored a real intake-gate judge rubric** — added a "Shared (all three)" bullet to `judge.md`'s
   per-skill list + a "## Judge rubric — intake gate" section in `source-context-intake-spec.md` with a
   concern-class → detection-signal table (source has X ⇒ scan must address X). Security concern
   present-but-unaddressed → BLOCK; other missing concern → REVISE. Calls out WCF `<behaviors>`
   (errorHandler/eventTracer/conversationTracer) as the classic blind spot from the failed run.
3. **Shipped `source-context-manifest-template.md`** (specs/) — pre-seeded concern rows + verifier-shaped
   tables; referenced from the spec's artifact section and rewrite SKILL.md Step 1.5 §3.

**Gotcha (ordering):** exit 8 runs BEFORE exit 9. Broadening exit-8 keywords meant the old
`doccc` fixture (logging→arch.md#L1) started tripping exit 8 not 9 — had to switch that fixture to
prose-only rows (no #anchor → citations()=[] → exit-8 skipped → exit-9 uncited owns it) and add a
separate infra-8 test. Layering rule: exit 8 = a behaviour row WITH citations that are all docs;
exit 9-uncited = a cross-cutting section with rows but NO resolvable source citation at all.

**Verification:** `node tests/intake-verify.test.cjs` → 15 passed · 0 failed;
`node scripts/gen-shared-index.cjs --check` → clean. specs/* is evergreen in freshness-manifest
(no registration needed for the new template).

**Division of labor now explicit:** script proves the scan EXISTS + is source-cited (mechanical,
exits 8/9); judge proves it is COMPLETE (semantic, rubric-driven). The script cannot know what
concerns a given source *should* have — that's the rubric's job.

## 2026-09-16 — ADO-9000: cross-cutting made first-class (per-row grounding, exit 9)

**Bug found by user after the follow-ups landed:** exit-9's grounding check was SECTION-WIDE
(`ccSourceCites.length` over the whole cross-cutting section). One properly source-cited row vouched
for the entire section, so a doc-cited or uncited concern whose name was OUTSIDE the exit-8 keyword
list rode along masked → missed. Keyword-dependence was exactly what we were trying to escape.

**Fix:** rewrote the exit-9 deep-scan check to be PER-ROW. Added `tableDataRows()` helper (excludes
markdown separators AND the header row of each contiguous table block — robust to tables with OR
without a `|---|` separator; first non-sep pipe-row of a block = header). Every concern data row must
now carry ≥1 resolvable SOURCE (non-doc) citation; any ungrounded row → exit 9 `cross-cutting-uncited`
(lists offending rows). Independent of the exit-8 keyword list — a concern with any name is caught.
check-gate keystone switched to `tableDataRows` too (header-only no longer masks as "has rows").

**Layering now (final):** exit 8 = a behaviour row WITH citations that are all docs (keyword-gated,
manifest-wide); exit 9 = cross-cutting section missing / no data rows / ANY data row not source-grounded
(per-row, keyword-independent). Belt-and-suspenders: a doc-cited cross-cutting row is caught by exit 8
if its name matches a keyword, else by exit 9 per-row — it cannot be missed either way.

**Gotcha (header detection):** `tableRows()` keeps header rows; a header has no citation so per-row
grounding would false-positive on it. `tableDataRows()` drops headers. Fixtures/templates here omit
the `|---|` separator, so header detection is POSITIONAL (first pipe-row of a contiguous block),
NOT separator-based — a separator-based rule silently failed on the no-separator goodManifest.

**Verification:** `node tests/intake-verify.test.cjs` → 17 passed · 0 failed. Decisive new tests:
`maskcc` (source-cited + doc-cited sibling, feature-flags name not in keyword set → exit 9, was exit 0
before) and `headcc` (header-only table → exit 9 empty). gen-shared-index --check clean.
