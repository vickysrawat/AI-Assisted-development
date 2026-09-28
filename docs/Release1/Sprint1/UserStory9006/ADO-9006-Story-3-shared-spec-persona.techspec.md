# Tech Spec — Story 3: Shared spec + [SA] persona
ADO #9006 · Story 3 of 5 · Release 1 · Sprint 1
Status: DRAFT

---

## Overview

Story 3 writes `skills/shared/migration-research-spec.md` — the canonical schema and rendering rules document that calling skills (Stories 4 and 5) reference when invoking the agent and rendering its confidence-annotated output. It also adds the `[SA] Solution Architect — migration specialist` persona entry to `skills/shared/personas-spec.md`. These two files are the foundation for Stories 4 and 5: they define what the agent returns and how calling skills must display it. The spec document is purely prescriptive — it does not change skill behavior on its own; it provides the contract that calling skills implement.

This story depends on Stories 1 and 2 because the spec document documents both agent modes and must reflect the actual input/output schemas already defined in the agent SKILL.md.

---

## AC Coverage Matrix

### AC -> File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F7 | migration-research-spec.md: discriminated union input schema, per-mode output bundle schema, confidence rendering rules, calling skill invocation pattern, per-provider lookup strategy table | skills/shared/migration-research-spec.md | Covered |
| AC-F8 | personas-spec.md: [SA] Solution Architect entry with background, lens, signature questions, weigh instructions | skills/shared/personas-spec.md | Covered |

### File -> AC mapping

| File | ACs satisfied |
|---|---|
| skills/shared/migration-research-spec.md | AC-F7 |
| skills/shared/personas-spec.md | AC-F8 |

**Coverage result:** All 2 ACs covered. No orphaned file changes.

---

## Files Changed

| File | Change | AC(s) | Notes |
|---|---|---|---|
| `skills/shared/migration-research-spec.md` | NEW | AC-F7 | Canonical schema + rendering rules document for migration-research-agent |
| `skills/shared/personas-spec.md` | MODIFIED | AC-F8 | Add [SA] Solution Architect — migration specialist persona entry |

### skills/shared/migration-research-spec.md — structure

The spec document must contain the following sections:

**Section 1 — Purpose**
One paragraph: what this spec defines, who it is for (calling skills — rewrite, upgrade, replatform), what it does NOT define (agent execution internals, which are in migration-research-agent/SKILL.md).

**Section 2 — Discriminated union input schema**
Both modes as a discriminated union. Cross-reference to migration-research-agent/SKILL.md for the authoritative schema; this spec is the summary contract for calling skills.

Mode 1 — rewrite/upgrade:
```json
{
  "migration_type": "rewrite" | "upgrade",
  "source_layers": [{ "stack": string, "version": string, "cloud_hosted": "azure"|"aws"|"gcp"|null }],
  "target_layers": [{ "stack": string, "version": string }]
}
```

Mode 2 — replatform:
```json
{
  "migration_type": "replatform",
  "source_environment": { "type": "on-prem"|"cloud", "runtime": string, "cloud_provider": "azure"|"aws"|"gcp"|null },
  "target_environment": { "cloud": "azure"|"aws"|"gcp", "components": [{ "name": string, "type": string }], "region": string }
}
```

**Section 3 — Per-mode output bundle schema**
Summary of the bundle structure returned by the agent. Cross-reference to agent SKILL.md for full field definitions.

Mode 1 (rewrite/upgrade) bundle: array of per-layer objects with fields:
- layer, role, eol_status, cve_exposure, ecosystem_health, hiring_trend, tooling_availability

Mode 2 (replatform) bundle: array of per-component objects with fields:
- component, cloud, pricing_range, sla_percentage, ga_status, compliance_certifications, egress_cost_signal

Each field is a confidence-annotated fact object: `{ value/status/signal, source_url, retrieved_date, confidence }`.

**Section 4 — Confidence level definitions and rendering rules**

