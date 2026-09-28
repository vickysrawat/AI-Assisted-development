# Tech Spec — Story 4: rewrite + upgrade calling skill enrichment
ADO #9006 · Story 4 of 5 · Release 1 · Sprint 1
Status: DRAFT

---

## Overview

Story 4 modifies `skills/rewrite/SKILL.md` and `skills/upgrade/SKILL.md` to invoke the migration-research-agent (Stories 1-2) at the options phase and render its confidence-annotated output with both the confidence rendering rules (AC-F3) and the PO decision framework (AC-F4 for rewrite, AC-F5 for upgrade). The modifications are additive: existing options matrix structure is preserved; the PO framework sections and agent invocation preamble are inserted at the options phase entry point. All three calling skills reference `skills/shared/migration-research-spec.md` (Story 3) for the agent invocation pattern and confidence rendering rules.

This story depends on Story 3 (the spec document must exist). It runs in parallel with Story 5 (replatform skill — they modify independent files).

**AC-F3 coverage note:** Story 4 covers confidence rendering enforcement in the rewrite and upgrade calling skills. Story 5 covers the replatform calling skill. Together, Stories 4 and 5 satisfy the full AC-F3 requirement.

---

## AC Coverage Matrix

### AC -> File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F3 (rewrite + upgrade portion) | Confidence rendering rules enforced in rewrite and upgrade calling skills | skills/rewrite/SKILL.md, skills/upgrade/SKILL.md | Covered |
| AC-F4 | rewrite/SKILL.md options section includes PO framework: (a) what if not resolved, (b) tradeoffs, (c) whether can remain, (d) how to verify | skills/rewrite/SKILL.md | Covered |
| AC-F5 | upgrade/SKILL.md gap+risk report includes: (a) what if not resolved (grounded by agent lifecycle bundle), (b) whether can remain (residual risks) | skills/upgrade/SKILL.md | Covered |

### File -> AC mapping

| File | ACs satisfied |
|---|---|
| skills/rewrite/SKILL.md | AC-F3 (rewrite portion), AC-F4 |
| skills/upgrade/SKILL.md | AC-F3 (upgrade portion), AC-F5 |

**Coverage result:** All 3 ACs (in their Story 4 portions) covered. No orphaned file changes.

---

## Files Changed

| File | Change | AC(s) | Notes |
|---|---|---|---|
| `skills/rewrite/SKILL.md` | MODIFIED | AC-F3 (partial), AC-F4 | Add agent invocation preamble at options phase entry; add confidence rendering rules; add PO framework sections to each option block |
| `skills/upgrade/SKILL.md` | MODIFIED | AC-F3 (partial), AC-F5 | Add agent invocation preamble at gap+risk phase entry; add confidence rendering rules; add "what happens if not resolved" and "whether it can remain" PO sections |

### skills/rewrite/SKILL.md — changes

**Where to insert:** Locate the Options phase section in the rewrite SKILL.md (the section where the skill presents the rewrite options — typically labeled as the Options analysis or the Option comparison section). Insert the following content at the beginning of that section, before any existing option presentation content.

**Agent invocation preamble (insert at start of Options phase):**
```
Before presenting options, invoke the migration-research-agent to ground the analysis
in cited external facts. Read skills/shared/migration-research-spec.md Section 5 for the
invocation pattern.

Construct the input:
  {
    "migration_type": "rewrite",
    "source_layers": [
      { "stack": "{detected source stack}", "version": "{source version}", "cloud_hosted": "{cloud_hosted or null}" }
    ],
    "target_layers": [
      { "stack": "{selected target stack}", "version": "{target version}" }
    ]
  }

Invoke the Agent tool with this JSON as the task. Receive the per-layer bundle.
Reference migration-research-spec.md Section 4 for confidence rendering rules when
inserting facts into the options output below.
```

**Confidence rendering — apply when using agent bundle facts (AC-F3):**
```
When rendering any fact from the agent bundle, apply these rules:
  confidence=high   --> State as fact: "{fact} [source, {retrieved_date}]"
  confidence=medium --> State as: "(industry benchmark as of {retrieved_date})"
  confidence=low    --> Render as: "WARNING: {claim} -- unverified, check: {canonical_url}"
  confidence=UNKNOWN --> Render as: "WARNING: {fact_type} not found -- check: {canonical_url}"
```

**PO framework — add to each option block (AC-F4):**

For each option presented (e.g. Option A: port only, Option B: re-architecture), add the following four subsections after the existing option description, populated from the agent bundle where groundable:

