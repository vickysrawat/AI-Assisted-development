# Presentations — `ai-assisted-development` plugin

Self-contained HTML slide decks for internal sessions introducing the plugin — what it is, the
value it delivers, and the features it provides. Each deck is a **single file with no external
dependencies** — it opens offline in any modern browser (double-click, or `file://`), works on a
projector (16:9), and prints/exports to PDF.

Every deck has a matching **talking-points file** in [`talking-points/`](talking-points/) — a
slide-by-slide rehearsal script with time cues, delivery bullets, demo steps, and a Q&A
prompt-bank.

## The decks

### Story deck (start here)

| Deck | File | Audience | Runtime | Slides |
|---|---|---|---|---|
| **The Absence of Structure** | [story](ai-assisted-development-story.html) | All audiences — companion deep-dive | 65–75 min | 28 |

The story deck tells the evolution of the plugin through 48 architectural decisions — five acts,
each one a discovery made visible only after the previous layer was in place. Use it as a
standalone reference or extract individual acts into any of the audience decks below.
Each act section has a direct `id` (`#act1` through `#act5`) for deep-linking.

### Audience decks

| Deck | File | Audience | Runtime | Slides | Demos |
|---|---|---|---|---|---|
| **Leaders** | [leaders](ai-assisted-development-leaders.html) | Leads / management | 30 min | 15 | mockups only |
| **Personas** | [personas](ai-assisted-development-personas.html) | QA · Product · Devs · Tech Leads (mixed room) | 30 min | 17 | mockups only |
| **Dev · Balanced** | [developers-balanced](ai-assisted-development-developers-balanced.html) | Developers | 60 min | 31 | 6 🎬 |
| **Dev · Architecture** | [developers-architecture](ai-assisted-development-developers-architecture.html) | Developers (internals) | 60 min | 34 | 3 🎬 |
| **Dev · Decisions** | [developers-decisions](ai-assisted-development-developers-decisions.html) | Developers (engineering narrative) | 60 min | 29 | 4 🎬 |

**Which to use:**
- **Story** — the evolution narrative told through ADRs. Best as a companion reference after any audience deck, or as a standalone deep-dive for senior engineers who want the reasoning behind the plugin.
- **Leaders** — value, governance, cost, risk, metrics. No mechanics.
- **Personas** — a mixed room where each role (QA, Product, Developer, Tech Lead) sees their own lens onto one shared workflow.
- **Dev · Balanced** — the default 1-hour developer deep-dive: architecture + decisions + workflow, evenly.
- **Dev · Architecture** — same hour, weighted to internals and ordered by importance: the five subsystems (ICEA · graph · Dream · model routing · personas/consent) on a foundation of the component model and shared specs, plus enforcement wiring (7 diagrams).
- **Dev · Decisions** — same hour, weighted to the engineering story: 12 ADR "why we chose X" decision cards, the evolution timeline, and the themes that generalize. The most discussion-friendly.

The three developer decks are re-weightings of one shared body of material — run whichever fits
the room, or pick two across two sessions.

## Presenting

Open the file in a browser, then:

| Key | Action |
|---|---|
| `→` / `Space` / click-right | Next slide |
| `←` / click-left | Previous slide |
| `S` | Toggle **speaker notes** (per-slide talk track) |
| `O` | **Overview** grid — click any slide to jump |
| `F` | Fullscreen (presentation mode) |
| `Home` / `End` | First / last slide |

- Every slide carries on-screen speaker notes (`S`). For a fuller rehearsal script — time cues,
  delivery bullets, demo steps, transitions, Q&A — use the matching file in
  [`talking-points/`](talking-points/).
- Slides deep-link via `#slide-N` (e.g. `…-developers-balanced.html#slide-8`).
- **Backup:** `Ctrl+P` → Save as PDF produces a clean one-slide-per-page handout.

## Talking-points files (rehearsal scripts)

| Deck | Rehearsal script |
|---|---|
| Leaders | [talking-points/…-leaders.md](talking-points/ai-assisted-development-leaders.md) |
| Personas | [talking-points/…-personas.md](talking-points/ai-assisted-development-personas.md) |
| Dev · Balanced | [talking-points/…-developers-balanced.md](talking-points/ai-assisted-development-developers-balanced.md) |
| Dev · Architecture | [talking-points/…-developers-architecture.md](talking-points/ai-assisted-development-developers-architecture.md) |
| Dev · Decisions | [talking-points/…-developers-decisions.md](talking-points/ai-assisted-development-developers-decisions.md) |

Each file's slide numbers line up 1:1 with the deck; time cues sum to the stated runtime.

## Live demos (developer decks)

Demo slides are marked with a **🎬 DEMO** banner and a scripted walkthrough (steps + expected
result). To run them live you need a repo with the plugin provisioned (`/dream-init` already run);
for the B2 severity demo, stage a change that logs a client identifier. If the environment isn't
available, each demo slide pairs the script with an on-slide mockup — just narrate it. The
**Leaders** and **Personas** decks have no live demos by design.

## Design

Decks reuse the plugin's house style so they feel native to the toolchain: navy
(`#1a3a5c` → `#2c5f8a`) with a gold accent (`#c8a951`), RAG semantic colours, and the Segoe UI
stack — matching the `graph-viz`, `token-analysis`, and `product-docs` generated artifacts.
Architecture diagrams are inline HTML/SVG (no external libraries).

## Editing

Content lives directly in each `.html` file as `<section class="slide">` blocks; on-screen
speaker notes are the `data-notes` attribute on each slide. The shared design system (CSS +
~40-line slide engine) is inlined in each file. Presenter/date is on the title slide only. To keep
facts accurate, cross-check against `.claude-plugin/plugin.json` (version, component counts) and
`README.md` / `docs/adr/` (claims, ADR numbers) when updating.

> These decks are plugin documentation artifacts, not application features — not gated by the
> ICEA/APPROVE workflow.
