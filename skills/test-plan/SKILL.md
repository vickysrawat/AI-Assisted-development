---
name: test-plan
description: >
  Generates a structured QA test plan from any approved plugin artifact — Tech Spec
  (--source icea), upgrade ledger (--source upgrade), rewrite cluster ledger
  (--source rewrite), or replatform ledger (--source replatform). Maps acceptance
  criteria or behavioral contracts to concrete, executable test cases. Reusable across
  the ICEA family and the migration family — invoked directly by developers and called
  internally by icea-implement, upgrade, rewrite, and replatform.
  Triggers on: "generate test plan", "create test plan", "SAVE TEST ADO-{ID}",
  "EXPAND TEST ADO-{ID}", "REFRESH TEST ADO-{ID}".
---

# Skill: test-plan — QA test plan generator

_Skill version: 1.0 · Last changed: 2026-09-19 · Plugin compatibility: ≥3.25.0 · Consent: C_

> ICEA: `docs/plans/test-plan-skill/ICEA.md`
> ⚠ **Write Gate** (CLAUDE.md §0): no test plan file is written until `APPROVE ADO-{ID}`.

## Purpose

Generate a structured QA test plan from an approved plugin artifact. The plan maps
every Acceptance Criterion (or behavioral contract) to concrete, executable test cases
with steps, expected results, and an execution tracker.

This skill is the single test-plan engine for the plugin. It is called:
- Directly by developers via keyword commands
- Internally by `icea-implement`, `upgrade`, `rewrite`, and `replatform`

---

## Resolve PLUGIN_DIR — before any step

```
Read .claude/plugin-path.txt → PLUGIN_DIR
(if absent: §1a resolver from $PLUGIN_DIR/skills/shared/plugin-path-resolution.md)
```

---

## Keyword commands (§0a handlers)

| Command | Behaviour |
|---|---|
| `SAVE TEST ADO-{ID}` | Generate or refresh the test plan for any ADO |
| `SAVE TEST ADO-{ID} --source {type}` | Explicit source override (icea/upgrade/rewrite/replatform) |
| `SAVE TEST ADO-{ID} --subagent` | Force subagent mode — no prompts, no budget warning |
| `EXPAND TEST ADO-{ID}` | Expand all stub suites with an approved source artifact on disk |
| `EXPAND TEST ADO-{ID} Suite-N` | Expand a single named suite |
| `EXPAND TEST ADO-{ID} TC-{ID}` | Expand a single TC stub to full steps |
| `REFRESH TEST ADO-{ID}` | Re-generate cross-cutting suites from current source artifact |
| `REFRESH TEST ADO-{ID} --combine` | Re-assemble the rewrite combined doc from cluster files |

All writes follow the Write Gate. `--subagent` suppresses developer prompts and budget
warnings; it is the mode used by internal callers (icea-implement, upgrade, rewrite,
replatform).

---

## Output paths

| Source | Primary output | Notes |
|---|---|---|
| `icea` (Story) | `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-[feature].test-plan.md` | Single file |
| `icea` (Epic) | Same path | Skeleton first; suites added incrementally |
| `upgrade` | `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-[feature].test-plan.md` | Single file |
| `rewrite` (per cluster) | `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-cluster-{N}.test-plan.md` | Source of truth |
| `rewrite` (combined) | `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-rewrite.test-plan.md` | Reporting artefact |
| `replatform` | `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-[feature].test-plan.md` | Single file |

Infer Release and Sprint from the ADO ID's ICEA/ledger path on disk.

---

## Step 1 — Resolve ADO ID and source type

