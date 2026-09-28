# Tech Spec — Story 5: replatform calling skill enrichment
ADO #9006 · Story 5 of 5 · Release 1 · Sprint 1
Status: DRAFT

---

## Overview

Story 5 modifies `skills/replatform/SKILL.md` to invoke the migration-research-agent (Stories 1-2) at the 6R options phase and render its per-component bundle with the confidence rendering rules (AC-F3) and the PO decision framework (AC-F6). The modifications are additive: the existing 6R classification and options structure is preserved; the agent invocation preamble and PO sections are inserted at the 6R options analysis entry point. The skill references `skills/shared/migration-research-spec.md` (Story 3) for the invocation pattern and rendering rules.

This story depends on Story 3 (spec document must exist). It runs in parallel with Story 4 (which modifies rewrite + upgrade skills — independent files).

**AC-F3 coverage note:** Story 5 covers confidence rendering enforcement in the replatform calling skill. Story 4 covers rewrite + upgrade. Together, Stories 4 and 5 satisfy the full AC-F3 requirement (all three calling skills).

---

## AC Coverage Matrix

### AC -> File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F3 (replatform portion) | Confidence rendering rules enforced in replatform calling skill | skills/replatform/SKILL.md | Covered |
| AC-F6 | replatform/SKILL.md 6R options include: (a) what if not resolved, (b) whether can remain (operational residuals), (c) how to verify per posture | skills/replatform/SKILL.md | Covered |

### File -> AC mapping

| File | ACs satisfied |
|---|---|
| skills/replatform/SKILL.md | AC-F3 (replatform portion), AC-F6 |

**Coverage result:** Both ACs (in their Story 5 portions) covered. No orphaned file changes.

---

## Files Changed

| File | Change | AC(s) | Notes |
|---|---|---|---|
| `skills/replatform/SKILL.md` | MODIFIED | AC-F3 (partial), AC-F6 | Add agent invocation preamble at 6R options phase entry; add confidence rendering rules; add PO framework sections (a), (b), (c) to each 6R option block |

### skills/replatform/SKILL.md — changes

**Where to insert:** Locate the 6R options analysis section in the replatform SKILL.md (the section where the skill presents the 6R analysis — Rehost, Replatform, Refactor/Re-architect, Repurchase, Retire, Retain). Insert the agent invocation preamble at the beginning of this section, before the 6R classification.

**Agent invocation preamble (insert at start of 6R options phase):**
```
Before classifying and analysing the 6R options, invoke the migration-research-agent to ground
the source environment signals and target component facts. Read skills/shared/migration-research-spec.md
Section 5 for the invocation pattern.

Construct the input:
  {
    "migration_type": "replatform",
    "source_environment": {
      "type": "{on-prem or cloud}",
      "runtime": "{source runtime description e.g. 'IIS/.NET 4.8'}",
      "cloud_provider": "{current cloud provider if cloud-hosted, else null}"
    },
    "target_environment": {
      "cloud": "{target cloud provider: azure | aws | gcp}",
      "components": [
        { "name": "{component name}", "type": "{compute | database | storage | messaging | other}" }
      ],
      "region": "{target region}"
    }
  }

Invoke the Agent tool with this JSON as the task. Receive the per-component bundle.
Apply confidence rendering rules from migration-research-spec.md Section 4 when inserting
facts into the 6R options output below.
```

**Confidence rendering — apply when using agent bundle facts (AC-F3):**
```
When rendering any fact from the agent bundle, apply these rules:
  confidence=high   --> State as fact: "{fact} [source, {retrieved_date}]"
  confidence=medium --> State as: "(industry benchmark as of {retrieved_date})"
  confidence=low    --> Render as: "WARNING: {claim} -- unverified, check: {canonical_url}"
  confidence=UNKNOWN --> Render as: "WARNING: {fact_type} not found -- check: {canonical_url}"
```

**PO framework — add to each 6R option (AC-F6):**

For each of the six posture options (Rehost, Replatform, Refactor, Repurchase, Retire, Retain), add the following three subsections after the existing option description. Populate from the agent bundle where the component facts support it:

```
#### (a) What happens if not resolved
{Populate from agent bundle — source environment signals:}
- Source environment EOL signal: if the source runtime is end-of-life or heading toward EoL,
  state the consequence: vendor support end, security patch gap, regulatory compliance risk
- If source_environment.type="on-prem" and agent returns no lifecycle signal:
  "WARNING: Source environment lifecycle not groundable from agent (on-prem) -- assess vendor support status manually"
- Source CVE exposure signal: {cve_exposure.level from source stack if applicable} [{source_url, retrieved_date}]
- Concrete consequence if this option is chosen and nothing else is done: {derive from signals above}

#### (b) Whether it can remain (operational residuals after this option succeeds)
These risks survive migration and are not resolved by completing this posture:
- Cold-start latency: [project-specific — applicable to serverless/container-based targets]
  (verify whether the target component introduces cold-start behaviour for your workload pattern)
- Cloud ops skill gap: [project-specific — requires your input]
  (e.g. team trained on IIS/Windows ops but target is Linux container — estimate retraining effort)
- Egress costs not in initial estimate: {egress_cost_signal from agent bundle for target component} [{source_url, retrieved_date}]
  (egress costs are frequently omitted from initial TCO models and surface after go-live)
- Vendor lock-in exit cost: [project-specific — requires your input]
  (e.g. proprietary services used in this option that have no portable equivalent)
- Compliance residuals: if compliance_certifications from agent bundle does not include a required cert,
  flag it: "WARNING: {required cert} not confirmed for {component} -- check: {canonical_url}"

#### (c) How to verify success (per this posture)
- SLA baseline: target component SLA = {sla_percentage.value} [{sla_percentage.source_url, retrieved_date}]
  Verify your application's availability target meets or exceeds this baseline
- GA confirmation: target component status = {ga_status.status} [{ga_status.source_url, retrieved_date}]
  If Preview: verify there is a GA commitment date and the Preview SLA meets your requirements
- Functional: {project-specific — list the acceptance tests that confirm the migrated app behaves identically to source}
- Performance: {project-specific — list NFR thresholds to verify post-migration (latency, throughput)}
- Cost: {project-specific — run cost model against pricing_range [{pricing_range.source_url, retrieved_date}] for actual workload}
```

Note: For the Retire and Retain postures, sections (b) and (c) are abbreviated — Retire has no target component to verify; Retain has no migration to perform. Mark as "Not applicable — [posture rationale]" for these postures.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Agent returns empty bundle (no components grounded) | PO framework sections render with [project-specific] for all agent-groundable fields; note "Agent returned no grounded data for the target components — verify component names match the provider's service catalog" |
| Source environment is on-prem with no cloud-hosted lifecycle signal | Source environment lifecycle signals return UNKNOWN; "(a) What happens if not resolved" notes the manual verification step |
| GA status = Preview for a target component | ga_status rendered in section (c) with "Preview" flag; developer explicitly warned to verify GA commitment date |
| Target component not found in agent lookup strategy table | confidence=UNKNOWN for all facts; canonical_url points to provider's service catalog; all agent-groundable fields in PO sections render as WARNING |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F6 (replatform PO framework — agent preamble + PO sections (a), (b), (c) per 6R option; egress/SLA/GA from bundle; operational residuals) | Modify replatform SKILL.md 6R options phase | 2 |
| AC-F3 replatform (confidence rendering rules inserted in replatform calling skill) | Included in AC-F6 work above | 1 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — one file modification.

---

## Definition of Done

