# Goal-Loop Engine Spec
_Spec version: 1.0 · Created: 2026-08-31_
_Applies to: goal-loop (orchestrator), icea-implement (Step 4b), migration (Stage 4)_

Shared by: `goal-loop`, `icea-implement`, `migration`

Defines the **bounded, gated goal-loop** — the single reusable contract for
"iterate until the goal is met, then stop." Any skill that wants to close an
artefact out against a rubric reads this spec and runs the engine below rather
than reinventing loop control. The scoring I/O is defined separately in
`rubric-score-schema.md`.

This is the generator-scorer counterpart to the generator-critic pattern in
`skills/critic/SKILL.md`. The critic asks *is it good?*; this engine asks *is it
done?*. They compose — see "Composing with the critic".

---

## What this engine is — and is not

- It is **bounded**: a hard iteration ceiling (and optional token budget) that
  cannot be raised at runtime, plus a diminishing-returns guard. It is not an
  open-ended autopilot.
- It is **gated**: it operates only on in-context, unwritten artefacts, and it
  **exits at a human gate** — the Write Gate for code, the `APPROVE …` stage gate
  for migration. It never writes to disk and never types `APPROVE` on the
  developer's behalf. The loop advances the artefact *up to* a gate; the human
  still crosses it.
- It runs **only on rubric-consuming artefacts** — implementation code, migration
  cluster output. It is **never** run on the ICEA or the Tech Spec: those *define*
  the rubric, so scoring them against a rubric they author is circular. ICEA and
  Tech Spec drafting keep the critic's bounded revise instead (see the boundary
  note at the end).

---

## Inputs

The parent skill enters the engine with:

