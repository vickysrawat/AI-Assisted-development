# ICEA — Test Plan Generation Skill (`test-plan`)
Plugin development · Feature: test-plan skill
Document type: ICEA — Epic
Status: Implemented
Prepared: 2026-09-19
Implemented: 2026-09-20

---

## Intent

Create a standalone `test-plan` skill that generates a structured QA test
plan from any approved plugin artifact — Tech Spec, upgrade ledger, rewrite
cluster ledger, or replatform ledger. The skill maps artifact acceptance
criteria or behavioral contracts to concrete, executable test cases. It is
reusable across the ICEA family and the migration family, invoked directly
by developers and called internally by other skills.

---

## Context

**Current gap.** No test plan artifact exists anywhere in the plugin
workflow. After any skill produces its output artifact, QA has no
structured, traceable path to test cases.

**Why a standalone skill.** The test plan pattern is identical across
workflow families — read a source artifact, classify its requirements or
behavioral contracts, generate suites and TCs. A standalone skill avoids
duplicating this logic inside icea-implement, upgrade, rewrite, and
replatform, and lets any of them call a single interface.

**Source types and what they drive:**

| Source       | Input artifact               | Test plan focus                          |
|--------------|------------------------------|------------------------------------------|
| `icea`       | Approved Tech Spec           | AC → TC mapping                          |
| `upgrade`    | Upgrade ledger               | Behavioural equivalence before/after     |
| `rewrite`    | Rewrite cluster ledger       | BAL-level equivalence per cluster        |
| `replatform` | Replatform ledger + NFR spec | NFR validation in new hosting env        |

**Epic vs Story (icea source only).** For standalone Stories, the plan is
generated in one shot. For Epics, the plan is built incrementally —
skeleton on Epic ICEA approval, one suite per story as each Tech Spec is
approved, cross-cutting suites when the last story is approved.

**Budget constraint.** Large Epics (≥4 stories) or migration plans with
many clusters can exceed session budget. The skill detects this and
presents four options: subagent mode, incremental, lightweight stubs, or
selective. The `--subagent` flag forces subagent mode on any invocation.

**Reference output.** The ADO-87708 test plan (9 suites, 75 TCs, execution
tracker, exit criteria, mandatory smoke-test sign-off gate) is the target
format for `--source icea`.

---

## Examples

**Standalone Story — icea source**
`SAVE TEST ADO-12345` → skill prompts "Generate test plan? Y/N" → Y →
reads approved Tech Spec → generates complete plan in one shot.

**Epic — icea source, incremental**
Epic ICEA approved → skill prompts → Y → skeleton written with story stubs.
`SAVE TECH ADO-12345` (Story 2) → skill prompts → Y → Suite 2 expanded.
Last story approved → simplified two-choice prompt → A → cross-cutting
suites generated via subagents.

**Budget warning — 6-story Epic**
Skill detects 6 stories, shows warning with options A–D. Developer picks B.
Skeleton written. Footer: `SAVE TEST ADO-{ID} --subagent` available anytime.

**Upgrade source**
`SAVE TEST ADO-12345 --source upgrade` → prompt → Y → reads upgrade ledger
→ generates pre/post-upgrade smoke, per-layer regression, breaking-change
verification suites.

**Rewrite source — separate + combined**
Rewrite skill calls test-plan after each cluster passes BAL gate →
`ADO-12345-cluster-1.test-plan.md` generated. When last cluster done →
main agent reads all cluster files → assembles
`ADO-12345-rewrite.test-plan.md` (combined doc + cross-cluster integration
suite). QA executes from cluster files; stakeholders use combined doc.

**Replatform source**
`SAVE TEST ADO-12345 --source replatform` → prompt → Y → reads replatform
ledger + NFR spec → generates NFR validation suites (performance,
availability, security, observability, DR).

**Expand stubs**
Developer picked Option C (lightweight). Later:
`EXPAND TEST ADO-12345 Suite-3` → Suite 3 expanded from Story 3 Tech Spec
via subagent.

---

## Acceptance Criteria

---

### Story 1 — Skill infrastructure

**AC-F1** The skill exists as a standalone file at
`skills/test-plan/SKILL.md` with its own entry point, invocable directly
by developers and by other skills.

**AC-F2** The skill accepts a `--source` flag with four valid values:
`icea`, `upgrade`, `rewrite`, `replatform`. When omitted, the skill
auto-detects by inspecting the ADO ID's artifact files on disk in this
order: approved Tech Spec → upgrade ledger → rewrite ledger → replatform
ledger. If no artifact is found, the skill halts with a clear message.

**AC-F3** The skill accepts a `--subagent` flag that forces parallel
subagent generation regardless of source type or artifact size.

