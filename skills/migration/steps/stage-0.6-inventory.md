# Migration Step — Stage 0.6: Source Behavioral Inventory (human review-gate before rewrite)

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Cross-session resume: `MIGRATE INVENTORY ADO-{ID}`._

**Persona:** [SA] Rafael Mendes — Solution Architect. **Model tier:** `${ICEA_MODEL:-claude-opus-4-8}`.
**Checkpoint:** single source of truth (schema 1.9); on `APPROVE INVENTORY` merge
`stage_gates.inventory_approved = true`, `phase = "Stage 1"`.

---

## Stage 0.6 — Source Behavioral Inventory (human review-gate before rewrite)

Produce a behavioral inventory of the SOURCE that a human reviews and signs off before the target is
built. It is a behavioral discovery — NOT a claimed requirements spec. Depth follows the Stage 0.5
posture: **mechanical port = Light** (feature/endpoint catalog to seed golden-master),
**re-architecture = Medium** (+ business rules & workflows), **rewrite-from-spec = Full** (the design input).

```
Read $PLUGIN_DIR/skills/migration/references/specs/source-inventory-spec.md
```

**Preconditions — fresh source graph (posture-scoped).** The scope manifest, coverage denominator,
and decomposition units all derive from the SOURCE knowledge graph, so:
- **rewrite-from-spec → HARD prerequisite:** a fresh source graph is required. "Fresh" = present at
  `{SOURCE_PATH}/.claude/graph/graph.json`, not `.stale`, and its fingerprint baseline matches the
  source baseline SHA recorded below. Absent/stale → STOP; instruct: run `/graph-sync` in
  `{SOURCE_PATH}` first (on a never-initialised source this is initial graph *creation*, which needs
  the graph scaffolding). Do NOT fall back to directory-structure mode for this posture.
- **re-architecture → recommended:** warn if absent/stale, allow override to heuristic mode.
- **mechanical port → optional:** directory-structure derivation is acceptable (light catalog).

**Scope manifest + baseline (no re-scan).** Build a machine-readable scope manifest from the Step 0.1
analysis — reuse `source_module_count` / `source_file_count` from the checkpoint and the graph
`{modules, hubs, names}`, and add behaviour-bearing node counts (routes/controllers/services/handlers,
per `stacks/{stack}.md`). This one manifest feeds three consumers: the context-budget signal, the
absolute-scope gate, and the §3 coverage denominator. Record the source baseline
`git -C {SOURCE_PATH} rev-parse HEAD` (or a timestamp if not a git repo) in the doc header.

**Two independent scope checks — different axes, run BOTH:**
1. **Context-budget check** (shared `context-budget-check.md`) — *session-depth* risk; reuse Step 0.1
   counts, do NOT re-scan.
2. **Absolute-scope gate** (Stage-0.6-specific — NOT the budget check) — *source size vs. single-pass
   read capacity*, evaluated even in a fresh session. The gate trips (→ decompose) if **ANY** of these
   measured signals exceed threshold — cluster count is not the only knob, because 6 *huge* modules
   would otherwise slip through as "small":
   - `source_module_count` > **6** clusters, OR
   - `source_file_count` > **60** behaviour-bearing source files, OR
   - the manifest's behaviour-bearing node count (routes/controllers/services/handlers) > **80**, OR
   - the largest single cluster's file count alone would not fit a single honest read pass.

   When the gate trips, the **index + one file per cluster layout is MANDATORY** — not a judgement
   call. (Thresholds are heuristics tuned to keep one pass within a fresh context's read budget; when
   any measured signal is borderline, decompose — the lower-risk choice.) Decomposition unit = graph
   module / bounded context (the unit Stage 3.1 uses); decompose along bounded contexts / vertical
   slices, never
   horizontal layers.

**Decomposition — orchestrator + per-cluster sub-agents (when the absolute-scope gate trips).**
Context isolation is the root fix for exhaustion-driven confabulation, so a large inventory is NOT
extracted in one accumulating context. Mirror the Stage 4 cluster model:
- **Small scope (gate not tripped):** extract in the main context, single file — unchanged.
- **Large scope (gate tripped):** the ORCHESTRATOR spawns one sub-agent per cluster. Each sub-agent
  receives ONLY its cluster's source file list (the graph module assignment) and returns a STRUCTURED
  fragment — §5 feature rows + §6 rules, each carrying a confidence tier, a `PROV:` token, and (for
  INFERRED / high-risk) Given/When/Then with verbatim outcomes. A fresh context per cluster = full
  read budget per cluster, so each agent can actually read the lines it cites.
