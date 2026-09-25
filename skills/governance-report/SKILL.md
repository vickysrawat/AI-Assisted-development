---
name: governance-report
description: >
  Sprint governance & quality report — aggregates governance events, model config,
  token efficiency, and auto-generated sprint lessons with project-knowledge promotion.
  Consumer: tech lead. Triggered by GOVERNANCE REPORT or /governance-report.
---

# Governance Report Skill

_Skill version: 1.0 · Last changed: 2026-09-20 · Plugin compatibility: ≥3.25.0 · Consent: C_

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

> **Related specs:** Consent Category C — reads audit files, ledgers, and token-graph only, never application source. Severity vocabulary per `skills/shared/business-context-severity.md`.

Produces a sprint-cadence governance & quality report from existing local data. No
network calls. Designed for a tech lead to run at sprint end or before a go-live review.

---

## Persona

Acts with a **[TL] Tech Lead** lens — "did the team follow the process, and where did it break down?" Lens only; never assume, never attribute in output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Step 1 — Parse arguments

Accept: `--since YYYY-MM-DD`, `--days N`, `--sprint N`.

If `--sprint N` is provided: look up sprint date range from `docs/` file headers
(`Release{R}/Sprint{N}` folder dates). If not found, default to `--days 14`.

If neither flag provided: default to `--days 30`.

---

## Step 2 — Collect data

```bash
node "$PLUGIN_DIR/scripts/governance-report.cjs" {--since YYYY-MM-DD | --days N}
```

Read the JSON output. All sections are present even when data is missing (nulls).

If `auditAvailable: false`: warn the developer —
```
⚠ No audit trail found (.claude/audit/ is absent or empty).
  Run /setup-sync to set up governance tracking, then data will accumulate.
  Showing partial report from ledgers and token-graph only.
```

---

## Step 3 — Generate the report

Output the report in this exact structure. Skip any section whose data is entirely null.
Write the final report to `governance/governance-report-{YYYY-MM-DD}.md`.

### Header

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Governance Health Report — {project name from CLAUDE.md § 1}
  Period: {period.since} → {today}  ({period.label})
  Generated: {today} by {git config user.email}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Summary

Count events by type. Compute bypass rate from `bypassRate`. Note RBAC blocks inline.

```
## Summary

  ICEA approvals          {N}    ({N} clean · {N} with test gate bypass)
  ICEA revisions          {N}    ({N} ADOs had ≥1 revision cycle)
  Hotfix bypasses         {N}
  RBAC blocks             {N}    {⚠ if N>0}
  Finding dismissals      {N}    ({N} Critical · {N} High · {N} Medium)
  Config changes          {N}    ({N} standard · {N} high-risk)
  Standing approvals      {N}

  Bypass rate:  {bypassRate.rate}%   ({bypassRate.bypasses} of {bypassRate.approvals} approvals skipped test gate)
```

### ICEA Approvals

Table of `APPROVE_ADO` events: timestamp (date only), actor, role, verdict. Mark `⚠ --skip-test-gate` where verdict includes bypass context. Mark `⏩ {N} revisions` for ADOs that also appear in `REVISE_ADO` events.

### Gate Bypasses

Two subsections:

**Test gate bypasses** — table of `BYPASS_TEST_GATE` events with ADO, actor, date, context.

**Hotfix bypasses** — table of `BYPASS_HOTFIX` events with branch, actor, date. Note whether a matching `ai-audit.md` exists (check via `find docs -path "*${ADO_ID}*" -name "*.ai-audit.md"`).

### RBAC Blocks

If any `RBAC_BLOCK` events exist, list each: date, actor, action attempted, message. Flag actors not in `ApprovalRoles.json` with a note: "Consider adding to `tech_leads` or `security_officers`."

### Finding Dismissals

Table of `DISMISS` events: fingerprint ID, severity (from `finding_id` context), actor, role, reason, justification (truncated to 80 chars). Flag `accepted-risk` on Critical/High with `⚠`.

