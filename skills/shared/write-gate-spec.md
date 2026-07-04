# Shared spec: WRITE GATE — full detail

The operative rule lives in `CLAUDE.md` §0 (always-active). This spec holds the
supporting detail moved out of CLAUDE.md to keep session context lean. Skills may read
this when they need the full artefact-timing table or the edge-case list.

## Artefact write-timing table

| Artefact | When written |
|---|---|
| `temp/ADO-{ID}-icea.md` | On SAVE PLAN — draft rendering aid, deleted on SAVE ICEA |
| `temp/ADO-{ID}-tech.md` | On SAVE ICEA — draft rendering aid, deleted on SAVE TECH |
| `*.plan.md` | On SAVE PLAN ADO-{ID} |
| `*.icea.md` | On SAVE ICEA ADO-{ID} — after plan saved and ICEA reviewed in temp/ |
| `*.techspec.md` | On SAVE TECH ADO-{ID} — after ICEA saved and Tech Spec reviewed in temp/ |
| `*.epic.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `*.tracker.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `memory/` | Automatic on trigger — no gate (Dream pipeline) |
| Source code, config files | Blocked until `APPROVE ADO-{ID}` |

## The gate holds — no exceptions for source code and config files

The APPROVE requirement applies even when:
- An ICEA has been approved
- The critic has passed
- A previous step already confirmed the approach
- The developer seems impatient or in a hurry

Partial responses do not count as approval. For multiple files, all paths are listed in a
single WRITE PENDING prompt, and a single `APPROVE ADO-{ID}` releases them together.

## Rationale

The gate fires on what the model is about to **produce**, not on what the developer typed
(ADR 0002, output-gated enforcement; ADR 0028, write gate). Keeping the operative rule in
CLAUDE.md (loaded every session) — rather than in a `paths`-scoped rule — is what makes it
fire during planning, before any file is edited.