- **Orchestrator owns everything cross-cutting** — §1 roll-ups, §4 actor map, §7 cross-cluster entity
  relationships, §8 integrations, §9 auth/authz, and the consolidated §11 — which a slice-scoped agent
  cannot see. It also assigns the global `F-NN` IDs post-collection (parallel agents must NOT
  self-assign — collision) and runs a stitch pass for features that span clusters.
- **Per-fragment trace-verify-before-merge:** run
  `$PLUGIN_DIR/tests/migration-validation/verify-inventory-trace.cjs` on each returned fragment
  against that cluster's assigned file set BEFORE merging it into the index (the script ships with
  the plugin — it is NOT in the TARGET repo, so it MUST be invoked via the resolved `$PLUGIN_DIR`,
  never a bare relative path; a bare path resolves against the target CWD and fails file-not-found)
  (mirrors Stage 4's
  build/test-before-merge). A fragment with a missing-file / out-of-range PROV token is rejected back
  to its agent, not merged. Isolation removes the exhaustion vector; the verifier removes the
  wrong-citation vector.

**No silent caps + coverage reconciliation (mandatory, before the gate).** The manifest is the
denominator; §5 is the numerator. After extraction and before presenting the Stage 0.6 gate, the
orchestrator MUST reconcile them explicitly: enumerate every manifest entity — each behaviour-bearing
node (route/controller/service/handler) and each data entity — and confirm it maps to at least one
§5 feature-ID. Any manifest item with **zero** §5 coverage is either (a) inventoried, or (b) recorded
in §3 as a named skipped cluster AND logged as a §11 GAP (`type: coverage-gap`) — never dropped
silently. §1/§3 then state the true `covered / total` counts from this reconciliation, not an
estimate. If budget forced a subset, inventory the top-N clusters by importance and list every
un-inventoried cluster in §3 — so any un-inventoried cluster is a reconciled, visible gap. (This is
a deterministic-in-principle check: the per-fragment trace verifier flags dangling feature-IDs, but
the manifest-vs-§5 reconciliation is the orchestrator's responsibility because only it holds the
consolidated manifest.)

Write the inventory per the spec (planning doc — no Write Gate). **Output layout by scope:** a
small/module inventory is one file `docs/.../ADO-{ADO_ID}-source-inventory.md`; a large/whole-app
inventory is an **index + one file per cluster** (`…-source-inventory-{cluster}.md`) per the spec's
Output Organization, so the review stays tractable one cluster at a time. Every
item carries a confidence tier (OBSERVED / STATIC / INFERRED) + a machine-readable `PROV:` provenance
token (spec § Machine-readable provenance token); INFERRED is
never presented as a confirmed requirement. Mask PII values (names/shapes only). Populate §10
(Cannot Be Derived — stakeholder questions) honestly; never fabricate NFRs / rationale / priorities.
Log any code you saw but could not resolve statically to the **Gaps Report (§11)** (with `file:line`
+ how to resolve it) — never as a guessed behaviour. Express INFERRED / high-risk behaviours as
Given/When/Then with outcomes quoted **verbatim** (exact status codes / error strings / thresholds),
and cover error/edge paths, not just the happy path.

**Framework-fact self-learning.** When tiering a declarative outcome STATIC required web-grounding a
framework attribute's guaranteed behaviour (spec Tier cut-line, step 2), the ORCHESTRATOR writes a
`Framework-fact` entry to the repo-root `memory/MEMORY.md` — `attribute · framework@version ·
guaranteed outcome · official-doc URL · date` — so `/dream` can propose promoting it into the
`stacks/{stack}.md` LEARNED block for reuse by later runs. **No official-doc URL → do not write it**
(it stays a per-run INFERRED). Reuse a grounded fact within the same run without re-searching. Never
write to `stacks/*.md` directly from a migration run — promotion is `/dream`'s job (the review gate).

### Stage 0.6 Gate
Present the gate banner from the spec and STOP. The reviewer dispositions the **Review Focus** set
(all INFERRED business rules, all high-risk/high-impact features, all §10 stakeholder questions, and
all open Gaps Report items) in the document, then replies `APPROVE INVENTORY ADO-{ADO_ID}`.

- **rewrite-from-spec:** approval is REQUIRED and BLOCKS Stage 1 — the architecture is designed FROM
  the approved inventory.
- **re-architecture:** approval recommended; the inventory is the behavior-preservation contract.
- **mechanical port:** optional/light — informs feasibility and seeds golden-master; does not block
  (may proceed to Stage 1 without `APPROVE INVENTORY`).

On `APPROVE INVENTORY ADO-{ADO_ID}`: update the checkpoint (merge) with
`stage_gates.inventory_approved = true` and `phase = "Stage 1"`.

---

