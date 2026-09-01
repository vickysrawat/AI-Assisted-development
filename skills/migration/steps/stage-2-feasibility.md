# Migration Step — Stage 2: Migration Feasibility Assessment

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Cross-session resume: `MIGRATE FEAS ADO-{ID}`._
_Heavy, non-interactive — the orchestrator dispatches this stage as a subagent (context discarded on return)._

**Persona:** [SA] Rafael Mendes — Solution Architect. **Model tier:** `${REVIEW_MODEL:-claude-sonnet-4-6}`.
**Checkpoint:** single source of truth (schema 1.9); on `APPROVE FEASIBILITY` merge
`stage_gates.feasibility_approved = true`, `phase = "Stage 3"`, set `decision_log.red_items`/`yellow_count`.

---

## Stage 2 — Migration Feasibility Assessment

### Step 2.0 — Context budget check + resume

**Resume path** — if entered via `MIGRATE FEAS ADO-{ADO_ID}`: read the checkpoint. If
`stage_gates.architecture_approved` is not `true`, STOP and tell the developer to run
`MIGRATE ARCH ADO-{ADO_ID}` first (feasibility needs the approved architecture as input). Otherwise
read the 5 approved architecture docs from `docs/.../` and `feasibility-spec.md` from disk — do NOT
re-read the source spec or re-run Stage 0 scans — then proceed to feasibility generation.

**Budget check** — otherwise, measure the accumulated architecture-doc size and run the shared check:

```bash
FEAS_SIGNAL=$(cat docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/COMPONENT-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/DATA-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/SECURITY-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/INFRASTRUCTURE-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ARCHITECTURE-DECISIONS.md 2>/dev/null | wc -l)
```

```
Read $PLUGIN_DIR/skills/shared/context-budget-check.md and execute it with:
  operation_name    = "Stage 2 — feasibility assessment"
  size_signal       = {FEAS_SIGNAL}
  size_label        = "Approved architecture: {FEAS_SIGNAL} lines across 5 docs"
  threshold_medium  = 800
  threshold_high    = 2000
  recovery_command  = "MIGRATE FEAS ADO-{ADO_ID}"
  skip_keywords     = ["MIGRATE FEAS ADO-"]
  operation_needs   = ["read 5 approved architecture docs",
                       "run dependency version checks",
                       "generate GREEN/YELLOW/RED/BLOCKER feasibility doc"]
  risks_if_continue = ["under-counted RED items",
                       "missing resolution options on RED items",
                       "GREEN mislabelled without verification"]
  saved_context     = "Approved architecture docs are on disk in docs/...; the Stage 1 gate is recorded in the checkpoint"
```

On `BUDGET_WARN` / `BUDGET_STOP`, stop and wait. On `BUDGET_OK` / `BUDGET_SKIPPED`, proceed.

Load feasibility spec:
```
Read $PLUGIN_DIR/skills/migration/references/specs/feasibility-spec.md
```

Now that the target architecture is approved, assess what it takes to get FROM the source TO that architecture.

If a Stage 0.6 Source Behavioral Inventory exists, drive the assessment from its feature catalog —
map each feature ID to GREEN/YELLOW/RED and record the feature ID against each item — rather than
re-scanning the source. The inventory is the source-behavior lens; this feasibility is the
migration-difficulty lens over the same features.

Write `docs/.../ADO-{ADO_ID}-migration-feasibility.md` (planning doc, no Write Gate).

### Honesty rules
- NEVER classify as GREEN without verification — UNKNOWN is honest, GREEN is a commitment
- Every RED must have at least one resolution option. No path exists = BLOCKER
- "Compiles" ≠ "behaves identically" — call out behavioral risk on every YELLOW and RED
- Dependency verification: run `dotnet list package --outdated` / `mvn versions:display-dependency-updates` / `npm outdated`

### Behavioral risk scale
INFORMATIONAL · MEDIUM · HIGH · BLOCKER
Worst-case rule: component rating = worst sub-item rating.

### Document sections

Use parity tables from loaded stack and mapping reference files:

**1. Executive Summary** — source → approved target, tooling BLOCKERs, GREEN/YELLOW/RED/BLOCKER counts, overall verdict (STRAIGHTFORWARD / MODERATE / HIGH-RISK / has BLOCKERS).

**2. GREEN — Migrates Cleanly** — from mapping file GREEN table (stack-specific).

**3. YELLOW — Needs Rework** — from mapping file YELLOW table.
Each row: Component | What changes | Effort S/M/L | Behavioral risk level.
Include architecture-specific items: "Entra ID setup requires Microsoft.Identity.Web package — M effort, LOW risk."

**4. RED — Will Break** — from mapping file RED table.
Each item: What breaks & why · Options (2–3 with tradeoffs + reversibility) · Recommendation · Behavioral risk level.

**5. Blockers** — no viable resolution under current constraints. Include tooling BLOCKERs.

**6. Dependency Ledger** — every package (NuGet / Maven / npm): Package | Current ver | Target status | Action.

**7. Architecture Alignment** — how each approved architecture decision affects migration effort:
- Auth strategy → specific packages and config patterns required
- Hosting decision → connection string format, health check targets
- Data access → Dapper SQL generation vs EF Core vs JPA migration scope

Load EF6 reference if detected:
```
Read $PLUGIN_DIR/skills/migration/references/shared/ef6-to-efcore.md
```

### Stage 2 Gate
```
FEASIBILITY SUMMARY — ADO-{ADO_ID}
  GREEN: {N} · YELLOW: {N} · RED: {N} · BLOCKERS: {N}
  Verdict: {STRAIGHTFORWARD / MODERATE / HIGH-RISK / has BLOCKERS}

{BLOCKERs must be resolved before proceeding}

Reply APPROVE FEASIBILITY ADO-{ADO_ID} to proceed to cluster planning.
```

On `APPROVE FEASIBILITY ADO-{ADO_ID}`: update the checkpoint (merge) with
`stage_gates.feasibility_approved = true`, `phase = "Stage 3"`, and set `decision_log.red_items`
and `decision_log.yellow_count` from the feasibility document.

---

