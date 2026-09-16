# Learning Log — Entry 01: Governed AI Development (ICEA + Write Gate)

> Judge-defense study log. One section per concept. Each concept captures: the plain
> explanation, the judge Q&As we worked through, and the memorizable "judge-ready" answers.
> Goal: present live and defend under questioning; answer any of the 9 form fields from memory.
> Companion docs: entry = `../01-governed-ai-dev.md`; evidence = `../../measured-claims.md`;
> demo = `../../demo-scripts.md` §Entry 1.

**Concept map (7):** (1) the core problem · (2) what an ICEA *is* · (3) what a "gate" is + the
Feature Gate · (4) the Write Gate · (5) "hook-enforced, not advisory" (the crux) · (6) human
checkpoints / flow · (7) how claims are labeled as evidence.

Status: ✅ Concepts 1–7 locked (all covered).

---

## Concept 1 — The core problem (the foundation everything defends)

### Explanation

Every part of this entry exists to answer one problem: **AI coding assistants are optimized to
be fast and eager, and that speed *is* the risk in a serious environment.** Three concrete
failure modes:

1. **Un-specced work**: the AI builds a feature nobody wrote down or approved. Later "why does
   this exist?" has no answer.
2. **Silent scope / sensitive-data creep**: it touches things it shouldn't (e.g. an export
   that includes personal data) without anyone noticing at the moment it decides to.
3. **Un-reviewed volume**: it lands many files before a human has looked at intent, so review
   happens *after* the risk is already on disk.

Killer line: **"'The AI already wrote it' is not an acceptable audit answer."** In regulated
domains (legal, healthcare, fintech) *what* got built and *who approved it* matter as much as
speed. The entry's design is a bet that **restraint, not velocity, is the valuable thing** in
those settings. ICEA, gates, and hooks are all machinery to enforce that restraint.

### Judge Q&A

**Q1 — "Every AI tool has undo, and code review catches bad code anyway. Why do I need this?"**

