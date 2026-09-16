# RESUME — Contest Submission Portfolio

> Drop-in context to resume this work in a fresh session. Read this file first, then
> `00-PLAN.md` and `00-TRACKER.md`. Everything lives in `contest/` (not plugin content).

## One-line status

Portfolio of **14 contest entries** (8 core + 6 bonus) — **ALL 14 expanded and marked READY** in
`contest/entries/`, each with a judge-defense study log in `contest/entries/learning-logs/` (the logs
now live *inside* the entries folder) and a demo in `demo-scripts.md`. Plan, tracker, measured-evidence
(b), and demo scripts (c) are DONE. Every entry:
all 9 form fields, ≥1 labeled measured claim, demo linked, rubric self-check done (nothing ≤3).
Bonus entries: 09 Persona Cast · 10 Critic · 11 Agents That Can't Collude (creativity/personality/fun);
12 Application Landscape · 13 Business Context · 14 Context Budget (high-value capabilities the core missed).
**Lens boundaries to preserve:** 3↔4 (graph artifact vs efficiency), 12↔3 (cross-repo landscape vs
one-repo graph), 13↔11 (severity policy vs airgapped grounding), 14↔4 (attention/adherence vs token cost).
**Voice:** all 11 `entries/*.md` are written in a warm, human register (Entry 1 is the template) —
narrative openers, second person, real stakes, prose not tables — with all 9 fields and honest
labels preserved. `entries/learning-logs/*.md` are intentionally kept crisp/mechanical (defense notes).
Keep both conventions if editing. Logs link up two levels to shared assets (`../../measured-claims.md`,
`../../demo-scripts.md`) and one level to their entry (`../NN-*.md`).
**Platform disclosure (verified 2026-09-16):** this is a **Claude Code plugin** — it will NOT run
as-is on GitHub Copilot, Cursor, or any other agent (skills/hooks/slash-commands/Anthropic routing
are Claude-Code-native). Every entry's field 8 now carries a "**Runs on Claude Code**" honest
limitation; the portfolio note lives in `00-PLAN.md` + `measured-claims.md`. Keep this disclosure
if adding entries. The ideas port as patterns; the implementation doesn't.
Notes: Entry 3 = "graph as **artifact**", Entry 4 = "graph as **efficiency engine**" (keep distinct);
Entries 09 (personas) and 10 (critic) reinforce each other — personas power the critic's per-mode lenses.

## What this is

Preparing an **AI use-case competition** submission by turning the `ai-assisted-development`
Claude Code plugin (v3.25.0) into a **family of 8 independent entries**. Each must answer 9 form
fields and score on 6 judging criteria (both listed in `00-PLAN.md`).

## The 8 entries (seed drafts exist in the prior chat, not yet in files)

1. Governed AI Development (ICEA + Write Gate) — *Responsible AI* — FLAGSHIP
2. Dream — Project Memory — *Creativity + Practical value*
3. Codebase Knowledge Graph — *Resourcefulness*
4. Token-Efficiency Engine — *Resourcefulness* (has the strongest measured number)
5. The Architect — living architecture docs — *Practical value*
6. Legacy Migration Family (Upgrade/Rewrite/Replatform) — *Working solution*
7. Production Readiness (App + Plugin) — *Practical value*
8. Support Handover (Operations + Go-Live) — *Clear story / readiness*

## Files in this folder

- `00-PLAN.md` — entries, 9 fields, 6 criteria, expansion workflow, priority order, DoD.
- `00-TRACKER.md` — status grid + rubric self-check table + open decisions.
- `measured-claims.md` — (b) evidence bank; labeled measured/estimated/projected.
- `demo-scripts.md` — (c) word-for-word demo scripts for all 8 entries.
- `RESUME.md` — this file.

## Key facts already established (don't re-derive)

- Repo scale (MEASURED, re-verified 2026-09-16): 49 skills · 47 shared specs · 44 rules · 25 hooks ·
  34 scripts · 24 test files · 300/0 validate.js · 64 ADRs · 66 commits. (Counts drift as the repo
  grows — re-run the `measured-claims.md` §1 verify commands before final submission.)
- Cache efficiency (MEASURED, from 34 local session logs, ~30 days, 13,328 turns):
  **96.9% input-side tokens from cache; 97.6% of turns had a cache hit; 24.7M output tokens.**
  → This is Claude Code prompt caching over the plugin's own dev — NOT the plugin file-cache
  60–95% claim (that one stays ESTIMATED until the §3 benchmark is run).
- This is the plugin **source** repo: no deployed `.claude/` infra, no ADO PAT →
  `/sprint-metrics` and a live `/token-analysis` cache cannot run here.

## NEXT ACTION when resuming

All 8 entries and all 8 learning logs are complete. Remaining work is the portfolio-level polish in
the tracker's Open decisions:
1. Decide folder location — keep `contest/` in the repo or move it out / gitignore before committing.
2. Decide how many entries to actually submit (if the contest caps entries per person) — top picks:
   01 (flagship, Responsible AI), 04 (strongest measured number), 02 (creativity).
3. Optional: run the file-cache §3 benchmark to convert Entry 4's estimated figure to measured.
4. Record backup demo captures for the entries presented live.
5. Decide the orphan `TUTOR.md` (unrelated to the portfolio — move out or keep).

Suggested resume prompt:
> "Resume the contest portfolio. Read contest/RESUME.md. All 8 entries are READY — do a final
> cross-entry consistency + rubric pass, then help me pick which 3–4 to submit."

## Open decisions (from tracker)

- [ ] Keep `contest/` in the repo or move it out / gitignore before committing plugin changes.
- [ ] How many entries the contest allows per person (may need to pick the top 3–4).
- [ ] Optional: run the file-cache before/after benchmark (`measured-claims.md §3`) to make
      Entry 4's file-cache number measured.
- [ ] Record backup demo captures for entries presented live.

_Last updated: 2026-09-15._
