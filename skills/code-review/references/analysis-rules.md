# Code Review Skill — Analysis Rules
_Load in Step 0e before beginning analysis._

---

## 4. Analysis Rules

- **Inter-procedural**: follow data and null values across method calls — do not stop at function boundaries
- **Path-sensitive**: only report when the defect is reachable on at least one execution path
- **No false positives without caveat**: if uncertain whether a path is reachable, mark as `[Needs Verification]`
- **Minimum event depth**: show at least 2 events per finding (source and defect); 3+ for data flow
- **Severity calibration**:
  - Critical: RCE, auth bypass, data corruption, definite crash
  - High: exploitable injection, definite null dereference in hot path, resource exhaustion
  - Medium: conditional null dereference, resource leak in non-critical path, swallowed exception
  - Low: code quality issues, unreachable code, redundant checks, missing decision comments (`MISSING_DECISION_COMMENT`)

- **Business context override (mandatory — applies to every finding)**:
  After assigning technical severity, apply the business override check from
  `../shared/business-context-severity.md`. If the finding touches attorney-client
  data, immigration identifiers, active case timelines, vulnerable client data,
  breach notification obligations, physical safety data, or PII in a static directory
  → escalate to Critical regardless of technical score. Report both scores and state
  the override trigger (B1–B7). This check is not optional.

---