1. Extract ADO ID from the command. Normalise: `ADO-1847`, `ADO #1847`, `1847` all resolve the same.
2. Resolve `--source` flag. If omitted, auto-detect by checking for artifacts on disk in this order:
   ```
   docs/**/*ADO-{ID}*.techspec.md  → source: icea
   .claude/migrations/{ID}/payload.upgrade  → source: upgrade
   .claude/migrations/{ID}/payload.rewrite  → source: rewrite
   .claude/migrations/{ID}/payload.replatform → source: replatform
   ```
   If no artifact is found, halt:
   ```
   ⚠ No approved artifact found for ADO-{ID}.
     Run SAVE TECH ADO-{ID} (icea), or check that a migration ledger exists
     under .claude/migrations/{ID}/.
   ```
3. Check for `--subagent` flag. If present, skip all developer prompts and budget warnings
   throughout this skill — internal-caller mode.

---

## Step 2 — Developer prompt (skipped when --subagent)

Show a single prompt before generating anything:

**Standalone Story / upgrade / replatform:**
```
Tech Spec / ledger approved for ADO-{ID}. Generate test plan? Y/N
(Source: {source type} · Estimated output: {N} suites)
```

**Epic skeleton:**
```
Epic ICEA approved for ADO-{ID}. Generate test plan skeleton? Y/N
(Suites will fill in as each story's Tech Spec is approved)
```

**Epic suite expansion:**
```
Story {N} Tech Spec approved. Expand Suite {N} in the test plan? Y/N
```

If N, exit cleanly:
```
ℹ Test plan generation skipped. Run SAVE TEST ADO-{ID} when ready.
```

---

## Step 3 — Budget check (Epic icea source only, skipped when --subagent)

Count the story list from the Epic ICEA. If story count ≥ `testPlanBudgetWarnThreshold`
(from `.claude/settings.json`, default 4, minimum 2), show the budget warning before
generating anything:

```
⚠ BUDGET WARNING — This Epic has {N} stories.
  Estimated token cost: ~{X}K | Remaining session budget: ~{Y}K

  Choose how to proceed:

  A) Subagent mode    Full plan generated now using parallel subagents per suite.
                      Higher total token cost but completes in one shot. [Recommended]

  B) Incremental      Generate skeleton now. Each suite fills in automatically
                      when its story's Tech Spec is approved. Cheapest option.

  C) Lightweight      Generate all suites now as TC stubs (title + priority + AC ref,
                      no steps). Expand later with EXPAND TEST ADO-{ID} [Suite-N|TC-ID].

  D) Selective        Choose which suites to generate now. Rest remain stubs.

Reply A, B, C, or D.
ℹ You can switch to subagent mode at any time with: SAVE TEST ADO-{ID} --subagent
```

Default to Option B if no reply is received within the session turn.

For Option D, list all derived suites with estimated TC counts and wait for the
developer to reply with suite numbers (e.g. `1,2,3`).

---

## Step 4 — AC layer classification

Used by all `--source icea` generation paths to map ACs to suite types.

| Keywords found in the AC text | Suite type assigned |
|---|---|
| migration, backfill, schema, FK, table, column | Migration Verification |
| API, endpoint, controller, HTTP, 4xx, 401, 403, Bearer | API & Backend |
| Angular, grid, dropdown, ag-grid, column, checkbox, modal | UI — [feature scope] |
| renderer, report, display, format, symbol, cell, concat | Report Renderer |
| admin, management page, CRUD, create, deactivate, activate | Admin Management |
| regression, existing, unchanged, unaffected, prior | Regression |
| XSS, injection, auth, token, expired, role, permission | Security |
| performance, latency, load time, throughput, p99, SLA | Non-Functional |

A single AC may produce TCs in multiple suites if it spans layers.

---

## Step 5a — Generate: `--source icea`, standalone Story

Read the approved Tech Spec. Classify every AC using Step 4. Generate the full test plan:

### Test plan structure