**AC-F4** All test plan writes follow the Write Gate — diff + target path
shown, written only on `APPROVE ADO-{ID}`.

**AC-F5** Output path convention:
- icea / upgrade / replatform:
  `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-[feature].test-plan.md`
- rewrite per-cluster:
  `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-cluster-{N}.test-plan.md`
- rewrite combined:
  `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-rewrite.test-plan.md`

---

### Story 2 — `--source icea`, standalone Story

**AC-F6** When invoked for a non-Epic ADO with an approved Tech Spec, the
skill prompts: *"Tech Spec approved for ADO-{ID}. Generate test plan?
Y/N"* before generating anything. If N, the skill exits cleanly with a
reminder: `Run SAVE TEST ADO-{ID} when ready.`

**AC-F7** On Y, the skill generates a complete test plan containing:
Overview, Environment Requirements, Suite table with effort estimates, all
test suites with concrete TCs, Execution Tracker, Exit Criteria.

**AC-F8** Each TC contains: TC ID, Priority (Critical / High / Medium),
Type (Manual UI / API / Manual SQL / Performance), AC reference, numbered
Steps, Expected result, Fail condition where applicable.

**AC-F9** Every TC maps to at least one AC from the approved Tech Spec. No
TC is generated without an AC reference.

**AC-F10** The Execution Tracker contains one row per TC: TC ID, Suite,
Priority, Tester (blank), Date (blank), Status (⬜), Notes (blank).

**AC-F11** AC layer classification maps AC keyword patterns to suite types:

| Keywords in AC                            | Suite type             |
|-------------------------------------------|------------------------|
| migration, backfill, schema, FK           | Migration Verification |
| API, endpoint, controller, HTTP, 4xx      | API & Backend          |
| Angular, grid, dropdown, ag-grid, column  | UI — [feature scope]   |
| renderer, report, display, format, symbol | Report Renderer        |
| admin, management page, CRUD, deactivate  | Admin Management       |
| regression, existing, unchanged           | Regression             |
| XSS, injection, auth, 401, 403, token     | Security               |
| performance, latency, load time           | Non-Functional         |

**AC-F12** Exit Criteria contain: minimum Critical TCs required to pass per
suite, zero open Critical defects gate, and any mandatory sign-off TCs
derived from the Tech Spec (e.g. smoke test checklists).

---

### Story 3 — `--source icea`, Epic

**AC-F13** When an Epic ICEA is approved, the skill prompts: *"Epic ICEA
approved for ADO-{ID}. Generate test plan skeleton? Y/N"*. On Y, generates
a skeleton: Overview, Environment Requirements, Suite table with story
stubs (⚠ Stub markers), stub suite sections per story, stub sections for
Regression / Security / NFR, empty Execution Tracker, partial Exit
Criteria. No story Tech Spec files are read. Input context stays under 8K
tokens.

**AC-F14** The skeleton embeds a hidden metadata block (HTML comment)
recording: Epic ADO ID, each story's derived suite name, expected
tech-spec filename, and `status: stub`.

**AC-F15** When `SAVE TECH ADO-{ID}` or `SAVE TEST ADO-{ID}` completes for
an Epic story, the skill prompts: *"Story N Tech Spec approved. Expand
Suite N in the test plan? Y/N"*. On Y, reads the existing plan, locates
the story's stub suite via the metadata block, and expands it with concrete
TCs derived from that story's ACs using AC-F11 classification.

**AC-F16** After expansion: metadata block updated (`status: generated`,
tech-spec filename recorded); Execution Tracker rows for new TCs appended;
existing rows untouched.

**AC-F17** When the last story's Tech Spec is approved and its suite is
expanded, the skill shows a targeted two-choice prompt:

```
ℹ All story suites complete — ready to generate Regression, Security,
  and NFR suites.
  Estimated cost: ~{N}K tokens (subagents, one per suite).

  A) Generate now with subagents   [Recommended]
  B) Defer — run REFRESH TEST ADO-{ID} when ready

Reply A or B.
```

On A, spawns one subagent per cross-cutting suite. Each subagent receives
all ACs across all approved story Tech Specs. Exit Criteria finalised on
completion.

**AC-F18** `REFRESH TEST ADO-{ID}` re-generates any stub suite whose story
has an approved Tech Spec, and re-generates cross-cutting suites if all
stories are approved. Prompts before overwriting any `generated` suite.
`--force` skips the prompt.

---

### Story 4 — Budget warning and options

**AC-F19** When invoked for an Epic with ≥N stories (N configurable via
`.claude/settings.json` → `testPlanBudgetWarnThreshold`, default 4,
minimum 2), the skill shows the budget warning before generating anything.
The warning displays: story count, estimated token cost, remaining session
budget, options A–D, and the footer:
`ℹ You can switch to subagent mode at any time with:
  SAVE TEST ADO-{ID} --subagent`

