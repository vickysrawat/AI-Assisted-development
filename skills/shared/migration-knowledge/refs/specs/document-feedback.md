# Shared Skill: Document Feedback

_Feedback logic for the design document revision cycle. Owns: dependency graph derivation rules,
change cascade detection, stale reference scan rules, three-layer document validation, and
convergence rules. Layer 4 (cross-document consistency) is the orchestrator's responsibility.
Option change handling is designed separately — see pending item in session log.
Invoked by [`design-revision-spec.md`](design-revision-spec.md) when a developer makes a change
during design review._

---

## Dependency graph — derivation rules

The dependency graph is **derived at runtime** by [`document-graph-derive.md`](document-graph-derive.md)
— it is not hand-authored here. This skill holds the **rules** for how the graph is derived; the
graph itself is an output of running those rules against `target-design-spec.md`.

**Derivation rules (how `document-graph-derive.md` reads the templates):**

For each document template in `target-design-spec.md`, read the "LLM derives from" and
"Required sections" content. Identify every reference to another design document as an input.
An input reference creates a directed dependency edge: the referenced document → this document.

| Template input phrase | Dependency edge created |
|---|---|
| "reads from the Integration Inventory" | Integration Inventory → this document |
| "component arch output" | target-component-architecture → this document |
| "integration inventory (auth per integration)" | Integration Inventory → this document |
| "infrastructure arch output" | target-infrastructure-architecture → this document |
| "All Wave 1 + Wave 2 outputs" | all documents → migration-feasibility |

`document-graph-derive.md` runs at the start of the design phase in each migration family skill,
producing `{ dependency_graph }` in the format the orchestrator expects. The graph is always fresh —
if a template changes or a new document is added, the next migration automatically picks it up.

**This skill uses the derived graph — it never defines it.** The controller reads the derived graph
from `document-graph-derive.md`'s output and passes it to both this skill and the orchestrator.

---

## Change cascade detection

Given a developer's change event, the skill identifies which documents are affected:

1. **Identify the source of the change** — which element changed:
   - Integration decision (e.g. DealDataSvc: inline → external)
   - Infrastructure choice (e.g. App Service → Container Apps)
   - Component added or removed
   - Auth strategy changed
   - Data access pattern changed

2. **Walk the derived dependency graph** — collect all documents reachable from the changed element

3. **Identify `revision_scope` per document** — the specific sections that reference the changed
   element. Uses the section-to-element mapping derived from the templates:

| Element type | Sections in `revision_scope` |
|---|---|
| Integration decision (inline/external) | component-arch §2, integration-arch §1+diagram, security-arch §1/§4, feasibility §6 |
| Compute choice | infrastructure-arch §2+diagram, deployment-arch §1/§2, security-arch §4 |
| Auth strategy | security-arch §1/§2, integration-arch (per-integration auth), component-arch §4 |
| ORM/data access | data-arch §2/§3, component-arch §4, feasibility §5 |
| Component added/removed | component-arch §2/diagram, data-arch §2, security-arch §2 |

4. **Identify `scan_scope`** — sections in documents NOT directly affected that may reference the
   changed element (stale reference candidates)

5. **Return to orchestrator:**
```json
{
  "revision_scope": [
    { "document": "target-component-architecture", "sections": ["§2", "§4"] },
    { "document": "target-integration-architecture", "sections": ["§1", "diagram"] }
  ],
  "scan_scope": [
    { "document": "target-security-architecture", "sections": ["§3"] }
  ]
}
```

> **Option change handling is a separate design** — not covered here. An option change is
> categorically different: it may invalidate the entire design and requires dedicated logic
> including returning to APPROVE OPTIONS. See pending item in session log.

---

## Stale reference scan

Runs as Pass 2 within each revision subagent (via `document-orchestrator.md`). Scans sections
listed in `scan_scope`.

