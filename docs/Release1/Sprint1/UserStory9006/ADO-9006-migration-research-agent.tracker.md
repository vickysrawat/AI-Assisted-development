# Tracker — Migration Research Agent + Options Phase PO Framework
ADO #9006 · Type: EPIC · 16 SP total
Branch: feature/ADO-9006-migration-research-agent

## Status Legend

| Status | Meaning |
|---|---|
| Pending | Not yet implemented |
| In Progress | Active implementation |
| Done | Implemented and verified |
| Bug | Bug found — see Follow-ups |
| Blocked | Stopped — see Notes |

## Story Board

| Story | Child ADO # | Logical scope | SP | Status | Notes |
|---|---|---|---|---|---|
| 1 | TBD | migration-research-agent — rewrite/upgrade mode (AC-F1, AC-NF1, AC-NF2, AC-NF3) | 3 | Done | No dependencies |
| 2 | TBD | migration-research-agent — replatform mode (AC-F2) | 3 | Done | |
| 3 | TBD | Shared spec + [SA] persona (AC-F7, AC-F8) | 3 | Done | |
| 4 | TBD | rewrite + upgrade calling skill enrichment (AC-F3 rewrite+upgrade, AC-F4, AC-F5) | 4 | Done | |
| 5 | TBD | replatform calling skill enrichment (AC-F3 replatform, AC-F6) | 3 | Done | |

---

## Story 1 — migration-research-agent: rewrite/upgrade mode
**Status:** Done
**Child ADO:** TBD

### Delivered
- `skills/migration-research-agent/SKILL.md` (NEW) — foundational agent skill with rewrite/upgrade mode
  - Discriminated union input schema (`migration_type: "rewrite" | "upgrade"`)
  - Per-stack lookup strategy table: dotnet, angular, react, java, python, nodejs, azure-hosted (high), aws-hosted (medium-high), gcp-hosted (high via /docs/deprecations), unknown/niche
  - Output schema: per-layer JSON bundle with 5 confidence-annotated fact fields (eol_status, cve_exposure, ecosystem_health, hiring_trend, tooling_availability)
  - UNKNOWN fallback: per-field, canonical_url distinguishes "checked not found" from "not checked"
  - 4-step execution: validate → process layers (sequential WebFetch) → assemble → return
  - Constraints: no codebase access, sanitized queries, single invocation, no MCP

### Tests added
Verified by design (SKILL.md is Markdown executed by Claude — no compiled test harness):
- P-U1: Angular 15 EoL lookup → status="EoL" with angular.dev citation (confidence=high)
- P-U2: .NET 10 lifecycle → status="active" with learn.microsoft.com/lifecycle citation (confidence=high)
- P-U3: aws-hosted nodejs → runtime support with medium-high confidence (no central AWS EoL portal)
- P-U4: All high/medium facts have non-null source_url + retrieved_date (output schema enforces)
- N-U1: Unknown/niche stack → confidence=UNKNOWN, canonical_url=endoflife.date/{stack}, no fabricated fact
- N-U4: UNKNOWN fallback returns immediately, no second Agent tool call spawned

### Follow-ups / bugs fixed
| # | Issue | Fix | Files |
|---|---|---|---|

### Design decisions
- **Discriminated union on `migration_type`:** Single entry point; each mode's fields are structurally distinct. Replatform mode added as Story 2 branch in same file.
- **Sequential WebFetch (not parallel subagents):** Parallel would require chained Agent tool calls, violating AC-NF3. Sequential is simpler, verifiable, and sufficient within one invocation.
- **UNKNOWN uses `canonical_url` not `source_url`:** Explicitly distinguishes "checked and not found" from "found and cited". Prevents calling skills from rendering an unfetched URL as a citation.
- **CVE exposure is qualitative only:** Real-time NVD API excluded (rate-limit risk, ICEA Out of Scope). Qualitative level (high/medium/low) from security update pages is sufficient for migration decision context.

### Known gaps
- `hiring_trend` fact is difficult to ground authoritatively — best-effort WebFetch on Stack Overflow Developer Survey. Often returns UNKNOWN for niche stacks. This is by design (UNKNOWN is correct; fabrication is not).
- `cloud_runtime_support` for aws-hosted is medium-high confidence (no central AWS EoL portal). Documented in constraints and lookup table.

---

## Story 2 — migration-research-agent: replatform mode
**Status:** Done
**Child ADO:** TBD

### Delivered
- `skills/migration-research-agent/SKILL.md` (MODIFIED) — replatform discriminated union branch added
  - Input schema: source_environment + target_environment with cloud/components[]/region
  - Per-provider lookup table: Azure (high all facts), GCP (high via /docs/deprecations; medium-high RSS), AWS (high pricing/SLA/compliance; medium-high lifecycle)
  - Output schema: 5-field per-component bundle (pricing_range, sla_percentage, ga_status, compliance_certifications, egress_cost_signal)
  - Execution steps: 4-step sequential WebFetch per component
  - Constraint updated: "All three migration modes supported" (Story 1 scope note removed)

