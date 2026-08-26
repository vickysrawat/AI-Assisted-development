SOURCE BEHAVIORAL INVENTORY — ADO-0003
Behavioral discovery from source — NOT a stakeholder-validated requirements spec.
Source baseline: tests/migration-validation/fixtures/nodejs-source-app @ 2026-08-26T00:00:00Z
Posture (Stage 0.5): rewrite-from-spec   Depth: Full
Status: ⏳ AWAITING REVIEW   (→ APPROVE INVENTORY ADO-0003 once the Review Focus items are dispositioned)

---

### 1. Executive Summary

A small Node.js / Express REST API ("expense-approval-service") that lets authenticated
callers submit expense claims and lets privileged callers approve or reject them. Data lives
in an in-memory `Map` (non-persistent, reseeded on process start). Callers are identified by
two request headers (`x-user-id`, `x-user-role`); there is no real token verification. The
service exposes a health check plus expense list/read/create/approve/reject operations, with
create-time validation and an approve/reject decision workflow (self-approval blocked,
already-decided blocked).

- **Coverage:** 6/6 endpoints · 1/1 entity (Expense) · 1 cluster deep / 0 light / 0 skipped.
- **Confidence split:** OBSERVED 5 · STATIC 13 · INFERRED 16.
- **Human-only gaps (§10):** 6 — the things only stakeholders can answer.
- **Open code gaps (§11):** 4 — code seen but not confidently resolved.
- **Review readiness verdict:** READY FOR REVIEW.

### 2. Review Focus & How to Disposition

The reviewer MUST disposition every item below before `APPROVE INVENTORY ADO-0003`:
- every **INFERRED** business rule in §6 (BR-01 through BR-10 where tiered INFERRED),
- every feature/behaviour flagged high-impact (F-05 approve, F-06 reject, and the reject
  role/self-approval conflicts),
- every item in **§10** (stakeholder questions),
- every open **GAP** in §11 (GAP-001 … GAP-004).

Mark each item's **Review status**: `Confirmed` · `Corrected: {note}` · `Rejected` ·
`Deferred: {reason}`. Items left `Pending` in this set BLOCK approval. OBSERVED/STATIC items
may be accepted in bulk.

### 3. Coverage & Method

- **Method:** directory-derivation (single module — no graph). Read `src/**`, `test/**`,
  `package.json` only. Source is not a standalone git repo; baseline is a timestamp.
- **Endpoints covered:** 6/6 — `GET /health`, `GET /api/expenses`, `GET /api/expenses/:id`,
  `POST /api/expenses`, `POST /api/expenses/:id/approve`, `POST /api/expenses/:id/reject`.
- **Entities covered:** 1/1 — Expense (in-memory `Map`).
- **Tests present:** `test/validators.test.js` — 5 passing unit tests, all against
  `validateExpense`. No tests exercise routes, auth, or approvalService — those layers have
  no OBSERVED coverage.
- **Skipped clusters:** none.

### 4. Actor & Capability Map

| Actor (role) | Capabilities |
|---|---|
| employee | authenticate; list expenses; read one expense; submit expense; reject expense (role guard admits only manager/admin, so employee is blocked at the guard — but the reject handler comment claims employees are allowed; see GAP-002) |
| manager | all employee read/submit capabilities; approve; reject |
| admin | same as manager (approve; reject) |
| unauthenticated / unknown-role caller | rejected at `authenticate` (except `GET /health`, which is unauthenticated) |

Authorization model is header-declared role membership checked by `requireRole`. `PROV:src/auth.js#L8`, `PROV:src/routes.js#L12`

### 5. Feature Catalog — cluster: Expense Approval Service

