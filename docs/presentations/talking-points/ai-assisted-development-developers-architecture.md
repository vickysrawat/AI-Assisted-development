# Talking Points — Developer Deep-Dive (Architecture-heavy)

**Deck:** `ai-assisted-development-developers-architecture.html` · **Audience:** Developers (internals focus)
**Runtime:** ~60 min · **Slides:** 34 (~1.8 min each) · **Demos:** 3 🎬

**Opening hook (before slide 1):** *"This is the version for people who want to know how the
sausage is made. We'll walk the system in order of importance — the five subsystems that carry
the plugin (ICEA, the graph, Dream, routing, personas) on top of two foundation layers — as boxes
and arrows you could redraw from memory."*

Demo prep: provisioned repo, a staged A-Number log line for the B2 demo. Go slower on diagrams;
invite people to challenge the data-flow arrows. Fallbacks are on every demo slide.

---
### Slide 1 — Title · ⏱ 0:00–1:30
- Frame: internals, ordered by importance. 7 diagrams, 3 demos.
### Slide 2 — Agenda · ⏱ 1:30–3:00
- Foundation first (components + shared specs), then the 5 subsystems: ICEA · graph · Dream · routing · personas.
- Call out: file-cache is deliberately *last* (findings section) — it only matters for the scanners.
### Slide 3 — Design principles · ⏱ 3:00–5:00
- Share & cache everything reusable; enforce mechanically in layers. The lens for everything.

---
## Foundation — component model

### Slide 4 — Divider · ⏱ 5:00–5:30
### Slide 5 — Layered stack (Diagram 1) · ⏱ 5:30–8:00
- Command → skill → shared → rules → hooks/artifacts. **Call direction is strictly downward.**
### Slide 6 — Repo layout · ⏱ 8:00–10:30
- Walk the tree: commands/skills mirror by name; `skills/shared` = SSOT; `rules` stack-scoped; `hooks`; `docs/adr`; generated `.claude/`.
### Slide 7 — Skill anatomy · ⏱ 10:30–12:30
- Every SKILL.md Step 0 declares **model tier + consent category (A/B/C)** — the forward-ref to routing & personas. Then read orientation, delegate, produce.

---
## Foundation — shared layer

### Slide 8 — Divider · ⏱ 12:30–13:00
### Slide 9 — The 20 shared specs · ⏱ 13:00–16:00
- Group them: governance · orientation · workflow · routing · efficiency (marked `*` — scanners only). Don't read every row.
### Slide 10 — Single source of truth (0003) · ⏱ 16:00–18:30
- Three copies of every bug → promote at 2+ consumers; validator enforces delegation.
- **Point at the footnote:** file-cache + scope-flags live here but only matter for code-review/security — we'll cover them in Findings.

---
## Subsystem 1 — ICEA lifecycle *(elevated — leads the subsystems)*

### Slide 11 — Divider · ⏱ 18:30–19:00
### Slide 12 — ICEA state machine (Diagram 5) · ⏱ 19:00–21:30
- Status line = workflow state on disk. DRAFT→Approved→IN PROGRESS→COMPLETE. REVISE re-arms the floor. **Approve on one machine, implement on another.**
### Slide 13 — Write-gate timing · ⏱ 21:30–23:30
- Source/config hard-gated (diff first) · docs draft-to-temp then SAVE · memory on trigger · orientation free.

---
## Subsystem 2 — Knowledge graph

### Slide 14 — Divider · ⏱ 23:30–24:00
### Slide 15 — Graph pipeline (Diagram 3) · ⏱ 24:00–26:00
- source → `extract-edges.js` (EXTRACTED) → `graph.json` → index (always) + module (lazy) → `graph.html`. Model owns only INFERRED/AMBIGUOUS.
### Slide 16 — Inside graph.json · ⏱ 26:00–28:00
- meta · typed nodes (+fingerprint) · typed edges (+confidence) · directoryCatalog. **Queryable, not prose.**
### Slide 17 — Staleness · ⏱ 28:00–30:00
- Module-wide SHA-1 (not entry-point-only — that was the bug); post-merge hook touches `.stale`; `/graph-sync` regenerates stale only.
### Slide 18 — 🎬 DEMO 1 · graph-viz · ⏱ 30:00–32:00
- **Steps:** `/graph-viz` → hover for dependents → hub (gold) / stale (red).
- **Expected:** reads `graph.json` only, offline. **Fallback:** SVG mockup.

---
## Subsystem 3 — Dream memory

