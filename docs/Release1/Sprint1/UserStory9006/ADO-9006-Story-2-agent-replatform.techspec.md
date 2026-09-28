# Tech Spec — Story 2: migration-research-agent (replatform mode)
ADO #9006 · Story 2 of 5 · Release 1 · Sprint 1
Status: DRAFT

---

## Overview

Story 2 extends `skills/migration-research-agent/SKILL.md` with the replatform discrimination mode — the second branch of the discriminated union input. The replatform mode accepts a source environment description and a target cloud environment (provider + component list + region) and returns a structured JSON bundle per component containing: pricing range, SLA percentage, GA/preview status, compliance certifications (SOC2, HIPAA, FedRAMP), and data egress cost signal. All three cloud providers are supported with provider-specific WebFetch lookup strategies: Azure uses azure.microsoft.com pricing/SLA/compliance pages; GCP uses cloud.google.com service-specific pages plus the deprecations structured table; AWS uses aws.amazon.com pricing/SLA/compliance plus RSS for lifecycle (medium-high confidence — no central EoL portal). No MCP, no IAM, no cloud account dependency.

This story modifies the agent SKILL.md produced in Story 1 — it does not touch any calling skill (Stories 4-5).

---

## AC Coverage Matrix

### AC -> File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F2 | Agent accepts replatform input; returns per-component bundle with pricing, SLA, GA status, compliance, egress signal; all 3 cloud providers; per-provider lookup strategy; WebFetch-only | skills/migration-research-agent/SKILL.md | Covered |

### File -> AC mapping

| File | ACs satisfied |
|---|---|
| skills/migration-research-agent/SKILL.md | AC-F2 |

**Coverage result:** AC-F2 covered by the extended SKILL.md. No orphaned file changes.

---

## Files Changed

| File | Change | AC(s) | Notes |
|---|---|---|---|
| `skills/migration-research-agent/SKILL.md` | MODIFIED | AC-F2 | Add replatform mode as second discriminated union branch; extend Input Schema, per-provider lookup strategy, Output schema, and Execution steps sections |

### skills/migration-research-agent/SKILL.md — additions for replatform mode

The SKILL.md already exists from Story 1. Add the following sections after the rewrite/upgrade mode content:

**Replatform mode — discriminated union branch 2**

Add to Input Schema section:
```json
{
  "migration_type": "replatform",
  "source_environment": {
    "type": "on-prem" | "cloud",
    "runtime": "<description e.g. 'IIS/.NET 4.8', 'EC2/Node.js 18'>",
    "cloud_provider": "azure" | "aws" | "gcp" | null
  },
  "target_environment": {
    "cloud": "azure" | "aws" | "gcp",
    "components": [
      { "name": "<component name e.g. 'Azure App Service Standard S2'>", "type": "compute" | "database" | "storage" | "messaging" | "other" }
    ],
    "region": "<e.g. 'East US', 'us-east-1', 'us-central1'>"
  }
}
```

Example input (IIS on-prem to Azure App Service + Azure SQL MI):
```json
{
  "migration_type": "replatform",
  "source_environment": { "type": "on-prem", "runtime": "IIS/.NET 4.8", "cloud_provider": null },
  "target_environment": {
    "cloud": "azure",
    "components": [
      { "name": "Azure App Service Standard S2", "type": "compute" },
      { "name": "Azure SQL Managed Instance General Purpose 4 vCores", "type": "database" }
    ],
    "region": "East US"
  }
}
```

**Per-provider lookup strategy table (replatform mode)**

| Provider | Fact type | Primary URL pattern | Fallback | Confidence |
|---|---|---|---|---|
| Azure | Pricing | azure.microsoft.com/pricing/{service}/ | — | high |
| Azure | SLA | azure.microsoft.com/support/legal/sla/{service}/ | — | high |
| Azure | Compliance | learn.microsoft.com/azure/compliance/ | — | high |
| Azure | GA/lifecycle status | learn.microsoft.com/lifecycle/ | — | high |
| GCP | Pricing | cloud.google.com/{service}/pricing | — | high |
| GCP | SLA | cloud.google.com/{service}/sla | — | high |
| GCP | Compliance | cloud.google.com/security/compliance | — | high |
| GCP | Lifecycle/deprecations | cloud.google.com/{product}/docs/deprecations (structured Feature/Deprecated/Shutdown table) | GCP global RSS feed + keyword filter | high (table); medium-high (RSS fallback) |
| AWS | Pricing | aws.amazon.com/{service}/pricing | — | high |
| AWS | SLA | aws.amazon.com/legal/service-level-agreements/ | — | high |
| AWS | Compliance | aws.amazon.com/compliance/services-in-scope/ | — | high |
| AWS | Lifecycle | docs.aws.amazon.com/{service}/latest/dg/{runtime-support-page} | AWS What's New RSS (exact-phrase filter for component + "end of support") | medium-high (no central EoL portal) |

Note: BigQuery MCP is excluded — requires billing-enabled GCP project + bigquery.jobs.create IAM. WebFetch on cloud.google.com/{product}/docs/deprecations achieves equivalent confidence without authentication.