```
#### (a) What happens if not resolved
{Populate from agent bundle:}
- Source stack EoL: {eol_status.status} as of {eol_status.date} [{eol_status.source_url, retrieved_date}]
- CVE exposure: {cve_exposure.level} [{cve_exposure.source_url, retrieved_date}]
- If EoL or high CVE exposure: describe concrete consequences — security patch gap, vendor support end, framework incompatibility
- If confidence=UNKNOWN for EoL: "WARNING: EoL date not found for {stack} -- check: {canonical_url}. Verify before committing to timeline."

#### (b) Tradeoffs — what this option sacrifices
{Populate from agent bundle (what the option gains is in existing content):}
- Ecosystem health of target: {ecosystem_health.signal} [{source_url, retrieved_date}]
- Hiring trend for target: {hiring_trend.signal} [{source_url, retrieved_date}]
- Tooling availability: {tooling_availability.signal} [{source_url, retrieved_date}]
- What this option does NOT gain: [project-specific — requires your input] (e.g. feature parity timeline, migration labour cost)
- What stays worse after migration: [project-specific — requires your input]

#### (c) Whether it can remain (after migration)
- Operational residuals that survive the migration: [project-specific — requires your input]
  (e.g. legacy integrations not yet migrated, team retraining gap, test coverage debt)
- Any residual CVE surface from components not migrated in this option: {agent bundle if available, else [project-specific]}

#### (d) How to verify success
- Functional: {project-specific — list the acceptance tests that confirm the migrated app behaves identically}
- Performance: {project-specific — list the NFR thresholds to meet}
- Ecosystem: target stack version confirmed active: {target eol_status.status=active with citation, or WARNING if UNKNOWN}
```

### skills/upgrade/SKILL.md — changes

**Where to insert:** Locate the gap+risk report section in the upgrade SKILL.md (the section where the skill presents the gap analysis and risk assessment). Insert agent invocation preamble at the start of this section.

**Agent invocation preamble (insert at start of gap+risk report phase):**
```
Before generating the gap+risk report, invoke the migration-research-agent to ground the
source stack lifecycle and CVE signals. Read skills/shared/migration-research-spec.md Section 5
for the invocation pattern.

Construct the input:
  {
    "migration_type": "upgrade",
    "source_layers": [
      { "stack": "{current stack}", "version": "{current version}", "cloud_hosted": "{cloud_hosted or null}" }
    ],
    "target_layers": [
      { "stack": "{current stack}", "version": "{target version}" }
    ]
  }

Invoke the Agent tool with this JSON as the task. Receive the per-layer bundle.
Apply confidence rendering rules from migration-research-spec.md Section 4.
```

**PO sections — add to gap+risk report (AC-F5):**

After the existing gap+risk table, add:

