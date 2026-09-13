# Spec: Option Change Handling

_Handles changes to the selected migration option during the design approval phase. Invoked by
[`design-revision-spec.md`](design-revision-spec.md) (the controller) when the developer classifies
a change as a bounded, significant, or fundamental option change — distinct from a document
revision. Option changes are categorically different from document revisions: they sit above the
documents, not within them._

---

## The three scenarios

| Scenario | What changed | Safe to continue? | Handler |
|---|---|---|---|
| **1 — Bounded** | One dimension (compute, ORM, one integration) — core architecture unchanged | Yes — targeted cascade, explain why | Stay in design phase |
| **2 — Significant** | Multiple dimensions — several documents substantially wrong | No — architecture must be re-assessed | Return to APPROVE OPTIONS |
| **3 — Fundamental** | Stack or posture changed — current documents invalid | No — full reset required | Archive all + return to APPROVE OPTIONS |

---

## Developer classification

The controller first runs an impact assessment — detecting which dimensions changed and which
documents are affected — and presents this information alongside the classification categories
so the developer can make an informed decision:

```
You've indicated a change to the selected option.

What I've detected so far:
  · Dimension(s) changed: {detected changes, e.g. "compute choice (App Service → Container Apps)"}
  · Documents that appear to be affected: {list}
  · Documents that appear to be unaffected: {list}

Based on this, is this a:

  [1] Bounded change — one dimension changed; core architecture intact
      → I'll explain why it's safe to continue and run a targeted cascade.
      → Only these documents will be revised: {affected list}

  [2] Significant change — this is bigger than one dimension, or more content is wrong
      → We'll archive the current documents and return to APPROVE OPTIONS.
      → Your prior work is preserved as context for the new authoring pass.

  [3] Fundamental change — the stack or posture itself has changed
      → All documents are archived. A fresh options presentation for the new approach.
      → Prior work preserved as context.

If you're unsure, choose [2] — it is always safe to return to options.
```

**Discrepancy detection:** if the developer picks [1] but the impact assessment found multiple
dimensions affected, surface the discrepancy before proceeding:

```
Verifying classification: you indicated a bounded change (Scenario 1).
However, I detected {N} dimensions affected: {list}.
This appears to be a Significant change (Scenario 2).
Options:
  · Reclassify as [2] — return to APPROVE OPTIONS (recommended)
  · Override and treat as [1] — I'll proceed with a targeted cascade covering all detected
    impacts, but some documents may need more than section-level revision.
```

The developer's explicit override is logged as a `[DECISION]` entry with the reason.

---

## Scenario 1 — Bounded option variation

### Detection

One option dimension changed. Core architecture (stack, patterns, team, ORM, integration
decisions) is intact. The dependency graph gives a complete, bounded impact set.

### Explanation presented to developer

Before any cascade fires, present:

```
Option change detected: {dimension} changed from {old} to {new}.

Why this is safe to handle within the design phase:
  · Core architectural decisions unchanged ({list of unchanged dimensions})
  · Only one infrastructure dimension affected
  · Dependency graph gives a complete, bounded impact set

Documents that REMAIN VALID (not revised):
  {list — e.g. target-component-architecture ✓}

Documents that WILL BE REVISED:
  {list — e.g. target-infrastructure-architecture, target-deployment-architecture}

Proceed with targeted cascade? [Yes / No — this is bigger than it looks]
```

If developer says "No — this is bigger": re-classify as Scenario 2 or 3 and proceed accordingly.

### Cascade

Route to `document-feedback.md` as a standard change cascade — the option dimension change is
treated as a change event on the affected documents. The dependency graph handles the rest.

### Migration log entry

```
[DECISION] Option dimension change (Scenario 1 — bounded)
Changed: {dimension} from {old} to {new}
Reason: {developer's stated reason}
Documents revised: {list}
Documents preserved: {list}
Developer confirmed safe-to-continue: yes
```

---

## Scenario 2 — Significant option change

### Detection

Multiple option dimensions changed — several drafted documents are substantially wrong, not
just partially stale. The effort to revise them is comparable to re-authoring.

### Archive current documents

Before presenting new options, archive all current draft documents:

**Archive location:** `docs/migrations/{MIGRATION_ID}/design/archive/option-{label}-rejected-{YYYY-MM-DD}/`

Where `{label}` is a short label for the option that was active (e.g. `app-service-dapper`,
`aks-efcore`). All current design documents — regardless of approval status — are moved to the
archive folder. Their `Status` field is overwritten with `ARCHIVED`.

These documents are **preserved as prior context** for the new authoring pass:
- Developer annotations, open questions, and reasoning survive
- The new authoring agents read the archived documents as input alongside the source and new option
- They build on prior thinking rather than starting blind

### Return to APPROVE OPTIONS

Present the original options table to the developer with:
- The prior context note ("your previous drafts are archived and available as reference")
- Updated effort/TCO if the change significantly affects them
- The developer re-selects an option → `APPROVE OPTIONS` → new design phase begins

### Migration log entry

