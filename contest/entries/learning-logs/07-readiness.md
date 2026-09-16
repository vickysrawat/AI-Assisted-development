# Learning Log — Entry 07: Production Readiness (App + Plugin)

> Judge-defense study log. One section per concept: explanation + judge-ready line + summary.
> Companion docs: entry = `../07-readiness.md`; evidence = `../../measured-claims.md` §4;
> demo = `../../demo-scripts.md` §Entry 7. Source specs: `skills/app-readiness/SKILL.md`,
> `skills/plugin-readiness/SKILL.md`.

**The spine:** two assessors. One grades the **application** (8 EA/SA domains), one grades the **AI
workflow itself** (6 AI-architect domains), with structured maturity scoring and a verdict **built
to refuse overclaim**. Lead category: Practical value.

**Concept map (7):** (1) core problem: readiness is a vibe, and the AI workflow is ungraded · (2)
two assessors, two subjects · (3) structured maturity scoring · (4) evidence-not-vibes + anti-overclaim
· (5) scope discipline / consent · (6) B-series override · (7) evidence + framing.

Status: ✅ Concepts 1–7 locked.

---

## Concept 1 — The core problem
**Explanation:** "is it production ready?" is usually answered by gut feel. Readiness spans many
domains (pipeline, resilience, observability, security, scalability, data, runbook, tests), and the
*AI workflow that built the app* (model routing, governance, memory, budget) is graded by nobody.
**Judge line:** *"'Ready?' is usually a vibe. Real readiness is a dozen domains, and nobody ever
grades the AI workflow itself. We grade both, on a scale, with reasons."*
**Summary:** *Readiness is multi-domain and usually vibe-scored; the AI tooling is ungraded. This
entry scores both.*
Covers: #2.

## Concept 2 — Two assessors, two subjects
**Explanation:** `/app-readiness` (persona: Enterprise/Solution Architect) scores the **app** across
**8 domains** (EA-1..EA-8). `/plugin-readiness` (persona: AI Architect) scores the **AI workflow**
across **6 domains** (AI-1 infra, AI-2 routing, AI-3 memory, AI-4 governance, AI-5 skill quality,
AI-6 budget). The plugin one grades the tooling that built the app.
**Judge line:** *"Two architects in a box. One grades the application across eight domains; the other
grades the AI workflow that built it across six. The tooling gets held to the same bar as the code."*
**Summary:** *App-readiness = 8 EA/SA domains; plugin-readiness = 6 AI-architect domains. The workflow
grades itself.*
Covers: #3.

## Concept 3 — Structured maturity scoring
**Explanation:** every domain is scored on a **1–5 maturity scale** (1 not-started … 5 optimised),
mapped to **RAG** (Red 1–2 / Amber 3 / Green 4–5), with per-domain rationale and evidence. Verdicts
(**Ready / Conditionally ready / Not ready / Blocked**) are driven by **critical domains**: app:
resilience, observability, security, tests; plugin: infrastructure + governance.
**Judge line:** *"It's not pass/fail; it's a maturity score per domain with the evidence behind it,
and the verdict is gated by the critical domains, not an average."*
**Summary:** *1–5 maturity + RAG + rationale per domain; verdict gated by critical domains, not an average.*
Covers: #3, #6.

## Concept 4 — Evidence-not-vibes + anti-overclaim
**Explanation:** a failed API call becomes **`❓ Unknown`**, never a guess; never score a domain above
the evidence; **EA-4 (security) is never skipped** (no scan → score 1–2, blocking); and a plugin
**"ready" verdict requires the enforcement floor installed (or a recorded opt-out)**: "a ready
verdict with no mechanical floor would be exactly the overclaim this assessment exists to prevent."
**Judge line:** *"The whole point is to not overclaim. If a check can't be verified it's marked
Unknown, security is never skipped, and the plugin can't be called 'ready' unless the enforcement
floor is actually installed. It's designed to refuse a green light it can't justify."*
**Summary:** *❓ Unknown on failure; never above evidence; security never skipped; plugin "ready"
requires the floor. Anti-overclaim by construction.*
Covers: #4, #6, #8.

## Concept 5 — Scope discipline / consent
**Explanation:** `app-readiness` is **Category B**: `--quick` (~12K tokens) produces the full
scorecard with **no source reads**; `--full` (~25K) reads source **only for Red domains, only with
per-file consent (≤5 files)**. `plugin-readiness` is **Category C**: plugin state files only,
**never** application source.
**Judge line:** *"The quick mode grades all eight domains without reading a single source file. Full
mode only reads source for the Red domains, and only with consent. The plugin assessment never touches
app source at all."*
**Summary:** *App-readiness Category B (quick=no source; full=consent-gated Red only); plugin-readiness
Category C (state only).*
Covers: #4, #8.

## Concept 6 — B-series override
**Explanation:** any finding touching a resolved B-series business-context trigger (regulated/
confidential data, regulated identifiers, etc.) is a **blocker regardless of its domain score**;
severity is business-driven, not just CVSS.
**Judge line:** *"Business context overrides the score. A finding that touches regulated data is a
blocker even if the domain otherwise looks green."*
**Summary:** *Any B-series-triggering finding is a blocker regardless of score.*
Covers: #6, #8.

## Concept 7 — Evidence + framing
**Explanation:** measured design facts: structured multi-domain scoring with per-domain rationale;
the anti-overclaim mechanisms (`❓ Unknown`, security-never-skipped, floor-required). **Not-yet-evaluated:**
correlation of readiness scores with real incident rates. ADO checks need a PAT (else capped + flagged).
**Judge line:** *"What's proven is the structured, evidence-bound scoring and the anti-overclaim
rails. Whether a green score predicts fewer incidents: not-yet-evaluated; I won't claim it."*
**Summary:** *Evidence = structured scoring + anti-overclaim rails. Scores↔incidents correlation
not-yet-evaluated.*
Covers: #6, #8.

---

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 2 |
| #2 problem | 1 |
| #3 working today | 2, 3 |
| #4 AI role | 3, 4, 5 |
| #5 flow + checkpoints | 3, 5 |
| #6 value + evidence | 3, 4, 6, 7 |
| #7 resourceful | 4 (grades itself) + 5 (--quick zero source) |
| #8 responsible AI | 4, 5, 6, 7 |
| #9 demo | 2/3; `../../demo-scripts.md` §Entry 7 |

## The 3 lines that win Entry 07
1. **The framing:** "Two architects in a box: one grades the app, one grades the AI workflow that built it."
2. **Anti-overclaim:** "It's designed to refuse a green light it can't justify: Unknown on failed checks, and no 'ready' without the enforcement floor."
3. **Resourcefulness:** "The quick mode grades all eight domains without reading a single source file."
