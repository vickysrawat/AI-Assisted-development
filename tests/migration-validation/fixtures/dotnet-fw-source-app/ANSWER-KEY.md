# ANSWER KEY — dotnet-fw-source-app (Purchase Order Approval API)

Ground-truth documentation of everything this fixture actually does. Line numbers were
re-read from the written files and are exact. All paths are relative to this fixture root
(`tests/migration-validation/fixtures/dotnet-fw-source-app/`), forward-slashed.

## App summary

A small ASP.NET Web API on .NET Framework 4.8 (`TargetFrameworkVersion` v4.8, WebApi 5.2.9)
exposing purchase-order approval endpoints:

- `GET  api/purchase-orders/{id}` — fetch one order (any authenticated user).
- `POST api/purchase-orders` — submit an order for approval (Buyer or Manager).
- `DELETE api/purchase-orders/{id}` — delete an order (Manager only).

Request flow for a submit: controller runs field validation (separate validator class),
then a custom role check, then delegates to `PurchaseOrderService.Submit`, which delegates
the monetary approval decision to `ApprovalPolicyHelper.Evaluate` (two levels of indirection).
The approval outcome for small orders depends on runtime Web.config app-settings.

Note: this is a legacy-idiom test fixture. Endpoint bodies return bare strings, the store is
static in-memory, and it contains deliberate traps. That is intentional for the fixture and
does not reflect production API conventions.

## Behaviors

| id | behavior (plain English) | file | line(s) | exact outcome (verbatim status code + message/threshold) | evidence | path |
|----|--------------------------|------|---------|-----------------------------------------------------------|----------|------|
| B1 | Submit rejects amount <= 0 | Validators/PurchaseOrderValidator.cs | 30-33 | 400 Bad Request, body `Amount must be greater than 0` (returned by controller at Controllers/PurchaseOrdersController.cs:56) | has-test | error/edge |
| B2 | Submit rejects missing/blank vendor name | Validators/PurchaseOrderValidator.cs | 25-28 | 400 Bad Request, body `Vendor name is required` | logic-only | error/edge |
| B3 | Submit rejects amount above the max threshold of 250000 | Validators/PurchaseOrderValidator.cs | 35-38 | 400 Bad Request, body `Amount must not exceed 250000` (threshold const `MaxAmount = 250000m` at line 13) | logic-only | error/edge |
| B4 | Submit rejects missing/blank cost center | Validators/PurchaseOrderValidator.cs | 40-43 | 400 Bad Request, body `Cost center is required` | logic-only | error/edge |
| B5 | Submit rejects null request body | Validators/PurchaseOrderValidator.cs | 20-23 | 400 Bad Request, body `Purchase order body is required` | logic-only | error/edge |
| B6 | Controller-level field validation is applied from the separate validator (validator defined in one file, applied in another) | Controllers/PurchaseOrdersController.cs | 53-57 | any validator error string returned as 400 Bad Request (behavior spans PurchaseOrderValidator.cs + PurchaseOrdersController.cs) | logic-only | error/edge |
| B7 | All endpoints require authentication (class-level attribute) | Controllers/PurchaseOrdersController.cs | 14 | 401 Unauthorized when unauthenticated (`[Authorize]` on the controller) | structural | error/edge |
| B8 | Submit restricted to Buyer or Manager roles (declarative) | Controllers/PurchaseOrdersController.cs | 49 | 403 Forbidden when authenticated but not in Buyer/Manager (`[Authorize(Roles = "Buyer,Manager")]`) | structural | error/edge |
| B9 | Delete restricted to Manager role (declarative) | Controllers/PurchaseOrdersController.cs | 85 | 403 Forbidden when authenticated but not a Manager (`[Authorize(Roles = "Manager")]`) | structural | error/edge |
| B10 | Custom in-body role guard on Submit rejects callers not in Finance/Buyer/Manager | Controllers/PurchaseOrdersController.cs | 64-67 | 403 Forbidden, body `You are not permitted to submit purchase orders` | logic-only | error/edge |
| B11 | INDIRECTION: orders at or above 10000 submitted by a non-manager are denied and require a manager approver (controller -> service -> helper) | Services/ApprovalPolicyHelper.cs | 24-29 | 202 Accepted, body `Orders of 10000 or more require a manager approver` (denied result surfaced by controller at Controllers/PurchaseOrdersController.cs:72-74; threshold const `ManagerApprovalThreshold = 10000m` at line 14) | logic-only | error/edge |
| B12 | An order submitted by a Manager is approved | Services/ApprovalPolicyHelper.cs | 31-34 | 200 OK, ApprovalResult with reason `Approved by manager` | logic-only | happy |
| B13 | AMBIGUOUS: a sub-10000 non-manager order auto-approves only if Web.config `AutoApproveEnabled` is true AND amount < `AutoApproveCeiling`; otherwise manual review. Runtime config decides. | Services/ApprovalPolicyHelper.cs | 38-48 | If auto-approve on and under ceiling: 200 OK reason `Auto-approved under ceiling`. Otherwise: 202 Accepted, body `Manual review required`. Cannot be determined from code alone — depends on AutoApproveEnabled/AutoApproveCeiling app-settings (Web.config lines 7, 10). | ambiguous | happy |
| B14 | GetById returns the order when found | Controllers/PurchaseOrdersController.cs | 40 | 200 OK with the PurchaseOrder | structural | happy |
| B15 | GetById returns not-found when the order does not exist | Controllers/PurchaseOrdersController.cs | 35-38 | 404 Not Found, body `Purchase order not found` | logic-only | error/edge |
| B16 | Delete returns not-found when the order does not exist | Controllers/PurchaseOrdersController.cs | 89-92 | 404 Not Found, body `Purchase order not found` | logic-only | error/edge |
| B17 | Delete succeeds for an existing order (Manager) | Controllers/PurchaseOrdersController.cs | 102 | 204 No Content | structural | happy |
| B18 | Approved submit returns the approval result | Controllers/PurchaseOrdersController.cs | 77 | 200 OK with the ApprovalResult | structural | happy |
| B19 | Denied submit returns the denial reason (non-blocking accept) | Controllers/PurchaseOrdersController.cs | 72-74 | 202 Accepted, body = the ApprovalResult.Reason | logic-only | error/edge |

