# ANSWER KEY — expense-approval-service

Ground-truth enumeration of everything this app actually does. Line numbers were
verified against the source files after they were written. All status codes and
message strings below are verbatim from the code.

The app is a small Express REST API for submitting and deciding expense claims,
backed by an in-memory store seeded with two expenses (ids `"1"` and `"2"`).
Auth is header-based (`x-user-id`, `x-user-role`); there is no real token check.

Base paths: `GET /health`, and everything under `/api` (mounted in `src/app.js:15`).

---

## Behaviors

| id | behavior (plain English) | file | line(s) | exact outcome (verbatim status + message/threshold) | evidence | path |
|----|--------------------------|------|---------|------------------------------------------------------|----------|------|
| B1 | Health check returns ok | src/app.js | 10-12 | `200` `{"status":"ok"}` | structural | happy |
| B2 | All `/api/*` routes require authentication; missing `x-user-id` or `x-user-role` header is rejected | src/auth.js | 15-17 | `401` `{"error":"authentication required"}` | logic-only | error/edge |
| B3 | A role not in `['employee','manager','admin']` is rejected at authentication | src/auth.js | 8, 19-21 | `401` `{"error":"unknown role"}` | logic-only | error/edge |
| B4 | `requireRole` guard rejects an authenticated caller whose role is not in the allowed set | src/auth.js | 33-35 | `403` `{"error":"insufficient role"}` | logic-only | error/edge |
| B5 | List all expenses — any authenticated user may read | src/routes.js | 15-17 | `200` JSON array of expense objects | structural | happy |
| B6 | Get a single expense by id (existing) | src/routes.js | 20-26 | `200` the expense object | structural | happy |
| B7 | Get a single expense by id (not found) | src/routes.js | 22-24 | `404` `{"error":"expense not found"}` | logic-only | error/edge |
| B8 | Create expense — validation applied in routes.js but defined in validators.js (spans two files) | src/routes.js (applied) 30-33; src/validators.js (defined) 10-38 | routes 30-33 / validators 10-38 | on failure `400` `{"error":<message>}` | logic-only | error/edge |
| B9 | Create — missing/blank `employeeId` rejected | src/validators.js | 15-17 | `400` `{"error":"employeeId is required"}` | logic-only | error/edge |
| B10 | Create — non-numeric / NaN `amount` rejected | src/validators.js | 19-21 | `400` `{"error":"amount must be a number"}` | logic-only | error/edge |
| B11 | Create — `amount <= 0` rejected (threshold: amount must be > 0) | src/validators.js | 23-25 | `400` `{"error":"amount must be > 0"}` | has-test | error/edge |
| B12 | Create — `amount > 10000` rejected (single-transaction ceiling threshold 10000) | src/validators.js | 29-31 | `400` `{"error":"amount must not exceed 10000"}` | has-test | error/edge |
| B13 | Create — category not in `['meals','travel','lodging','supplies']` rejected | src/validators.js | 4, 33-35 | `400` `{"error":"category is invalid"}` | has-test | error/edge |
| B14 | Create — valid expense is persisted and returned | src/routes.js | 35-36 | `201` the created expense (status `pending` unless auto-approved, see B18) | logic-only | happy |
| B15 | Approve endpoint requires `manager` or `admin` role | src/routes.js | 40 | `403` `{"error":"insufficient role"}` for other roles (via requireRole) | structural | error/edge |
| B16 | Approve — self-approval forbidden: an approver cannot decide their own claim (rule buried 2 levels deep: route -> approve() -> canDecide()) | src/approvalService.js | 17-23, 46-49 (helper); surfaced at src/routes.js 48-49 | `403` `{"error":"cannot approve your own expense"}` | logic-only | error/edge |
| B17 | Approve — expense not found | src/routes.js | 44-45 (from approvalService.js 37-40) | `404` `{"error":"expense not found"}` | logic-only | error/edge |
| B18 | Approve — expense already decided (status not `pending`) | src/routes.js | 46-47 (from approvalService.js 42-44) | `409` `{"error":"expense already decided"}` | logic-only | error/edge |
| B19 | Approve — happy path: pending expense approved by a different manager/admin; sets status `approved` and `decidedBy` | src/routes.js | 50-51 (from approvalService.js 51-55) | `200` the updated expense with `"status":"approved"` and `"decidedBy":<actor id>` | logic-only | happy |
| B20 | Reject endpoint requires `manager` or `admin` role (see also TRAP T2 — comment says otherwise) | src/routes.js | 60 | `403` `{"error":"insufficient role"}` for other roles (via requireRole) | structural | error/edge |
| B21 | Reject — self-decision forbidden (same canDecide helper) | src/approvalService.js | 17-23, 68-71; surfaced at src/routes.js 70-71 | `403` `{"error":"cannot approve your own expense"}` | logic-only | error/edge |
| B22 | Reject — not found | src/routes.js | 66-67 (from approvalService.js 59-62) | `404` `{"error":"expense not found"}` | logic-only | error/edge |
| B23 | Reject — already decided | src/routes.js | 68-69 (from approvalService.js 64-66) | `409` `{"error":"expense already decided"}` | logic-only | error/edge |
| B24 | Reject — happy path: pending expense rejected; sets status `rejected` and `decidedBy` | src/routes.js | 72-73 (from approvalService.js 73-77) | `200` the updated expense with `"status":"rejected"` and `"decidedBy":<actor id>` | logic-only | happy |
| B25 | Auto-approve on submit: a new expense at or below the ceiling MAY be created as `approved` instead of `pending` — depends on `config.autoApproveEnabled` (from `AUTO_APPROVE_ENABLED` env) and `config.autoApproveCeiling` (default 50). Cannot be determined from code alone. | src/approvalService.js | 28-33, 81-87; src/config.js | 10-15 | If enabled AND amount <= ceiling: created expense returns `"status":"approved"`; otherwise `"status":"pending"`. `201` either way. | ambiguous | happy |

