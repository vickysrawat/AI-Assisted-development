SOURCE BEHAVIORAL INVENTORY — ADO-0004
Behavioral discovery from source — NOT a stakeholder-validated requirements spec.
Source baseline: tests/migration-validation/fixtures/dotnet-fw-source-app @ 2026-08-26T00:00:00Z
Posture (Stage 0.5): rewrite-from-spec   Depth: Full
Status: ⏳ AWAITING REVIEW   (→ APPROVE INVENTORY ADO-0004 once the Review Focus items are dispositioned)

---

### 1. Executive Summary

A single-controller ASP.NET Web API (.NET Framework 4.8) that manages **purchase-order
approval**. Authenticated users can fetch a purchase order by id; users in the Buyer or
Manager role can submit a new order, which passes field validation and then a monetary
approval policy that decides whether the order is auto-approved, approved-by-manager, or
routed to manual/manager review; managers can delete an order. All state is held in a
static in-memory dictionary (no database, no persistence across process restarts). The
approval outcome for small orders depends on two `Web.config` app-settings
(`AutoApproveEnabled`, `AutoApproveCeiling`) whose runtime values differ by environment.

- **Coverage:** 3/3 endpoints · 2/2 entities (PurchaseOrder, ApprovalResult) · 1 cluster deep · 0 light · 0 skipped.
- **Confidence split:** OBSERVED 1 · STATIC 8 · INFERRED 15.
- **Human-only gaps (§10):** 6 — the things only stakeholders can answer.
- **Open code gaps (§11):** 3 — code seen but not confidently resolved.
- **Review readiness verdict:** READY FOR REVIEW.

### 2. Review Focus & How to Disposition
The reviewer MUST disposition every item in these categories before `APPROVE INVENTORY`:
- every **INFERRED** business rule in §6 (R-01 … R-11),
- every feature flagged high-impact (F-02 Submit approval path, F-05 auto-approve policy),
- every item in **§10** (Q-01 … Q-06),
- every open **GAP** in §11 (GAP-001 … GAP-003).

Mark each item's **Review status** as `Confirmed` · `Corrected: {note}` · `Rejected` ·
`Deferred: {reason}`. Items left `Pending` in the Review Focus set BLOCK approval.
OBSERVED/STATIC items may be accepted in bulk.

### 3. Coverage & Method
- **Method:** directory-derivation (no knowledge graph present); every `.cs`, `.csproj`,
  `.config`, and `packages.config` file under the source root was read in full.
- **Endpoints covered:** 3/3 — `GET api/purchase-orders/{id}`, `POST api/purchase-orders`,
  `DELETE api/purchase-orders/{id}` (all declared via attribute routing on one controller).
- **Entities covered:** 2/2 — `PurchaseOrder`, `ApprovalResult`.
- **Clusters:** one bounded context (Purchase Order Approval) — inventoried deep. None skipped.
- **Tests present:** one xUnit test (`PurchaseOrderValidatorTests`) with a single `[Fact]`,
  covering the zero-amount validation message only. This is the sole OBSERVED signal.
- **Not runnable as authored:** the API project is `OutputType=Library` with no host/Global.asax
  and no WebHost bootstrap wiring; golden-master runnability is unconfirmed (see §12).

### 4. Actor & Capability Map
| Actor (role) | Capabilities |
|---|---|
| Any authenticated user | Read a purchase order by id (F-01) |
| Buyer | Submit a purchase order (F-02); subject to the $10,000 manager rule (R-05) |
| Manager | Submit (auto-approved on submit, R-06); delete an order (F-03) |
| Finance | Named in a controller comment as cost-center-exempt, but see GAP-002 / R-04 |
| Unauthenticated | Rejected by `[Authorize]` on all endpoints (F-04, INFERRED outcome) |

### 5. Feature Catalog — Cluster: Purchase Order Approval

