---
description: Drive an ADO work item from goal to implementation through the existing gated skills — ICEA → Tech Spec → approval → implementation with a bounded AC self-scoring loop. A thin orchestrator that stops at every gate and approves nothing on your behalf.
argument-hint: "ADO-<id>   e.g.  /goal-loop ADO-1847"
---

## Model routing

This command is a **coordinator** — it sequences other skills and owns no
generation or scanning of its own, so it runs in the **infrastructure tier**
(`INFRA_MODEL`, default `claude-sonnet-4-6`). Each sequenced skill routes its own
tier (`icea-feature` → generation; the critic and the self-score → review).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /goal-loop — Goal to implementation, gated end-to-end

Runs one command to carry a work item from a goal all the way to written code,
while keeping every human gate intact. It sequences the skills that already exist:

1. `icea-feature` — Plan → ICEA → Tech Spec (stops at each `SAVE …` gate).
2. `APPROVE ADO-{ID}` → `icea-approve` (a real human gate — never self-approved).
3. `icea-implement` — whose **Step 4b** runs the bounded AC self-scoring loop
   (generate → critic → score against the approved ACs, capped iterations), then
   stops at the Write Gate.

The only "loop till done" runs inside `icea-implement`. The ICEA and Tech Spec are
never self-scored — they *define* the rubric — so they keep the critic's bounded
revise instead. Full engine contract: `$PLUGIN_DIR/skills/shared/goal-loop-spec.md`.

---

## Execute

```
Read $PLUGIN_DIR/skills/goal-loop/SKILL.md and execute it in full for the resolved ADO id.
```

---

## Hard Rules

- The orchestrator approves nothing and writes nothing — it stops at every gate
  (`SAVE PLAN` / `SAVE ICEA` / `SAVE TECH` / `APPROVE ADO-{ID}` / `WRITE PENDING`)
  for the developer to cross.
- It owns no logic — it only sequences `icea-feature`, `icea-approve`, and
  `icea-implement`, which remain the single source of truth for their phases.
- The goal-loop runs only on the implementation phase; ICEA/Tech Spec use the critic.
