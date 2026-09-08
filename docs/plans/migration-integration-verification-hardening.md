# Plan — Harden the Migration Process Against External-Integration Misclassification
# Status - Implemented
> Run this in the **plugin repository** (ai-assisted-development, v3.15.0).
> All paths below are relative to the plugin repo root.
> Origin: retrospective on the KE.KirklandData migration (ADO-9999).

---

## Context

During the KE.KirklandData migration (ADO-9999), several integration facts were wrong in the generated
docs and only discovered during *implementation*, after many iterations:

- **RiskManagementDataMart** was documented as a **WCF proxy**; it is actually an **in-process EF6
  direct-DB** dependency (no `<client>` endpoint in `Web.config`; backed by a `DbContext`).
- **WallBuilder** auth was documented as Kerberos/Negotiate; it is actually **basicHttpBinding + Transport
  + NTLM**, 50 MB max message, **two** endpoints — and its "4 operations" were a KE *wrapper* abstraction,
  not the real Intapp SOAP contract (116/181 ops).
- Employee-ID / client-matter **formats** lived in a referenced assembly (`KE.Common.Helpers`) that was
  never inspected.

**Why the process missed them (root cause):**
1. External dependencies are classified by **reading the consuming code and inferring from naming/usage**.
   The process never reads the host `Web.config` `<system.serviceModel>`/`<client>` endpoints or
   `<connectionStrings>`, and never crosses the **referenced-assembly boundary** where the real
   integration semantics live.
2. The provenance mechanism (`PROV:file#Lnn`) only verifies **"the cited line exists"** — not **"the
   meaning attributed to it is correct."** A confident-but-wrong classification cites a real line and passes.
3. The Stage 0.6 human-review gate validates **intent** ("does this make sense?"), not **ground truth**;
   the integration rows were left `Pending` and carried into feasibility, which repeated the assumption.
