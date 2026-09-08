---
description: Generate a Support-Transition Acceptance Checklist (go/no-go gate) for the current application. Ingests the latest readiness report + security ledger + code-review ledger + deployment architecture to derive go-live blockers. Absent inputs become ⚠ TODO rows — findings are never fabricated.
argument-hint: (no arguments needed)
---

<skill>go-live</skill>

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

## Your task

Generate the **Support-Transition Acceptance Checklist** using the `go-live` skill — the one-time
go/no-go gate for accepting the app into support. **Ask first. Write the file. Output only the
confirmation summary.**

Documentation generator — **no ICEA, no gates**. Only interaction is the scope confirmation.

### Step 1 — Confirm scope

Read `$PLUGIN_DIR/skills/go-live/SKILL.md` and show its Step 0 scope box (project, output path, the
sources it ingests). Wait for `yes`.

### Step 2 — Generate

Follow the skill Steps 1–5:
1. Ingest (each optional): latest `prod-readiness/app-readiness-*.html`, `security/security-ledger.md`,
   newest `CodeReviews/` report, `architecture-deployment.md`, pipeline, and the Operational Runbook.
   Count only **open** findings; a missing source becomes an "unverified" blocker row — never a pass.
2. Load `$PLUGIN_DIR/skills/go-live/references/transition-checklist-template.md` + business-context.
3. Fill Sections A (blockers) / B (fast-follow) / C (knowledge transfer) / D (artifacts) +
   Recommendation. People/dates/sign-offs stay `⚠ TODO`.
4. Run the quality gate (no fabricated FP-id/CID; recommendation consistent with 🔴 rows).
5. Write `docs/operations/{Project}-Transition-Acceptance-Checklist.md`.

### Step 3 — Confirm

Output the confirmation summary (blocker/fast-follow counts, which sources were ingested,
recommendation). If the Runbook was absent, suggest running `/operations` first.