```
[DECISION] Option change (Scenario 2 — significant)
Previous option: {option name/label}
Reason for change: {developer's stated reason}
Archived to: docs/migrations/{MIGRATION_ID}/design/archive/option-{label}-rejected-{YYYY-MM-DD}/
Documents archived: {list with their approval status at time of archiving}
Prior context available to new authoring pass: yes
```

---

## Scenario 3 — Fundamental option change

### Detection

Stack or posture changed (e.g. port-to-.NET → rewrite-from-spec; rehost → refactor-for-cloud).
All current documents are invalid — they were authored for a different fundamental approach.

### Archive all current documents

Same archive mechanism as Scenario 2, but ALL documents are archived unconditionally:

**Archive location:** `docs/migrations/{MIGRATION_ID}/design/archive/option-{label}-rejected-{YYYY-MM-DD}/`

### Replatform posture-boundary case (refactor-for-cloud)

For **Replatform**, a fundamental change often means the **6R posture** itself changes. One case
crosses a skill boundary and is NOT a simple archive-and-reselect:

```
Fundamental change detected: posture changing from {rehost|replatform} → refactor-for-cloud.
This crosses a skill boundary — refactor-for-cloud requires CODE change, which is Rewrite's job.
Replatform provisions the host; Rewrite transforms the code. They coordinate via the shared ledger.

Options:
  · Proceed as Replatform + Rewrite overlay — Rewrite authors the new code, Replatform overlays
    the host; coordinate through payload.rewrite ↔ payload.replatform in the shared ledger.
  · Abandon this Replatform run — run Rewrite first, then Replatform overlays the host afterward.
```

This is a **skill-coordination decision**, not a within-skill option reselection. Archive the current
documents (as below), then route to the coordination choice — do not just re-present Replatform options.

### Upgrade posture-boundary case (infeasible-in-place → Rewrite)

For **Upgrade**, a fundamental change means the upgrade is **infeasible in place** — discovered during
the gap/risk review or the feedback loop through accumulated RED/BLOCKER evidence (a library with no
target-version equivalent, a runtime boundary that can't be crossed by the tool). This is the
discovered-late equivalent of the Step 1 false-upgrade catch.

```
Infeasibility detected: {evidence — e.g. "3 BLOCKER dependencies with no .NET 8 path"}.
This upgrade cannot succeed in place. It requires a Rewrite.
Route to: REWRITE ADO-{ID}
```

Upgrade has no "options" to return to — its decision was **classification**, not option-selection.
So the hard return for Upgrade is **route to Rewrite**, not "return to APPROVE OPTIONS." Archive the
gap/risk report + any deltas as prior context (they inform the Rewrite's feasibility). No baseline tag
is created; no source is edited.

### Hard return to APPROVE OPTIONS

No "continue anyway" path. The developer returns to the options presentation. The stack or posture
change may also change which options are available — the options must be re-presented fresh, not
just re-selected from the prior list.

Present to the developer:
- Why this is a fundamental change (the specific posture/stack boundary crossed)
- The archived documents (available as prior context, but substantially different approach)
- A fresh options presentation for the new stack/posture

### Migration log entry

```
[DECISION] Option change (Scenario 3 — fundamental)
Previous option: {option name/label}
Stack/posture change: {what changed}
Reason: {developer's stated reason}
Archived to: docs/migrations/{MIGRATION_ID}/design/archive/option-{label}-rejected-{YYYY-MM-DD}/
All {N} documents archived. Fresh options to be presented.
```

---

## Archive folder structure

```
docs/migrations/{MIGRATION_ID}/design/
  target-component-architecture.md          ← active
  target-security-architecture.md           ← active
  ...
  archive/
    option-app-service-dapper-rejected-2026-09-11/
      target-component-architecture.md      ← ARCHIVED (prior context)
      target-security-architecture.md       ← ARCHIVED
      target-data-architecture.md           ← ARCHIVED
      ...
    option-aks-efcore-rejected-2026-09-15/  ← second change, if any
      ...
```

**File status field** in archived documents: overwritten to `Status: ARCHIVED — {date}`.

**New authoring pass reads:** the most recent archive folder as "prior context." Agents receive:
```
Prior context (archived documents from previous option): {folder path}
Read these as reference only — do not replicate content that no longer applies.
Preserve developer annotations, open questions, and reasoning where still relevant.
```

---

## Hard rules

- NEVER discard archived documents — preserve as prior context for the new authoring pass.
- ALWAYS explain why Scenario 1 is safe to continue before the cascade fires — the developer
  must explicitly confirm before proceeding.
- NEVER auto-classify — always present the classification categories and let the developer
  choose; surface discrepancies if the detected impact doesn't match the declared scenario.
- Scenario 2 and 3: ALWAYS return to APPROVE OPTIONS — no "proceed anyway" path.
- ALWAYS write a `[DECISION]` migration log entry for every option change, regardless of scenario.
- Archive folder names MUST include the date and a short option label — they must be human-readable
  without opening any files.
- The controller (`design-revision-spec.md`) owns classification routing; this spec owns handling.