| ID | Feature | Layers (UI·API·svc·DB·job) | Behaviour / rules | Confidence | Provenance | GM-verifiable? | Priority | Review status |
|---|---|---|---|---|---|---|---|---|
| F-01 | Get purchase order by id | API·svc | `GET api/purchase-orders/{id:int}` route is declared; returns the stored order | STATIC | PROV:Controllers/PurchaseOrdersController.cs#L30-L41 | yes | UNKNOWN (ask) | Pending |
| F-01a | Get by id — not-found outcome | API·svc | Missing id returns `404 "Purchase order not found"` | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L35-L38 | yes | UNKNOWN (ask) | Pending |
| F-02 | Submit purchase order | API·svc | `POST api/purchase-orders` route is declared; validates, authorizes, evaluates approval | STATIC | PROV:Controllers/PurchaseOrdersController.cs#L47-L78 | yes | UNKNOWN (ask) | Pending |
| F-02a | Submit — validation-failure outcome | API | On first validation error returns `400` with the validator's message body | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L53-L57 | yes | UNKNOWN (ask) | Pending |
| F-02b | Submit — approved outcome | API·svc | On approval returns `200 OK` with the `ApprovalResult` body; order Status set `"Approved"` | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L72-L77 | yes | UNKNOWN (ask) | Pending |
| F-02c | Submit — not-approved outcome | API·svc | When not approved returns `202 Accepted` with `result.Reason` as body; order Status `"PendingReview"` | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L72-L75 | yes | UNKNOWN (ask) | Pending |
| F-03 | Delete purchase order | API·svc | `DELETE api/purchase-orders/{id:int}` route is declared | STATIC | PROV:Controllers/PurchaseOrdersController.cs#L83-L86 | yes | UNKNOWN (ask) | Pending |
| F-03a | Delete — success outcome | API·svc | Existing order returns `204 No Content` (order is NOT removed from the store — no delete call) | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L102 | yes | UNKNOWN (ask) | Pending |
| F-03b | Delete — not-found outcome | API·svc | Missing id returns `404 "Purchase order not found"` | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L88-L92 | yes | UNKNOWN (ask) | Pending |
| F-04 | Authentication guard on all endpoints | API | Controller carries `[Authorize]`; per-action `[Authorize(Roles=...)]` present on POST/DELETE | STATIC | PROV:Controllers/PurchaseOrdersController.cs#L14,L49,L85 | yes | UNKNOWN (ask) | Pending |
| F-04a | Auth guard — unauthenticated outcome | API | Unauthenticated caller is rejected (framework `[Authorize]` → `401`); not covered by a test | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L14 | yes | UNKNOWN (ask) | Pending |
| F-04b | Role guard — forbidden outcome | API | Caller lacking Buyer/Manager on POST, or Manager on DELETE, is rejected (`[Authorize(Roles)]` → `403`) | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L49,L85 | yes | UNKNOWN (ask) | Pending |
| F-04c | Custom in-body role check on Submit | API | Explicit second check rejects callers not in Finance/Buyer/Manager with `403 "You are not permitted to submit purchase orders"` | INFERRED | PROV:Controllers/PurchaseOrdersController.cs#L64-L67 | yes | UNKNOWN (ask) | Pending |
| F-05 | Monetary approval policy | svc | Threshold-based approve/deny decision, two calls deep (controller→service→helper); config-dependent for small orders | INFERRED | PROV:Services/ApprovalPolicyHelper.cs#L20-L49 | partial (config-dependent, see GAP-001) | UNKNOWN (ask) | Pending |
| F-06 | In-memory persistence & id assignment | svc | Orders stored in a static `Dictionary`; `Id` assigned from a static counter; `CreatedUtc` set to `DateTime.UtcNow` | STATIC | PROV:Services/PurchaseOrderService.cs#L13-L43 | no (internal; process-scoped) | UNKNOWN (ask) | Pending |

**Given/When/Then detail for INFERRED / high-risk behaviours:**

