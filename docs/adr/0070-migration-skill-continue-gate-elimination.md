# 0070 — Migration skill: CONTINUE gate elimination pattern
Status: Accepted · Date: 2026-10-06
Governs: `skills/upgrade/SKILL.md`, `skills/rewrite/SKILL.md`, `skills/replatform/SKILL.md`
Relates to: [[0061-migration-skill-family-split]], [[0062-migration-mode-on-ledger]], [[0028-write-gate]]

## Problem

All three migration skills (upgrade, rewrite, replatform) accumulated CONTINUE gate patterns
between every step. These gates follow the same boilerplate: "Reply CONTINUE to proceed /
Reply COMPACT if near capacity." Counts at the time of review:

| Skill | Total gates | Real decision gates | Boilerplate CONTINUE gates |
|---|---|---|---|
| upgrade | 14 | 3 | 11 |
| rewrite | ~13 | 5 | 8 |
| replatform | ~11 | 4 | 7 |

A real decision gate requires the developer to review a generated artifact and make a
meaningful choice before the skill advances. A boilerplate CONTINUE gate pauses execution
before any computation has run — there is nothing to review, and the only safe reply is
CONTINUE.

Boilerplate gates create friction without adding safety:
- They interrupt long-running sessions at every step boundary, requiring the developer to
  stay at the keyboard instead of launching the skill and returning to review real artifacts.
- They add noise to the session log, making it harder to find the real decision gates.
- They contradict the "run automatically" language present in several skill steps (notably
  upgrade Step 8a and Step 9, where the SKILL.md text explicitly says "no developer prompt
  required" immediately before a CONTINUE gate).

## Decision

**Eliminate all boilerplate CONTINUE gates from all three migration skills.**

Replace with an auto-advance pattern: steps execute in sequence without pausing unless a
real developer decision is required. Real gates — those where the developer reviews an
artifact and must make an explicit choice — are kept unchanged.

**Real gates kept per skill:**

| Skill | Real gates |
|---|---|
| upgrade | INTAKE CONFIRMED · APPROVE REPORT · APPROVE DESIGN |
| rewrite | oracle mode · APPROVE COUPLING · APPROVE OPTIONS · APPROVE DESIGN · APPROVE CLUSTERS |
| replatform | oracle mode · APPROVE OPTIONS · APPROVE DESIGN · APPROVE IaC |

**Pattern for tool-missing condition (upgrade Step 2):** Rather than a CONTINUE gate with
a soft warning, a tool-not-found condition is a hard BLOCK. The skill prints install steps,
writes them to the runbook document, and stops until the developer re-invokes. This is not
a gate — the developer does not reply; they fix the environment and re-run.

**"Developer reply gates" section added to each skill:** A named section near the top of
each SKILL.md lists all real gates explicitly, so a developer reading the skill can
immediately see the full set of expected interruptions before starting a run.

## Rationale

- **CONTINUE gates are pre-computation pauses.** Artifact review gates are post-generation
  pauses. The distinction matters: pre-computation, there is nothing to read. Forcing a reply
  before the skill starts computing adds only friction. Post-generation, a developer must read
  a report or design document — the gate is load-bearing.
- **Consistency with subagent design.** Upgrade Step 8a explicitly invokes the test-plan
  skill with "no prompt, no budget warning" configuration. Placing a CONTINUE gate in front
  of a subagent configured to run silently is a direct contradiction.
- **SKILL.md self-contradictions were already present.** Upgrade Step 9 contained the
  instruction "Run automatically after Step 8a — no developer prompt required" immediately
  followed by a CONTINUE gate. The declared intent was already correct; the implementation
  needed to match it.
- **Safe points provide resumption without CONTINUE.** ADR 0071 (context budget checks)
  provides the mechanism to pause only when context is actually near capacity. A blanket
  CONTINUE gate at every step boundary is a poor substitute.

## Alternatives rejected

- **Keep CONTINUE gates but make them optional (reply SKIP).** Rejected — this adds syntax
  complexity without removing the friction. A developer who does not know to type SKIP still
  pauses at every gate. The correct answer is to remove gates that serve no purpose.
- **Convert CONTINUE gates to auto-advance with a 5-second countdown.** Rejected — Claude
  Code has no sleep/countdown mechanism. The skill either pauses or it does not.
- **Keep CONTINUE gates only on steps with heavy computation (as a "heads up").** Rejected
  — context budget checks (added alongside this change) serve the same function with
  actionable information. A plain CONTINUE gate tells the developer nothing about cost.

## Consequences

- Sessions run further between developer interactions. A developer who invokes an upgrade
  run may not need to touch the keyboard until `INTAKE CONFIRMED` is prompted.
- Steps that previously required a reply to proceed now stream their output and advance.
  Developers who expect a pause at every step boundary will need to adjust their workflow.
- The "Developer reply gates" section at the top of each skill sets the correct expectation
  upfront: these are the only points where developer input is required.
- Tool-missing conditions are now hard BLOCKs, not soft gates. A developer who does not
  have the required tool installed will see a clear error with install instructions, not a
  gate they can bypass with CONTINUE.

## Revisit when

- If developer feedback shows that auto-advance makes it difficult to inspect intermediate
  outputs mid-run, consider adding per-step output artifacts (files on disk) as the review
  mechanism rather than restoring chat gates.
- If a new migration skill is added and the CONTINUE pattern is reintroduced, re-apply this
  ADR immediately — the pattern is explicit: only real artifact-review decisions get gates.
