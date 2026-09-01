# Migration Step — Stage 1: Design Target Architecture

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Cross-session resume: `MIGRATE ARCH ADO-{ID}`._

**Persona:** [SA] Rafael Mendes — Solution Architect. **Model tier:** `${ICEA_MODEL:-claude-opus-4-8}`.
**Checkpoint:** single source of truth (schema 1.9); on `APPROVE ARCHITECTURE` merge
`stage_gates.architecture_approved = true`, `phase = "Stage 2"`, and populate `decision_log`.

---

## Stage 1 — Design Target Architecture

**Rewrite-from-spec gate:** if the Stage 0.5 posture is rewrite-from-spec, require
`stage_gates.inventory_approved = true` before designing — STOP and point the developer to
`MIGRATE INVENTORY ADO-{ADO_ID}` / `APPROVE INVENTORY ADO-{ADO_ID}` if not. Design the architecture
FROM the approved Source Behavioral Inventory (its feature IDs are the spine). For
port/re-architecture the inventory is input but not a hard gate.

### Step 1.0 — Context budget check + resume

**Resume path** — if this stage was entered via `MIGRATE ARCH ADO-{ADO_ID}` (a fresh session
after `/compact` or a new session): read `.claude/migration-checkpoint.json`, restore the
identifiers + `decision_log` + `mode` from it, load the source/target stack references and
`phase1-architecture-spec.md` from disk, then jump straight to Step 1.2. Do NOT re-run the Stage 0
source-detection scans and do NOT re-read source architecture docs unless a specific document
genuinely needs fresh source detail.

**Budget check** — otherwise, before loading the 500-line spec or generating anything, measure the
source size (reuse the Step 0.1 counts — do NOT re-run `find`) and run the shared check:

```
Read $PLUGIN_DIR/skills/shared/context-budget-check.md and execute it with:
  operation_name    = "Stage 1 — architecture design (5 documents)"
  size_signal       = {source_module_count + source_file_count; heuristic mode = file count only}
  size_label        = "Source: {N} modules / {M} files"
  threshold_medium  = 40
  threshold_high    = 120
  recovery_command  = "MIGRATE ARCH ADO-{ADO_ID}"
  skip_keywords     = ["MIGRATE ARCH ADO-"]
  operation_needs   = ["read source graph + selective source files",
                       "generate 5 architecture docs with Mermaid diagrams + ADRs"]
  risks_if_continue = ["truncated or placeholder Mermaid diagrams",
                       "missing ADR sections",
                       "inconsistent tech-stack decisions across the 5 docs"]
  saved_context     = "Stage 0 decisions are in .claude/migration-checkpoint.json; nothing generated yet"
```

On `BUDGET_WARN` / `BUDGET_STOP`, stop and wait for the developer. On `BUDGET_OK` /
`BUDGET_SKIPPED`, proceed.

Load architecture document specifications:
```
Read $PLUGIN_DIR/skills/migration/references/specs/phase1-architecture-spec.md
```

Stage 1 produces ALL architecture documents in one comprehensive design pass.
Each document is written to `docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/` (planning docs — no Write Gate).

### Step 1.1 — Read source in detail

Read source architecture docs from SOURCE_PATH (already registered in additionalDirectories):
- Read bounded context boundaries from source graph
- Identify key entities, services, and their relationships
- Identify external integrations (database, cache, message queue, auth provider, APIs)
- Identify cross-cutting concerns (logging, auth, error handling)

If source architecture docs exist at `{SOURCE_PATH}/.claude/architecture/`: read them.
If not: derive from source graph + selective source file reads (Consent: A).

If the AI needs a specific decision during source analysis that it cannot infer: stop and ask that one question. Example:
```
I see the source has two separate authentication flows — one for web users and one for API clients.
Should the target maintain both (A), or consolidate to a single auth strategy (B)?
```

### Step 1.2 — Produce target architecture documents

Load architecture document spec:
```
Read $PLUGIN_DIR/skills/migration/references/specs/phase1-architecture-spec.md
```

Generate the following documents. Each one is written as a complete, standalone document.
All diagrams MUST be in Mermaid format — no inline ASCII art, no described diagrams.
Each architectural component MUST have an ADR section.

**ADR format (required for every significant component):**
```markdown
### [Component Name]

**What it does:** [one sentence]

**Recommendation:** [chosen approach]

**Why this approach:**
| Option | Verdict | Reason |
|---|---|---|
| [Option A] | Rejected | [reason] |
| [Option B] | Rejected | [reason] |
| **[Chosen option]** | **Chosen** | [reason — tie to source analysis] |

**Benefits for this migration:**
- [specific benefit grounded in source app's characteristics]
- [second benefit]
```

---

**Document 1: `COMPONENT-ARCHITECTURE.md`**

Sections:
1. System Overview — what the application does; primary actors
2. Technology Stack — final confirmed stack (runtime, framework, database, cache, auth, logging)
3. Component Inventory — table: name | responsibility | layer | source origin (which source cluster)
4. Component Interaction Diagram — Mermaid C4 Level 2:
   ```mermaid
   C4Context / C4Component diagram showing all bounded contexts,
   their connections (sync vs async), and external dependencies
   ```
