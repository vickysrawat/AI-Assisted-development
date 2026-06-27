# Change Manifest — Shared Spec
_Spec version: 1.0 · Last changed: 2026-06-11 · Governed by: skills/shared/_

A complete, file-level declaration of what the model intends to change and why,
generated WITH the ICEA, before any code exists. Phase one is **instrumentation
mode**: the manifest is displayed (transparency), measured (accuracy), and
harvested (deviations → memory) — but adds NO new approval interrupt. Trust is
built by measurement, not asserted; autonomy is earned by evidence (ADR 0011).

**Callers:** `icea-feature` (generate), `checkin` (measure), `dream` (harvest),
`sprint-metrics` (report), `critic` (substance guard remains separate)

---

## 1. Format

```
## Change Manifest (predicted)
| # | File | Action | Why (traces to) |
|---|------|--------|-----------------|
| 1 | Controllers/DealsController.cs | modify — add SearchFilter endpoint | AC-1 |
| 2 | Services/DealQueryService.cs   | new — query composition           | AC-1, D1 |
| 3 | deals-grid.component.ts        | modify — wire filter UI           | AC-2, AC-3 |
| 4 | DealQueryServiceTests.cs       | new — scenarios from Examples     | E-1..E-4 |
Predicted: 4 files · 2 new, 2 modified · schema change: none · new deps: none
```

Rules:
- **Every row traces** to an AC, Example, Context item, or D decision. An
  untraceable row is scope creep declared in advance — remove it or amend the
  ICEA first.
- **Rows name concrete paths.** A row that cannot be diff-matched ("relevant
  service files") counts as a MISS in scoring. (Anti-Goodhart rule 1.)
- The footer line declares schema and dependency impact explicitly — "none"
  is a claim, not an omission.

## 2. Generation — T2 and above

`icea-feature` generates the manifest with the ICEA draft (after D selections,
since chosen options change the file set). T1 micro changes carry an implicit
one-row manifest (the single file from tier classification). The developer
reads it as part of the same APPROVED cycle — no separate gate in
instrumentation mode.

## 3. Measurement — mechanical, at checkin

After implementation, `checkin` computes the delta with zero model judgment:

```
predicted  = manifest rows (file paths)
actual     = git diff --name-status output (source + test files)
matched    = predicted ∩ actual
missed     = actual − predicted     (touched but unpredicted)
over       = predicted − actual     (predicted but untouched)
precision  = matched / predicted
recall     = matched / actual
```

Both numbers are recorded in the ICEA file:
```
Manifest accuracy: 4/4 predicted-and-touched · 1 unpredicted
(DealsModule.ts — DI registration) · 0 over-predicted
Precision 1.00 · Recall 0.80
```

**Anti-Goodhart rule 2:** over-prediction is its own tracked error. Padding
the manifest with every conceivable file scores WORSE (precision drops), not
safer. The score rewards specific, correct prediction only.

## 4. Deviation harvest — the improvement loop

Every miss and every developer revision during the APPROVED cycle becomes a
memory event tagged `[MANIFEST-DEVIATION]` (sibling of `[CORRECTION]`):

```
[MANIFEST-DEVIATION] ADO-1847: unpredicted DealsModule.ts — in this repo,
a new service always touches the module DI registration.
```

Dream consolidates these into topic memory; the next manifest for similar work
predicts that file. Deviations literally train the predictions — codebase-
specific knowledge accumulating exactly where the memory system was built to
hold it.

## 5. What the score means — and does not

Manifest accuracy measures **predictability**, never correctness. A manifest
can be 100% accurate about which files change and still describe the wrong
change. The critic and AC-traceability checks remain the substance guards.
Documentation must use the word "predictability"; selling file-level accuracy
as correctness is the plausible-manifest trap.

## 6. Graduated autonomy (v-next; criteria fixed now)

When sustained accuracy earns it, what graduates is the SYNCHRONOUS INTERRUPT —
never the artifact, never the floor:
- **Per-category, not global**: thresholds (e.g. precision AND recall ≥ 0.95
  over 3 sprints) apply per feature area / tier. T3 never graduates.
- **Human-flipped**: the system RECOMMENDS graduation with evidence attached;
  a tech lead enables flow-mode, recorded in the deployment doc like any policy.
- **Flow-mode** = ICEA + manifest generated, work proceeds, the package lands
  in the async checkpoint queue for review-after. ICEA still exists, manifest
  still measured, critic still runs, hooks still hold.
- **Auto-reversion**: accuracy below threshold for 2 sprints re-enables the
  interrupt without human attention.
- **Floor-invariant**: hooks and ledgers are deployment constants, not trust
  variables.

## Hard rules

- NEVER block on the manifest in instrumentation mode — it measures, it does
  not gate
- NEVER score a vague row as a match — unmatched-by-design is a miss
- NEVER present file-level accuracy as correctness
- NEVER graduate T3, and never graduate anything without a named human flip
- ALWAYS record both precision and recall — recall alone invites padding