**Implementation**
- [ ] `skills/replatform/SKILL.md` modified with agent invocation preamble at 6R options phase entry
- [ ] `skills/replatform/SKILL.md` contains confidence rendering rules block (all 4 levels: high/medium/low/UNKNOWN)
- [ ] Each 6R option block (Rehost, Replatform, Refactor, Repurchase, Retire, Retain) contains 3 PO subsections: (a) what if not resolved, (b) whether can remain, (c) how to verify
- [ ] Section (b) explicitly names: cold-start latency, cloud ops skill gap, egress costs (from bundle), vendor lock-in exit cost, compliance residuals
- [ ] Section (c) references agent bundle for SLA and GA status with citation; [project-specific] for functional/performance/cost verification
- [ ] Retire and Retain postures have abbreviated sections with "Not applicable" markers
- [ ] All agent-groundable PO fields include the citation format from migration-research-spec.md Section 4
- [ ] All fields requiring internal project data are marked [project-specific — requires your input]
- [ ] Existing replatform skill structure preserved — modifications are additive

**Quality**
- [ ] Run /replatform with a well-known target (Azure App Service + Azure SQL MI) — verify: (i) agent invoked; (ii) pricing_range and sla_percentage rendered with citation in section (c); (iii) egress_cost_signal rendered in section (b)
- [ ] Run /replatform with a GCP target — verify: GA status from deprecations table or equivalent; compliance certifications listed with citation
- [ ] Run /replatform with an AWS target — verify: lifecycle confidence rendered as medium-high (not high) per Section 6 of migration-research-spec.md
- [ ] Verify confidence=UNKNOWN renders as WARNING with canonical_url
- [ ] Regression: /replatform completes without error when agent returns no groundable data (graceful degradation with [project-specific] markers)

**Review readiness**
- [ ] PR title: [ADO-9006] Story 5 — replatform calling skill enrichment (PO framework + confidence rendering)
- [ ] PR description maps replatform/SKILL.md to AC-F3 (partial) and AC-F6
- [ ] ICEA and Story 5 tech spec committed in the feature branch

### Reviewer Checklist

- [ ] Confidence rendering rules in replatform/SKILL.md match Section 4 of migration-research-spec.md exactly — no divergence
- [ ] 6R PO framework: all 3 subsections ((a), (b), (c)) present for each of the 6 postures; Retire and Retain have appropriate "Not applicable" markers
- [ ] Section (b) "whether it can remain": cold-start latency, cloud ops skill gap, egress cost signal, vendor lock-in exit cost, and compliance residuals all explicitly named (AC-F6 requirement)
- [ ] Section (c) "how to verify": SLA and GA status populated from agent bundle with citations; functional/performance/cost marked [project-specific]
- [ ] Agent invocation: single Agent tool call; input constructed from replatform discriminated union schema; no internal identifiers in JSON construction
- [ ] Migration-research-spec.md Section 5 referenced explicitly — not reimplemented inline

---

## Open Questions

None.

---

## Request Flow

```
Developer runs /replatform
  |
  +--> replatform SKILL.md 6R options phase entry
         Agent invocation preamble:
           Constructs replatform discriminated union input from source environment + target components
           Invokes Agent tool --> migration-research-agent/SKILL.md (replatform mode, Story 2)
           Receives per-component bundle (pricing_range, sla_percentage, ga_status, compliance_certifications, egress_cost_signal)
         |
         +--> For each 6R posture (Rehost, Replatform, Refactor, Repurchase, Retire, Retain):
                Existing posture description (preserved)
                (a) What happens if not resolved -- source CVE/lifecycle from bundle
                (b) Whether it can remain -- egress_cost_signal + compliance from bundle; [project-specific] for team/ops gaps
                (c) How to verify -- sla_percentage + ga_status from bundle; [project-specific] for functional/NFR tests
```

---

## Rollback

**Modification to one existing SKILL.md file.**

**Rollback procedure:**
1. Revert the Story 5 commit — removes agent invocation preamble, confidence rendering rules, and PO framework sections from replatform SKILL.md
2. Verify: /replatform runs identically to pre-story behavior (no agent invocation, no PO sections)
3. Stories 1-4 are unaffected by this rollback

---

## Handover

### QA Team

**What was modified:** `skills/replatform/SKILL.md`.

