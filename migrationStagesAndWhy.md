# Migration Stages and Why

This is the living guide to how the migration family works, why the stages exist, and why a migration is not just “one big prompt.”

The migration family is intentionally split into three modes:

- Upgrade: in-place same-stack change
- Rewrite: out-of-place new-target migration
- Replatform: hosting topology and platform migration

All three share the same core idea: migration is a governed workflow, not free-form editing. The process is designed to stop silent failure and keep durable evidence of why a migration was approved, executed, changed, or blocked.

## Why the family exists

A migration is high-risk because it changes:

- runtime assumptions
- dependency graphs
- source roots and deployment topology
- build and release behavior
- operational risk and ownership boundaries

If a team treats every migration as one prompt, the system will silently do the wrong thing:

- skip intake verification
- write a report gate without source evidence
- lose or overwrite ledger state
- resume from stale context
- continue after a blocked gate
- write state to a checkpoint that was never validated

The migration family exists to divide the work into stages that each answer a different question.

## The core questions the family answers

1. Is this a valid migration posture?
   - Upgrade, Rewrite, or Replatform?
   - Is it truly in-place or a rewrite disguised as an upgrade?

2. Is the source context complete enough to trust analysis?
   - Are required roots covered?
   - Are citations valid?
   - Are unresolved modules or integrations explicitly called out?

3. Is the report decision backed by evidence?
   - Not just “it seems feasible”
   - It must be grounded in authoritative facts or clear evidence chain

4. Is the ledger state durable and resumable?
   - Not chat-only memory
   - Not silently dropped state
   - Not corrupted or partially written checkpoint JSON

5. Is the workflow still aligned with the actual state?
   - Is the current tracker consistent with the ledger?
   - Did we actually finish a gate before moving to the next one?

6. Is the migration legally allowed by the skill's step model?
   - Is this gate valid for this skill?
   - Is this verdict legal?
   - Is this transition allowed at this point in the workflow?

## Shared design principles

The migration family follows a few shared principles:

### 1. Determinism beats improvisation

The plugin can produce useful reasoning, but high-risk migration actions require deterministic checks beneath the prompt layer.

Examples:

- validate the checkpoint before resume
- fail if the report gate is attempted before intake passes
- block unsupported gate names or verdicts
- stop when source coverage is incomplete

### 2. State is durable, not conversational

Migration state is stored in a ledger, not just in chat.

That is why the family has a shared checkpoint ledger shape:

- schema version
- skill discriminator
- ADO ID
- gate verdicts
- phase history
- decision log
- skill payload namespace

The ledger is the durable truth. The tracker is a human-readable summary and resume aid.

### 3. The human and machine both have responsibilities

The prompt layer is valuable for judgment, explanation, and decision-making.

The mechanical layer is valuable for prevention:

- fail-closed checks
- validation before resume
- gate enforcement
- explicit remediation instructions

A migration is not safe because the model says it is safe. It is safe because the required checks and gates have passed.

### 4. Phases are separated because different risks appear at different moments

A migration is not one moment of “do it.” It has several distinct domains:

- classification
- source validation
- feasibility and risk
- approval
- execution
- verification
- closure

Trying to collapse all of these into one prompt creates silent failure.

## The migration family stages

The family is structured around a common stage flow, even though each skill has different final outputs.

### Stage 0 — Entry and classification

Purpose:
- decide if the migration is an Upgrade, Rewrite, or Replatform
- verify the posture is correct
- reject false assumptions

Examples:
- A .NET 6 → 8 in-place run is Upgrade
- A Java app moved into a new target app structure is Rewrite
- A hosting move from on-prem to cloud is Replatform

Why it matters:
- wrong posture is one of the most expensive mistakes
- forcing a Rewrite into Upgrade or vice versa causes silent drift

### Stage 1 — Source-context intake

Purpose:
- read the source and validate what can actually be trusted
- ensure roots, citations, and accounting are present
- stop if the source coverage is incomplete

Examples:
- manifest coverage
- PROV citations
- module disposition
- cross-cutting concerns grounded in source

Why it matters:
- a migration report built on missing or weak source context is not a trustworthy decision
- this is the hard guard that prevents “report passes before intake passes” behavior

### Stage 2 — Feasibility and risk analysis

Purpose:
- identify breaking changes, dependencies, and residual work
- decide whether the migration is feasible
- produce a decision-grade report