```markdown
# Test Plan — {Feature Name}
ADO #{ID} · Release {R} · Sprint {S}
Document type: QA Test Plan
Prepared: {date}

---

## Overview
{1–2 sentences: what this plan covers, mandatory execution order if any}

## Environment Requirements
| Item | Requirement |
|---|---|
| {env item} | {value} |

## Test Suites
| Suite | Title | When to run | Effort |
|---|---|---|---|
| Suite {N} | {title} | {trigger} | {X} min |

**Estimated total effort: ~{N} hours for a full pass.**

---

## Suite {N} — {Title}
> {context for this suite}

### TC-{PREFIX}-01 — {Title}
**Priority:** {Critical|High|Medium}
**Type:** {Manual UI|API|Manual SQL|Performance}
**AC:** {AC-F1}

**Steps:**
1. {step}
2. {step}

**Expected:** {outcome}
**Fail condition:** {what constitutes failure} _(omit if obvious from Expected)_

---

## Test Execution Tracker
| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-{PREFIX}-01 | {Suite} | {Priority} | | | ⬜ | |

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## Exit Criteria
### Minimum for story to close
- [ ] All Critical TCs passed
- [ ] Zero open Critical defects
- [ ] {any mandatory smoke-test sign-off TCs}
```

**TC ID prefix convention:** derive a 3-letter uppercase prefix from the suite name
(e.g. Migration → MIG, API → API, Field Access → FA, Renderer → RND, Admin → ADM,
Regression → REG, Security → SEC, Non-Functional → NFR).

**TC content rules:**
- Every TC maps to at least one AC — include `**AC:** {AC-Fxx}` on every TC
- Fail condition only when the failure mode is non-obvious
- SQL queries, API payloads, and curl commands are included verbatim when the AC
  specifies them or when precision is needed for correctness
- Mandatory sign-off TCs (e.g. smoke test checklists) are Priority: Critical and noted
  in Exit Criteria as hard gates

---

## Step 5b — Generate: `--source icea`, Epic skeleton

Read the Epic ICEA only (no story Tech Specs). Derive suite names from story titles.
Generate the skeleton with stub sections:

```markdown
<!-- test-plan-state
epic: ADO-{ID}
stories:
  - id: Story-1
    suite: "Suite 2"
    tech-spec: null
    status: stub
  - id: Story-2
    suite: "Suite 3"
    tech-spec: null
    status: stub
cross-cutting-suites-status: stub
-->
```

Each story suite section is a stub:

```markdown
## Suite {N} — {Story N title}  ⚠ Stub

> When to run: after Story {N} deploys.
> This suite will be generated when Story {N}'s Tech Spec is approved.
```

Cross-cutting suite stubs (Regression, Security, NFR):

```markdown
## Suite {N} — Regression  ⚠ Stub
> Will be generated when all story Tech Specs are approved.
```

Execution Tracker contains header only — no TC rows until suites are expanded.

---

## Step 5c — Generate: `--source icea`, Epic suite expansion

Triggered by `SAVE TECH ADO-{ID}` for an Epic story, or `EXPAND TEST ADO-{ID}`.

1. Read the existing test plan. Parse the metadata block to find the story's stub suite.
2. Read the story's Tech Spec. Classify ACs using Step 4.
3. Replace the stub section with full TCs (Step 5a format).
4. Update the metadata block: `status: generated`, `tech-spec: {filename}`.
5. Append new TC rows to the Execution Tracker. Do not modify existing rows.

**Cross-cutting suites — last story trigger:**

When the last story's Tech Spec is approved, show the two-choice prompt (unless
`--subagent`):

```
ℹ All story suites complete — ready to generate Regression, Security, and NFR suites.
  Estimated cost: ~{N}K tokens (subagents, one per suite).

  A) Generate now with subagents   [Recommended]
  B) Defer — run REFRESH TEST ADO-{ID} when ready

Reply A or B.
```

On A (or `--subagent`): spawn one subagent per cross-cutting suite. Each subagent
receives all ACs across all approved story Tech Specs. Assemble results. Finalise
Exit Criteria. Update metadata: `cross-cutting-suites-status: generated`.

On B: leave cross-cutting suites as stubs. Note: `REFRESH TEST ADO-{ID}` will
generate them when the developer is ready.