Notes:
- B15 and B20 outcomes (the `403 insufficient role`) are produced by the shared
  `requireRole` middleware (B4). They are listed separately because the route
  declarations at routes.js:40 and routes.js:60 are what bind that guard to those
  endpoints — that binding is structurally evident from the route table.
- B16/B21 both flow through the same `canDecide` helper (approvalService.js:17-23),
  so both emit the identical `cannot approve your own expense` message even on the
  reject endpoint. That shared message is intentional and truthful to the code.

---

## TRAPS — never report these as real behavior

| trap | file | line(s) | why it is a trap |
|------|------|---------|------------------|
| T1 (dead code) | src/routes.js | 52-56 and 74-76 | The `default:` switch branches returning `500 {"error":"unexpected approval state"}`. `approve()`/`reject()` (approvalService.js) only ever return one of `NOT_FOUND`, `ALREADY_DECIDED`, `SELF_APPROVAL`, or `OK` — all four are handled by explicit `case`s above the default. The `default` is unreachable; the `500` response can never actually be produced. Do not report a 500 as observable behavior. |
| T2 (misleading comment) | src/routes.js | 63-64 | The comment claims: "rejection is allowed for any authenticated user, including plain employees — no role restriction is applied to this endpoint." This is FALSE. Line 60 applies `requireRole('manager', 'admin')` to the reject route, so plain employees receive `403 insufficient role` (B20). The code contradicts the comment; trust the code. |

Additional non-behaviors (do not report as app logic):
- The auto-approve ceiling default of 50 in `src/config.js:12` is only a fallback for
  when the env var is absent; it does not by itself tell you production behavior (that
  is the ambiguity captured in B25).

---

## Summary count

- Total behaviors: **25** (B1–B25)
- `has-test`: **3** — B11, B12, B13 (covered by `test/validators.test.js`)
- `structural`: **5** — B1, B5, B6, B15, B20
- `logic-only`: **16** — B2, B3, B4, B7, B8, B9, B10, B14, B16, B17, B18, B19, B21, B22, B23, B24
- `ambiguous`: **1** — B25
- Check: 3 + 5 + 16 + 1 = **25** ✓

Traps: **2** (T1 dead code, T2 misleading comment).

---

## Running the fixture

- `npm install` — installs express.
- `npm start` — starts the server on `PORT` (default 3000).
- `npm test` — runs `node --test`; 5 tests in `test/validators.test.js`, all pass.