Examples:
- dependency ledger
- integration inventory
- gap/risk report
- final recommendation

Why it matters:
- each migration is a business-risk decision, not just a technical rewrite
- a report can be valuable even if no code proceeds

### Stage 3 — Design and approval gate

Purpose:
- confirm the chosen path is deliberate and reviewable
- block unsound work before execution begins

Examples:
- design deltas
- approval steps
- report approval gate

Why it matters:
- design approval is what keeps a migration from becoming a broad, unbounded transformation

### Stage 4 — Baseline and execution plan

Purpose:
- establish the pre-migration oracle
- fix the branch and baseline that the migration will compare against
- define the runbook or hop sequence

Why it matters:
- without a baseline, the migration loses a control point
- without a clean execution plan, residual drift is much harder to understand

### Stage 5 — Execution and residual changes

Purpose:
- apply the migration using the correct deterministic method
- capture residual work and fix it explicitly

Examples:
- stack tool per hop
- one commit per hop
- manual corrective actions behind write gates

Why it matters:
- this is where the true risk of code mutation occurs
- residual remediation must be traceable and deliberate

### Stage 6 — Verification and judge gate

Purpose:
- verify that the migration actually meets the intended outcome
- compare against the baseline/oracle
- record judge verdicts where required

Why it matters:
- the migration is not “done” because a tool ran
- it is done because it verified and was judged acceptable

### Stage 7 — Durable record and resume

Purpose:
- persist machine-readable state
- allow sessions to resume without losing migration context
- keep artifacts, gates, and decisions in a durable format

Why it matters:
- migrations are often multi-step and long-running
- without durable record, the project silently drifts or becomes impossible to resume

## Why the stages must be enforced

The real goal is not to keep the process “clean” for its own sake. The real goal is to prevent silent success.

Silent success happens when:

- no one notices a gate was skipped
- a prompt uses stale context
- a report was recorded without source validation
- a checkpoint was malformed or missing
- the tracker says “next step” but the ledger says something else
- the migration proceeds without a valid baseline or legal transition

It is usually not one dramatic failure. It is a chain of small omissions that look acceptable until the damage is already done.

## Control boundaries: A1, A2, A4, C2, and C3

These controls all protect different failure modes and should not be conflated.

### A1 — Upgrade intake gate validation

Question it answers:

> Has the Upgrade source context been verified before the report is allowed to pass?

A1 protects the Upgrade-specific report gate.

Example invalid flow:

```text
source-context manifest not verified
→ report is generated
→ report=PASS is written
→ migration proceeds
```

A1 prevents that by requiring intake validation before `report=PASS`.

A1 does not check whether the tracker says the workflow is currently at the report phase. It only checks the intake prerequisite.

### A2 — Checkpoint file validation

Question it answers:

> Is the persisted migration ledger present, readable, and structurally valid?

A2 protects the checkpoint file itself.

It detects conditions such as:

```text
missing checkpoint
empty checkpoint
malformed JSON
wrong ADO
wrong skill
missing required ledger fields
```

Example:

```text
migration-tracker.md says “ready for verification”
but checkpoint JSON is corrupt
```

A2 stops the workflow before downstream scripts fail unpredictably.

A2 does not determine whether the tracker’s `Next action` is accurate. It validates the ledger, not the human-readable tracker.

### A4 — Tracker update validation

Question it answers:

> Does the human-readable migration tracker agree with the workflow’s actual phase?

A4 protects the tracker as a resume/orientation artifact.

Example:

```text
Ledger:
  intake_context = PASS
  report = PASS

Tracker:
  Phase: 1 — Source analysis
  Next action: Run source detection
```

The ledger may be valid, but the tracker is stale. A future session reading the tracker could repeat source detection or take the wrong next action.

A4 should detect that mismatch before advancing.

What A4 can catch:

- Tracker still says “Step 1” after Step 2 completed.
- `Next action` points to an already completed phase.
- Tracker says “approved” while the ledger says `REVISE`.
- Tracker says “migration complete” while required gates are missing.
- The tracker references an artifact that does not exist.

What A4 cannot catch:

- The source manifest is incomplete.
- The checkpoint JSON is malformed.
- A report gate was manually written without intake.
- An invalid gate transition was recorded.
- A gate name or verdict is unsupported.

Those belong to A1, A2, and C2/C3.

### C3 — Valid gate names and verdicts

Question it answers:

> Are these gate and verdict values recognized?