**AC-F20 — Option A (Subagent mode):** One subagent per suite, parallel.
Main context assembles results and writes the complete plan. On subagent
failure: warn which suite failed, leave it as a stub, offer `RETRY` for
that suite only.

**AC-F21 — Option B (Incremental):** Generate skeleton only (AC-F13–F14).
Subsequent `SAVE TECH` triggers expand suites with developer prompt per
AC-F15. Default if no reply is received within the session turn.

**AC-F22 — Option C (Lightweight):** Generate all suites as TC stubs —
title, priority, AC reference, empty Steps and Expected. `EXPAND TEST
ADO-{ID}`, `EXPAND TEST ADO-{ID} Suite-N`, `EXPAND TEST ADO-{ID} TC-{ID}`
expand stubs on demand via subagent.

**AC-F23 — Option D (Selective):** Lists all derived suites with estimated
TC counts. Developer replies with suite numbers to generate fully;
remaining become stubs.

**AC-F24** The `--subagent` flag forces Option A behaviour for any
invocation — standalone Story, Epic of any size, or migration source —
with no budget warning and no developer prompt shown.

---

### Story 5 — Commands and keywords

**AC-F25** `SAVE TEST ADO-{ID}` — manual trigger; generates or refreshes
the test plan for any ADO. Registered in §0a keyword handler table.

**AC-F26** `SAVE TEST ADO-{ID} --source {type}` — explicit source
override.

**AC-F27** `SAVE TEST ADO-{ID} --subagent` — force subagent mode, no
prompts.

**AC-F28** `EXPAND TEST ADO-{ID}` — expands all stub suites that have an
approved source artifact on disk.

**AC-F29** `EXPAND TEST ADO-{ID} Suite-N` — expands a single named suite.

**AC-F30** `EXPAND TEST ADO-{ID} TC-{ID}` — expands a single TC stub to
full steps.

**AC-F31** `REFRESH TEST ADO-{ID}` — re-generates cross-cutting suites
from current source artifact. Behaviour per AC-F18.

**AC-F32** `REFRESH TEST ADO-{ID} --combine` — re-generates the combined
rewrite document (`ADO-{ID}-rewrite.test-plan.md`) from current cluster
files. No cluster files are modified.

All commands follow the Write Gate.

---

### Story 6 — `--source upgrade`

**AC-F33** When invoked with `--source upgrade`, the skill reads the
upgrade ledger (`payload.upgrade`) — source version, target version, hops,
per-layer changes, breaking changes.

**AC-F34** The plan contains four fixed suites:

| Suite                        | Content                                               |
|------------------------------|-------------------------------------------------------|
| Pre-upgrade baseline         | Smoke TCs verifying current behaviour on source ver   |
| Post-upgrade equivalence     | Per-layer TCs (API, UI, DB) comparing before/after    |
| Breaking change verification | One TC per documented breaking change                 |
| Regression                   | Cross-layer TCs for unchanged behaviour               |

**AC-F35** Each equivalence TC specifies: input, expected output on source
version, expected output on target version, pass condition (identical /
documented delta).

**AC-F36** If the upgrade has multiple hops, the plan includes a
verification checkpoint suite per intermediate hop derived from that hop's
changed surface area in the ledger.

**AC-F37** Exit Criteria gate: all Post-upgrade equivalence TCs must pass
before the upgrade ledger status can advance to `verified`.

---

### Story 7 — `--source rewrite`

**AC-F38** When invoked with `--source rewrite`, the skill reads the
rewrite ledger (`payload.rewrite`) — clusters, BAL per cluster, ERL,
source behavior documentation.

**AC-F39** The skill generates one cluster file per cluster
(`ADO-{ID}-cluster-{N}.test-plan.md`). Suite depth is determined by the
cluster's BAL level:

| BAL   | Suite depth                                                             |
|-------|-------------------------------------------------------------------------|
| BAL-1 | Smoke TCs — does it start, health check passes, primary endpoint responds |
| BAL-2 | Functional TCs — key user journeys produce correct outputs              |
| BAL-3 | Full equivalence — comprehensive input/output mapping including edge cases and error paths |

**AC-F40** Each TC in a cluster file specifies: input payload or user
action, expected output from source implementation, expected output from
rewritten implementation, pass condition.

**AC-F41** Cluster files are the source of truth. QA executes from cluster
files and marks pass/fail in the cluster file execution tracker. Cluster
files are not auto-regenerated — only `REFRESH TEST ADO-{ID} --force`
overwrites a generated cluster file.

