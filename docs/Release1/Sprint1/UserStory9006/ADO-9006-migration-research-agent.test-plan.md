<!-- test-plan-state
epic: ADO-9006
stories:
  - id: Story-1
    title: "Agent — rewrite/upgrade mode"
    suite: "Suite 2"
    tech-spec: "ADO-9006-Story-1-agent-rewrite-upgrade.techspec.md"
    status: generated
  - id: Story-2
    title: "Agent — replatform mode"
    suite: "Suite 3"
    tech-spec: "ADO-9006-Story-2-agent-replatform.techspec.md"
    status: generated
  - id: Story-3
    title: "Shared spec + [SA] persona"
    suite: "Suite 4"
    tech-spec: "ADO-9006-Story-3-shared-spec-persona.techspec.md"
    status: generated
  - id: Story-4
    title: "rewrite + upgrade calling skill enrichment"
    suite: "Suite 5"
    tech-spec: "ADO-9006-Story-4-rewrite-upgrade-skills.techspec.md"
    status: generated
  - id: Story-5
    title: "replatform calling skill enrichment"
    suite: "Suite 6"
    tech-spec: "ADO-9006-Story-5-replatform-skill.techspec.md"
    status: generated
cross-cutting-suites-status: generated
-->

# Test Plan — Migration Research Agent + Options Phase PO Framework
ADO #9006 · Release 1 · Sprint 1
Document type: QA Test Plan · Type: EPIC — fully expanded
Prepared: 2026-09-26 · Expanded: 2026-09-26

---

## Overview

This test plan covers ADO #9006 — a 5-story epic introducing `migration-research-agent/SKILL.md`
and PO framework additions to the rewrite, upgrade, and replatform migration skills. All 9 suites
are now fully expanded. Execute in story dependency order: Story 1 → Story 2 → Story 3 → (Stories
4 and 5 in parallel). All tests are manual scenario verifications — this epic delivers SKILL.md
artifacts executed by Claude at runtime, not compiled code.

## Environment Requirements

| Item | Requirement |
|---|---|
| Claude Code plugin | v3.25.0 or later |
| Migration skills | /rewrite, /upgrade, /replatform all accessible |
| Internet access | Required — agent uses WebFetch on public canonical URLs |
| No cloud accounts | Agent uses WebFetch-only — no GCP/AWS/Azure auth needed |
| Test stacks (rewrite) | Source: Angular 15 + .NET 6; Target: React 18 + .NET 10 |
| Test stacks (upgrade) | .NET 6 to .NET 10 |
| Test stacks (replatform) | IIS on-prem to Azure App Service Standard S2 + Azure SQL MI |

## Test Suites

| Suite | Title | When to run | TCs | Effort |
|---|---|---|---|---|
| Suite 1 | Epic smoke | After Story 1 merges | 2 | 10 min |
| Suite 2 | Story 1 — Agent rewrite/upgrade mode | After Story 1 merges | 9 | 30 min |
| Suite 3 | Story 2 — Agent replatform mode | After Story 2 merges | 8 | 25 min |
| Suite 4 | Story 3 — Shared spec + [SA] persona | After Story 3 merges | 6 | 15 min |
| Suite 5 | Story 4 — rewrite + upgrade calling skills | After Story 4 merges | 11 | 35 min |
| Suite 6 | Story 5 — replatform calling skill | After Story 5 merges | 10 | 30 min |
| Suite 7 | Regression — existing migration skills unaffected | After all stories merge | 4 | 20 min |
| Suite 8 | Security — query sanitization + agent isolation | After Story 1 merges | 4 | 15 min |
| Suite 9 | NFR — single invocation + citation + UNKNOWN fallback | After Stories 1-2 merge | 4 | 20 min |

**Estimated total effort: ~3.5 hours for a full pass across all 9 suites.**

---

## Suite 1 — Epic smoke: agent skill exists and is invocable

> Verify the new plugin skill directory and SKILL.md are present and Claude can invoke the agent.
> Run after Story 1 merges.

### TC-SMK-01 — Agent SKILL.md present at correct path
**Priority:** Critical
**Type:** Manual inspection
**AC:** AC-F1

**Steps:**
1. Open the plugin directory: `skills/migration-research-agent/`
2. Confirm `SKILL.md` exists at that path
3. Open the file and verify the frontmatter `name: migration-research-agent` is present at line 2

**Expected:** File exists with correct frontmatter name.
**Fail condition:** File absent or frontmatter name is missing or incorrect.

---

### TC-SMK-02 — Agent invocable as subagent from a migration skill session
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-F1, AC-NF3

**Steps:**
1. Open a Claude Code session on any project
2. Invoke the Agent tool with this JSON as the task:
   `{ "migration_type": "rewrite", "source_layers": [{ "stack": "angular", "version": "15", "cloud_hosted": null }], "target_layers": [{ "stack": "react", "version": "18" }] }`
3. Observe the agent response
4. Verify the response is a JSON array with at least one entry
5. Verify each entry contains fields: `eol_status`, `cve_exposure`, `ecosystem_health`, `hiring_trend`, `tooling_availability`

