# ICEA Template v2.5.0
# Extended with Planning phase (Problem Statement, Story, Personas, MoSCoW,
# Pre-mortem, Irreversibility Flags, Sign-Off) and Story Breakdown section.
# Conforms to skills/shared/icea-schema.md — that spec is the normative source for
# required sections + validation gates; this file is the fill-in form.

---

# ICEA — {Feature Name}
ADO #{ID} · Release {R} · Sprint {S}
Status: DRAFT

---

## Intent

### Goal
{One sentence a newcomer could restate: what this delivers and for whom. No jargon.}

### Problem Statement
{One paragraph: what is the problem, who has it, cost of not solving it,
measurable definition of success. Every outcome must be observable and
measurable. No vague language.}

### Business Impact
{The cost of not solving this / the value delivered by solving it — quantified where
possible (revenue, risk, hours, compliance exposure). One or two sentences.}

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

{Every row must be load-bearing — a component someone will actually change, or must know
about to build this. If a row wouldn't change how the work is done, cut it. Noise dilutes
the signal.}

### Constraint Context
| Constraint | Type | Bounds the solution how? |
|---|---|---|
| {e.g. must use Dapper, no EF} | technical / regulatory / business | {impact on design} |

{Solution-bounding limits — technical, regulatory, or business. If none: "None identified."}

### Change Tier
**{T1 / T2 / T3}** — {rationale}

---

## Examples

> All scenarios use Given/When/Then table format.

### Happy Path
| Given | When | Then (observable outcome) |
|---|---|---|
| {precondition} | {action} | {observable outcome} |

### Edge Cases
| Given | When | Then (expected behaviour) |
|---|---|---|
| {edge precondition} | {action} | {expected behaviour} |

{Minimum two edge cases.}

### Error States
| Given | When | Then (user-visible message + system behaviour) |
|---|---|---|
| {error precondition} | {action} | {user-visible error message and system behaviour} |

{Every error state must have a user-visible message defined.}

### Permission Boundary (mandatory)
| Given | When | Then (observable outcome) |
|---|---|---|
| {an unauthorised / under-privileged actor} | {attempts the action} | {access denied — observable outcome; no data leak} |

{Every ICEA must define at least one permission-boundary scenario — what happens when an
actor without rights attempts the behaviour. Ties to B1–B7 sensitivity handling.}

---

## Acceptance

### Acceptance Criteria
- [ ] AC-F1: {functional criterion — testable, no subjective language}
- [ ] AC-F2: {functional criterion}
- [ ] AC-NF1: {non-functional criterion — target value + verification method}

### Out of Scope
- {We will NOT do X — because Y. State the exclusion and its reason so scope is unambiguous.}
- {We will NOT do … — because …}
- {We will NOT do … — because …}

{Minimum three items, from plan Won't Haves + story-specific items. Phrase each as an
explicit exclusion with its rationale, not a bare noun.}

### Assumptions
- {Assumption} — **verified** / **unverified**

{Never resolve ambiguity with silent assumptions. Flag unverified items.}

### Open Questions
| # | Question (product / stakeholder) | Owner | Status |
|---|---|---|---|
| 1 | {a non-architectural question needing a business/product answer} | {who answers} | open / answered / deferred |

{Product- or stakeholder-facing questions only — architectural forks belong in D-Blocks,
things-taken-as-true belong in Assumptions. Every question must be answered, or explicitly
deferred with written justification, before Status → ✅ Approved (blocks Sign-Off).
If none: "None."}

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