```
#### What happens if not resolved
{Populate from agent bundle:}
- Source version EoL: {source eol_status.status} as of {eol_status.date} [{source_url, retrieved_date}]
- CVE exposure at source version: {cve_exposure.level} [{source_url, retrieved_date}]
- Security patch support timeline: {derived from EoL date — how many months of security patches remain}
- Concrete consequence: if EoL is within 12 months, state the vendor support end explicitly
- If UNKNOWN: "WARNING: EoL date for {source version} not found -- check: {canonical_url}"

#### Whether it can remain (residual risks after the upgrade succeeds)
These risks survive the upgrade and are not resolved by completing it:
- Application-layer breaking changes not yet addressed: [project-specific — requires your input]
  (e.g. deprecated APIs removed in target version, behaviour changes in the framework)
- Team retraining gap: [project-specific — requires your input]
  (e.g. new patterns introduced in target version that the team is not familiar with)
- Downstream dependency compatibility: [project-specific — requires your input]
  (e.g. NuGet packages, npm packages not yet compatible with target version)
- Ecosystem signal at target version: {target ecosystem_health.signal} [{source_url, retrieved_date}]
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Agent returns empty bundle (no layers grounded) | PO framework sections render with [project-specific] for all agent-groundable fields; note "Agent returned no grounded data — verify stack names in input JSON" |
| Agent returns UNKNOWN for all facts on a layer | All confidence=UNKNOWN fields render as WARNING with canonical_url; PO sections still present but all agent-groundable fields show WARNING |
| Rewrite options phase has no "option A / option B" structure yet | Agent invocation preamble is added regardless; PO framework added to each option as it is presented |
| Upgrade gap+risk report has no explicit section heading | Insert the two PO sections immediately after the last row of the existing gap+risk table |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F4 (rewrite PO framework — agent preamble + confidence rendering + 4 PO subsections per option) | Modify rewrite SKILL.md options phase | 2 |
| AC-F5 (upgrade PO framework — agent preamble + confidence rendering + 2 PO sections in gap+risk report) | Modify upgrade SKILL.md gap+risk phase | 1 |
| AC-F3 rewrite + upgrade (confidence rendering rules inserted in both calling skills) | Included in AC-F4 and AC-F5 work above | 1 |
| **Total** | | **4** |

**Total SP: 4**
**Type: STORY** — two file modifications.

---

## Definition of Done

**Implementation**
- [ ] `skills/rewrite/SKILL.md` modified with agent invocation preamble at options phase entry
- [ ] `skills/rewrite/SKILL.md` contains confidence rendering rules block (all 4 levels: high/medium/low/UNKNOWN)
- [ ] `skills/rewrite/SKILL.md` options section: each option block contains all 4 PO framework subsections: (a) what if not resolved, (b) tradeoffs, (c) whether can remain, (d) how to verify
- [ ] `skills/upgrade/SKILL.md` modified with agent invocation preamble at gap+risk phase entry
- [ ] `skills/upgrade/SKILL.md` contains confidence rendering rules block
- [ ] `skills/upgrade/SKILL.md` gap+risk report: "what happens if not resolved" and "whether it can remain" sections added after the gap+risk table
- [ ] All agent-groundable PO fields include the citation format from migration-research-spec.md Section 4
- [ ] All fields requiring internal project data are marked [project-specific — requires your input]
- [ ] Existing rewrite and upgrade skill structure is preserved — modifications are additive

**Quality**
- [ ] Run /rewrite with a well-known stack — verify: (i) agent is invoked at options phase; (ii) EoL status for source stack rendered with citation; (iii) PO framework sections (a)-(d) present for each option
- [ ] Run /upgrade with a version-supported stack — verify: (i) agent invoked at gap+risk phase; (ii) source stack EoL rendered with citation; (iii) "whether it can remain" section present with residual risks listed
- [ ] Verify confidence=UNKNOWN renders as WARNING with canonical_url (not stated as fact)
- [ ] Regression: run /rewrite and /upgrade on a minimal input — verify the skills still complete without error when agent returns no groundable data (graceful degradation with [project-specific] markers)

**Review readiness**
- [ ] PR title: [ADO-9006] Story 4 — rewrite + upgrade calling skill enrichment (PO framework + confidence rendering)
- [ ] PR description maps rewrite/SKILL.md to AC-F3 (partial) and AC-F4; upgrade/SKILL.md to AC-F3 (partial) and AC-F5
- [ ] ICEA and Story 4 tech spec committed in the feature branch

### Reviewer Checklist

- [ ] Confidence rendering rules in both calling skills match Section 4 of migration-research-spec.md exactly — no divergence in rendering format
- [ ] Rewrite PO framework: all 4 subsections ((a)-(d)) present for each option; (a) and (b) populated from agent bundle; (c) and (d) have [project-specific] markers where internal data is needed
- [ ] Upgrade PO framework: both sections (what if not resolved, whether it can remain) present; "what if not resolved" grounded from agent lifecycle bundle; "whether it can remain" uses [project-specific] for application-layer breaking changes
- [ ] Agent invocation in both skills: single Agent tool call; input constructed from detected stacks (no internal identifiers in the JSON construction)
- [ ] Migration-research-spec.md Section 5 referenced explicitly in both agent invocation preambles — not reimplemented inline

---

## Open Questions

None.

---

## Request Flow

```
Developer runs /rewrite
  |
  +--> rewrite SKILL.md options phase entry
         Agent invocation preamble:
           Constructs rewrite discriminated union input from detected source/target stacks
           Invokes Agent tool --> migration-research-agent/SKILL.md
           Receives per-layer bundle
         |
         +--> For each option (Option A, Option B, ...):
                Existing option description (preserved)
                (a) What happens if not resolved -- eol_status + cve_exposure from bundle
                (b) Tradeoffs -- ecosystem_health + hiring_trend + tooling_availability from bundle
                (c) Whether it can remain -- [project-specific] + agent residual signals
                (d) How to verify -- [project-specific] + target eol_status from bundle

Developer runs /upgrade
  |
  +--> upgrade SKILL.md gap+risk phase entry
         Agent invocation preamble:
           Constructs upgrade discriminated union input (source version, target version)
           Invokes Agent tool --> migration-research-agent/SKILL.md
           Receives per-layer bundle
         |
         +--> Existing gap+risk table (preserved)
         +--> What happens if not resolved -- source eol_status + cve_exposure from bundle
         +--> Whether it can remain -- [project-specific] + target ecosystem_health from bundle
