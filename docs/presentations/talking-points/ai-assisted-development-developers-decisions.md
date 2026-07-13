# Talking Points — Developer Deep-Dive (Decisions & Lessons)

**Deck:** `ai-assisted-development-developers-decisions.html` · **Audience:** Developers (engineering narrative)
**Runtime:** ~60 min · **Slides:** 29 (~2 min each) · **Demos:** 4 🎬

**Opening hook (before slide 1):** *"Every line of this plugin is a decision someone had to
defend. Today we walk twelve of those decisions — the problem that forced each one, what we
chose, what we deliberately rejected, and the lesson. This one's meant to be argued with, so
push back."*

Delivery notes: this is the most discussion-driven deck — pause after each story and ask "would
you have done it differently?" Demo prep: provisioned repo, staged A-Number log line for B2.

---
### Slide 1 — Title · ⏱ 0:00–1:30
- Frame: the engineering story via ADRs. 12 stories, 4 demos.
### Slide 2 — Agenda · ⏱ 1:30–3:00
- Four clusters: gate & enforcement · structure & orientation · review & trust · evolution & themes.
- Each story: problem → decision → rejected → lesson.
### Slide 3 — Three founding lessons · ⏱ 3:00–5:30
- Stateless is expensive · orientation beats source reads · governance must be auditable. Almost every ADR is one of these applied.

---
## Cluster 1 — Gate & enforcement

### Slide 4 — Divider · ⏱ 5:30–6:00
### Slide 5 — 0001 · ICEA gate · ⏱ 6:00–8:00
- Rework dominated; specs thin. No code until approved ICEA — a contract, not documentation.
- Read the quote: **"one well-written spec prevents ~3 bounced PRs."** Ask: too heavy for small changes? (T1 auto-ICEA answers that.)
### Slide 6 — 0002 · output-gated · ⏱ 8:00–10:00
- Input triggers failed (model implemented before the skill loaded). Gate the **output**, not the input.
- Lesson: "enforcement that depends on being consulted first will be bypassed."
### Slide 7 — 0005/0009 · enforcement ladder · ⏱ 10:00–12:00
- Prompts probabilistic; local hooks bypassable. 3 tiers, lowest that holds; server-side authoritative.
- Lesson: a local bypass becomes CI telemetry.
### Slide 8 — 0027 · the gate that was silently off · ⏱ 12:00–14:00
- Re-run overwrote approvals (data loss); investigation found a filename-glob + emoji-status-regex mismatch → **approved ICEAs failed the gate.**
- Lesson: test the gate, not just the happy path. (Great discussion moment.)
### Slide 9 — 0031 · disk-based state · ⏱ 14:00–16:00
- State in chat broke reopening. Status line = single source, read from disk. Action Teams approvals with one phrase.
### Slide 10 — 🎬 DEMO 1 · the gate live · ⏱ 16:00–18:30
- **Steps:** `/icea-feature ADO-1847` → critic gap → `APPROVE` → `IMPLEMENT` → write gate → **reopen a fresh session** → `STATUS ADO-1847` shows disk state.
- **Expected:** state survives the session boundary (0031). **Fallback:** terminal mockup.

---
## Cluster 2 — Structure & orientation
*Story arc: foundation → problem → answer → proof → reinforce. Deliver it as one build, not five separate facts.*