**What constitutes a stale reference:**
- Names a component, integration, service, or pattern that changed in this revision cycle
- Contains a decision rationale that references the changed element
- Contains an assertion contradicted by the change (e.g. "DealDataSvc provides the repository
  layer" when DealDataSvc is now external)

**What NOT to flag:**
- Historical context ("we initially considered inline but changed to external") — valid context
- Generic references to the element type ("WCF services require NTLM auth") — not element-specific

**Flag format:**
```json
{
  "document": "target-component-architecture",
  "section": "§4",
  "text": "The DealDataSvc library provides the repository pattern for the Deals domain",
  "reason": "DealDataSvc changed from 'inline as project' to 'keep external'",
  "change_that_triggered_flag": "integration-decision:DealDataSvc"
}
```

**Developer resolution:** confirm (keep as context) · update (provide replacement text) · delete.
The orchestrator applies updates/deletes deterministically — no LLM, no reinterpretation.

---

## Three-layer document validation

Runs after every authoring/revision pass (Layers 1–3). **Layer 4 (cross-document consistency)
is the orchestrator's responsibility** — it runs after the full wave completes using a dedicated
consistency agent with sliced document sections to manage context budget.

### Layer 1 — Structural completeness (deterministic)
Check every required section heading is present per the `target-design-spec.md` template.
Missing heading → validation fails; flag the specific missing section.

### Layer 2 — Content completeness (heuristic + targeted LLM judge)
For each section, check minimum content threshold:
- Fewer than 3 meaningful sentences → flagged as suspect stub
- Run a targeted LLM judge pass ONLY on flagged sections: "Is this section complete or a stub?"
- If judged as a stub → wave fails (per `document-orchestrator.md` D2 rule)

### Layer 3 — Preservation (revision only)
Compare the current document against the pre-revision version:
- Identify any passage that existed before revision and is now absent from an untouched section
- Flag as potential developer annotation loss
- Do NOT auto-restore — flag and present to developer

---

## Convergence rules

**Normal convergence:** all documents have `Status: APPROVED`, no `NEEDS-REVISION` flags.
Return `{ converged: true }` to the controller.

**Iteration tracking:** counter increments each time the developer makes a change that triggers
a revision wave. Deterministic stale-flag resolutions (update/delete) do NOT increment the counter.

**Escalation at iteration 5:**
```json
{
  "escalation_required": true,
  "summary": {
    "iteration_count": 5,
    "changes_per_iteration": [
      { "iteration": 1, "change": "...", "documents_revised": [...] }
    ],
    "current_state_per_document": { "document-name": "APPROVED | NEEDS-REVISION | DRAFT" },
    "conflicting_decisions": []
  }
}
```
Developer provides explicit argue + reasoning before next iteration. Reasoning logged as
`[DECISION]`. Iteration counter resets for the new change thread.

**Hard escalation (iteration 10):** return the developer to `APPROVE OPTIONS`.

The evidence accumulated across 10 iterations — which decisions kept reversing, which conflicts
emerged, what could not be stabilised — is presented alongside the options. The developer re-selects
an option with this evidence as context. Since no code has been generated (the design gate has not
closed), no work is lost. There is **no "proceed anyway" path** — a design that cannot converge
in 10 iterations is a signal that the wrong option was selected, not that more iterations will help.

---

## Hard rules

- NEVER define the dependency graph — derive it via `document-graph-derive.md`; use the derived graph.
- NEVER attempt auto-resolution of a consistency failure — present it as a conflict for the developer.
- NEVER run Layer 4 — that is the orchestrator's responsibility (post-wave consistency agent).
- NEVER increment the iteration counter for deterministic stale-flag resolutions.
- NEVER flag historical context as stale — only flag active assertions that are contradicted.
- ALWAYS run Layers 1–3 before presenting a document to the developer.
- At escalation: show ALL changes across ALL iterations — not just the most recent.
- At hard escalation (iteration 10): return to APPROVE OPTIONS — no "proceed anyway" path.
