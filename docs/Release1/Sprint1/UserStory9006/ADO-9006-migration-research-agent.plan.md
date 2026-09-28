# Plan — Migration Research Agent + Options Phase PO Framework
ADO #9006 · Release 1 · Sprint 1
Status: DRAFT

---

## Problem Statement

The migration options phase (rewrite / upgrade / replatform) presents options as a
descriptive matrix — assurance × effort × TCO — but does not tell the developer what
happens if they don't act, what residual risk remains after acting, or how to verify
success. Time-sensitive facts (EoL dates, cloud pricing, ecosystem health) are sourced
from model training data with no citation, no grounding, and no freshness signal. A
developer who receives a wrong EoL date or wrong cloud TCO makes the wrong urgency and
cost decisions at the last human gate before significant effort is committed.

## Story

As a developer evaluating a migration, I want the options analysis to include
decision-grade context grounded in cited external facts, so that I can make an informed
choice before committing to the work.

## Personas

**End-user:** Developer or Tech Lead at the migration planning gate.
- Goal: make an informed option choice before committing significant effort
- Frustration: "The analysis told me what to do but not why now or what I'm accepting long-term."
- Success: every external claim has a source; residual risks are visible before committing

**Expert delivering the analysis: [SA] Solution Architect — migration specialist**
- Background: has led multiple rewrite, upgrade, and replatform projects; has seen rewrites
  abandoned at 60% completion, cloud migrations that tripled costs, and upgrades that
  "finished" but left breaking changes buried in the application layer
- Lens: 3-year platform fitness · TCO comprehensively (compute + egress + operational
  overhead + team retraining + vendor lock-in exit cost) · failure modes first
- Failure-mode instinct: "What does this look like when it's half-done and the team runs
  out of budget?" · Knows which migration paths have tooling gaps (e.g. WCF→gRPC has no
  automated tool), which have hidden breaking change clusters, which cloud services look
  cheap until egress kicks in
- Pre-mortem: "This shipped and the costs were 3× projected — what went wrong?"
- Always asks: "What does the team not know yet that will surprise them at stage 3?"
  "What is the cost if we get 70% done and stop?" "What stays broken even after the
  migration succeeds?"
- Weigh [TL] implementation concerns and [PM] timeline pressures; never let optimism
  bias override signals from the agent's ecosystem health and lifecycle data

## Feature Priority (MoSCoW)

### Must Have

**[1] migration-research-agent/SKILL.md** — subagent with three input modes
(discriminated union on migration_type). No codebase access. Sanitized WebSearch only
per CLAUDE.md web search policy. Structured JSON output with source URL, retrieved date,
and confidence (high/medium/low) per fact.

*rewrite / upgrade mode:*
```json
{
  "migration_type": "rewrite",
  "source_layers": [
    { "layer": "frontend", "stack": "angular", "version": "15" },
    { "layer": "backend", "stack": "dotnet", "version": "6" }
  ],
  "target_layers": [
    { "layer": "frontend", "stack": "react", "version": "18" },
    { "layer": "backend", "stack": "dotnet", "version": "10" }
  ]
}
```
Research per layer: stack EoL, CVE exposure, ecosystem adoption, hiring market trend,
tooling availability. Also checks "not migrating" layers for lifecycle signals.

*replatform mode:*
```json
{
  "migration_type": "replatform",
  "source_environment": {
    "hosting": "on-prem IIS",
    "stacks": ["dotnet@6", "sql-server@2019"],
    "posture": "rehost"
  },
  "target_environment": {
    "cloud": "azure",
    "components": [
      { "type": "compute", "service": "App Service", "tier": "Standard S2" },
      { "type": "database", "service": "Azure SQL Managed Instance" }
    ],
    "region": "East US"
  }
}
```
Research per component: cloud service pricing, SLA guarantee, GA vs. preview status,
compliance certifications (SOC2/HIPAA), Well-Architected alignment, data egress costs,
on-prem vs. cloud TCO comparison.

**[2] Rewrite SKILL.md options section** restructured with PO framework:
- What happens if not resolved (grounded by agent source lifecycle bundle)
- Tradeoffs (per option: what it sacrifices, not just what it gains)
- Whether it can remain after the migration (residual risks)
- How to verify success
- Populated from agent bundle per layer; flagged as `⚠ [project-specific]` where
  internal data is needed