**Expected:** Agent returns a structured JSON array. No tool errors. Session produces a single response (no chained Agent tool calls within the agent's execution).

---

## Suite 2 — Story 1: Agent rewrite/upgrade mode

> Run after Story 1 merges. ACs: AC-F1, AC-NF1, AC-NF2, AC-NF3.
> All tests are manual scenario verifications — invoke the agent via the Agent tool in a Claude Code session.

### TC-AGT-01 — EoL lookup for well-known EoL source stack
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-F1

**Steps:**
1. Invoke the agent with: `{ "migration_type": "rewrite", "source_layers": [{ "stack": "angular", "version": "15", "cloud_hosted": null }], "target_layers": [{ "stack": "react", "version": "18" }] }`
2. Find the entry where `layer="angular@15"` and `role="source"` in the returned bundle
3. Inspect `eol_status`

**Expected:** `eol_status.status` is "EoL", `eol_status.date` is non-null, `eol_status.source_url` references `angular.dev`, `eol_status.confidence` is "high".
**Fail condition:** status is "UNKNOWN" when Angular 15 is a well-known EoL version, or source_url is null when confidence=high.

---

### TC-AGT-02 — EoL lookup for active target stack
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F1

**Steps:**
1. Invoke the agent with: `{ "migration_type": "upgrade", "source_layers": [{ "stack": "dotnet", "version": "6", "cloud_hosted": null }], "target_layers": [{ "stack": "dotnet", "version": "10" }] }`
2. Find the entry where `layer="dotnet@10"` and `role="target"`
3. Inspect `eol_status`

**Expected:** `eol_status.status` is "active", `eol_status.source_url` references `learn.microsoft.com/lifecycle`, `confidence` is "high".

---

### TC-AGT-03 — AWS-hosted cloud context returns medium-high confidence
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F1

**Steps:**
1. Invoke the agent with: `{ "migration_type": "upgrade", "source_layers": [{ "stack": "nodejs", "version": "18", "cloud_hosted": "aws" }], "target_layers": [{ "stack": "nodejs", "version": "22" }] }`
2. Find the source layer entry
3. Inspect `cloud_runtime_support` field (present when cloud_hosted is set)

**Expected:** `cloud_runtime_support.confidence` is "medium-high" (not "high") — AWS has no central EoL portal.
**Fail condition:** confidence=high for AWS lifecycle (would indicate lookup strategy table is not being followed).

---

### TC-AGT-04 — Output bundle completeness: all 5 fact fields present per layer
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-F1

**Steps:**
1. Invoke the agent with any valid rewrite input
2. For each entry in the returned array, verify all 5 fields are present: `eol_status`, `cve_exposure`, `ecosystem_health`, `hiring_trend`, `tooling_availability`
3. For each field with `confidence` not "UNKNOWN": verify `source_url` is non-null

**Expected:** All 5 fields present on every entry. No field is missing or null (UNKNOWN fields have `canonical_url` instead of `source_url`).

---

### TC-AGT-05 — Citation completeness: high-confidence facts have source_url and retrieved_date
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-NF1

**Steps:**
1. Invoke the agent with a well-known stack input (e.g. angular@15 + dotnet@10)
2. For every field where `confidence` is "high" or "medium", verify `source_url` is non-null
3. For every field (including UNKNOWN), verify `retrieved_date` is set to today's date in YYYY-MM-DD format

**Expected:** All confidence=high and confidence=medium fields have non-null `source_url`. All fields have `retrieved_date` = today.
**Fail condition:** Any high/medium fact with source_url=null, or any field with missing retrieved_date.

---

### TC-AGT-06 — UNKNOWN fallback: obscure stack returns canonical_url, no fabricated fact
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-F1 (E6)

**Steps:**
1. Invoke the agent with an obscure/unlisted stack: `{ "migration_type": "rewrite", "source_layers": [{ "stack": "cobol", "version": "85", "cloud_hosted": null }], "target_layers": [{ "stack": "python", "version": "3.12" }] }`
2. Inspect the `cobol@85` source layer entry
3. Verify `eol_status.confidence` is "UNKNOWN"
4. Verify `eol_status.source_url` is null
5. Verify `eol_status.canonical_url` is populated with a vendor/reference URL

**Expected:** All fields for the unknown stack have `confidence="UNKNOWN"`, `source_url=null`, `canonical_url` populated. No fact is stated without a citation.

---

### TC-AGT-07 — Query sanitization: URL patterns contain only technology names
**Priority:** Critical
**Type:** Manual inspection of SKILL.md
**AC:** AC-NF2

**Steps:**
1. Open `skills/migration-research-agent/SKILL.md`
2. Review the Per-Stack Lookup Strategy table (rewrite/upgrade mode)
3. Inspect every URL in the "Primary URL pattern" and "Fallback" columns
4. Verify no URL contains: internal class names, file paths, variable names, org-specific terms, ADO project names, or firm-specific identifiers

**Expected:** All URL patterns contain only generic technology names (e.g. "angular", "dotnet", "react"), version tokens (`{version}`), or cloud provider names. No internal identifiers.

---

### TC-AGT-08 — Wrong migration_type rejected with clear error
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F1

**Steps:**
1. Invoke the agent with `migration_type: "replatform"` while providing source_layers/target_layers (wrong mode for this schema)
2. Observe the response

**Expected:** Agent returns an error JSON: `{ "error": "Invalid migration_type for rewrite/upgrade mode. For replatform, use migration_type: 'replatform'." }` No partial bundle returned.

---

### TC-AGT-09 — Single-invocation bound: no chained Agent tool calls within agent execution
**Priority:** Critical
**Type:** Manual — Claude Code session observation
**AC:** AC-NF3

**Steps:**
1. Invoke the agent via the Agent tool with a rewrite input containing multiple layers
2. Observe the Claude Code session — count the Agent tool calls made during the agent's execution
3. Inspect the agent's SKILL.md Execution Steps section to confirm no Agent tool call appears in Step 2 or Step 4

**Expected:** Exactly one Agent tool response returned. No nested Agent tool calls during execution. UNKNOWN results are returned without spawning a retry subagent.

---

## Suite 3 — Story 2: Agent replatform mode

> Run after Story 2 merges. ACs: AC-F2.

### TC-RPL-01 — Azure component pricing grounded with citation
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-F2

**Steps:**
1. Invoke the agent with: `{ "migration_type": "replatform", "source_environment": { "type": "on-prem", "runtime": "IIS/.NET 4.8", "cloud_provider": null }, "target_environment": { "cloud": "azure", "components": [{ "name": "Azure App Service Standard S2", "type": "compute" }], "region": "East US" } }`
2. Find the `Azure App Service Standard S2` entry in the bundle
3. Inspect `pricing_range`

**Expected:** `pricing_range.value` contains a dollar amount and period, `source_url` references `azure.microsoft.com/pricing`, `confidence` is "high".

---

### TC-RPL-02 — Azure SLA percentage grounded with citation
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-F2

**Steps:**
1. Use the same input as TC-RPL-01
2. Inspect `sla_percentage` on the Azure App Service entry

**Expected:** `sla_percentage.value` is "99.95%" or similar, `source_url` references `azure.microsoft.com/support/legal/sla`, `confidence` is "high".

---

### TC-RPL-03 — GCP compliance certifications grounded from cloud.google.com
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F2

**Steps:**
1. Invoke with a GCP Cloud Run component: `{ "migration_type": "replatform", ..., "target_environment": { "cloud": "gcp", "components": [{ "name": "Cloud Run", "type": "compute" }], "region": "us-central1" } }`
2. Inspect `compliance_certifications` on the Cloud Run entry

**Expected:** `compliance_certifications.certs` is a non-empty array, `source_url` references `cloud.google.com/security/compliance`, `confidence` is "high".

---

### TC-RPL-04 — AWS lifecycle confidence is medium-high (not high)
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F2

**Steps:**
1. Invoke with an AWS RDS component: `{ ..., "target_environment": { "cloud": "aws", "components": [{ "name": "RDS MySQL 8.0", "type": "database" }], "region": "us-east-1" } }`
2. Inspect `ga_status.confidence` on the RDS entry

**Expected:** `ga_status.confidence` is "medium-high" (not "high") — AWS has no central lifecycle portal. Pricing, SLA, and compliance may be "high".
**Fail condition:** ga_status.confidence="high" for AWS lifecycle data.

---

### TC-RPL-05 — Egress cost signal present in bundle
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F2

**Steps:**
1. Use TC-RPL-01 Azure input
2. Inspect `egress_cost_signal` on the Azure App Service entry

**Expected:** `egress_cost_signal.signal` contains a per-GB description (e.g. "$0.087/GB"), `source_url` references `azure.microsoft.com/pricing`, `confidence` is "high".

---

### TC-RPL-06 — Unknown component returns UNKNOWN with canonical_url on all fields
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-F2

**Steps:**
1. Invoke with a non-existent component: `{ ..., "target_environment": { "cloud": "azure", "components": [{ "name": "FictionalService9999", "type": "compute" }], "region": "East US" } }`
2. Inspect all 5 fields on the returned entry

**Expected:** All five fields have `confidence="UNKNOWN"`, `source_url=null`, `canonical_url` populated with a provider documentation URL. No field contains an invented value.

---

### TC-RPL-07 — Preview GA status surfaced correctly
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F2

**Steps:**
1. Invoke with a component known to be in Preview (verify current status on provider docs first)
2. Inspect `ga_status`

**Expected:** `ga_status.status` is "Preview" with `source_url` from the provider's lifecycle/deprecations page. Calling skill renders this with a warning to verify GA commitment date.

---

### TC-RPL-08 — Rewrite/upgrade mode unchanged after replatform mode addition
**Priority:** High
**Type:** Manual — Claude Code session
**AC:** AC-F2 (regression)

**Steps:**
1. Invoke the agent with a rewrite input (same as TC-AGT-01)
2. Verify the bundle structure is identical to what Story 1 produced

**Expected:** Rewrite/upgrade mode bundle structure is unchanged. No replatform mode interference. Story 1 behavior is preserved.

---

## Suite 4 — Story 3: Shared spec + [SA] persona

> Run after Story 3 merges. ACs: AC-F7, AC-F8. All tests are static inspection of Markdown files.

### TC-SPC-01 — migration-research-spec.md has all 6 required sections
**Priority:** Critical
**Type:** Manual inspection
**AC:** AC-F7

**Steps:**
1. Open `skills/shared/migration-research-spec.md`
2. Verify all 6 sections are present with the correct headings:
   - `## Section 1 — Purpose`
   - `## Section 2 — Discriminated Union Input Schema`
   - `## Section 3 — Per-Mode Output Bundle Schema`
   - `## Section 4 — Confidence Level Definitions and Rendering Rules`
   - `## Section 5 — How Calling Skills Invoke the Agent`
   - `## Section 6 — Per-Provider Lookup Strategy (calling skill reference)`

**Expected:** All 6 sections present with exact headings.

---

### TC-SPC-02 — Section 4 confidence rendering table has 4 rows with UNKNOWN using canonical_url
**Priority:** Critical
**Type:** Manual inspection
**AC:** AC-F7

**Steps:**
1. Open Section 4 of `migration-research-spec.md`
2. Verify the table has 4 rows: high, medium, low, UNKNOWN
3. For the UNKNOWN row, confirm the rendering rule references `canonical_url` (not `source_url`)
4. Confirm the "Critical distinction" note is present explaining the canonical_url vs source_url difference

**Expected:** 4-row table with correct rendering rules. UNKNOWN explicitly uses `canonical_url`. Note about `source_url=null` for UNKNOWN is present.

---

### TC-SPC-03 — Section 6 per-provider table has 3 providers with BigQuery exclusion note
**Priority:** High
**Type:** Manual inspection
**AC:** AC-F7

**Steps:**
1. Open Section 6 of `migration-research-spec.md`
2. Verify 3 provider rows: Azure, GCP, AWS
3. Verify Azure shows "High" for all 4 fact types
4. Verify GCP lifecycle shows "High — /docs/deprecations structured table; medium-high — RSS fallback"
5. Verify AWS lifecycle shows "Medium-high" with the "no central EoL portal" note
6. Verify the BigQuery MCP exclusion note is present at the bottom

**Expected:** All 3 providers with correct confidence levels. BigQuery exclusion note present.

---

### TC-SPC-04 — [SA] persona entry has all 4 required elements
**Priority:** Critical
**Type:** Manual inspection
**AC:** AC-F8

**Steps:**
1. Open `skills/shared/personas-spec.md`
2. Find the `[SA]` Rafael Mendes entry in the roster
3. Verify the migration specialist context block is present
4. Verify it contains: (a) Background statement mentioning failed rewrites/cost overruns, (b) Lens with 3-year platform fitness + full TCO + failure modes first, (c) at least 3 signature questions including "half-done" and "stage 3", (d) Weigh instructions for [TL] and [PM]

**Expected:** All 4 elements present in the migration specialist context block.

---

### TC-SPC-05 — [SA] entry does not reference internal org names or project identifiers
**Priority:** High
**Type:** Manual inspection
**AC:** AC-F8

**Steps:**
1. Read the full migration specialist context block in the [SA] entry
2. Verify no internal org names, project names, team names, or firm-specific identifiers are present
3. Verify all examples are generic (e.g. "IIS/.NET" not a specific client project name)

**Expected:** All content is generic and publicly relatable. No internal identifiers.

---

### TC-SPC-06 — Spec schema matches agent SKILL.md (no divergence)
**Priority:** High
**Type:** Manual cross-reference
**AC:** AC-F7

**Steps:**
1. Open Section 4 confidence rendering table in `migration-research-spec.md`
2. Open `skills/migration-research-agent/SKILL.md` Output Schema section
3. Compare the confidence level definitions — verify they are consistent
4. Open Section 6 per-provider table in the spec
5. Compare AWS lifecycle confidence (medium-high) with the agent SKILL.md lookup table

**Expected:** Confidence level definitions and provider confidence levels match exactly between spec and agent SKILL.md.
**Fail condition:** Any divergence in confidence levels or rendering rules between the two documents.

---

## Suite 5 — Story 4: rewrite + upgrade calling skill enrichment

> Run after Story 4 merges. ACs: AC-F3 (rewrite + upgrade), AC-F4, AC-F5.
> All tests are end-to-end invocations of /rewrite or /upgrade in a Claude Code session.

### TC-RWU-01 — /rewrite options: PO section (a) grounded from agent bundle
**Priority:** Critical
**Type:** Manual — Claude Code session (/rewrite)
**AC:** AC-F4

**Steps:**
1. Open a Claude Code session on a project with Angular 15 + .NET 6 detected
2. Run `/rewrite` and proceed to the options phase
3. In the options output, locate the first option's PO framework block
4. Find section "(a) What happens if not resolved"

**Expected:** Section (a) contains Angular 15 EoL status with a source URL from `angular.dev` and a retrieved date. If agent returns UNKNOWN, section shows `WARNING: EoL date not found — check: {canonical_url}`.
**Fail condition:** Section (a) absent, or EoL stated without a citation when agent returned high confidence.

---

### TC-RWU-02 — /rewrite options: PO section (b) contains ecosystem health signal
**Priority:** High
**Type:** Manual — Claude Code session (/rewrite)
**AC:** AC-F4

**Steps:**
1. Same session as TC-RWU-01
2. Locate section "(b) Tradeoffs" in the options PO framework block
3. Verify it contains a target ecosystem health signal (e.g. React 18 weekly download trend)

**Expected:** Section (b) contains `ecosystem_health.signal` for the target stack with source URL. `[project-specific]` markers present for fields requiring internal data.

---

### TC-RWU-03 — /rewrite options: all 4 PO subsections present per option
**Priority:** Critical
**Type:** Manual — Claude Code session (/rewrite)
**AC:** AC-F4

**Steps:**
1. Same session as TC-RWU-01
2. For each option in the options output, verify all 4 subsections are present:
   - (a) What happens if not resolved
   - (b) Tradeoffs
   - (c) Whether it can remain
   - (d) How to verify success

**Expected:** All 4 subsections present for every option. No option is missing any subsection.

---

### TC-RWU-04 — /upgrade gap+risk: "What happens if not resolved" grounded from bundle
**Priority:** Critical
**Type:** Manual — Claude Code session (/upgrade)
**AC:** AC-F5

**Steps:**
1. Open a Claude Code session on a project with .NET 6 detected
2. Run `/upgrade` targeting .NET 10 and proceed to the gap+risk report (Step 4)
3. Locate the "What happens if not resolved" section in the report

**Expected:** Section contains .NET 6 EoL date with citation from `learn.microsoft.com/lifecycle`. CVE exposure level stated with citation. If UNKNOWN, WARNING with canonical_url.

---

### TC-RWU-05 — /upgrade gap+risk: "Whether it can remain" section present
**Priority:** High
**Type:** Manual — Claude Code session (/upgrade)
**AC:** AC-F5

**Steps:**
1. Same session as TC-RWU-04
2. Locate the "Whether it can remain" section in the gap+risk report

**Expected:** Section present with at least 3 residual risk items: application-layer breaking changes, team retraining gap, downstream dependency compatibility — each marked `[project-specific]`. Target ecosystem health signal from agent bundle (or WARNING if UNKNOWN).

---

### TC-RWU-06 — confidence=high rendered with source URL and retrieved_date in /rewrite output
**Priority:** Critical
**Type:** Manual — Claude Code session (/rewrite)
**AC:** AC-F3

**Steps:**
1. Same session as TC-RWU-01
2. Find any fact in the options output that shows as a stated fact (not WARNING)
3. Verify it contains a source URL in brackets: `[{source_url}, {retrieved_date}]`

**Expected:** Every stated fact from the agent bundle includes `[source URL, YYYY-MM-DD]` citation inline.
**Fail condition:** Fact stated without any citation.

---

### TC-RWU-07 — confidence=UNKNOWN rendered as WARNING with canonical_url in /rewrite output
**Priority:** Critical
**Type:** Manual — Claude Code session (/rewrite)
**AC:** AC-F3

**Steps:**
1. Run /rewrite with a niche stack that is likely to return UNKNOWN from the agent
2. In the options output, find any WARNING-prefixed fact
3. Verify it ends with `check: {canonical_url}` (not `check: {source_url}`)

**Expected:** WARNING facts end with a canonical_url link (not source_url which is null for UNKNOWN facts).
**Fail condition:** WARNING shows a null URL, or no WARNING is shown for an UNKNOWN fact.

---

### TC-RWU-08 — /rewrite graceful degradation: [project-specific] markers present when agent data unavailable
**Priority:** High
**Type:** Manual — Claude Code session (/rewrite)
**AC:** AC-F4

**Steps:**
1. Run /rewrite with a stack that forces UNKNOWN for most facts
2. In the options PO framework sections, verify fields requiring internal data show `[project-specific — requires your input]`
3. Verify the options analysis still renders fully (no error, no crash)

**Expected:** Options analysis completes even when agent returns all UNKNOWN. Project-specific fields clearly marked. No error surfaced to developer.

---

### TC-RWU-09 — /rewrite existing options structure preserved (additions are additive)
**Priority:** High
**Type:** Manual — Claude Code session (/rewrite)
**AC:** AC-F4 (regression)

**Steps:**
1. Run /rewrite on a well-known stack
2. Compare the options table (cluster count, wave schedule, effort, assurance ceiling) to pre-ADO-9006 behavior
3. Verify the options table rows and columns are unchanged; only PO framework block is new

**Expected:** Existing options matrix structure unchanged. PO framework is appended after Summary, not replacing any existing content.

---

### TC-RWU-10 — /upgrade existing gap+risk report structure preserved
**Priority:** High
**Type:** Manual — Claude Code session (/upgrade)
**AC:** AC-F5 (regression)

**Steps:**
1. Run /upgrade on a well-known stack
2. Verify the feasibility spine (GREEN/YELLOW/RED items, dependency ledger, post-upgrade ladder) is unchanged
3. Verify PO sections appear after the feasibility spine bullets, not replacing them

**Expected:** Gap+risk report core structure preserved. PO sections are new additions after the existing feasibility content.

---

### TC-RWU-11 — /upgrade confidence rendering applied consistently
**Priority:** High
**Type:** Manual — Claude Code session (/upgrade)
**AC:** AC-F3

**Steps:**
1. Same session as TC-RWU-04
2. In the "What happens if not resolved" section, verify the same 4-level rendering rules as TC-RWU-06 and TC-RWU-07 apply

**Expected:** Same rendering rules as /rewrite — high=stated fact with citation, UNKNOWN=WARNING with canonical_url.

---

## Suite 6 — Story 5: replatform calling skill enrichment

> Run after Story 5 merges. ACs: AC-F3 (replatform), AC-F6.

### TC-RPF-01 — /replatform 6R options: all 3 PO sections present for each non-trivial posture
**Priority:** Critical
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6

**Steps:**
1. Run /replatform targeting Azure App Service + Azure SQL MI
2. In the 6R options output, find the Replatform posture block
3. Verify sections (a), (b), (c) are present

**Expected:** All 3 PO sections present for Rehost, Replatform, Refactor, and Repurchase postures. Retire and Retain show "Not applicable" for sections (b) and (c).

---

### TC-RPF-02 — /replatform section (b): egress cost signal from agent bundle
**Priority:** Critical
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6

**Steps:**
1. Same session as TC-RPF-01 (Azure target)
2. Locate section "(b) Whether it can remain" in the Azure Replatform option
3. Find the egress cost entry

**Expected:** Egress cost signal contains a dollar amount and `[azure.microsoft.com/pricing, YYYY-MM-DD]` citation. Marked as "frequently excluded from initial TCO models."

---

### TC-RPF-03 — /replatform section (c): SLA from agent bundle with citation
**Priority:** Critical
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6

**Steps:**
1. Same session as TC-RPF-01
2. Locate section "(c) How to verify success" in the Azure Replatform option
3. Find the SLA baseline entry

**Expected:** SLA value (e.g. "99.95%") with `[azure.microsoft.com/support/legal/sla, YYYY-MM-DD]` citation.

---

### TC-RPF-04 — /replatform section (c): GA status from agent bundle
**Priority:** High
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6

**Steps:**
1. Same session as TC-RPF-01
2. Find the GA status entry in section (c)

**Expected:** `ga_status.status` is "GA" with source URL citation. If "Preview", explicit note to verify GA commitment date before committing to this option.

---

### TC-RPF-05 — /replatform AWS target: lifecycle confidence rendered as medium-high
**Priority:** High
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6, AC-F3

**Steps:**
1. Run /replatform targeting an AWS component (e.g. AWS RDS MySQL)
2. In the options output, find any lifecycle/GA fact for the AWS component
3. Verify it is rendered as an industry benchmark or WARNING (not as a stated authoritative fact)

**Expected:** AWS lifecycle confidence is medium-high — rendered as `(industry benchmark...)` or WARNING, not as `{value} [aws.amazon.com, date]` with high confidence.

---

### TC-RPF-06 — confidence=high rendered correctly in /replatform output
**Priority:** Critical
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F3

**Steps:**
1. Same session as TC-RPF-01 (Azure target — all facts high confidence)
2. Verify pricing_range in section (c) shows `{value} [azure.microsoft.com/pricing, YYYY-MM-DD]`

**Expected:** Stated fact with source URL and retrieved date inline. Same format as rewrite and upgrade.

---

### TC-RPF-07 — Retire posture: sections (b) and (c) marked "Not applicable"
**Priority:** High
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6

**Steps:**
1. Same session as TC-RPF-01
2. Find the Retire posture block in the 6R options
3. Check sections (b) and (c)

**Expected:** Both sections show "Not applicable — Retire posture: {rationale}". Section (a) is still present (what happens if app is not retired = it remains a cost/risk).

---

### TC-RPF-08 — Missing compliance cert surfaced with WARNING
**Priority:** High
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6

**Steps:**
1. Run /replatform with a target component that does not have a required certification (check provider compliance pages to identify one)
2. In section (b), find the compliance residuals entry

**Expected:** If `compliance_certifications.certs` does not include a required cert: `WARNING: {required cert} not confirmed for {component} — check: {canonical_url}`.

---

### TC-RPF-09 — /replatform graceful degradation when agent returns UNKNOWN
**Priority:** High
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6

**Steps:**
1. Run /replatform with a component that forces UNKNOWN (e.g. a non-standard service name)
2. Verify the 6R options analysis still renders completely (no crash, no error to developer)
3. Verify WARNING entries are present for each UNKNOWN field with canonical_url

**Expected:** Options analysis completes. UNKNOWN fields show WARNING with canonical_url. `[project-specific]` markers where internal data is required.

---

### TC-RPF-10 — Existing /replatform 6R structure preserved (additions are additive)
**Priority:** High
**Type:** Manual — Claude Code session (/replatform)
**AC:** AC-F6 (regression)

**Steps:**
1. Run /replatform on a standard use case
2. Verify the 6R posture descriptions, capability summary, options-insight-spec.md attributes, and judge verdict gate are all unchanged
3. Verify PO framework appears inside each posture block as additive content after the existing description

**Expected:** Existing 6R analysis structure preserved. PO framework sections are new additions, not replacing existing content.

---

## Suite 7 — Regression: existing migration skills unaffected

> Run after all 5 stories merge. Verify that the 3 calling skills still work end-to-end.

### TC-REG-01 — /rewrite reaches options phase without error
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** (regression across AC-F4)

**Steps:**
1. Run /rewrite on a test project with a detected source stack
2. Proceed through Steps 0, 1, 1.5, and into Step 2 (Options)
3. Verify the options phase completes and the options file is written to disk

**Expected:** /rewrite reaches and completes the options phase. Options file saved. No error caused by the agent invocation preamble or PO framework additions.

---

### TC-REG-02 — /upgrade reaches gap+risk report without error
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** (regression across AC-F5)

**Steps:**
1. Run /upgrade on a test project with a detectable source version
2. Proceed through Steps 1, 2, 3, and into Step 4 (Gap+Risk report)
3. Verify the report is generated and saved to disk

**Expected:** /upgrade reaches and completes Step 4. Gap+risk report saved. No error.

---

### TC-REG-03 — /replatform reaches 6R options without error
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** (regression across AC-F6)

**Steps:**
1. Run /replatform on a test project
2. Proceed through Step R1 intake questions into options presentation
3. Verify the 6R options are presented

**Expected:** /replatform reaches options presentation. No error caused by step 6b agent invocation or PO framework additions.

---

### TC-REG-04 — Migration log is still written correctly in all three skills
**Priority:** High
**Type:** Manual — Claude Code session (any migration skill)
**AC:** (regression)

**Steps:**
1. Run any of the three migration skills to the point where migration-log.md is written
2. Verify the migration log file is created at `docs/migrations/{ADO}/migration-log.md`
3. Verify the log contains the expected phase headings

**Expected:** Migration log created and structured correctly. The agent invocation preamble additions do not interfere with migration log creation or population.

---

## Suite 8 — Security: query sanitization + agent isolation

> Run after Story 1 merges. ACs: AC-NF2, E5 (no codebase access).

### TC-SEC-01 — Agent SKILL.md URL patterns contain no internal identifiers (static inspection)
**Priority:** Critical
**Type:** Manual inspection
**AC:** AC-NF2

**Steps:**
1. Open `skills/migration-research-agent/SKILL.md`
2. Read every URL in the Per-Stack Lookup Strategy table (rewrite/upgrade mode)
3. Read every URL in the Per-Provider Lookup Strategy table (replatform mode)
4. For each URL, verify it contains ONLY: public domain names, generic technology slugs, `{stack}` / `{version}` / `{service}` placeholder tokens

**Expected:** No internal class names, file paths, variable names, org-specific identifiers, ADO project names, or firm-specific terms appear in any URL.

---

### TC-SEC-02 — Agent invocation JSON in calling skills contains no internal identifiers
**Priority:** High
**Type:** Manual inspection of modified calling skills
**AC:** AC-NF2

**Steps:**
1. Open `skills/rewrite/SKILL.md` and find the agent invocation JSON template
2. Open `skills/upgrade/SKILL.md` and find the agent invocation JSON template
3. Open `skills/replatform/SKILL.md` and find the agent invocation JSON template (step 6b)
4. Verify each JSON template uses only generic placeholders: `{detected source stack}`, `{version}`, `{provider or null}` — no internal identifiers

**Expected:** All three calling skill JSON templates use only generic placeholders. No internal project names or identifiers in the JSON construction.

---

### TC-SEC-03 — No codebase access in agent SKILL.md (static inspection)
**Priority:** Critical
**Type:** Manual inspection
**AC:** E5 (agent isolation)

**Steps:**
1. Open `skills/migration-research-agent/SKILL.md`
2. Read the Constraints and Invariants section
3. Verify "No codebase access" constraint is present and states that project source files, configuration, and internal identifiers are unavailable to the agent
4. Read the Execution Steps — verify no Read tool calls, no Glob tool calls, no file path access appears in the execution steps

**Expected:** No codebase access in execution steps. Constraint explicitly stated. Project-specific data is always returned as [project-specific] placeholder.

---

### TC-SEC-04 — No MCP references in agent SKILL.md
**Priority:** High
**Type:** Manual inspection
**AC:** (security constraint from ICEA)

**Steps:**
1. Open `skills/migration-research-agent/SKILL.md`
2. Search for any reference to "BigQuery", "MCP", "bigquery.jobs", or any cloud authentication mechanism
3. Verify the BigQuery exclusion note is present in the replatform mode per-provider lookup strategy (explaining WHY it is excluded)

**Expected:** No BigQuery MCP invocation in execution steps. Exclusion note present explaining the IAM requirement that makes it unsuitable.

---

## Suite 9 — Non-Functional: single invocation, citation, UNKNOWN fallback

> Run after Stories 1-2 merge. ACs: AC-NF1, AC-NF3.

### TC-NFR-01 — Single Agent tool call per options run in each calling skill
**Priority:** Critical
**Type:** Manual — Claude Code session observation
**AC:** AC-NF3

**Steps:**
1. Run /rewrite to the options phase and observe the session tool calls
2. Count the number of Agent tool calls made during the options analysis
3. Repeat for /upgrade (gap+risk phase) and /replatform (options phase)

**Expected:** Exactly ONE Agent tool call per options/report run in each skill. No chained or repeated invocations.

---

### TC-NFR-02 — UNKNOWN fallback is terminal: no retry subagent spawned
**Priority:** Critical
**Type:** Manual — Claude Code session observation
**AC:** AC-NF3

**Steps:**
1. Invoke the agent with a niche stack that returns UNKNOWN for EoL status
2. Observe the session — verify no second Agent tool call is made after the UNKNOWN response
3. Verify the UNKNOWN entry is returned in the bundle with `canonical_url` populated

**Expected:** Agent returns UNKNOWN entry in the bundle. No retry invocation. The single invocation is the terminal state.

---

### TC-NFR-03 — All high-confidence facts in bundle have source_url + retrieved_date (citation completeness)
**Priority:** Critical
**Type:** Manual — Claude Code session
**AC:** AC-NF1

**Steps:**
1. Invoke the agent with Angular 15 + .NET 6 → React 18 + .NET 10 (well-known stacks — expect high confidence)
2. For every field in every entry where `confidence` is "high": verify `source_url` is non-null AND `retrieved_date` is a valid today's date
3. For every field where `confidence` is "UNKNOWN": verify `source_url` is null AND `canonical_url` is non-null

**Expected:** Zero high/medium facts with null source_url. Zero UNKNOWN facts with null canonical_url. Every field has retrieved_date = today.

---

### TC-NFR-04 — Agent completes within a single session response for standard stacks
**Priority:** High
**Type:** Manual — Claude Code session observation
**AC:** AC-NF3

**Steps:**
1. Invoke the agent with 4 well-known layers (2 source, 2 target — e.g. Angular 15 + .NET 6 → React 18 + .NET 10)
2. Observe that the agent returns a complete response without timeout or truncation
3. Verify all 4 layers are present in the returned bundle

**Expected:** Complete bundle returned in a single response. All 4 layers present. No timeout or mid-response truncation for well-known stacks.

---

## Test Execution Tracker

| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-SMK-01 | Suite 1 — Smoke | Critical | | | ⬜ | |
| TC-SMK-02 | Suite 1 — Smoke | Critical | | | ⬜ | |
| TC-AGT-01 | Suite 2 — Agent RW | Critical | | | ⬜ | |
| TC-AGT-02 | Suite 2 — Agent RW | High | | | ⬜ | |
| TC-AGT-03 | Suite 2 — Agent RW | High | | | ⬜ | |
| TC-AGT-04 | Suite 2 — Agent RW | Critical | | | ⬜ | |
| TC-AGT-05 | Suite 2 — Agent RW | Critical | | | ⬜ | |
| TC-AGT-06 | Suite 2 — Agent RW | Critical | | | ⬜ | |
| TC-AGT-07 | Suite 2 — Agent RW | Critical | | | ⬜ | |
| TC-AGT-08 | Suite 2 — Agent RW | High | | | ⬜ | |
| TC-AGT-09 | Suite 2 — Agent RW | Critical | | | ⬜ | |
| TC-RPL-01 | Suite 3 — Agent Replatform | Critical | | | ⬜ | |
| TC-RPL-02 | Suite 3 — Agent Replatform | Critical | | | ⬜ | |
| TC-RPL-03 | Suite 3 — Agent Replatform | High | | | ⬜ | |
| TC-RPL-04 | Suite 3 — Agent Replatform | High | | | ⬜ | |
| TC-RPL-05 | Suite 3 — Agent Replatform | High | | | ⬜ | |
| TC-RPL-06 | Suite 3 — Agent Replatform | Critical | | | ⬜ | |
| TC-RPL-07 | Suite 3 — Agent Replatform | High | | | ⬜ | |
| TC-RPL-08 | Suite 3 — Agent Replatform | High | | | ⬜ | |
| TC-SPC-01 | Suite 4 — Spec | Critical | | | ⬜ | |
| TC-SPC-02 | Suite 4 — Spec | Critical | | | ⬜ | |
| TC-SPC-03 | Suite 4 — Spec | High | | | ⬜ | |
| TC-SPC-04 | Suite 4 — Spec | Critical | | | ⬜ | |
| TC-SPC-05 | Suite 4 — Spec | High | | | ⬜ | |
| TC-SPC-06 | Suite 4 — Spec | High | | | ⬜ | |
| TC-RWU-01 | Suite 5 — RW Skills | Critical | | | ⬜ | |
| TC-RWU-02 | Suite 5 — RW Skills | High | | | ⬜ | |
| TC-RWU-03 | Suite 5 — RW Skills | Critical | | | ⬜ | |
| TC-RWU-04 | Suite 5 — RW Skills | Critical | | | ⬜ | |
| TC-RWU-05 | Suite 5 — RW Skills | High | | | ⬜ | |
| TC-RWU-06 | Suite 5 — RW Skills | Critical | | | ⬜ | |
| TC-RWU-07 | Suite 5 — RW Skills | Critical | | | ⬜ | |
| TC-RWU-08 | Suite 5 — RW Skills | High | | | ⬜ | |
| TC-RWU-09 | Suite 5 — RW Skills | High | | | ⬜ | |
| TC-RWU-10 | Suite 5 — RW Skills | High | | | ⬜ | |
| TC-RWU-11 | Suite 5 — RW Skills | High | | | ⬜ | |
| TC-RPF-01 | Suite 6 — Replatform Skill | Critical | | | ⬜ | |
| TC-RPF-02 | Suite 6 — Replatform Skill | Critical | | | ⬜ | |
| TC-RPF-03 | Suite 6 — Replatform Skill | Critical | | | ⬜ | |
| TC-RPF-04 | Suite 6 — Replatform Skill | High | | | ⬜ | |
| TC-RPF-05 | Suite 6 — Replatform Skill | High | | | ⬜ | |
| TC-RPF-06 | Suite 6 — Replatform Skill | Critical | | | ⬜ | |
| TC-RPF-07 | Suite 6 — Replatform Skill | High | | | ⬜ | |
| TC-RPF-08 | Suite 6 — Replatform Skill | High | | | ⬜ | |
| TC-RPF-09 | Suite 6 — Replatform Skill | High | | | ⬜ | |
| TC-RPF-10 | Suite 6 — Replatform Skill | High | | | ⬜ | |
| TC-REG-01 | Suite 7 — Regression | Critical | | | ⬜ | |
| TC-REG-02 | Suite 7 — Regression | Critical | | | ⬜ | |
| TC-REG-03 | Suite 7 — Regression | Critical | | | ⬜ | |
| TC-REG-04 | Suite 7 — Regression | High | | | ⬜ | |
| TC-SEC-01 | Suite 8 — Security | Critical | | | ⬜ | |
| TC-SEC-02 | Suite 8 — Security | High | | | ⬜ | |
| TC-SEC-03 | Suite 8 — Security | Critical | | | ⬜ | |
| TC-SEC-04 | Suite 8 — Security | High | | | ⬜ | |
| TC-NFR-01 | Suite 9 — NFR | Critical | | | ⬜ | |
| TC-NFR-02 | Suite 9 — NFR | Critical | | | ⬜ | |
| TC-NFR-03 | Suite 9 — NFR | Critical | | | ⬜ | |
| TC-NFR-04 | Suite 9 — NFR | High | | | ⬜ | |

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## Exit Criteria

### Minimum for epic to close

- [ ] All Critical TCs in Suite 1 (smoke) passed
- [ ] All Critical TCs in Suites 2–6 (story suites) passed
- [ ] All Critical TCs in Suites 7–9 (cross-cutting) passed
- [ ] Zero open Critical defects across all suites
- [ ] TC-AGT-07 and TC-SEC-01/02 passed: agent SKILL.md query examples contain no internal identifiers (AC-NF2)
- [ ] TC-NFR-01 passed: each calling skill invokes the agent exactly once per options run (AC-NF3)
- [ ] TC-AGT-06 and TC-NFR-02 passed: UNKNOWN fallback is terminal, no fabricated facts (AC-NF1, AC-NF3)
