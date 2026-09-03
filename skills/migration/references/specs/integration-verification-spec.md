# Spec: Integration Verification (ground-truth classification of external dependencies)

_Loaded by migration SKILL.md alongside `source-inventory-spec.md` at Stage 0.6, seeded by the
Stage 0 extraction step. Governs the **Integration Inventory** (source-inventory §8) and its
Review-Focus gate. **Distinct from** `integration-contract-spec.md` — that spec defines the FE/BE
API contract shared between the two tracks of a full-stack migration; THIS spec defines how each
**external dependency** (WCF service, REST API, DB, queue, in-process library) is classified and
ground-truth-verified before it can inform the target design._

---

## Why this exists (the lesson)

On ADO-9999, external dependencies were classified by reading the *consuming* code and inferring from
naming/usage. **RiskManagementDataMart** (an in-process EF6 direct-DB dependency) was documented as a
WCF proxy; **WallBuilder** (WCF `basicHttpBinding` + Transport + NTLM, 2 endpoints, 116/181 real
operations behind a 4-method KE wrapper) was documented as Kerberos. Each classification cited a real
line and passed provenance — but the *interpretation* was wrong.

> **Citation ≠ interpretation.** `PROV:` proves a line exists; it does not prove the classification is
> correct. For transport, binding, auth, and external-dependency *type*, the ground truth is the host
> **config**, the **referenced assembly**, and the service **metadata/WSDL** — never the consumer's
> interface name. Unverified integration classifications are BLOCKING Review-Focus items, never silent
> stubs.

---

## Ground-truth artifacts (what "verified" means)

`Kind`, `Transport`, and `Auth` may be marked **VERIFIED** only when cited to one of these — a
consumer-side call-site citation is **not** sufficient:

| Artifact | Establishes | .NET example |
|---|---|---|
| Host config `<system.serviceModel>` | Real service client, binding, security, message size | `Web.config` `<client><endpoint>` + `<binding security mode=… clientCredentialType=…>` |
| Host config `<connectionStrings>` (no matching `<client>`) | **In-process direct-DB** (NOT a service call) | `<add name="RiskMgmt" connectionString=… providerName="System.Data.SqlClient"/>` + a `DbContext` |
| Referenced assembly source | The real contract behind a wrapper/abstraction | resolve `KE.WallBuilder` `<ProjectReference>` → the true Intapp SOAP contract |
| Service metadata / WSDL (`?singleWsdl`) | The true operation set + bindings | 116/181 ops vs. the 4-method KE wrapper |

If none is reachable, the row is **UNVERIFIED** with `Backing source available? = n` and an
unavailable-ground-truth gap logged to the inventory Gaps Report (§11).

---

## The Integration Inventory (source-inventory §8)

One row per external dependency. REQUIRED columns:

```
| Name | Kind {WCF|REST|gRPC|DB|in-process-lib|queue|file} | Transport evidence (PROV: config/assembly/WSDL) | Binding+Auth (evidence) | Endpoints per env | Contract source {WSDL|assembly|none} | Backing source available? {y/n} | Verification status {VERIFIED|UNVERIFIED|DEFERRED(task)} | Notes |
```

Example (the corrected ADO-9999 rows):
```
| RiskManagementDataMart | DB (in-process EF6) | PROV:Web.config#L88 (no <client>; <connectionStrings> + DbContext) | Integrated Security | n/a | none | y | VERIFIED | NOT a service — direct DB |
| WallBuilder | WCF | PROV:Web.config#L120-L134 (basicHttpBinding, security mode=Transport, NTLM, 2 endpoints) | Transport/NTLM, maxReceivedMessageSize 50MB | dev:2 · prod:2 | assembly+WSDL (resolve KE.WallBuilder) | y | UNVERIFIED | 4-method wrapper hides real Intapp contract (116/181 ops) — resolve before target design |
```

### Evidence rule (tier interaction)
Per `source-inventory-spec.md` confidence tiers, an integration's **transport / auth / external-dep
type is `STATIC` only when ground-truth-verified** against a config/assembly/WSDL artifact; otherwise
it is **`INFERRED`** and carries mandatory Review-Focus. A wrapper's method names are never treated as
the raw service operations.

### Verification status semantics
- **VERIFIED** — Kind/Transport/Auth all cited to a ground-truth artifact.
- **UNVERIFIED** — any of Kind/Transport/Auth still inferred from consumer code. Leaves the row
  `Pending` in Review Focus → **blocks `APPROVE INVENTORY`** (see gate wiring below).
- **DEFERRED(task)** — cannot be verified now (missing WSDL/source/decision) but tracked as an
  explicit ADO task. Allowed past the gate only with the task recorded.

---

## Stub policy (when an integration cannot be implemented)

If an integration cannot be implemented at code-gen (missing WSDL/source/decision), the generated
placeholder MUST **fail loud** — throw with an ADO-linked message
(`throw new NotSupportedException("Integration {name} unverified — see ADO-{ID}")`) AND be recorded as
an **open blocker** in the checkpoint `decision_log` / Gaps Report. NEVER a bare
`NotImplementedException` that reads as done. An open integration blocker is carried to Stage 6 and
surfaced in the as-built reconciliation.

---

## Gate wiring (reuse existing gates — no parallel machinery)

1. **Stage 0** seeds the raw evidence (config/connection-strings/referenced-assembly scan — see
   `steps/stage-0.md`).
2. **Stage 0.6** fills the Integration Inventory and dispositions every row. **Every Integration
   Inventory row is a mandatory Review-Focus item** (`source-inventory-spec.md` §2): an `UNVERIFIED`
   row stays `Pending` and BLOCKS `APPROVE INVENTORY`. On approval, set
   `stage_gates.integrations_verified = true` **only when no row is `UNVERIFIED`** (`DEFERRED(task)`
   is allowed).
3. **Stage 2 feasibility** — an external dep whose Kind/Transport/Auth is not ground-truth-verified is
   `UNKNOWN`/RED with a resolution option, never assessed on an assumed Kind (`feasibility-spec.md`).
4. **Stage 6** — the as-built reconciliation diffs the *generated* external clients / DI registrations
   against these verified rows (`asbuilt-reconciliation-spec.md`, External-dependencies check).

---

## Golden-master relationship

Golden-master cannot see transport type (WCF vs. in-process DB is invisible at the I/O boundary), and
when the source cannot run it is SKIPPED. This spec is the structural net GM cannot provide — external
integrations are the **highest-risk unverified set** whenever GM is SKIPPED
(`golden-master-spec.md`).
