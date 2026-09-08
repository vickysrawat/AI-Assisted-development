# Plan — Harden the Migration Skill: As-Built Fidelity & Architecture-Doc
# Status - Implemented
> Run this in the **plugin repository** (ai-assisted-development, v3.15.0). Paths are relative to the plugin root.
> Origin: retrospective on the KE.KirklandData migration (ADO-9999), *after* setup-init + the architecture
> gap analysis surfaced 13 doc-vs-code divergences.
> **Complementary to** `docs/plans/migration-integration-verification-hardening.md` (the integration-
> misclassification plan) — this plan does NOT repeat that work; it addresses the *different* lessons.

---

## Context

The migration skill produces its architecture documents at **Stage 1 — before any code exists**
(`stage-1-architecture.md` + `phase1-architecture-spec.md` emit `COMPONENT-`, `DATA-`, `SECURITY-`,
`INFRASTRUCTURE-ARCHITECTURE.md` + `ARCHITECTURE-DECISIONS.md`; Stage 3 emits `target-architecture.md`).
Stage 6 then verifies **behavior** (golden-master, E2E, coverage, fitness) but **never reconciles those
design-time docs against the code that was actually generated.** Result on ADO-9999: 13 divergences that
we only found by hand during the gap analysis —

- endpoint count **57 (design) vs 49 (as-built)**;
- a **phantom `kirklanddata_generalmatterdetails` role** in SECURITY/DEPLOYMENT docs, enforced nowhere;
- **RiskMgmt documented as a service**, implemented as a direct SQL DB;
- **WallBuilder documented as HttpClient**, implemented as WCF;
- **Serilog / Moq / IMemoryCache / `/health/*`** in the docs, none matching as-built;
- the 5 Stage-1 docs went **stale** while only `target-architecture.md` was hand-corrected.

