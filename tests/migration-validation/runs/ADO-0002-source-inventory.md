SOURCE BEHAVIORAL INVENTORY — ADO-0002
Behavioral discovery from source — NOT a stakeholder-validated requirements spec.
Source baseline: tests/migration-validation/fixtures/nodejs-source-app @ 2026-08-26T00:00:00Z
Posture (Stage 0.5): rewrite-from-spec   Depth: Full
Status: ⏳ AWAITING REVIEW   (→ APPROVE INVENTORY ADO-0002 once the Review Focus items are dispositioned)

---

## 1. Executive Summary

A small Express (Node.js) REST API — an **expense-approval service**. Authenticated callers can
submit expense claims, list/read them, and (as manager/admin) approve or reject a pending claim.
Data lives in an in-memory `Map` seeded at startup (no persistence). Authentication is a fixture-grade
header check (`x-user-id` / `x-user-role`), not real token verification.

- **Coverage:** 6/6 routed endpoints (plus 1 unrouted `/health`) · 1/1 entity (`Expense`) · 1 cluster deep, 0 light, 0 skipped.
- **Confidence split:** OBSERVED 5 · STATIC 8 · INFERRED 5.
- **Human-only gaps (§10):** 6 — things only stakeholders can answer.
- **Open code gaps (§11):** 4 — code seen but not confidently resolved.
- **Review readiness verdict:** READY FOR REVIEW.

## 2. Review Focus & How to Disposition

The reviewer MUST disposition, before `APPROVE INVENTORY`:
- every **INFERRED** business rule in §6 (5 items),
- every open **GAP** in §11 (4 items),
- every **§10** stakeholder question (6 items).

Mark each: `Confirmed` · `Corrected: {note}` · `Rejected` · `Deferred: {reason}`. Items left
`Pending` in this set BLOCK approval. OBSERVED/STATIC items may be accepted in bulk.

## 3. Coverage & Method

- **Method:** directory-derived. Read `src/**`, `test/**`, `package.json` only. No graph available.
- **Endpoints:** `GET /health` (unauthenticated), `GET /api/expenses`, `GET /api/expenses/:id`,
  `POST /api/expenses`, `POST /api/expenses/:id/approve`, `POST /api/expenses/:id/reject`. All 6 covered.
- **Entities:** `Expense` (1/1) — shape defined in `src/store.js`.
- **Tests present:** `test/validators.test.js` only — exercises `validateExpense` in isolation.
  No test touches routes, auth, the approval service, or the store. So only validation rules reach
  the OBSERVED tier.
- **Source is not a standalone git repo** — baseline recorded as a timestamp per instructions.

## 4. Actor & Capability Map

| Actor (role header) | Capabilities |
|---|---|
| `employee` | Authenticate; list expenses; get expense; submit expense. (Blocked from approve/reject by route guard — STATIC.) |
| `manager` | All of employee, plus approve and reject pending expenses. |
| `admin` | Same as manager (approve/reject); no additional capability observed in code. |
| unauthenticated | Only `GET /health`. All `/api/*` routes reject with `401`. |

## 5. Feature Catalog

Cluster: **Expense Approval API** (single bounded context).