On subagent failure: warn which suite failed, leave it as a stub, offer:
```
Reply RETRY Suite-{name} to attempt that suite again.
```

---

## Step 6 — Generate: `--source upgrade`

Read `payload.upgrade` from the migration ledger. Extract: source version, target
version, hops, per-layer changes, breaking changes.

Generate four fixed suites:

**Suite 1 — Pre-upgrade baseline**
Smoke TCs verifying the current application works correctly on the source version.
One TC per major functional area identified in the ledger. Type: Manual UI / API.

**Suite 2 — Post-upgrade functional equivalence**
Per-layer TCs comparing before/after behaviour on identical inputs.

| Sub-suite | TC content |
|---|---|
| API layer | Same endpoint, same request → same response shape and status |
| UI layer | Same user action → same rendered output |
| DB layer | Same query → same schema, same data shape |

Each TC specifies:
- Input (request payload / user action / SQL query)
- Expected output on source version
- Expected output on target version
- Pass condition: `identical` or `documented delta: {description}`

**Suite 3 — Breaking change verification**
One TC per documented breaking change in the ledger. Each TC verifies the handling
strategy is implemented (e.g. deprecated API replaced, config updated).

**Suite 4 — Regression**
Cross-layer TCs for functionality that must be unchanged after the upgrade.
Derive from the ledger's unchanged-surface documentation.

**Multi-hop:** if the upgrade has multiple hops (e.g. .NET 6 → 7 → 8), add a
verification checkpoint suite per intermediate hop, scoped to that hop's changed
surface area.

**Exit Criteria gate:** all Post-upgrade equivalence TCs (Suite 2) must pass before
the upgrade ledger status can advance to `verified`.

Record the test plan path in the ledger:
```
payload.upgrade.testPlanPath = {path}
```

---

## Step 7 — Generate: `--source rewrite`

Read `payload.rewrite` from the migration ledger. Extract: clusters, BAL per cluster,
ERL, source behavior documentation.

**Per-cluster file generation** (`ADO-{ID}-cluster-{N}.test-plan.md`):

Generate one file per cluster. Suite depth is determined by the cluster's BAL level:

| BAL | Suite content |
|---|---|
| BAL-1 | Smoke TCs only: does the cluster start, health check passes, primary endpoint responds, basic happy path returns 200 |
| BAL-2 | Functional TCs: key user journeys produce correct outputs for the 5–10 most important scenarios |
| BAL-3 | Full equivalence: comprehensive input/output mapping, edge cases, error paths, boundary conditions |

Each TC specifies:
- Input payload or user action (copy from source behavior documentation)
- Expected output from source implementation
- Expected output from rewritten implementation
- Pass condition

Each cluster file includes its own Execution Tracker and Exit Criteria:
```
Exit Criteria — Cluster {N}
- [ ] All TCs at BAL-{N} depth passed
- [ ] Zero open Critical defects
```

Record each cluster file path in the ledger:
```
payload.rewrite.clusters[N].testPlanPath = {path}
```

**Combined document assembly** (triggered when last cluster file is generated):

The main agent reads all cluster files and assembles `ADO-{ID}-rewrite.test-plan.md`:

```markdown
# Test Plan — {Feature} Rewrite (Combined)
ADO #{ID} · Generated from cluster files
**Source of truth:** individual cluster files. Do not edit this document directly.
Regenerate with: REFRESH TEST ADO-{ID} --combine

---
## Roll-up Execution Tracker
{all TC rows from all cluster files, labelled with cluster source}

---
## Cross-cluster Integration Suite
{TCs covering interactions between clusters per the rewrite ledger's
cross-cluster dependency documentation}

---
## Overall Exit Criteria
- [ ] All cluster-level exit criteria passed
- [ ] All cross-cluster integration TCs passed
```

Record the combined doc path:
```
payload.rewrite.combinedTestPlanPath = {path}
```