**Root causes (distinct from the integration plan's):**
1. Design-time architecture docs are **frozen at Stage 1** and never re-derived from generated code; there
   is no as-built reconciliation step and no "this is a pre-implementation snapshot" labeling.
2. **No mechanical fidelity audit** of inventoried endpoints/roles vs the generated controllers'
   routes + `[Authorize(Roles=…)]` — golden-master (the only behavioral net) was **SKIPPED** (source can't
   run locally), so nothing caught the count/role drift before completion.
3. The migration doc set and the `architect`/`.claude/architecture` orientation layer are **two competing
   sources of truth** with no de-duplication or supersession, so consumers can't tell which is current.

**Intended outcome:** at completion, the migration reconciles design intent to as-built code, the
`.claude/architecture/*` layer becomes the labeled **as-built source of truth**, the Stage-1 design docs
are stamped as **design-time snapshots** with an auto-generated divergence list, and `MIGRATION COMPLETE`
is **blocked** until that reconciliation passes — reusing the existing gate/checkpoint machinery.

---

## Guiding principle to encode

> **Design-time ≠ as-built.** Architecture docs written before code generation are *intent*, not fact.
> A migration is not complete until the intent is reconciled against the generated code, the orientation
> layer (`.claude/architecture`) is regenerated from that code, and every divergence is recorded. When the
> behavioral oracle (golden-master) is unavailable, the mechanical as-built audit is the compensating control.

---

## Workstreams (executable)

### A. Stage-6 as-built reconciliation step (the core fix)
**`skills/migration/steps/stage-6-verification.md`** — add a new step **before** the `MIGRATION COMPLETE`
gate: *As-built reconciliation*.
- Make running the orientation-layer build a **gated step, not a post-completion suggestion**: invoke
  `architect` + `graph-create`/`graph-sync` against the **generated target** so `.claude/architecture/*`
  is populated from real code (today `stage-6` only *recommends* `/setup-init` afterward).
- Produce an **as-built divergence report** (new artifact `ADO-{ID}-asbuilt-reconciliation.md`) diffing the
  Stage-1/Stage-3 design docs against as-built facts (see Workstream C for the mechanical inputs).
- **Stamp each Stage-1 design doc** with a header banner: `> ⚠ DESIGN-TIME SNAPSHOT — superseded by
  .claude/architecture/*; see ADO-{ID}-asbuilt-reconciliation.md for divergences.`
- Record `stage_gates.asbuilt_reconciled` in the migration checkpoint; block completion until true.

### B. Label design-time docs at creation + establish single source of truth
**`skills/migration/references/specs/phase1-architecture-spec.md`** and **`steps/stage-1-architecture.md`**
- Require every Stage-1 doc to open with a **`> Design-time (pre-implementation) — will be reconciled at
  Stage 6`** banner, so a stale doc is never mistaken for as-built.
- State the ownership boundary explicitly: **`.claude/architecture/*` (built by architect from generated
  code) is the as-built SoT; the migration docs are the design/decision record.** Add this to the spec's
  intro and to `SKILL.md`.

### C. Endpoint + authorization fidelity audit (mechanical)
**NEW `skills/migration/references/specs/asbuilt-reconciliation-spec.md`** — define the audit + report:
- **Endpoints:** enumerate generated controller routes (verb + template) and diff the count/set against the
  Stage 0.6 inventory §1 coverage and the design docs (catches 57-vs-49).
- **Authorization:** extract every `[Authorize(Roles=…)]` (class + action) from generated controllers and
  diff against the roles named in `SECURITY-ARCHITECTURE.md` / inventory (catches phantom
  `generalmatterdetails`; catches class∧action AND-semantics).
- **External dependencies:** list the generated external clients / DI registrations (WCF client, HttpClient,
  DB connection factory) and diff *kind* against the design docs (catches RiskMgmt-as-service,
  WallBuilder-as-HttpClient) — cross-links the integration plan's Integration Inventory.
- **Config + libraries:** diff `appsettings.json` keys and the actual logging/cache/test packages against
  what the docs assert (catches `RiskMgmtBaseUrl`, Serilog, Moq, IMemoryCache).
- Define the **divergence report format** and the **supersession banner** text (reused by Workstream A).
- Prefer a deterministic helper where cheap (grep/regex over generated controllers) so the audit is
  reproducible, not purely LLM-judged.

**`skills/migration/references/specs/source-inventory-spec.md`**
- Add a Stage-6 rule: reconcile §1/§3 `covered/total` endpoint & role counts against the generated code as an
  **append-only** note (never rewrite the signed inventory — consistent with the existing §13 GM-results rule).

### D. Golden-master SKIPPED → as-built audit is the compensating control
**`skills/migration/references/specs/golden-master-spec.md`**
- When GM is SKIPPED (source can't run), require the Workstream-C mechanical audit to run and **pass** as
  the compensating control before `MIGRATION COMPLETE` — today a SKIPPED GM leaves *no* structural net.
  (Complements, does not replace, the integration plan's "integrations = highest-risk unverified set" note.)

### E. Report, checkpoint, version, provenance
- **`skills/migration/references/specs/migration-report-spec.md`** — add an *As-Built Reconciliation*
  section (divergence count + link) to `MIGRATION-REPORT.md`.
- **Migration checkpoint schema doc** (the file documenting `.claude/migration-checkpoint.json`
  `stage_gates`, e.g. where `inventory_approved` is defined) — add `stage_gates.asbuilt_reconciled`,
  surfaced by `/migration-status`.
- **`skills/migration/SKILL.md`** — one Hard Rule (design-time ≠ as-built; completion requires the
  reconciliation pass) + a stack LEARNED note citing ADO-9999 as the case study.
- **Version bump + changelog + `docs/migrations/` note** — **coordinate with the integration plan** (both
  bump the plugin version; land them together as one `3.16.0` or sequence 3.16.0 → 3.17.0). Record the
  ADO-9999 lesson in `memory/MEMORY.md` for `/dream`.

---

## Files to modify

| File (relative to plugin repo) | Change |
|---|---|
| `skills/migration/references/specs/asbuilt-reconciliation-spec.md` | **NEW** — audit checklist (endpoints/roles/deps/config), divergence-report format, supersession banner |
| `skills/migration/steps/stage-6-verification.md` | New gated *as-built reconciliation* step; run architect/graph on target; stamp design docs; set `asbuilt_reconciled` |
| `skills/migration/steps/stage-1-architecture.md` | Emit the design-time banner on each doc |
| `skills/migration/references/specs/phase1-architecture-spec.md` | Design-time labeling + SoT ownership boundary |
| `skills/migration/references/specs/source-inventory-spec.md` | Stage-6 endpoint/role count reconciliation (append-only) |
| `skills/migration/references/specs/golden-master-spec.md` | SKIPPED-GM → mechanical as-built audit as compensating control |
| `skills/migration/references/specs/migration-report-spec.md` | As-Built Reconciliation section |
| migration checkpoint schema doc | `stage_gates.asbuilt_reconciled` + `/migration-status` surfacing |
| `skills/migration/SKILL.md` | Hard Rule + LEARNED note (ADO-9999) |
| `.claude-plugin/plugin.json` (+ `docs/migrations/`, `CHANGELOG.md`) | Version bump + change note (coordinate with integration plan) |

---

## Verification

1. **Spec self-consistency:** every reference to `asbuilt-reconciliation-spec.md` resolves; `stage-6`,
   `golden-master-spec`, and `migration-report-spec` all cite it; `/migration-status` shows
   `asbuilt_reconciled`; `setup-status` reports the new version with no drift.
2. **Regression against the known outcome (strongest test):** run the reconciliation step against the
   completed KE.KirklandData target (`c:\Users\rawatv\source\KE.Common_Upgrade`). It MUST auto-detect the
   13 divergences we found by hand — endpoint **49≠57**, phantom `generalmatterdetails`, RiskMgmt DB-not-
   service, WallBuilder WCF-not-HttpClient, `RiskMgmtBaseUrl`/Serilog/Moq/IMemoryCache — emit the
   `ADO-9999-asbuilt-reconciliation.md` divergence report, and stamp the 5 Stage-1 docs with the
   supersession banner.
3. **Gate behavior:** on a fresh sample migration, confirm `MIGRATION COMPLETE` is **blocked** until the
   reconciliation passes, and that a SKIPPED golden-master forces the mechanical audit to run.
4. **No-drift steady state:** re-running the audit on an already-reconciled target reports zero new
   divergences (idempotent).

---

## Notes / out of scope
- **Integration misclassification** (RiskMgmt/WallBuilder ground-truth verification) → covered by the
  sibling `migration-integration-verification-hardening.md`; this plan references its Integration Inventory
  in Workstream C but does not re-specify it.
- **`.slnx` detection fix** (11 code points incl. `scripts/repo-detect.cjs:163`) → **out of scope**; track
  separately. (It caused setup-init's repo-detect to return UNKNOWN this session.)
- **Goal-convergence loop** → already considered and rejected in the integration plan (missing oracle, not
  missing iteration); the gated one-shot reconciliation is sufficient here.
- No application code changes — this plan only hardens the plugin's migration skill.