5. Layer Architecture — pattern chosen (simplified / four-layer), layer map with dependency arrows
6. External Dependencies — IdP, Key Vault, Redis, Service Bus, external APIs
7. ADR per component (above format)

---

**Document 2: `DATA-ARCHITECTURE.md`**

Sections:
1. Data Strategy — data access approach (Dapper / EF Core / JPA) with ADR
2. Entity Map — key domain entities from source, how they map to target
3. Entity Relationship Diagram — Mermaid ER diagram:
   ```mermaid
   erDiagram
     [entities and relationships derived from source analysis]
   ```
4. Data Flow Diagram — Mermaid sequence showing how data moves from API to DB and back
5. PII Inventory — if PII detected in source, list fields requiring protection
6. Schema Migration Approach — how existing DB schema is handled (EF Core baseline / DbUp / Flyway)
7. ADR for data access pattern

---

**Document 3: `SECURITY-ARCHITECTURE.md`**

Sections:
1. Authentication Strategy — provider chosen (derived from source auth pattern + target stack + cloud)
   - If source uses Spring Security JWT: propose .NET bearer with same JWT structure
   - If source uses session auth: propose JWT bearer (stateless is preferred for modern apps)
   - If source uses API keys: propose API key authentication handler
   - Ask developer if the proposed auth doesn't match their intent
2. Authentication Flow Diagram — Mermaid sequence diagram:
   ```mermaid
   sequenceDiagram
     [end-to-end auth flow: client → IdP → API → response]
   ```
3. Authorization Model — roles, claims, policies (derived from source permission patterns)
4. Secrets Management — where secrets live (Key Vault / AWS Secrets Manager / env vars, based on Q2 cloud)
5. Data Protection — encryption at rest (if PII found in source), TLS enforcement
6. ADR for authentication strategy

---

**Document 4: `INFRASTRUCTURE-ARCHITECTURE.md`**

Sections:
1. Environment Map — dev / staging / prod (standard for the cloud chosen in Q2)
2. Hosting Topology Diagram — Mermaid deployment diagram:
   ```mermaid
   graph TB
     [where each component runs: App Service / AKS / on-prem,
      how they connect, what sits in the DMZ]
   ```
3. CI/CD Pipeline Outline — standard pipeline for the target cloud (stages: build → test → deploy)
4. External Service Connections — database, cache, secrets vault, message queue
5. Health Monitoring — health check endpoints, alerting approach
6. ADR for hosting model

---

**Document 5: `ARCHITECTURE-DECISIONS.md`**

Running log of all significant architectural decisions made during this migration.
Populated from ADR sections in docs 1–4 above, plus any additional decisions surfaced during migration.

Format per entry:
```markdown
## ADR-{N}: {Decision title}
Date: {date}
Status: Accepted

### Context
[what drove this decision — source app characteristics, target requirements]

### Decision
[what was decided]

### Options Considered
| Option | Verdict | Reason |
|---|---|---|
| ... | ... | ... |

### Consequences
[what this means for the migration and the resulting app]
```

---

**Write all five documents** in one pass. Use Mermaid for ALL diagrams.
If any diagram cannot be generated without additional information: insert a placeholder
`[DIAGRAM PENDING — {specific question}]` and ask the developer.

### Step 1.3 — Present for review

After writing all documents:
```
ARCHITECTURE DESIGN COMPLETE — ADO-{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Documents written to docs/.../

  ✅ COMPONENT-ARCHITECTURE.md   — {N} components, {N} Mermaid diagrams
  ✅ DATA-ARCHITECTURE.md        — {N} entities, ER diagram
  ✅ SECURITY-ARCHITECTURE.md    — Auth: {proposed strategy}
  ✅ INFRASTRUCTURE-ARCHITECTURE.md — Hosting: {proposed model}
  ✅ ARCHITECTURE-DECISIONS.md   — {N} ADRs

Please review the documents and diagrams.
Mermaid diagrams render in VS Code (Markdown Preview Enhanced) or mermaid.live

Reply APPROVE ARCHITECTURE ADO-{ADO_ID} to proceed to feasibility assessment.
Or request changes: "Revise the auth strategy to use Entra ID instead"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Support revision requests before the gate. Re-generate only the affected document and diagram.
A revision request is a same-session continuation — it does NOT re-run the Step 1.0 budget check.
Only `APPROVE ARCHITECTURE ADO-{ADO_ID}` advances to Stage 2.

On `APPROVE ARCHITECTURE ADO-{ADO_ID}`: update `.claude/migration-checkpoint.json` (merge — keep
existing fields) with `stage_gates.architecture_approved = true`, `phase = "Stage 2"`, and populate
`decision_log.auth` / `data_access` / `architecture` / `cloud` from the approved documents, before
entering Stage 2.

---

