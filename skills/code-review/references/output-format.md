# Code Review Skill — Output Format
_Load in Step 0e before beginning analysis._

---

## 3. Output Format

### 3a. Single Finding Block
```
CID <id> | <CHECKER_NAME> | <Impact: Critical/High/Medium/Low>
File: <path>
Function: <class.method()>
Impact: <one sentence — what can go wrong>

Event Path:
  Event 1 [<role>]  <file>:<line>  — <what happens here>
  Event 2 [<role>]  <file>:<line>  — <what happens here>
  Event 3 [<role>]  <file>:<line>  — <what happens here / the defect>

Vulnerable Code:
  <the actual problematic code snippet, with file:line>

Fix:
  <corrected code snippet — complete enough to copy-paste, with a one-line
   explanation of what changed and why>

References: <CWE / OWASP / MSRC link if applicable>
```

**Every finding MUST include both a "Vulnerable Code" snippet showing the current
problematic code, and a "Fix" snippet showing the corrected code.** Never give a
fix as prose only — always provide the actual corrected code the developer can paste in.

Roles: `Source` | `Transfer` | `Sink` | `Check` | `Null` | `Alloc` | `Free` | `Lock` | `Unlock` | `Defect`

### 3b. Summary Table (end of report)
```
## Defect Summary

| CID  | Checker          | Impact   | File              | Function         | Status |
|------|------------------|----------|-------------------|------------------|--------|
| 1001 | TAINTED_SQL      | High     | UserRepo.cs:87    | Find()           | New    |
| 1002 | NULL_RETURNS     | Medium   | OrderSvc.cs:43    | GetById()        | New    |
| ...  |                  |          |                   |                  |        |

Total: N findings — N Critical, N High, N Medium, N Low
Defect density: N per 1,000 lines (estimated)
```

---
