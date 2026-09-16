# Learning Log — Entry 04: Token-Efficiency Engine

> Judge-defense study log. One section per concept: plain explanation + judge-ready answers.
> Goal: present live and defend under questioning; answer any of the 9 form fields from memory.
> Companion docs: entry = `../04-token-efficiency.md`; evidence = `../../measured-claims.md`
> §2–3; demo = `../../demo-scripts.md` §Entry 4 (pending rework — see Concept 6).

**Two things define this entry:**
1. **The central lever is the KNOWLEDGE GRAPH, not the file-cache.** Verified: file-cache is
   consumed only by `code-review` / `security` (narrow); the graph is consumed by ~45 files
   across generation, modification, review, explanation, architecture, migration (broad). Lead
   with the graph; mention file-cache in one honest line.
2. **The spine is HONESTY.** The headline 96.9% is *prompt* caching (mechanism-agnostic context
   reuse); it does NOT by itself prove the graph-orientation or file-cache savings, which are
   *estimated*. Never let the measured number vouch for the estimated mechanism.

**Boundary vs Entry 03 (must say out loud):** Entry 03 = the graph as an *artifact* (how it's
built). Entry 04 = the graph as an *efficiency engine* (what it saves). One artifact, two lenses;
that overlap is the "write-once, read-many" resourcefulness point, not a weakness.