| Confidence level | Definition | Rendering rule in calling skills |
|---|---|---|
| high | Authoritative source found; data extracted and verified on the retrieved page | State as fact with inline citation: "{fact} [source, YYYY-MM-DD]" |
| medium | Industry benchmark or statistical estimate; not a vendor-authoritative statement | State as: "(industry benchmark as of {YYYY-MM-DD})" |
| low | Data found but inconsistent across sources, or from a non-authoritative source | Render as: "WARNING: {claim} — unverified, check: {canonical URL}" |
| UNKNOWN | No authoritative data found within the single invocation; canonical URL hint provided | Render as: "WARNING: {fact type} not found — check: {canonical URL}" |

Note: `confidence=UNKNOWN` fields have `source_url=null` and a non-null `canonical_url` field pointing to the vendor's documentation home for that service. This `canonical_url` (not `source_url`) is used in the rendering.

**Section 5 — How calling skills invoke the agent**

Step 1: At the start of the options phase, construct the typed input JSON (discriminated union, select mode based on skill type).

Step 2: Invoke the Agent tool with the input JSON as the subagent's task description. Pass only the JSON — no internal project identifiers, file paths, or class names.

Step 3: Receive the output bundle. Validate that it is a non-empty array.

Step 4: Apply confidence rendering rules (Section 4) when inserting facts into the options analysis output.

Step 5: For each PO framework section:
  - Populate from the bundle where groundable (cite the fact inline)
  - Mark `[project-specific — requires your input]` where internal data is needed (TCO, team size, existing contracts)

Note: A single Agent tool call covers the full bundle. Do not invoke the agent multiple times for different fact types within the same options analysis run.

**Section 6 — Per-provider lookup strategy table**

Summary table matching what the agent SKILL.md implements. Calling skills reference this section to understand confidence levels when rendering:

| Provider | Pricing | SLA | Compliance | Lifecycle |
|---|---|---|---|---|
| Azure | High — azure.microsoft.com/pricing | High — azure.microsoft.com/support/legal/sla/ | High — learn.microsoft.com/azure/compliance/ | High — learn.microsoft.com/lifecycle/ |
| GCP | High — cloud.google.com/{service}/pricing | High — cloud.google.com/{service}/sla | High — cloud.google.com/security/compliance | High — /docs/deprecations structured table; medium-high — RSS fallback |
| AWS | High — aws.amazon.com/{service}/pricing | High — aws.amazon.com/legal/service-level-agreements/ | High — aws.amazon.com/compliance/services-in-scope/ | Medium-high — docs.aws.amazon.com + RSS; no central EoL portal |

Note: BigQuery MCP excluded — requires billing-enabled GCP project + bigquery.jobs.create IAM. WebFetch on cloud.google.com/{product}/docs/deprecations achieves equivalent confidence without authentication.

### skills/shared/personas-spec.md — [SA] entry

Add the following entry to the personas-spec.md file. Insert after the existing [PM] entry or at the end of the Expert Persona section — do not reorder existing entries.

