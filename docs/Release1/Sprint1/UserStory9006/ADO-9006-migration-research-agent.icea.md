# ICEA — Migration Research Agent + Options Phase PO Framework
ADO #9006 · Release 1 · Sprint 1
Status: ✅ Approved · EPIC · 16 SP
Type: EPIC

ℹ Applied 0 pattern(s) from project-knowledge.md (no applicable entries for this new skill scope)

---

## Intent

**Goal:** Ground the migration options analysis in cited external facts and structure it with a decision-grade PO framework so developers make informed, irreversible migration choices.

**Problem Statement:**
The migration options phase (rewrite / upgrade / replatform) presents options as a descriptive matrix but omits three critical questions: what happens if the developer does not act, what residual risk remains after acting, and how to verify success. Time-sensitive facts — EoL dates, CVE exposure, cloud service pricing, ecosystem health — are sourced from model training data with no citation and no freshness signal. A wrong EoL date at the last human gate before a migration commitment leads to incorrect urgency decisions and underestimated cost.

**Business Impact:**
Migration decisions are point-of-no-return choices. A migration begun on wrong assumptions is expensive to reverse — incomplete rewrites are written off, over-provisioned cloud infrastructure runs for months before anyone notices, teams are retrained for stacks the ecosystem has abandoned. Grounded options analysis prevents the most common and most costly migration failure mode: committing to the wrong option because the analysis looked authoritative but wasn't.

**Story:**
As a developer or Tech Lead evaluating a migration, I want the options analysis to show me what happens if I don't act, what I'm accepting by choosing each option, and what residual risk remains even after success — grounded in cited external facts — so I can make a defensible choice before committing significant team effort.

**Success Metrics:**
- Every external claim in the options output has a source URL and a retrieved date
- The PO framework sections (what happens if not resolved, tradeoffs, whether it can remain, how to verify) are present in all three migration skills' options phases
- UNKNOWN-confidence results render as ⚠ with a canonical URL, never as stated facts
- Developers report the options analysis answers "why now" and "what am I accepting"

---

## Context

### Personas

**End-user — Developer / Tech Lead at the migration planning gate**
- Context: evaluating migration options for a real project with real timeline and budget pressure
- Goal: make an informed option choice before committing the team to weeks or months of work
- Frustration: "The analysis told me to migrate but didn't explain the urgency or the long-term risk"
- Success: can explain to a stakeholder why this option was chosen, with cited evidence

**Expert delivering the analysis — [SA] Solution Architect (migration specialist)**
- Background: has led multiple rewrite, upgrade, and replatform projects; has seen rewrites abandoned at 60% completion, cloud migrations that tripled projected costs, and upgrades that "finished" but left breaking changes in the application layer
- Lens: 3-year platform fitness · full TCO (compute + egress + team retraining + vendor lock-in exit) · failure modes first · pre-mortem instinct
- Signature questions: "What does this look like half-done?" "What does the team not know yet that will surprise them at stage 3?" "What stays broken even after the migration succeeds?"
- Weigh [TL] implementation concerns and [PM] timeline pressures; never let optimism bias override the agent's ecosystem and lifecycle signals

### System Context

| Module | Change | Reason |
|---|---|---|
| `skills/migration-research-agent/SKILL.md` | NEW | Subagent that grounds external migration facts (lifecycle, TCO, ecosystem, cloud components) |
| `skills/shared/migration-research-spec.md` | NEW | Discriminated union input/output schema, confidence rendering rules, [SA] persona definition |
| `skills/shared/personas-spec.md` | MODIFIED | Add [SA] Solution Architect (migration specialist) persona entry |
| `skills/rewrite/SKILL.md` | MODIFIED | Options section restructured with PO framework, agent invocation preamble |
| `skills/upgrade/SKILL.md` | MODIFIED | Gap+risk report enriched with PO framework sections |
| `skills/replatform/SKILL.md` | MODIFIED | 6R options enriched with PO framework sections |

### Constraint Context

| Constraint | Source | Impact |
|---|---|---|
| WebSearch queries must be sanitized — no internal identifiers | CLAUDE.md Web Search Policy | Agent queries use generic technology terms only |
| No codebase access for agent | Agent isolation model (same as bc-searcher) | Project-specific TCO and complexity facts are always flagged placeholders |
| AWS has no central lifecycle portal | AWS structural gap — by-design, not fixable | Agent uses RSS + service-specific docs pages; lifecycle confidence=medium-high; pricing/SLA/compliance=high |
| BigQuery MCP unusable for GCP data | Requires billing-enabled GCP project + bigquery.jobs.create IAM — cannot assume | Agent uses WebFetch on /docs/deprecations structured tables + RSS; achieves high confidence without authentication |
| Real-time NVD CVE count excluded | Rate-limit risk | Agent returns qualitative exposure level (high/medium/low), not count |