### Slide 19 — Divider · ⏱ 32:00–32:30
### Slide 20 — Dream 6-phase (Diagram 6) · ⏱ 32:30–34:30
- analyze → score+dedupe → propose (tiered) → apply → cap/decay (≤20) → audit. Reversible via rollback.
### Slide 21 — Memory layout · ⏱ 34:30–36:30
- MEMORY.md (≤20 always-loaded) · topic-*.md (lazy) · dream-log.md (append-only) · health.html (gitignored). Warm-up: thousands → hundreds of tokens.
### Slide 22 — 🎬 DEMO 2 · dream-health · ⏱ 36:30–38:30
- **Steps:** `/dream-health` → confidence, decay, promote candidates → click justification.
- **Expected:** offline dashboard. **Fallback:** card mockup.

---
## Subsystems 4 & 5 — Model routing & personas *(elevated)*

### Slide 23 — Divider · ⏱ 38:30–39:00
### Slide 24 — Model routing (Diagram 7) · ⏱ 39:00–41:00
- ICEA_MODEL (Opus) · REVIEW/CRITIC_MODEL (Sonnet) · INFRA_MODEL (Sonnet). Env-var fallback chain; override in settings.json. Opus only for consequential generation.
### Slide 25 — Personas & consent · ⏱ 41:00–43:30
- **personas-spec:** each review skill adopts a named expert lens (SAST reviewer, release manager, QA lead) — sets *what to scrutinize*, never a license to assume.
- **source-file-consent:** A announce · B ask-per-file (file, why, cost) · C never. Every skill declares one.
- Land it: the right expert, reading only what you allowed, telling you why. "Opacity is poison" (0013).

---
## Findings & enforcement *(and where file-cache actually matters)*

### Slide 26 — Divider · ⏱ 43:30–44:00
### Slide 27 — Ledger flow (Diagram 4) · ⏱ 44:00–46:00
- 3 scanners → shared-schema ledgers → `get_open_critical_high()` in checkin/pr-create; fix/dismiss mutate.
- **Point at the footnote:** this is where file-cache earns its keep — checksum + skip unchanged = the 80–95% saving, scoped to these three commands (0016).
### Slide 28 — Ledger schema · ⏱ 46:00–48:00
- Summary + Open/Fixed(git)/Dismissed(reason+verify-flag)/Regressions/Baseline. FP = hash(file+loc+type+pattern).
### Slide 29 — Rule 5 reconciliation · ⏱ 48:00–50:00
- Re-scan finds dismissed FP → `git log` since dismissal? unchanged=keep · changed=re-open+verify-flag (reason preserved). **Dismissals can't hide regressions.**
### Slide 30 — 🎬 DEMO 3 · checkin + review · ⏱ 50:00–52:30
- **Steps:** `/code-review --pr` (cache-hit %, seconds) → `/checkin` → Check D blocks on a B2 Critical.
- **Expected:** the ledger the scanner wrote is the gate the commit reads. **Fallback:** terminal mockup.
### Slide 31 — Enforcement ladder (Diagram 2) · ⏱ 52:30–54:30
- A model instructions · B `icea-floor.sh` PreToolUse · C git pre-commit + CI `validate-*.py` (required, unbypassable). `--no-verify` → CI failure = telemetry.

---
### Slide 32 — Story · the graph (0038/39/41) · ⏱ 54:30–56:00
- Overlapping maps/prose/blind staleness/missing hook → single layer, authoritative json, deterministic edges.
### Slide 33 — Story · disk state (0031) · ⏱ 56:00–57:30
- State in chat broke reopening → Status line is the truth. State on disk = resumable; Teams approval actionable with one phrase.
### Slide 34 — Close · ⏱ 57:30–60:00 + Q&A
- Three lines: thin skills/shared core · five subsystems carry it · layered enforcement. Point to the decisions-heavy deck. Questions.

---

## Q&A prompt-bank
- *"Why is file-cache treated as minor?"* → It only affects code-review/security scan cost. Important for those runs, irrelevant to ICEA/graph/Dream/routing — hence it's a footnote, covered in Findings.
- *"What runs the deterministic edge extraction?"* → `scripts/graph-extract-edges.js`, after architect Step 7 and graph-sync — parses imports/usings/requires.
- *"What's a persona, concretely?"* → A named expert lens from `personas-spec` (e.g. a SAST reviewer) that tells a review skill what to scrutinize; it never licenses assuming results.
- *"Can hooks be bypassed?"* → Tier B/local yes (`--no-verify`), but Tier C server-side is required build validation — the bypass shows up as a CI failure.
- *"How do the three ledgers stay consistent?"* → One shared schema + `findings-gate.md` functions; `checkin`/`pr-create` query all three identically.