**Output schema — per-component bundle (replatform mode)**

Return a JSON array, one entry per component in target_environment.components[]:
```json
[
  {
    "component": "<component name>",
    "cloud": "azure" | "aws" | "gcp",
    "pricing_range": {
      "value": "<e.g. '$150-$200/month (Standard S2, East US)'>",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "sla_percentage": {
      "value": "<e.g. '99.95%'>",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "ga_status": {
      "status": "GA" | "Preview" | "Deprecated" | "UNKNOWN",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "compliance_certifications": {
      "certs": ["SOC2", "HIPAA", "FedRAMP"],
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "egress_cost_signal": {
      "signal": "<e.g. 'Azure charges $0.087/GB outbound after first 100GB/month (East US)'>",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    }
  }
]
```

**Execution steps (replatform mode) — append to existing execution steps section**

When migration_type is "replatform":

Step 1: Parse and validate input. Confirm migration_type is "replatform". Extract source_environment and target_environment.

Step 2: For each component in target_environment.components[]:
  a. Determine provider from target_environment.cloud
  b. Construct the component-specific WebFetch URL using the per-provider lookup strategy table
  c. WebFetch pricing page; extract monthly cost range for the specified tier/region
  d. WebFetch SLA page; extract SLA percentage
  e. WebFetch compliance page; extract relevant certification list (SOC2, HIPAA, FedRAMP)
  f. WebFetch GA/lifecycle/deprecations page; determine GA vs Preview vs Deprecated status
  g. WebFetch pricing page (egress section); extract egress cost signal
  h. For AWS lifecycle: try service-specific docs page first; fallback to What's New RSS with exact-phrase filter
  i. For any fact that cannot be determined: set confidence=UNKNOWN; canonical_url={vendor page}

Step 3: Assemble per-component bundle. Include source_url and retrieved_date for every fact.

Step 4: Return completed bundle. Do not invoke additional subagents.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Provider page structure changes; WebFetch returns no parseable pricing | confidence=UNKNOWN for that fact; canonical_url points to pricing page |
| AWS lifecycle page for a managed service does not exist at expected path | Try What's New RSS fallback with exact-phrase filter; if still not found, confidence=UNKNOWN, canonical_url=aws.amazon.com/new |
| GCP deprecations table missing for a new/recently-GA'd service | confidence=UNKNOWN; canonical_url=cloud.google.com/{service}/docs |
| Component name not recognizable as a cloud service | Return warning: "Component '{name}' not recognized for provider {cloud} — verify the component name matches the provider's service catalog" |
| migration_type is "rewrite" or "upgrade" sent to replatform branch | Handled by the discriminated union routing — rewrite/upgrade mode processes it instead |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F2 (replatform mode: input schema, per-provider lookup strategy for 3 providers, output schema per component, execution steps) | Extend existing SKILL.md with replatform discriminated union branch | 3 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — single file modification, no child ADOs for this story.

---

## Definition of Done

**Implementation**
- [ ] Replatform mode discriminated union branch added to `skills/migration-research-agent/SKILL.md`
- [ ] Replatform input schema correctly structured: migration_type="replatform"; source_environment with type/runtime/cloud_provider; target_environment with cloud/components[]/region
- [ ] Per-provider lookup strategy table covers all three providers (Azure, GCP, AWS) for all five fact types (pricing, SLA, compliance, GA status, egress)
- [ ] GCP lifecycle uses cloud.google.com/{product}/docs/deprecations structured table as primary; RSS as fallback (not BigQuery MCP)
- [ ] AWS lifecycle confidence explicitly documented as medium-high (no central EoL portal)
- [ ] Output bundle contains all five fields per component: pricing_range, sla_percentage, ga_status, compliance_certifications, egress_cost_signal
- [ ] BigQuery MCP not referenced — exclusion note present in SKILL.md

**Quality**
- [ ] Positive verification: given Azure App Service Standard S2 + East US, agent returns pricing_range with source_url from azure.microsoft.com/pricing, confidence=high
- [ ] Positive verification: given GCP Cloud Run, agent returns GA status from cloud.google.com deprecations table or REST docs, confidence=high
- [ ] Negative verification: given an obscure/unlisted component, agent returns confidence=UNKNOWN with canonical_url hint
- [ ] Regression: rewrite/upgrade mode behavior from Story 1 is unchanged — verify by running both modes independently

**Review readiness**
- [ ] PR title: [ADO-9006] Story 2 — migration-research-agent replatform mode
- [ ] PR description maps SKILL.md changes to AC-F2
- [ ] ICEA and Story 2 tech spec committed in the feature branch

### Reviewer Checklist

- [ ] Discriminated union branch correctly keyed on migration_type="replatform" — does not overlap with rewrite/upgrade branch
- [ ] Per-provider lookup strategy table: Azure = high confidence all fact types; GCP = high (table) / medium-high (RSS fallback); AWS = high (pricing/SLA/compliance) / medium-high (lifecycle)
- [ ] BigQuery MCP exclusion note is present in the SKILL.md (not just in spec doc)
- [ ] GCP deprecations table described as "structured Feature/Deprecated date/Shutdown date table" matching ICEA AC-F2 constraint description
- [ ] egress_cost_signal field populated — not omitted — even if confidence=UNKNOWN

