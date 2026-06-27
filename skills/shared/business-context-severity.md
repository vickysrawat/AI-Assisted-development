# Business Context Severity Spec
_Spec version: 1.0 · Created: 2026-06-01_
_Applies to: all review skills (security, code-review, icea-review, checkin, pr-spec-review)_

---

## The principle

**CVSS and technical severity scales are floors, not ceilings.**

A finding's reported severity is the higher of:
1. Its technical severity (CVSS score, code-review impact rating, ICEA compliance level)
2. Its business severity — determined by applying the domain context rules below

Technical severity can never override business severity upward. Business context can
only raise severity — never lower it.

---

## Domain context for this project

This system handles:

- **Attorney-client privileged matter data** — legal communications and case details protected
  by professional conduct rules
- **Immigration case records** — A-Numbers (Alien Registration Numbers), visa status, hearing
  dates, filing deadlines, case outcomes
- **Vulnerable individuals** — pro bono clients who are often in active proceedings, may face
  deportation, detention, or other life-altering consequences, and have limited recourse if
  their data is exposed or their case is compromised
- **Active legal deadlines** — filing windows and hearing schedules where a missed date or
  leaked detail can directly harm a real person's legal standing

---

## Business severity override triggers

When **any** of the following are true, the finding severity is **Critical**
regardless of the technical score:

| # | Trigger | Why Critical |
|---|---|---|
| B1 | Finding involves **attorney-client privileged data** (matter descriptions, communications, legal strategy, case notes) | Bar ethics rules. Exposure is a professional conduct violation. Privilege cannot be restored once breached. |
| B2 | Finding involves **immigration identifiers** (A-Numbers, visa numbers, USCIS case IDs, receipt numbers) | Government identifiers tied to active proceedings. Exposure can compromise cases, enable identity fraud, and endanger individuals. |
| B3 | Finding involves **active case timelines** (hearing dates, filing deadlines, case status, scheduled appointments) | Leaking or corrupting active deadlines can directly cause a missed deadline — an irreversible harm in immigration proceedings. |
| B4 | Finding involves **data for pro bono or vulnerable clients** where exposure could affect immigration status, employment, housing, or physical safety | These individuals have no recourse and face disproportionate consequences. The harm is not theoretical. |
| B5 | Finding would trigger **mandatory breach notification** under applicable law (state privacy statutes, bar ethics reporting obligations, HIPAA-adjacent rules) | The notification and remediation cost alone, plus the reputational and bar discipline exposure, warrants Critical. |
| B6 | Finding involves **data that could endanger physical safety** — identity, location, or status information for individuals whose safety depends on that information staying confidential | Exposure risk to vulnerable individuals is a Critical harm regardless of how it is accessed. |
| B7 | Finding exposes **any real PII committed to a static-serving directory** (public/, wwwroot/, assets/) | No authentication required. Data is accessible immediately to anyone who can reach the server. |

---

## When the technical score is lower than Critical

When a business override applies and the technical score is lower (e.g. CVSS 7.5),
report both and explain the override. Do not silently set the severity to Critical
without disclosing the override:

```
- Severity          : Critical (business override — see below)
- Technical score   : CVSS 7.5 / High (AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
- Business severity : Critical
- Override reason   : [state which trigger(s) apply — B1, B2, etc. — and why]
  Example: "B1 + B2 — attorney-client privileged matter data and immigration
  A-Numbers for individuals in active proceedings. CVSS Adjacent vector
  understates realistic network exposure (VPN/corporate Wi-Fi)."
```

---

## How each review skill applies this

Every review skill that assigns severity must:

1. **Determine the technical severity first** using its own scale
2. **Apply the business override check** — ask: does this finding touch any of B1–B7?
3. **Use the higher of the two** as the reported severity
4. **State the override** when business severity exceeds technical severity

The override check is not optional. It applies to every finding in every review,
not just security findings.

---

## Applying business context beyond severity

Business context also affects:

**What counts as a finding at all.** A finding that would be Informational in a
generic app may be a blocking issue in this domain. Examples:
- PII logged to the console → Informational in most apps, High here (lawyer-client data
  in browser DevTools or server logs is a confidentiality breach)
- Missing audit trail for data access → Low in most apps, Medium/High here (privilege
  and compliance obligations require knowing who accessed which matters)
- Export function returning all records → Low/Medium elsewhere, High here if the
  dataset includes immigration or matter data for multiple clients

**What counts as remediation.** For findings involving real client data that was
committed to the repo or a static directory, remediation is not complete until:
1. The file is deleted
2. Git history is purged (`git filter-repo`)
3. Access logs are checked from the first commit date
4. Affected individuals are assessed for notification obligations

Simply deleting the file is insufficient if it was ever committed.

**Blocking vs warning.** In this system, any finding rated Critical by business
severity blocks the review/PR/checkin. A business-Critical finding is not a
warning — it must be resolved before the work continues.
