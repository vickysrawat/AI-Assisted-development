# Learning Log — Entry 14: The Context Budget

> Judge-defense study log. Explanation + judge-ready line + summary per concept.
> Companion: entry = `../14-context-budget.md`; source spec: `skills/shared/claude-md-budget-spec.md`
> (ADR 0040) + budget mechanisms in dream/SKILL.md, graph-json-schema.md, app-readiness.

**The spine:** the scarce resource is the model's **attention/adherence**, NOT context-window capacity.
The plugin keeps the always-on preamble lean + high-signal so rules actually get followed, and applies
the same discipline system-wide.
**Boundary vs Entry 4:** Entry 4 = cost (tokens/$); Entry 14 = adherence (small enough that rules are obeyed).

**Concept map (6):** (1) core problem (capacity myth vs adherence limit) · (2) the ~200-line budget +
audit · (3) required floor vs externalisable · (4) system-wide budget discipline · (5) deterministic +
transparent guards · (6) evidence + framing.

Status: ✅ locked.

## Concept 1 — Capacity myth vs adherence limit
**Explanation:** capacity is a non-constraint: a 150-line instruction file is ~2K tokens ≈ 1% of a 200K
window (100× headroom). But always-on instruction text isn't reference the model consults; it's rules
**competing for attention every turn**. Past a few hundred lines, adherence degrades and rules get
missed. Wrong thing to measure = capacity; right thing = adherence.
**Judge line:** *"Everyone brags about window size. But your instructions aren't reference material the
model looks up; they're rules competing for its attention every turn. Past a few hundred lines it
quietly starts missing them. Capacity was never the limit; attention was."*
**Summary:** *Capacity is a non-constraint; always-on instructions degrade adherence past a few hundred
lines. Budget attention, not tokens.*
Covers: #2.

## Concept 2 — The ~200-line budget + audit
**Explanation:** the core instruction file is held to ~200 lines (~2.5–3K tokens), enforced by
`claude-md-audit.js --budget 200` and reported by setup + `dream-health`. The number is the adherence
smell-line, not a window limit. Verbose rationale/philosophy/model-config are externalised to reference
files that load only when relevant, with a one-line pointer left behind.
**Judge line:** *"There's a real budget (about 200 lines) enforced by an audit and reported at setup.
It's not arbitrary; it's the line past which adherence starts to slip."*
**Summary:** *~200-line instruction-file budget, audit-enforced; verbose content externalised with pointers.*
Covers: #3.

## Concept 3 — Required floor vs externalisable
**Explanation:** some things **must** stay always-on (output-gated governance): Write Gate, Keyword
Handlers, Shell/Git config, Feature Gate, plus required ADO config, giving a practical floor (~126–148
lines, ADR 0040). Everything else (design philosophy → rules, model routing → spec, rationale → shared
specs, long prose → docs) can be externalised.
**Judge line:** *"There's a floor it won't cut below: the always-on governance rails have to load every
session. Everything above that floor is kept lean by moving reference content out to files that load
only when they're relevant."*
**Summary:** *Governance rails are a required always-on floor; reference/config content is externalised
above it.*
Covers: #3, #8.

## Concept 4 — System-wide budget discipline
**Explanation:** not one file, a house style. The knowledge graph is **never auto-loaded** (no `paths:`
frontmatter; a skill reads only the slice it needs); hub modules are excluded from graph expansion so a
Core module can't blow the budget; memory consolidation **hard-stops** past a size threshold (>80K
combined; 30-conversation cap); generated detail files are token-capped (400 / index 350); readiness has
a `--quick` mode that reads no source. Spend the model's attention like it's scarce, everywhere.
**Judge line:** *"The same discipline runs through everything: the graph never auto-loads, big hub
modules are left out of expansions, memory runs hard-stop before they get too big, generated docs are
capped. It's a house style, not one file."*
**Summary:** *Budget discipline system-wide: no-auto-load graph, hub exclusion, memory hard-stops,
token-capped docs, lean readiness mode.*
Covers: #3, #6.

## Concept 5 — Deterministic + transparent guards
**Explanation:** the guards don't depend on the model choosing to be frugal: an audit script flags an
over-budget file (with a concrete "move this to a rule file" suggestion), the graph carries no auto-load
flag, memory hard-stops are code, detail files are capped by rule. When something drifts over, you're
**told**, with the fix.
**Judge line:** *"None of it relies on the model deciding to be tidy: it's an audit script, a
no-auto-load flag, a hard stop. And when something drifts over budget, it tells you, with a concrete fix."*
**Summary:** *Deterministic guards (audit, no-auto-load, hard-stops, caps), not model discretion;
transparent nudges when over budget.*
Covers: #4, #8.

## Concept 6 — Evidence + framing
**Explanation:** measured. The audit script (`--budget 200`), the never-auto-loaded graph, memory
hard-stops, token-capped detail files, `--quick` readiness, and the ADR 0040 required floor all exist.
**Not-yet-evaluated:** a measured adherence lift ("rules followed X% more under budget"), a design
conviction, not a controlled result.
**Judge line:** *"What's real is the machinery: the budget audit, the no-auto-load graph, the hard
stops. A percentage-better-adherence number I don't have; that's not-yet-evaluated."*
**Summary:** *Evidence = audit + no-auto-load graph + hard-stops + caps + required floor. Adherence lift
not-yet-evaluated.*
Covers: #6, #8.

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 |
| #2 problem | 1 |
| #3 working today | 2, 3, 4 |
| #4 AI role | 5 |
| #5 flow | 2, 4 |
| #6 value + evidence | 1, 4, 6 |
| #7 resourceful | 4 (system-wide restraint) |
| #8 responsible AI | 3, 5 |
| #9 demo | 2/4; `../../demo-scripts.md` §Entry 14 |

## The 3 lines that win Entry 14
1. **The thesis:** "Capacity was never the limit; the model's attention was."
2. **The budget:** "About 200 lines, audit-enforced: the line past which the model starts missing its own rules."
3. **The contrarian flex:** "Every other tool brags about how much context it can hold; this one is disciplined about how little it needs."
