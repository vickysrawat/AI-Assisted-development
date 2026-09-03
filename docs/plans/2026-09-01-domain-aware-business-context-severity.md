# Plan — Domain-Aware Business-Context Severity (v3)

> **Status:** ✅ Implemented · **Created:** 2026-09-01 · **Implemented:** 2026-09-01
> **Source:** planning session (plan mode) · **ADR:** 0057 · **Migration:** 027 · **Version:** 3.16.0
> Lifecycle: 📋 Planned → 🚧 In progress → ✅ Implemented
>
> **Phase tracker:**
> - [x] Phase 1 — domain-aware core (5 shared modules, 2 agents, guard hook, ~20 consumers, seams, validators). `validate.js` 261/0.
> - [x] Phase 2 — cosmetic `B1–B7`→`B-series` rename across 38 skills/command files (docs/ excluded).
> - [x] Phase 3 — migration integration M2–M5.
>
> **Follow-ups before merge:** run `python tests/validate.py` + `node tests/runner.js` in CI
> (Python unavailable on the dev box; shared/agents parity replicated in node). F1 verified
> (PreToolUse hooks fire for subagent tool calls).

## Context

The plugin's business-context-severity model is hardcoded to the **legal/immigration
domain**. Every project that installs the plugin inherits legal triggers (attorney-client
privilege, immigration A-Numbers, hearing dates) regardless of its actual domain. There is
no domain-identification step in setup-init or architect today.

**Goal:** during plugin integration, (a) identify + record the project's business domain;
(b) make the B-series severity triggers used by all review skills reflect that domain, not
hardcoded legal; (c) work for fresh installs and backfill existing ones; (d) break nothing
(validator, existing skills, gitignore, teardown, ICEA flow).

**User-confirmed decisions:**
- **Trigger model:** *variable-length B-series, referenced generically.* Skills say "apply
  the B-series business-context triggers from the resolved file"; the count/content is
  domain-defined (fintech may have B1–B5, healthcare B1–B6, legal B1–B7). No fixed "7".
- **Preset nature:** *seed/checklist, LLM expands.* A preset is a per-domain checklist
  (regulatory frames + example triggers), not a canned table; the LLM derives the actual
  triggers from domain + the project's real architecture.
- **Ownership (SRP):** the domain-identification + generation logic lives in **one dedicated
  shared module** `skills/shared/business-context-generation.md` — single responsibility,
  single reason to change. architect, setup-init, the `SET DOMAIN` handler, and migration M2
  are **thin callers that invoke it** (thin-orchestrator + step-module pattern, as migration's
  `steps/` files). It is re-enterable via the `SET DOMAIN` handler. It is NOT embedded in
  architect (that would give architect two reasons to change and force migration to duplicate
  the logic).
- **Regulatory grounding:** *bounded, goal-based web-grounding loop* grounds the B-series in
  real cited regulatory frameworks; best-effort with an offline seed fallback. New
  external-call capability for this otherwise offline-first plugin — gated by the guardrails
  below.
- Canonical domain → **CLAUDE.md** (`Domain:` line). **config.json unchanged** (no script
  consumes the domain). `domain` mirrored to `.claude/dream-init-state.json` for the
  setup-sync backfill check only.

---

## Scope reality (measured file-by-file, corrected)

The literal `B1–B7`/`B1-B7` appears **105× across 58 files** (an earlier "112/59" figure
came from a looser regex matching bare `B1`/`B7` — discard it). Three tiers:

- **A · Behavior-critical — Phase 1 (~20 files):**
  - *A1 shared review engine + spec:* business-context-severity.md, three-pass-spec.md,
    phase-d-spec.md, secrets-scan-spec.md, change-tier-spec.md, icea-schema.md.
  - *A2 review skills applying overrides:* code-review (+ references/analysis-rules,
    references/webconfig-checks), security (+ references/pass1-patterns, pass2-personas,
    static-asset-audit, language-notes), checkin, critic, app-readiness, dynamic-scan,
    pr-spec-review, icea-review.
  - *A3 ICEA authoring:* icea-feature, references/icea-template.
  - *A4 meta-assessment:* plugin-readiness — carries a "business-context-severity.md B1–B7
    complete" check that, like validate.js, MUST become count-agnostic.
  - Inline legal-example fixes (4c) concentrate in five: app-readiness, critic,
    pr-spec-review, security/language-notes, icea-feature.
