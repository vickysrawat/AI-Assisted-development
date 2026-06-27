# 0035 — Plan phase integrated into icea-feature: plan feeds ICEA

**Status:** Accepted
**Date:** 2026-06-17

## Context

icea-feature previously started drafting an ICEA from a freeform developer
description — relying on Claude to infer intent, personas, assumptions, and
risks. This produced ICEAs with many [?] gaps and had no structured product
or planning layer. A separate /plan command was considered but rejected — it
would require developers to remember a separate command, manage separate
files, and link plans to ADO IDs manually.

Additionally, the ICEA format did not include the User Story protocol
(problem statement, personas, MoSCoW, pre-mortem, irreversibility flags,
sign-off). These were handled by a separate User Story format in some teams
but were inconsistent and not enforced.

## Decision

### Plan phase integrated into icea-feature
Before drafting the ICEA, icea-feature drafts a structured plan inline
covering: problem statement, story (As a/I want/so that), personas, MoSCoW
feature priority, release plan, assumptions, risks, pre-mortem, dependencies,
and open questions.

The developer reviews the plan interactively. SAVE PLAN ADO-{ID} writes the
plan to disk (alongside the ICEA in the same release/story folder) and
immediately triggers the ICEA draft.

The ICEA is populated automatically from the saved plan — personas, problem
statement, story, assumptions, risks, pre-mortem, dependencies, and Won't
Haves are carried forward without re-asking. Remaining gaps are only
system-context items (change tier, specific components, error messages).

### ICEA template extended with User Story protocol
The ICEA now includes the full User Story protocol:
- Problem Statement (measurable outcomes only)
- Story (As a/I want/so that with validated "so that" clause)
- Personas (specific enough for design decisions)
- Pre-mortem (required for auth, payments, irreversible data changes)
- Irreversibility Flags
- MoSCoW Won't Haves → Out of Scope (starting point)
- Sign-Off table (Product + Tech Lead)

ICEA terminology is retained — the format is extended, not replaced.

### Story Breakdown section replaces child story sub-folders
The ICEA now includes a Story Breakdown section populated by Tech Spec
Section 11 sizing:
- Type: STORY (≤5 SP) — single ADO, no child ADOs needed
- Type: EPIC (>5 SP) — one child ADO per story, created in Azure DevOps

Child story sub-folders are eliminated. The Story Breakdown in the parent
ICEA defines all story scopes. Child ADO numbers are recorded at implement
time (IMPLEMENT ADO-{ID} Story-{N} asks once and records in ICEA + tracker).

### Story breakdown principle
Stories broken by logical completion — each story is a shippable slice
delivering user value independently, ≤5 SP. Stories are NEVER broken by AC.
Breaking by AC produces stories that are not independently shippable.

### Tracker type determined by ICEA type
- STORY tracker: tracks ACs (unchanged)
- EPIC tracker: tracks stories (Story N, child ADO, scope, SP, status)

### Plan file location
plan.md lives alongside the ICEA in the same folder:
`docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-{feature}.plan.md` (Story)
`docs/Release{R}/Epic{ID}/ADO-{ID}-{feature}.plan.md` (Epic)

### Cross-session recovery
- Plan saved, no ICEA: `PLAN ADO-{ID}` drafts ICEA from saved plan
- ICEA saved, no Tech Spec: `TECH ADO-{ID}` or `ICEA ADO-{ID}`

## Consequences

- ICEAs have far fewer [?] gaps — most Intent/Context already in the plan
- One document reviewed by Product, Tech Lead, and QA
- Pre-mortem and irreversibility analysis built into every ICEA
- MoSCoW Won't Haves prevent scope creep and relitigating
- No child ICEA folders — simpler structure
- Epic story ADO numbers collected at implement time — zero extra steps
- icea-revise warns when plan may be out of sync with a revised ICEA