| ID | Feature | Layers (UI·API·svc·DB·job) | Behaviour / rules | Confidence | Provenance | GM-verifiable? | Priority | Review status |
|----|---------|----------------------------|-------------------|------------|-----------|----------------|----------|---------------|
| F-01 | Health check | API | `GET /health` → `200 {"status":"ok"}`. No auth. | STATIC | PROV:src/app.js#L10-L12 | yes | UNKNOWN (ask) | Pending |
| F-02 | Header authentication guard | API·svc | All `/api/*` require `x-user-id` and `x-user-role`; role must be in `['employee','manager','admin']`. | STATIC | PROV:src/auth.js#L11-L25 | yes | UNKNOWN (ask) | Pending |
| F-03 | List expenses | API·DB | `GET /api/expenses` → `200` array of all expenses. Any authenticated user. | STATIC | PROV:src/routes.js#L15-L17 | yes | UNKNOWN (ask) | Pending |
| F-04 | Get expense by id | API·DB | `GET /api/expenses/:id` → `200` expense, or `404 "expense not found"`. | STATIC | PROV:src/routes.js#L20-L26 | yes | UNKNOWN (ask) | Pending |
| F-05 | Submit expense (validation) | API·svc | `POST /api/expenses`; on validation failure `400 {error:<message>}`; on success `201` created record. | OBSERVED (validation only) / STATIC (routing) | PROV:src/routes.js#L29-L37 · PROV:src/validators.js#L10-L38 | yes | UNKNOWN (ask) | Pending |
| F-06 | Submit — initial status assignment | svc·DB | New expense status is `pending`, OR `approved` when auto-approve is enabled and amount ≤ ceiling. Config-dependent — see GAP-001. | INFERRED | PROV:src/approvalService.js#L28-L33 · PROV:src/approvalService.js#L81-L88 | yes | UNKNOWN (ask) | Pending |
| F-07 | Approve expense | API·svc·DB | `POST /api/expenses/:id/approve`, role `manager|admin`; sets status `approved`, `decidedBy`. Edge outcomes in §6. | STATIC (route/guard) / INFERRED (outcome logic) | PROV:src/routes.js#L40-L57 · PROV:src/approvalService.js#L36-L56 | yes | UNKNOWN (ask) | Pending |
| F-08 | Reject expense | API·svc·DB | `POST /api/expenses/:id/reject`, guard `requireRole('manager','admin')`; sets status `rejected`, `decidedBy`. Code contradicts inline comment — see GAP-002. | STATIC (route/guard) / INFERRED (outcome logic) | PROV:src/routes.js#L60-L77 · PROV:src/approvalService.js#L58-L78 | yes | UNKNOWN (ask) | Pending |
| F-09 | Self-approval prohibition | svc | An actor may not approve/reject their own claim (`actor.id === expense.employeeId`). | INFERRED | PROV:src/approvalService.js#L17-L23 | yes | UNKNOWN (ask) | Pending |
| F-10 | Already-decided guard | svc | Approve/reject only act on `status === 'pending'`; otherwise `409 "expense already decided"`. | INFERRED | PROV:src/approvalService.js#L42-L44 · PROV:src/approvalService.js#L64-L66 | yes | UNKNOWN (ask) | Pending |
| F-11 | Seed data on startup | DB | Store seeded with 2 expenses (`emp-1` 42/meals, `emp-2` 1200/travel), both `pending`, `createdAt` fixed to `2026-01-01T00:00:00.000Z`. Resets each process start. | STATIC | PROV:src/store.js#L9-L14 · PROV:src/store.js#L16-L29 | yes | UNKNOWN (ask) | Pending |

### Given / When / Then detail (INFERRED / edge / gap-adjacent)