### Slide 11 — Divider · ⏱ 18:30–19:00
- "How we stopped every run from starting cold." Set up the arc.
### Slide 12 — 0003 · shared primitives (foundation) · ⏱ 19:00–21:00
- Three copies of every bug; gate logic diverged. 2+ skills → shared; validator enforces. **Define once, reuse** — the DNA of everything that follows.
### Slide 13 — Every run was a cold start → orientation (PROBLEM + answer) · ⏱ 21:00–23:30
- **This is the story point.** Problem: every run started cold — model re-read source to *orient* AND scanners re-read *unchanged* files.
- **Answer, orientation-first:** primary = an orientation layer that arrives pre-loaded — **knowledge graph + architecture docs + `/session-start`**; secondary = file-cache + scope flags (scanners only).
- Lesson: **orientation beats source reads** (founding lesson #2). This is *why* we built session-start, the graph, and the arch docs. Cache is a scoped bonus — say so.
### Slide 14 — 0038/39/41 · the graph (answer, deepened) · ⏱ 23:30–25:30
- HOW the orientation layer is built and why it's trustworthy: single layer, authoritative graph.json, typed edges + module fingerprints, deterministic edges.
- Lesson: one source of truth; correctness before richness; mechanical work in scripts.
### Slide 15 — 🎬 DEMO 2 · graph-viz (PROOF) · ⏱ 25:30–27:30
- **Steps:** `/graph-viz` — the orientation answer, made visible. Reads graph.json (0039), deterministic edges (0041), committed like source (0038); hover for dependents, hub=gold, stale=red.
- **Expected:** the pre-loaded map that replaces re-reading source. **Fallback:** SVG mockup.
### Slide 16 — 0040 · CLAUDE.md budget (REINFORCE) · ⏱ 27:30–29:00
- Same "context has what it needs, no waste" principle: keep even the always-loaded CLAUDE.md lean. Budget by **adherence**, ~200 lines (150 ≈ 1% of 200K — capacity isn't the limiter).
- Good debate moment: capacity is abundant; signal-to-noise is the real constraint.

---
## Cluster 3 — Review & trust

### Slide 17 — Divider · ⏱ 29:00–29:30
### Slide 18 — 0012 · critic · ⏱ 29:30–31:30
- Nothing checked code as produced; spec had dropped from context. Critic sees ICEA + code together; regenerate ×2.
- Lesson: only the critic can see spec and code at once.
### Slide 19 — 0013 · source-file consent · ⏱ 31:30–33:30
- Skills read source silently. Three consent categories (A/B/C); every skill declares one.
- Lesson: **"opacity is poison"** for a tool you're meant to trust.
### Slide 20 — 0015 · business severity · ⏱ 33:30–35:30
- CVSS doesn't know the business. B1–B7 escalate one band across all review skills.
- Lesson: domain context is non-optional; severity without it is folklore.
### Slide 21 — 🎬 DEMO 3 · B2 in action · ⏱ 35:30–38:00
- **Steps:** stage A-Number log → `/checkin` → Check D fails → B2 escalates Low→Critical → `/fix`.
- **Expected:** business context blocks the commit. **Fallback:** terminal mockup.

---
## Cluster 4 — Evolution & themes

### Slide 22 — Divider · ⏱ 38:00–38:30
### Slide 23 — Evolution part 1 · ⏱ 38:30–40:30
- 1.27 VCS-aware ignore · 1.31 write gate + hierarchical ICEA · 2.0 session-independent · 2.1 single-responsibility + draft-then-save. Each fixed a real cost.
### Slide 24 — Evolution part 2 · ⏱ 40:30–42:30
- The graph arc: 2.6 graph → 3.0 single layer → 3.3 graph.json authoritative → 3.5/3.6 deterministic edges. Prose → structured, deterministic, committed data.
### Slide 25 — Themes 1 · ⏱ 42:30–44:30
- Enforcement is a ladder · state belongs on disk · one source of truth · mechanical work → scripts.
### Slide 26 — Themes 2 · ⏱ 44:30–46:30
- Signal-to-noise > token count · domain context non-optional · transparency table-stakes · gate your own work.
### Slide 27 — 🎬 DEMO 4 · dream-health · ⏱ 46:30–49:00
- **Steps:** `/dream-health` → confidence, decay, promote candidates → click justification (audit trail) → mention `/dream-rollback`.
- **Expected:** one source of truth, auditable, reversible — the themes embodied. **Fallback:** card mockup.
### Slide 28 — The through-line · ⏱ 49:00–52:00
- Synthesize: **prefer the mechanism that holds when attention doesn't** — disk over chat, scripts over guesses, incentives over instructions, one truth over three.
- Open discussion here.
### Slide 29 — Close · ⏱ 52:00–60:00 + Q&A
- Three lessons explain nearly every ADR · eight themes generalize · 45 ADRs + migrations on disk.
- Ask: **which decision would you have made differently?** Point to balanced + architecture decks.

---

## Q&A prompt-bank
- *"Isn't the ICEA gate overkill for a one-line fix?"* → Change tiers: T1 micro changes get an auto-ICEA; the full gate is for real design.
- *"The CLAUDE.md 'capacity is a non-constraint' claim?"* → 150 lines ≈ 2K tokens ≈ 1% of a 200K window; the limiter is adherence, not space.
- *"Why not let the model extract graph edges?"* → Non-deterministic, token-costly, and drags source into context for the one part a parser resolves exactly.
- *"How was the 'gate silently off' bug caught?"* → Investigating the re-run overwrite (0027) surfaced the filename/regex mismatches — the floor wasn't matching real files.
- *"Which decision is most contested?"* → Good ones to debate: 0040 (budget by adherence) and 0013 (per-file consent as friction vs trust).