The generic ledger accepts arbitrary strings unless validation rejects them. For example:

```bash
set-gate --gate=banana --verdict=maybe
```

could be persisted unless validation rejects it.

C3 should enforce:

- known gate names per skill
- known verdicts
- valid value types

For example:

```text
PASS
REVISE
BLOCK
NOT_STARTED
```

The tracker cannot replace this because it is a document, not the machine contract.

### C2 — Legal state transitions

Question it answers:

> Is this gate legally allowed at this point in this skill?

Without C2, a caller could write:

```bash
set-gate --skill=rewrite --gate=completion --verdict=PASS
```

even if intake, options, design, and cluster gates were never completed.

Examples:

Upgrade:

```text
report PASS requires intake_context PASS
verify PASS requires baseline created and all hops completed
```

Rewrite:

```text
design_approved PASS requires options_approved PASS
generation requires intake_context PASS and design_approved PASS
```

Replatform:

```text
cutover requires reconciliation PASS
assurance requires human execution and post-cutover evidence
```

A4 would not necessarily catch that if the tracker was also manually updated to match.

## Why A4 does not replace A1

A tracker could say:

```text
Next action: Run Step 4 report
```

while the source-context intake has never passed.

If A4 only checks that the tracker is internally consistent, it might approve the workflow even though the actual intake prerequisite is missing.

Therefore:

```text
A4 checks tracker consistency
A1 checks Upgrade intake prerequisite
```

Both are required.

## Why A4 does not replace A2

A tracker can be completely valid while the checkpoint is broken:

```text
migration-tracker.md       valid and readable
checkpoint.json            malformed JSON
```

The tracker cannot safely prove that the machine-readable ledger is usable.

Therefore:

```text
A4 checks the human-readable resume artifact
A2 checks the machine-readable resume state
```

The two artifacts can fail independently.

## Why the broader C2/C3 state-machine checks still matter

A1 currently protects one important Upgrade transition:

```text
intake_context=PASS → report=PASS allowed
```

But the migration family has many other transitions.

C2 and C3 are the next layer of enforcement after the immediate checks:

```text
A2: Is the checkpoint usable?
  ↓
A4: Does the tracker agree with the current state?
  ↓
A1: Does this Upgrade gate have its intake prerequisite?
  ↓
C3: Is this gate/verdict combination valid?
  ↓
C2: Is this transition legal in the skill's state machine?
  ↓
Proceed
```

Each layer catches a different failure:

| Control | Protects | Example failure |
|---|---|---|
| A2 | Ledger integrity | JSON is corrupt |
| A4 | Human-readable orientation | Tracker points to wrong next action |
| A1 | Upgrade intake prerequisite | Report passes before source intake |
| C3 | Gate vocabulary | `gate=banana`, `verdict=maybe` |
| C2 | Workflow sequencing | Completion passes before design |

## Example: why all controls matter

Consider this state:

```text
checkpoint.json: valid
tracker.md: stale
intake_context: BLOCK
report: PASS
```

- A2 passes because the JSON is valid.
- A4 fails because the tracker and ledger disagree.
- A1 fails because the report cannot pass while intake is blocked.
- C2/C3 should fail because the report transition is illegal.

This is why A4 is useful, but insufficient on its own.

## Practical recommendation

Keep the responsibilities separate:

- A1: Upgrade-specific intake protection — already implemented.
- A2: Shared checkpoint validation — already implemented according to the agent task.
- A4: Tracker consistency and artifact existence check.
- C2/C3: Later shared state-machine and gate-contract enforcement.

This separation is what keeps the migration family safe without collapsing all concerns into a single “prompt-only” workflow.

## Why the stages matter in practice

The migration family is structured the way it is because migrations fail in ways that are not obvious: stale context, invalid checkpoints, missing evidence, wrong posture, skipped gates, and bad execution sequencing.

The process protects against these failures by separating:

- posture selection
- source verification
- decision-grade report and approval
- execution baseline
- verification
- durable state and resume

That separation is the reason the migration family is safer than a single monolithic migration prompt.

## Keep this document live

This document should be treated as a living reference for the migration family. As the implementation becomes stricter and the shared state machine is formalized, this file should be updated to reflect new gates, new legal transitions, and new operational lessons.

The important principle is simple:

> The migration family is not one prompt. It is a disciplined, evidence-backed process that prevents silent failure by separating judgment, validation, execution, and durable state.
