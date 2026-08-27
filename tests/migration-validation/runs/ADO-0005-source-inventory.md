SOURCE BEHAVIORAL INVENTORY — ADO-0005
Behavioral discovery from source — NOT a stakeholder-validated requirements spec.
Source baseline: tests/migration-validation/fixtures/angular-source-app @ 2026-08-26T00:00:00Z
Posture (Stage 0.5): rewrite-from-spec   Depth: Full
Status: ⏳ AWAITING REVIEW   (→ APPROVE INVENTORY ADO-0005 once the Review Focus items are dispositioned)

---

### 1. Executive Summary

An Angular 17+ standalone-component single-page application for employee **leave-request management**. An employee can submit a new leave request (type, start date, number of days, reason) via a reactive form with client-side validation, view their own list of requests, and — if their role permits — reach an approvals screen. Authorisation is role-based (`employee` / `manager` / `admin`) and routed through a permission service behind a route guard. There is no local persistence: reads/writes go to a REST API under a configurable base URL, and the currently signed-in user is held in an in-memory signal.

- **Coverage:** 3/3 routed screens · 3/3 view models (LeaveRequest, NewLeaveRequest, CurrentUser) · 1 cluster deep, 0 light, 0 skipped.
- **Confidence split:** OBSERVED 3 · STATIC 9 · INFERRED 12.
- **Human-only gaps (§10):** 6 — priorities, NFRs, feature-flag intent, dead-code intent.
- **Open code gaps (§11):** 3 — feature-flag-dependent behaviour + dead/unreachable code.
- **Review readiness verdict:** READY FOR REVIEW.

### 2. Review Focus & How to Disposition

The reviewer MUST disposition every item below before `APPROVE INVENTORY`:
- every **INFERRED** business rule in §6 (rules BR-01 … BR-08 marked INFERRED),
- every item in **§10** (stakeholder questions),
- every open **GAP** in §11.

Mark each item's **Review status** as: `Confirmed` · `Corrected: {note}` · `Rejected` · `Deferred: {reason}`. Items left `Pending` in this set BLOCK approval. OBSERVED/STATIC items may be accepted in bulk. (Migration-risk RED ratings are added at Stage 2 Feasibility; none pre-flagged here.)

### 3. Coverage & Method

- **Method:** directory-derived (single `src/app/leave/` bounded context + routing/config); no knowledge graph used — the app is small enough to read in full.
- **Screens (routes):** `new-request` (LeaveRequestFormComponent), `my-requests` (MyRequestsComponent), `approvals` (ApprovalsComponent, guarded). Root `''` redirects to `new-request`. 3/3 covered deep.
- **Services:** AuthService, PermissionService, LeaveApiService, plus `maxLeaveDaysValidator` and `approverGuard` — all covered.
- **Tests present:** `permission.service.spec.ts` (3 passing cases) — the only test file. Everything it asserts is tiered OBSERVED; everything else is STATIC (element present) or INFERRED (decision/value read from imperative logic).
- **Skipped:** none. Pure plumbing not inventoried: `app.config.ts` (DI wiring — `provideRouter` / `provideHttpClient`), interface/model type declarations (no behaviour).
- **Not a git repo** — baseline is a timestamp; source drift after this snapshot invalidates sign-off.

### 4. Actor & Capability Map

| Actor (role) | Capabilities |
|---|---|
| Employee | Submit a leave request; view own request list. BLOCKED from approvals screen (redirected). |
| Manager | All employee capabilities + reach the approvals screen. |
| Admin | Same as manager (both in `approverRoles`). |
| Unauthenticated / unknown (null user) | Permission checks deny; approvals guard redirects. Employee id falls back to `'unknown'` for API calls. |

Note: role is read from an in-memory signal seeded to a fixed employee (`e-100`, role `employee`); there is no login flow in the source. See GAP-002 / §10.

### 5. Feature Catalog

Cluster: **Leave Management** (single bounded context — `src/app/leave/`)