```
## [SA] Solution Architect — migration specialist

**Background:** Has led multiple rewrite, upgrade, and replatform projects across enterprise and mid-market organisations. Has seen rewrites abandoned at 60% completion when the team underestimated the application-layer breaking change surface, cloud migrations that tripled projected costs because egress pricing was not in the initial TCO model, and upgrades that "finished" but left breaking changes in the application layer that surfaced in production. Treats every migration as a potential multi-month commitment with a defined exit cost.

**Lens:**
- 3-year platform fitness — not just whether the new stack works today, but whether the team can maintain, hire for, and extend it over a 3-year horizon
- Full TCO — compute + egress + team retraining + vendor lock-in exit cost + migration labour; never surface compute cost alone as the TCO
- Failure modes first — starts analysis from what goes wrong at 60% completion, not what the happy path looks like; asks "what does this look like half-done?"
- Pre-mortem instinct — for every option, surfaces the most likely failure mode before the option is chosen

**Signature questions:**
- "What does this look like half-done?"
- "What does the team not know yet that will surprise them at stage 3?"
- "What stays broken even after the migration succeeds?"
- "What is the exit cost if we choose this option and change our minds at 40% completion?"

**Weigh instructions:**
- Weigh [TL] implementation concerns: feasibility and complexity assessments from the Tech Lead are evidence; incorporate them explicitly into the options analysis.
- Weigh [PM] timeline pressures: acknowledge delivery constraints but never let timeline optimism override agent-grounded lifecycle and ecosystem signals. If a deadline conflicts with an EoL date, surface the conflict explicitly — do not paper over it.
- The agent's grounded facts (EoL dates, CVE exposure, pricing ranges) are evidence. Persona judgment is not evidence — do not override grounded facts with intuition.
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| migration-research-spec.md references a confidence level not in the agent's SKILL.md | Spec and agent SKILL.md must be kept in sync; if they diverge, the agent SKILL.md is authoritative — update the spec |
| Calling skill invokes agent with wrong migration_type for its mode | Agent returns an error message; calling skill must surface the error to the developer rather than continuing with a partial bundle |
| personas-spec.md has no [SA] entry after Story 3 ships | PR reviewer check catches this — [SA] entry is a mandatory deliverable per AC-F8 |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F7 (migration-research-spec.md: 6 sections, schemas for both modes, confidence table, per-provider lookup table) | Author new spec document | 2 |
| AC-F8 (personas-spec.md: [SA] entry with background, lens, 4 signature questions, weigh instructions) | Add persona entry to existing file | 1 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — two file changes (one new, one modified).

---

## Definition of Done

**Implementation**
- [ ] `skills/shared/migration-research-spec.md` created with all 6 sections as specified
- [ ] Section 2: both discriminated union modes present (rewrite/upgrade and replatform)
- [ ] Section 3: per-mode output bundle schemas summary present; cross-reference to agent SKILL.md
- [ ] Section 4: all four confidence levels defined with rendering rules (high/medium/low/UNKNOWN)
- [ ] Section 4: UNKNOWN rendering uses canonical_url (not source_url)
- [ ] Section 5: calling skill invocation steps include the single-Agent-call constraint
- [ ] Section 6: per-provider lookup strategy table present; BigQuery MCP exclusion note included
- [ ] `skills/shared/personas-spec.md` updated with [SA] entry containing: background, lens (3 elements), 4 signature questions, weigh instructions for [TL] and [PM]

**Quality**
- [ ] Spec section 4 confidence rendering table matches what agent SKILL.md produces — no divergence
- [ ] [SA] persona entry does not include any personally identifiable names or internal team references
- [ ] Both documents are syntactically valid Markdown with correct heading hierarchy
- [ ] Regression: existing personas-spec.md entries are unchanged — only the [SA] entry added

**Review readiness**
- [ ] PR title: [ADO-9006] Story 3 — migration-research-spec.md + [SA] persona
- [ ] PR description maps migration-research-spec.md to AC-F7 and personas-spec.md to AC-F8
- [ ] ICEA and Story 3 tech spec committed in the feature branch

### Reviewer Checklist

- [ ] Section 4 confidence rendering rules in migration-research-spec.md match exactly what the agent SKILL.md defines and what Stories 4-5 will implement in calling skills (all three documents must agree on high/medium/low/UNKNOWN rendering)
- [ ] Section 6 per-provider lookup strategy table matches the per-provider tables in migration-research-agent/SKILL.md (Stories 1 and 2) — no divergence in confidence levels or URL patterns
- [ ] [SA] persona entry: lens explicitly states "failure modes first" and "3-year platform fitness" (ICEA AC-F8 requirement)
- [ ] [SA] weigh instructions explicitly state that grounded agent facts are not overridable by persona judgment
- [ ] BigQuery MCP exclusion note present in Section 6

---

## Open Questions

None.

---

## Request Flow

This story's deliverables are reference documents, not runtime execution flows. The conceptual "flow" is:

```
Stories 4 and 5 (calling skills) read migration-research-spec.md at session start
  |
  +--> Use Section 2 to construct the correct discriminated union input JSON
  +--> Use Section 5 to determine how to invoke the Agent tool
  +--> Use Section 4 to apply the confidence rendering rules when outputting facts
  +--> Use Section 6 to understand expected confidence levels per provider

