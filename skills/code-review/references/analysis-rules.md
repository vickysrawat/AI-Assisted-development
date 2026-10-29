# Code Review Skill — Analysis Rules
_Load in Step 0e before beginning analysis._

---

## 4. Analysis Rules

- **Inter-procedural**: follow data and null values across method calls — do not stop at function boundaries
- **Path-sensitive**: only report when the defect is reachable on at least one execution path
- **No false positives without caveat**: if uncertain whether a path is reachable, the finding is
  **needs-confirmation**, not Open — give it a `needs_confirmation` question the developer can answer
  (e.g. "Can `C Agreed Rate` be NULL in production data?"). A `[Needs Verification]` tag alone is not
  enough: it used to land as Open and block `/checkin` on a guess.
- **Intent test (before reporting any logic/business-rule finding)**: ask "is this a defect under
  every reasonable reading of what the code is meant to do?" If the defect exists only under an
  assumed business rule — a deliberate rounding, a role split, whether multi-year ranges are allowed,
  what an action label "should" mean — it is NOT a defect yet. Record it as needs-confirmation with
  the question. First look for evidence of intent: a test asserting the behaviour, a comment or
  DECISION block, an ICEA acceptance criterion, a docstring. Evidence that the behaviour is intended
  → do not report it. Evidence that it is unintended (e.g. the UI sends `null` to clear a field the
  backend ignores) → report it as a normal finding, citing that evidence in the event path.
- **Minimum event depth**: show at least 2 events per finding (source and defect); 3+ for data flow
- **Severity calibration**:
  - Critical: RCE, auth bypass, data corruption, definite crash
  - High: exploitable injection, definite null dereference in hot path, resource exhaustion
  - Medium: conditional null dereference, resource leak in non-critical path, swallowed exception
  - Low: code quality issues, unreachable code, redundant checks, missing decision comments (`MISSING_DECISION_COMMENT`)

- **Business context override (mandatory — applies to every finding)**:
  After assigning technical severity, apply the business override check using the resolved
  B-series triggers — `.claude/business-context.md` if it exists, otherwise
  `$PLUGIN_DIR/skills/shared/business-context-severity.md`. If the finding touches any resolved
  B-series trigger (e.g. regulated/confidential data, regulated individual identifiers,
  irreversible time-sensitive harm, breach-notification obligations, safety-endangering data,
  or PII in a static directory) → escalate to Critical regardless of technical score. Report
  both scores and state the override trigger. This check is not optional.

---