**[3] Upgrade SKILL.md gap+risk report** enriched with PO framework — "what happens if
not resolved" and "whether it can remain" added; grounded by agent lifecycle bundle.

**[4] Replatform SKILL.md 6R options** enriched with PO framework — "whether it can
remain" is most underserved; cloud service GA status and compliance gaps grounded by
agent replatform bundle.

**[5] skills/shared/migration-research-spec.md** — single source of truth defining:
- Discriminated union input schema (all three modes)
- Per-mode output bundle schema with confidence levels
- Confidence rendering rules: high=cited fact with source; medium="(industry benchmark
  as of {date})"; low=⚠ "unverified — check {canonical URL}"
- Per-provider lookup strategy (WebFetch-only — no MCP, no IAM):
  - Azure lifecycle: learn.microsoft.com/lifecycle/{product} (high)
  - GCP lifecycle: cloud.google.com/{product}/docs/deprecations structured table (high);
    fallback: GCP global RSS feed keyword-filtered (medium-high)
  - AWS lifecycle: docs.aws.amazon.com/{service}/latest/dg/{runtime-support-page} (high
    when page exists); fallback: AWS What's New RSS exact-phrase filter (medium-high)
  - All providers pricing/SLA/compliance: per-provider canonical pages (high)
- How calling skills invoke and consume the agent bundle
- New [SA] Solution Architect persona definition (migration specialist) — referenced by
  all three migration skills; also added to skills/shared/personas-spec.md

### Should Have

**[6]** Confidence rendering enforced: high → stated as fact with inline citation;
medium → stated with "(industry benchmark as of {date})"; low → ⚠ flagged with
canonical URL for developer to verify.

### Could Have

**[7]** Agent bundle cached in session context — not re-invoked on second options view
within the same session.

### Won't Have (this story)

- Real-time NVD CVE count (rate-limited API; qualitative exposure level only)
- Project-specific TCO (needs internal cost data — flagged as `⚠ [project-specific]`)
- bc-searcher integration (regulatory/compliance domain — separate story)
- BigQuery MCP for GCP lifecycle data (requires billing-enabled GCP project +
  `bigquery.jobs.create` IAM — cannot assume for non-GCP developers; WebFetch on
  `cloud.google.com/{product}/docs/deprecations` achieves equivalent confidence without auth)

## Release Plan

MVP: All three migration skills (rewrite/upgrade/replatform) have grounded, cited options
analysis using the PO framework, powered by the three-mode migration-research-agent.
All three cloud providers (Azure, AWS, GCP) in scope. WebFetch-only — no MCP, no IAM.

Confidence targets at MVP:
- Azure: high — all fact types (centralized lifecycle portal)
- GCP: high — pricing/SLA/compliance/lifecycle via /docs/deprecations structured tables
- AWS: high — pricing/SLA/compliance; medium-high — lifecycle (RSS + service docs pages;
  no central EoL portal exists)

V1: Agent session caching; AWS lifecycle confidence improvements if AWS publishes a
centralized lifecycle portal.

## Assumptions

| # | Assumption | Status |
|---|---|---|
| 1 | WebSearch available with sanitized queries per CLAUDE.md policy | Verified |
| 2 | Agent tool available for subagent invocation in migration skills | Verified |
| 3 | skills/upgrade, rewrite, replatform SKILL.md exist | Verified |
| 4 | detected_stacks[] in dream-init-state.json provides source layer data | Verified |
| 5 | Target layers come from the chosen migration option (already in context) | Verified |

## Risks

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Vendor/cloud provider page structure changes break agent queries | L | M | Concept queries, not page-scraping; low-confidence fallback |
| 2 | Inconsistent WebSearch for niche stacks | M | M | low-confidence renders as ⚠, not stated fact |
| 3 | Cloud pricing tiers change frequently | M | L | Retrieved date always shown; agent notes "as of {date}" |
| 4 | replatform TCO varies widely by region and tier | M | M | Agent returns range, not point estimate; developer validates |

## Open Questions

None.

---

*Plan generated: 2026-09-25T23:37:19 · Actor: KE\rawatv*
