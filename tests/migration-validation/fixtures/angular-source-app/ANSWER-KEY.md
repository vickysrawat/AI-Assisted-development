# ANSWER KEY — Angular Leave-Request App (test fixture)

Ground-truth description of what this app does. Angular 17+, standalone components, signals.
Domain: employee **leave-request** submission + a role-gated approvals screen. All paths are
relative to the fixture root (`tests/migration-validation/fixtures/angular-source-app/`).

## App summary

An employee fills in a reactive leave-request form (type, start date, number of days, reason)
and submits it to an HTTP API. A "My Requests" screen lists the employee's requests. An
"Approvals" route is protected by a `canActivate` guard that only lets managers/admins in and
redirects everyone else. A deploy-time feature flag can auto-approve single-day requests.

## Files created (12 source files)

| # | path |
|---|---|
| 1 | `src/environments/environment.ts` |
| 2 | `src/app/leave/leave.model.ts` |
| 3 | `src/app/leave/auth.service.ts` |
| 4 | `src/app/leave/permission.service.ts` |
| 5 | `src/app/leave/approver.guard.ts` |
| 6 | `src/app/leave/leave-api.service.ts` |
| 7 | `src/app/leave/leave-duration.validator.ts` |
| 8 | `src/app/leave/leave-request-form.component.ts` |
| 9 | `src/app/leave/my-requests.component.ts` |
| 10 | `src/app/leave/approvals.component.ts` |
| 11 | `src/app/app.routes.ts` |
| 12 | `src/app/app.config.ts` |
| — | `src/app/leave/permission.service.spec.ts` (unit test) |

## Behavior table

| id | behavior (plain English) | file | line(s) | exact observable outcome (verbatim) | evidence | path |
|----|--------------------------|------|---------|--------------------------------------|----------|------|
| B1 | `days` control is required | `src/app/leave/leave-request-form.component.ts` | 64-65 | control status INVALID with error `{ required: true }`; template shows `Number of days is required.` (line 26) | structural | happy |
| B2 | `days` must be at least 1 (`Validators.min(1)`) | `src/app/leave/leave-request-form.component.ts` | 64,66 | control status INVALID with error `{ min: { min: 1, actual: <value> } }`; template shows `You must request at least one day.` (line 29) | structural | error/edge |
| B3 | `days` may not exceed the configured max (custom validator) | `src/app/leave/leave-duration.validator.ts` | 15-16 | validator returns `{ overLimit: { max: 20, actual: <value> } }`; template shows message `Requested days exceed the maximum allowed per request.` | logic-only | error/edge |
| B4 | `reason` control is required | `src/app/leave/leave-request-form.component.ts` | 69 | control status INVALID with error `{ required: true }`; template shows `A reason is required.` (line 37) | structural | happy |
| B5 | `startDate` control is required | `src/app/leave/leave-request-form.component.ts` | 63 | control status INVALID with error `{ required: true }` | structural | happy |
| B6 | `type` control is required | `src/app/leave/leave-request-form.component.ts` | 62 | control status INVALID with error `{ required: true }` (defaults to `'annual'`, so valid unless cleared) | structural | happy |
| B7 | Submit button disabled while form invalid | `src/app/leave/leave-request-form.component.ts` | 40 | `<button>` rendered with `disabled` attribute; click cannot fire `ngSubmit` | structural | error/edge |
| B8 | onSubmit aborts if form invalid | `src/app/leave/leave-request-form.component.ts` | 73-76 | all controls marked touched (`markAllAsTouched`) and method returns; no HTTP POST | logic-only | error/edge |
| B9 | Custom validator ignores non-numeric input | `src/app/leave/leave-duration.validator.ts` | 12-14 | returns `null` (no `overLimit` error) when `Number(value)` is `NaN` | logic-only | error/edge |
| B10 | Approvals route protected by `canActivate` guard | `src/app/app.routes.ts` | 11-15 | route `approvals` has `canActivate: [approverGuard]` | structural | happy |
| B11 | Guard allows managers/admins | `src/app/leave/approver.guard.ts` | 15-16 | guard returns `true`; navigation to `/approvals` proceeds | logic-only | happy |
| B12 | Guard redirects non-approvers | `src/app/leave/approver.guard.ts` | 20 | guard returns `UrlTree` for `/my-requests`; navigation cancelled and redirected to `/my-requests` | logic-only | error/edge |
| B13 | Permission check denies employee role | `src/app/leave/permission.service.ts` | 21 | `canApproveLeave()` returns `false` (employee not in `['manager','admin']`) | has-test | error/edge |
| B14 | Permission check allows manager role | `src/app/leave/permission.service.ts` | 21 | `canApproveLeave()` returns `true` | has-test | happy |
| B15 | Permission check denies when no user signed in | `src/app/leave/permission.service.ts` | 18-19 | `canApproveLeave()` returns `false` (null user short-circuit) | has-test | error/edge |
| B16 | listMine happy path maps to ListResult | `src/app/leave/leave-api.service.ts` | 24-25 | emits `{ requests: <array>, error: null }`; list renders `<li>` per request | logic-only | happy |
| B17 | listMine 404 treated as empty, not error | `src/app/leave/leave-api.service.ts` | 27-29 | emits `{ requests: [], error: null }`; UI shows empty state `You have no leave requests yet.` (my-requests line 16) | logic-only | error/edge |
| B18 | listMine other errors show banner | `src/app/leave/leave-api.service.ts` | 31 | emits `{ requests: [], error: 'Could not load your leave requests.' }`; error banner rendered (my-requests line 14) | logic-only | error/edge |
| B19 | submit conflict (409) message | `src/app/leave/leave-api.service.ts` | 43-44 | throws `Error('You already have a request for those dates.')`; component sets `submitError` banner | logic-only | error/edge |
| B20 | submit generic error message | `src/app/leave/leave-api.service.ts` | 45-46 | throws `Error('Could not submit your leave request. Please try again.')`; error banner shows the message | logic-only | error/edge |
| B21 | Successful submit navigates to My Requests | `src/app/leave/leave-request-form.component.ts` | 90 | `router.navigateByUrl('/my-requests')` on next callback; navigation to `/my-requests` | logic-only | happy |
| B22 | Submit error sets banner in component | `src/app/leave/leave-request-form.component.ts` | 91 | `submitError` signal set to error message; error banner shown (template line 44) | logic-only | error/edge |
| B23 | My-requests loading state before response | `src/app/leave/my-requests.component.ts` | 11-12,32 | `loading` signal starts `true`; template shows `Loading…` | structural | happy |
| B24 | Auto-approve single-day leave (feature-flag gated) | `src/app/leave/leave-request-form.component.ts` | 84-86 | IF `environment.autoApproveShortLeave` is true AND `days <= 1`, `autoApproved` set true and banner `Your short leave was approved automatically.` shows (line 47). Checked-in flag is `false`, but CI overwrites it at deploy time — production behaviour NOT determinable from source. | ambiguous | error/edge |