4. Golden-master (Stage 5.0) **cannot** see transport type (WCF vs in-process DB is invisible at the I/O
   boundary) — and here it was **SKIPPED** (source can't run locally), so nothing challenged the assumption
   before implementation.

**Intended outcome:** future migrations verify each external dependency's transport/binding/auth/contract
against **ground-truth artifacts** (config, referenced-assembly source, service metadata/WSDL) and are
**blocked from code generation** while any integration classification is unverified — using the plugin's
existing gate/checkpoint/Review-Focus machinery, not a parallel system. Scope covers **both** the specific
external-integration gap **and** the broader principle that INFERRED classifications touching
integration/auth/security must be ground-truth-verified before approval.

---

## Guiding principle to encode

> **Citation ≠ interpretation.** `PROV:` proves a line exists; it does not prove the classification is
> correct. For transport, binding, auth, and external-dependency *type*, the ground truth is the host
> **config**, the **referenced assembly**, and the service **metadata/WSDL** — never the consumer's
> interface name. Unverified integration classifications are BLOCKING questions, never silent stubs.

---

## Changes (executable, grouped)

### A. Ground-truth extraction — make the process READ the authoritative sources
**`skills/migration/steps/stage-0.md`** (discovery, ~L136–170 stack/dep detection)
- Add an explicit extraction step: for .NET sources, parse `Web.config`/`app.config`
  `<system.serviceModel>` (`<client><endpoint>` addresses, `<bindings>` incl. `security mode` +
  `clientCredentialType` + `maxReceivedMessageSize`), `<connectionStrings>`, and `protocolMapping`.
- Add a **referenced-assembly resolution** step: enumerate `<ProjectReference>` / `<Reference>` /
  `<PackageReference>` that back each external dependency; if the backing source or a WSDL/`?singleWsdl`
  is reachable, capture it; if not, record it as an unavailable-ground-truth gap (Group C).
- Emit these into the inventory as **evidence**, not inference.

**`skills/migration/references/stacks/dotnet-framework.md`** — encode the concrete lesson as a reusable
integration-extraction checklist (LEARNED block):
- "No `<client>` endpoint for a dependency **+** a `DbContext`/`<connectionStrings>` entry ⇒ **in-process
  direct-DB**, NOT a service call."
- "A `ClientBase<T>` / `<client><endpoint>` ⇒ real WCF client; capture binding `security`/`clientCredentialType`/message size."
- "A KE `*Wrapper` / `*Resource` type is an abstraction — resolve the referenced assembly to find the
  real contract; do not treat the wrapper's methods as the raw service operations."
- "Formatting/ID helpers (`FormatHelper.*`) often live in a referenced common assembly — resolve it before
  asserting formats."

### B. New spec — the integration-verification checklist & schema
**NEW `skills/migration/references/specs/integration-verification-spec.md`**
- Defines an **Integration Inventory** table (one row per external dependency) with REQUIRED
  ground-truth-verified fields:
  `Name · Kind {WCF|REST|gRPC|DB|in-process-lib|queue|file} · Transport evidence (PROV: config/assembly/WSDL) ·
  Binding+Auth (evidence) · Endpoints per env · Contract source {WSDL/assembly/none} · Backing source available? {y/n} ·
  Verification status {VERIFIED|UNVERIFIED|DEFERRED(task)} · Notes`.
- **Evidence rule:** `Kind`, `Transport`, and `Auth` may be marked VERIFIED only when cited to a
  ground-truth artifact (config endpoint, referenced-assembly source, or service metadata/WSDL) — a
  consumer-side call-site citation is **not** sufficient.
- **Stub policy:** if an integration cannot be implemented (missing WSDL/source/decision), the generated
  placeholder MUST fail loud (throw with an ADO-linked message) AND be recorded as an open blocker — never
  a bare `NotImplementedException` that reads as done.

### C. Gate enforcement — block on unverified integrations (reuse existing gates)
**`skills/migration/references/specs/source-inventory-spec.md`**
- §8 Integrations: require the Integration Inventory (Group B) with ground-truth evidence columns.
- Confidence tiers (~L28–50): add rule — *transport/auth/external-dependency-type* is `STATIC` only when
  verified against a ground-truth artifact; otherwise `INFERRED` and mandatory Review-Focus.
- Review Focus / §2 gate (~L171–180): **add "every Integration Inventory row" to the mandatory
  disposition set** — a row that is `UNVERIFIED` leaves the item `Pending`, which **blocks APPROVE INVENTORY**.

**`skills/migration/steps/stage-0.6-inventory.md`** (~L108–128) — reflect the new Review-Focus category and
its blocking behavior in the gate mechanics.

**`skills/migration/references/specs/feasibility-spec.md`** (~L17–32, dependency ledger ~L94–105)
- Honesty rule addition: an external dependency whose Kind/Transport/Auth is not ground-truth-verified is
  `UNKNOWN`/RED with a resolution option (obtain WSDL/source/decision) — never assessed on an assumed Kind.
- The dependency ledger must record the *evidence* (config/assembly/WSDL), mirroring the Integration Inventory.

**`skills/shared/checkpoint-schema.md`** — add `decision_log.integrations` `{ verified[], unverified[],
deferred[] }`, and (recommended) a `stage_gates.integrations_verified` flag surfaced by
`/migration-status`. Advancing to Stage 4 (code-gen) requires no `unverified` integrations (or explicit
`deferred` with a tracked task).

### D. Broader classification hardening (the general principle)
**`skills/migration/SKILL.md`** (Hard Rules ~L144–166) — add two rules:
- "NEVER classify an integration's transport/binding/auth from the consumer's interface name — verify
  against host config, the referenced assembly, or service metadata/WSDL."
- "`PROV:` proves the citation exists, not that its interpretation is correct. Any INFERRED item touching
  **integration, auth, or security** must be ground-truth-verified (or dispositioned with evidence at 0.6)
  before it can inform the target design."

### E. Golden-master safety net
**`skills/migration/references/specs/golden-master-spec.md`** (Step 1 skip path ~L35–48; report/gate ~L104–137)
- When source **cannot run** (GM SKIPPED), explicitly list **external integrations as the highest-risk
  unverified set** and require they be covered by the Stage 6 **manual verification** gate before
  `MIGRATION COMPLETE`.
- When source runs, external-integration behaviours must be included in the GM worklist (already priority
  (2) HIGH-risk — make integrations explicit there).

### F. Version + provenance of the change
- Bump `.claude-plugin/plugin.json` `version` (3.15.0 → 3.16.0) and the migration `SKILL.md` skill-version
  header; add a `docs/migrations/` note if the repo uses per-version migration notes (setup-sync reads these).
- Record the ADO-9999 incident as the motivating case study in the migration skill's LEARNED/changelog and
  in `memory/MEMORY.md` (`Framework-fact`/lesson) so `/dream` can reinforce it.

---

## Files to modify

| File (relative to plugin repo) | Change |
|---|---|
| `skills/migration/references/specs/integration-verification-spec.md` | **NEW** — Integration Inventory schema, evidence rule, stub policy |
| `skills/migration/steps/stage-0.md` | Extract `<system.serviceModel>`/`<connectionStrings>` + resolve referenced assemblies |
| `skills/migration/steps/stage-0.6-inventory.md` | Add integrations to Review-Focus gate mechanics |
| `skills/migration/references/specs/source-inventory-spec.md` | §8 Integration Inventory; tier rule; Review-Focus category |
| `skills/migration/references/specs/feasibility-spec.md` | Evidence-based dependency classification; RED/UNKNOWN when unverified |
| `skills/migration/references/specs/golden-master-spec.md` | SKIPPED-source → integrations flagged for manual gate |
| `skills/migration/references/stacks/dotnet-framework.md` | Integration-extraction checklist (the concrete lesson) |
| `skills/migration/SKILL.md` | 2 Hard Rules (ground-truth + citation≠interpretation); dispatch/version |
| `skills/shared/checkpoint-schema.md` | `decision_log.integrations` + `stage_gates.integrations_verified` |
| `.claude-plugin/plugin.json` (+ `docs/migrations/`) | Version bump + change note |

---

## Verification (how to prove the fix works)

1. **Spec self-consistency:** every reference to `integration-verification-spec.md` resolves; `/migration`
   dispatch, stage-0.6, and feasibility all cite it; `setup-status` reports the new version without drift.
2. **Regression against known ground truth (strongest test):** re-run the migration discovery/inventory
   stages against the real source we now fully understand —
   `C:\Users\rawatv\source\Workspaces\KE2\_Platform\Dev\KE.KirklandData` (with `KE.WallBuilder`,
   `KE.RiskManagementDataMart`, `KE.Common.Helpers` available). The hardened process MUST now:
   - classify **RiskManagementDataMart** as **in-process EF6 direct-DB** (no `<client>` endpoint + `DbContext`),
   - classify **WallBuilder** as **WCF basicHttpBinding/Transport/NTLM, two endpoints**, and flag that its
     wrapper hides the real Intapp contract (resolve referenced assembly / WSDL),
   - mark both `UNVERIFIED` until evidence is attached, and **block APPROVE INVENTORY / feasibility** until
     dispositioned — i.e. catch at inventory what previously slipped to implementation.
3. **Fresh-sample dry-run:** a minimal .NET Framework WCF sample with (a) a real `<client>` endpoint and
   (b) a referenced DB-backed "resource" assembly — confirm the gate extracts config + connection strings,
   forces ground-truth evidence, blocks on the unverified integration, and that an unimplementable
   integration yields a fail-loud, ADO-linked stub recorded as a checkpoint blocker.
4. **Checkpoint/status:** `/migration-status` shows `integrations_verified` and lists any unverified/deferred.

---

## Notes / out of scope
- No application code changes — this plan only hardens the plugin's migration skill.
- Reuses existing mechanisms (stage gates, checkpoint `decision_log`, Review-Focus dispositions, Gaps
  Report, `PROV:` provenance, stack LEARNED blocks) rather than inventing parallel machinery.
- An explicit dedicated gate keyword (`VERIFY INTEGRATIONS ADO-{ID}`) is optional; the recommended approach
  folds enforcement into the existing APPROVE INVENTORY + APPROVE FEASIBILITY gates to minimize disruption.
- **Considered and rejected — goal-convergence loop.** A self-closing "gather evidence → reclassify →
  exit-when-verified" loop was evaluated. Rejected: the failure was a missing ground-truth *oracle*, not a
  lack of iteration — a loop without a falsifiable exit test would have re-converged on the same
  confident-but-wrong classification. The one-shot gates + ground-truth evidence rule + blocking
  Review-Focus disposition are sufficient. (Revisit only if a broader generate→critic→golden-master
  convergence loop is pursued as a separate initiative.)
