# 0015 — Business-context severity overrides (B1–B7)
Status: Accepted · Date: 2026-03 (retroactive, 2026-06-11)
Governs: `skills/shared/business-context-severity.md`

## Problem
A CVSS "medium" finding that exposes immigration IDs or privileged client matter
data is not medium in a law firm. Generic severity scores don't know the business.

## Decision
Seven business-context triggers (B1: attorney-client privilege, B2: immigration
identifiers, B3: active case timelines, B4: pro-bono/vulnerable clients,
B5: PII, B6: physical safety data, B7: static-serving directories) that
escalate findings one severity band. Applied consistently across all review
skills — static, dynamic, and Phase D. The model annotates; the escalation
is visible in the ledger; the developer can dismiss with justification.

## Revisit when
New data categories emerge in the practice (e.g. AI-generated work product
provenance); B8+ should follow the same pattern.