[SA] persona entry in personas-spec.md is loaded by migration skills via the Codebase Orientation step
  |
  +--> migration skills act as [SA] during the options phase
       applying the signature questions and lens to the agent bundle output
```

---

## Rollback

**Story 3 creates one new file and modifies one existing file.**

**Rollback procedure:**
1. Delete `skills/shared/migration-research-spec.md`
2. Revert the [SA] entry addition from `skills/shared/personas-spec.md`
3. Verify: Stories 4 and 5 must not yet be implemented (they reference this spec); if they are, revert them first
4. Verify: existing personas-spec.md entries are intact

---

## Handover

### QA Team

**What was added:** `skills/shared/migration-research-spec.md` (new) and updated `skills/shared/personas-spec.md` with [SA] entry.

**How to verify manually:**
1. Open `migration-research-spec.md` — verify all 6 sections present, confidence rendering table has 4 rows, per-provider table has 3 providers
2. Open `personas-spec.md` — verify [SA] entry present with background, lens, 4 signature questions, and weigh instructions for both [TL] and [PM]
3. Cross-check Section 4 rendering rules against SKILL.md (Stories 1-2) — confidence levels must match
4. Cross-check Section 6 lookup table against SKILL.md lookup tables — confidence values must match

**Regression risk:** Low — personas-spec.md is modified but only an entry is added, not changed. Verify existing persona entries are intact.

### DevOps / Platform Team

No changes.

### Future Developer — Follow-on Work

To add a fourth cloud provider to the lookup strategy: update Section 6 of `migration-research-spec.md` and both mode sections in `migration-research-agent/SKILL.md` (Stories 1 and 2). Both documents must stay in sync.

---

## Test Cases

### Positive Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | migration-research-spec.md — structure | Read the file | All 6 sections present; Section 4 has 4 confidence rows; Section 6 has 3 provider rows | AC-F7 |
| P-U2 | migration-research-spec.md — confidence rendering table | Read Section 4 | high/medium/low/UNKNOWN each have distinct rendering rules; UNKNOWN uses canonical_url not source_url | AC-F7 |
| P-U3 | migration-research-spec.md — per-provider table | Read Section 6 | Azure=high all facts; GCP=high (table) / medium-high (RSS); AWS=high (pricing/SLA/compliance) / medium-high (lifecycle); BigQuery exclusion note present | AC-F7 |
| P-U4 | personas-spec.md — [SA] entry | Read personas-spec.md | [SA] entry present with all required elements: background, lens (3 elements), 4 signature questions, weigh instructions for [TL] and [PM] | AC-F8 |
| P-U5 | personas-spec.md — existing entries unchanged | Read personas-spec.md | All pre-existing persona entries ([PO], [TL], [SE], [PM]) are unmodified | AC-F8 |

### Negative Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | migration-research-spec.md — schema divergence check | Compare Section 2 schemas against Stories 1-2 SKILL.md input schemas | No divergence — schemas match exactly | AC-F7 |
| N-U2 | personas-spec.md — [SA] does not reference internal org | Read [SA] entry | No internal team names, project names, or org-specific identifiers in the entry | AC-F8 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Calling skill conformance (verified when Stories 4-5 ship) | Run /rewrite or /replatform and observe options output | Confidence rendering in calling skill output matches Section 4 rendering rules exactly | AC-F7 |

> NF AC verification:
> AC-F7 is verified by inspection — the spec document's sections are directly observable.
> AC-F8 is verified by inspection — the [SA] entry in personas-spec.md is directly observable.

---

### Revision Log

2026-09-26 — Story 3 tech spec drafted
