# Talking Points — Developer Deep-Dive (Balanced)

**Deck:** `ai-assisted-development-developers-balanced.html` · **Audience:** Developers
**Runtime:** ~60 min · **Slides:** 31 (~1.9 min each) · **Demos:** 6 🎬

**Opening hook (before slide 1):** *"You've all used AI to write code. Today isn't a sales pitch —
it's a look under the hood: how this thing is built, why it's built that way, and how you'll
actually drive it. Six live demos, so keep your questions coming."*

Demo prep: a repo with the plugin provisioned (`/dream-init` already run), a feature ADO ID
(examples use ADO-1847), and a change that logs a client A-Number staged for the B2 demo. Each
demo slide has a mockup fallback — narrate it if the live env misbehaves.

---
## Act 1 — Why it exists

### Slide 1 — Title · ⏱ 0:00–1:30
- Frame the hour: architecture + decisions + workflow, balanced. 6 demos.
- → "Four acts."

### Slide 2 — Agenda · ⏱ 1:30–3:00
- Why it exists → architecture → decisions → workflow.
- → "It all starts with three lessons."

### Slide 3 — Three lessons · ⏱ 3:00–6:00
- Stateless is expensive · orientation beats source reads · governance must be auditable.
- These explain almost every design choice we'll see. Land the 80–95% quote.
- → "Let's open the hood."

---
## Act 2 — Architecture

### Slide 4 — Divider: Architecture · ⏱ 6:00–6:30
- We'll go layer by layer, then follow the data — with a demo at each stop.

### Slide 5 — Layered stack (Diagram 1) · ⏱ 6:30–9:00
- Command (thin) → skill → shared specs (real logic) → rules → hooks/artifacts.
- Key idea: **commands & skills are thin; the shared layer holds the logic, defined once.**
- → "Here's that shared layer."

### Slide 6 — Shared primitives · ⏱ 9:00–11:30
- Tour the ones you feel: file-cache, graph schemas, scope-flags, model-routing, consent, B1–B7, gates.
- Promotion rule: used by 2+ skills → moves here; no local copies.
- → "Now follow the data — starting with the graph."

### Slide 7 — Knowledge-graph pipeline (Diagram 3) · ⏱ 11:30–14:00
- source → `extract-edges.js` (deterministic) → `graph.json` → index + module projections → `graph.html`.
- Typed + confident edges; EXTRACTED from imports, not the model; `.stale` + `/graph-sync`.
- → "Let's see it."

### Slide 8 — 🎬 DEMO 1 · graph-viz · ⏱ 14:00–16:00
- **Steps:** run `/graph-viz` (or open `.claude/graph/graph.html`) → hover a node → dependents light up → point out the gold-ring hub and a red stale node.
- **Expected:** interactive map, reads `graph.json` only, works offline.
- **Fallback:** narrate the SVG mockup on the right.
- → "Findings flow through a similar pipeline."

### Slide 9 — Findings/ledger flow (Diagram 4) · ⏱ 16:00–18:00
- 3 scanners → FP-fingerprinted ledgers → `/checkin`, `/pr-create`, `/fix`, `/dismiss`.
- Fingerprints survive line moves; Rule 5 re-opens on change; baseline never gates.
- → "Here's the moment that makes governance real."

### Slide 10 — 🎬 DEMO 2 · checkin + B2 · ⏱ 18:00–20:00
- **Steps:** stage the A-Number log line → `/checkin` → Check D fails → show B2 escalation Low→Critical → `/fix FP-...`.
- **Expected:** commit blocked on a business-context Critical.
- **Fallback:** narrate the terminal mockup.
- → "Same ledgers, from the scanners."

### Slide 11 — 🎬 DEMO 3 · security & fix · ⏱ 20:00–22:00
- **Steps:** `/security-review --changed` (or `/dynamic-scan --url ...`) → findings land fingerprinted → `/fix FP-...` patches & marks Fixed.
- **Expected:** source-level remediation from the ledger.
- **Fallback:** the findings table on the right.
- → "Now memory."

### Slide 12 — Dream pipeline (Diagram 6) · ⏱ 22:00–24:00
- triggers → MEMORY.md → 6-phase `/dream` → promote/decay (cap 20) → dream-log (reversible).
- → "The dashboard."

### Slide 13 — 🎬 DEMO 4 · dream-health · ⏱ 24:00–26:00
- **Steps:** `/dream-health` → confidence ring, decay curve, promote candidates → click a justification panel.
- **Expected:** self-contained offline dashboard.
- **Fallback:** the card mockup.
- → "What does all this cost?"

### Slide 14 — Do the work once, then route (Diagram 7) · ⏱ 26:00–28:00
- **Orientation-first:** the big saving is understanding the codebase *once* — graph + arch docs + `/session-start` — so the model doesn't re-read source to orient every run.
- File-cache + scope flags are the *secondary, scanner-scoped* delta (ADR 0016) — not the headline.
- Then routing: Opus generation / Sonnet review+infra; override in settings.
- → "Let's watch it work on a real diff."

