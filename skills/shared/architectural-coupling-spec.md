# Architectural Coupling Spec — Source Analysis for Migration Options
_Spec version: 1.0 · Last changed: 2026-09-27 · Applies to: rewrite, replatform skills_

This document defines the five coupling pattern types the LLM must identify during Step 1.5
source-context intake, the CouplingPattern schema that records each finding, severity levels,
and the required_cluster_splits derivation rule that enables hard enforcement via
`scripts/coupling-boundary-validate.cjs`.

---

## Purpose

Migration options (Step 2) must reflect the source's actual structural defects — not assumptions.
Without a systematic coupling scan, options are presented as if the source were well-structured:
- A "port" option might ignore that business logic is embedded in stored procedures
- A "re-architecture" option might not call out that WCF must be replaced
- Cluster decomposition in Step 3 might draw boundaries by technical layer instead of coupling seam

The coupling scan bridges source reality to options and cluster design.

---

## Section 1 — The Five Coupling Pattern Types

### 1.1 Domain coupling
Business logic spread across the wrong layers — controller, DAL, or stored procedure — with
no distinct domain layer. Migration must either carry the coupling (port option) or extract a
domain layer (re-architecture option). Domain coupling directly affects cluster design: two
modules sharing domain logic may need to be in the same cluster (port) or split (re-architecture).

**Detection signals:**
- Business rules (calculations, state transitions, policy enforcement) in controllers or repositories
- Stored procedures containing conditional logic beyond simple data retrieval
- No `Domain/`, `Core/`, or `Business/` layer visible in the module graph
- Fat service classes with both orchestration and domain logic

### 1.2 Technology coupling
Hard dependencies on specific technologies that have no direct equivalent in the target.
Each technology coupling is a migration risk and a target component decision point.
For cloud migrations, technology coupling patterns are the direct input for cloud component
grounding (Sub-problem 2 — see `migration-research-spec.md`).

**Detection signals and examples:**

| Technology | Detection | Migration signal |
|---|---|---|
| WCF / SOAP | `.svc` files, `ServiceContract`, `OperationContract`, `BasicHttpBinding` | Needs messaging or HTTP replacement |
| MSMQ | `MessageQueue`, `System.Messaging` | Needs async message bus replacement |
| Windows Auth / NTLM | `WindowsAuthentication`, `IWindowsIdentity`, `HttpContext.User.IsInRole` with AD | Needs identity provider replacement |
| COM+ / DCOM | `ComVisible`, `ProgId`, `Marshal.GetActiveObject` | Needs refactor before migration |
| ASP.NET Web Forms | `.aspx`, `Page_Load`, `CodeBehind` | Not portable to .NET 8 without full rewrite |
| HttpContext (static) | `HttpContext.Current` in non-controller code | Thread-safety and migration risk |
| Direct SQL / inline SQL | `SqlCommand` with string-built SQL in service or repository | Data coupling indicator + security risk |
| EF Code First migrations | `DbContext`, `Migration` classes | Affects data migration strategy |
| Java EE / Jakarta EE | `@EJB`, `@Stateful`, `@Stateless`, `@MessageDriven` | Container coupling, needs re-architecture |

### 1.3 Data coupling
Multiple layers or services sharing direct database access, business logic in SQL, or
tightly coupled schema that cannot be migrated independently.

