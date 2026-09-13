# Spec: As-Built Reconciliation (design-intent vs. generated code)

_A **reusable structural-audit capability** invoked by any migration-family skill
(**Upgrade · Rewrite · Replatform**) after code/IaC generation and before its final completion gate.
Defines the mechanical audit, the divergence-report format, and the design-doc supersession banner._

> **When to use this.** The as-built reconciliation is the **required compensating control** when the
> golden-master oracle was skipped or is still deferred — it is the structural net that catches
> design-intent vs. generated-code divergences the behavioral oracle would have caught. It may also
> run alongside a full golden-master pass as an independent structural check.

---

## Who invokes this — per-skill binding

This capability has no stages of its own. Each invoking skill binds it at its own generation/authoring
boundary and records the verdict in its own ledger namespace:

| Skill | When invoked | Design / intent source | As-built source | Gate it feeds |
|---|---|---|---|---|
| **Rewrite** | after per-cluster code generation, before the completion gate | the 7 target design documents produced by [`target-design-spec.md`](target-design-spec.md) before code generation | generated code in the target folder (`payload.rewrite` clusters) | completion gate (`rewrite-bal.cjs completion-gate`) |
| **Upgrade** | after residual remediation, before the verify gate | gap/risk report · delta target design documents (from `target-design-spec.md`) | upgraded source repo at the current commit | verify gate (`upgrade-orchestrate.cjs verify`) |
| **Replatform** | after R3 IaC authoring, before R4 human execution | the 7 target design documents produced by [`target-design-spec.md`](target-design-spec.md) before IaC authoring | authored IaC + config files | reconciliation gate (`replatform-plan.cjs reconcile-gate`) |

The **invoking skill** records the reconciliation verdict in its own ledger namespace
(`payload.rewrite.gate_verdicts.asbuilt_reconciled`,
`payload.upgrade.gate_verdicts.asbuilt_reconciled`,
`payload.replatform.gate_verdicts.asbuilt_reconciled`). Only HIGH/BLOCKER-free runs set it `true`.

---

## Why this exists (the lesson)

In a representative migration the architecture docs were written *before any code existed* — intent,
not fact — and never reconciled against what was actually generated. 13 divergences were found only
by hand after the fact: endpoint count **57 (design) vs 49 (as-built)**, a phantom role enforced
nowhere, a component documented as a service but built as a direct DB, another documented as HttpClient
but built as WCF, and several logging/test libraries documented but absent. The behavioral oracle
(golden-master) was skipped, so nothing caught them automatically.

> **Design-time ≠ as-built.** Intent documents written before code generation are *intent*, not fact.
> A migration is not complete until the intent is reconciled against the generated code, the
> orientation layer (`.claude/architecture/*`) is regenerated from that code, and every divergence is
> recorded. When the behavioral oracle is unavailable, this mechanical audit is the compensating control.

---

## Source of truth after reconciliation

- **`.claude/architecture/*`** — rebuilt by `architect` from the **generated/upgraded code** at
  reconciliation time. This is the **as-built source of truth**. Consult it first.
- **Target design documents** — the 7 dimension documents produced by `target-design-spec.md`
  (`target-component-architecture.md`, `target-security-architecture.md`,
  `target-data-architecture.md`, `target-integration-architecture.md`,
  `target-infrastructure-architecture.md`, `target-deployment-architecture.md`,
  `migration-feasibility.md`) — the **design record**. Stamped superseded at reconciliation
  (banner below); kept for provenance, not consulted as current fact.

---

## The four mechanical checks

Extraction is **declarative-mechanical** (deterministic grep/regex/AST — reproducible, low-token) for
targets whose routes/roles are declared as attributes/guards: **.NET** (`[Route]`/`[HttpGet]` +
`[Authorize(Roles=…)]`), **Java-Spring** (`@GetMapping`/`@PostMapping` + `@PreAuthorize`), **Angular**
(`Routes[]` + `canActivate`). For imperative stacks — **Node/Express, React, Python** — routes/auth
are code-flow, not declarations: run an LLM-assisted **best-effort** diff and label every result
`NOT mechanically verified`. NEVER emit a "reconciled" pass on an imperative stack from the mechanical
path — the label is the honest signal.