### Slide 15 — 🎬 DEMO 5 · code-review --pr · ⏱ 28:00–30:00
- **Steps:** `/code-review --pr` → Phase D then Phase P → show cache-hit % and seconds → findings in the ledger.
- **Expected:** seconds, not minutes; high cache hit.
- **Fallback:** the terminal mockup.
- → "Now the interesting part — why we chose all this."

---
## Act 3 — Decisions

### Slide 16 — Divider: Decisions · ⏱ 30:00–30:30
- Six stories: problem → decision → rejected → lesson.

### Slide 17 — ICEA gate (0001) · ⏱ 30:30–32:30
- Rework dominated; specs thin. No code until approved ICEA. Rejected prompt-for-spec/review-then-code/optional.
- Lesson: **a bad ICEA blocks your own PR** — incentive, not instruction.

### Slide 18 — Shared primitives (0003) · ⏱ 32:30–34:30
- Three copies of every bug; gate logic diverged. 2+ skills → shared; validator enforces.
- Lesson: define once, maintain once — new skills got cheap.

### Slide 19 — The graph (0038/39/41) · ⏱ 34:30–36:30
- Two overlapping maps, prose relationships, blind staleness, missing hook. → single layer, authoritative graph.json, deterministic edges.
- Lesson: one source of truth; correctness before richness; mechanical work in scripts.

### Slide 20 — Disk-based state (0031) · ⏱ 36:30–38:30
- State lived in chat; reopening broke APPROVE. → Status line is the truth, read from disk.
- Lesson: close/reopen freely; action a Teams approval with one phrase.

### Slide 21 — Enforcement ladder (0005/0009, Diagram 2) · ⏱ 38:30–40:30
- Prompts are probabilistic; local hooks bypassable. → 3 tiers, lowest that holds; server-side authoritative.
- Lesson: a local bypass becomes a CI failure — **telemetry, not a silent skip.**

### Slide 22 — Business severity (0015) · ⏱ 40:30–42:30
- CVSS doesn't know the business. → B1–B7 escalate one band across all review skills.
- Lesson: domain context is non-optional; severity without it is folklore.

---
## Act 4 — Workflow

### Slide 23 — Divider: Workflow · ⏱ 42:30–43:00
- What you'll actually type — and how it resumes across sessions.

### Slide 24 — ICEA state machine (Diagram 5) · ⏱ 43:00–45:00
- DRAFT → Approved → IN PROGRESS → COMPLETE, on disk. REVISE re-gates. Path is the record.

### Slide 25 — Keyword handlers · ⏱ 45:00–46:30
- SAVE PLAN → SAVE ICEA → SAVE TECH → APPROVE → IMPLEMENT. IDs case-insensitive. `STATUS` = re-entry.

### Slide 26 — Command palette · ⏱ 46:30–48:30
- 36 commands, six buckets — don't read them all; point and scan. Most auto-trigger by keyword.

### Slide 27 — 🎬 DEMO 6 · icea-feature · ⏱ 48:30–51:00
- **Steps:** `/icea-feature ADO-1847` → critic flags a gap → `APPROVE ADO-1847` → `IMPLEMENT ADO-1847` → write gate.
- **Expected:** no source until approved; the whole loop in 90 sec.
- **Fallback:** the terminal mockup.
- → "How did we get here?"

### Slide 28 — Evolution timeline · ⏱ 51:00–53:00
- Each release fixed a concrete pain (1.31 write gate → 3.6 deterministic edges). Pattern: real costs, not hypotheticals.

### Slide 29 — Daily loop · ⏱ 53:00–55:00
- Six commands: session-start → icea-feature/APPROVE/IMPLEMENT → checkin → pr-describe/pr-create → STATUS.

### Slide 30 — Setup & extensibility · ⏱ 55:00–57:00
- dream-init (one-time) · dream-status (20-item health) · dream-sync (upgrade). Stack-aware rules; 45 ADRs; forkable.

### Slide 31 — Close · ⏱ 57:00–60:00 + Q&A
- Three takeaways: thin skills/shared core · every decision traces to 3 lessons · six commands a day.
- Point to the architecture-heavy and decisions-heavy companion decks. Questions.

---

## Q&A prompt-bank
- *"What if I disagree with the critic?"* → It's ephemeral; regenerate or override — it surfaces after 2 retries.
- *"Can I skip the gate for a spike?"* → `/skip-icea` warns once; not recommended. Spikes are orientation (free) anyway.
- *"How fresh is the graph?"* → Git hook flags `.stale`; `/graph-sync` regenerates only changed modules.
- *"Cache correctness?"* → Character-count per file; `--full` forces a clean baseline; never commit the cache from CI.
- *"Does model routing cost me Opus everywhere?"* → No — only generation uses Opus; review/infra use Sonnet. Override in settings.
