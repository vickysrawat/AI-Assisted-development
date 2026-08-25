# Spec: TARGET-OPTIONS-ANALYSIS.md

_Loaded by migration SKILL.md at Stage 0.5 (after source analysis, before target confirmation).
Defines the decision-support document that recommends a target stack + application model
BEFORE the developer commits to one in Q1. This is what makes the skill a rewrite ADVISOR,
not just a menu._

---

## Purpose

For a rewrite, the highest-value decision is *which* target — stack, app model, and
port-vs-rewrite posture. This document is produced by the Solution Architect persona AFTER
reading the source but BEFORE Q1. It presents 2–3 viable candidates, scores each, and makes
ONE recommendation with an ADR. Q1 then CONFIRMS the recommendation (or overrides it).

Skip this stage only when the source→target is a pure version upgrade (`dotnet` → .NET 10
upgrade) — there is no genuine choice to analyse there.

---

## Execution Instructions for Stage 0.5

Write `docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ADO-{ADO_ID}-target-options.md` (planning
doc — no Write Gate). Base every candidate on the actual source analysis from Step 0.1 (graph
module count, detected data/auth layers, source file count) and the loaded source stack
reference. Do NOT invent candidates the plugin cannot execute — a candidate is only valid if a
migration mapping/stack reference exists (or can be derived from two existing stack references
with an explicit UNKNOWN disclaimer).

**Non-negotiable rules:**
- Present at least TWO candidates (the obvious one + one credible alternative). Three when the
  source genuinely admits three viable targets.
- Every effort/risk rating MUST cite a concrete source characteristic — never an unsupported
  adjective.
- Recommend exactly ONE. If you recommend against the weighted-matrix winner, state the
  override reason explicitly.
- If a candidate has no verified mapping reference, mark its confidence UNKNOWN — do not
  present it as verified.

---

## Document: ADO-{ADO_ID}-target-options.md

### Required Sections

**## 1. Migration Posture**

State and justify one posture per bounded context (may differ across contexts):

| Posture | Meaning | Use when |
|---|---|---|
| Mechanical port | Map source constructs 1:1 to target idioms | Source is well-structured; behaviour must be preserved exactly |
| Re-architecture | Keep behaviour, restructure to target-idiomatic layers | Source has structural debt but sound behaviour |
| Rewrite-from-spec | Re-derive from extracted requirements; source is reference only | Source is unmaintainable, or a paradigm shift (WebForms → SPA) |

A pure port and a rewrite have very different risk/effort — name it explicitly, do not default
silently. The posture drives Stage 5: port/re-architecture anchors behaviour to the source via
golden-master capture; rewrite-from-spec anchors it to the feature-parity inventory (§5).

**## 2. Candidate Targets (2–3)**

For each candidate, a full row. Include at least the "obvious" option and one credible alternative.

| Candidate | App model | Effort | Behavioral risk | Ops complexity | Team fit | Mapping ref | Notes |
|---|---|---|---|---|---|---|---|
| {e.g. .NET 10 Web API + Angular SPA} | 2-track | L | MEDIUM | Medium (App Service + SWA) | High (existing .NET team) | java-dotnet.md + react-angular.md | |
| {e.g. .NET 10 Blazor Server} | single | M | MEDIUM | Low | Medium | java-dotnet.md | No separate FE build |
| {e.g. Java Spring Boot} | single | L | HIGH | Medium | Low | (derived — UNKNOWN) | Only if org standardising on JVM |

Effort scale: S / M / L / XL. Every rating MUST cite a source characteristic (file count,
endpoint count, RED-item count from the mapping, or a detected framework).

**## 3. Decision Matrix (weighted)**

| Criterion | Weight | Candidate A | Candidate B | Candidate C |
|---|---|---|---|---|
| Behavioral preservation | 0.30 | | | |
| Effort / time-to-cutover | 0.25 | | | |
| Long-term maintainability | 0.20 | | | |
| Operational cost | 0.15 | | | |
| Team familiarity | 0.10 | | | |
| **Weighted total** | | | | |

Score each criterion 1–5. Show the arithmetic (score × weight). The recommendation MUST be the
highest weighted total OR include an explicit override reason if the AI recommends against the
numbers. Weights may be re-tuned if the developer states a hard priority in Step 0 — record the
change.

**## 4. Recommendation (ADR)**

Use the standard ADR format (see `phase1-architecture-spec.md`). The "Options Considered" table
maps directly to §2 candidates. Tie the chosen option to the decision matrix and the source
analysis. State the one thing that would change the recommendation (the **decision hinge**).

**## 5. Feature-Parity Inventory (rewrite posture only)**

If posture is rewrite-from-spec for any context, extract the observable behaviours the target
MUST preserve — this becomes the acceptance oracle for Stage 5 golden-master tests:

| Feature | Source location | Observable behaviour | Priority |
|---|---|---|---|
| {e.g. User search} | {UsersController.search} | Returns ≤50 results, ranked by relevance, 400 on empty query | High |

If posture is port/re-architecture: write "Behaviour anchored to source code; see golden-master
capture in Stage 5." and skip the inventory table.

**## 6. Rough Order of Magnitude**

| | Estimate | Basis |
|---|---|---|
| Clusters (from graph) | {N} | graph module count |
| Cutover strategy | {Strangler Fig / big-bang / parallel-run} | posture + endpoint count |
| Rollback plan | {one line} | |

Not a commitment — an ROM to inform the Q1 decision. State the top-3 unknowns that would move it.

---

## Stage 0.5 Gate

```
TARGET OPTIONS ANALYSIS — ADO-{ADO_ID}
  Recommended: {candidate} — {app model} — posture: {port | re-arch | rewrite}
  Runner-up:   {candidate} ({one-line why not})
  Decision hinge: {the one factor that flips the recommendation}
  ROM: {N} clusters · cutover: {strategy}

Reply APPROVE OPTIONS ADO-{ADO_ID} to lock this target,
or name a different candidate (e.g. "go with the Blazor option").
```

Only `APPROVE OPTIONS ADO-{ADO_ID}` (or an explicit override naming another candidate) advances.
On approval: set `stage_gates.options_approved = true` in the checkpoint and pre-fill Q1 with the
recommended target.
