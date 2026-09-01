---
name: goal-loop
description: >
  Cradle-to-grave orchestrator that drives a work item from goal to
  implementation through the plugin's existing gated skills — icea-feature
  (Plan → ICEA → Tech Spec), then icea-approve, then icea-implement whose
  Step 4b runs the bounded AC self-scoring goal-loop. It is a THIN sequencer:
  it stops at every SAVE/APPROVE gate, self-approves nothing, and owns none of
  the three skills' logic. The only real "loop till done" runs inside
  icea-implement, scoring generated code against the approved Acceptance
  Criteria until they are met or a hard iteration ceiling is hit. Use when you
  want one command to carry an ADO item end-to-end while keeping every human
  gate intact. Triggers on: "goal loop", "iterate to done", "close out the
  remaining ACs", "drive this ADO to done", "loop till the feature is complete".
---

# Goal-Loop Skill (orchestrator)

_Skill version: 1.0 · Last changed: 2026-08-31 · Plugin compatibility: ≥3.15.0 · Consent: C_

## Purpose

`/goal-loop ADO-{ID}` answers the question "give it a goal and let it iterate to
done" — **safely**. It does not invent a new autonomous engine. It sequences the
skills that already exist, pausing at each human gate, so the plugin's safety
model (Feature Gate, Write Gate, critic gates) is preserved end-to-end.

The genuinely iterative part — generate → self-score against the Acceptance
Criteria → revise, bounded by a hard ceiling — lives inside `icea-implement`
Step 4b and is defined once in `$PLUGIN_DIR/skills/shared/goal-loop-spec.md`. This
skill's job is only to get an item *to* that phase and hand off, then surface the
Write Gate.

**Boundary (do not cross):** this skill runs the loop only on the **implementation**
phase. The ICEA and the Tech Spec *define* the rubric (the ACs), so they are never
self-scored — that would be circular. They keep the critic's bounded auto-revise,
exactly as `icea-feature` already runs it. See `goal-loop-spec.md`.

---

## Model routing

This skill is a **coordinator** — it dispatches other skills and owns no generation
or scanning of its own. It runs in the **infrastructure tier** (`INFRA_MODEL`,
default `claude-sonnet-4-6`); each sequenced skill routes its own tier
(`icea-feature` → generation, the critic/self-score → review). Read
`.claude/plugin-path.txt` for PLUGIN_DIR (if absent, use the resolver in
`skills/shared/plugin-path-resolution.md §1a`), then see
`$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

## Consent

**Category C.** This orchestrator reads only the ICEA/tracker/state files it needs
to route, plus architecture docs — never application source. The skills it invokes
apply their own consent gates (notably `icea-implement` is Category B and gates its
own source reads). See `$PLUGIN_DIR/skills/shared/source-file-consent.md`.

---

## Step 0 — Resolve PLUGIN_DIR and the ADO ID

1. Read `.claude/plugin-path.txt` for PLUGIN_DIR; if absent, use the Node.js
   resolver in `skills/shared/plugin-path-resolution.md §1a`.
2. Resolve the ADO ID from the invocation (`/goal-loop ADO-1847`) or, if omitted,
   from the current branch name (pattern `ADO-[0-9]+`). If neither resolves, ask:
   *"Which work item should I drive? (ADO-<id>)"* and stop.

Announce the plan so the developer knows the gates that are coming:
```
🔁 Goal-loop — ADO-{ID}
   I will drive: ICEA → Tech Spec → approval → implementation (AC self-scoring loop).
   I stop at every gate: SAVE PLAN · SAVE ICEA · SAVE TECH · APPROVE ADO-{ID} · WRITE PENDING.
   I approve nothing on your behalf.