**Change Tier:** T3 — multiple files, new behaviour, new skill artifact, cross-skill modification

### Stack Context

Plugin stack: Node.js · Markdown SKILL.md · Azure DevOps
New artifact type: SKILL.md (Markdown, read by Claude at runtime via Skill tool)
No new scripts or Node.js modules in this story — all changes are SKILL.md and shared spec Markdown files.

---

## Examples

### Given / When / Then

| # | Scenario | Given | When | Then |
|---|---|---|---|---|
| E1 | Rewrite options — grounded lifecycle | Developer runs rewrite with Angular 15 + .NET 6 → React 18 + .NET 10 | migration-research-agent invoked with rewrite mode input | Returns bundle: Angular 15 EoL status with source URL + date; .NET 6 EOL confirmed with date; React 18 active status; .NET 10 LTS/STS label — all with confidence=high |
| E2 | Replatform options — grounded pricing | Developer runs replatform: IIS on-prem → Azure App Service Standard S2 + Azure SQL MI | migration-research-agent invoked with replatform mode input | Returns bundle: App Service Standard S2 monthly range with source; SQL MI pricing range; SLA guarantee; GA status; compliance certs present — retrieved date shown |
| E3 | Low-confidence fact | Agent queries ecosystem health for an obscure stack version | WebSearch returns inconsistent results | Agent returns confidence=low; options output renders as: `⚠ Ecosystem health for {stack} — unverified, check: {canonical URL}` — never stated as fact |
| E4 | PO framework in rewrite options | Developer reviews rewrite options output | Skill presents Option A (port) vs. Option B (re-architecture) | Each option includes: what happens if not resolved · tradeoffs · whether it can remain · how to verify — populated from agent bundle where grounded, flagged where project-specific |
| E5 | Permission boundary — no codebase access | Agent is invoked as subagent during migration options | Agent attempts to access project source files | Agent has no codebase access; all research is via sanitized WebSearch only; returns UNKNOWN for any fact requiring internal project data |
| E6 | UNKNOWN confidence fallback | Agent cannot find EoL date for a niche stack | WebSearch returns no authoritative result | Agent returns `{ "status": "UNKNOWN", "source": null, "canonical_url": "{vendor URL}" }`; options output renders as ⚠ with the canonical URL, not as a stated fact |

---

## Acceptance Criteria

### Functional

**AC-F1** — migration-research-agent/SKILL.md accepts rewrite/upgrade mode input (`{migration_type, source_layers[], target_layers[]}`) and returns a structured JSON bundle per layer containing: EoL status, CVE exposure level, ecosystem health signal, hiring trend, tooling availability — each with source URL, retrieved date, and confidence level. All three cloud-hosted stack variants (Azure-hosted, AWS-hosted, GCP-hosted) are supported. The agent uses WebFetch-only with no MCP, no IAM, and no cloud account dependency. Per-stack lookup strategy: direct service runtime/version docs page → RSS keyword filter → UNKNOWN fallback.

**AC-F2** — migration-research-agent/SKILL.md accepts replatform mode input (`{migration_type, source_environment, target_environment: {cloud: "azure"|"aws"|"gcp", components[], region}}`) and returns a structured JSON bundle per component containing: pricing range, SLA percentage, GA/preview status, compliance certifications (SOC2/HIPAA/FedRAMP), data egress cost signal, on-prem vs. cloud TCO comparison — each with source URL, retrieved date, and confidence level. All three cloud providers supported. Agent uses WebFetch-only — no BigQuery MCP, no cloud account, no IAM. Per-provider lookup strategy:
- Azure: azure.microsoft.com/pricing + /support/legal/sla/ + learn.microsoft.com/azure/compliance/ + learn.microsoft.com/lifecycle/ → confidence=high all fact types
- GCP: cloud.google.com/{service}/pricing + /terms/sla/ + /security/compliance + cloud.google.com/{product}/docs/deprecations (structured Feature|Deprecated date|Shutdown date table) → confidence=high all fact types; fallback: GCP global RSS feed → medium-high
- AWS: aws.amazon.com/{service}/pricing + /legal/service-level-agreements/ + /compliance/services-in-scope/ + docs.aws.amazon.com/{service}/latest/dg/{runtime-support-page} → confidence=high pricing/SLA/compliance; AWS What's New RSS exact-phrase filter for lifecycle → medium-high (no central EoL portal exists)

**AC-F3** — Confidence rendering is enforced in all calling skills:
- `high` → stated as fact with inline source citation and retrieved date
- `medium` → stated as `(industry benchmark as of {date})`
- `low` → `⚠ {claim} — unverified, check: {canonical URL}`
- `UNKNOWN` → `⚠ {fact type} not found — check: {canonical URL}`

