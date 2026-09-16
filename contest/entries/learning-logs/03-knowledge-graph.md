# Learning Log — Entry 03: Codebase Knowledge Graph

> Judge-defense study log. One section per concept: plain explanation + judge-ready answers.
> Goal: present live and defend under questioning; answer any of the 9 form fields from memory.
> Companion docs: entry = `../03-knowledge-graph.md`; evidence = `../../measured-claims.md`
> §1, §4; demo = `../../demo-scripts.md` §Entry 3. Source specs: `skills/shared/graph-json-schema.md`,
> `skills/graph-sync/SKILL.md`.

**The spine:** Entry 03 is the graph as an **ARTIFACT**: what it is, how it's built, why it's
trustworthy. The lead category is Resourcefulness (accurate structure from offline scripts + hashes,
not model guessing or full re-scans). **Keep it strictly on the artifact lens; Entry 04 owns the
"efficiency engine / what it saves" lens.**

**Concept map (7):** (1) core problem: structure is expensive to know, unreliable if guessed · (2)
what the graph *is* (authoritative JSON + projected markdown) · (3) deterministic edges + confidence
provenance, THE trust crux · (4) fingerprint-based incremental freshness · (5) integrity +
determinism guarantees · (6) how it's consumed + visualized (Entry 04 boundary) · (7) evidence +
resourcefulness framing.

Status: ✅ Concepts 1–7 locked (all covered).

---

## Concept 1 — The core problem

### Explanation

Knowing a codebase's structure (modules, dependencies, who-calls-whom) is (a) **expensive** to
reconstruct by re-reading source, and (b) **unreliable if an LLM guesses it**: a model will
confidently invent dependency edges. A hallucinated dependency is worse than a missing one: it
sends a refactor/impact analysis into a wall. Need structure that is *both* cheap to keep current
*and* trustworthy, usually a trade-off.

### Judge-ready line

*"Ask a model for your dependency graph and it'll make some of it up. A guessed dependency is worse
than a missing one; it sends your refactor into a wall. The problem is structure you can trust,
without re-reading the repo every time."*

### Summary (memorize)

*Structure is costly to reconstruct and dangerous to guess (hallucinated edges). Entry 03 makes it
cheap AND trustworthy.*

**Covers form fields:** #2.

---

## Concept 2 — What the graph *is* (the artifact)

### Explanation

- **`.claude/graph/graph.json`, authoritative machine-readable structure:** typed **nodes** (per
  module: `id`, `type` ∈ service/repository/ui/datastore/external-api/shared-lib/domain,
  `entryPoint`, `paths`, `fingerprint`, `hub`) + typed directed **edges**
  (`depends`/`calls`/`publishes`/`reads`/`extends`).
- **Markdown (`graph-index.md` + detail files) = generated PROJECTION** of the JSON, for cheap
  model reading.
- **One source of truth:** JSON is authoritative; markdown is projected from it, never hand-edited
  (ADR 0038 retired `domain-map.md` to kill dual-source drift). `graph.json` is **committed +
  PR-reviewed like source.**

### Judge-ready line

*"One authoritative JSON of typed nodes and typed edges; the readable markdown is projected from it,
never maintained separately. One source of truth, so it can't drift against itself, and it's
version-controlled and reviewed like code."*

### Summary (memorize)

*Authoritative graph.json (typed nodes + typed edges + fingerprints); markdown is a generated
projection. Single source of truth, committed and PR-reviewed.*

**Covers form fields:** #3.

---

## Concept 3 — Deterministic edges + confidence provenance (THE trust crux)

### Explanation

Kills the hallucination problem by construction. Every edge has a `confidence`:
- **`EXTRACTED`**: found directly in source (import/using/require/ProjectReference).
- **`INFERRED`**: reasonable model inference (DI, dynamic/config wiring a parser can't see).
- **`AMBIGUOUS`**: flagged for human review.

Strict division of labor:
- **`EXTRACTED` edges = produced by `graph-extract-edges.js` (ADR 0041), offline (Node stdlib);
  raw source never enters the model's context.** The model may NOT hand-write an `EXTRACTED` edge.
- **The model authors only `INFERRED`/`AMBIGUOUS`**, and **impact analysis must never treat those
  as fact.**

So hard edges = parser-derived truth; soft edges = labeled inference. No dependency is presented as
fact unless a script found it in source.

### Judge-ready line

*"Real dependencies come from a script that parses your imports offline; the model never sees the
source, so it can't hallucinate them. Anything the model infers is labeled inferred, and impact
analysis is forbidden to treat inferred edges as fact. Trust is built into the data, not promised."*

### Summary (memorize)

*Edges carry provenance: EXTRACTED (script-parsed, offline, ADR 0041) vs INFERRED/AMBIGUOUS
(model, never treated as fact). No hallucinated dependencies by construction.*

**Covers form fields:** #4, #6, #8.

---

## Concept 4 — Fingerprint-based incremental freshness

### Explanation

- **Module-wide fingerprint** = hash over **all files under the module's `paths`** (not a single
  entry-point file) → any add/delete/rename/edit marks that module stale. Deterministic
  (order-independent `sort -z`).
- A **git hook** writes a `.stale` flag listing drifted modules (a hint only).
- **`/graph-sync`** recomputes fingerprints, regenerates **only changed modules**, detects
  new/removed/renamed, re-derives edges, flags hubs, promotes flat→domain past 30 modules.
  Fingerprint comparison is authoritative; `.stale` is just a hint.

