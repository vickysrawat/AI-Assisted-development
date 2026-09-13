# Shared Skill: Document Orchestrator

_Execution engine for parallel document authoring and revision. Manages wave scheduling, subagent
spawning, shared state distribution, and output collection. Invoked by
[`design-revision-spec.md`](design-revision-spec.md) for both initial
authoring and revision waves. **Reusable** — any skill requiring parallel multi-document generation
may invoke this._

---

## Inputs

```json
{
  "mode": "initial | revision",
  "documents": ["target-component-architecture", "target-security-architecture", ...],
  "dependency_graph": {
    "target-security-architecture": ["target-integration-architecture", "target-component-architecture"],
    "target-deployment-architecture": ["target-infrastructure-architecture"],
    "target-data-architecture": [],
    "migration-feasibility": ["target-component-architecture", "target-data-architecture",
                              "target-security-architecture", "target-integration-architecture",
                              "target-infrastructure-architecture", "target-deployment-architecture"]
  },
  "shared_state": {
    "integration_inventory": "<path to integration-inventory.md>",
    "selected_option": { "stack": "...", "compute": "...", "orm": "...", ... },
    "source_knowledge_graph": "<path>"
  },
  "revision_context": {
    "affected_sections": { "document-name": ["§2", "§4"], ... },
    "stale_scan_scope": { "document-name": ["§3", "§5"], ... },
    "change_description": "..."
  }
}
```

`dependency_graph` is **always required** — the orchestrator is graph-agnostic and never hardcodes
a schedule. The caller (controller for initial authoring; feedback skill for revisions) passes the
relevant graph. The authoritative graph definition lives in `document-feedback.md` — callers read
it from there; they do not re-define it independently.

`revision_context` is only present when `mode = revision`. For `mode = initial`, all documents in
`documents` are authored from their template.

---

## Wave scheduling

The orchestrator computes the wave schedule from the `dependency_graph` input using a topological
sort — it does NOT hardcode any schedule. Documents with no unsatisfied dependencies run in the
first available wave; documents whose dependencies are all satisfied by a completed wave run in the
next wave. This applies equally to initial authoring (full graph) and revision (subset graph).

**Algorithm:**
1. From `documents` list and `dependency_graph`, compute the set of in-scope edges
2. Topological sort → wave groups (documents with equal depth run in parallel)
3. Execute wave by wave; each wave's outputs are passed as inputs to the next wave's agents

**Example — full set (Rewrite/Replatform), derived automatically:**
```
Wave 1 — parallel: component-arch, data-arch, infrastructure-arch, deployment-arch
Wave 2 — parallel: security-arch, integration-arch  (depend on Wave 1 outputs)
Wave 3 — sequential: migration-feasibility          (depends on all Wave 1+2)
```

**Revision waves:** only the documents in `revision_context.affected_sections` are included.
The graph subset is already computed by the feedback skill and passed in `dependency_graph`.
Unaffected documents are never spawned.

---

## Subagent inputs — what each agent receives

Each subagent receives ONLY what it needs for its document. The orchestrator is responsible for
slicing the shared state appropriately — no agent receives the full context.

| Document | Agent receives |
|---|---|
| `target-component-architecture` | Source knowledge graph · DAG clusters · selected option · integration inventory (inline decisions) |
| `target-data-architecture` | Source data layer analysis · ORM/access decision from option · integration inventory (DB integrations) |
| `target-infrastructure-architecture` | Cloud target + compute choice · integration inventory (managed service candidates) · NFR spec (Replatform) |
| `target-deployment-architecture` | Infrastructure arch output · CI/CD platform from intake · IaC flavor from intake |
| `target-security-architecture` | Integration inventory (auth per integration) · component arch output · identity decisions from option |
| `target-integration-architecture` | Integration inventory (full — this is the primary input) · component arch output |
| `migration-feasibility` | All Wave 1 + Wave 2 outputs · integration inventory · dependency ledger |

For **revision agents**, additionally provide:
- The current document (to revise from, not from scratch)
- The affected sections list (`revision_context.affected_sections[document-name]`)
- The stale scan scope (`revision_context.stale_scan_scope[document-name]`)
- The change description

---

## Subagent instructions

**Initial authoring agent:**
```
Author {document-name} following the template in target-design-spec.md.
Use only the provided inputs — do not derive information beyond what is given.
Every required section must be complete (not a stub).
Where information is genuinely unavailable, use an Open Question (`- [ ] ...`) rather than assuming.
Return the complete document content.
```

**Revision agent — Pass 1 (targeted section re-authoring):**
```
You are revising {document-name}. The current document is provided.
Re-author ONLY the sections listed in affected_sections: {list}.
Apply the change described: {change_description}.
Preserve all other sections exactly — including any developer annotations.
Return: { revised_sections: { "§N": "new content" } }
```

