# Spec: As-Built Reconciliation (design-intent vs. generated code)

_Loaded by migration SKILL.md at Stage 6, Step 6.5 (the gated as-built reconciliation step, before the
MIGRATION COMPLETE banner). Defines the mechanical audit, the divergence-report format, and the
design-doc supersession banner._

---

## Why this exists (the lesson)

On ADO-9999 the architecture docs were frozen at Stage 1 — written *before any code existed* — and
never reconciled against the code that was actually generated. 13 divergences were found only by hand:
endpoint count **57 (design) vs 49 (as-built)**, a phantom `kirklanddata_generalmatterdetails` role
enforced nowhere, RiskMgmt documented as a service but built as a direct DB, WallBuilder documented as
HttpClient but built as WCF, and Serilog / Moq / IMemoryCache / `/health/*` documented but absent.
Golden-master (the only behavioral net) was SKIPPED, so nothing caught them.

> **Design-time ≠ as-built.** Architecture docs written before code generation are *intent*, not fact.
> A migration is not complete until the intent is reconciled against the generated code, the
> orientation layer (`.claude/architecture/*`) is regenerated from that code, and every divergence is
> recorded. When the behavioral oracle (golden-master) is unavailable, this mechanical audit is the
> compensating control.

---

## Source of truth after reconciliation

- **`.claude/architecture/*`** — built by `architect` from the **generated code** at Step 6.5. This is
  the **as-built source of truth**. Consult it first.
- **Stage 1/3 migration docs** (`COMPONENT-/DATA-/SECURITY-/INFRASTRUCTURE-ARCHITECTURE.md`,
  `ARCHITECTURE-DECISIONS.md`, `target-app-architecture.md`) — the **design/decision record**. Stamped
  superseded at Step 6.5 (banner below); kept for provenance, not consulted as current fact.

---

## The four mechanical checks

Extraction is **declarative-mechanical** (deterministic grep/regex/AST — reproducible, low-token) for
targets whose routes/roles are declared as attributes/guards: **.NET** (`[Route]`/`[HttpGet]` +
`[Authorize(Roles=…)]`), **Java-Spring** (`@GetMapping`/`@PostMapping` + `@PreAuthorize`), **Angular**
(`Routes[]` + `canActivate`). For imperative stacks — **Node/Express, React, Python** — routes/auth are
code-flow, not declarations: run an LLM-assisted **best-effort** diff and label every result
**`NOT mechanically verified`**. NEVER emit a "reconciled" pass on an imperative stack from the
mechanical path — the label is the honest signal.

| # | Check | As-built source | Design source | Catches (ADO-9999) |
|---|---|---|---|---|
| 1 | **Endpoints** — enumerate generated controller routes (verb + template); diff count + set | generated controllers | Stage 0.6 §1/§3 coverage + design docs | 57≠49 |
| 2 | **Authorization** — extract every role attribute (class ∧ action, AND-semantics); diff role set | `[Authorize(Roles=…)]` etc. | `SECURITY-ARCHITECTURE.md` / inventory §9 roles | phantom `generalmatterdetails` |
| 3 | **External dependencies** — list generated external clients / DI registrations; diff *kind* | WCF client / HttpClient / DbContext + `Program.cs`/`Startup.cs` DI | design docs + §8 Integration Inventory | RiskMgmt-as-service, WallBuilder-as-HttpClient |
| 4 | **Config + libraries** — diff `appsettings.json` keys + logging/cache/test packages | `appsettings*.json` + `*.csproj`/`package.json` | doc claims | `RiskMgmtBaseUrl`, Serilog, Moq, IMemoryCache |

Check 3 **cross-links the Stage 0.6 §8 Integration Inventory** (`integration-verification-spec.md`) —
an integration verified as in-process DB must appear as a `DbContext`/connection, not a service client;
any open integration blocker is carried in as a divergence.

If `architect` could not fully analyze an area (e.g. the target does not yet build), mark those checks
**`NOT mechanically verified`** in the report rather than passing them silently.

---

## Divergence report format

**Filename:** `docs/.../ADO-{ADO_ID}-asbuilt-reconciliation.md`

```
AS-BUILT RECONCILIATION — ADO-{ADO_ID}
As-built source: .claude/architecture/* (from generated code @ {target commit SHA})
Design source:   Stage 1/3 docs (stamped superseded)
Audit mode:      {MECHANICAL (.NET/Java/Angular) | PARTIAL — {areas} NOT mechanically verified}

Summary: {N} divergences — {N HIGH} · {N MEDIUM} · {N INFORMATIONAL}

| # | Check {endpoints|authz|deps|config} | Design says | As-built is | Severity | Disposition {explained|accepted|open} | Evidence |
|---|---|---|---|---|---|---|
| 1 | endpoints | 57 | 49 | HIGH | open | design COMPONENT-ARCH §2 vs 49 generated routes |
| 2 | authz | role generalmatterdetails | (enforced nowhere) | HIGH | open | grep [Authorize(Roles=…)] — 0 hits |
```

- **Severity** follows the feasibility Behavioral-Risk scale (INFORMATIONAL/MEDIUM/HIGH/BLOCKER); a
  divergence on a B-series-flagged path escalates to Critical (mirrors Step 6.1 M4).
- **HIGH/BLOCKER divergences block MIGRATION COMPLETE** until `explained` or `accepted` — treated
  exactly like unexplained golden-master drift.
- **Idempotence:** re-running the audit on an already-reconciled target reports zero *new* divergences.

---

## Supersession banner (stamped on each Stage-1 design doc at Step 6.5)

Insert at the very top of each of `COMPONENT-/DATA-/SECURITY-/INFRASTRUCTURE-ARCHITECTURE.md` and
`ARCHITECTURE-DECISIONS.md`:

```
> ⚠ DESIGN-TIME SNAPSHOT — superseded by .claude/architecture/*; see
> ADO-{ADO_ID}-asbuilt-reconciliation.md for divergences.
```

This pairs with the creation-time banner Stage 1 already stamps
(`> Design-time (pre-implementation) — will be reconciled at Stage 6`), so a doc is never mistaken for
as-built at any point in its life.

---

## Gate

Step 6.5 sets `stage_gates.asbuilt_reconciled = true` only when the divergence report was produced AND
every Stage-1 doc was stamped. Step 6.6 merges `phase = "Complete"` only when that gate is true and all
HIGH/BLOCKER divergences are `explained`/`accepted`. When golden-master was SKIPPED, this audit is the
**required** compensating control — completion cannot proceed without it.