| Input | Type | Description |
|---|---|---|
| `goal` | string | One-line "done" statement (ICEA Goal one-liner, or migration stage objective). |
| `rubric` | array | The criteria to score against, verbatim — see `rubric-score-schema.md` Inputs. |
| `artifact` | in-context | The current output (generated code, or a cluster's written files + build/test result). |
| `regenerate` | callback | "Produce a better artefact addressing `remaining`" — the parent supplies this (e.g. icea-implement re-runs Step 4 code generation; migration re-dispatches the cluster agent). Uses the parent's **generation** tier. |
| `ceilings.maxIterations` | number | Hard cap on iterations. Default **3** (icea-implement); migration sets **2** per cluster. |
| `ceilings.tokenBudget` | number? | Optional. If set and exceeded, stop and escalate. |

---

## The loop

```
ENTER(goal, rubric, artifact, regenerate, ceilings)
   │
   ▼
 SELF-SCORE  ── read rubric-score-schema.md, score the current artifact
   │           (review tier · Category C · writes nothing)
   ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │ percentDone == 100 AND blocking == []                              │──► EXIT: GOAL MET
 │                                                                     │    return score → parent hands to the GATE
 ├───────────────────────────────────────────────────────────────────┤
 │ iteration == maxIterations                                         │──► ESCALATE (ceiling hit)
 ├───────────────────────────────────────────────────────────────────┤
 │ tokenBudget set AND spend >= tokenBudget                           │──► ESCALATE (budget hit)
 ├───────────────────────────────────────────────────────────────────┤
 │ no movement since last score (same percentDone AND same blocking)  │──► ESCALATE (diminishing returns)
 └───────────────────────────────────────────────────────────────────┘
   │  else
   ▼
 Announce: "🔁 Goal-loop iteration {N} of {max} — {percentDone}% · addressing {blocking}"
   │
   ▼
 REGENERATE  ── parent's callback, told to fix every `remaining` on FAIL/PARTIAL
   │           (generation tier)
   ▼
 (loop back to SELF-SCORE, iteration := N+1)
```

- The **first** pass scores the artefact the parent already generated (iteration 0
  is a score, not a regenerate). Regeneration happens only when a score is short of
  the goal and no ceiling/guard has fired.
- "Goal met" is exactly `percentDone == 100 AND blocking is empty` — the definition
  in `rubric-score-schema.md`. Any `PARTIAL` keeps the loop honest (it can never
  read 100%).

### Ceilings — the anti-autopilot guarantee

- **`maxIterations` is absolute.** When iterations reach it, the loop stops and
  escalates. It cannot be raised mid-run. No "just one more" without the developer.
- **`tokenBudget`** (optional) is a second hard stop.
- **Diminishing-returns guard.** If a score does not improve between iterations —
  same `percentDone` and the same `blocking` set — stop immediately and escalate
  rather than spending the remaining budget. A loop that is not moving is a signal
  the developer should decide. (Same guard as the critic REVISE loop.)

### Gate-stops — the load-bearing safety property

- The engine reads and reasons over **in-context** artefacts only. It **never**
  writes to disk and **never** issues `APPROVE`.
- On **GOAL MET** or **ESCALATE**, the engine returns control (and the latest score)
  to the parent skill. The parent then presents its existing human gate — the Write
  Gate (`APPROVE ADO-{ID}`) for icea-implement, the `APPROVE …` stage gate for
  migration. Crossing that gate is the human's action, always.
- Restated as a rule the callers must honour: **the goal-loop advances an artefact
  up to a gate; it never advances through one.**

---

## Escalation

On a ceiling hit or diminishing returns, surface this block and stop. It reuses the
critic's `ACCEPT AS-IS / GUIDE / HALT` vocabulary verbatim — one escalation grammar
across the plugin, not a parallel one.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ GOAL-LOOP — {ceiling reached | no progress} — {ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress: {percentDone}%  ({passCount}/{total} criteria met)
Iterations: {N} of {max}

Remaining (blocking):
  {id}  {criterion text} — {remaining}
  …

What changed across iterations:
  Iter 1 → 2: {summary}
  Iter 2 → 3: {summary}

Choose:
  ✅ ACCEPT AS-IS   — hand the artefact to the gate at {percentDone}%
                      (unmet criteria are carried INTO the gate prompt, not lost)
  ✏  GUIDE          — tell me what to change, I run one more iteration
  ❌ HALT            — stop, write nothing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- **`ACCEPT AS-IS`** → exit toward the gate. The parent MUST list every unmet
  criterion inside its gate prompt (the WRITE PENDING block, or the stage-gate
  summary) so partial completion is visible at the moment of approval — never
  silently dropped.
- **`GUIDE`** → apply the developer's guidance as one extra regenerate, re-score
  once, then exit toward the gate or re-surface.
- **`HALT`** → return control, write nothing.

---

## Composing with the critic (icea-implement)

In `icea-implement` the code must be both **sound** (critic) and **complete**
(this engine). To avoid nesting a 2-retry critic loop inside a 3-iteration goal
loop — a combinatorial blow-up — the two share **one** iteration budget:

```
One goal-loop iteration =
   regenerate code
   → critic (mode=code)         ── REVISE handled inside this same iteration, no separate retry budget
   → self-score (this engine)
```

So an iteration is only "successful" if the code both passes the critic and is
re-scored. `maxIterations` bounds the whole thing. The critic still owns the
quality verdict; the score still owns the completion verdict; neither is merged
into the other.

---

## Surviving a context drop

Long loops can outlive a context window. A parent that owns a checkpoint (migration)
persists loop state so a resumed session continues instead of restarting:

- Persist `{ iteration, tokenSpend, lastScore }` under the parent's checkpoint —
  see the `goalLoop` block in `checkpoint-schema.md`.
- Only the checkpoint **owner** writes it (migration's orchestrator). Subagents
  return scores; they do not write the checkpoint (`single-writer-assumption.md`).
- `icea-implement` runs in a single turn and does not persist loop state; a dropped
  implementation loop simply re-runs from Step 4.

---

## Hard rules

- **NEVER write to disk or issue `APPROVE` from inside the loop.** The engine exits
  AT the gate threshold; the human crosses it. This preserves the Write-Gate
  invariant in `write-gate-spec.md` — the loop is not a backdoor around it.
- **NEVER exceed `maxIterations`.** It is a hard ceiling, not advisory. Surface to
  the developer instead of continuing.
- **NEVER run the engine on an ICEA or Tech Spec.** Those define the rubric —
  scoring them against it is circular. They use the critic's bounded revise.
- **Stop the moment the score stalls.** Same `percentDone` + same `blocking` two
  iterations running ⇒ escalate; do not burn the remaining budget.
- **Carry unmet criteria into the gate.** On `ACCEPT AS-IS`, every FAIL/PARTIAL is
  named in the parent's gate prompt so partial completion is explicit at approval.
- **The scorer is Category C and ephemeral** — it reads only the in-context
  artefact + rubric, writes nothing, fingerprints nothing (`rubric-score-schema.md`).
- **Rubric text is verbatim** — the ICEA/tracker or stage-rubric text, never a
  paraphrase (risk R4).

---

## Risks (design record)

| # | Risk | Mitigation baked into this spec |
|---|---|---|
| R1 | Self-scoring drifts optimistic (an agent grading itself) | Evidence mandatory per verdict; `percentDone` is a fixed formula not a free-hand number; diminishing-returns guard; and the human gate is always downstream, so a wrong 100% still faces `APPROVE`. |
| R2 | Loop weakens the Write Gate | Hard rule: no write / no `APPROVE` from inside; engine exits at the gate threshold only. |
| R3 | Concurrency on the migration checkpoint | Only the orchestrator persists `goalLoop`; cluster agents return scores (`single-writer-assumption.md`). |
| R4 | Rubric paraphrase optimises the wrong target | Rubric passed verbatim from ICEA/tracker/stage rubric. |
| T1 | Merging score + critic into one verdict | Rejected — kept orthogonal (completion vs quality). |
| T2 | Nested critic + score loops blow up | One shared iteration budget: 1 iter = regenerate → critic → score. |
