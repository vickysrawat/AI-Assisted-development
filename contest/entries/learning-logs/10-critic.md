# Learning Log — Entry 10: The Critic

> Judge-defense study log. One section per concept: explanation + judge-ready line + summary.
> Companion docs: entry = `../10-critic.md`; source spec: `skills/critic/SKILL.md`.

**The spine:** an adversarial **generator-critic** pass that evaluates a spec/code artifact **at the
moment it's produced, before disk**, while artifact + governing spec are both in context, and
**self-corrects up to twice** before surfacing to a human. Creativity ("AI distrusts AI") + working
solution.

**Concept map (7):** (1) core problem: the moment of production is ungated · (2) the generator-critic
pattern (in-context intent check) · (3) three modes · (4) before disk, not after · (5) bounded
autonomy (2 retries → human) · (6) ephemeral + concrete · (7) evidence + fun.

Status: ✅ Concepts 1–7 locked.

## Concept 1 — The core problem
**Explanation:** an AI is its own worst reviewer in the moment it generates. The plugin already gates
**planning** (ICEA approval) and the **committed diff** (checkin/code-review), but the riskiest
instant, *the artifact as it's generated*, was ungated. Too early = nothing to check; too late = it's
on disk. And a later source-scan can't see the *intent* the artifact had to satisfy (the spec's gone
from context).
**Judge line:** *"We gated the plan and we gated the committed diff, but the moment the AI actually
writes the spec or the code was ungated. And by the time a later review runs, the intent it was
supposed to satisfy is no longer in context."*
**Summary:** *The production moment was ungated; only there are artifact + intent both in context.*
Covers: #2.

## Concept 2 — The generator-critic pattern (in-context intent check)
**Explanation:** the generator (`icea-feature`, `icea-implement`) makes the artifact; the **critic
runs as a distinct pass** asking a careful reviewer's questions. Because **spec + output are both in
context**, it can check *intent alignment* a later source-scanning review never can.
**Judge line:** *"It's a generator-critic split: one pass writes, a separate pass tears it apart;
and because the spec and the output are in context together, it can check 'does this actually match
what we asked for', which no later scan can."*
**Summary:** *Distinct critic pass with artifact + spec both in context → intent-alignment check
impossible later.*
Covers: #3, #6.

## Concept 3 — Three modes
**Explanation:** `ICEA` (completeness, testability, B-series coverage, scope-vs-Intent), `TECH`
(ICEA↔design traceability, coverage matrix, D-option fidelity), `CODE` (ICEA traceability,
simplicity, rules compliance, decision transparency, hidden assumptions). Persona by mode: [TL] for
ICEA/TECH, [SE] for CODE (ties to Entry 09).
**Judge line:** *"Three modes for three artifacts: it critiques a spec, a tech design, or generated
code, each against its own checklist, wearing the right persona for each."*
**Summary:** *ICEA / TECH / CODE modes, each with its own dimensions; persona per mode.*
Covers: #3.

## Concept 4 — Before disk, not after
**Explanation:** a REVISE verdict on code means the code is **regenerated before anything touches
disk**, not patched afterward. Nothing is written while the verdict is REVISE (no temp draft for
icea/tech, no source/config for code).
**Judge line:** *"A REVISE doesn't patch bad code after the fact; it regenerates it before a single
byte hits disk. While the verdict is REVISE, nothing is written, period."*
**Summary:** *REVISE → regenerate before write; nothing lands while REVISE.*
Covers: #5, #6, #8.

## Concept 5 — Bounded autonomy (2 retries → human)
**Explanation:** on REVISE, a bounded regenerate-and-re-critique loop: **max 2 automatic retries**,
each **announced** ("🔁 revision 1 of 2"), with a **diminishing-returns guard** (same concerns twice
→ surface immediately). Still failing → surface to the human: **ACCEPT AS-IS / GUIDE / HALT.**
**Judge line:** *"It fixes itself, but on a leash: two automatic attempts, each announced, and if
it's not making progress it stops and hands you the decision: accept, guide, or halt. Autonomy with
a hard limit."*
**Summary:** *Max 2 announced auto-retries + diminishing-returns guard → human (ACCEPT/GUIDE/HALT).*
Covers: #5, #8.

## Concept 6 — Ephemeral + concrete
**Explanation:** the critic is **ephemeral**: writes no ledger, assigns no fingerprints, applies no
fixes (that's `code-review`/`security`/`fix`); its only output is a verdict + concerns. And it's
**never vague**: every concern names a section/AC/file + the specific problem ("could be cleaner" is
not a finding).
**Judge line:** *"It owns nothing: no ledger, no fingerprints, no fixes. One job at one moment. And
every concern is concrete: not 'this could be cleaner' but 'this interface has one implementer, use a
direct method.'"*
**Summary:** *Ephemeral (no ledger/fingerprint/fix); every concern names a specific section/AC/file.*
Covers: #7, #8.

## Concept 7 — Evidence + fun framing
**Explanation:** measured: auto-fires at three gates (icea Step 5, tech Step 8, code Step 4a); the
"nothing written under REVISE" and 2-retry rules are hard rules. Highest-value catch = **hidden
assumptions** (silent guesses). **Not-yet-evaluated:** defect-catch rate / rework avoided. Fun: "the
AI that argues with the AI."
**Judge line:** *"What's real: it fires at three gates and can't write while it's unhappy. What I
won't claim: a catch-rate number, not-yet-evaluated. The memorable bit is that it rewrites the AI's
work before you ever see it."*
**Summary:** *Evidence = 3 auto-gates + hard rules + hidden-assumption catch. Catch-rate
not-yet-evaluated.*
Covers: #6, #7.

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 2 |
| #2 problem | 1 |
| #3 working today | 2, 3 |
| #4 AI role | 2, 3, 5 |
| #5 flow + checkpoints | 4, 5 |
| #6 value + evidence | 2, 4, 6, 7 |
| #7 resourceful/fun | 6 (ephemeral) + 5 (self-correct) |
| #8 responsible AI | 4, 5, 6 |
| #9 demo | 4/5; `../../demo-scripts.md` §Entry 10 |

## The 3 lines that win Entry 10
1. **The hook:** "An AI built to distrust the AI: it vetoes its own team's work and rewrites it up to twice before you ever see it."
2. **Timing:** "It checks intent alignment at the moment of creation, while the spec and the output are both still in context; something no later scan can do."
3. **Discipline:** "Nothing is written while the verdict is REVISE, and every concern names a specific file and problem, never 'could be cleaner.'"
