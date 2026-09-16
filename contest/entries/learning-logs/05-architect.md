# Learning Log — Entry 05: The Architect

> Judge-defense study log. One section per concept: explanation + judge-ready line + summary.
> Companion docs: entry = `../05-architect.md`; evidence = `../../measured-claims.md` §1, §4;
> demo = `../../demo-scripts.md` §Entry 5. Source spec: `skills/architect/SKILL.md`.

**The spine:** turn undocumented code into **living, evidence-derived** architecture docs that the
whole AI workflow runs on, and **never fabricate** (gaps are visible `⚠` markers). Lead category:
Practical value.

**Concept map (7):** (1) core problem, stale/absent architecture · (2) what it produces (8 composed
docs + Mermaid + deployment context) · (3) evidence-derived, never fabricate · (4) the APPROVED
deployment gate · (5) idempotent / non-destructive · (6) write-once read-many (the substrate) · (7)
evidence + framing.

Status: ✅ Concepts 1–7 locked.

---

## Concept 1 — The core problem
**Explanation:** codebases lack current architecture docs, or the docs rotted. Humans (onboarding)
AND AI tooling need an accurate map, but hand-maintained docs drift, and an AI told to "document
the architecture" will invent SLAs, rationale, and data flows that aren't there.
**Judge line:** *"Every team either has no architecture docs or docs that lie. And the easy fix,
'ask the AI to write them,' just produces confident fiction. The problem is an accurate map that
stays honest about what it doesn't know."*
**Summary:** *Absent/stale architecture hurts humans and AI; naive AI docs fabricate. Architect makes
an accurate, honest map.*
Covers: #2.

## Concept 2 — What it produces (the artifact set)
**Explanation:** detects the stack (12+ repo types), then deploys an **8-document set composed** from
a stack-agnostic base + a stack-specific overlay (same-named stack file wins). `architecture.md`
includes two **Mermaid** diagrams (End-to-End + Layered). `architecture-deployment.md` comes from a
questionnaire; `architecture-decisions.md` is a seed-only AD-NNN log.
**Judge line:** *"One command detects the stack and produces eight tailored docs, including two
generated architecture diagrams, by composing a shared base with a stack overlay, so twelve stacks
reuse one foundation."*
**Summary:** *8 composed docs (base + stack overlay), two Mermaid diagrams, plus a human-approved
deployment context doc.*
Covers: #3.

## Concept 3 — Evidence-derived, never fabricate (the trust crux)
**Explanation:** every value must come from actual source; undeterminable sections get `⚠ Could not
determine — needs manual input`; decisions are **seed-only** (rationale/NFR/SLA/timeouts never
invented); Mermaid is never emitted empty/invalid (keep the `⚠` instead).
**Judge line:** *"It documents only what the code proves. Everything it can't determine becomes a
visible ⚠ marker, never a guess. A wrong architecture doc is worse than a gap."*
**Summary:** *Only code-proven facts; gaps are `⚠` markers; rationale never invented. Honesty by
construction.*
Covers: #4, #6, #8.

## Concept 4 — The APPROVED deployment gate
**Explanation:** deployment context (hosting, CI/CD, envs, secrets, rollback, DB, Entra/SPA auth,
NFRs) is collected in one questionnaire pass; the draft is shown; **nothing is written until the
developer replies the exact word `APPROVED`** ("looks good"/"yes" don't count). Edits round-trip
the changed section only.
**Judge line:** *"Deployment facts are the ones humans must own, so that doc isn't written until you
review the draft and type the exact word APPROVED. The human owns the operational truth."*
**Summary:** *One-pass questionnaire → draft → exact-word APPROVED before any write. Human owns
deployment truth.*
Covers: #5, #8.

## Concept 5 — Idempotent / non-destructive
**Explanation:** a three-signal "populated?" detector (TEMPLATE marker / scaffold tokens / missing
diagram headings) means it **populates only missing files and never overwrites real content**; the
decisions log is append-only once it has AD-NNN entries.
**Judge line:** *"Safe to re-run: it detects what's already populated and touches only the gaps.
It never clobbers your real content or your hand-written decision log."*
**Summary:** *Three-signal detector → populate only missing; never overwrite real content; decisions
log append-only.*
Covers: #3, #8.

## Concept 6 — Write-once, read-many (the substrate)
**Explanation:** the one doc set is the shared baseline consumed by `icea-feature`, `security`,
`app-readiness`, `explain`, and the knowledge graph; a single pass also scaffolds sibling projects
in `additionalDirectories`.
**Judge line:** *"You generate the architecture once, and the specs, security scan, readiness
assessment, and explanations all read from it. Write-once, read-many."*
**Summary:** *One architecture doc set feeds the whole workflow (icea-feature/security/app-readiness/
explain/graph) + multi-project scaffolding.*
Covers: #6, #7.

## Concept 7 — Evidence + framing
**Explanation:** measured design facts: write-once/read-many (those skills read
`.claude/architecture/`), never-fabricate hard rules, non-destructive detector. Onboarding-time
reduction = **not-yet-evaluated**. Category B consent (announces source reads).
**Judge line:** *"The value that's proven: one honest doc set the whole workflow consumes. The
onboarding-time savings I'd expect, I've labeled not-yet-evaluated, because I haven't measured it."*
**Summary:** *Evidence = substrate reuse + never-fabricate + non-destructive. Onboarding gains
not-yet-evaluated.*
Covers: #6, #7, #8.

---

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 2 |
| #2 problem | 1 |
| #3 working today | 2, 5 |
| #4 AI role | 2, 3 |
| #5 flow + checkpoints | 4 |
| #6 value + evidence | 3, 6, 7 |
| #7 resourceful | 2 (composed) + 6 (write-once read-many) |
| #8 responsible AI | 3, 4, 5, 7 |
| #9 demo | 4/2 (diagrams); `../../demo-scripts.md` §Entry 5 |

## The 3 lines that win Entry 05
1. **Honesty:** "It documents only what the code proves; everything else is a visible ⚠, never a guess."
2. **Practical value:** "Generate the architecture once; specs, security, readiness, and explanations all read from it."
3. **The wow:** "Those diagrams came from code the model had never seen before this demo."
