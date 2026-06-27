# ICEA Review Checks
# Used by icea-review skill — run all 7 checks in order

---

## Check 1 — AC Compliance

For every AC in the ICEA:
1. Find the code in the diff that implements it
2. If found → ✅ with file reference
3. If partially found → ⚠️ with what is missing
4. If not found → ❌ with what needs to be added

Output format:
```
CHECK 1 — ACCEPTANCE CRITERIA COMPLIANCE
─────────────────────────────────────────
AC-F1: [AC text]
  ✅ Implemented — UsersController.cs:42, UserFilterService.cs:87

AC-F2: [AC text]
  ✅ Implemented — UserFilterComponent.ts:115

AC-F3: [AC text]
  ❌ MISSING — No code found implementing this criterion
     Expected: [what should exist]

AC-NF1: [AC text]
  ⚠️ PARTIAL — Performance target not validated by any test
     Found: implementation in UserFilterService.cs:34
     Missing: load test or benchmark asserting p95 < 300ms
```

---

## Check 2 — Scenario Coverage

For every Example scenario in the ICEA:
1. Find the corresponding test method in the diff
2. Check it actually tests the Given/When/Then described
3. Flag if scenario has no test

Output format:
```
CHECK 2 — ICEA SCENARIO COVERAGE
─────────────────────────────────
Scenario 1 — Happy Path
  ✅ UserFilterServiceTests.cs — Filter_WhenValidQuery_ReturnsMatchingUsers

Scenario 2 — Edge Case: Large Dataset
  ✅ UserFilterServiceTests.cs — Filter_WhenDatasetExceeds1000_UsesServerSideFilter

Scenario 3 — Edge Case: No Results
  ❌ MISSING — No test covers the empty result state
     Expected: test asserting empty state message is shown

Scenario 4 — Error State
  ✅ UserFilterComponent.spec.ts — should show error message when API fails

Scenario 5 — Permission Boundary
  ⚠️ PARTIAL — Test exists but only checks 401, not 403
     UserFilterControllerTests.cs:67
     Missing: test for authenticated user with Viewer role (403)
```

---

## Check 3 — Scope Creep

Scan every changed file and method. For each:
1. Find the ICEA AC or Example it implements
2. If no AC or Example covers it → flag as scope creep

Output format:
```
CHECK 3 — SCOPE CREEP
──────────────────────
✅ No scope creep detected — all changes map to ICEA ACs

OR

❌ SCOPE CREEP DETECTED
UserPreferencesService.cs (new file)
  → Implements filter preset saving — not in any AC or Example
  → ICEA Out of Scope explicitly defers this to v2
  Action: remove this file or add an AC to the ICEA

ExportToCsvButton.component.ts (new file)
  → Export functionality — not in ICEA at all
  Action: remove or raise a new ADO story
```

---

## Check 4 — .NET Convention Compliance

Scan all .cs files in the diff:

```
CHECK 4 — .NET CONVENTIONS
───────────────────────────
Architecture
  ✅ Controller is thin — no business logic in controller actions
  ✅ Service layer owns all business logic
  ✅ Repository layer owns all EF Core queries

Error Handling
  ✅ ProblemDetails returned on all error paths
  ⚠️ UsersController.cs:89 — raw string returned on 404, not ProblemDetails

Auth
  ✅ [Authorize(Policy = "...")] applied at controller class level
  ✅ User ID resolved from ICurrentUserService, not from request body

Logging
  ❌ UserFilterService.cs:45 — string interpolation in ILogger call
     Fix: use structured logging: _logger.LogInformation("User {UserId}", userId)

Testing
  ✅ Test method names follow MethodName_WhenCondition_ThenExpectedBehavior
  ✅ All dependencies mocked with Moq
```

---

## Check 5 — Angular Convention Compliance

Scan all .ts and .html files in the diff:

```
CHECK 5 — ANGULAR CONVENTIONS
───────────────────────────────
Components
  ✅ UserFilterComponent — standalone: true
  ✅ UserFilterComponent — OnPush change detection
  ❌ OrderListComponent — changeDetection not set (defaults to Default)
     Fix: add changeDetection: ChangeDetectionStrategy.OnPush

Async / Observables
  ✅ user-filter.component.html — async pipe used throughout
  ⚠️ user-filter.component.ts:67 — manual subscribe() found
     Fix: move to async pipe or use takeUntilDestroyed

Forms
  ✅ Reactive forms used — no template-driven forms

States
  ✅ Loading, error, and empty states all handled in template
  ❌ order-list.component.html — no empty state shown when results = []
     Fix: add *ngIf="(orders$ | async)?.length === 0" empty state block

Types
  ✅ No `any` types found in new code
```

---

## Check 6 — Node.js Convention Compliance

Scan all Node.js .ts files in the diff (skip if no Node.js context in ICEA):

```
CHECK 6 — NODE.JS CONVENTIONS
───────────────────────────────
Error Handling
  ✅ All async route handlers wrapped in try/catch
  ⚠️ notificationService.ts:34 — error rethrown without AppError wrapper
     Fix: throw new AppError('NOTIFICATION_FAILED', 'Could not send', 500)

Validation
  ✅ Zod schema applied at route level before business logic
  ✅ 400 returned with field-level errors on validation failure

Logging
  ✅ Winston structured logger used
  ❌ userEventService.ts:56 — email address logged directly
     Fix: mask PII before logging: userId not email

Testing
  ✅ All external HTTP calls mocked in Jest tests
  ✅ Tests cover all 5 ICEA scenarios
```

---

## Check 7 — Security and Business Context

Before running this check, read `../shared/business-context-severity.md` to understand
the domain-specific severity override triggers (B1–B7). Apply them to every finding
in this check — and retroactively to any finding in Checks 1–6 if business context
warrants escalation.

```
CHECK 7 — SECURITY AND BUSINESS CONTEXT
─────────────────────────────────────────
Secrets
  ✅ No hardcoded connection strings, API keys, or tokens found

PII in Logs
  ✅ No email, name, or phone logged in .NET code
  ❌ See Check 6 — email logged in notificationService.ts

Error Exposure
  ✅ No stack traces returned to client
  ✅ No internal paths or DB error messages in response bodies

Auth
  ✅ All new .NET endpoints have [Authorize] attribute
  ✅ No client-supplied user IDs trusted without validation

Business Context Severity Review
  For every ⚠️ or ❌ finding across all 7 checks, ask:
  Does this finding touch attorney-client data, immigration identifiers,
  active case timelines, vulnerable client data, breach notification obligations,
  physical safety data, or PII in a static directory?
  If yes → escalate to ❌ Critical regardless of original severity.
  State the override trigger (B1–B7) from business-context-severity.md.

  [List any findings escalated by business context, with override reason]
  [If none: ✅ No business context escalations required]
```
