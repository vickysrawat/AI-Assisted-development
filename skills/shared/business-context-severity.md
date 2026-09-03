# Business Context Severity Spec
_Spec version: 2.0 · Updated: 2026-09-01_
_Applies to: all review skills (security, code-review, icea-review, checkin, pr-spec-review)_

> **Domain-neutral as of 2.0.** This spec defines the *model* (how business severity works)
> and a *neutral fallback* B-series. The domain-specific triggers for a project live in
> `.claude/business-context.md`, generated per the identified domain by
> `business-context-generation.md`. When that file exists it **takes precedence** over the
> neutral fallback below. Per-domain seed content lives in `business-context-presets.md`.

---

## The principle

**CVSS and technical severity scales are floors, not ceilings.**

A finding's reported severity is the higher of:
1. Its technical severity (CVSS score, code-review impact rating, ICEA compliance level)
2. Its business severity — determined by applying the domain context rules below

Technical severity can never override business severity upward. Business context can
only raise severity — never lower it.

---

## Resolving the trigger set (project-local first)

Every review skill that assigns severity resolves its triggers in this order:

1. **`.claude/business-context.md`** in the project root, if it exists — the domain-tailored
   B-series produced at integration time. Use its triggers verbatim.
2. Otherwise, the **neutral fallback B-series** defined in this file.

The trigger set is a **B-series** — an ordered list `B1, B2, … Bn` whose **length and content
are domain-defined**. Do not assume a fixed count. Refer to them generically as "the B-series
business-context triggers", never by a fixed-count label.

---

## Neutral fallback B-series

Applied only when no `.claude/business-context.md` exists. Domain-neutral by design — a
project that has run domain identification will have a richer, domain-specific set.

When **any** of the following is true, the finding severity is **Critical** regardless of the
technical score:

| # | Trigger (neutral) | Why Critical |
|---|---|---|
| B1 | Finding involves **regulated or professionally-confidential data** for identifiable individuals (records a law, contract, or professional-conduct rule requires be kept confidential) | Confidentiality obligations are legal/contractual; exposure is often irreversible. |
| B2 | Finding involves **regulated individual identifiers** (government IDs, account/case numbers, or other identifiers tied to a real person or active matter) | Identifiers enable fraud, correlation, and targeting; many are non-rotatable. |
| B3 | Finding can cause **irreversible, time-sensitive harm** (a corrupted/leaked deadline, transaction, or status where a miss cannot be undone) | Irreversibility removes the ability to remediate after the fact. |
| B4 | Finding would trigger **mandatory breach-notification** under applicable law/regulation | Notification + remediation cost and regulatory exposure alone warrant Critical. |
| B5 | Finding involves **data whose exposure endangers a person's safety, status, finances, or livelihood** | Real-world harm to individuals is Critical regardless of access path. |
| B6 | Finding exposes **any real PII committed to a static-serving directory** (`public/`, `wwwroot/`, `assets/`) | No authentication required — accessible immediately to anyone who can reach the server. |

> These are generic categories. A project's `.claude/business-context.md` refines them into
> domain-specific triggers (and may add or remove entries) — see `business-context-presets.md`.

---

## When the technical score is lower than Critical

When a business override applies and the technical score is lower (e.g. CVSS 7.5),
report both and explain the override. Do not silently set the severity to Critical
without disclosing the override:

```
- Severity          : Critical (business override — see below)
- Technical score   : CVSS 7.5 / High (AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
- Business severity : Critical
- Override reason   : [state which B-series trigger(s) apply — by ID — and why]
  Example: "B1 + B2 — regulated confidential records and government identifiers for
  individuals in an active matter. CVSS Adjacent vector understates realistic network
  exposure (VPN/corporate Wi-Fi)."
```

---

## How each review skill applies this

Every review skill that assigns severity must:

1. **Resolve the trigger set** (project-local first, per above).
2. **Determine the technical severity** using its own scale.
3. **Apply the business override check** — ask: does this finding touch any B-series trigger?
4. **Use the higher of the two** as the reported severity.
5. **State the override** when business severity exceeds technical severity, citing the
   trigger by ID.

The override check is not optional. It applies to every finding in every review, not just
security findings.

---

## Applying business context beyond severity

Business context also affects:

**What counts as a finding at all.** A finding that would be Informational in a generic app
may be blocking in a sensitive domain. Examples (illustrative — the resolved B-series governs):
- PII logged to the console → Informational in most apps, High where the data is a
  confidentiality breach (browser DevTools or server logs).
- Missing audit trail for data access → Low in most apps, Medium/High where compliance or
  professional-conduct obligations require knowing who accessed which records.
- Export function returning all records → Low/Medium elsewhere, High where the dataset
  includes regulated data for multiple individuals.

**What counts as remediation.** For findings involving real regulated data committed to the
repo or a static directory, remediation is not complete until:
1. The file is deleted.
2. Git history is purged (`git filter-repo`).
3. Access logs are checked from the first commit date.
4. Affected individuals are assessed for notification obligations.

Simply deleting the file is insufficient if it was ever committed.

**Blocking vs warning.** Any finding rated Critical by business severity blocks the
review/PR/checkin. A business-Critical finding is not a warning — it must be resolved before
the work continues.