| # | Check | As-built source | Design / intent source | Catches (illustrative) |
|---|---|---|---|---|
| 1 | **Endpoints** — enumerate generated controller routes (verb + template); diff count + set | generated controllers | `target-component-architecture.md` §2 Component Inventory | design claimed 57 endpoints; only 49 generated |
| 2 | **Authorization** — extract every role attribute (class ∧ action, AND-semantics); diff role set | `[Authorize(Roles=…)]` etc. | `target-security-architecture.md` §2 Authorization Model | role declared in design but enforced nowhere in code |
| 3 | **External dependencies** — list generated external clients / DI registrations; diff *kind* | WCF client / HttpClient / DbContext + `Program.cs`/`Startup.cs` DI | `target-integration-architecture.md` §1 Integration Inventory | component designed as service client; built as direct DB |
| 4 | **Config + libraries** — diff `appsettings.json` keys + logging/cache/test packages | `appsettings*.json` + `*.csproj`/`package.json` | `target-component-architecture.md` §4 Key Patterns + `target-infrastructure-architecture.md` §4 Identity and Secrets | logging/test libraries documented but not present in generated code |

**Check 3 — integration ground-truth rule.** The design source for external dependencies is the
integration surface the invoking skill discovered during source analysis — from the source knowledge
graph, auth/integration config inspection, WSDL/binding files, and assembly references. An integration
whose Kind/Transport/Auth is **not ground-truth-verified** from the source config or assembly is
classified `UNVERIFIED/RED` — never assessed on an assumed Kind. Misclassifying an in-process DB as a
service (or NTLM as Kerberos) invalidates the effort estimate and the behavioral risk rating for that
dependency. Any open integration `UNVERIFIED` row is carried into the reconciliation as a divergence.

If `architect` could not fully analyze an area (e.g. the target does not yet build), mark those checks
`NOT mechanically verified` in the report rather than passing them silently.

---

## Divergence report format

**Filename:** `docs/.../ADO-{ADO_ID}-asbuilt-reconciliation.md`

```
AS-BUILT RECONCILIATION — ADO-{ADO_ID}
As-built source:  .claude/architecture/* (from generated code @ {target commit SHA})
Design source:    target design documents (target-design-spec.md) — stamped superseded below
Invoking skill:   {Rewrite | Upgrade | Replatform}
Audit mode:       {MECHANICAL (.NET/Java/Angular) | PARTIAL — {areas} NOT mechanically verified}

Summary: {N} divergences — {N HIGH} · {N MEDIUM} · {N INFORMATIONAL}

| # | Check | Design says | As-built is | Severity | Disposition | Evidence |
|---|---|---|---|---|---|---|
| 1 | endpoints      | 57          | 49          | HIGH | open | design intent spec §2 vs 49 generated routes |
| 2 | authz          | role {designed-role}      | (enforced nowhere) | HIGH | open | grep [Authorize(Roles=…)] — 0 hits |
```

- **Severity** follows the Behavioral Risk scale (INFORMATIONAL / MEDIUM / HIGH / BLOCKER); a
  divergence on a path the invoking skill flagged as HIGH-risk escalates automatically.
- **Disposition** values: `explained` (divergence understood, intentional) · `accepted` (risk accepted
  with a written reason) · `open` (unresolved — blocks the gate).
- **HIGH/BLOCKER divergences block the invoking skill's completion/verify/reconciliation gate** until
  `explained` or `accepted` — treated exactly like unexplained golden-master drift.
- **Idempotence:** re-running the audit on an already-reconciled target reports zero *new* divergences.

---

## Supersession banner

Insert at the very top of each target design document (all 7 produced by `target-design-spec.md`)
when the reconciliation is complete:

```
> ⚠ DESIGN-TIME SNAPSHOT — superseded by .claude/architecture/*; see
> ADO-{ADO_ID}-asbuilt-reconciliation.md for divergences.
```

This ensures a design-time document is never mistaken for the as-built fact at any point in its life.

---

## Gate

Record the reconciliation result in the invoking skill's ledger (`set-gate --gate=asbuilt_reconciled`)
with verdict `PASS` only when: (a) the divergence report was produced AND (b) every design/intent
artifact was stamped AND (c) all HIGH/BLOCKER divergences are `explained` or `accepted`.

The invoking skill's **completion / verify / reconciliation gate** proceeds only when this verdict is
`PASS`. When golden-master was skipped or is still pending, this audit is the **required compensating
control** — the skill's final gate must not proceed without it.

---

## Hard rules

- NEVER emit a `PASS` on an imperative stack (Node/Express, React, Python) from the mechanical path —
  label it `NOT mechanically verified` and treat as best-effort.
- NEVER rate an integration on an assumed Kind — ground-truth-verify Kind/Transport/Auth from config,
  assembly, or WSDL before assigning a risk level.
- HIGH/BLOCKER divergences BLOCK the invoking skill's gate — they are never silently accepted.
- The as-built source of truth is `.claude/architecture/*` rebuilt from generated code — never the
  design-time intent artifacts.
- When golden-master is skipped or deferred, this audit is REQUIRED as the compensating control — not
  optional.