| ID | Feature | Layers (UI·API·svc·DB·job) | Behaviour / rules | Confidence | Provenance | GM-verifiable? | Priority | Review status |
|---|---|---|---|---|---|---|---|---|
| F-01 | Route table & default redirect | UI | 4 routes declared; `''` → redirect to `new-request` (`pathMatch:'full'`); `approvals` carries `canActivate:[approverGuard]`. | STATIC | PROV:src/app/app.routes.ts#L7-L16 | yes | UNKNOWN (ask) | Pending |
| F-02 | Approvals screen access guard | UI·svc | `canActivate` guard delegates to `PermissionService.canApproveLeave()`; allow → navigate, deny → redirect to `/my-requests`. | STATIC (contract) / INFERRED (decision) | PROV:src/app/leave/approver.guard.ts#L11-L21 | yes | UNKNOWN (ask) | Pending |
| F-03 | Role-based approval permission | svc | `canApproveLeave()` true only for role in `['manager','admin']`; false for `employee` and for null user. | OBSERVED | PROV:src/app/leave/permission.service.ts#L14-L22 | yes | UNKNOWN (ask) | Pending |
| F-04 | Current-user state | svc | In-memory signal holds `CurrentUser | null`; seeded to `{e-100, Dana Employee, employee}`; `setUser`/`isAuthenticated` accessors. | STATIC | PROV:src/app/leave/auth.service.ts#L15-L34 | no | UNKNOWN (ask) | Pending |
| F-05 | New leave request form | UI | Reactive form: type (select annual/sick/unpaid), startDate (date), days (number), reason (textarea); submit button disabled while `form.invalid`. | STATIC | PROV:src/app/leave/leave-request-form.component.ts#L14-L70 | yes | UNKNOWN (ask) | Pending |
| F-06 | Form validation — required fields | UI | `type`, `startDate`, `days`, `reason` each `Validators.required` → empty control INVALID `{required:true}`; per-field error messages shown. | STATIC (contract) | PROV:src/app/leave/leave-request-form.component.ts#L61-L70 | yes | UNKNOWN (ask) | Pending |
| F-07 | Form validation — minimum days | UI | `days` has `Validators.min(1)`; below-min → `{min}` error, message "You must request at least one day." | STATIC (contract) / INFERRED (message) | PROV:src/app/leave/leave-request-form.component.ts#L64-L66 | yes | UNKNOWN (ask) | Pending |
| F-08 | Form validation — max days per request | UI·svc | Custom `maxLeaveDaysValidator`: days > `environment.maxLeaveDays` (20 checked-in) → `{overLimit:{max,actual}}`; message from `OVER_LIMIT_MESSAGE`. | INFERRED | PROV:src/app/leave/leave-duration.validator.ts#L9-L22 | yes | UNKNOWN (ask) | Pending |
| F-09 | Submit leave request | UI·API·svc | On valid submit POST to `{apiBaseUrl}/leave` with `{...req, employeeId}`; success → navigate `/my-requests`; error → show banner with mapped message. | INFERRED | PROV:src/app/leave/leave-request-form.component.ts#L72-L93 | yes | UNKNOWN (ask) | Pending |
| F-10 | Submit error mapping | API·svc | HTTP 409 → banner "You already have a request for those dates."; any other error → "Could not submit your leave request. Please try again." | INFERRED | PROV:src/app/leave/leave-api.service.ts#L37-L49 | yes | UNKNOWN (ask) | Pending |
| F-11 | Auto-approve short leave (flag-gated) | UI | If `environment.autoApproveShortLeave` AND days ≤ 1 → show "Your short leave was approved automatically." Runtime behaviour depends on a deploy-time flag — see GAP-001. | INFERRED | PROV:src/app/leave/leave-request-form.component.ts#L84-L86 | no | UNKNOWN (ask) | Pending |
| F-12 | List my requests | UI·API·svc | On init, GET `{apiBaseUrl}/leave?employeeId={id}`; renders loading → then list / empty / error states. | INFERRED | PROV:src/app/leave/my-requests.component.ts#L34-L41 | yes | UNKNOWN (ask) | Pending |
| F-13 | List error/empty mapping | API·svc | HTTP 404 → empty list, no error; any other error → banner "Could not load your leave requests." Empty list → "You have no leave requests yet." | INFERRED | PROV:src/app/leave/leave-api.service.ts#L23-L34 | yes | UNKNOWN (ask) | Pending |
| F-14 | My-requests view states | UI | Four exclusive states: loading ("Loading…"), error (banner), empty ("You have no leave requests yet."), populated (list of `startDate — days day(s) — status`). | STATIC (states) / INFERRED (ordering) | PROV:src/app/leave/my-requests.component.ts#L10-L24 | yes | UNKNOWN (ask) | Pending |
| F-15 | Employee-id fallback | svc | When no signed-in user, `employeeId` used for API calls defaults to `'unknown'` (both list and submit). | INFERRED | PROV:src/app/leave/my-requests.component.ts#L35 | no | UNKNOWN (ask) | Pending |