| ID | Feature | Layers | Behaviour / rules | Confidence | Provenance | GM-verifiable? | Priority | Review status |
|F-01| Health check | API | `GET /health` returns 200 `{ "status": "ok" }`; unauthenticated (mounted before `/api` router). | INFERRED | PROV:src/app.js#L10-L12 | yes | UNKNOWN (ask) | Pending |
| F-02 | Authentication middleware | API·svc | Populates `req.user` from `x-user-id` / `x-user-role` headers; rejects missing identity or unknown role. Guard is present on all `/api` routes. | STATIC (presence) / INFERRED (outcomes) | PROV:src/auth.js#L11-L25, PROV:src/routes.js#L12 | yes | UNKNOWN (ask) | Pending |
| F-03 | List expenses | API·svc·store | `GET /api/expenses` returns 200 with the array of all expenses (any authenticated caller). Store seeded with 2 records on process start. | STATIC (route + auth present) / INFERRED (200 + full-list body) | PROV:src/routes.js#L15-L17, PROV:src/store.js#L9-L14 | yes | UNKNOWN (ask) | Pending |
| F-04 | Get one expense | API·svc·store | `GET /api/expenses/:id` returns 200 with the record, or 404 when absent. | INFERRED | PROV:src/routes.js#L20-L26 | yes | UNKNOWN (ask) | Pending |
| F-05 | Submit (create) expense | API·svc·store | `POST /api/expenses` validates body then creates; 400 on validation failure, 201 with created record on success. Initial status is config-dependent (see GAP-001). | STATIC (route + validate call present) / INFERRED (status codes + branch) | PROV:src/routes.js#L29-L37, PROV:src/approvalService.js#L81-L88 | yes | UNKNOWN (ask) | Pending |
| F-06 | Approve expense | API·svc·store | `POST /api/expenses/:id/approve` — role-guarded (manager/admin present); maps service outcome to HTTP. High-impact. | STATIC (route + `requireRole('manager','admin')` present) / INFERRED (outcome→HTTP mapping) | PROV:src/routes.js#L40-L57, PROV:src/approvalService.js#L36-L56 | yes | UNKNOWN (ask) | Pending |
| F-07 | Reject expense | API·svc·store | `POST /api/expenses/:id/reject` — `requireRole('manager','admin')` IS present in code, but the handler comment claims "rejection is allowed for any authenticated user, including plain employees". Code and comment conflict — see GAP-002. High-impact. | STATIC (route + guard present) / INFERRED (outcome→HTTP mapping) | PROV:src/routes.js#L60-L77, PROV:src/approvalService.js#L58-L78 | yes | UNKNOWN (ask) | Pending |

**Given / When / Then detail for INFERRED / high-risk / edge behaviours:**