**`REFRESH TEST ADO-{ID} --combine`:** re-assemble the combined doc from current
cluster files without modifying any cluster file.

---

## Step 8 — Generate: `--source replatform`

Read `payload.replatform` from the migration ledger and the NFR spec captured during
the replatform skill's Gap + Risk phase.

Generate one suite per NFR domain. Only generate a suite for an NFR domain that has
at least one entry in the ledger — never fabricate TCs for undocumented NFRs.

| Suite | Focus | TC shape |
|---|---|---|
| Performance | Latency SLAs, throughput targets | Input: load profile. Measurement: tool + command. Threshold: p99 ≤ {X}ms at {N} RPS. Environment: Staging/Prod. |
| Availability | Failover RTO/RPO, health probe | Action: kill primary. Measurement: time to restore. Threshold: RTO ≤ {X}s. |
| Security | Cloud security controls, secrets posture | Check: control active in portal / policy. Pass: control shows Enabled / Compliant. |
| Observability | Logs, metrics, alerts in new env | Action: trigger a known event. Measurement: query log/metric. Pass: entry appears within {X}s. |
| Disaster Recovery | DR procedure within RTO/RPO | Action: execute DR runbook steps. Measurement: time to recovery. Pass: within documented RTO/RPO. |

Each TC includes:
- NFR being validated (cite the ledger entry)
- Measurement method (load test tool / probe command / log query / portal check)
- Pass threshold (quantitative where possible)
- Environment the test must run against (DEV / QA / Staging / Prod)

**Exit Criteria gate:** all Performance and Availability TCs must pass before the
replatform cutover gate opens.

Record the test plan path in the ledger:
```
payload.replatform.testPlanPath = {path}
```

---

## Step 9 — Lightweight mode (Option C)

Generate all suite sections as TC stubs — title, priority, AC reference, and empty
Steps / Expected placeholders:

```markdown
### TC-API-01 — GetUnitIdentifiers returns active options
**Priority:** Critical | **AC:** AC-F1 | **Type:** API
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD
```

Include all stubs in the Execution Tracker with Status ⬜.

`EXPAND TEST ADO-{ID}` — expand all stubs with approved Tech Specs (subagent per suite).
`EXPAND TEST ADO-{ID} Suite-N` — expand one named suite (subagent).
`EXPAND TEST ADO-{ID} TC-{ID}` — expand one TC stub to full steps.

---

## Step 10 — Write Gate

Show each file before writing:

```
📁 WRITE PENDING — reply APPROVE ADO-{ID} to write, or SKIP to discard.
   Path: {full/file/path}
```

For `--subagent` mode (internal callers): the caller's existing Write Gate approval
covers this write — do not show a second prompt.

After writing, output a one-line confirmation:
```
✅ Test plan written: {path} ({N} TCs across {M} suites)
```

---

## Hard Rules

- NEVER generate a TC without an AC reference (icea source) or a ledger NFR/behavioral
  contract reference (migration sources) — every TC must be traceable.
- NEVER write to disk without Write Gate approval, except when called with `--subagent`
  under a parent skill's standing approval.
- NEVER show the budget warning or developer prompts when `--subagent` is set.
- NEVER overwrite a `generated` suite without prompting, except with `--force`.
- NEVER modify cluster files during `--combine` — the combined doc is assembled read-only
  from cluster files; cluster files are the source of truth.
- NEVER generate NFR TCs for NFR domains absent from the replatform ledger.
- ALWAYS record the test plan path in the migration ledger when called by upgrade,
  rewrite, or replatform.
- ALWAYS include a Fail condition on TCs where the failure mode is non-obvious.
- ALWAYS default to Option B (incremental) if no budget-warning reply is received.
- ALWAYS use the AC layer classification table (Step 4) for suite assignment — never
  guess or hardcode suite names from memory.
- The combined rewrite document MUST include the header stating it is generated and
  should not be edited directly.