**AC-F4** — skills/rewrite/SKILL.md options section includes the PO framework for each option presented: (a) what happens if not resolved, (b) tradeoffs — what the option sacrifices, not just what it gains, (c) whether it can remain after migration, (d) how to verify success. Sections populated from agent bundle where groundable; marked `⚠ [project-specific — requires your input]` where internal data is needed.

**AC-F5** — skills/upgrade/SKILL.md gap+risk report includes: (a) "what happens if not resolved" section grounded by agent lifecycle bundle for the source stack, (b) "whether it can remain" section listing residual risks that survive the upgrade (e.g. application-layer breaking changes, team retraining gaps).

**AC-F6** — skills/replatform/SKILL.md 6R options include: (a) "what happens if not resolved" grounded by agent source environment signals, (b) "whether it can remain" listing operational residuals (cold-start latency, cloud ops skill gap, egress costs not in initial estimate), (c) "how to verify" per posture.

**AC-F7** — skills/shared/migration-research-spec.md exists and defines: the discriminated union input schema for all three modes, the per-mode output bundle schema, confidence level definitions and rendering rules, how calling skills invoke the agent and consume the bundle. Includes the per-provider lookup strategy table:

| Provider | Pricing | SLA | Compliance | Lifecycle |
|---|---|---|---|---|
| Azure | High — azure.microsoft.com/pricing | High — /support/legal/sla/ | High — learn.microsoft.com/azure/compliance/ | High — learn.microsoft.com/lifecycle/ |
| GCP | High — cloud.google.com/{service}/pricing | High — /terms/sla/ | High — /security/compliance | High — /docs/deprecations table; medium-high — RSS fallback |
| AWS | High — aws.amazon.com/{service}/pricing | High — /legal/service-level-agreements/ | High — /compliance/services-in-scope/ | Medium-high — RSS + service docs; no central portal |

Includes note: BigQuery MCP excluded — requires billing-enabled GCP project + IAM. WebFetch achieves equivalent confidence for GCP without authentication.

**AC-F8** — skills/shared/personas-spec.md includes a new `[SA] Solution Architect — migration specialist` entry with: background statement, lens (3-year fitness, full TCO, failure modes first), signature questions, and weigh instructions for [TL] and [PM] concerns.

### Non-Functional

**AC-NF1** — Every fact in the agent output that is stated (confidence = high or medium) includes a source URL and a retrieved date. No fact is stated without a citation. `⚠ [project-specific]` is the only acceptable alternative when internal data is required.

**AC-NF2** — The agent's WebSearch queries contain only publicly recognisable technology terms — no internal identifiers, class names, file paths, variable names, or organisation-specific terms. This is verifiable by inspection of the queries in the SKILL.md.

**AC-NF3** — The agent returns within one subagent invocation (no chained multi-hop subagents). If a required fact cannot be found within the invocation, the agent returns `UNKNOWN` with a canonical URL hint rather than escalating or retrying.

### Out of Scope

- BigQuery MCP for GCP lifecycle data (billing-enabled GCP project + IAM required; WebFetch on /docs/deprecations achieves equivalent confidence without auth)
- Real-time CVE count from NVD API (qualitative exposure level only: high/medium/low)
- Project-specific TCO calculation (internal cost data — always a `⚠ [project-specific]` placeholder)
- bc-searcher integration for regulatory/compliance research (separate story)
- Agent session caching (Could Have, deferred to V1)

### Assumptions

| # | Assumption | Verified |
|---|---|---|
| 1 | WebSearch available with sanitized queries per CLAUDE.md policy | Yes |
| 2 | Agent tool available for subagent invocation in migration skills | Yes |
| 3 | skills/upgrade, rewrite, replatform SKILL.md exist | Yes |
| 4 | detected_stacks[] in dream-init-state.json provides source layer data for rewrite/upgrade | Yes |
| 5 | Target layers come from the chosen migration option (already in context at agent invocation time) | Yes |

### Risks & Pre-Mortem

"This shipped and the options analysis was worse than before — what went wrong?"
- Agent returned low-confidence results for a common stack and they rendered as ⚠ throughout, making the analysis feel empty → Mitigation: for well-known stacks (dotnet, angular, react, azure app service), the offline refs in migration-knowledge/refs/ serve as confidence=high fallback when WebSearch fails
- The PO framework sections are present but empty (`⚠ [project-specific]` everywhere) for a replatform because the developer didn't provide component details → Mitigation: agent invocation preamble in replatform prompts for minimum required fields before generating options

### Open Questions

None.

---

## Sign-Off

| Role | Name | Date | Status |
|---|---|---|---|
| Developer | KE\rawatv | — | ⏳ Pending |
| Tech Lead | — | — | ⏳ Pending |

---

*ICEA draft generated: 2026-09-25 · Critic verdict: PASS WITH NOTES (System Context and Permission Boundary populated above)*
*2026-09-26 — Approved (auto-approve via SAVE TECH)*