**How to verify manually:**
1. Run /replatform on a test project (e.g. IIS on-prem to Azure App Service Standard S2 + Azure SQL MI, East US)
2. At the 6R options phase: verify agent is invoked (Agent tool call visible in session)
3. Verify sections (a), (b), (c) present for each 6R posture; Retire and Retain show "Not applicable"
4. Verify: sla_percentage in section (c) shows "99.95%" or similar with citation from azure.microsoft.com/support/legal/sla
5. Verify: egress_cost_signal in section (b) shows dollar amount with citation from azure.microsoft.com/pricing
6. Test with a GCP target — verify GA status from deprecations table; compliance from cloud.google.com/security/compliance
7. Test with an AWS target — verify lifecycle confidence shows medium-high in the rendering

**Regression risk:** Replatform skill is modified. Run a smoke test of /replatform after this story ships to confirm the skill reaches the 6R options phase without error.

### DevOps / Platform Team

No changes.

### Future Developer — Follow-on Work

If the 6R classification structure in /replatform changes (e.g. a 7th posture is added), add the three PO subsections to the new posture following the same pattern as the existing postures. The subsections must always be associated with their specific posture block.

---

## Test Cases

### Positive Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | replatform PO (a) — what if not resolved | /replatform with on-prem IIS source, Azure target | Section (a) contains source CVE signal with citation; if source runtime EoL, explicit consequence stated | AC-F6 |
| P-U2 | replatform PO (b) — egress cost in "whether can remain" | /replatform with Azure target | Section (b) contains egress_cost_signal with dollar amount and citation from azure.microsoft.com/pricing | AC-F6 |
| P-U3 | replatform PO (c) — SLA in "how to verify" | /replatform with Azure App Service target | Section (c) contains sla_percentage "99.95%" with citation from azure.microsoft.com/support/legal/sla | AC-F6 |
| P-U4 | replatform PO (c) — GA status | /replatform with GCP Cloud Run target | Section (c) contains ga_status "GA" with citation from cloud.google.com deprecations table | AC-F6 |
| P-U5 | replatform — AWS lifecycle medium-high | /replatform with AWS Lambda target | AWS lifecycle confidence rendered as medium-high (not high); source notes "no central EoL portal" | AC-F6, AC-F3 |
| P-U6 | confidence rendering — high | Agent returns pricing_range confidence=high | Rendered as: "{value} [{azure.microsoft.com/pricing, YYYY-MM-DD}]" | AC-F3 |
| P-U7 | Retire posture — abbreviated PO sections | /replatform where Retire posture applies | Section (a) present; sections (b) and (c) show "Not applicable — Retire posture: no target component to verify" | AC-F6 |

### Negative Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | replatform — UNKNOWN compliance cert | /replatform with a new/obscure cloud service | compliance_certifications confidence=UNKNOWN renders as WARNING with canonical_url; section (b) flags missing cert | AC-F6 |
| N-U2 | replatform — Preview GA status | /replatform with a cloud service in Preview | ga_status="Preview" in section (c) with explicit warning to verify GA commitment date | AC-F6 |
| N-U3 | replatform — graceful degradation | Agent returns empty bundle | All agent-groundable PO fields show [project-specific]; no error surfaced; PO sections still present | AC-F3 |
| N-U4 | Regression — existing replatform content preserved | /replatform with any input | 6R classification and existing narrative content unchanged; PO sections added after existing content | AC-F6 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full replatform flow with agent + PO framework | Run /replatform end-to-end (IIS on-prem to Azure App Service + SQL MI) | Agent invoked; per-component bundle grounded; all 3 PO sections present per 6R posture; confidence rendering applied for all facts | AC-F3, AC-F6 |

> NF AC verification (AC-F3 replatform portion):
> confidence=high rendering: verified in the replatform options output — pricing_range and SLA facts for Azure components must include source URL and retrieved date.
> confidence=UNKNOWN rendering: verified by providing an unrecognised cloud component — must render as WARNING with canonical_url, not stated as fact.
> AC-NF1/NF2/NF3 compliance inherited from Stories 1-2 agent design — these NF criteria are implemented in the agent, not the calling skill.

---

### Revision Log

2026-09-26 — Story 5 tech spec drafted