## TRAPS

### Dead / unreachable code
- **`revalidate()` method** — `src/app/leave/leave-request-form.component.ts` lines 98-107.
  Private method with **no caller** anywhere in the codebase. Within it, the block at lines
  103-106 (setting `submitError` to `'Please fix the highlighted fields.'` and returning
  `false`) is a dead branch: submission is already gated by control validators + the disabled
  button (B7) + the `form.invalid` guard in `onSubmit` (B8), and the method itself is never
  invoked. This error message string appears nowhere in the actual runtime UI.

### Misleading / contradicting comments
- **approver.guard.ts** — `src/app/leave/approver.guard.ts` line 9 comment states
  *"unknown users go to /login"*, but the code (line 20) redirects **all** non-approvers,
  including unknown/unauthenticated users, to **`/my-requests`** — there is no `/login`
  redirect anywhere. The comment contradicts the code.
- **leave-api.service.ts** — `src/app/leave/leave-api.service.ts` line 22 doc comment claims
  listMine "Maps 404 to an empty list, **other errors to a banner**." This is accurate for
  `listMine`. (Listed here only to confirm it is NOT a trap — it matches the code.)

> Primary misleading comment for grading: **approver.guard.ts line 9** ("/login") vs code
> redirect to `/my-requests` (line 20).

## Summary count

- **Total behaviors:** 24 (B1-B24)

### By evidence
- **has-test (3):** B13, B14, B15 — covered by `permission.service.spec.ts`
- **structural (8):** B1, B2, B4, B5, B6, B7, B10, B23
- **logic-only (12):** B3, B8, B9, B11, B12, B16, B17, B18, B19, B20, B21, B22
- **ambiguous (1):** B24
- Total: 3 + 8 + 12 + 1 = 24 ✓

### By path
- **happy (10):** B1, B4, B5, B6, B10, B11, B14, B16, B21, B23
- **error/edge (14):** B2, B3, B7, B8, B9, B12, B13, B15, B17, B18, B19, B20, B22, B24
- Total: 10 + 14 = 24 ✓
