# PR Spec Review — Output Format Reference

## Report Header

```
PR REVIEW REPORT
Spec:     <spec file or "pasted">       PR / Branch: <branch or PR number>
Reviewer: Claude                        Date: <today>
════════════════════════════════════════════════════════════
```

---

## Part 1 — Spec Compliance Check

One entry per requirement. Use the status icons exactly as shown.

```
PART 1 — SPEC COMPLIANCE CHECK
────────────────────────────────

REQ-001: <Requirement title from spec>
Status:  ✅ IMPLEMENTED
Finding: <What the code does that satisfies this requirement>
File(s): src/auth/login.ts:42-67

──────────────────────────────────────────────────────────

REQ-002: <Requirement title from spec>
Status:  ⚠️ PARTIAL
Finding: <What is implemented> / <What is still missing>
File(s): src/auth/login.ts:80, src/auth/session.ts:12

──────────────────────────────────────────────────────────

REQ-003: <Requirement title from spec>
Status:  ❌ MISSING
Finding: No code in the diff addresses this requirement.
File(s): —

──────────────────────────────────────────────────────────

REQ-004: <Requirement title from spec>
Status:  ❓ UNCLEAR
Finding: This requirement describes runtime behaviour (e.g. rate limiting)
         that cannot be verified from the diff alone. Developer confirmation
         needed.
File(s): —
```

### Status key

| Icon | Meaning |
|------|---------|
| ✅ IMPLEMENTED | Correctly and completely addressed in the PR |
| ⚠️ PARTIAL | Partially addressed — describe what is missing |
| ❌ MISSING | Not addressed at all |
| ❓ UNCLEAR | Spec is ambiguous OR cannot be verified from the diff |

---

## Part 2 — Code Review Against Spec

One FINDING block per divergence. Only raise findings where the code
**differs** from the spec — do not raise findings for correct code.

```
PART 2 — CODE REVIEW AGAINST SPEC
────────────────────────────────

FINDING-001
File:      src/auth/login.ts:95
Spec ref:  REQ-002 — Session timeout
Severity:  High
Issue:     Code sets session TTL to 3600s (1 hour). Spec §4.2 requires 30
           minutes (1800s) for unauthenticated sessions.
Suggested: Change `SESSION_TTL = 3600` to `SESSION_TTL = 1800` or make it
           configurable and default to 1800.

──────────────────────────────────────────────────────────

FINDING-002
File:      src/api/users.ts:210
Spec ref:  REQ-007 — Error responses
Severity:  Medium
Issue:     Returns HTTP 500 on duplicate email. Spec §6.1 requires HTTP 409
           Conflict with body `{ "error": "email_already_exists" }`.
Suggested: Catch the unique-constraint error and return 409 with the
           specified body.

──────────────────────────────────────────────────────────

[No findings — all changed code matches the spec.]   ← only if genuinely true
```

### Severity guide

| Severity | When to use |
|----------|-------------|
| Critical | Auth bypass, data loss, security vulnerability, core workflow broken |
| High     | Feature behaves differently than spec; likely to cause defects in prod |
| Medium   | Edge case or secondary behaviour differs from spec |
| Low      | Cosmetic, naming, minor deviation that does not affect correctness |

---

## Part 3 — Traceability Matrix

```
PART 3 — TRACEABILITY MATRIX
────────────────────────────────

| Spec Req    | Requirement Title              | PR File(s) + Lines          | Status        | Risk   |
|-------------|--------------------------------|-----------------------------|---------------|--------|
| REQ-001     | User authentication flow       | src/auth/login.ts:42-67     | ✅ Implemented | Low    |
| REQ-002     | Session timeout (30 min)       | src/auth/session.ts:12      | ⚠️ Partial     | High   |
| REQ-003     | Password reset email           | —                           | ❌ Missing     | High   |
| REQ-004     | Rate limiting on login         | —                           | ❓ Unclear     | Med    |
| REQ-005     | Audit log on failed login      | src/auth/audit.ts:88-102    | ✅ Implemented | Low    |
```

---

## Part 4 — Gaps & Risks Report

```
PART 4 — GAPS & RISKS REPORT
────────────────────────────────

GAP-001: Spec §4.2 — Session timeout value is stated as "30 minutes" in one
         place and "configurable, default 30 minutes" in another. The PR
         hardcodes 3600s. Developer must clarify the intended behaviour and
         update spec to remove ambiguity.

GAP-002: Spec §7 — No spec section covers token refresh. The PR adds a
         /refresh endpoint with undocumented behaviour. Either document it
         in the spec or remove it from this PR.

RISK-001: src/auth/login.ts:130 — Password comparison uses string equality
          rather than a constant-time function. This is not prohibited by the
          spec but introduces a timing side-channel risk. Recommend
          `crypto.timingSafeEqual`.

RISK-002: src/api/users.ts:44 — User-supplied sort field is interpolated
          directly into a SQL ORDER BY clause. Spec does not mention
          injection protection here, but this is a clear SQL injection vector.

[No gaps or risks found.]   ← only if genuinely true
```

---

## Merge Verdict

Always end the report with one of these three verdicts:

```
════════════════════════════════════════════════════════════
MERGE VERDICT

✅ READY TO MERGE
No Critical or High findings. All requirements either implemented or
explicitly out of scope for this PR.

────────────────────────────────────────────────────────────

⚠️ MERGE WITH CAUTION
No Critical findings, but the following High/Medium issues should be
tracked:
  - FINDING-002: HTTP 409 response not spec-compliant (Medium)
  - REQ-003: Password reset not implemented (out of scope — confirm)

────────────────────────────────────────────────────────────

❌ BLOCK MERGE
The following Critical/High findings must be resolved before merging:
  - FINDING-001: Session TTL 3600s vs spec-required 1800s (High)
  - REQ-003: Password reset entirely missing (High)
════════════════════════════════════════════════════════════
```