Behaviour F-01a: get by id — not found
  Given no order with the requested id exists in the store
  When `GET api/purchase-orders/{id}` is called
  Then respond `404 "Purchase order not found"`   (INFERRED · PROV:Controllers/PurchaseOrdersController.cs#L35-L38)

Behaviour F-02a: submit — first validation error wins
  Given a submitted order failing one or more field rules
  When `POST api/purchase-orders` is called
  Then respond `400` with the body being the FIRST failing rule's message only (validator returns on first error)   (INFERRED · PROV:Controllers/PurchaseOrdersController.cs#L53-L57, Validators/PurchaseOrderValidator.cs#L18-L46)

Behaviour F-02b: submit — approved
  Given a valid order that the approval policy approves
  When `POST api/purchase-orders` is called by an authorized submitter
  Then respond `200 OK` with the `ApprovalResult` object; the stored order Status is `"Approved"`   (INFERRED · PROV:Controllers/PurchaseOrdersController.cs#L72-L77, Services/PurchaseOrderService.cs#L39)

Behaviour F-02c: submit — not approved (returns 202, not an error)
  Given a valid order that the approval policy does NOT approve
  When `POST api/purchase-orders` is called
  Then respond `202 Accepted` with `result.Reason` as the plain-string body; the stored order Status is `"PendingReview"`   (INFERRED · PROV:Controllers/PurchaseOrdersController.cs#L72-L75, Services/PurchaseOrderService.cs#L39)

Behaviour F-03a: delete — no actual deletion
  Given an existing order id
  When `DELETE api/purchase-orders/{id}` is called by a Manager
  Then respond `204 No Content`; the order is NOT removed from the store (no removal call exists in the service)   (INFERRED · PROV:Controllers/PurchaseOrdersController.cs#L86-L103) — see GAP-003

Behaviour F-04c: submit — custom permission rejection
  Given an authenticated caller not in any of Finance, Buyer, or Manager
  When `POST api/purchase-orders` is called (having passed the `[Authorize(Roles="Buyer,Manager")]` attribute)
  Then respond `403 "You are not permitted to submit purchase orders"`   (INFERRED · PROV:Controllers/PurchaseOrdersController.cs#L64-L67)
  NOTE: this in-body check is unreachable for non-Buyer/non-Manager callers because the
  attribute at L49 already blocks them; it would only admit Finance if the attribute did
  — a conflict logged as GAP-002.

### 6. Business Rules & Calculations

| ID | Rule | Confidence | Provenance | Review status |
|---|---|---|---|---|
| R-01 | Null request body → `"Purchase order body is required"` | INFERRED | PROV:Validators/PurchaseOrderValidator.cs#L20-L23 | Pending |
| R-02 | Blank/whitespace VendorName → `"Vendor name is required"` | INFERRED | PROV:Validators/PurchaseOrderValidator.cs#L25-L28 | Pending |
| R-03 | Amount ≤ 0 → `"Amount must be greater than 0"` | **OBSERVED** | PROV:Validators/PurchaseOrderValidator.cs#L30-L33 ; test PROV:Validators/PurchaseOrderValidatorTests.cs#L11-L25 | Pending |
| R-04 | Amount > 250000 (`MaxAmount`) → `"Amount must not exceed 250000"` | INFERRED | PROV:Validators/PurchaseOrderValidator.cs#L13,L35-L38 | Pending |
| R-05 | Blank/whitespace CostCenter → `"Cost center is required"` | INFERRED | PROV:Validators/PurchaseOrderValidator.cs#L40-L43 | Pending |
| R-06 | Validation returns the FIRST failing message only (short-circuits; not an aggregated list) | INFERRED | PROV:Validators/PurchaseOrderValidator.cs#L18-L46 | Pending |
| R-07 | Amount ≥ 10000 (`ManagerApprovalThreshold`) AND submitter is NOT a manager → deny `"Orders of 10000 or more require a manager approver"`, RequiresManager=true | INFERRED | PROV:Services/ApprovalPolicyHelper.cs#L14,L24-L29 | Pending |
| R-08 | Submitter IS a manager → approve `"Approved by manager"` (evaluated after the ≥10000 non-manager check) | INFERRED | PROV:Services/ApprovalPolicyHelper.cs#L31-L34 | Pending |
| R-09 | Non-manager, `AutoApproveEnabled`=true AND Amount < `AutoApproveCeiling` → approve `"Auto-approved under ceiling"` | INFERRED | PROV:Services/ApprovalPolicyHelper.cs#L38-L44 | Pending |
| R-10 | Otherwise (non-manager, below 10000, auto-approve off or amount ≥ ceiling) → deny `"Manual review required"`, RequiresManager=false | INFERRED | PROV:Services/ApprovalPolicyHelper.cs#L46-L48 | Pending |
| R-11 | `AutoApproveCeiling` defaults to `ManagerApprovalThreshold` (10000) when the config value is missing/unparseable | INFERRED | PROV:Services/ApprovalPolicyHelper.cs#L58-L68 | Pending |

Calculations: order `Id` assigned from a static incrementing counter starting at 1
(`_nextId++`); `CreatedUtc = DateTime.UtcNow`. (STATIC · PROV:Services/PurchaseOrderService.cs#L16,L33-L34)

### 7. Data & Entities

**PurchaseOrder** (PROV:Models/PurchaseOrder.cs#L8-L23)
- `Id:int`, `VendorName:string`, `Amount:decimal`, `CostCenter:string`, `SubmittedBy:string`, `Status:string`, `CreatedUtc:DateTime`.
- No annotations/constraints on the model itself — all validation is in the validator (R-01…R-05).
- `Status` observed values: `"Approved"`, `"PendingReview"` (set by service); `"Locked"` referenced only in dead code (see GAP-003).
- `SubmittedBy` is present on the model but is never read or written by any code path seen — candidate dead field (log as §10 Q-05).
- **PII note:** `VendorName`, `SubmittedBy` are potential PII/identifying fields — names/shapes only, values masked.

**ApprovalResult** (PROV:Models/ApprovalResult.cs#L6-L28)
- `Approved:bool`, `Reason:string`, `RequiresManager:bool`. Factory methods `Ok(reason)` and `Denied(reason, requiresManager)`.

Persistence: static in-process `Dictionary<int,PurchaseOrder>` — no database (STATIC · PROV:Services/PurchaseOrderService.cs#L13-L14).

### 8. Integrations & External Contracts
- **None external.** No HTTP clients, queues, databases, or third-party APIs. JSON
  serialization via Newtonsoft.Json 13.0.3 (PROV:packages.config#L6). The only external
  input is `ConfigurationManager.AppSettings` from `Web.config` (see §9, GAP-001).

### 9. Cross-cutting
- **Auth mechanism:** declarative `[Authorize]` on the controller + `[Authorize(Roles=...)]`
  per action; plus one imperative role check via `AuthContext.IsInRole` on Submit.
  (STATIC · PROV:Controllers/PurchaseOrdersController.cs#L14,L49,L64-L67,L85 ; PROV:Security/AuthContext.cs#L28-L31)
- **Authorization model (roles):** `Buyer`, `Manager`, `Finance` referenced. GET requires
  only authentication; POST requires Buyer or Manager (attribute) plus the in-body check;
  DELETE requires Manager. *Which* roles are admitted and the 401/403 outcomes are INFERRED
  (F-04a/F-04b/F-04c), not tested.
- **Error contract:** plain-string bodies via `Content(HttpStatusCode, string)` — NOT a
  structured `{errorCode,message,traceId}` envelope. Status codes are used non-conventionally:
  a business "not approved" returns `202 Accepted` (F-02c), not a 4xx. (INFERRED · PROV:Controllers/PurchaseOrdersController.cs#L37,L56,L66,L74,L91)
- **Routing:** attribute routing enabled plus a legacy convention route `api/{controller}/{id}`
  (STATIC · PROV:App_Start/WebApiConfig.cs#L13-L18).
- **Audit/logging:** none present. **i18n:** none — all messages are hard-coded English literals.

### 10. ⚠ Cannot Be Derived From Code — confirm with stakeholders
- **Q-01 (NFRs):** No performance/scale/availability targets are expressed. In-memory static
  storage loses all data on restart and is not thread-safe — is that acceptable, or a defect? (PROV:Services/PurchaseOrderService.cs#L13-L16)
- **Q-02 (why — thresholds):** Rationale/basis for the $10,000 manager threshold and the
  $250,000 hard cap is not in the code. Are these regulatory, policy, or arbitrary? (PROV:Services/ApprovalPolicyHelper.cs#L14 ; PROV:Validators/PurchaseOrderValidator.cs#L13)
- **Q-03 (priority):** Which endpoints/behaviours are must-keep vs droppable in the target? Code cannot say.
- **Q-04 (compliance):** Any regulatory obligation behind purchase-order approval limits or audit? Not derivable.
- **Q-05 (deprecated/dead):** `SubmittedBy` field is never used; the `"Locked"` delete branch is dead;
  the Finance-exemption comment does not match the code. Keep, fix, or drop each? (PROV:Models/PurchaseOrder.cs#L18 ; PROV:Controllers/PurchaseOrdersController.cs#L62-L67,L94-L100)
- **Q-06 (intended vs bug):** Several surprising behaviours below need an intended-vs-bug ruling
  from a stakeholder — see the specific GAPs in §11 (202-on-not-approved, delete-does-not-delete,
  Finance-exemption never reachable).

### 11. Gaps Report

GAP-001 | PROV:Services/ApprovalPolicyHelper.cs#L36-L44 ; PROV:Web.config#L7-L10
        | type: static-unresolvable (config/feature-flag)
        | Whether a small (< 10000) non-manager order auto-approves depends on runtime
          `AutoApproveEnabled` / `AutoApproveCeiling` app-settings. `Web.config` ships
          `AutoApproveEnabled=false`, `AutoApproveCeiling=5000`, but a comment states these
          are environment-specific and overridden in production — so the actual production
          outcome (auto-approve vs "Manual review required") cannot be resolved statically.
        | resolve by: check runtime config (per environment) / ask a developer
        | disposition: Pending

GAP-002 | PROV:Controllers/PurchaseOrdersController.cs#L60-L67
        | type: conflicting-paths
        | The comment claims Finance is exempt from a cost-center ownership requirement, but
          (a) no cost-center ownership check exists anywhere, and (b) the in-body check at
          L64 admits Finance/Buyer/Manager, yet the method's `[Authorize(Roles="Buyer,Manager")]`
          attribute at L49 already blocks Finance before this code runs — so the Finance
          branch is unreachable and the documented exemption never takes effect. Comment and
          code conflict; not silently resolving which is authoritative.
        | resolve by: ask a developer / product owner
        | disposition: Pending

GAP-003 | PROV:Controllers/PurchaseOrdersController.cs#L94-L100 ; PROV:Services/PurchaseOrderService.cs#L25-L43
        | type: unreachable-looking / conflicting-paths
        | Delete: (a) the `order == null || order.Status == "Locked"` branch is dead — the
          method already returned 404 if null, and `"Locked"` is never assigned anywhere
          (comment confirms abandoned locking feature); (b) the success path returns 204 but
          the service exposes no removal operation, so DELETE does not actually delete the
          order. Whether "delete does nothing" is intended is unresolved.
        | resolve by: ask a developer / run the source (golden-master) to confirm the store is unchanged after DELETE
        | disposition: Pending

### 12. Confidence & Verification Summary
- Counts by tier: **OBSERVED 1** (R-03), **STATIC 8** (F-01, F-02, F-03, F-04, F-06, and the
  route/attribute/persistence existence facts), **INFERRED 15** (all decision/outcome items:
  F-01a, F-02a/b/c, F-03a/b, F-04a/b/c, F-05, R-01/02/04/05/06/07/08/09/10/11 — the INFERRED
  business rules are enumerated in §6).
- INFERRED items still `Pending`: all of the above (nothing dispositioned yet).
- **Two verification moments:** Human review @ Stage 0.6 dispositions every INFERRED rule,
  §10 question, and §11 gap (this gate). Golden-master @ Stage 5.0 can verify only externally
  observable behaviour — the status-code/message outcomes (F-01a, F-02a/b/c, F-03a/b, F-04*).
- **Human-verify-only** (no external observable): F-06 id/counter/persistence internals and
  the exact stored `Status` string are process-internal unless surfaced via a subsequent GET.
- **Golden-master runnability caveat:** the API project is a class Library with no host wiring
  visible in the fixture; if the source cannot be run, NO item is GM-promotable and the
  confidence ceiling is human-review-only. State to be confirmed at Stage 5.0 Step 1.

### 13. Review Log / Sign-off
_(empty — to be populated by the human reviewer; `APPROVE INVENTORY ADO-0004` stamps it.)_

| Item | Disposition | Reviewer | Date | Note |
|---|---|---|---|---|
| (pending) | | | | |

### 14. Traceability Contract
Feature IDs F-01 … F-06 (with sub-behaviours F-01a … F-04c) and rule IDs R-01 … R-11 are the
spine. Each flows forward to a Stage 1 architecture component, a Stage 2 feasibility rating,
an acceptance criterion / ADO task, and (where GM-verifiable) a golden-master recording.
Downstream artifacts reference these IDs. The feature→migration-cluster link is established at
Stage 3 when clusters are derived (not assumed here).

### Stage 0.6 Gate
```
SOURCE BEHAVIORAL INVENTORY — ADO-0004
  Coverage: 3/3 endpoints · 2/2 entities · 1 cluster deep / 0 light / 0 skipped
  Confidence: OBSERVED 1 · STATIC 8 · INFERRED 15
  Review Focus (must disposition): 11 inferred rules · 2 high-risk features · 6 stakeholder questions · 3 open gaps
  Verdict: READY FOR REVIEW

Open ADO-0004-source-inventory.md, disposition the Review Focus items, then reply
APPROVE INVENTORY ADO-0004.  (rewrite-from-spec: this BLOCKS Stage 1 architecture.)
```