Also show current ledger snapshot from `ledgers`:
```
  Current open findings: {codeReview.open} code-review · {security.open} security · {dynamicScan.open} dynamic-scan
```

### Config Changes

Two subsections: standard (non-CI/CD/IaC `APPROVE_CONFIG`) and high-risk. Table: date, file path, actor, role.

### Standing Approvals

Table of `APPROVE_ALL` events: ADO, actor, role, date. Note all are session-scoped and auto-expired.

### Model Configuration & Cost Governance

**Per-invocation model distribution** — read from `modelDistribution`. This is Pass B data:
actual model recorded at each audit event (not a heuristic).

If `modelDistribution.coverage` is `'full'` or `'partial'`:
```
## Model Usage  (per-invocation — {trackedCount} of {trackedCount+untrackedCount} events tracked)

  {for each model in distribution, sorted by count desc}
    {model}: {count} invocations  ({count/trackedCount*100|toFixed(0)}%)

  {If untrackedCount > 0}: ℹ {untrackedCount} event(s) predated Pass B tracking (no model field).
  {If firstTrackedAt}: Tracking active since: {firstTrackedAt | date only}
```

If `modelDistribution.coverage` is `'none'` or `'no-events'`:
```
  Per-invocation model data: ℹ Not yet available (no tracked events in this period).
  Tracking began when Pass B was deployed — older audit events have no model field.
```

**Model tier compliance** — read from `modelCompliance`:

If `modelCompliance.allExplicit` is `false`:
```
## Model Configuration  ⚠

  ICEA generation:  {configured.ICEA_MODEL || '(plugin default — not explicitly set)'}
  Review / critic:  {configured.REVIEW_MODEL || '(plugin default — not explicitly set)'}
  Infrastructure:   {configured.INFRA_MODEL || '(plugin default — not explicitly set)'}

  ⚠ {unset.length} tier(s) not explicitly configured: {unset.join(', ')}
    Plugin defaults are used but may change on upgrade. Set explicitly in .claude/settings.json → env
    to pin your model choices and prevent unexpected cost or behaviour changes.

    Example:
      "env": { "ICEA_MODEL": "claude-opus-4-8", "REVIEW_MODEL": "claude-sonnet-4-6", "INFRA_MODEL": "claude-haiku-4-5-20251001" }
```

If `modelCompliance.allExplicit` is `true`:
```
## Model Configuration  ✅

  ICEA generation:  {configured.ICEA_MODEL}
  Review / critic:  {configured.REVIEW_MODEL}
  Infrastructure:   {configured.INFRA_MODEL}

  ✅ All model tiers explicitly configured — no drift risk on plugin upgrade.
```

**Cost estimation** — read from `costEstimate`:

If `costEstimate.available` is `false`:
```
  Cost estimate:  ℹ {costEstimate.reason}
```

If `costEstimate.available` is `true`:
```
## LLM Cost Estimate  ({currency})  — {period.label}

  Estimated spend:   ~${estimatedTotalUSD}  ({totalInputTok} input + {totalOutputTok} output tokens)
  Pricing as of:     {pricingUpdated}  (update .claude/cost-governance.json if rates have changed)

  {If monthlyBudget set:}
  Monthly budget:    ${monthlyBudget}  ·  Status: {budgetStatus === 'exceeded' ? '🔴 EXCEEDED' : budgetStatus === 'alert' ? '⚠ APPROACHING LIMIT' : '✅ Within budget'}
  Period spend:      {estimatedTotalUSD / monthlyBudget * 100 | toFixed(0)}% of monthly budget

  Top skills by estimated cost:
  {Top 5 from bySkill, sorted by estimatedUSD desc}
    {skill}: ~${estimatedUSD}  ({input} in · {output} out · {model} tier)

  {If modelDistribution.coverage == 'full'}: ✅ Cost uses actual per-invocation model data.
  {If modelDistribution.coverage == 'partial'}: ℹ Cost mixes actual data ({trackedCount} events) + tier heuristic ({untrackedCount} older events).
  {If modelDistribution.coverage == 'none'}: ⚠ Cost uses skill→tier heuristic (no per-invocation data yet).
  Update .claude/cost-governance.json when Anthropic changes pricing.
```