**Revision agent — Pass 2 (stale reference scan):**
```
Read the UNTOUCHED sections of {document-name}: {stale_scan_scope}.
The following elements changed in this revision: {changed_elements}.
Identify any sentence or paragraph in the untouched sections that references a changed element
and may now be contextually wrong.
Return: { stale_flags: [{ section: "§N", text: "...", reason: "references {element} which changed to {new_state}" }] }
Do NOT modify any content — only identify and flag.
```

Both passes run within the same subagent invocation. Pass 1 result and Pass 2 result are returned
together.

---

## Output collection

After all agents in a wave complete, the orchestrator:
1. Collects `{ revised_sections }` from each agent — merges into the document set
2. Collects `{ stale_flags }` from each agent — consolidates into a single stale flag list
3. Runs the four-layer validation (per `document-feedback.md`) on the revised/authored sections
4. **If any agent fails OR validation fails for any document: the entire wave fails.**
   Return a wave failure result immediately — do not attempt partial completion or agent-level retry.
   The controller receives the failure, records it in the migration log, and surfaces it to the
   developer. There is no repair agent; a failed wave is a failed wave.
5. If all agents succeed and all documents pass validation: return to the caller:

```json
{
  "document_set": { "document-name": "full updated content", ... },
  "stale_flags": [{ "document": "...", "section": "§N", "text": "...", "reason": "..." }],
  "consistency_violations": [{ "check": "...", "doc_a": "...", "section_a": "...",
                               "doc_b": "...", "section_b": "...", "contradiction": "..." }],
  "validation_results": {
    "document-name": {
      "passed": true,
      "layers": { "structural": true, "content": true, "preservation": true }
    }
  },
  "wave_failed": false
}
```

**Log entries are written by the controller — not the orchestrator.** The orchestrator returns
`validation_results` as structured data so the controller has the full picture when it writes the
`[REVISION]` or `[FINDING]` log entry. The orchestrator never writes to the migration log directly.

---

## Layer 4 — Cross-document consistency (orchestrator responsibility)

After all waves complete and Layers 1–3 pass for every document, the orchestrator spawns a single
**consistency agent**. This agent receives ONLY the sliced sections that participate in each
consistency check — not full documents — to manage context budget:

| Consistency check | Sections passed to agent |
|---|---|
| Component inventory vs integration inline decisions | component-arch §2 + integration-arch §1 |
| Auth schemes alignment | security-arch §2 + integration-arch §1 (auth column only) |
| Infrastructure services vs managed identity | infrastructure-arch §4/§5 + security-arch §4 |
| Risk ratings alignment | feasibility §6 + integration-arch §1 (risk column) + data-arch §5 |

**Consistency agent instructions:**
```
You are checking cross-document consistency. Read the provided document sections.
For each consistency check listed, identify any contradiction between the two documents.
Return: { violations: [{ check: "...", doc_a: "...", section_a: "...", doc_b: "...",
                         section_b: "...", contradiction: "..." }] }
Do NOT modify any content — only identify contradictions.
```

**If violations are found:** add to the wave result as `consistency_violations`. The controller
presents them to the developer as conflicts requiring a decision — not auto-resolved.

**If the consistency agent itself fails:** fail the whole wave (same rule as revision agent failure).

---

## Deterministic text replacement

When the developer confirms corrections to stale flags (update/delete responses), the orchestrator
applies them directly — no subagent, no LLM:

- **Update:** replace the flagged text with the developer's exact replacement
- **Delete:** remove the flagged passage
- **Confirm (keep):** no change; record confirmation in the migration log

This is a text operation, not an authoring operation. The developer's words are applied verbatim.

---

## Hard rules

- NEVER hardcode a wave schedule — always compute from the `dependency_graph` input.
- NEVER define or re-derive the dependency graph — read it from the caller; the authoritative
  definition lives in `document-feedback.md`.
- NEVER pass more context to a subagent than it needs for its document.
- NEVER re-author a full document during revision — only affected sections.
- NEVER discard developer-authored content during revision — preserve untouched sections exactly.
- ALWAYS run Pass 1 and Pass 2 within the same revision agent invocation.
- ALWAYS run validation after authoring and after revision — never present an unvalidated document.
- If ANY agent fails OR any document fails validation: FAIL THE WHOLE WAVE. No partial results.
- NEVER write migration log entries — return structured results to the controller which writes them.
- NEVER auto-fix developer reasoning text — flag it and present it for the developer to decide.
- Deterministic text replacements (stale flag resolutions) do NOT increment the iteration counter.
