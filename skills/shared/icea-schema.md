# ICEA Schema — Shared Specification
_Spec version: 1.1 · Last changed: 2026-08-30 · Applies to: icea-feature (generator),
pr-spec-review (compliance checker), critic (icea mode)_

Normative contract for a valid ICEA document — the required sections, field rules, and
validation gates. This is the **schema** (what MUST be present and correct); the fill-in
**form** is `skills/icea-feature/references/icea-template.md`, which conforms to this schema.
`pr-spec-review` reads this spec to know what to check compliance against; `icea-feature`
generates against it; `critic` (icea mode) validates against it. One source of truth.

---

## Header (mandatory)

```
# ICEA — {Feature Name}
ADO #{ID} · Release {R} · Sprint {S}
Status: DRAFT | ✅ Approved
```

`Status` transitions DRAFT → ✅ Approved only via completed Sign-Off. Approved ICEAs live at
`docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-{feature}.icea.md`.

---

## Required sections

| Section | Required subsections / rules |
|---|---|
| **Intent** | Goal (**one sentence** a newcomer can restate — what this delivers and for whom); Problem Statement (measurable success, no vague language); Business Impact (cost of not solving / value delivered); Story (`As a … I want … so that …` — the "so that" must follow from the action); Success Metrics (observable) |
| **Context** | Personas (prose, specific enough to decide from); System Context table (Layer · Component · Change Type — **every row load-bearing**); Constraint Context table (technical / regulatory / business limits bounding the solution); Change Tier (T1/T2/T3 + rationale, per `change-tier-spec.md`) |
| **Examples** | Happy Path, Edge Cases (**minimum 2**), Error States (**every** error state has a user-visible message) — all in **Given/When/Then table** format; **mandatory Permission Boundary scenario** (unauthorised-access outcome) |
| **Acceptance** | Acceptance Criteria; Out of Scope (**minimum 3**, each an explicit exclusion with rationale); Assumptions (each **verified**/**unverified**); Open Questions (product/stakeholder — resolved or deferred-with-justification before Approved); Risks & Pre-Mortem; Dependencies (Blocked by / Blocks); Irreversibility Flags; D-Blocks |
| **Story Breakdown** | Type + Total SP (see sizing rule below) |
| **Sign-Off** | Product + Tech Lead rows with status |
| **Revision Log** | `{date} — {description}` |

---

## Acceptance-Criteria ID conventions (the compliance contract)

- `AC-F{n}` — functional criterion. Testable, no subjective language.
- `AC-NF{n}` — non-functional criterion. MUST carry a target value + verification method.
- Every AC is checkbox-form (`- [ ] AC-F1: …`).
- These IDs are the requirement list `pr-spec-review` maps the diff against
  (`traceability-mapping-spec.md`). An AC with no implementing code → ❌ MISSING; a change
  covered by no AC and not in Out of Scope → SCOPE CREEP.

---

## Validation gates (normative — enforced by generator, checked by reviewer/critic)

1. **D-Blocks resolved before SAVE ICEA** — open architectural decisions (format per
   `icea-decisions-spec.md`) must be selected before the ICEA is saved. `None.` is valid.
2. **No silent assumptions** — ambiguity is an `unverified` Assumption, never a guess.
3. **Pre-mortem required** for stories touching auth, payments, or irreversible data changes.
4. **B1–B7 sensitivity** — any AC/Example touching business-sensitive data
   (`business-context-severity.md`) is flagged; the critic escalates coverage gaps.
5. **Out of Scope ≥ 3** and **Edge Cases ≥ 2** — completeness floors.
6. **Open Questions resolved before ✅ Approved** — every ICEA Open Question is answered, or
   explicitly deferred with written justification, before Status → ✅ Approved (mirrors the
   Tech Spec Open-Questions gate in `techspec-schema.md`). Blocks Sign-Off; no bypass.
7. **Permission Boundary example present** — Examples include at least one unauthorised-access
   scenario with its observable outcome.

---

## Sizing rule (drives Story vs Epic)

- Total SP ≤ 5 → **Type = STORY** (single implementation ADO).
- Total SP > 5 → **Type = EPIC** (one child ADO per story). Child ADO numbers are `TBD` until
  `IMPLEMENT ADO-{ID} Story-{N}` runs.
- Stories are split by **logical shippable slice** (≤5 SP each), never by AC.

---

## Rules

- This spec is the AUTHORITY for ICEA structure — the template and any renderer conform to it.
- Consumers reference this spec; they do NOT restate the section list inline.
- Section content/wording lives in the template; section *requirements* live here.
- Changing the required-section set is a schema change — bump this spec's version and update
  the template + `pr-spec-review` in the same commit.
