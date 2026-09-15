# RESUME — Contest Submission Portfolio

> Drop-in context to resume this work in a fresh session. Read this file first, then
> `00-PLAN.md` and `00-TRACKER.md`. Everything lives in `contest/` (not plugin content).

## One-line status

Portfolio of **8 contest entries** scoped and seeded. Plan, tracker, measured-evidence (b),
and word-for-word demo scripts (c) are **DONE**. Next step: expand each seed into a polished
`contest/entries/NN-*.md` form document. **No `entries/*.md` created yet.**

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

- Repo scale (MEASURED): 49 skills · 47 shared specs · 44 rules · 25 hooks · 33 scripts ·
  23 test files · 300/0 validate.js · 64 ADRs · 65 commits.
- Cache efficiency (MEASURED, from 34 local session logs, ~30 days, 13,328 turns):
  **96.9% input-side tokens from cache; 97.6% of turns had a cache hit; 24.7M output tokens.**
  → This is Claude Code prompt caching over the plugin's own dev — NOT the plugin file-cache
  60–95% claim (that one stays ESTIMATED until the §3 benchmark is run).
- This is the plugin **source** repo: no deployed `.claude/` infra, no ADO PAT →
  `/sprint-metrics` and a live `/token-analysis` cache cannot run here.

## NEXT ACTION when resuming

Expand entries into `contest/entries/NN-*.md`, one polished form doc each, in priority order:
**1 → 4 → 2 → 3 → 5 → 6 → 7 → 8**. For each: fill all 9 fields, wire in a measured claim from
`measured-claims.md`, link the matching `demo-scripts.md` section, run the rubric self-check
(score 1–5 on all 6 criteria in the tracker), then mark READY.

Suggested resume prompt:
> "Resume the contest portfolio. Read contest/RESUME.md, then expand Entry 1 and Entry 4 into
> polished form docs under contest/entries/."

## Open decisions (from tracker)

- [ ] Keep `contest/` in the repo or move it out / gitignore before committing plugin changes.
- [ ] How many entries the contest allows per person (may need to pick the top 3–4).
- [ ] Optional: run the file-cache before/after benchmark (`measured-claims.md §3`) to make
      Entry 4's file-cache number measured.
- [ ] Record backup demo captures for entries presented live.

_Last updated: 2026-09-15._