### Token Efficiency

If `tokenEfficiency` is null: `ℹ Run /token-analysis to populate raw token data.`

If data exists, show top expensive skills and cross-reference `revisionCycles.byAdo`:
```
## Token Efficiency

  Sessions analysed: {totalSessions}

  High-cost stories this period (revision cycles):
    ADO-{ID}: {N} revision cycle(s) — each cycle ~180K extra tokens
    ...

  Efficiency signals:
    {If any ADO had ≥2 revision cycles}: ⚠ ADO-{ID} had {N} revision cycles.
      Improving ICEA Examples specificity reduces revision cost. → candidate for project-knowledge.md
    {If ICEA avg cost high}: ⚠ ICEA generation cost is high — stale architecture docs are a common cause. Run /graph-sync.
```

### Actor Summary

Table: actor email, role, event count by type. Flag:
- Any actor with RBAC blocks
- Approval concentration (one actor handling >60% of ICEA approvals → bottleneck risk)

---

## Step 4 — Synthesise sprint lessons (LLM pass)

Using the data above, identify patterns and generate lessons. Aim for 3–6 specific, actionable lessons. Each lesson must be grounded in the data — no fabrication.

**Pattern signals to check:**

| Signal | Threshold | Lesson template |
|---|---|---|
| Bypass rate | >10% | "Test plan discipline: {N}% of approvals skipped the test gate. Consider scheduling test plan generation alongside ICEA drafting." |
| Revision cycles | Any ADO with ≥2 revisions | "ICEA quality: ADO-{IDs} each needed {N} revision cycles. Most common gap: {infer from context fields if present}. → candidate for project-knowledge.md" |
| RBAC blocks | Any | "Role configuration: {actor} was blocked {N} time(s) attempting {action}. Review ApprovalRoles.json." |
| Hotfix frequency | ≥3 | "Hotfix pressure: {N} hotfixes this period may signal delivery pressure or technical debt accumulation." |
| Accepted-risk Critical | Any | "Security posture: {N} Critical finding(s) accepted as risk. Review before next release." |
| Approval concentration | >60% one actor | "Approval bottleneck: {actor} handled {N}% of ICEA approvals. Consider distributing or adding a second tech lead." |
| High token cost | ICEA avg >400K | "Context efficiency: ICEA generation is token-heavy. Stale architecture docs or large knowledge graphs are common causes." |

Output as:
```
## Sprint Lessons — Auto-generated

  {lesson text, one paragraph each, grounded in the data}

  {⚠ or ✅ prefix depending on severity}
```

---

## Step 5 — Project-knowledge promotion offer

After lessons, check if any lesson is a strong ICEA-quality pattern (revision cycle causes, dependency contract gaps, Examples anti-patterns). If yes:

```
→ {N} pattern(s) identified as candidates for project-knowledge.md:

  [1] "{short title}" — {one line summary}
  [2] "{short title}" — {one line summary}

  Reply KNOWLEDGE ADD to record, or SKIP to discard.
```

Wait for developer response before writing to `project-knowledge.md`.

---

## Step 6 — Save report

Write the full report to `governance/governance-report-{YYYY-MM-DD}.md`.

```
✅ Governance report saved
   Path: governance/governance-report-{date}.md
   Period: {label}
   Events read: {eventCount} (from {totalAuditFiles} audit files)
   Lessons generated: {N}

Run again at any time — reports are additive, not overwritten.
```

---

## Hard Rules

- NEVER fabricate events — report only what the audit files contain
- NEVER include code content, ADO titles, or business-specific text in lessons
- NEVER block on missing data — note gaps and continue
- If `.claude/audit/` has zero events in the period, say so clearly and skip governance sections
- Lessons must be grounded in a specific data point — no generic advice without a number behind it