**Behaviour F-05a — reject zero/negative amount** (OBSERVED · PROV:src/validators.js#L23-L25 · test PROV:test/validators.test.js#L12-L22)
  Given a create body with `amount <= 0`
  When `POST /api/expenses`
  Then `400 "amount must be > 0"` — no record created.

**Behaviour F-05b — reject over-ceiling amount** (OBSERVED · PROV:src/validators.js#L29-L31 · test PROV:test/validators.test.js#L24-L28)
  Given a create body with `amount > 10000`
  When `POST /api/expenses`
  Then `400 "amount must not exceed 10000"` — no record created. (Boundary: `10000` itself is allowed; `10001` rejected.)

**Behaviour F-05c — reject unknown category** (OBSERVED · PROV:src/validators.js#L33-L35 · test PROV:test/validators.test.js#L30-L34)
  Given `category` not in `['meals','travel','lodging','supplies']`
  When `POST /api/expenses`
  Then `400 "category is invalid"`.

**Behaviour F-05d — reject missing/blank employeeId** (STATIC · PROV:src/validators.js#L15-L17)
  Given `employeeId` absent, non-string, or whitespace-only
  When `POST /api/expenses`
  Then `400 "employeeId is required"`. (No test covers this.)

**Behaviour F-05e — reject non-numeric / NaN amount** (STATIC · PROV:src/validators.js#L19-L21)
  Given `amount` not a number or `NaN`
  When `POST /api/expenses`
  Then `400 "amount must be a number"`. (No test covers this.)

**Behaviour F-05f — reject missing body** (STATIC · PROV:src/validators.js#L11-L13)
  Given body is `null` or not an object
  When `POST /api/expenses`
  Then `400 "request body is required"`. (No test covers this.)

**Behaviour F-09 — self-approval blocked** (INFERRED · PROV:src/approvalService.js#L17-L23 · PROV:src/routes.js#L48-L49)
  Given a pending expense where `actor.id === expense.employeeId`
  When `POST /api/expenses/:id/approve` (or `/reject`) by that actor
  Then `403 "cannot approve your own expense"` — no state change. (Note: the reject route reuses the
  same verbatim message "cannot approve your own expense" — see PROV:src/routes.js#L70-L71.)

**Behaviour F-10 — already-decided** (INFERRED · PROV:src/approvalService.js#L42-L44 · PROV:src/routes.js#L46-L47)
  Given an expense whose status is not `pending`
  When approve or reject is called
  Then `409 "expense already decided"` — no state change. (Precedes the self-approval check in the
  service, so an already-decided own expense returns `409`, not `403`.)

**Behaviour F-07/F-08 — not found** (STATIC · PROV:src/routes.js#L44-L45 · PROV:src/approvalService.js#L37-L40)
  Given no expense with `:id`
  When approve or reject is called
  Then `404 "expense not found"`.

## 6. Business Rules & Calculations

| Rule | Statement (verbatim outcomes) | Confidence | Provenance |
|---|---|---|---|
| BR-1 | `employeeId` required, string, non-blank → else `400 "employeeId is required"`. | STATIC | PROV:src/validators.js#L15-L17 |
| BR-2 | `amount` must be a number and not `NaN` → else `400 "amount must be a number"`. | STATIC | PROV:src/validators.js#L19-L21 |
| BR-3 | `amount` must be `> 0` → else `400 "amount must be > 0"`. | OBSERVED | PROV:src/validators.js#L23-L25 · test PROV:test/validators.test.js#L12-L22 |
| BR-4 | `amount` must be `<= 10000` (strictly `> 10000` rejected) → else `400 "amount must not exceed 10000"`. | OBSERVED | PROV:src/validators.js#L29-L31 · test PROV:test/validators.test.js#L24-L28 |
| BR-5 | `category` must be in `['meals','travel','lodging','supplies']` → else `400 "category is invalid"`. | OBSERVED | PROV:src/validators.js#L33-L35 · test PROV:test/validators.test.js#L30-L34 |
| BR-6 | Body must be a non-null object → else `400 "request body is required"`. | STATIC | PROV:src/validators.js#L11-L13 |
| BR-7 | Approve/reject require role `manager` or `admin` (route guard) → else `403 "insufficient role"`; missing identity → `401`. | STATIC | PROV:src/routes.js#L40 · PROV:src/routes.js#L60 · PROV:src/auth.js#L28-L38 |
| BR-8 | Self-approval prohibited: `actor.id === expense.employeeId` → `403 "cannot approve your own expense"`. Applies to approve AND reject. | INFERRED | PROV:src/approvalService.js#L17-L23 |
| BR-9 | Only `pending` expenses may be decided; otherwise `409 "expense already decided"`. Checked BEFORE the self-approval check. | INFERRED | PROV:src/approvalService.js#L42-L44 · PROV:src/approvalService.js#L64-L66 |
| BR-10 | On successful decision, status becomes `approved`/`rejected` and `decidedBy` is set to `actor.id`. | INFERRED | PROV:src/approvalService.js#L51-L55 · PROV:src/approvalService.js#L73-L77 |
| BR-11 | Auto-approve at submit: if `config.autoApproveEnabled` AND `amount <= config.autoApproveCeiling` then new expense status is `approved`, else `pending`. Ceiling defaults to `50`. Config read from env at startup — effective behaviour not statically resolvable (see GAP-001). | INFERRED | PROV:src/approvalService.js#L28-L33 · PROV:src/config.js#L6-L13 |
| BR-12 | Auth: role must be one of `['employee','manager','admin']`; unknown role → `401 "unknown role"`; missing id or role → `401 "authentication required"`. | STATIC | PROV:src/auth.js#L8 · PROV:src/auth.js#L15-L22 |

## 7. Data & Entities

**Expense** (in-memory `Map`, keyed by stringified auto-increment id — PROV:src/store.js#L5-L29):
| Field | Type | Notes |
|---|---|---|
| `id` | string | Auto-increment (`String(nextId++)`), starts at `1`. |
| `employeeId` | string | **PII-adjacent** (identifies a person). Value masked in this doc. |
| `amount` | number | `0 < amount <= 10000` enforced at create. |
| `category` | string | One of `meals`/`travel`/`lodging`/`supplies`. |
| `description` | string | Optional; defaults to `''`. |
| `status` | string | `pending` \| `approved` \| `rejected`. |
| `createdAt` | string (ISO) | Hardcoded to `2026-01-01T00:00:00.000Z` at create — NOT current time (PROV:src/store.js#L25). |
| `decidedBy` | string | Set to deciding actor's id on approve/reject; absent until decided. |

- No persistence — store resets each process start (PROV:src/store.js#L3-L4).
- Relationships: none (single entity). `employeeId` / `decidedBy` are free strings, no referential store.

## 8. Integrations & External Contracts

- None. No database, queue, HTTP client, or third-party API. `express` is the only runtime dependency
  (PROV:package.json#L10-L12). Sole external input surface is the HTTP request headers/body.

## 9. Cross-cutting

- **Authentication:** header-based, no token verification — `x-user-id` + `x-user-role` (PROV:src/auth.js#L1-L25). Fixture-grade.
- **Authorization:** role guard middleware `requireRole(...roles)` → `403 "insufficient role"` (PROV:src/auth.js#L28-L38); plus the in-service self-approval rule (BR-8).
- **Error contract:** JSON `{ "error": <string> }` for failures; `{ "status": "ok" }` for health; entity/array JSON for success. Status codes: `200`/`201`/`400`/`401`/`403`/`404`/`409`, and a `500 "unexpected approval state"` fallback that appears unreachable (GAP-004).
- **Audit/logging:** none in request path. Only a startup `console.log` in `server.js` (PROV:src/server.js#L10-L11).
- **i18n:** none — messages are hardcoded English literals.

## 10. ⚠ Cannot Be Derived From Code — confirm with stakeholders

- Q1. **NFRs** — expected throughput, latency SLA, concurrency, availability? Nothing in code.
- Q2. **`amount <= 10000` ceiling** — is `10000` a real business/regulatory limit or an arbitrary guard? What currency is `amount` in? Not stated anywhere.
- Q3. **Auto-approve intent** — is `autoApproveEnabled` meant to be on in production, and is `50` the intended ceiling, or a placeholder default? (Ties to GAP-001.) Business rationale?
- Q4. **`admin` vs `manager`** — code treats them identically for approve/reject. Is `admin` supposed to have extra powers that were never implemented?
- Q5. **Priorities** — which of these behaviours are must-keep vs droppable in the migration? Code cannot say.
- Q6. **Intended vs bug** — several surprising behaviours (GAP-002 reject-role contradiction, GAP-003 shared "approve your own" message on reject, hardcoded `createdAt`): for each, is it intended behaviour to preserve or a bug to fix in the target?

## 11. Gaps Report

```
GAP-001 | PROV:src/approvalService.js#L28-L33 · PROV:src/config.js#L9-L12
        | type: static-unresolvable (config/feature-flag)
        | initialStatusFor() branches on config.autoApproveEnabled (env AUTO_APPROVE_ENABLED === 'true')
        |   and config.autoApproveCeiling (env AUTO_APPROVE_CEILING, default 50). Whether new small
        |   expenses are auto-approved vs left pending cannot be determined from source — it depends on
        |   the deployment environment. NOT asserting an auto-approve behaviour as fact.
        | resolve by: check runtime config / ask a developer / run the source (golden-master) under known env
        | disposition: Pending

GAP-002 | PROV:src/routes.js#L60 · PROV:src/routes.js#L62-L64
        | type: conflicting-paths
        | The /reject route applies requireRole('manager','admin') (line 60), but the inline comment
        |   (lines 62-64) states "rejection is allowed for any authenticated user, including plain
        |   employees — no role restriction is applied." Code and comment directly contradict. The
        |   effective, executed behaviour is the guard: employees are blocked with 403. Not silently
        |   choosing intent — flagging the contradiction for review.
        | resolve by: ask a developer (which is correct — the guard or the comment?)
        | disposition: Pending

GAP-003 | PROV:src/routes.js#L70-L71 · PROV:src/approvalService.js#L58-L78
        | type: ambiguous-intent
        | On the /reject path, a SELF_APPROVAL outcome returns 403 with the message
        |   "cannot approve your own expense" — the word "approve" on a reject action. Unclear whether
        |   the shared message is intended or a copy-paste defect. Behaviour (403 + that exact string)
        |   is asserted in F-09; the intent is the gap.
        | resolve by: ask a developer
        | disposition: Pending

GAP-004 | PROV:src/routes.js#L52-L56 · PROV:src/routes.js#L74-L76
        | type: unreachable-looking
        | The switch default returns 500 "unexpected approval state". approve()/reject() only ever
        |   return NOT_FOUND, ALREADY_DECIDED, SELF_APPROVAL, or OK (all handled), so the default
        |   appears unreachable — the source comment itself says "can never actually run." Not asserting
        |   a 500 behaviour as reachable; logging it so the migration does not treat it as live logic.
        | resolve by: ask a developer / run the source (golden-master) — confirm it is dead code
        | disposition: Pending
```

## 12. Confidence & Verification Summary

- **Counts:** OBSERVED 5 (BR-3, BR-4, BR-5 and the two negative-amount variants — all from `test/validators.test.js`) · STATIC 8 · INFERRED 5 (F-06/BR-11, F-09/BR-8, F-10/BR-9, BR-10, and approve/reject outcome logic).
- **INFERRED items still Pending:** BR-8, BR-9, BR-10, BR-11, and F-06 initial-status logic. All require human disposition.
- **Two verification moments:** Human review @ Stage 0.6 (this gate) dispositions the INFERRED rules,
  the 4 gaps, and the 6 §10 questions. Golden-master @ Stage 5.0 can verify externally observable
  outcomes (status codes / bodies for all endpoints). The auto-approve branch (BR-11) is only
  GM-verifiable if run under a known `AUTO_APPROVE_ENABLED` / `AUTO_APPROVE_CEILING` env — otherwise
  human-verify-only. GAP-004 (500 fallback) is expected to be unreproducible (dead code).
- **Source run status:** not yet confirmed runnable by this pass; if the source cannot start, no item
  is GM-promotable and the ceiling is human-review-only.

## 13. Review Log / Sign-off

_No dispositions recorded yet. `APPROVE INVENTORY ADO-0002` stamps this section once every Review
Focus item (5 INFERRED rules · 4 gaps · 6 stakeholder questions) is dispositioned._

## 14. Traceability Contract

Feature IDs `F-01…F-11` are the spine. Each flows forward to a Stage 1 architecture component, a
Stage 2 feasibility rating, an acceptance criterion / ADO task, and (where GM-verifiable) a
golden-master recording. The feature→migration-cluster link is established at Stage 3 when clusters
are derived; it is not assumed here. Downstream artifacts reference these IDs.