```

---

## Step 1 — ICEA + Tech Spec (only if not already approved)

Check for an approved ICEA on disk:
```bash
find docs -path "*UserStory{ID}*" -name "ADO-{ID}-*.icea.md" 2>/dev/null | head -1
```

- **No approved ICEA** (missing, or `Status` is not `✅ Approved`) → invoke
  `icea-feature`:
  ```
  Read $PLUGIN_DIR/skills/icea-feature/SKILL.md and execute it for ADO-{ID}.
  ```
  Let it run its own flow — Plan → `SAVE PLAN` → ICEA draft + critic → `SAVE ICEA`
  → Tech Spec draft + critic → `SAVE TECH`. **Stop at each SAVE gate**; the
  developer types the SAVE keyword. Do not draft ahead of a gate, do not write to
  `temp/` or disk yourself — `icea-feature` owns that.
- **Approved ICEA already exists** → skip to Step 2.

Never self-score the ICEA or the Tech Spec. Their quality gate is the critic inside
`icea-feature` (max-2 auto-revise); this skill adds nothing there.

---

## Step 2 — Approval gate (hard human gate)

After the Tech Spec is saved, surface the approval gate and **wait**:
```
⏸ Approval required — ADO-{ID}
   ICEA + Tech Spec are drafted and saved. Reply APPROVE ADO-{ID} to approve
   (runs icea-approve), or REVISE ADO-{ID} to change the spec first.
```

- The orchestrator **never** issues `APPROVE` itself — this is the Feature-Gate
  integrity boundary. Only the developer's `APPROVE ADO-{ID}` advances.
- On `APPROVE ADO-{ID}` the standard keyword handler runs `icea-approve`; the
  orchestrator then proceeds to Step 3.

---

## Step 3 — Implementation with the AC self-scoring loop

Invoke `icea-implement`:
```
Read $PLUGIN_DIR/skills/icea-implement/SKILL.md and execute it for ADO-{ID}.
```

`icea-implement` runs its own Step 4a (critic) and **Step 4b (the goal-loop)** —
the bounded generate → critic → self-score-against-ACs loop from
`goal-loop-spec.md` — then stops at its Step 5 Write Gate. The orchestrator does
not re-implement any of this; it simply hands off and lets the loop run inside
`icea-implement`.

- The loop stops at the Write Gate. The developer's `APPROVE ADO-{ID}` writes the
  code — the orchestrator never writes and never approves.
- If Step 4b escalated (ceiling/no progress) and the developer chose `ACCEPT AS-IS`,
  the unmet ACs are already carried into the WRITE PENDING prompt — surface them, do
  not hide them.

---

## Step 4 — Report

When implementation completes (or the developer halts), print a short summary of
where the item landed:
```
🔁 Goal-loop — ADO-{ID} — {phase reached}
   ICEA:      {approved | drafted | n/a}
   Implement: {written | escalated at {percentDone}% | halted}
   Next:      {IMPLEMENT ADO-{ID} Story-{N+1} | run /checkin | resolve unmet ACs}
```

---

## Hard Rules

- **Own no logic.** This skill only sequences `icea-feature`, `icea-approve`, and
  `icea-implement`. It never drafts an ICEA/Tech Spec itself, never generates code
  itself, never writes to disk. Duplicating those flows here is forbidden — they are
  the single source of truth.
- **Approve nothing.** The orchestrator never issues `APPROVE ADO-{ID}`, `SAVE …`,
  or any gate keyword on the developer's behalf. Every gate is crossed by the human.
  This is the Feature-Gate / Write-Gate integrity boundary.
- **Never self-score the ICEA or Tech Spec.** The goal-loop runs only on the
  implementation phase (inside `icea-implement`). ICEA/Tech keep the critic revise.
- **Stop at every gate.** SAVE PLAN · SAVE ICEA · SAVE TECH · APPROVE ADO-{ID} ·
  WRITE PENDING — pause and wait at each; do not run ahead.
- **Category C** — reads ICEA/tracker/state + architecture docs only; delegated
  source reads happen inside `icea-implement` under its own Category B gate.