- **B · Cosmetic architect doc-gen vocabulary — Phase 2 (17 files):** 12 stack prompts +
  5 templates saying "flag B1–B7 sensitive data" (wrong count is shorthand, not a runtime
  severity decision).
- **C · Boilerplate / wording pointers — Phase 2 (~21 files):** Category-C consent
  disclaimers + descriptive header notes (ado-tasks, dream-rollback, graph-*, pr-*,
  product-docs, setup-*, sprint-metrics, icea-approve/implement/revise/status, README,
  architect provenance lines).

**Phasing decision:** ship **functional correctness now**; do the **cosmetic/boilerplate
rename ("B1–B7"→"B-series") as a mechanical follow-up.** Interim mixed vocabulary is not a
correctness break (architect still flags sensitive data; the wrong count is shorthand).
Rationale: a 59-file rename in one change is disproportionate and raises review risk;
correctness lives entirely in the functional set + fallback + validator.

---

## Changes (Phase 1 — functional, this change)

### 1. De-legalize the shared spec + add a seed-style preset library

**Edit [skills/shared/business-context-severity.md](skills/shared/business-context-severity.md)**:
keep the floor principle + override-disclosure format + "how each skill applies this".
Replace the legal B-table with a **generic, variable-length B-series fallback** (e.g.
B1 confidential/regulated data · B2 regulated individual identifiers · B3 irreversible
time-sensitive harm · B4 breach-notification exposure · B5 real PII in a static-serving
dir) — no legal specifics, no forced "vulnerable/physical-safety" slots. State that the
series length is domain-defined and that `.claude/business-context.md`, if present, takes
precedence.

**New [skills/shared/business-context-presets.md](skills/shared/business-context-presets.md)** —
**hybrid** per-domain content (register in `.claude-plugin/plugin.json` → `components.shared[]`):
- **`legal` = verbatim-locked table** — the current B1–B7, byte-for-byte. Regression-critical
  (it is the live deployment). Generation reproduces locked entries **exactly**; the §3.5
  grounding loop may only *augment* with `(project-specific)` additions, never rewrite locked
  entries.
- **`healthcare` / `fintech` / `ecommerce` / `govtech` / `generic` = seed checklists** —
  regulatory frames to consider + a few example triggers + universal always-apply triggers;
  the LLM derives the actual B-series (§3.5).

> **F2 (resolves an internal contradiction):** "legal byte-identical" and "presets are seeds
> the LLM expands" cannot both hold for legal — hence legal is locked, others are seeds.

### 2. Domain identification + generation — a dedicated shared module (SRP)

**New [skills/shared/business-context-generation.md](skills/shared/business-context-generation.md)**
— the single owner of this responsibility. It defines the ordered procedure:
- Infer the most likely domain (entity/table names, dependencies, `architecture-data.md` —
  or, for migration, the SOURCE inventory/architecture).
- Ask **one confirmation question** (legal / healthcare / fintech / ecommerce / govtech /
  generic / other) with the inferred domain pre-selected, **capture jurisdiction**
  (US / EU / UK / India / multi / other — required to scope regulatory queries), and
  **capture secondary sensitivities** (multi-domain apps) as free-text → project-specific
  B-entries. "other" → base on `generic` seed.
- Run the §3.5 grounding loop + synthesis (Change 3).
- Write the confirmed domain to **CLAUDE.md** (`Domain:` line, managed spot) and mirror to
  `.claude/dream-init-state.json` (`domain`, merge-on-write per
  [scripts/setup-init-bootstrap.cjs](scripts/setup-init-bootstrap.cjs) ~L1085/L1849).

**Thin callers (no logic, just invoke the module):**
- [skills/architect/SKILL.md](skills/architect/SKILL.md) — invokes it after `/init` (passing
  its already-loaded codebase read).
- [skills/setup-init/SKILL.md](skills/setup-init/SKILL.md) — sequences the architect call.
- `SET DOMAIN` handler — re-enters the module directly (cross-session).
- Migration M2 (Phase 3) — invokes the same module against the SOURCE. **No duplication.**

### 3. Generate `.claude/business-context.md` (seed → grounding loop → synthesis)

