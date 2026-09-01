# Tech Spec Schema — Shared Specification
_Spec version: 1.0 · Last changed: 2026-08-28 · Applies to: icea-feature (generator),
pr-spec-review (compliance checker), critic (tech mode)_

Normative contract for a valid Tech Spec — required sections, the AC-coverage contract, and
validation gates. The framework-agnostic **form** is
`skills/icea-feature/references/techspec-base.md`; framework-specific sections come from a
stack **overlay** (`techspec-{stack}.md`). Both conform to this schema. `pr-spec-review`
(full scope) reads this spec to check code↔design traceability; `critic` (tech mode)
validates the draft against it.

---

## Header (mandatory)

```
# Tech Spec — {Feature Name}
ADO #{ID} · Release {R} · Sprint {S}
Status: DRAFT | ✅ Approved
```

---

## Required sections

| Section | Required rules |
|---|---|
| **Overview** | One paragraph incl. governing architectural pattern; written for a cold-start developer |
| **AC Coverage Matrix** | **Bidirectional** — AC→File AND File→AC (see contract below) |
| **Schema Changes** | Conditional — include only when extending schema; omit entirely otherwise (never "N/A") |
| **Files Changed** | From the stack overlay |
| **Framework-specific impl** | From the stack overlay (controller/service/DTO, UI, CSS) |
| **API Changes** | New endpoints + outbound call changes |
| **Auth & Security** | Auth pattern, anti-forgery, XSS analysis |
| **Error Handling** | Scenario → behaviour table |
| **Sizing and Story Breakdown** | SP per AC group + Total; Type STORY/EPIC |
| **Definition of Done** | Implementation · Quality · Review-readiness checklists + Reviewer Checklist |
| **Open Questions** | Numbered; **all resolved or explicitly deferred before APPROVE** |
| **Request Flow** | Happy/error/submit sequence with component names |
| **Rollback** | Additive? Procedure or standard pipeline rollback |
| **Handover** | QA · DevOps/Platform · Future Developer |
| **Test Cases** | Positive + negative unit + integration; NF verification method |
| **Revision Log** | `{date} — {description}` |

---

## AC Coverage contract (the traceability heart)

- **Every AC** from the ICEA is covered by **≥1 file** change (AC→File).
- **Every file** change satisfies **≥1 AC** (File→AC).
- A gap in **either** direction is a **blocking** issue — resolve before SAVE TECH.
- This is the design-time mirror of `traceability-mapping-spec.md`: at PR time,
  `pr-spec-review --full` checks the *actual diff* against this matrix (did the file the
  matrix promised for AC-F1 actually change, and does it satisfy AC-F1?).

---

## Test-case derivation (normative)

- Tests derive from the AC list: **each AC → ≥1 positive unit test + ≥1 negative unit test**.
- Integration tests cover deployed end-to-end behaviour.
- Every **AC-NF** carries an explicit verification method (load test, Lighthouse, timing, …).

---

## Validation gates

1. **Coverage matrix complete both directions** — blocking before SAVE TECH.
2. **No open questions at APPROVE** — HARD block, **no bypass** (matches the `SAVE TECH`
   handler; `ACCEPT` overrides critic verdict but never the open-questions gate).
3. **D-option fidelity** — implementation is consistent with the ICEA's selected D-options
   (`icea-decisions-spec.md`); drift without a recorded amendment is a finding.
4. **ICEA↔Tech traceability** — every ICEA AC appears in the coverage matrix.

---

## Stack overlay selection

Framework-specific sections are supplied by an overlay chosen from the detected stack:
`vsto` → vsto; `dotnet` (no angular/nodejs) → aspnet-mvc-jquery; `dotnet`+`angular` →
aspnet-api-angular; `angular`+`nodejs` → angular-nodejs. Epic-level specs use
`techspec-epic-level.md`. The overlay list is maintained in `techspec-base.md`; this schema
governs the framework-agnostic contract only.

---

## Rules

- This spec is the AUTHORITY for Tech Spec structure — templates and renderers conform to it.
- Consumers reference this spec; they do NOT restate the section list inline.
- The open-questions gate is non-negotiable — unlike the critic verdict, it has no override.
- Changing the required-section set is a schema change — bump version and update the base
  template + `pr-spec-review` together.
