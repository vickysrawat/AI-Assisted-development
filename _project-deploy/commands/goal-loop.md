---
description: "Drive an ADO work item from goal to implementation through the gated skills — ICEA → Tech Spec → approval → implementation with a bounded AC self-scoring loop. Stops at every gate; approves nothing on your behalf.  Example: /goal-loop ADO-1847"
argument-hint: "ADO-<id> [--help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/goal-loop — Carry an ADO work item from goal to implementation, gated end-to-end.

Sequences the existing skills, stopping at every human gate:
  1. icea-feature    Plan → ICEA → Tech Spec   (stops at SAVE PLAN / SAVE ICEA / SAVE TECH)
  2. APPROVE ADO-<id>  runs icea-approve         (a real human gate — never self-approved)
  3. icea-implement  Step 4b runs the bounded AC self-scoring loop, then the Write Gate

The only loop-till-done runs in implementation. The ICEA/Tech Spec are never
self-scored (they define the rubric) — they keep the critic's bounded revise.

Arguments:
  ADO-<id>        The work item to drive. Inferred from the branch name if omitted.
  --help, ?help   Show this help.

Examples:
  /goal-loop ADO-1847
  /goal-loop            (id inferred from branch)
```

<skill>ai-assisted-development:goal-loop</skill>