### Design decisions
- **BigQuery MCP excluded:** DECISION block in per-provider lookup table explains why WebFetch on /docs/deprecations achieves equivalent confidence (high) without any GCP account or IAM.
- **Sequential WebFetch (same as Story 1):** Preserves single-invocation bound. No parallel sub-invocations.
- **compliance_certifications.certs=[] with confidence=low:** Distinguishes "compliance page found, component not listed" from "UNKNOWN" (page not fetchable). Calling skills render these differently.

---

## Story 3 — Shared spec + [SA] persona
**Status:** Done
**Child ADO:** TBD

### Delivered
- `skills/shared/migration-research-spec.md` (NEW) — 6-section canonical contract
  - Section 1: Purpose
  - Section 2: Discriminated union input schema (both modes)
  - Section 3: Per-mode output bundle schema with FactObject definition and UNKNOWN shape
  - Section 4: Confidence rendering table (4 levels) with canonical_url distinction for UNKNOWN
  - Section 5: Calling skill invocation pattern (5 steps, single Agent tool call)
  - Section 6: Per-provider lookup strategy summary + BigQuery MCP exclusion note
- `skills/shared/personas-spec.md` (MODIFIED) — [SA] Rafael Mendes extended with migration specialist context
  - Background: failed rewrites at 60%, tripled cloud costs, upgrade breaking changes in production
  - Lens: 3-year platform fitness, full TCO, failure modes first, pre-mortem instinct
  - Signature questions: "What does this look like half-done?", "stage 3 surprises?", "what stays broken?"
  - Weigh [TL]/[PM] instructions with explicit note that agent facts > persona judgment

### Design decisions
- **Extended existing [SA] entry (not a new ID):** The migration specialist context is [SA] Rafael Mendes acting in migration skill context. Using a new ID would break the existing [SA] references in rewrite/upgrade/replatform SKILL.md. Extension is additive and backwards-compatible.
- **Section 4 canonical_url distinction:** UNKNOWN facts use canonical_url (not source_url=null) so calling skills can render "check here" links without implying a URL was actually fetched.

---

## Story 4 — rewrite + upgrade calling skill enrichment
**Status:** Done
**Child ADO:** TBD

### Delivered
- `skills/rewrite/SKILL.md` (MODIFIED) — Step 2 options phase
  - Agent invocation preamble (before options file write): JSON input construction, Agent tool call, confidence rendering rules
  - PO framework (a)-(d) added to each option block after Summary: what if not resolved, tradeoffs, whether can remain, how to verify — populated from agent bundle where groundable, [project-specific] for internal data
- `skills/upgrade/SKILL.md` (MODIFIED) — Step 4 gap+risk report
  - Agent invocation preamble (before report assembly): JSON input construction, Agent tool call, confidence rendering rules
  - Two PO sections added after feasibility spine bullets: "What happens if not resolved" (EoL + CVE from bundle) + "Whether it can remain" (app-layer changes, team retraining, deps, target ecosystem signal)

### Design decisions
- **Agent preamble before options file write (rewrite):** Agent is invoked before the options analysis is computed so that bundle facts can ground the options table attributes directly.
- **Agent preamble before report assembly (upgrade):** Same pattern — agent grounding precedes the report content so all PO sections reference the bundle.
- **[project-specific] is never a confidence level:** It marks internal-data fields the agent cannot access. Calling skills render these as explicit prompts to the developer, not as agent UNKNOWN facts.

### Known gaps
- `hiring_trend` is best-effort for all stacks — often UNKNOWN for niche/legacy stacks (by design; inherited from Story 1 agent design).

---

## Story 5 — replatform calling skill enrichment
**Status:** Done
**Child ADO:** TBD

### Delivered
- `skills/replatform/SKILL.md` (MODIFIED) — Step R1 options phase
  - Agent invocation preamble added as step 6b (before step 7 options presentation): JSON input construction for replatform mode, Agent tool call, confidence rendering rules
  - PO framework (a)-(b)-(c) added to each 6R option block: (a) what if not resolved (source CVE/lifecycle from bundle), (b) whether can remain (cold-start, cloud ops gap, egress from bundle, vendor lock-in, compliance residuals), (c) how to verify (SLA+GA from bundle, [project-specific] for functional/NFR)
  - Retire and Retain postures marked "Not applicable" for sections (b) and (c)

### Design decisions
- **Step 6b numbering:** Inserted as 6b (not replacing step 7) to avoid renumbering the existing intake steps. The agent is invoked after all intake questions are answered (step 5) and before options presentation (step 7) — this is the correct position in the R1 flow.
- **egress_cost_signal in "whether can remain":** Egress costs are frequently excluded from initial TCO models and surface post-go-live. Placing egress in section (b) rather than (c) signals this is a residual risk, not a verification step.