```

---

## Rollback

**Modification to two existing SKILL.md files.** Rollback by reverting the Story 4 commit.

**Rollback procedure:**
1. Revert the Story 4 commit — removes agent invocation preamble, confidence rendering rules, and PO framework sections from rewrite and upgrade SKILL.md
2. Verify: /rewrite and /upgrade run identically to pre-story behavior (no agent invocation)
3. Story 3 (spec document) can remain in place — no dependency from spec to calling skills

---

## Handover

### QA Team

**What was modified:** `skills/rewrite/SKILL.md` and `skills/upgrade/SKILL.md`.

**How to verify manually:**
1. Run /rewrite on a test project with Angular 15 + .NET 6 source, React 18 + .NET 10 target
2. At the options phase: verify agent is invoked (Agent tool call visible in session); verify EoL status for Angular 15 appears with citation [angular.dev, date]; verify PO sections (a)-(d) present for each option
3. Run /upgrade on a test project with .NET 6 source, .NET 10 target
4. At the gap+risk phase: verify agent invoked; verify .NET 6 EoL date rendered with citation; verify "whether it can remain" section present with [project-specific] markers

**Regression risk:** Both migration skills are modified. Run a smoke test of /rewrite and /upgrade after this story ships to confirm:
- Skills still reach options/gap+risk phase without error
- Existing output structure preserved (PO sections are additive)

### DevOps / Platform Team

No changes.

### Future Developer — Follow-on Work

If the options structure of /rewrite or /upgrade changes in a future story, update the PO framework insertion points accordingly. The PO framework subsections (a)-(d) must remain associated with each option — not moved to a standalone section separate from the options.

---

## Test Cases

### Positive Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | rewrite PO framework — what if not resolved | /rewrite with Angular 15 source | PO section (a) contains Angular 15 EoL status with source URL and retrieved date from agent bundle | AC-F4 |
| P-U2 | rewrite PO framework — tradeoffs | /rewrite with React 18 target | PO section (b) contains React 18 ecosystem_health signal with citation; tooling_availability with citation | AC-F4 |
| P-U3 | rewrite PO framework — how to verify | /rewrite with any input | PO section (d) contains target stack EoL confirmation (active/UNKNOWN) with citation or WARNING | AC-F4 |
| P-U4 | upgrade PO — what if not resolved | /upgrade with .NET 6 source | "What happens if not resolved" contains .NET 6 EoL date with citation from learn.microsoft.com/lifecycle | AC-F5 |
| P-U5 | upgrade PO — whether can remain | /upgrade with any input | "Whether it can remain" section present with application-layer breaking changes marked [project-specific] | AC-F5 |
| P-U6 | confidence rendering — high | Agent returns high confidence fact | Fact rendered as: "{value} [{source_url}, {retrieved_date}]" | AC-F3 |
| P-U7 | confidence rendering — UNKNOWN | Agent returns UNKNOWN for a fact | Fact rendered as: "WARNING: {fact_type} not found -- check: {canonical_url}" | AC-F3 |

### Negative Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | rewrite — graceful degradation | Agent returns empty bundle | All agent-groundable PO fields show [project-specific]; PO sections still present; no error surfaced to developer | AC-F4 |
| N-U2 | upgrade — confidence=low rendering | Agent returns low-confidence CVE exposure | CVE exposure rendered as WARNING with canonical_url; not stated as established fact | AC-F3 |
| N-U3 | Regression — existing rewrite content preserved | /rewrite with any input | Options matrix and existing narrative content unchanged; PO sections added after existing content, not replacing it | AC-F4 |
| N-U4 | Regression — existing upgrade content preserved | /upgrade with any input | Gap+risk table unchanged; PO sections added after the table, not replacing it | AC-F5 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full rewrite flow with agent + PO framework | Run /rewrite end-to-end on a test project | Agent invoked at options phase; bundle grounded; all 4 PO sections present per option; confidence rendering applied | AC-F3, AC-F4 |
| INT-2 | Full upgrade flow with agent + PO sections | Run /upgrade end-to-end on a test project | Agent invoked at gap+risk phase; EoL grounded; 2 PO sections present after gap+risk table | AC-F3, AC-F5 |

> NF AC verification (AC-F3):
> confidence=high rendering: verified by observing at least one grounded fact in the options output — format must include source URL and retrieved date.
> confidence=UNKNOWN rendering: verified by providing an obscure stack input — format must show WARNING with canonical_url, never a stated fact.

---

### Revision Log

2026-09-26 — Story 4 tech spec drafted
