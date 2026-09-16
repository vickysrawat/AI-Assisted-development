# Learning Log — Entry 06: Legacy Migration Family

> Judge-defense study log. One section per concept: explanation + judge-ready line + summary.
> Companion docs: entry = `../06-migration-family.md`; evidence = `../../measured-claims.md` §4;
> demo = `../../demo-scripts.md` §Entry 6. Source specs: `docs/migrations/2026-09-migration-skill-family.md`,
> `skills/rewrite/SKILL.md`, `skills/upgrade`, `skills/replatform`, `skills/shared/migration-ledger-schema.md`.

**The spine:** legacy modernization "without the cowboy": three focused, **gated, resumable**
skills carved on *locality*, each with a different AI role, plus honest scoping (Upgrade refuses to
pretend a rewrite is an upgrade). Lead category: Working solution.

**Concept map (7):** (1) core problem: "migrate" hides 3 jobs · (2) three skills carved on locality
(the taxonomy, no auto-routing) · (3) Upgrade = orchestrator, rejects false-upgrades · (4) Rewrite =
generative author with guardrails · (5) Replatform = AI authors, human executes · (6) resumability +
VERIFIED vs INFERRED · (7) evidence + framing.

Status: ✅ Concepts 1–7 locked.

---

## Concept 1 — The core problem
**Explanation:** "migrate this legacy app" hides three different jobs with different risks: a
version bump, a language/framework translation, and a hosting move. Conflating them is how
migrations go cowboy (a rewrite sold as an "upgrade", a cutover with no runbook, no way to resume).
And an LLM loose on a migration produces plausible-but-wrong target code.
**Judge line:** *"'Migrate' is three different jobs pretending to be one. Treat them the same and you
get a rewrite disguised as an upgrade, a cutover with no runbook, and no way to resume when it
breaks."*
**Summary:** *One word ("migrate") = three jobs with different risks; conflation is the danger.*
Covers: #2.

## Concept 2 — Three skills carved on locality (the taxonomy)
**Explanation:** same stack ↑ version, in-place → **Upgrade**; different stack, new target folder →
**Rewrite**; move the hosting/topology → **Replatform**. **No auto-routing**: the human picks
(a classifier would be rigid and could misroute); each has `… RESUME` and `… STATUS`.
**Judge line:** *"Three skills, split on locality: same stack higher version is Upgrade, different
stack is Rewrite, different host is Replatform. We deliberately don't auto-route; you choose,
because misrouting a migration is expensive."*
**Summary:** *Upgrade (in-place ↑version) · Rewrite (new-folder new-stack) · Replatform (move host).
Human chooses; no auto-routing.*
Covers: #1, #3.