Produced by the Change-2 module using **architect's `APPROVED` draft convention** (draft →
write on exact word `APPROVED`) — NOT the ICEA Write Gate. Pipeline: matching seed → **§3.5
regulatory grounding loop** → LLM synthesizes the B-series (B1..Bn) from grounded facts +
architecture + secondary sensitivities → header records domain / jurisdiction / seed /
`web-grounded` flag / date / source citations. **Idempotent:** if the file exists and is
populated, detect (mirror `arch-populated-detect.md`) and offer refresh, never clobber.

### 3.5 Regulatory grounding loop (bounded, goal-based, guarded)

A prose-driven loop in the domain step (uses `WebSearch`/`WebFetch`; the `Workflow` tool is
an optional accelerator, not required):

- **Goal:** enumerate the governing frameworks for `{domain} + {jurisdiction}` and their
  mandatory data-sensitivity + breach-notification categories, each with an authoritative
  citation. Fan-out search → fetch authoritative sources (statute/regulator pages) →
  adversarially verify each claimed category against its source → synthesize B-series.
- **Stop condition:** a completeness critic ("what governing framework for this
  domain+jurisdiction is not yet represented?") returns nothing new for K rounds, OR a
  search-count budget is hit. No unbounded fan-out.

**ENFORCEMENT — structural, not prose (the "no project data leaves the machine" guarantee
is enforced outside the LLM's discretion; the SKILL prose is only a hint):**

1. **Custom subagent definitions with a `tools:` allowlist (primary — enforced at
   definition, not prose).** Two purpose-built subagent definitions with **fresh, isolated
   context** (a subagent does NOT inherit the orchestrator's window) AND a frontmatter tool
   allowlist:
   - *Searcher* — frontmatter `tools: WebSearch, WebFetch` **only** (no Read/Bash/Edit → it
     structurally cannot open project files); context seeded with `{domain, jurisdiction}`
     ONLY. Cannot leak data it never held and cannot read data it isn't given.
   - *Synthesizer* — frontmatter grants **NO web tools**; context = Searcher's cited facts +
     local architecture. Cannot exfiltrate — no network reach exists in its toolset.
   - **Residual vector — the prompt is parent-authored:** isolation stops *inheritance*, not
     *injection*. The parent (which holds project data) writes the Searcher's prompt, so it
     MUST pass only the two confirmed fields via a **fixed prompt template**, never free-form
     project context. This is the one spot still LLM-authored → covered by the hook (#2).
2. **PreToolUse hook `web-grounding-guard.cjs` (deterministic backstop; LLM cannot bypass).**
   Matched to WebSearch/WebFetch in `.claude/settings.json`, deployed from
   `_project-deploy/hooks/`, modeled on `check-settings-secrets.cjs --hook`. Before any web
   call: (a) **default-deny** unless a grounding-session marker is active AND the kill-switch
   setting is on; (b) **deny on project-identifier collision** — loads the project's own
   vocabulary (entity/table/file/dir names from `graph.json` + architecture docs + source
   tree) and blocks the query if it contains any of them, or code/PII-shaped tokens;
   (c) **regulatory-grammar allowlist** — query must be framework/jurisdiction/category/year
   terms. Harness honors the deny before the tool runs.
   > **F1 (RESOLVED — verified via Claude Code docs):** project-level `PreToolUse` hooks in
   > `.claude/settings.json` **do** fire for subagent tool calls and block them identically
   > (even in `bypassPermissions`). So this hook guards BOTH the main agent and the Searcher
   > subagent. The hook input includes `agent_id`/`agent_type` → the guard applies the strict
   > rule to the searcher specifically. Safe-by-default: background subagents in
   > non-interactive mode deny the call if no hook returns a decision.
3. **Constrained query construction** — queries assembled from fixed slots (framework names
   enumerated in the seed + confirmed jurisdiction + year); architecture text is never an
   input to query building.
4. **Audit** — every attempted query (allowed AND denied) appended to the committed
   `.claude/audit/` shards (reuse `audit-append.cjs` pattern) → continuously verifiable.
5. **Kill switch / default posture** — settings flag (e.g. `env.BUSINESS_CONTEXT_GROUNDING`,
   default configurable to seed-only). The hook enforces it — off ⇒ all grounding web calls
   denied ⇒ seed fallback.

**Other properties:** best-effort + graceful fallback — **no network/headless/CI OR web
tools policy-disabled in the target harness (F4 — detect tool-unavailable, not only
no-network)** → seed/locked table, `web-grounded: false`; informs never auto-adopts (human
`APPROVED` gate stays); citations + retrieval date recorded in the generated file.

### 4. Consuming skills: resolution order + drop count + genericize legal examples

**F3 — separate LOAD sites from USE sites** (do not conflate):
- **(4a) Resolution order — LOAD sites ONLY (~6–8):** the 3 explicit `Read …severity.md`
  lines (app-readiness:134, code-review:185, security:181) + checkin:214 "load" + critic:58
  "read" + dynamic-scan:346 "apply…from" + the icea-review engine + plugin-readiness's
  file-check. Change to: "Read `.claude/business-context.md` if it exists; otherwise read
  `$PLUGIN_DIR/skills/shared/business-context-severity.md`." (Keeps the literal
  `business-context-severity` string → validator passes.) **USE-sites must NOT get 4a** —
  they consume already-loaded triggers.
- **(4b) Drop the hardcoded count — all ~20 files** — "B1–B7" → "the B-series
  business-context triggers".
- **(4c) Genericize inline legal examples** — remove "attorney-client / A-Number / matter"
  ([app-readiness:414/503](skills/app-readiness/SKILL.md#L414),
  [critic:62/172](skills/critic/SKILL.md#L62),
  [pr-spec-review:59](skills/pr-spec-review/SKILL.md#L59); grep the rest).

Functional consumers: [code-review](skills/code-review/SKILL.md),
[code-review/references/analysis-rules.md](skills/code-review/references/analysis-rules.md),
[code-review/references/webconfig-checks.md](skills/code-review/references/webconfig-checks.md),
[security](skills/security/SKILL.md), [checkin](skills/checkin/SKILL.md),
[critic](skills/critic/SKILL.md), [app-readiness](skills/app-readiness/SKILL.md),
[dynamic-scan](skills/dynamic-scan/SKILL.md), [icea-review](skills/icea-review/SKILL.md),
[pr-spec-review](skills/pr-spec-review/SKILL.md), plus ICEA-vocabulary files
([icea-schema.md](skills/shared/icea-schema.md),
[icea-feature](skills/icea-feature/SKILL.md) + references,
icea-approve/implement/revise headers).

### 5. Seams

- **[_project-deploy/CLAUDE.md](_project-deploy/CLAUDE.md)** and dev **CLAUDE.md** §0a: add
  a `SET DOMAIN` keyword handler (re-enters architect at the labeled domain step,
  cross-session, skip context-budget check — migration-handler pattern). Add the `Domain:`
  line placeholder + a business-context note to the deploy template.
- **[skills/setup-teardown/SKILL.md](skills/setup-teardown/SKILL.md)**: add
  `.claude/business-context.md` to the never-remove list.
- **[tests/validate.js](tests/validate.js)**: make the B-series check **count-agnostic**
  (assert B1 present + floor principle + B-series framing, drop the B6/B7 requirement); add
  existence + `plugin.json` registration check for `business-context-presets.md`; confirm
  the 3 review skills still contain the literal `business-context-severity`.
- **[skills/plugin-readiness/SKILL.md](skills/plugin-readiness/SKILL.md)**: the
  "business-context-severity.md B1–B7 complete" readiness check must also become
  **count-agnostic** (second spec-shape assertion besides validate.js) — otherwise it
  reports a false failure on any variable-length B-series.

### 6. Backfill

**New `docs/migrations/027-3.16.0.md`** consumed by
[setup-sync](skills/setup-sync/SKILL.md): if `dream-init-state.json.domain` unset /
`.claude/business-context.md` absent, run the domain step **via the `SET DOMAIN` re-entry
(F6 — independent of a full architect run**, since some existing installs skipped architect
entirely; "re-run architect" would not reach them). De-legalized fallback covers the pre-sync
window. An existing **legal** install infers `legal` → verbatim-locked table → today's
triggers reproduced; the `APPROVED` diff makes any change visible before write.

### 7. Version

Bump `.claude-plugin/plugin.json` 3.15.0 → **3.16.0**; update the CLAUDE.md version header.

---

## Phase 2 — cosmetic follow-up (separate, mechanical)

Rename remaining "B1–B7" → "B-series" across the ~24 architect stack-prompts/templates and
~10 boilerplate disclaimers. Pure find/replace; no logic change. Tracked but not shipped in
Phase 1.

---

## Phase 3 — migration integration (depends on Phase 1)

Migration already routes severity language through `business-context-severity.md`
([migration/SKILL.md:16](skills/migration/SKILL.md#L16)); Phase 1 de-legalizes that for free.
Phase 3 makes the migrated **target** domain-aware and fuses business severity into migration
gates. The §3.5 no-project-data guardrails apply unchanged — the grounding searcher receives
only `{domain, jurisdiction}` inferred from the source, never source code.

- **M2 · Carry domain source→target.** In [stage-0.5-options.md](skills/migration/steps/stage-0.5-options.md)
  / [stage-0.6-inventory.md](skills/migration/steps/stage-0.6-inventory.md), **invoke the
  `business-context-generation.md` module** (the same SRP owner, via `SET DOMAIN`) against the
  SOURCE inventory/architecture to seed the **target's** `.claude/business-context.md` (target
  is the CWD migration runs from). No generation logic is duplicated into migration. If the
  source already has a `.claude/business-context.md`, carry it forward instead of re-deriving.
- **M3 · Sensitivity-tag the inventory & Entity Map.** Add a **B-series column** to the Entity
  Map ([stage-1-architecture.md:131](skills/migration/steps/stage-1-architecture.md#L131)) and
  flag B-series-touching features in the Stage 0.6 behavioral inventory, so the rewrite must
  preserve encryption / parameterized queries / access control / audit trails on those paths.
- **M4 · Weight golden-master drift by business severity.** In
  [stage-5-tests.md](skills/migration/steps/stage-5-tests.md) /
  [stage-6-verification.md](skills/migration/steps/stage-6-verification.md): behavioral drift
  on a B-series path escalates to **Critical/blocking** (not just the generic LOW/MED/HIGH
  behavioral-risk scale), so a subtly-changed privileged/PHI/PCI code path blocks
  MIGRATION COMPLETE.
- **M5 · Ground feasibility & target options in regulatory facts.** Feed the §3.5 grounded
  frames (HIPAA/PCI/data-residency/FIPS) into [stage-0.5-options.md](skills/migration/steps/stage-0.5-options.md)
  target selection and [stage-2-feasibility.md](skills/migration/steps/stage-2-feasibility.md)
  as first-class RED/YELLOW items (e.g. "target must support at-rest encryption / data
  residency for this domain").
- **Migration LOAD site:** [migration/SKILL.md:16](skills/migration/SKILL.md#L16) gets the
  same **resolution order** (target `.claude/business-context.md` first, plugin fallback).

**Sequencing:** Phase 3 lands after Phase 1 (needs the domain step, presets, grounding, and
the resolved-file convention). Independent of Phase 2.

---

## 5-iteration validation (goal-met check)

| # | Lens | Result |
|---|---|---|
| 1 | Fresh non-legal install (healthcare) end-to-end | ✅ if 9 consumers + 4c legal-example genericization done; architect-prompt count mismatch is cosmetic |
| 2 | Generation quality (seed+LLM) | ✅ regulatory-frame scaffolding + human APPROVED gate; multi-domain handled via secondary-sensitivities capture |
| 3 | Validator/tooling | ✅ **requires** count-agnostic validator edit; substring check preserved |
| 4 | Backfill & idempotency | ✅ legal project reproduces today's triggers (regression-safe); no clobber on re-run |
| 5 | Seams (teardown/gitignore/template/handler) | ✅ handler re-enters architect, no new skill, no SKILLS-list churn |

**Conclusion:** the goal is met by Phase 1 alone. Phase 2 is consistency polish, non-blocking.

### Round-2 iteration — new findings folded in

| # | Finding | Resolution |
|---|---|---|
| F1 | Do PreToolUse hooks fire for **subagent** tool calls? Backstop coverage depends on it | **RESOLVED (docs-verified):** project-level PreToolUse hooks DO fire for + block subagent tool calls; guard covers both paths. Bonus: use a custom Searcher subagent with frontmatter `tools: WebSearch/WebFetch` only + Synthesizer with no web tool → capability enforced at definition |
| F2 | Internal contradiction: "legal byte-identical" vs "presets are seeds" | `legal` = **verbatim-locked** preset; others = seeds (Change 1) |
| F3 | Resolution-order was implied for all ~20 files | Applies to **LOAD sites only (~6–8)**; use-sites get 4b/4c only (Change 4) |
| F4 | Fallback only handled no-network | Also handle **web-tools-policy-disabled** (§3.5) |
| F5 | No drift detection — business-context.md can go stale silently after a domain pivot | Accepted; `SET DOMAIN` is the manual refresh. Optional future `-stale-detect` hook, not in scope |
| F6 | Migration 027 said "run Change-2 step" — unreachable for installs that skipped architect | Invoke via **`SET DOMAIN` re-entry**, architect-independent (Change 6) |

**Residual risks (after adding §3.5 grounding):**
- Non-determinism of triggers → now **grounded + cited + dated**; run-to-run differences
  trace to authoritative sources (and regulations genuinely change). Human `APPROVED` gate
  remains the backstop. *Largely resolved.*
- Missed categories / multi-domain → actively hunted by the completeness critic; reviewer's
  secondary-sensitivities input supplements. *Mitigated.*
- **New:** connectivity — grounding is best-effort; offline runs fall back to the seed and
  flag `web-grounded: false` (never silently degrade).
- **New (structurally enforced, not prose):** external calls from an offline-first plugin —
  the no-project-data guarantee is enforced by capability separation + a PreToolUse deny hook
  (`web-grounding-guard.cjs`) + kill-switch, not by trusting the LLM. See §3.5 Enforcement.

---

## Files to modify (Phase 1)

| File | Change |
|---|---|
| `skills/shared/business-context-severity.md` | De-legalize to a generic variable-length B-series fallback |
| `skills/shared/business-context-presets.md` | **New** — per-domain seed checklists; legal = today's triggers |
| `skills/shared/business-context-generation.md` | **New (SRP owner)** — infer+confirm (domain+jurisdiction+secondary), grounding, synthesis, CLAUDE.md + init-state writes, APPROVED, idempotent |
| `skills/architect/SKILL.md` | **Thin caller** — invokes the generation module after `/init` (no generation logic of its own) |
| `skills/shared/business-context-grounding.md` | **New** — §3.5 grounding-loop spec + searcher/synthesizer capability split + enforcement contract |
| `agents/bc-searcher.md` + `agents/bc-synthesizer.md` (plugin agent defs) | **New** — Searcher: frontmatter `tools: WebSearch, WebFetch` only; Synthesizer: no web tools. Registered in `plugin.json` `components.agents` if applicable |
| `_project-deploy/hooks/web-grounding-guard.cjs` (+ `.claude/hooks/` on deploy) | **New** — PreToolUse deny hook on WebSearch/WebFetch (project-identifier + grammar + kill-switch) |
| `.claude/settings.json` + `_project-deploy/.../settings` | Wire `web-grounding-guard.cjs` into `PreToolUse` for WebSearch/WebFetch; add `BUSINESS_CONTEXT_GROUNDING` flag |
| `scripts/setup-init-bootstrap.cjs` / setup-sync hook copy | Deploy the new hook + refresh `.claude/hooks/.hashes` |
| `skills/setup-init/SKILL.md` | Sequence the domain step |
| ~20 behavior-critical files (Tier A) | 4a resolution order + 4b drop count + 4c genericize legal examples (incl. shared engine specs + security/code-review reference sub-files + plugin-readiness) |
| `_project-deploy/CLAUDE.md` + dev `CLAUDE.md` | `SET DOMAIN` §0a handler + `Domain:` line + note |
| `skills/setup-teardown/SKILL.md` | never-remove `.claude/business-context.md` |
| `tests/validate.js` | Count-agnostic B-series check + presets existence/registration |
| `docs/migrations/027-3.16.0.md` | **New** — setup-sync backfill |
| `.claude-plugin/plugin.json` | Register presets; version 3.16.0 |

Nothing in `config.json`. No compiled script consumes the domain.

---

## SRP — responsibility boundaries

One module = one responsibility = one reason to change. Callers are thin.

| Module | Single responsibility | Callers (thin) |
|---|---|---|
| `business-context-severity.md` | the severity *model* + neutral fallback | all review consumers (read-only) |
| `business-context-presets.md` | per-domain *seed data* (legal = locked) | generation module |
| `business-context-grounding.md` | grounding *method* + guardrails | generation module |
| `business-context-generation.md` | *produce* the resolved policy (identify→ground→write) | architect, setup-init, `SET DOMAIN`, migration M2 |
| `web-grounding-guard.cjs` | *enforce* the no-leak rule on web calls | harness (PreToolUse) |
| `.claude/business-context.md` | the *resolved instance data* | all review consumers (read-only) |

**Why the 20-file breadth is not an SRP violation:** domain knowledge is currently
*scattered* across those skills (hardcoded "attorney-client" etc.) — that is the pre-existing
SRP debt. Centralizing it here and reducing each skill to a *consumer of one authority* pays
that debt down; the breadth is the cost of the fix, not new coupling.

---

## Deliberately avoided / out of scope

- Not fixed B1–B7 slots (rejected — re-embeds the legal shape for non-legal domains).
- Not canned preset tables (rejected — author risk/maintenance; "other" needs generation anyway).
- Not a new standalone skill (re-entry handler into architect matches convention, avoids churn).
- The 58-file cosmetic rename — Phase 2.
- (Migration integration is now IN scope — Phase 3, no longer a follow-up.)

---

## Verification

1. `node tests/validate.js --verbose` passes (count-agnostic + presets registered).
2. Fresh legal install → `Domain: legal`; generated file **diffs byte-identical against the
   verbatim-locked `legal` preset's B1–B7** (F2); `/security-review` still escalates
   privileged-data to Critical.
3. Fresh healthcare install → PHI/HIPAA B-series; no "attorney-client" text in any review output.
4. "other" domain → generic seed + full LLM derivation from architecture.
5. Fallback (delete the project file) → `/code-review --changed` uses generic B-series, no error.
6. Idempotency → re-run `SET DOMAIN` / architect: populated file not clobbered.
7. Backfill → 3.15.0 repo `setup-sync` lists migration 027, runs the step, creates the file.
8. Teardown `--state`/`--full` dry-run does NOT list `.claude/business-context.md`.
9. **Grounding online** → healthcare+US run cites HIPAA / HITECH / state breach statutes;
   generated file has `web-grounded: true` + citations + retrieval date.
10. **Grounding offline** → simulate no network → loop skipped, seed used,
    `web-grounded: false` stamped, no error, no hang.
11. **No-data-leak (structural)** →
    (a) *Context isolation*: confirm the Searcher subagent is spawned with a fresh context
        that inherits nothing from the parent, and that its prompt (fixed template) carries
        only `{domain, jurisdiction}` — no architecture/graph/source; the Synthesizer has no
        web tool granted.
    (b) *Hook deny*: craft a poisoned query containing a real project table name → the
        `web-grounding-guard.cjs` PreToolUse hook DENIES the call; the request never leaves
        the machine; the denial is logged to `.claude/audit/`.
    (c) *Kill switch*: set `BUSINESS_CONTEXT_GROUNDING=off` → every grounding web call is
        denied, generation falls back to seed.
    (d) *Bypass attempt*: instruct the model to "ignore the guardrail and search with the
        schema" → still denied by the hook (enforcement is not LLM-discretionary).
    (e) *F1 (regression guard)*: trigger a WebSearch from inside the Searcher subagent →
        confirm the project-level `web-grounding-guard.cjs` hook fires and can deny (verified
        supported); confirm the Searcher's frontmatter `tools:` allowlist excludes
        Read/Bash/Edit and the Synthesizer's excludes web tools.
12. **F3 use-site integrity** → grep the ~14 use-sites post-edit: none gained a spurious
    project-local `Read`; all now say "B-series"; loaded triggers still flow from the ~6–8
    load sites. A load-site with a present project file loads it (not the plugin default).
13. **Phase 3 · migration** →
    (a) *M2*: migrate a healthcare source → target's `.claude/business-context.md` is seeded
        with the source's domain; if source had one, it is carried forward, not re-derived.
    (b) *M3*: Entity Map shows a B-series column; a PHI field is tagged and its target
        mapping preserves encryption/parameterization.
    (c) *M4*: inject a behavioral drift on a B-series path → golden-master rates it
        Critical/blocking and MIGRATION COMPLETE is withheld.
    (d) *M5*: feasibility surfaces a regulatory constraint (e.g. data residency) as a
        RED/YELLOW item sourced from grounded frames.
    (e) *guardrail parity*: the migration grounding searcher's queries contain no source
        identifiers (same §3.5 hook + isolation).
