# 0029 — ICEA and Tech Spec hierarchical folder structure

**Status:** Accepted
**Date:** 2026-06-15
**Amended:** 2026-06-17 (v2.2.0 — Epic folder removed. All files always in UserStory{ID}/. ICEA type determined by Story Breakdown section inside the file, not folder name.)
**Amended:** 2026-06-15 (v2.0.0 — Epic structure added; *.epic.md and
*.tracker.md added as standard artefacts; Story vs Epic determined by
Tech Spec Section 11 sizing threshold of >5 SP)

## Context

ICEA documents were stored in a flat directory: `docs/icea/ADO-[ID]-[feature].md`.
This made it difficult to navigate by release or sprint, gave no structural
link between a document and its planning context, and conflated documents
across all releases in a single folder. There was also no companion technical
design document — implementation detail was either absent or buried inside
the ICEA itself.

Additionally, the icea-feature skill only required an ADO work item ID before
drafting. Release and Sprint numbers were never collected, so there was no
basis for a structured folder hierarchy even if one had been desired.

## Decision

### Folder structure

All ICEA and Tech Spec files are stored under:

```
docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/
```

Two files are created per feature:

| File | Purpose |
|---|---|
| `ADO-{ID}-{feature}.icea.md` | Intent, Context, Examples, Acceptance — the approved spec |
| `ADO-{ID}-{feature}.techspec.md` | Implementation-focused design: architecture touch points, data design, API contract, business logic, UI design, error handling, security, testing strategy, open questions |

### Required identifiers

The icea-feature skill now requires all three identifiers — ADO #, Release #,
and Sprint # — before drafting begins. If any are missing they are requested
in a single grouped prompt. The skill never infers or assumes Release or Sprint.

### No-assumption rule for Tech Spec

The Tech Spec must not silently fill in anything not present in the approved
ICEA or architecture docs. Where a decision cannot be determined, a clearly
labelled `❓ TECH SPEC OPEN QUESTION` block is inserted. These are
consolidated into a Section 10 table at the end of the document.

### Tooling updates

- `hooks/icea-floor.sh` — find pattern updated to match `*.icea.md`;
  legacy `ADO-*.md` and `icea-*.md` patterns retained for backward compat
- `CLAUDE.md` Feature Gate — path updated to match new structure
- `CLAUDE.md` § 1 Project Overview — ICEA path reference updated

## Consequences

- Documents are navigable by release and sprint without tooling
- Breaking change for any script or glob that assumed `docs/icea/ADO-*.md`
  — legacy pattern retained in the floor hook for backward compat
- Tech Spec gives implementers a concrete design starting point without
  requiring them to re-derive it from the ICEA
- Open questions are explicit and traceable rather than silent assumptions
