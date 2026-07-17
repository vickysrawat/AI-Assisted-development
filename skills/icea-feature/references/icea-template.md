# ICEA Template v2.4.1
# Extended with Planning phase (Problem Statement, Story, Personas, MoSCoW,
# Pre-mortem, Irreversibility Flags, Sign-Off) and Story Breakdown section.

---

# ICEA — {Feature Name}
ADO #{ID} · Release {R} · Sprint {S}
Status: DRAFT

---

## Intent

### Problem Statement
{One paragraph: what is the problem, who has it, cost of not solving it,
measurable definition of success. Every outcome must be observable and
measurable. No vague language.}

### Story
As a {specific persona}, I want to {action}, so that {outcome}.

{Validate: does the "so that" clause actually follow from the action?
If not, rewrite until it does.}

### Success Metrics
- {Observable, measurable outcome 1}
- {Observable, measurable outcome 2}

---

## Context

### Personas
**{Persona name}:** {role} · {context} · {goal} · {frustration} · {success measure}

{Add one block per persona. Be specific enough to make design decisions from.}

### System Context
| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| {e.g. API} | {e.g. ReportController} | {new / modify / extend} | |

### Change Tier
**{T1 / T2 / T3}** — {rationale}

---

## Examples

### Happy Path
**Given** {precondition}  
**When** {action}  
**Then** {observable outcome}

### Edge Cases
**Given** {edge precondition}  
**When** {action}  
**Then** {expected behaviour}

{Minimum two edge cases.}

### Error States
**Given** {error precondition}  
**When** {action}  
**Then** {user-visible error message and system behaviour}

{Every error state must have a user-visible message defined.}

---

## Acceptance

### Acceptance Criteria
- [ ] AC-F1: {functional criterion — testable, no subjective language}
- [ ] AC-F2: {functional criterion}
- [ ] AC-NF1: {non-functional criterion — target value + verification method}

### Out of Scope
- {Item 1 — minimum three items. Taken from plan Won't Haves + story-specific items.}
- {Item 2}
- {Item 3}

### Assumptions
- {Assumption} — **verified** / **unverified**

{Never resolve ambiguity with silent assumptions. Flag unverified items.}

### Risks & Pre-Mortem
| Risk | Probability | Impact |
|---|---|---|
| {risk} | H / M / L | H / M / L |

**Pre-mortem:** "This shipped and failed. What went wrong?"
{One paragraph — most likely mis-implementation or failure mode.
Required for stories touching auth, payments, or irreversible data changes.}

### Dependencies
- Blocked by: {story, ADO item, or system}
- Blocks: {story, ADO item, or system}

### Irreversibility Flags
{Any decisions that cannot be undone — flagged for explicit review.
If none: "None identified."}

### D-Blocks
{Open architectural decisions requiring explicit selection.
Format per icea-decisions-spec.md. If none: "None."}

---

## Story Breakdown

> Populated from Tech Spec Section 11 sizing.
> All files live in the same folder regardless of type:
> `docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/`
>
> If total SP ≤ 5: **Type = STORY** — single implementation ADO, no child ADOs needed.
> If total SP > 5: **Type = EPIC** — create one child ADO per story in Azure DevOps.
>   Child ADO numbers are recorded automatically when `IMPLEMENT ADO-{ID} Story-{N}` is run.
>   Leave "TBD" until then — child ADOs do not exist at plan/review time.

**Type:** STORY / EPIC
**Total SP:** {N}

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | TBD (recorded at implement time) | {what user can do after this ships} | {SP} | Yes | None | ⏳ Pending |
| 2 | TBD | {what user can do after this ships} | {SP} | Yes | Story 1 live | ⏳ Pending |

> Stories broken by logical completion — each story is a shippable slice
> delivering user value independently (≤5 SP). Never broken by AC.
> If Type = STORY, this table has one row only.

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---
### Revision Log
{date} — {description}
