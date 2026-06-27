# Security Skill — Cross-Cutting Principles
_Load alongside output-formats.md during any analysis pass._

---

## 4. Cross-Cutting Principles

- **Risk-first**: Lead every report with the highest-severity issues. Never bury critical findings.
- **Plain titles**: Every finding title must be plain English a developer immediately understands. No taxonomy jargon in titles. CWE/OWASP IDs go in metadata fields, not the title. Ask: could a non-security developer read this title and instantly know what's wrong? If not, rewrite it.
- **Specific descriptions**: Every description must reference the actual file, variable, or function by name — not a generic category description. Explain what the code is *doing*, why that is *dangerous*, and who is *affected*. Remediation must name the exact file and function to change with corrected code. Generic OWASP advice with no code-specific detail is not acceptable.
- **Actionable**: Every finding must have a concrete remediation, not just "improve security."
- **Evidence-based**: Cite CWE, CVE, CVSS vectors, and framework control IDs. Don't assert without basis.
- **No false positives without caveat**: If you're uncertain whether a finding is exploitable,
  say so explicitly and mark it "Needs Verification."
- **Responsible disclosure framing**: Never produce ready-to-use exploit code. Provide enough
  detail for a defender to understand and fix the issue.
- **Secrets handling**: If the user pastes real credentials, API keys, or PII, immediately flag
  this, advise rotation, and do not echo them back in your response.

---