**Given / When / Then detail for INFERRED / gap-adjacent / high-risk behaviours:**

Behaviour F-02: approvals screen access (custom guard decision)
  Given a signed-in user whose role is not `manager` or `admin` (e.g. the seeded `employee`)
  When navigation to `/approvals` is attempted
  Then the guard returns a `UrlTree` for `/my-requests` → current navigation cancelled + redirect to `/my-requests` (redirect target is INFERRED source logic; the "UrlTree → cancel+redirect" is the framework contract, STATIC)
  (INFERRED · PROV:src/app/leave/approver.guard.ts#L15-L20)

Behaviour F-03: role-based approval permission (test-covered)
  Given a signed-in user
  When `canApproveLeave()` is evaluated
  Then it returns true only if role ∈ {manager, admin}; false for employee; false when no user is signed in
  (OBSERVED — permission.service.spec.ts asserts employee=false, manager=true, null=false · PROV:src/app/leave/permission.service.ts#L16-L22 · test PROV:src/app/leave/permission.service.spec.ts#L15-L28)

Behaviour F-07: minimum-days validation
  Given the `days` control value < 1
  When the form validates (on change and on submit)
  Then control is INVALID with `{min}` and the form shows "You must request at least one day."; submit button disabled
  (STATIC contract via `Validators.min(1)`; INFERRED for the exact message · PROV:src/app/leave/leave-request-form.component.ts#L28-L30,L64-L66)

Behaviour F-08: max-days-per-request validation
  Given `days` is a number and days > 20 (checked-in `environment.maxLeaveDays`)
  When the form validates
  Then control is INVALID with `{overLimit:{max:20,actual:<value>}}` and shows "Requested days exceed the maximum allowed per request."
  And when `days` is non-numeric the validator returns null (defers to required/type handling)
  (INFERRED — custom validator; threshold 20 is checked-in but see GAP-003 · PROV:src/app/leave/leave-duration.validator.ts#L9-L22)

Behaviour F-09/F-10: submit outcomes
  Given a valid form
  When submit POSTs and the API responds 409
  Then an error banner shows "You already have a request for those dates." — no navigation
  Given any other submit error
  Then an error banner shows "Could not submit your leave request. Please try again." — no navigation
  Given success
  Then navigate to `/my-requests`
  (INFERRED · PROV:src/app/leave/leave-api.service.ts#L41-L48 · PROV:src/app/leave/leave-request-form.component.ts#L89-L92)

Behaviour F-11: auto-approve short leave (flag-dependent — GAP-001)
  Given `environment.autoApproveShortLeave` is true AND days ≤ 1
  When the form is submitted
  Then the "Your short leave was approved automatically." banner is shown
  BUT the effective runtime value of the flag is set by CI at deploy time and is NOT knowable from source (checked-in value is false)
  (INFERRED / GAP · PROV:src/app/leave/leave-request-form.component.ts#L84-L86 · flag PROV:src/environments/environment.ts#L9)

Behaviour F-13: list outcomes
  Given the current employee has no requests and the API responds 404
  When the list loads
  Then requests = empty, no error → UI shows "You have no leave requests yet."
  Given any other list error
  Then UI shows banner "Could not load your leave requests."
  (INFERRED · PROV:src/app/leave/leave-api.service.ts#L26-L32 · PROV:src/app/leave/my-requests.component.ts#L14-L16)

### 6. Business Rules & Calculations

| Rule | Statement | Confidence | Provenance |
|---|---|---|---|
| BR-01 | Only roles `manager` or `admin` may reach the approvals screen; `employee` and null user are denied. | OBSERVED | PROV:src/app/leave/permission.service.ts#L14-L22 |
| BR-02 | A denied approvals navigation redirects to `/my-requests` (not a blank cancel / not `/login`). Note: guard JSDoc mentions "unknown users go to /login" but the code always returns the `/my-requests` UrlTree — see GAP-002. | INFERRED | PROV:src/app/leave/approver.guard.ts#L15-L20 |
| BR-03 | `type`, `startDate`, `days`, and `reason` are all required to submit a leave request. | STATIC (contract) | PROV:src/app/leave/leave-request-form.component.ts#L62-L69 |
| BR-04 | Minimum leave request is 1 day (`Validators.min(1)`). | STATIC (contract) / INFERRED (message) | PROV:src/app/leave/leave-request-form.component.ts#L64-L66 |
| BR-05 | A single request may not exceed `maxLeaveDays` (checked-in 20) days; violation → `overLimit` error. Non-numeric days is not rejected by this validator. | INFERRED | PROV:src/app/leave/leave-duration.validator.ts#L14-L18 |
| BR-06 | Duplicate-dates submission (API 409) → "You already have a request for those dates."; other submit failures → generic retry message. | INFERRED | PROV:src/app/leave/leave-api.service.ts#L41-L48 |
| BR-07 | Missing list resource (API 404) is treated as an empty result, not an error. | INFERRED | PROV:src/app/leave/leave-api.service.ts#L26-L30 |
| BR-08 | A request of ≤ 1 day is auto-approved without a manager ONLY when the `autoApproveShortLeave` flag is on (deploy-time; see GAP-001). | INFERRED | PROV:src/app/leave/leave-request-form.component.ts#L84-L86 |

Workflow/state: leave request lifecycle status is `pending | approved | rejected` (model type only — no client-side transition logic observed; status is displayed as returned by the API).
PROV:src/app/leave/leave.model.ts#L3

### 7. Data & Entities

| Entity | Fields (shape) | Notes / PII |
|---|---|---|
| LeaveRequest | id, employeeId, type(`annual\|sick\|unpaid`), startDate(ISO string), days(number), reason(string), status(`pending\|approved\|rejected`) | `reason` free-text (may contain PII — value masked). PROV:src/app/leave/leave.model.ts#L5-L13 |
| NewLeaveRequest | type, startDate, days, reason (no id/employeeId — employeeId attached at submit) | PROV:src/app/leave/leave.model.ts#L15-L20 |
| CurrentUser | id, name, role(`employee\|manager\|admin`) | `name` is PII (masked). Held in-memory only. PROV:src/app/leave/auth.service.ts#L3-L9 |

No client-side persistence / DB — all state is in-memory signals + REST API. No key relationships enforced client-side beyond `employeeId` linkage.

### 8. Integrations & External Contracts

| Integration | Contract (observable) | Provenance |
|---|---|---|
| Leave REST API | Base `{environment.apiBaseUrl}/leave` (checked-in `apiBaseUrl='/api'`). GET `?employeeId={id}` → `LeaveRequest[]`. POST body `{...NewLeaveRequest, employeeId}` → `LeaveRequest`. | PROV:src/app/leave/leave-api.service.ts#L20-L49 |
| — status codes consumed | GET: 404 → empty; other → error banner. POST: 409 → duplicate message; other → generic message. (These are HTTP codes the client *reads*; the app's own outcomes are UI states/banners, recorded verbatim in §5.) | PROV:src/app/leave/leave-api.service.ts#L26-L45 |

No queues, auth headers/interceptors, or third-party APIs observed. `provideHttpClient()` configured with no interceptors. PROV:src/app/app.config.ts#L7

### 9. Cross-cutting

- **Auth mechanism:** none in source — `AuthService` holds an in-memory `CurrentUser` signal seeded to a fixed employee; no token, login, or HTTP auth header. PROV:src/app/leave/auth.service.ts#L15-L21
- **Authorization model:** role-based, single allow-list `approverRoles = ['manager','admin']` in `PermissionService`; enforced client-side only via the route guard. PROV:src/app/leave/permission.service.ts#L14
- **Error contract:** API errors are mapped in `LeaveApiService` to either a `ListResult.error` string (reads) or a thrown `Error` with a user-facing message (writes); components render banners. No structured error envelope. PROV:src/app/leave/leave-api.service.ts#L8-L11
- **Audit/logging:** none observed.
- **i18n:** none — all UI strings are hard-coded English literals in templates/constants.

### 10. ⚠ Cannot Be Derived From Code — confirm with stakeholders

- Q1 (NFR): No performance/scale/availability targets are expressed anywhere. What are they?
- Q2 (Auth): The source has no real authentication (in-memory seeded user). Is a real login/token flow expected in the target, and who provides the identity? PROV:src/app/leave/auth.service.ts#L15-L21
- Q3 (Priorities): Which features are must-keep vs. droppable for the migration? Code cannot say.
- Q4 (Feature-flag intent): Is short-leave auto-approval (≤1 day) intended to be ON in production? The checked-in flag is `false` but CI overwrites it — what is the real production value and business rule? PROV:src/environments/environment.ts#L7-L9
- Q5 (Max-days rationale): Is 20 the correct/authoritative max-days-per-request limit, or a placeholder? Should it vary by leave type or role? PROV:src/environments/environment.ts#L10
- Q6 (Intended vs. bug): (a) The guard's JSDoc says unknown users go to `/login`, but the code always redirects to `/my-requests` — which is intended? (b) `LeaveRequestFormComponent.revalidate()` is dead/unwired code — should it exist, and is the "Please fix the highlighted fields." message meant to appear anywhere? PROV:src/app/leave/approver.guard.ts#L8-L20 · PROV:src/app/leave/leave-request-form.component.ts#L96-L107

### 11. Gaps Report

GAP-001 | PROV:src/app/leave/leave-request-form.component.ts#L84-L86 (flag PROV:src/environments/environment.ts#L7-L9) | type: static-unresolvable (config/feature-flag)
        | Whether the auto-approve-short-leave banner/behaviour actually fires in production is gated on `environment.autoApproveShortLeave`, which CI overwrites at deploy time; the checked-in value (`false`) does not necessarily reflect runtime. Cannot assert the live behaviour from source.
        | resolve by: check runtime config (CI pipeline variable) / ask a developer
        | disposition: Pending

GAP-002 | PROV:src/app/leave/approver.guard.ts#L8-L20 | type: conflicting-paths
        | The guard's JSDoc states "unknown users go to /login", but the implementation unconditionally returns a `UrlTree` for `/my-requests` for every denied case (no `/login` path exists). Doc and code conflict on the redirect target for a null/unknown user — not silently resolving.
        | resolve by: ask a developer (which is the intended redirect for unauthenticated users)
        | disposition: Pending

GAP-003 | PROV:src/app/leave/leave-request-form.component.ts#L96-L107 | type: unreachable-looking
        | `revalidate()` is a private method with no caller (submit is gated on `form.invalid` and validators run on change). Its body — including `submitError.set('Please fix the highlighted fields.')` — appears unreachable. Cannot confirm from source whether it is intentional dead code or a wiring bug.
        | resolve by: ask a developer / usage data
        | disposition: Pending

### 12. Confidence & Verification Summary

- **Counts:** OBSERVED 3 · STATIC 9 · INFERRED 12 (features F-01…F-15 mix; §6 rules BR-01 OBSERVED, BR-03/BR-04 STATIC-contract, remainder INFERRED).
- **INFERRED still Pending:** all of §6 BR-02, BR-05, BR-06, BR-07, BR-08 and features F-08, F-09, F-10, F-11, F-12, F-13, F-15 await human disposition.
- **Two verification moments:** (1) Human review @ Stage 0.6 — this gate, dispositions INFERRED rules + §10 + §11. (2) Golden-master @ Stage 5.0 — replays externally observable behaviour only.
- **Human-verify-only (not GM-observable):** F-04 (in-memory user state), F-11 (flag-gated banner — depends on CI config, GAP-001), F-15 (employee-id fallback string). The source is a fixture with no running backend in this snapshot; if the source cannot be run at Stage 5.0, NO item is GM-promotable and the ceiling stays human-review-only.

### 13. Review Log / Sign-off

_No dispositions recorded yet. `APPROVE INVENTORY ADO-0005` stamps this section. A Stage 5.0 verification-results block will be appended (append-only) after golden-master; §5 confidence and §11 are frozen at approval._

### 14. Traceability Contract

Feature IDs F-01…F-15 are the spine. Each flows forward to a Stage 1 architecture component, a Stage 2 feasibility rating, an acceptance criterion / ADO task, and (where GM-verifiable) a golden-master recording. Downstream artifacts reference these IDs. The feature→migration-cluster link is established at Stage 3 when clusters are derived (this app is a single "Leave Management" bounded context, so a 1:1 mapping is likely but not assumed here).