**AC-F42** When the last cluster file is generated, the main agent reads
all cluster files and assembles a single combined document
(`ADO-{ID}-rewrite.test-plan.md`) containing: a roll-up execution tracker
(all TC rows across all clusters), a cross-cluster integration suite (TCs
covering interactions between clusters documented in the rewrite ledger),
and overall Exit Criteria. The combined document header states:
*"Generated from cluster files — source of truth is individual cluster
files. Do not edit this document directly."*

**AC-F43** `REFRESH TEST ADO-{ID} --combine` regenerates the combined
document from the current cluster files without modifying any cluster file.

**AC-F44** Exit Criteria gate per cluster: all TCs at the cluster's BAL
level must pass before the rewrite merge gate opens for that cluster. The
combined document's Exit Criteria gate: all cluster gates passed + all
cross-cluster integration TCs passed.

---

### Story 8 — `--source replatform`

**AC-F45** When invoked with `--source replatform`, the skill reads the
replatform ledger (`payload.replatform`) and the NFR spec captured during
the replatform skill's Gap + Risk phase.

**AC-F46** The plan contains one suite per NFR domain:

| Suite             | Focus                                                       |
|-------------------|-------------------------------------------------------------|
| Performance       | Latency SLAs, throughput targets — each TC states the measurable threshold |
| Availability      | Failover RTO/RPO, health probe response, graceful degradation |
| Security          | Cloud security controls active, secrets not exposed         |
| Observability     | Logs flowing, metrics emitting, alerts firing               |
| Disaster Recovery | DR procedure executes within documented RTO/RPO             |

**AC-F47** Each TC specifies: the NFR being validated, the measurement
method (load test tool, probe command, log query), the pass threshold, and
the environment the test must run against (DEV / QA / Staging / Prod).

**AC-F48** TCs reference specific NFR entries from the replatform ledger.
No TC is generated for an NFR not present in the ledger.

**AC-F49** Exit Criteria gate: all Performance and Availability TCs must
pass before the replatform cutover gate opens.

---

### Story 9 — Caller integration

**AC-F50** `icea-implement` calls the test-plan skill after code generation
completes and the checkin gate passes, passing `--source icea`. The
developer prompt (AC-F6) is shown. If the developer replies N or the skill
fails, icea-implement logs a warning but does not block story closure.

**AC-F51** The `upgrade` skill calls the test-plan skill after the final
hop is verified, passing `--source upgrade --subagent` (no prompt, no
budget warning). The generated plan path is recorded in the upgrade ledger
under `payload.upgrade.testPlanPath`.

**AC-F52** The `rewrite` skill calls the test-plan skill after each cluster
passes its BAL gate, passing `--source rewrite --subagent` and the cluster
index. The cluster file path is recorded in the rewrite ledger under
`payload.rewrite.clusters[N].testPlanPath`. When the last cluster is
processed, the combined document is auto-generated and its path recorded
under `payload.rewrite.combinedTestPlanPath`.

**AC-F53** The `replatform` skill calls the test-plan skill after IaC
authoring is complete, passing `--source replatform --subagent`. The plan
path is recorded in the replatform ledger under
`payload.replatform.testPlanPath`.

---

### Non-Functional

**AC-NF1** Standalone Story (`--source icea`) plan generation completes
within session budget without triggering the budget warning.

**AC-NF2** Epic skeleton generation uses fewer than 8K input tokens.

**AC-NF3** Per-suite expansion (one story) uses fewer than 15K input
tokens.

**AC-NF4** Each subagent in Option A or cross-cutting suite generation uses
fewer than 20K input tokens.

**AC-NF5** Migration source plans (`--source upgrade/rewrite/replatform`)
complete within session budget for ledgers up to 10 clusters or hops
without triggering the budget warning.

**AC-NF6** The skill registers in `_deploy-manifest.json` and is deployed
by `setup-init` to target projects.

---

## Open Questions

_All resolved._

| OQ | Resolution |
|----|------------|
| OQ1 | Prompt the developer before generating — not silent auto-trigger |
| OQ2 | Budget warning fires again for cross-cutting suites, simplified to two choices (A: subagents now / B: defer with REFRESH TEST) |
| OQ3 | Separate per-cluster files (source of truth) + main agent assembles combined doc. Combined doc auto-generated when last cluster done; regenerated via `REFRESH TEST ADO-{ID} --combine`. Cross-cluster integration suite lives in combined doc only. |

---

## Revision Log

2026-09-19 — Initial draft. 9 stories, 53 functional ACs, 6 NFR ACs.
             All OQs resolved. Status: In Progress.
2026-09-20 — Implementation complete. SKILL.md written, keyword handlers added to
             CLAUDE.md and _project-deploy/CLAUDE.md, caller integration added to
             icea-implement, upgrade, rewrite, and replatform. Status: Implemented.
