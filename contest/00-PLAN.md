# Contest Submission Plan — AI Use-Case Portfolio

> Working folder for the AI use-case competition. **Not part of the plugin** — safe to move
> out of the repo or add `contest/` to `.gitignore` before committing plugin changes.
> Source plugin: `ai-assisted-development` v3.25.0.

## Goal

Turn the `ai-assisted-development` plugin into a **family of 8 independent contest entries**,
each expanded into a polished, submission-ready form document that answers all 9 form fields
and scores well against the 6 judging criteria.

## The 8 entries

| # | Entry | Lead category | Slug / final file |
|---|---|---|---|
| 1 | Governed AI Development (ICEA + Write Gate) | Responsible AI | `entries/01-governed-ai-dev.md` |
| 2 | Dream — Project Memory | Creativity + Practical value | `entries/02-dream-memory.md` |
| 3 | Codebase Knowledge Graph | Resourcefulness | `entries/03-knowledge-graph.md` |
| 4 | Token-Efficiency Engine | Resourcefulness | `entries/04-token-efficiency.md` |
| 5 | The Architect — living architecture docs | Practical value | `entries/05-architect.md` |
| 6 | Legacy Migration Family (Upgrade/Rewrite/Replatform) | Working solution | `entries/06-migration-family.md` |
| 7 | Production Readiness (App + Plugin) | Practical value | `entries/07-readiness.md` |
| 8 | Support Handover (Operations + Go-Live) | Clear story / readiness | `entries/08-handover.md` |

## The 9 form fields (every entry must answer all)

1. Concise title + one-sentence elevator pitch
2. Problem/opportunity + intended audience
3. What is working today
4. Role AI performs + tools/services used
5. Solution flow incl. human review/approval points
6. Value created + evidence (labeled: measured / observed / estimated / projected / not-yet-evaluated)
7. What makes it resourceful, memorable, creative, or fun
8. Responsible-AI safeguards, limitations, data-use disclosures
9. Short demonstration script or plan (+ backup)

## The 6 judging criteria (self-check each entry against these)

1. Practical value & relevance — clear problem, credible + labeled claims
2. Working solution & effective use of AI — real behavior; AI vs rules vs human clearly separated
3. Resourcefulness — more with less; reuse; no unnecessary architecture
4. Creativity, personality & fun — inventive, memorable, elegant
5. Clear story & demonstrated readiness — complete answers; concise demo with a backup
6. Responsible AI, privacy & ethics — approved tools, safe data, permissions, human oversight, stated limits

## Shared assets (build once, reuse across entries)

- `measured-claims.md` — the **(b)** deliverable: real measured numbers extracted from this
  repo + the exact reproducible benchmark for the still-estimated file-cache claim. Every entry
  pulls its "measured" line from here so no number is invented per-entry.
- `demo-scripts.md` — the **(c)** deliverable: word-for-word demo narration + exact commands +
  backup plan for all 8 entries.
- **Data-use disclosure boilerplate** (paste into field 8 of every entry):
  > *Operates on the local repo and Claude Code sessions; no source leaves the environment
  > except explicit ADO/Anthropic API calls the user initiates. Secrets are hook-blocked from
  > committed config; sensitive data is flagged via B1–B7 severity.*

## Per-entry expansion workflow

For each entry, in order:

1. **Draft** — fill all 9 fields from the seed material (chat + README + this plan).
2. **Insert measured claim** — replace at least one estimated claim with a measured line from
   `measured-claims.md`. Label everything.
3. **Attach demo script** — link/copy the matching section of `demo-scripts.md`.
4. **Rubric self-check** — score the entry 1–5 against each of the 6 criteria; fix anything ≤3.
5. **Polish + freeze** — tighten prose to form length limits; mark `READY` in the tracker.

## Recommended expansion order (priority)

1 → 4 → 2 → 3 → 5 → 6 → 7 → 8
(Flagship first; then the strongest measured story; then the crowd-pleasers; then the rest.)

## Definition of done (whole portfolio)

- All 8 `entries/*.md` complete, every field answered, every claim labeled.
- At least one **measured** claim per entry, sourced from `measured-claims.md`.
- Every entry has a demo script + a backup artifact identified.
- Tracker shows all 8 as `READY`.
