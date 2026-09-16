# Learning Log — Entry 09: The Persona Cast

> Judge-defense study log. One section per concept: explanation + judge-ready line + summary.
> Companion docs: entry = `../09-persona-cast.md`; source spec: `skills/shared/personas-spec.md`.

**The spine:** every skill reasons through a named **expert role lens** (13-persona roster) so it
scrutinizes the right things, with a hard guardrail that the persona **never licenses an
assumption**. Personality (criterion 4) + responsible-AI in one. The fun is the cast; the craft is
"lens, not roleplay."

**Concept map (7):** (1) core problem: generic voice vs bluffing roleplay · (2) the roster + role
lens · (3) role vs model tier (two orthogonal axes) · (4) lens not roleplay + never attributed · (5)
the governance guardrail (the crux) · (6) tiering + single-primary → critic · (7) evidence + fun.

Status: ✅ Concepts 1–7 locked.

## Concept 1 — The core problem
**Explanation:** one generic assistant voice reasons shallowly and uniformly, but different tasks
need different scrutiny (spec review vs security scan vs runbook). The naive fix, "act as a senior
engineer", invites the opposite failure: a confident in-character voice that *bluffs*, treating
projected "experience" as evidence.
**Judge line:** *"A generic assistant asks the same shallow questions of everything. But 'roleplay a
senior engineer' just makes it bluff with more confidence. We wanted the sharper questions without
the bluffing."*
**Summary:** *Generic voice = shallow; naive roleplay = confident fiction. Personas give role-sharp
reasoning without the bluff.*
Covers: #2.

## Concept 2 — The roster + role lens
**Explanation:** a canonical **13-persona roster** (PO, TL, SE, QA, SEC, SA, EA, AIA, TW, DPE,
SAST, RM, DL), each a card of *expertise · optimizes-for · accountable-for · signature question*. A
per-skill assignment table binds each skill to its primary persona (security→[SEC], architect→[SA],
app-readiness→[EA], plugin-readiness→[AIA], code-review→[SAST]…).
**Judge line:** *"Thirteen experts, each with a signature question: the QA asks 'how do I make this
fail?', the security engineer asks 'how would I abuse this?', the enterprise architect asks 'what
happens at 3am?', and each skill runs as the right one."*
**Summary:** *13-persona roster (role card + signature question); a table assigns one primary
persona per skill.*
Covers: #3.

## Concept 3 — Role vs model tier (two orthogonal axes)
**Explanation:** a persona picks the **role** (which concerns/priorities/questions); model routing
picks the **tier** (capability). They are independent; a persona **cannot** change the model tier.
**Judge line:** *"Two dials, not one. The persona sets which concerns the model reasons through; the
model router sets how capable the model is. Changing the lens never changes the horsepower."*
**Summary:** *Persona = role (concerns); routing = tier (capability). Orthogonal and independent.*
Covers: #4.

## Concept 4 — Lens, not roleplay + never attributed
**Explanation:** adopt the persona's judgment and priorities, but **no in-character writing** ("As
Marcus, I feel…"), no persona flavor in output, and **artifacts never name or attribute a persona**
("Reviewed by …" lines are banned). It's a reasoning prime, not a costume.
**Judge line:** *"It's a lens, not a costume. The model reasons like a security engineer, but the
output never says 'as Dana'; no character flavor, no attribution. The persona shapes the thinking,
not the prose."*
**Summary:** *Adopt judgment, not voice; no in-character text; never named in any artifact.*
Covers: #7, #8.

## Concept 5 — The governance guardrail (the crux)
**Explanation:** the load-bearing rule: a persona changes *what to scrutinize and prioritize*,
**NEVER the confidence to assume.** Codebase / architecture docs / ICEA are the only sources of
truth; a persona's "experience" is never evidence; it's subordinate to CLAUDE.md §3 ("do not
assume"). Expertise is **this project's actual detected stack**, never a fixed technology
(stack-agnostic, load-bearing for polyglot apps).
**Judge line:** *"Here's the safeguard that makes persona-prompting safe: a projected twenty-year
expert is still not allowed to guess. The persona sharpens the questions; the codebase is still the
only source of truth. And its 'expertise' is whatever stack you actually use, not a hardcoded one."*
**Summary:** *Persona changes what to scrutinize, never the licence to assume; subordinate to
'do-not-assume'; expertise = actual detected stack.*
Covers: #5, #8.

## Concept 6 — Tiering + single-primary → critic
**Explanation:** **tiering**: judgment (Tier 1) skills inline the full persona card; mechanical
(Tier 2) skills carry only a one-line lens (role priming helps only where judgment matters). **One
primary per step**; secondary roles are "also weigh these" notes; a genuine *second opinion* routes
through a separate pass, the **Critic** (Entry 10), not two co-primary personas stacked.
**Judge line:** *"Only judgment skills get the full persona; mechanical ones get a one-liner because
role-priming does nothing for a deterministic task. And a real second opinion isn't a second persona
in the same pass; it's a separate Critic run."*
**Summary:** *Judgment skills inline full card; mechanical get one-line lens; one primary per step;
second opinions route to the Critic.*
Covers: #7.

## Concept 7 — Evidence + fun framing
**Explanation:** measured: the roster, the per-skill assignment table, and the guardrail rules all
exist in `personas-spec.md`. **Not-yet-evaluated:** the output-quality lift personas produce (a
design belief, not a measured number). The fun/memorable payload is the **signature questions**.
**Judge line:** *"What's real is the spec: thirteen roles, assigned per skill, with a hard
no-assume guardrail. The quality lift I believe it gives, I've labeled not-yet-evaluated. The
memorable part writes itself: 'how do I make this fail?'"*
**Summary:** *Evidence = roster + assignment + guardrails (spec). Quality lift not-yet-evaluated. Fun
= signature questions.*
Covers: #6, #7.

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 2 |
| #2 problem | 1 |
| #3 working today | 2 |
| #4 AI role | 2, 3 |
| #5 flow + checkpoints | 4, 5 |
| #6 value + evidence | 2, 3, 7 |
| #7 resourceful/fun | 2 (cast) + 6 (reuse) |
| #8 responsible AI | 4, 5 |
| #9 demo | 2/5; `../../demo-scripts.md` §Entry 9 |

## The 3 lines that win Entry 09
1. **The cast:** "Thirteen experts, each with a signature question: 'how do I make this fail?', 'how would I abuse this?', 'what happens at 3am?'"
2. **The safeguard:** "A projected twenty-year expert is still not allowed to guess; the persona sharpens the questions, never the licence to assume."
3. **Lens not costume:** "It reasons like a security engineer, but the output never says so; a lens, not roleplay."
