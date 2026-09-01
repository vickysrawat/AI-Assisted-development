---
name: migration-status
description: >
  Render a human-readable status view of an in-progress migration by reading the on-disk
  migration checkpoint (.claude/migration-checkpoint.json). Shows the current phase, the
  stage-gate checklist, mode (source→target · track), per-cluster progress, the integration
  contract hash, decision-log highlights, and the exact keyword to resume. Read-only — never
  writes. Backs the MIGRATE STATUS ADO-{ID} handler and the /migration-status command.
---

# Migration Status Skill (read-only)

_Skill version: 1.0 · Last changed: 2026-08-28 · Plugin compatibility: ≥3.14.0 · Consent: A_

> **Related specs:** read-only; any severity language it surfaces from the checkpoint follows `skills/shared/business-context-severity.md`.

Renders the migration checkpoint — the single source of truth (the `migration` skill owns writes;
this skill only reads). It never modifies the checkpoint or any file.

## Step 1 — Read the checkpoint

```bash
node -e '
try{
  const c=JSON.parse(require("fs").readFileSync(".claude/migration-checkpoint.json","utf8"));
  process.stdout.write(JSON.stringify(c));
}catch(e){process.stdout.write("NO_CHECKPOINT");}
'
```

- `NO_CHECKPOINT` (file missing/unreadable) → print the "no migration in progress" block (Step 4) and stop.
- If an ADO ID was supplied and `c.ado_id` differs → note the mismatch and render what's on disk anyway.

## Step 2 — Map phase → resume keyword

| `phase` | First incomplete gate | Resume with |
|---|---|---|
| `Stage 0` / `Stage 0.5` | options | `MIGRATE OPTIONS ADO-{ID}` (or `MIGRATE ADO-{ID}` to start) |
| `Stage 0.6` | inventory | `MIGRATE INVENTORY ADO-{ID}` |
| `Stage 1` | architecture | `MIGRATE ARCH ADO-{ID}` |
| `Stage 2` | feasibility | `MIGRATE FEAS ADO-{ID}` |
| `Stage 3` | migration | `MIGRATE CLUSTERS ADO-{ID}` |
| `Stage 4` | (clusters) | `MIGRATE RESUME ADO-{ID} [BACKEND\|FRONTEND]` |
| `Stage 5` / `Stage 6` | — | `MIGRATE RESUME ADO-{ID}` (verification) |

Legacy checkpoint (`schema_version` absent or `< 1.9`): render what exists; if `stage_gates`/`mode`
are absent, show "legacy checkpoint — limited detail" and recommend `MIGRATE RESUME ADO-{ID}`.

## Step 3 — Render the status block

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Migration status — ADO #{ado_id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase:    {phase}
  Track:    {mode.track}   ({mode.source_token} → {mode.target_token})
  Graph:    {mode.graph ? "available" : "heuristic"}
  Source:   {source_path}

  Stage gates:
    {✅|⬜} Options       {✅|⬜} Inventory     {✅|⬜} Architecture
    {✅|⬜} Feasibility   {✅|⬜} Migration     {Stage 4 started: yes|no}

  Clusters ({done}/{total} done):
    {for each in clusters{}}  {✅|⏳|❌} {name}  · tier {tier} · {branch or "—"} · {date or "—"}
    (or: "not yet planned" if clusters{} is empty)

  Contract: hash {contract_hash or "—"} · v{contract_version}
  Decisions: auth {decision_log.auth|—} · data {decision_log.data_access|—} · cloud {decision_log.cloud|—}
  Feasibility: {decision_log.red_items.length} RED · {decision_log.yellow_count} YELLOW

  ▶ Next: {resume keyword from Step 2}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Show gates as ✅ (true) / ⬜ (false). Omit rows whose data is absent rather than printing "undefined".

## Step 4 — No migration in progress

```
ℹ No migration in progress for ADO #{ID}.
  No .claude/migration-checkpoint.json found in this folder.
  Start one from the TARGET folder: /migration ADO-{ID}   (or  MIGRATE ADO-{ID})
```

## Hard Rules

- READ-ONLY — never write, edit, or delete the checkpoint or any file.
- The checkpoint is the single source of truth; this skill only projects it. Do not infer or
  fabricate status not present in the JSON.
- Never print raw secrets — the checkpoint holds none, but mask anything credential-shaped if present.
- Run from the TARGET folder (where `.claude/migration-checkpoint.json` lives).