---

## Open Questions

None.

---

## Request Flow

```
Calling skill (/replatform, Story 5) constructs discriminated union input with migration_type="replatform"
  |
  +--> Agent tool call --> migration-research-agent/SKILL.md
         Input: { migration_type: "replatform", source_environment, target_environment }
         |
         +--> Discriminated union routing: migration_type="replatform" --> replatform branch
         +--> For each component in target_environment.components[]:
                Determine provider (azure/aws/gcp)
                WebFetch pricing page --> pricing_range
                WebFetch SLA page --> sla_percentage
                WebFetch compliance page --> compliance_certifications
                WebFetch GA/deprecations page --> ga_status
                WebFetch pricing page (egress section) --> egress_cost_signal
                For each: set confidence per lookup strategy table
         +--> Return per-component bundle to calling skill (single response)
```

---

## Rollback

**Modification to Story 1 file.** Rollback by reverting the Story 2 commit — removes replatform mode additions from SKILL.md. Story 1 (rewrite/upgrade mode) is preserved in the commit history.

**Rollback procedure:**
1. Revert the Story 2 commit — removes only the replatform mode sections from SKILL.md
2. Verify: agent still accepts rewrite/upgrade input correctly (Story 1 behavior preserved)
3. Verify: agent returns error for replatform input (replatform branch no longer present)

---

## Handover

### QA Team

**What was added:** Replatform mode discriminated union branch in `skills/migration-research-agent/SKILL.md`.

**How to verify manually:**
1. Construct a replatform input JSON (e.g. Azure App Service Standard S2, East US)
2. Invoke the agent directly in a Claude Code session with this input
3. Verify: pricing_range includes a dollar range with source_url from azure.microsoft.com/pricing; sla_percentage from azure.microsoft.com/support/legal/sla; compliance_certifications from learn.microsoft.com/azure/compliance
4. Test with an AWS component — verify lifecycle confidence is medium-high (not high), with source from docs.aws.amazon.com or RSS

**Regression risk:** Minimal — rewrite/upgrade mode from Story 1 must remain unchanged. Run a rewrite/upgrade verification test after this story ships.

### DevOps / Platform Team

No changes.

### Future Developer — Follow-on Work

To add a fourth cloud provider: add a new row block in the per-provider lookup strategy table (all five fact types), update the discriminated union input type for cloud to include the new value, and add the corresponding entry to `migration-research-spec.md` (Story 3).

---

## Test Cases

### Positive Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | Agent — Azure pricing (well-known service) | Replatform input: Azure App Service Standard S2, East US | Returns pricing_range with value containing dollar estimate, source_url from azure.microsoft.com/pricing, confidence=high | AC-F2 |
| P-U2 | Agent — Azure SLA | Replatform input: Azure App Service Standard S2 | Returns sla_percentage with value like "99.95%", source_url from azure.microsoft.com/support/legal/sla, confidence=high | AC-F2 |
| P-U3 | Agent — GCP compliance | Replatform input: Cloud Run (GCP) | Returns compliance_certifications with SOC2/ISO 27001 listed, source_url from cloud.google.com/security/compliance, confidence=high | AC-F2 |
| P-U4 | Agent — AWS lifecycle (medium-high confidence) | Replatform input: RDS MySQL 8.0 (AWS) | Returns ga_status with confidence=medium-high (not high), source_url from docs.aws.amazon.com or AWS RSS | AC-F2 |
| P-U5 | Agent — egress cost signal | Replatform input: any Azure component | Returns egress_cost_signal with descriptive string and source_url | AC-F2 |

### Negative Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | Agent — UNKNOWN for unlisted component | Replatform input: a non-existent cloud service name | Returns confidence=UNKNOWN for all fields; canonical_url points to provider's service catalog | AC-F2 |
| N-U2 | Agent — GA status for preview service | Replatform input: a service that is in Preview | Returns ga_status="Preview" with source from the provider's deprecations/preview page | AC-F2 |
| N-U3 | Agent — rewrite/upgrade mode unchanged | Rewrite input sent to agent after Story 2 ships | Rewrite/upgrade branch still returns the bundle from Story 1 unchanged; no regression | AC-F2 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | End-to-end replatform options with agent | (1) Run /replatform on a test project (IIS on-prem to Azure App Service + Azure SQL MI) (2) Observe options phase once Story 5 ships | Agent invoked; per-component bundle returned; pricing/SLA/compliance grounded with citations for each Azure component | AC-F2 |

> NF AC verification (inherited from Story 1 design — applies equally to replatform mode):
> AC-NF1: Every `confidence=high` or `confidence=medium` fact in the replatform bundle has non-null source_url and retrieved_date.
> AC-NF2: WebFetch URLs in replatform execution steps use only public provider/service names — no internal identifiers.
> AC-NF3: Replatform mode completes within one subagent invocation — no Agent tool call in execution steps.

---

### Revision Log

2026-09-26 — Story 2 tech spec drafted