## TRAPS — never report these as real behavior

1. **Dead / unreachable code** — `Controllers/PurchaseOrdersController.cs:97-100`.
   The branch `if (order == null || order.Status == "Locked")`. It is unreachable/never-true:
   `order == null` was already handled and returned at lines 89-92, and the literal string
   `"Locked"` is never assigned to `Status` anywhere in the codebase (Status is only ever set
   to `"Approved"` or `"PendingReview"` in Services/PurchaseOrderService.cs:39). The 409
   Conflict `Order is locked and cannot be deleted` response can never be produced.

2. **Misleading comment that contradicts the code** — `Controllers/PurchaseOrdersController.cs:61-63`.
   The comment claims "a submitter must own a cost center to file against it. The Finance role
   is exempt from the cost-center ownership requirement." The actual code (lines 64-67) does
   NO cost-center ownership check at all — it only checks role membership
   (`Finance`/`Buyer`/`Manager`). There is no cost-center-ownership logic anywhere. The comment
   describes behavior that does not exist.

   (Secondary contradiction, same class: the Submit doc-comment at lines 43-46 says "Restricted
   to the Buyer role; managers may also submit," but the effective declarative restriction is
   Buyer OR Manager via the attribute at line 49 — not Buyer-primary. The primary intended
   misleading-comment trap is the cost-center one at 61-63.)

## Summary count

- Total behaviors: **19** (B1-B19)
- has-test: **1** (B1)
- structural: **6** (B7, B8, B9, B14, B17, B18)
- logic-only: **11** (B2, B3, B4, B5, B6, B10, B11, B12, B15, B16, B19)
- ambiguous: **1** (B13)
- Traps: **2** (1 dead-code block, 1 misleading comment)

## File inventory

- PurchaseOrders.Api.csproj — .NET Framework v4.8 Web API project file
- PurchaseOrders.Tests.csproj — xUnit test project (v4.8), references the API project
- packages.config — pins Microsoft.AspNet.WebApi 5.2.9 (unmistakably .NET Framework)
- Web.config — appSettings `AutoApproveEnabled` and `AutoApproveCeiling` (the ambiguous flags)
- App_Start/WebApiConfig.cs — attribute-route registration
- Controllers/PurchaseOrdersController.cs — the API controller (auth, validation, endpoints, both traps)
- Services/IPurchaseOrderService.cs — service interface
- Services/PurchaseOrderService.cs — in-memory store + approval workflow (delegates to helper)
- Services/ApprovalPolicyHelper.cs — monetary policy helper (indirection target; ambiguous config branch)
- Validators/PurchaseOrderValidator.cs — field validation (cross-file behavior source)
- Models/PurchaseOrder.cs — order model
- Models/ApprovalResult.cs — approval outcome model
- Security/AuthContext.cs — principal wrapper used by the custom role check
- Validators/PurchaseOrderValidatorTests.cs — the one unit test (covers B1)
