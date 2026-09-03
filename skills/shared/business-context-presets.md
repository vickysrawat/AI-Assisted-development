# Business Context Presets
_Spec version: 1.0 · Created: 2026-09-01_
_Consumed by: `business-context-generation.md` (to seed `.claude/business-context.md`)_

Per-domain starting content for the B-series business-context triggers. Two kinds:

- **Verbatim-locked table** — reproduced byte-for-byte into `.claude/business-context.md`.
  Grounding (`business-context-grounding.md`) may only *augment* with `(project-specific)`
  entries; it must never rewrite a locked entry. Used where a domain is a live deployment and
  regression-safety is required.
- **Seed checklist** — regulatory frames + example triggers + always-apply universals. The
  generation module derives the actual B-series from the seed + the project's architecture +
  grounded regulatory facts.

The B-series length and content are domain-defined. Trigger IDs (`B1…Bn`) are stable within a
generated file so review skills can cite them; the count is not fixed across domains.

---

## `legal` — VERBATIM-LOCKED (regression-critical)

Reproduce this table exactly into `.claude/business-context.md`. This preserves the behavior
of existing legal/immigration deployments (the plugin's origin domain).

**Domain context.** This system handles: attorney-client privileged matter data; immigration
case records (A-Numbers, visa status, hearing dates, filing deadlines, case outcomes);
vulnerable individuals (pro bono clients often in active proceedings); active legal deadlines.

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

## `healthcare` — SEED CHECKLIST

**Regulatory frames to ground:** HIPAA Privacy & Security Rules, HITECH breach-notification,
42 CFR Part 2 (substance-use records), state medical-privacy statutes; (EU) GDPR Art. 9
special-category health data.

**Seed triggers (derive/refine against the architecture):**
- Protected Health Information (PHI): diagnoses, treatment, medications, clinical notes.
- Medical/patient identifiers: MRN, health-plan/beneficiary IDs, SSN, device identifiers.
- Time-sensitive clinical events: appointment/procedure schedules, medication timing, results delivery.
- Mandatory breach notification (HIPAA/HITECH ≥500 records; state AG).
- Data whose exposure endangers patient safety or care.
- **Always-apply:** real PII/PHI in a static-serving directory.

---

## `fintech` — SEED CHECKLIST

**Regulatory frames to ground:** PCI-DSS (cardholder data), GLBA Safeguards Rule, SOX (for
public issuers), AML/KYC (BSA), state financial-privacy + breach statutes; (EU) PSD2, GDPR.

**Seed triggers (derive/refine against the architecture):**
- Cardholder data (PAN, CVV, track data) and payment credentials.
- Financial account identifiers: account/routing numbers, IBAN, brokerage IDs.
- Money-movement / transaction integrity (irreversible transfers, settlement windows).
- KYC/AML identity documents and sanctions-relevant data.
- Mandatory breach notification (GLBA, state financial regulators).
- **Always-apply:** real PII / cardholder data in a static-serving directory.

---

## `ecommerce` — SEED CHECKLIST

**Regulatory frames to ground:** PCI-DSS (payments), CCPA/CPRA + US state privacy laws,
GDPR (EU customers), CAN-SPAM/consumer-protection.

**Seed triggers (derive/refine against the architecture):**
- Customer PII: name, address, email, phone, order history.
- Payment data (tokenized card refs, saved payment methods).
- Account credentials and session/auth material.
- Bulk-export of customer datasets.
- Mandatory breach notification (state privacy AGs / GDPR).
- **Always-apply:** real customer PII in a static-serving directory.

---

## `govtech` — SEED CHECKLIST

**Regulatory frames to ground:** FISMA/NIST 800-53, Privacy Act, CJIS (criminal justice),
FERPA (education), state public-records + breach statutes; data-residency/sovereignty rules.

**Seed triggers (derive/refine against the architecture):**
- Citizen/constituent PII and government-issued identifiers (SSN, driver's license, case IDs).
- Records with statutory confidentiality (CJIS, FERPA, tax, benefits).
- Time-sensitive statutory deadlines / eligibility windows.
- Data whose exposure endangers a person's safety, benefits, or legal standing.
- Mandatory breach notification (agency + state obligations).
- **Always-apply:** real PII in a static-serving directory.

---

## `generic` — SEED CHECKLIST (default / "other")

Use when no domain preset fits or the confirmed domain is "other". The generation module
derives the full B-series from the architecture + grounded frames for the stated jurisdiction.

**Seed triggers (baseline universals):**
- Regulated or confidential data for identifiable individuals.
- Regulated individual identifiers (government IDs, account/case numbers).
- Irreversible, time-sensitive harm (deadlines, transactions, status).
- Mandatory breach-notification exposure under applicable law.
- Data whose exposure endangers a person's safety, status, finances, or livelihood.
- **Always-apply:** real PII in a static-serving directory.