- Undo restores *state*, but not *intent*; after an undo the code is gone but there's still no
  record of what was intended, why, or who signed off (that's failure mode #1).
- The deeper point is **timing**: undo and code review are **reactive**, acting *after* the
  risk is already on disk. This design is **preventive**: it acts *before*.
- Concrete: an AI run writes an export dumping personal data and commits an API key to shared
  config. You undo. The files revert, but the secret was already written (and if pushed, it's
  in git history forever) and the data was already exposed in that run. **Undo can't un-happen
  an exposure.** Review would catch it, but only *after* it exists and only *if* a tired human
  spots it among many changed files.
- **Judge-ready one-liner:** *"Undo and review are a mop; this is a valve. A mop cleans a spill
  that already happened, and some spills (leaked secrets, exposed data) a mop can't fully
  clean."*

**Q2 — "Your gate has override paths (`APPROVE ALL`, `/skip-icea`). So it's a valve someone can
leave open. Isn't it advisory after all?"**

- No. **An override doesn't remove accountability, it relocates and records it.** The gate
  turns "the AI silently did it" into "a *named human*, on the record, chose to bypass this
  gate, with a stated reason." The failure mode was never "code got written"; it was "code got
  written that no one is accountable for." A logged override keeps a human's name on it.
- Two reinforcements:
  1. **Default-closed**: resting state is *blocked*; you must take a deliberate action to open
     it. Silent-by-default *is* what "advisory" means; this is the opposite.
  2. **Not everything is overridable**: the secrets gate and the open-findings gate are *never*
     blanket-skippable (`APPROVE ALL` can't wave them through). Even the override story has a
     hard floor.
- **Judge-ready one-liner:** *"You can open the valve, but never silently, never by default, and
  never on the things that matter most."*

**Q3 — "This is just theater / friction that slows my team down."** (the hardest, most likely attack)

- **Split the bundled accusation first.** "Theater" = looks like a safeguard but stops nothing;
  "friction" = it *does* stop things, annoyingly, for little benefit. They have opposite
  rebuttals, and you can't be guilty of both. *"If it's real enough to create friction, it
  isn't theater."*
- **Vs. theater → it's falsifiable.** Theater can't be tested and changes no outcome. This can:
  try to commit a secret → blocked; describe a feature → no code until a spec exists. A control
  you can trigger and watch work is by definition *not* theater. (Offer to demo the block live.)
- **Vs. friction → targeted, proportionate, productive, optional:**
  1. *Targeted*: friction at exactly two points (approve spec, approve each write), not on
     everything; a checkpoint on intent and disk-writes, not a tax on typing.
  2. *Proportionate*: front-loads cost onto the cheapest moment to catch a problem (before
     disk) vs the most expensive (incident / leaked key in git history / compliance finding).
     "Cheap friction now buys out expensive friction later."
  3. *Productive*: the approved ICEA is reused for task breakdown, PR descriptions, reviews
     (write-once, read-many). Not pure overhead; the ceremony leaves value behind.
  4. *Optional where risk is low*: throwaway prototype → `/skip-icea`; friction is dialed to
     risk, not uniform. In a regulated domain the friction *is* the audit trail you need anyway.
- **One-sentence kill:** *"It's only theater if it changes no outcome, and only friction if the
  outcome isn't worth it. This changes outcomes you can test live, at exactly two checkpoints,
  and the cost is a fraction of the breach or audit finding it prevents."*
- **Aikido move (turn it back):** *"What would convince you it's not theater? Name it, and I'll
  trigger it live."* Flips the burden to the judge; reads as confident, not defensive.

### Concept summary (memorize)

*This entry solves un-governed AI code generation by being preventive (a valve) rather than
reactive (a mop), and it preserves accountability even on override: every bypass is
default-closed, named, and logged, with some gates not skippable at all.*

**Covers form fields:** #2 (problem/audience) and most of #8 (responsible-AI / limitations).

---

## Concept 2 — What an ICEA actually *is*

### Explanation

**ICEA = Intent · Context · Examples · Acceptance.** A written spec document, saved to disk,
that must exist and be **approved before any feature code is generated**. The four sections are
ordered deliberately; each removes a specific way the AI could go wrong:

| Section | Holds | Failure it prevents |
|---|---|---|
| **I: Intent** | *What* we're building and *why* (goal / problem). | Building the wrong thing; work with no traceable reason. |
| **C: Context** | Constraints, existing system, dependencies, where it fits, **non-goals**. | The AI *assuming*, filling gaps with guesses. |
| **E: Examples** | Concrete inputs/outputs, scenarios, edge cases. | Ambiguity; "done" being opinion. |
| **A: Acceptance** | Testable checklist defining "done" (acceptance criteria). | Un-verifiable work; also where **B1–B7 sensitivity flags** attach. |

Four things that make it *governance* machinery, not just a template:

1. **Unit of approval**: the human approves *this document*; its `Status: ✅ Approved` line on
   disk is literally the precondition the Feature Gate checks.
2. **On disk, not in chat**: durable, versioned, greppable, auditable, at
   `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md`. Chat evaporates; a file is evidence.
3. **AI drafts, human approves**: AI does the labor of writing the spec; the human owns the
   decision. (The AI-vs-human split judges score under criterion 2.)
4. **Write-once, read-many**: the same approved ICEA feeds ADO task breakdown, the PR-description
   check, and review traceability. This is what makes the Q3 "friction" *productive*.

### The before/after mental model (the key insight)

- **I + C come *before* the work** = *grounding* (build the right thing, from the right facts).
- **E + A come *after* the work** = *verification* (prove it's actually done).
- **C is the "before" picture** (world as it is + what must change); **E is the "after" picture**
  (world as it should be). The AI's job is to get from one to the other; **A is the checklist
  proving it arrived.**

### Judge-ready lines

- *"An ICEA is the spec the AI must earn its keystrokes against: Intent and Context so it can't
  guess, Examples and Acceptance so 'done' is testable, and it lives on disk so approval is a
  fact, not a vibe."*
- *"Context is the before picture; Examples are the after picture; Acceptance is the checklist
  proving we got from one to the other."*

### Concept summary (memorize)

*ICEA (Intent·Context·Examples·Acceptance) is the on-disk, human-approved spec that is the
precondition for any code. I+C ground the AI (prevent guessing); E+A verify the result (make
"done" testable). It's the unit of approval and is reused write-once/read-many downstream.*

**Covers form fields:** #3 (what's working today), #4 (AI vs human roles), and the spine of #5
(solution flow).

---

## Concept 3 — What a "gate" is, and the Feature Gate

### Explanation

A **gate** = a conditional block in the workflow: a control point that refuses to let a *class
of action* proceed unless a *precondition* is met. Its power is in choosing which action it
blocks and what unblocks it.

The **Feature Gate**: action blocked = generating implementation code for a new feature;
precondition = an approved ICEA on disk (`Status: ✅ Approved`) at the expected path. No approved
ICEA → the AI says so, runs `icea-feature`, and won't proceed until `APPROVE ADO-{ID}`.

Key nuance: it is **output-gated, not lobotomized.** Orientation, answering questions, reading
architecture docs are always allowed; only the specific dangerous output (new-feature
implementation code) is blocked. Override: `/skip-icea` (warns once; not recommended).

### Judge-ready line

*"The gate blocks a class of output (un-specced feature code) not the AI's ability to think or
help. It's a precondition on building, not a muzzle."*

### Summary (memorize)

*A gate blocks a class of action until a precondition is met. The Feature Gate blocks new-feature
code until an approved ICEA exists on disk. Output-gated, so the AI stays useful; it just can't
build un-specced things.*

**Covers form fields:** #3 (what's working today), #5 (flow).

---

## Concept 4 — The Write Gate (a *second*, independent gate)

### Explanation

The two gates answer two different questions; that separation is defense-in-depth:
- **Feature Gate:** "Should this be built at all, is there an approved spec?"
- **Write Gate:** "Before this exact file touches disk, do I accept this exact change?"

Mechanics: source/config is never written until `APPROVE ADO-{ID}`. For each pending write the
AI must (1) show the change, a unified diff (changed lines + 3 context) for edits, full content
for new files; (2) show the target path; (3) show the prompt and **stop**.

Three probed details:
1. **`APPROVE ALL ADO-{ID}`** removes the per-file *pause* but still streams every diff + path,
   removing the interruption, not the visibility. `REVOKE ALL` cancels it.
2. **Boundary-crossing writes** (path outside the repo root, e.g. a cloned dependency repo) need
   their own per-file confirmation; `APPROVE ALL` does NOT blanket them; extra
   "⚠ WRITE CROSSES REPO BOUNDARY" warning.
3. The gate **holds even after** an approved ICEA, a passing critic, or prior confirmation,
   regardless of urgency. Passing one gate never satisfies the other.

### Judge-ready line

*"Approving the spec answers 'should it exist.' The Write Gate answers 'do I accept this file.'
Two independent questions, two independent gates; passing one never waves through the other."*

### Summary (memorize)

*The Write Gate is a second, orthogonal gate: every source/config write shows a diff + path and
stops for approval. `APPROVE ALL` removes the pause but not the visibility; cross-repo writes are
never blanketed; the gate holds regardless of any prior approval or urgency.*

**Covers form fields:** #5 (flow), #8 (safeguards).

---

## Concept 5 — "Hook-enforced, not advisory" (THE crux)

### Explanation

The concept that separates a real control from a promise, and where the "theater" fight is won.
- An **instruction** (text in CLAUDE.md) is **advisory**: only as strong as the model *choosing*
  to comply. Model behavior is *probabilistic*; under pressure it can slip.
- A **hook** is **deterministic code that runs in the harness, outside the model's control.**
  Hooks intercept tool calls; the model can't decide whether they run. **It literally cannot
  write the file if the hook blocks the write.**

The entry's whole credibility rests here: governance by *mechanism*, not *goodwill*. Named hooks:
`icea-floor` (Feature Gate floor), `check-settings-secrets`, `findings-gate-precommit`,
`script-review-gate`.

### Evidence (measured)

**25 governance hooks; 300 / 0 structural validation checks passing** (`node tests/validate.js`).

### Judge-ready line (the important one)

*"The enforcement isn't the AI's job, it's the harness's. An instruction is a promise the model
can break; a hook is code that runs whether the model likes it or not. That's the difference
between 'we told it not to' and 'it can't.'"*

### Summary (memorize)

*Deterministic hooks in the harness (not advisory prompt text) enforce the gates. The model
can't bypass them, which is what makes "governance is enforced, not hoped for" a defensible
claim. 25 hooks; 300/0 validation.*

**Covers form fields:** #4 (AI vs rules), #6 (working-solution evidence), #8 (safeguards).

---

## Concept 6 — Human checkpoints / end-to-end flow

### Explanation (four beats, checkpoint type labeled)

1. Developer describes a feature → **AI declines and invokes the ICEA gate** (no code).
2. AI drafts the ICEA and flags any sensitive AC (B1–B7) → **HUMAN CHECKPOINT: review +
   `APPROVE ADO-{ID}`.**
3. AI generates code → **HUMAN CHECKPOINT: each file pauses at the Write Gate (diff + path).**
4. On commit, the secrets hook scans staged config → **DETERMINISTIC CHECKPOINT: planted secret
   blocked.**

Three-way separation (criterion 2):
- **AI does:** draft the spec, generate the code, produce diffs.
- **Rules/hooks do:** enforce the gates, scan secrets, run validation (model can't bypass).
- **Human does:** approve the spec, approve each write.

### Judge-ready line

*"Two mandatory human checkpoints (approve the intent, then approve each artifact) with a
deterministic secrets checkpoint the human doesn't even have to remember."*

### Summary (memorize)

*The flow has two mandatory human checkpoints (approve spec, approve each write) plus a
deterministic secrets checkpoint. AI drafts/generates; hooks enforce; human approves; cleanly
separated.*

**Covers form fields:** #5 (flow), #4 (roles).

---

## Concept 7 — How claims are labeled as evidence

### Explanation

Every claim carries a label: **measured · observed · estimated · projected · not-yet-evaluated.**
- **Measured (verifiable live):** 25 hooks · 300/0 validation · 49 skills · 47 specs · 44 rules ·
  24 tests, each with a one-line verify command (`../../measured-claims.md` §1).
- **Measured (design fact):** auditability by construction; gates hook-enforced, files exist.
- **NOT-YET-EVALUATED, must NOT claim:** rework-hour / cycle-time reduction from the gate. A
  design goal; measuring it needs a real sprint + ADO PAT (unavailable in this repo).

Counter-intuitive move: volunteering what you *haven't* proven makes judges trust what you *have*.
Overclaiming one number poisons every other number you cite.

### Judge-ready line

*"Every claim here is labeled. The structural numbers are reproducible with a command in front of
you. The productivity gains I've marked not-yet-evaluated, because I haven't run a real sprint
through it, and I'm not going to guess."*

### Data-use disclosure (field 8 boilerplate)

*Operates on the local repo + Claude Code sessions; no source leaves the environment except
explicit ADO/Anthropic API calls the user initiates. Secrets are hook-blocked from committed
config; sensitive data is flagged via B1–B7 severity.*

### Summary (memorize)

*Label every claim (measured/observed/estimated/projected/not-yet-evaluated). Lead with
reproducible measured numbers; explicitly mark productivity gains as not-yet-evaluated. Honesty
about the gaps is what makes the proven claims credible.*

**Covers form fields:** #6 (value + evidence), #8 (limitations + data use).

---

## Quick map: concept → form field

| Form field | Concepts that answer it |
|---|---|
| #1 title / pitch | 1 (problem framing) |
| #2 problem + audience | 1 |
| #3 what's working today | 2, 3 |
| #4 AI role + tools | 2, 5, 6 |
| #5 solution flow + checkpoints | 2, 3, 4, 6 |
| #6 value + evidence | 5, 7 |
| #7 resourceful / memorable | 1 (the "AI that refuses to code" inversion) |
| #8 responsible AI / limits / data | 1, 4, 7 |
| #9 demo (+ backup) | 6 (flow = demo beats); script in `../../demo-scripts.md` §Entry 1 |