**Concept map (7):** (1) core problem · (2) the graph as the central efficiency lever · (3) three
mechanisms, kept separate (THE crux) · (4) what the 96.9% actually proves (and doesn't) · (5)
determinism = engineered savings, not model luck · (6) human checkpoints / flow · (7) labeling
discipline / responsible-AI.

Status: ✅ Concepts 1–7 locked (all covered). Reframed graph-centric (was file-cache-centric).

---

## Concept 1 — The core problem

### Explanation

AI dev tools **re-acquire the same context on every invocation**, re-reading source to re-learn
structure the model already saw. Cost scales with *repo size × task frequency*, not with *what
changed*. The trap: teams either pay for the waste or stop running the AI-assisted steps, and
stopping is how the value evaporates.

### Judge-ready line

*"The waste isn't linear with your work; it's linear with your repo. Change one file and the
tool re-learns the whole codebase to help. Eventually people stop running it, and that's the real
cost."*

### Summary (memorize)

*Naive AI tooling re-acquires context every time, so cost tracks repo size, not the change.
Entry 04 makes the workflow reuse context instead, chiefly via the knowledge graph.*

**Covers form fields:** #2 (problem/audience).

---

## Concept 2 — The knowledge graph as the central efficiency lever

### Explanation

The primary vehicle for "reuse context, don't re-acquire it" is the **knowledge graph**: skills
read `.claude/graph/graph.json` (typed nodes + typed edges) to learn structure and dependencies
**without re-reading source**. It's broad, used across:
- **generation**: `icea-feature`
- **modification**: `bug`, `icea-revise`, `rewrite`
- **explanation**: `explain`
- **review**: `code-review`, `pr-spec-review`
- **architecture**: `architect`, `update-arch`
- **planning / warm-up**: `ado-tasks`, `pr-describe`, `session-start`

Two supporting levers:
- **`/token-analysis`**: persistent cache; each run processes only new sessions + changed files;
  reports cost + recommendations.
- **File-cache (narrow)**: review-only (`code-review`, `security`); skips re-reading unchanged
  files. One honest line, not the headline.

### Judge-ready line

*"The efficiency engine is the graph. Instead of re-reading source to understand structure, a
dozen skills (generate, modify, review, explain) orient from one graph. Read the codebase's
shape once; reuse it everywhere."*

### Summary (memorize)

*Central lever = knowledge-graph orientation (read structure from graph.json, not source), used
broadly across generate/modify/review/explain. token-analysis and the narrow review-only
file-cache are supporting.*

**Covers form fields:** #3 (what's working), #4 (tools).

---

## Concept 3 — Three mechanisms, kept separate (THE crux — never conflate)

### Explanation

Three different things reduce cost; the headline number belongs to only one:

| Mechanism | What it does | Scope | The number | Proven? |
|---|---|---|---|---|
| **Prompt caching** (Claude Code, built-in) | Re-processes tokens *already in context* at ~10% of full input price | LLM / context window | **96.9%** input-side, **MEASURED** | Yes, 34 dev sessions |
| **Graph orientation** (plugin, central) | Learn structure from `graph.json` instead of re-reading source | Broad skill family | per-task savings, **ESTIMATED** | Not independently benchmarked |
| **File-cache** (plugin, narrow) | Skip re-reading unchanged files | `code-review` / `security` only | 60–95% per-invocation, **ESTIMATED** | Not benchmarked |

The trap: a judge hears "96.9% cache" and assumes it proves the graph or file-cache works. It
does NOT: 96.9% is *prompt* caching, measured over this plugin's own development, a
mechanism-agnostic fact about context reuse.

### Judge-ready line (integrity of the whole entry)

*"Three caches, don't mix them. The 96.9% is Claude Code's prompt cache, measured on our own dev,
real. The graph-orientation savings and the review-only file-cache are our own mechanisms and
I've labeled them estimated. I won't let the strong number borrow credibility for the unproven
ones."*

### Summary (memorize)

*Prompt cache (measured 96.9%, mechanism-agnostic) ≠ graph orientation (estimated, the central
plugin lever) ≠ file-cache (estimated, review-only). The measured headline never vouches for the
estimated mechanisms.*

**Covers form fields:** #6 (evidence), #8 (limitations).

---

## Concept 4 — What the 96.9% actually proves (and doesn't)

### Explanation

Precise statement: **Measured over 34 dev sessions (~30 days, 13,328 assistant turns): 96.9% of
input-side tokens were served from prompt cache; 97.6% of turns had a cache hit.** Supporting:
24.7M output tokens, 3.78B cache-read tokens, 116.6M cache-creation tokens.

- **Proves:** the workflow reuses context; ~90% of the input surface billed at the cheap
  cache-read rate (~1/10th of fresh input) instead of full price. Legit *resourcefulness* claim.
- **Does NOT prove:** the graph-orientation savings or the file-cache 60–95% (Concept 3), nor any
  general benchmark; it's *this repo's own dev*, not a controlled test. Varies with repo size,
  change frequency, cache warmth.

### Judge-ready line

*"It proves the workflow reuses context rather than re-reading it. It does not prove a universal
number, and it does not by itself prove the graph savings; it's measured on our own 30 days of
development, and I've said so."*

### Summary (memorize)

*96.9% input-side from cache / 97.6% turns, over 34 sessions. Proves workflow cache-efficiency
(~10× cheaper input); does NOT prove the graph or file-cache mechanism claims, or a general number.*

**Covers form fields:** #6 (value + evidence).

---

## Concept 5 — Determinism: savings are engineered, not model luck

### Explanation

What makes it *resourcefulness* rather than a lucky prompt: the savings come from deterministic
scripts, not model behavior:
- **Graph edges** come from `graph-extract-edges.js` (ADR 0041) parsing imports, NOT the model
  guessing. No hallucinated dependencies; reproducible orientation.
- **Incremental refresh** (`graph-sync`) regenerates only changed modules via fingerprints.
- **token-graph** delta-processing is script-driven.
- (File-cache keying is a hash check: narrow, but also deterministic.)

Second run of the same state → same savings. A property of the engineering, not the model's mood.

### Judge-ready line

*"The efficiency is deterministic: script-extracted graph edges and fingerprint-based sync, not
a clever prompt. Run it twice, get the same savings. That's engineering, not luck. And because
the edges come from a script, there are no hallucinated dependencies."*

### Summary (memorize)

*Savings are deterministic: script-extracted graph edges (ADR 0041) + fingerprint incremental
sync + script-driven token-graph. Reproducible, not model-dependent; that's the resourcefulness
proof, and it kills the hallucinated-dependency worry.*

**Covers form fields:** #4 (AI vs rules), #7 (resourceful).

---

## Concept 6 — Human checkpoints / flow

### Explanation (with checkpoints)

1. A skill (e.g. `explain` / `code-review`) **orients from `graph.json`**: structure +
   dependencies without re-reading every source file. → **HUMAN reads the result.**
2. After edits, `/graph-sync` regenerates **only the changed modules** (fingerprint-based), so
   the next task's orientation stays cheap.
3. `/token-analysis` → cost report + recommendations. → **HUMAN CHECKPOINT: decides which
   recommendations to apply** (nothing auto-applied).

Split: **AI** generates/reviews/explains oriented by the graph; **scripts** extract edges, sync
fingerprints, drive the token-graph; **human** chooses scope and decides what to act on.

### Demo note (reworked — graph-first)

`../../demo-scripts.md` §Entry 4 is now a **graph-orientation beat**: `/explain` (or `/graph-viz`)
answers from `graph.json` without re-scanning source → hover a node (script-extracted edges, no
hallucinated deps) → edit a file → `/graph-sync` regenerates only that module → `/token-analysis`
→ deliver 96.9% / 97.6%, then label graph-orientation savings estimated. File-cache kept out of
the lead. Backup: pre-rendered `graph.html` + saved `/token-analysis` HTML.

### Summary (memorize)

*Orient from the graph → sync only changed modules after edits → token-analysis. Human picks
scope and decides which recommendations to apply; nothing auto-applied.*

**Covers form fields:** #5 (flow), #9 (demo — pending rework).

---

## Concept 7 — Labeling discipline / responsible-AI

### Explanation

The entry lives or dies on label hygiene:
- **Lead with the measured number** (96.9% / 97.6%, prompt cache).
- **Graph-orientation savings = `estimated`** (central mechanism, not independently benchmarked).
- **File-cache 60–95% = `estimated (internal)`, review-only**: reproducible ~10-min benchmark in
  `../../measured-claims.md` §3.
- **Limitations (state proactively):** 96.9% is this project's own dev, not a general benchmark;
  graph + file-cache reductions not yet independently measured.

### Data-use disclosure (field 8 boilerplate)

*Operates on the local repo + Claude Code sessions; no source leaves the environment except
explicit ADO/Anthropic API calls the user initiates. Secrets are hook-blocked from committed
config; sensitive data is flagged via B1–B7 severity.*

### Judge-ready line

*"The number I lead with is measured and reproducible. The mechanism savings I can't fully back
yet (graph orientation and the review-only file-cache) I've labeled estimated, and I can name
the exact benchmark to confirm them. That discipline is the point."*

### Summary (memorize)

*Lead measured (prompt cache), mark graph + file-cache estimated, name the benchmark, state the
limits. The honesty is the entry's strongest responsible-AI signal.*

**Covers form fields:** #6 (evidence), #8 (limits + data use).

---

## Quick map: concept → form field

| Form field | Concepts that answer it |
|---|---|
| #1 title / pitch | 1 (problem) + 2 (graph lever) |
| #2 problem + audience | 1 |
| #3 what's working today | 2 |
| #4 AI role + tools | 2, 5, 6 |
| #5 solution flow + checkpoints | 6 |
| #6 value + evidence | 3, 4, 7 |
| #7 resourceful / memorable | 2 (one graph, many consumers) + 5 (deterministic) + 4 (self-measured) |
| #8 responsible AI / limits / data | 3, 7 |
| #9 demo (+ backup) | 6 (graph-orientation beat — pending rework); `../../demo-scripts.md` §Entry 4 |

---

## The 3 lines that win Entry 04

1. **Integrity:** "I won't let the strong number borrow credibility for the unproven ones."
2. **Resourcefulness:** "One graph; generate, modify, review, explain all orient from it. Read
   the codebase's shape once; reuse it everywhere. Script-extracted edges, so no hallucinated
   dependencies."
3. **The number:** "96.9% of input-side tokens from cache over 34 real dev sessions; the
   workflow reuses context instead of re-reading it."
