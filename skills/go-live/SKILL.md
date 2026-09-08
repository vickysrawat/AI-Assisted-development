---
name: go-live
description: >
  Generate a Support-Transition Acceptance Checklist (go/no-go gate) for the current application —
  the sign-off sheet an incoming support team uses to decide whether to accept the app into
  support at go-live. This is the capstone that INGESTS the outputs of the other skills: the latest
  prod-readiness report, the security-review ledger, and the code-review ledger, plus deployment
  architecture + pipeline state — and derives Section-A go-live blockers and Section-B fast-follow
  items from them. Auto-links the Operational Runbook (from /operations) as a handover artifact.
  Absent inputs degrade to ⚠ TODO rows with a "run /X" note — findings are never fabricated.
  Triggered by the /ai-assisted-development:go-live command.
  Also triggers on: "go-live checklist", "transition checklist", "acceptance checklist",
  "support handover gate", "go/no-go", "is this ready to hand over to support".
---

# Go-Live Transition Gate Skill

_Skill version: 1.0 · Last changed: 2026-09-04 · Plugin compatibility: ≥3.20.0 · Consent: C_

Generates the one-time **Support-Transition Acceptance Checklist** — the go/no-go gate that decides
whether the application is accepted into support. It is the capstone consumer of the plugin's other
outputs (readiness, security, code-review) and the deployment architecture.

> **Scope boundary:** this skill produces the *transition gate* only. The living *operational
> runbook* (and its ownership/secrets sections) is a separate skill — `/operations`. A one-time
> sign-off table does not belong in a living runbook, so the two are kept apart.

---

## No ICEA · No gates

Documentation generator, like `product-docs`. No ICEA pattern, no source Write Gate, no critic
gate, no `APPROVE ADO-{ID}` flow. The only interaction is the Step 0 scope confirmation. Write the
Markdown directly and confirm with a one-line summary.

---

## Model routing

**Infrastructure tier** — uses `INFRA_MODEL` (default: `claude-sonnet-4-6`). This is assessment /
synthesis of existing reports, like `app-readiness`. For complex estates, override to
`claude-opus-4-8` in `.claude/settings.json` → `env`. See
`$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

## Persona

Execute as **[EA] Enterprise / Solution Architect** (20 yrs) — optimizes for go-live safety; always
asks "what happens at 3am when this fails, and did we accept a risk without naming it?" The persona
sets *what to scrutinize* — architecture docs, readiness/security/code-review reports, and pipeline
state are the only sources of truth; never name the persona in the output. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Source file consent

This skill is **Category C** — it reads generated reports, finding ledgers, architecture docs, and
pipeline definitions **only**. It never reads application source. No source-file gate applies.
See `$PLUGIN_DIR/skills/shared/source-file-consent.md`.

---

## Resolve PLUGIN_DIR — do this first

Read `.claude/plugin-path.txt` to get PLUGIN_DIR. If absent, use
`skills/shared/plugin-path-resolution.md §1a`. If it resolves empty, stop and tell the user to run
`/setup-sync`.

---

## Step 0 — Confirm scope

```
🚦 Go-Live Transition Acceptance Checklist
  Project : {detected project name}
  Output  : docs/operations/{Project}-Transition-Acceptance-Checklist.md
  Ingests : latest prod-readiness report · security ledger · code-review ledger ·
            architecture-deployment.md · pipeline · the Operational Runbook (if present)
  Absent inputs → ⚠ TODO rows with "run /X" (never fabricated)

Generate the checklist now? (yes / no)
```

If the user declines, stop.

---

## Step 1 — Ingest the ledgers & reports (each optional)

Read each if present; if absent, record it and emit the matching `⚠ TODO` row later.

| Source | Find on disk | Extract |
|---|---|---|
| Readiness report | latest `prod-readiness/app-readiness-*.html` (sort, newest) | overall verdict; Red (1–2) domains → Section A; Amber (3) domains → Section B |
| Security ledger | `security/security-ledger.md` | **open** Critical/High findings by `FP-` id → Section A blockers; open Mediums → Section B |
| Code-review ledger | newest under `CodeReviews/` | **open** Critical/High defects (CID) → Section A; Mediums → Section B |
| Deployment arch | `.claude/architecture/architecture-deployment.md` | prod env exists? approval gate before prod? backup/PITR confirmed? → Section A |
| Pipeline | `azure-pipelines*.yml` / `pipelines/` | staging→approval→prod present? tests block the build? |
| Runbook | `docs/operations/*Operational-Runbook*.md` | link in Section D; if absent, recommend `/operations` first |

Only count findings whose status is **open/unresolved** (respect the ledger's dismissed/fixed
states). Never invent a finding: if a ledger is missing, the risk is *unverified*, which is itself
a blocker row — not a pass.

---

## Step 2 — Load references

```
Read $PLUGIN_DIR/skills/go-live/references/transition-checklist-template.md
Read $PLUGIN_DIR/skills/shared/personas-spec.md
Read .claude/business-context.md if present, else $PLUGIN_DIR/skills/shared/business-context-severity.md
```

Apply B-series business-context severity: any open finding touching a resolved B-series trigger is a
Section-A blocker regardless of its base CVSS/score.

---

## Step 3 — Fill the template

- **Section A (blockers)** — one row per open Critical/High (security + code-review), each Red
  readiness domain, and each failed deployment precondition (no prod env / no approval gate /
  backup unconfirmed). For every ingest source that was **absent**, keep its `{{#if …_ABSENT}}`
  "unverified" row.
- **Section B (fast-follow)** — readiness Ambers + open Mediums, with `⚠ TODO` owner/due-date.
- **Section C** — the knowledge-transfer checklist (fixed items + any project-specific demos, e.g.
  a reindex or batch job the app has).
- **Section D** — auto-link artifacts found on disk; mark missing ones `⚠ TODO`.
- **Recommendation** — a go / conditional-go / no-go call grounded ONLY in the rows above.
- People, dates, and sign-offs are always `⚠ TODO`.

---

## Step 4 — Quality gate (before writing)

- [ ] No unfilled `{{PLACEHOLDER}}` / leftover `{{#each}}`/`{{#if}}` tokens
- [ ] Every Section-A row traces to a real open finding OR an absent-source "unverified" row
- [ ] No fabricated finding, FP-id, or CID — every id copied verbatim from a ledger
- [ ] Recommendation is consistent with the Section-A rows (no "go" while a 🔴 is open)
- [ ] People/dates/sign-offs are `⚠ TODO`

---

## Step 5 — Write & confirm

```bash
mkdir -p docs/operations
```

Write `docs/operations/{Project}-Transition-Acceptance-Checklist.md`, then confirm:

```
✅ Transition Acceptance Checklist generated
  → docs/operations/{Project}-Transition-Acceptance-Checklist.md
  Section A blockers: {N} ({M} from unverified/absent sources)
  Section B fast-follow: {N}
  Ingested: {readiness ✓/–} {security ✓/–} {code-review ✓/–} {runbook ✓/–}
  Recommendation: {go / conditional-go / no-go}
```

---

## Hard rules

- **Never fabricate a finding.** A missing ledger means the risk is *unverified* → a blocker row,
  not a pass. Copy every FP-id / CID verbatim from its ledger.
- **Never read application source** — Category C (reports, ledgers, architecture, pipeline only).
- **Never emit "go"** while any 🔴 Section-A row is open.
- **Never skip the B-series business-context check.**
- Do not generate the operational runbook here — that is `/operations`.