Behaviour F-02a: reject missing identity
  Given a request to any `/api/*` route with no `x-user-id` OR no `x-user-role` header
  When the route is called
  Then respond 401 `{ "error": "authentication required" }` — request does not proceed   (INFERRED · PROV:src/auth.js#L15-L17)

Behaviour F-02b: reject unknown role
  Given a request with both headers present but `x-user-role` not in `['employee','manager','admin']`
  When the route is called
  Then respond 401 `{ "error": "unknown role" }`   (INFERRED · PROV:src/auth.js#L19-L21)

Behaviour F-02c: requireRole rejection
  Given an authenticated caller whose role is not in the required set
  When a role-guarded route is called
  Then respond 403 `{ "error": "insufficient role" }`   (INFERRED · PROV:src/auth.js#L33-L35)

Behaviour F-04a: get non-existent expense
  Given no expense with the given `:id`
  When `GET /api/expenses/:id` is called
  Then respond 404 `{ "error": "expense not found" }`   (INFERRED · PROV:src/routes.js#L22-L24)

Behaviour F-05a: submit invalid body
  Given a create body that fails validation
  When `POST /api/expenses` is called
  Then respond 400 `{ "error": <validator message> }` — no record created   (INFERRED · PROV:src/routes.js#L30-L33)

Behaviour F-05b: submit valid body
  Given a create body that passes validation
  When `POST /api/expenses` is called
  Then respond 201 with the created record; initial status depends on runtime config (GAP-001)   (INFERRED · PROV:src/routes.js#L35-L36)

Behaviour F-06a: approve non-existent expense
  Given no expense with `:id`
  When `POST /api/expenses/:id/approve` is called by a manager/admin
  Then respond 404 `{ "error": "expense not found" }`   (INFERRED · PROV:src/routes.js#L44-L45, PROV:src/approvalService.js#L38-L40)

Behaviour F-06b: approve already-decided expense
  Given an expense whose `status` is not `"pending"`
  When approve is called
  Then respond 409 `{ "error": "expense already decided" }` — no state change   (INFERRED · PROV:src/routes.js#L46-L47, PROV:src/approvalService.js#L42-L44)

Behaviour F-06c: self-approval blocked
  Given a pending expense whose `employeeId` equals the caller's `x-user-id`
  When approve is called
  Then respond 403 `{ "error": "cannot approve your own expense" }` — no state change   (INFERRED · PROV:src/routes.js#L48-L49, PROV:src/approvalService.js#L17-L23)

Behaviour F-06d: approve success
  Given a pending expense the caller did not submit, caller role manager/admin
  When approve is called
  Then respond 200 with the updated record (`status: "approved"`, `decidedBy: <caller id>`)   (INFERRED · PROV:src/routes.js#L50-L51, PROV:src/approvalService.js#L51-L55)

Behaviour F-07a: reject already-decided / not-found / self
  Given the same preconditions as approve (not-found / non-pending / self)
  When `POST /api/expenses/:id/reject` is called
  Then respond 404 `{ "error": "expense not found" }` / 409 `{ "error": "expense already decided" }` / 403 `{ "error": "cannot approve your own expense" }` respectively (note: self-rejection reuses the "cannot approve your own expense" message verbatim)   (INFERRED · PROV:src/routes.js#L65-L71, PROV:src/approvalService.js#L58-L78)

Behaviour F-07b: reject success
  Given a pending expense the caller did not submit, caller passing the role guard
  When reject is called
  Then respond 200 with the updated record (`status: "rejected"`, `decidedBy: <caller id>`)   (INFERRED · PROV:src/routes.js#L72-L73, PROV:src/approvalService.js#L73-L77)

### 6. Business Rules & Calculations

| Rule | Statement | Confidence | Provenance |
|---|---|---|---|
| BR-01 | Body must be a non-null object, else 400 `"request body is required"`. | INFERRED | PROV:src/validators.js#L11-L13 |
| BR-02 | `employeeId` must be a non-empty (trimmed) string, else 400 `"employeeId is required"`. | INFERRED | PROV:src/validators.js#L15-L17 |
| BR-03 | `amount` must be a number and not NaN, else 400 `"amount must be a number"`. | INFERRED | PROV:src/validators.js#L19-L21 |
| BR-04 | `amount` must be `> 0`, else 400 `"amount must be > 0"`. | **OBSERVED** | PROV:src/validators.js#L23-L25 (test PROV:test/validators.test.js#L12-L22) |
| BR-05 | `amount` must not exceed 10000 (strictly `> 10000` rejected), else 400 `"amount must not exceed 10000"`. | **OBSERVED** | PROV:src/validators.js#L29-L31 (test PROV:test/validators.test.js#L24-L28) |
| BR-06 | `category` must be one of `['meals','travel','lodging','supplies']`, else 400 `"category is invalid"`. | **OBSERVED** | PROV:src/validators.js#L33-L35 (test PROV:test/validators.test.js#L30-L34) |
| BR-07 | A well-formed expense (valid employeeId, amount 0<x≤10000, allowed category) passes validation. | **OBSERVED** | PROV:src/validators.js#L37 (test PROV:test/validators.test.js#L7-L10) |
| BR-08 | An approver may never act (approve or reject) on their own expense claim, regardless of role — self-approval check compares `actor.id === expense.employeeId`. | INFERRED | PROV:src/approvalService.js#L17-L23 |
| BR-09 | Approve/reject only proceed when `expense.status === 'pending'`; any other status yields ALREADY_DECIDED (409). | INFERRED | PROV:src/approvalService.js#L42-L44, PROV:src/approvalService.js#L64-L66 |
| BR-10 | Auto-approval: a new expense is created `"approved"` when `config.autoApproveEnabled` is true AND `amount <= config.autoApproveCeiling`, otherwise `"pending"`. Both values are read from env at startup — statically unresolvable (GAP-001). Defaults if env absent: enabled=false, ceiling=50. | INFERRED | PROV:src/approvalService.js#L28-L33, PROV:src/config.js#L6-L13 |

Note: `description` defaults to empty string when falsy; `createdAt` is a hardcoded fixture
timestamp `2026-01-01T00:00:00.000Z`. STATIC. PROV:src/store.js#L23-L25.

### 7. Data & Entities

**Expense** (in-memory `Map`, non-persistent, reseeded on process start). PROV:src/store.js#L5-L29
- `id` — string, sequential (`String(nextId++)`), starts at "1".
- `employeeId` — string. Potentially PII-adjacent (identifies a person); values masked in review.
- `amount` — number.
- `category` — one of meals/travel/lodging/supplies.
- `description` — string, defaults to `''`.
- `status` — `pending` | `approved` | `rejected`.
- `createdAt` — ISO string (hardcoded fixture value).
- `decidedBy` — string (caller id), set on approve/reject.

Seed data: two records — `emp-1 / 42 / meals` and `emp-2 / 1200 / travel`, both `pending`. PROV:src/store.js#L12-L13

Relationships: none (single entity; no persistence layer). STATIC.

### 8. Integrations & External Contracts

- No external services, queues, databases, or third-party APIs. Only dependency is `express`. STATIC. PROV:package.json#L10-L12
- Auth contract is inbound HTTP headers only (`x-user-id`, `x-user-role`) — no external identity provider. STATIC. PROV:src/auth.js#L4-L6
- Listens on `PORT` env var (default 3000). STATIC. PROV:src/server.js#L5

### 9. Cross-cutting

- **Auth mechanism:** header-based pseudo-auth (`x-user-id`, `x-user-role`); no token verification (explicitly a fixture). STATIC. PROV:src/auth.js#L4-L6
- **Authorization model:** role membership via `requireRole(...roles)`; roles `employee`/`manager`/`admin`. approve is guarded to manager/admin; reject is ALSO guarded to manager/admin in code (contradicting its comment — GAP-002). STATIC (guards present). PROV:src/auth.js#L28-L38, PROV:src/routes.js#L40, PROV:src/routes.js#L60
- **Error contract:** JSON `{ "error": <string> }` with HTTP status (400/401/403/404/409/500). INFERRED for specific codes/messages. PROV:src/routes.js#L20-L77
- **Audit/logging:** none in request handlers except a single startup `console.log` of the listen port. STATIC. PROV:src/server.js#L11
- **i18n:** none — all messages are English string literals. STATIC.

### 10. ⚠ Cannot Be Derived From Code — confirm with stakeholders

- Q-01 (NFR): No performance SLA, scale, availability, or concurrency requirement is expressed. The in-memory store is process-local and non-persistent — is persistence a requirement, or intentional for this service's purpose?
- Q-02 (why): The single-transaction ceiling is 10000 and the auto-approve default ceiling is 50 — what is the business basis for these thresholds? Are they policy or placeholder?
- Q-03 (priorities): Which endpoints are must-keep vs droppable in the target? (e.g. is `/health` load-bearing for an orchestrator?)
- Q-04 (compliance): `employeeId` identifies individuals and expense amounts/categories are financial data — are there retention, audit, or regulatory obligations (e.g. SOX-style approval segregation)?
- Q-05 (intended vs bug): The reject endpoint's role guard contradicts its own comment (GAP-002) — which is intended: reject restricted to manager/admin, or open to all authenticated users?
- Q-06 (intended vs bug): Self-rejection returns the message "cannot approve your own expense" (GAP-003) — is reusing the approve-worded message on the reject path intended or a copy-paste defect?

### 11. Gaps Report

GAP-001 | PROV:src/config.js#L9-L12, PROV:src/approvalService.js#L28-L33 | type: static-unresolvable (config/feature-flag)
        | Initial status of a newly submitted expense depends on `AUTO_APPROVE_ENABLED` and `AUTO_APPROVE_CEILING`, read from the environment at process startup. Whether a new small expense is `approved` or `pending` cannot be determined from source alone. Defaults when env absent: enabled=false, ceiling=50.
        | resolve by: check runtime config (deployment env) | run the source (golden-master)
        | disposition: Pending

GAP-002 | PROV:src/routes.js#L60-L64 | type: conflicting-paths
        | The reject route applies `requireRole('manager','admin')`, but the handler's own comment states "rejection is allowed for any authenticated user, including plain employees — no role restriction is applied to this endpoint." Code and comment directly conflict; not silently resolved.
        | resolve by: ask a developer
        | disposition: Pending

GAP-003 | PROV:src/routes.js#L70-L71 | type: ambiguous-intent
        | On the reject path, the SELF_APPROVAL outcome returns 403 `"cannot approve your own expense"` — an approve-worded message on a reject action. Unclear whether the wording is intended or a copy-paste from the approve handler.
        | resolve by: ask a developer
        | disposition: Pending

GAP-004 | PROV:src/routes.js#L52-L55, PROV:src/routes.js#L74-L75 | type: unreachable-looking
        | The `default` branch returning 500 `"unexpected approval state"` in both approve and reject handlers is commented as unreachable ("approve() only ever returns one of the codes handled above"). Cannot statically confirm it is truly unreachable across all inputs; not asserting it as live behaviour.
        | resolve by: ask a developer | run the source (golden-master)
        | disposition: Pending

### 12. Confidence & Verification Summary

- **Counts by tier:** OBSERVED 5 (BR-04…BR-08) · STATIC 13 (route/guard/entity presence, integrations, cross-cutting structure) · INFERRED 16 (all conditional outcomes: status codes, messages, workflow branches, auto-approve logic).
- **INFERRED items still Pending:** all §5 behaviour rows and BR-01, BR-02, BR-03, BR-08, BR-09, BR-10 — pending human disposition.
- **Two verification moments:** (1) Human review @ Stage 0.6 (this gate) dispositions all INFERRED rules, §10 questions, and §11 gaps. (2) Golden-master @ Stage 5.0 replays externally observable behaviour (HTTP status/body). The self-approval and already-decided *internal* decisions ARE externally observable (they map to 403/409), so GM-verifiable. GAP-001 auto-approve is GM-verifiable ONLY under a known env configuration.
- **Source runnable?** `npm start` requires `express` installed; the fixture has a `package-lock.json`. If dependencies are unavailable at Stage 5.0, no item is GM-promotable and the confidence ceiling stays human-review-only.

### 13. Review Log / Sign-off

_No dispositions recorded yet. `APPROVE INVENTORY ADO-0003` will stamp this section. A Stage
5.0 verification-results block will be appended (append-only) after golden-master; §5
confidence and §11 stay exactly as signed._

### 14. Traceability Contract

Feature IDs F-01…F-07 are the spine. Each flows forward to a Stage 1 architecture component,
a Stage 2 feasibility rating, an acceptance criterion / ADO task, and (where GM-verifiable) a
golden-master recording. Business rules BR-01…BR-10 attach to their owning feature (BR-01…
BR-07 → F-05; BR-08…BR-09 → F-06/F-07; BR-10 → F-05). Downstream artifacts reference these
IDs. The feature→migration-cluster link is established at Stage 3, not here.

---

### Stage 0.6 Gate

```
SOURCE BEHAVIORAL INVENTORY — ADO-0003
  Coverage: 6/6 endpoints · 1/1 entities · 1 cluster deep / 0 light / 0 skipped
  Confidence: OBSERVED 5 · STATIC 13 · INFERRED 16
  Review Focus (must disposition): 10 inferred rules/behaviours · 2 high-risk features (F-06, F-07) · 6 stakeholder questions · 4 open gaps
  Verdict: READY FOR REVIEW

Open ADO-0003-source-inventory.md, disposition the Review Focus items, then reply
APPROVE INVENTORY ADO-0003.  (rewrite-from-spec: this BLOCKS Stage 1 architecture.)
```
