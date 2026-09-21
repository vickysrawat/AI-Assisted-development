# MEMORY.md — Project memory (dream-managed)

## 2026-09-17 — Goal-loop (icea-implement Step 4b) completion = intent + approved scope of change

**Decision + rationale.** The completeness gate scored code against the **ICEA ACs only** — so
code that passed every AC but left a Tech-Spec-planned file/change unbuilt read as "done". "Done"
must depend on both **intent** (ICEA ACs) and the **approved scope of change** (the Tech Spec's
planned deliverables).

**Fix.** Step 4b's `rubric` is now one ordered list combining: intent criteria (ICEA ACs, type
`functional`/`non-functional`) + approved-scope criteria (Tech Spec AC Coverage Matrix / Files
Changed rows, type `structural`, id = the file/row ref). The rubric schema already had a
`structural` type — that's the natural home for planned-deliverable criteria; no schema/enum change
needed. **Precedence: ICEA authoritative** — a structural criterion that is scope creep vs the ICEA is not a completion target; the Step 4a critic flags it as a traceability REVISE.

## 2026-09-21 — Migration-family sessions must create resume pointers before context exhaustion

**Decision.** When the migration-family review session becomes too large to handle safely, do not
continue into another item or implementation step. Create a durable resume pointer first, then ask
the developer to start a new session.

**Resume pointer must include:** current branch, active tracker path, last completed item, active item,
approved decisions, deferred items, pending implementation/task links, files changed, tests still to
run, and the exact next user action.

**Rationale.** The migration review is intentionally one-item-at-a-time. Continuing after context
exhaustion risks skipping findings, repeating decisions, losing approval boundaries, or claiming
verification that did not occur.

**Operating rule.** A context stop is a controlled handoff, not a failure: write the pointer,
explicitly state what is and is not complete, and request a new session.