**Detection signals:**
- Multiple service classes calling the same table directly
- Stored procedures with complex logic used by multiple callers
- No ORM or data access abstraction boundary
- Cross-service joins (one service's query spans tables owned by another domain)
- Schema migration scripts that contain default data or business rules

### 1.4 Deployment coupling
All components deployed as one unit when the migration target requires or could benefit
from separation. Directly affects cluster decomposition — this is the coupling type whose
`severity=critical` entries become `required_cluster_splits`.

**Detection signals:**
- Single deployable (one project / one .war / one executable) containing multiple distinct domains
- Shared in-process state between components that will become separate clusters in the target
- Startup/shutdown order dependencies between logically separate components
- Single database serving multiple distinct business domains with no schema boundary

### 1.5 Integration coupling
External service calls without abstraction — hardcoded endpoints, synchronous tight coupling,
no retry/resilience, no abstraction layer between the business logic and the integration point.

**Detection signals:**
- Direct `HttpClient` calls to external URLs from service or controller classes
- Hardcoded base URLs (not in config)
- No interface or abstraction between caller and external service
- Synchronous calls to services that could be async
- Undocumented integration contracts (no WSDL, no OpenAPI spec, no integration inventory row)

---

## Section 2 — CouplingPattern Schema

Each finding from the coupling scan is recorded as a CouplingPattern entry.
`resolution_approach` and `external_dependencies` are populated by the Coupling Resolution Gate
(Section 7) AFTER the scan — not during the scan itself.

```json
{
  "id": "CP-1",
  "pattern_type": "domain | technology | data | deployment | integration",
  "severity": "critical | major | minor",
  "name": "<short name — e.g. 'Business logic in stored procedures'>",
  "concerns": ["<concern-a>", "<concern-b>"],
  "technology": "<for technology coupling only — the specific technology, e.g. 'WCF'>",
  "locations": ["<source file path>", "<source file path>"],
  "description": "<what the coupling is and why it creates migration risk>",
  "migration_signal": "<what the target design must do — technology-neutral; cloud component specifics come from research agent at Step 2>",
  "affects_options": true,

  "resolution_approach": "replace | facade | retain | defer | null",
  "external_dependencies": [
    {
      "system_name": "<name of the external system — e.g. 'System A (DealManagement)'>",
      "migration_status": "in_scope | out_of_scope | unknown"
    }
  ],
  "facade_note": "<for facade only — describes the coexistence pattern: what stays WCF, what moves internally, who is served by the facade>"
}
```

`resolution_approach` values:
| Value | Meaning |
|---|---|
| `replace` | Coupling fully removed in the target — all callers migrated as part of this project |
| `facade` | External interface kept; internals modernised — callers served by a facade adapter indefinitely |
| `retain` | Coupling unchanged in the target — out of scope for this migration |
| `defer` | Replacement planned but not in this iteration — technical debt carried forward |
| `null` | Not yet decided — populated by the Coupling Resolution Gate |

`external_dependencies` is required for `facade` approach — names every system the facade must serve
and its migration status. Required fields: `system_name` (non-empty), `migration_status` (enum).
`coupling-resolution-validate.cjs` enforces these constraints before the gate is set.

**`concerns[]` field — required for `severity=critical` deployment coupling:**
Abstract names (e.g., `"business-logic"`, `"data-access"`, `"auth"`) that BOTH the coupling
analysis AND the target cluster naming must use. These names enable `coupling-boundary-validate.cjs`
to verify the split was respected in `cluster-spec.json`.

**Naming convention — critical for hard enforcement:**
Concerns must be named using lowercase hyphen-separated words. Cluster names in `cluster-spec.json`
must use the same vocabulary. `"business-logic"` and `"Business Logic"` both normalise to
`"business-logic"` — consistent naming prevents UNMAPPED errors.

---

## Section 3 — Severity Levels

| Level | Definition | Options impact | Cluster impact |
|---|---|---|---|
| `critical` | Cannot proceed with the migration in a given option without explicitly addressing this pattern. A port option that ignores it will produce a broken migration. | Must appear in the "Coupling addressed" row of every option | `deployment` coupling generates `required_cluster_splits` entry |
| `major` | Significantly constrains the option or increases effort/risk. Options must acknowledge it. | Should appear in option tradeoffs section | Informs cluster design; not a hard enforcement constraint |
| `minor` | Informational — affects effort estimate but does not block any option. | May appear in option notes | No cluster impact |

---

## Section 4 — required_cluster_splits Derivation Rule

After the coupling scan, derive `required_cluster_splits` by extracting all CouplingPattern
entries where `pattern_type="deployment"` AND `severity="critical"`:

```json
"required_cluster_splits": [
  {
    "concern_a": "<concerns[0] from the coupling pattern>",
    "concern_b": "<concerns[1] from the coupling pattern>",
    "source": "<coupling pattern name — e.g. 'Business logic in stored procedures'>"
  }
]
```

Store this in the checkpoint payload under `payload.rewrite.required_cluster_splits`.
`coupling-boundary-validate.cjs` reads this field at Step 3 post-decompose to enforce
that each concern pair is in a different cluster.

**If `concerns[]` is empty on a critical deployment coupling:** the analyst must name the
two concerns before recording. An unnamed critical deployment coupling cannot be enforced.
Block Step 1.5 completion until all critical deployment couplings have named concerns.

---

## Section 5 — Output Summary Format

After the coupling scan, write findings to the manifest's `## Coupling Patterns` section
(see `source-context-manifest-template.md`). Write a summary log entry:

```
[COUPLING-SCAN] {N} coupling patterns found: {critical_count} critical, {major_count} major,
{minor_count} minor. Required cluster splits: {split_count}. Technology couplings: [{list}].
```

The technology couplings list (`["WCF", "MSMQ"]`) feeds the research agent's `technology_couplings[]`
input at Step 2 — enabling cloud component grounding without re-scanning the source.

---

## Section 6 — options_judge_correction Payload

When the options judge returns REVISE on coupling-related findings, the skill records the
pending corrections in the checkpoint before showing the correction interface. This makes
the correction loop resumable if context exhausts mid-correction.

```json
"options_judge_correction": {
  "at": "<YYYY-MM-DD>",
  "pending": [
    { "cp_id": "CP-2", "type": "hallucination", "action": "rerun-coupling-gate", "status": "pending" },
    { "cp_id": "CP-5", "type": "incomplete",    "action": "in-place-correct",    "status": "pending" },
    { "cp_id": "CP-7", "type": "missing-coverage", "action": "in-place-correct", "status": "pending" }
  ],
  "completed": [],
  "iteration": 1
}
```

Finding types:
- `hallucination` — evidence in the options document contradicts source documents (integration inventory, coupling scan). Requires `RERUN-COUPLING-GATE CP-{N}` to go back and correct from source.
- `incomplete` — substantiation is present but lacks specific evidence. Correctable in-place with `OPTIONS-CORRECT CP-{N}`.
- `missing-coverage` — coupling not addressed in one or more options. Correctable in-place.

`iteration` tracks how many times the judge has returned REVISE. Capped at 3 — on iteration 4,
developer acknowledgement is required before re-running.

Cleared (set to null) after the judge returns PASS. Never cleared by the LLM without judge confirmation.

---

## Section 7 — Coupling Resolution Gate Format

The Coupling Resolution Gate is presented after the coupling scan completes. It gathers
constraints from the developer — NOT asks them to choose an approach. The options analysis
(Step 2) derives viable approaches per option from these constraints.

For each `severity=critical` or `severity=major` coupling, show this format:

```
CP-{N} — {name} ({pattern_type}, {severity})
Found in: {locations}

What this coupling is:
  {plain-language description of what was found in the source}

External consumers detected (from integration inventory):
  - {System name} — {VERIFIED|PARTIAL|UNKNOWN}, {in/out of migrationRoots}
  (If none detected: "None identified in integration inventory — internal coupling only")

Approaches evaluated:

  ❌ {approach} — rejected based on {evidence source}
     {Why this approach is not viable for this coupling, citing specific evidence.
      Must name: the source that informed the rejection (integration inventory row N,
      module graph finding, migrationRoots scope). Generic reasons like "not viable"
      or "too complex" are NOT acceptable — they will be flagged as INCOMPLETE by the
      options judge.}

  ✅ {approach} — recommended
     {Why this approach is recommended, citing the same evidence sources.}
     Tradeoff: {what the developer accepts by choosing this approach}
     Open question: {any information still needed — e.g. migration timeline for a consumer}

  ⚠ {approach} — available if recommended is not suitable
     {Conditions under which this alternative makes sense.}
     Risk: {consequence of choosing this approach}

To confirm or provide constraints, reply per coupling:
  CP-{N} {approach} [consumer names and migration timeline if facade]
  or: OVERRIDE CP-{N} {approach} [reason — overrides the recommendation]
  or: RERUN-COUPLING-GATE CP-{N} [if you have new information that changes the analysis]

After all couplings confirmed: type COUPLING-GATE-CONFIRMED
```

**Rules for the gate:**
- Show ALL approaches evaluated for each coupling — never only the recommended one.
- Rejected approaches must cite SPECIFIC evidence — the options judge will flag generic reasons.
- The gate cannot be bypassed: `coupling_resolution_confirmed` gate requires developer input.
- If the developer types `COUPLING-GATE-CONFIRMED` before all critical/major couplings are addressed, re-present the unanswered couplings.
- For `facade`: the developer must name which consumers stay on the legacy protocol. Record in `external_dependencies[]`.
- Write a `decision_log` entry for each coupling decision before closing the gate.

---

## Section 8 — Coupling Scan + Resolution Gate Sequence in Step 1.5

1. Complete existing manifest sections per `source-context-intake-spec.md`.
2. Read the full source module graph and cross-cutting concern scan from the manifest.
3. For each coupling type (1.1–1.5): scan source files for detection signals.
4. Record each finding as a CouplingPattern entry with `resolution_approach: null` (not yet decided).
5. Assign severity using Section 3 definitions.
6. For every `severity=critical` + `pattern_type=deployment` entry: populate `concerns[]`.
7. Cross-reference each technology coupling against the integration inventory:
   - Identify external consumers (VERIFIED/PARTIAL rows not in migrationRoots)
   - Propose `resolution_approach` per coupling based on evidence
8. **STOP — present the Coupling Resolution Gate** (Section 7) for every critical/major coupling.
   Wait for `COUPLING-GATE-CONFIRMED` with structured developer replies.
9. Parse replies — set `resolution_approach`, `external_dependencies`, `facade_note` per coupling.
10. Write a `decision_log` entry per coupling decision.
11. For `resolution_approach=replace|facade` deployment couplings: derive `required_cluster_splits`.
    Facade coupling also generates: `{ concern_a: "{technology}-facade", concern_b: "{internal-replacement}" }`.
12. Store coupling patterns + required_cluster_splits + technology_couplings in checkpoint payload.
13. Run `coupling-resolution-validate.cjs` — must exit 0 before the next step.
14. Set `coupling_resolution_confirmed` gate in checkpoint.
15. Write the `[COUPLING-SCAN]` summary log entry to `migration-log.md`.