## Concept 3 — Upgrade = orchestrator, not author
**Explanation:** Upgrade **plans and drives an *external* deterministic tool** for a same-stack version
bump (the plugin emits the ordered steps; the stack-native tool does the actual transform) and produces
a gap/risk report; crucially it **rejects false-upgrades** (a change that's really a rewrite) and
routes them to Rewrite instead of pretending.
**Judge line:** *"Upgrade plans and drives an external deterministic tool (the transform isn't the
model's imagination), and it refuses to pretend a rewrite is an upgrade. If the gap is too big, it says
so and hands you to Rewrite."*
**Summary:** *Upgrade = plan + drive an external deterministic tool + gap/risk report; rejects
false-upgrades → Rewrite. Honest scoping.*
Covers: #3, #6, #8.

## Concept 4 — Rewrite = generative author with guardrails
**Explanation:** the LLM is a generative **author**. Posture resolves from **stack distance** (port
only when language + framework are unchanged; any change forces re-architecture). Presents target
**options** (assurance × effort × TCO, or a BYO design held to the same scrutiny), decomposes in
**target space along a dependency DAG**, and **schedules the clusters into isolated git worktrees**
(designed not to collide), generating one cluster at a time behind a **design-quality gate**, a
**Behavioral Assurance Level (BAL)**, and an **Enterprise-Readiness Level (ERL)**, then a **merge
gate** and a **completion gate**.
**Judge line:** *"Rewrite is generative, so it's the most gated: posture from stack distance, target
options you choose, decomposition along a dependency graph, clusters scheduled into isolated git
worktrees so parallel work is designed not to collide, and every cluster carries a behavioral and an
enterprise-readiness level behind two gates."*
**Summary:** *Rewrite = author; posture-from-distance, target options, DAG decomposition, clusters in
isolated worktrees, per-cluster BAL+ERL, merge + completion gates.*
Covers: #3, #4, #7.

## Concept 5 — Replatform = AI authors, human executes
**Explanation:** hosting/topology move (on-prem → cloud). The LLM **authors IaC + human-runnable
runbooks**; a **human executes** the cutover; the result is graded against an NFR/Well-Architected
oracle. The AI is never the executor of the risky production cutover.
**Judge line:** *"For replatform the AI writes the infrastructure-as-code and the runbook, and a
human runs the cutover. The model authors; the human pulls the trigger on production."*
**Summary:** *Replatform = AI authors IaC + runbooks, human executes cutover, graded vs
NFR/Well-Architected oracle.*
Covers: #3, #5, #8.

## Concept 6 — Resumability + VERIFIED vs INFERRED knowledge
**Explanation:** every skill is **resumable** from a persisted, merge-write ledger (`… RESUME` continues
from the **last recorded gate**; `… STATUS` is the icea-status-style re-entry that ends with the single
next action). Honest nuance: the ledger + gate design are deterministic, but the *replay* on resume is
**LLM-driven re-orientation, not a mechanical replay engine.** Knowledge is **web-grounded to
`VERIFIED`** at runtime; an offline tier (`migration-knowledge/refs`) is the `INFERRED` fallback (lowest
authority), never mixed.
**Judge line:** *"Kill the session mid-migration and RESUME picks up from the last recorded gate in the
ledger; it's an LLM re-orienting from a persisted ledger, not a mechanical replay. And facts are
web-grounded and labeled VERIFIED; the offline fallback is labeled inferred, so we never pass a guess off
as a confirmed fact."*
**Summary:** *Ledger-based RESUME (from last recorded gate; LLM re-orientation, not mechanical replay) /
STATUS re-entry; VERIFIED (web) vs INFERRED (offline fallback), labeled and never mixed.*
Covers: #3, #4, #8.

## Concept 7 — Evidence + framing
**Explanation:** measured design facts: resumable ledger; per-cluster BAL/ERL levels; Upgrade drives an
external deterministic tool; false-upgrade rejection. **Not-yet-evaluated / deferred:** migration success
rate on a real production app (not-yet-evaluated); **Replatform's full NFR-assurance oracle** (NFR
grading + Well-Architected + behavioral regression) is **deferred to a later increment**; its intake,
options, decomposition, executor seam, and reconciliation gate are live; the "prove-done" oracle is not
yet. Support is a subset of the stack matrix.
**Judge line:** *"What's proven is the machinery: resumable ledgers, per-cluster verification levels,
honest scoping. Replatform's full prove-done NFR oracle is deferred, and a production success rate is
not-yet-evaluated. I'll say both rather than imply they're done."*
**Summary:** *Evidence = resumable ledger + per-cluster BAL/ERL + honest scoping. Replatform NFR oracle
deferred; prod success rate not-yet-evaluated.*
Covers: #6, #8.

---

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 2 |
| #2 problem | 1 |
| #3 working today | 2, 3, 4, 5 |
| #4 AI role | 3, 4, 5 |
| #5 flow + checkpoints | 4 (rewrite), 3, 5 |
| #6 value + evidence | 3, 6, 7 |
| #7 resourceful | 4 (worktree/DAG) + 6 (resume) |
| #8 responsible AI | 2, 3, 5, 6, 7 |
| #9 demo | 3 + 6 (resume beat); `../../demo-scripts.md` §Entry 6 |

## The 3 lines that win Entry 06
1. **Honest scoping:** "It refuses to pretend a rewrite is an upgrade; if the gap's too big, it hands you to Rewrite."
2. **Resumability:** "Kill the session mid-migration; RESUME continues from the last recorded gate in the ledger (LLM re-orientation, not a mechanical replay)."
3. **Gated generation:** "One git worktree per cluster, each carrying a behavioral and enterprise-readiness level behind a merge and a completion gate."