### Judge-ready line

*"Each module is hashed over all its files, so any change marks just that module stale. Sync
regenerates only what changed, not the repo. Freshness without a full re-scan."*

### Summary (memorize)

*Module-wide file-hash fingerprints → regenerate only fingerprint-changed modules. Git hook flags
staleness (hint); fingerprint comparison is authoritative.*

**Covers form fields:** #3, #5, #7.

---

## Concept 5 — Integrity + determinism guarantees

### Explanation

1. **Machine-validated integrity**: `tests/validate.py` check 9: `moduleCount == nodes == index
   rows == detail files` (no orphans), no dangling edges, unique ids, JSON↔markdown projection
   agreement (no drift). Part of the **300/0 validation** the plugin passes.
2. **Deterministic output**: stable sort + fixed key order + 2-space indent → two syncs of an
   unchanged repo produce a **byte-identical file** (minimal diffs, reviewable).

Plus: **hub (god-node) flagging** (high-degree modules excluded from neighborhood expansion so they
don't blow the token budget) and **cycles reported, not rejected** (bidirectional deps can be
legitimate; allowlist).

### Judge-ready line

*"Its integrity is machine-checked (no orphans, no dangling edges, no drift between the JSON and
its markdown) and it's byte-for-byte deterministic, so an unchanged repo re-syncs to an identical
file. An artifact you can review in a PR."*

### Summary (memorize)

*Integrity machine-validated (check 9: no orphans/dangling/drift, part of 300/0). Deterministic
byte-identical output. Hubs flagged; cycles reported not rejected.*

**Covers form fields:** #6, #8.

---

## Concept 6 — How it's consumed + visualized (the Entry 04 boundary)

### Explanation

- **Consumed:** skills read a *slice* of the graph to orient; `graph.json` is **never auto-loaded**
  (no `paths:` frontmatter); it enters context only when a skill explicitly reads it. *(How much
  this SAVES is Entry 04's story; here just note the graph is the substrate.)*
- **Visualized:** `/graph-viz` → self-contained **offline HTML** map: nodes by type, edges by
  type+confidence, hubs + stale flagged, hover shows deps + dependents; `--3d` uses a locally
  vendored WebGL lib.
- **Boundary (say it out loud):** Entry 03 = graph as *artifact* (built + trustworthy); Entry 04 =
  same graph as *efficiency engine* (what it saves). One artifact, two lenses.

### Judge-ready line

*"This entry is about the artifact: a trustworthy, self-validating structural model. What it saves
in tokens when a dozen skills read it instead of re-scanning source is a separate story (Entry 4).
Same graph, different lens."*

### Summary (memorize)

*Skills read slices (never auto-loaded); graph-viz renders offline 2D/3D. Efficiency payoff belongs
to Entry 04; this entry stays on the artifact lens.*

**Covers form fields:** #3, #9.

---

## Concept 7 — Evidence + resourcefulness framing

### Explanation

- **Measured (design facts):** deterministic edges via `graph-extract-edges.js` (ADR 0041); no
  hallucinated deps (§4); incremental fingerprint sync; machine-validated integrity (check 9, part
  of 300/0, §1).
- **Resourcefulness pitch:** *more with less*, accurate, queryable structure from **offline
  scripts + hashes**, not a model re-reading the repo; refreshed by regenerating **only what
  changed**; **reverse edges (dependents) aren't stored, derived at query time** (no wasted
  structure).
- **NOT claimed:** onboarding/refactor-speed number → not-yet-evaluated.
- **Data-use (Category B):** graph-sync announces source reads; the edge extractor parses imports
  **offline; raw source never enters model context.**

### Judge-ready line

*"More with less: an accurate dependency model from offline scripts and file hashes, refreshed only
where the code changed. It doesn't even store reverse edges; it derives them. No wasted structure."*

### Data-use disclosure (field 8 boilerplate)

*Operates on the local repo + Claude Code sessions; no source leaves the environment except explicit
ADO/Anthropic API calls the user initiates. Secrets are hook-blocked from committed config;
sensitive data is flagged via B1–B7 severity.*

### Summary (memorize)

*Evidence = deterministic edges (ADR 0041) + incremental sync + machine-validated integrity.
Resourcefulness = offline scripts/hashes, delta-only regen, dependents derived not stored.*

**Covers form fields:** #6, #7, #8.

---

## Quick map: concept → form field

| Form field | Concepts that answer it |
|---|---|
| #1 title / pitch | 1 (problem) + 3 (script not guess) |
| #2 problem + audience | 1 |
| #3 what's working today | 2, 4, 6 |
| #4 AI role + tools | 3 |
| #5 solution flow + checkpoints | 4 |
| #6 value + evidence | 3, 5, 7 |
| #7 resourceful / memorable | 4, 7 (offline scripts, delta-only, dependents derived) |
| #8 responsible AI / limits / data | 3, 5, 7 |
| #9 demo (+ backup) | 6 (graph-viz beats); `../../demo-scripts.md` §Entry 3 |

---

## The 3 lines that win Entry 03

1. **Trust:** "Real dependencies come from a script parsing your imports offline; the model never
   sees the source, so it can't hallucinate them. Inferred edges are labeled inferred."
2. **Resourcefulness:** "Accurate structure from offline scripts and file hashes, refreshed only
   where the code changed; it doesn't even store reverse edges, it derives them."
3. **Boundary:** "This is the graph as an artifact; what it saves in tokens is Entry 4. Same graph,
   two lenses."
