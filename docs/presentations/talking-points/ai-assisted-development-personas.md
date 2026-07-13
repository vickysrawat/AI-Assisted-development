# Talking Points — One Plugin, Four Lenses (Personas)

**Deck:** `ai-assisted-development-personas.html` · **Audience:** QA · Product · Developers · Tech Leads
**Runtime:** ~30 min · **Slides:** 17 (~1.7 min each) · **Demos:** none (embedded mockups)

**Opening hook (before slide 1):** *"Everyone in this room uses the same plugin — but you're
each looking at it for a different reason. So instead of one generic tour, I'll show you your
lens: what you worry about, and exactly what answers it."*

Delivery notes: ~4–5 min per persona. If someone isn't that role, tell them to listen anyway —
it shows how their work connects. Press `S` for on-screen notes, `O` for the map.

---

### Slide 1 — Title · ⏱ 0:00–1:00
- Frame: one plugin, four lenses. 30 minutes, a section per role, then shared value + Q&A.
- → "Here are the four viewpoints."

### Slide 2 — Four lenses · ⏱ 1:00–2:30
- QA, Product, Developer, Tech Lead — each cares about different things.
- The through-line: one shared workflow → everyone reads the **same source of truth.**
- → "One minute on what it actually is, then we split by role."

### Slide 3 — What it is (60s) · ⏱ 2:30–4:00
- ICEA-driven workflow: no code until a spec is approved; shared graph; tracked findings; persistent memory.
- Everything each role cares about hangs off these four pillars.
- → "Lens one — QA."

---
## Lens 01 — QA / Test Engineer

### Slide 4 — QA divider · ⏱ 4:00–4:30
- Their core anxiety: *"does the code do what was specified, and can I prove it?"*
- → "Here's what QA worries about, and what answers each worry."

### Slide 5 — QA concerns → answers · ⏱ 4:30–7:00
- Walk the pairs: testable ACs (critic) · traceability matrix (`/pr-spec-review`) · regressions in the ledger (`/code-review`) · business-critical defects + one gate (`/checkin`, B1–B7).
- Land it: **QA stops guessing what to test and gets a map.**
- → "Here's the moment you'll recognize."

### Slide 6 — QA moment · ⏱ 7:00–9:00
- The traceability matrix: rows = ACs, columns = code, cells green/amber/red.
- **AC-4 is red** — nothing implements it; `/checkin` then blocks for that gap; rework shows in metrics.
- QA never had to read the whole diff to know what's missing.
- → "Lens two — Product."

---
## Lens 02 — Product Owner / PM

### Slide 7 — Product divider · ⏱ 9:00–9:30
- Anxiety: *"is the intent clear, planned, and are we getting better?"*
- → "Their worries and the answers."

### Slide 8 — Product concerns → answers · ⏱ 9:30–12:00
- Complete spec (ICEA + critic) · task breakdown with estimates (`/ado-tasks`) · disk-based status (`STATUS ADO-####`) · sprint KPIs (`/sprint-metrics`).
- Land it: **plan once, watch it flow to delivery.**
- → "The moment for Product."

### Slide 9 — Product moment · ⏱ 12:00–14:00
- One-line request → ICEA (intent, context, examples, 5 ACs) → `/ado-tasks` → 12 estimated tasks on the board.
- At sprint end: compliance up, rejection down, rework down — **payoff of clear specs, in numbers.**
- → "Lens three — Developer."

---
## Lens 03 — Developer

### Slide 10 — Developer divider · ⏱ 14:00–14:30
- Anxiety: day-to-day flow — start fast, clear loop, don't re-scan everything.
- Mention the full 1-hour dev deep-dive exists; here it's the essentials.
- → "Worries and answers."

### Slide 11 — Developer concerns → answers · ⏱ 14:30–17:00
- Orientation-first: context in one pass (`/session-start`) + knowledge graph & arch docs (context arrives ready) · gated request→merge loop · then cache + scope flags skip unchanged files (scanners).
- → "The moment."

### Slide 12 — Developer moment · ⏱ 17:00–19:00
- `/session-start` 3-sec brief; `IMPLEMENT` won't write source until you approve the diff; `/code-review --pr` scans only the diff.
- Feel: **guardrails without friction.** Point to the dev deep-dive deck for internals.
- → "Lens four — Tech Lead."

---
## Lens 04 — Tech Lead / Architect

### Slide 13 — Tech Lead divider · ⏱ 19:00–19:30
- Anxiety: governance & structure at scale — sound specs, enforced conventions, readiness, architecture.
- → "Worries and answers."

### Slide 14 — Tech Lead concerns → answers · ⏱ 19:30–22:00
- Named approval + critic · auto-loaded stack rules (violations are findings) · 8-domain `/app-readiness` · ADRs + live graph.
- Land it: **governance that holds without babysitting.**
- → "The moment."

### Slide 15 — Tech Lead moment · ⏱ 22:00–24:30
- `app-readiness` RAG scorecard: Security is Red on open SAST → not ready, and you know why.
- `graph-viz` in retro: hubs + stale modules flagged. Governance & architecture become **artifacts, not tribal knowledge.**
- → "Now bring the lenses back together."

---
### Slide 16 — One source of truth · ⏱ 24:30–27:30
- Why the four lenses agree: the ICEA, ledgers, and graph are the **same artifacts** for everyone.
- Product's intent → QA's ACs → the dev's target → the Lead's approval record. Nobody works from a different copy.
- **That alignment is the real product.**
- → "To close."

### Slide 17 — Close · ⏱ 27:30–30:00 + Q&A
- Whatever your role, you get a lens onto one shared workflow.
- Invite each role to try their entry point: QA `/pr-spec-review` · Product `/icea-feature` · Dev `/session-start` · Lead `/app-readiness`.
- Open the floor.

---

## Q&A prompt-bank
- *(QA)* "Does the matrix update automatically?" → Yes — `/pr-spec-review` regenerates from the diff vs the ICEA.
- *(Product)* "Are the estimates reliable?" → Generated per AC per layer; treat as a starting point the team refines.
- *(Dev)* "Isn't the gate annoying?" → Only source writes are gated; exploration/questions are free. Net faster via less rework.
- *(Tech Lead)* "Can I customize the rules?" → Yes — stack rules deploy per repo and are editable; violations surface as findings.
- *(Any)* "What if two roles disagree on scope?" → It surfaces in the ICEA before code — that's the point of approving intent first.
