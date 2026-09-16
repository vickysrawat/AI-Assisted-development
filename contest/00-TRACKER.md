# Contest Submission Tracker

Status legend: ⬜ not started · 🟡 in progress · ✅ done

## Portfolio status

| # | Entry | 1.Draft | 2.Measured claim | 3.Demo script | 4.Rubric self-check | 5.Polish | Status |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | Governed AI Development | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Dream — Project Memory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Codebase Knowledge Graph | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | Token-Efficiency Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | The Architect | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6 | Legacy Migration Family | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7 | Production Readiness | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 | Support Handover | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 | The Persona Cast (bonus) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10 | The Critic (bonus) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 11 | Agents That Can't Collude (bonus) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 12 | Application Landscape (bonus) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 13 | Business Context (bonus) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 14 | Context Budget (bonus) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> Column meaning:
> - **Draft** — all 9 form fields filled (seed drafts exist in chat; not yet in `entries/*.md`).
> - **Measured claim** — ≥1 estimated claim replaced with a measured line from `measured-claims.md`.
> - **Demo script** — word-for-word script exists in `demo-scripts.md`.
> - **Rubric self-check** — scored 1–5 on all 6 criteria; nothing left ≤3.
> - **Polish** — trimmed to form limits, frozen.

## Rubric self-check scores (fill during step 4; 1–5 each)

| # | Entry | C1 value | C2 working AI | C3 resourceful | C4 creativity | C5 story | C6 responsible | Notes |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| 1 | Governed AI Development | 5 | 5 | 4 | 5 | 5 | 5 | READY — flagship |
| 2 | Dream | 4 | 5 | 4 | 5 | 5 | 5 | READY — creative hook: sleep/consolidation metaphor |
| 3 | Knowledge Graph | 4 | 5 | 5 | 4 | 4 | 5 | READY — artifact lens (vs Entry 4 efficiency lens); no hallucinated deps (ADR 0041) |
| 4 | Token-Efficiency | 5 | 4 | 5 | 4 | 5 | 5 | Reframed graph-first (file-cache demoted); demo reworked to graph-orientation beat → READY |
| 5 | Architect | 5 | 4 | 4 | 4 | 5 | 5 | READY — evidence-derived, never-fabricate; write-once read-many |
| 6 | Migration Family | 5 | 5 | 4 | 4 | 4 | 5 | READY — 3 skills on locality; honest scoping; resumable |
| 7 | Readiness | 5 | 4 | 4 | 4 | 4 | 5 | READY — two architects; anti-overclaim floor |
| 8 | Handover | 5 | 4 | 4 | 4 | 5 | 5 | READY — operate vs accept; TODO-not-false-pass |
| 9 | Persona Cast | 4 | 4 | 4 | 5 | 4 | 5 | READY (bonus) — 13-persona roster; "lens not roleplay" |
| 10 | Critic | 4 | 5 | 5 | 5 | 4 | 5 | READY (bonus) — AI argues with AI before disk; bounded self-correct |
| 11 | Can't Collude | 4 | 5 | 4 | 5 | 4 | 5 | READY (bonus) — airgap by capability; "privacy is physics" |
| 12 | App Landscape | 5 | 4 | 5 | 4 | 4 | 5 | READY (bonus) — cross-repo blast radius; lens vs Entry 3 |
| 13 | Business Context | 5 | 4 | 4 | 4 | 4 | 5 | READY (bonus) — CVSS-is-a-floor; lens vs Entry 11 |
| 14 | Context Budget | 4 | 4 | 5 | 4 | 4 | 5 | READY (bonus) — budget attention not capacity; lens vs Entry 4 |

## Open decisions / TODO

- [ ] Confirm final folder location (keep in repo under `contest/`, or move out before committing).
- [ ] Decide which 3–4 entries to actually submit if the contest caps entries per person.
- [ ] Run the file-cache before/after benchmark in a real target project to convert Entry 4's
      remaining estimated claim (procedure in `measured-claims.md` §3). Optional but high-value.
- [ ] Record backup demo captures for the 3 entries you'll present live.
- [ ] Expand each seed draft into `entries/NN-*.md` (create the `entries/` folder).
- [x] **Rework `demo-scripts.md` §Entry 4** — done. Shifted from the file-cache `--full`/`--changed`
      beat to a graph-orientation beat (orient from `graph.json` → edit → `/graph-sync` regenerates
      only the changed module → `/token-analysis`). Entry 04 is now graph-first; file-cache demoted
      to a narrow review/security mention.

## Change log

- 2026-09-15 — Portfolio scoped to 8 entries. Plan + tracker created. `(b)` measured-claims and
  `(c)` demo-scripts drafted. Seed drafts for all 8 entries exist (in chat); `entries/*.md` not
  yet materialized.
- 2026-09-15 — Expanded Entry 1 (Governed AI Dev) and Entry 4 (Token-Efficiency) into polished
  form docs under `contest/entries/`. Both: all 9 fields, measured claim wired in, demo linked,
  rubric self-check done (nothing ≤3) → marked READY. Next: Entry 2, then 3 (priority order).
- 2026-09-15 — Reframed Entry 4 graph-first (verified file-cache is review/security-only; the graph
  is the broad efficiency substrate). Demo §Entry 4 reworked to a graph-orientation beat. Added the
  Entry 03↔04 lens boundary (artifact vs efficiency engine).
- 2026-09-15 — Expanded Entry 2 (Dream) into a polished form doc + learning log; grounded in
  dream/SKILL.md + dream-reference.md (confidence contract, tiered approval, reversible/audited/
  cited, Category C). Marked READY. Added per-entry judge-defense study logs under
  `contest/learning-logs/` (01, 02, 04 done).
- 2026-09-15 — Expanded Entry 3 (Knowledge Graph) into a polished form doc + learning log; grounded
  in graph-json-schema.md + graph-sync/SKILL.md (authoritative JSON + projected markdown,
  EXTRACTED/INFERRED/AMBIGUOUS provenance, ADR 0041 offline extractor, fingerprint incremental sync,
  validate.py check 9). Held on the ARTIFACT lens (Entry 4 = efficiency lens). Marked READY.
  Study logs now 01, 02, 03, 04.
- 2026-09-15 — Expanded Entries 5–8 into polished form docs + learning logs, grounded in their skill
  specs: 5 Architect (architect/SKILL.md — composed templates, APPROVED gate, never-fabricate);
  6 Migration Family (migration-skill-family.md + rewrite/upgrade/replatform — locality split, honest
  scoping, resumable ledgers); 7 Readiness (app-readiness + plugin-readiness — 8+6 domains,
  anti-overclaim floor); 8 Handover (operations + go-live — operate vs accept, TODO-not-false-pass).
  All marked READY. **All 8 entries + all 8 learning logs now complete.**
- 2026-09-16 — Added 3 **bonus** entries (fun/personality lean) + learning logs, grounded in specs:
  09 Persona Cast (personas-spec.md — 13-persona roster, lens-not-roleplay, never-assume guardrail);
  10 The Critic (critic/SKILL.md — generator-critic, 3 modes, bounded 2-retry self-correction before
  disk); 11 Agents That Can't Collude (business-context-generation.md + bc-searcher/bc-synthesizer —
  disjoint-capability subagents, exfiltration impossible by wiring). **Portfolio now 11 entries, all
  READY.** Note: 09/10 tie into each other (personas power the critic's modes) and into the core
  governance story.
- 2026-09-16 — **Voice pass:** re-wrote all 11 `entries/*.md` in a warm, human register (narrative
  openers, second person, real stakes, prose over tables, honest self-check rubric) per developer
  feedback ("too mechanical, no soul"). All 9 form-field answers and every measured/estimated/
  not-yet-evaluated label preserved. **`learning-logs/*.md` intentionally left factual/crisp** —
  developer's call: warm the judge-facing entries, keep the defense notes mechanical. Entry 1 was the
  approved voice template.
- 2026-09-16 — **Honesty pass — platform dependency.** Verified (plugin.json + 47 SKILL.md + 25
  hooks + conversation_search / ~/.claude deps) that this is a **Claude Code plugin** and will NOT run
  as-is on Copilot/Cursor/other agents. Added a "**Runs on Claude Code**" honest-limitation line to
  field 8 of all 11 entries, plus a portfolio note in 00-PLAN (mandatory-disclosure), measured-claims
  §4 (labeled measured fact), and RESUME. Framing kept plain: ideas port as patterns, implementation
  doesn't. Developer flagged this; confirmed before applying.
- 2026-09-16 — Added 3 more **bonus** entries + crisp learning logs (developer-flagged gaps), grounded
  in specs: 12 Application Landscape (multi-root-scan.md — additionalDirectories, shared scan-root
  resolver, read-default/write-confirm, cross-repo blast radius via graph sourceRoot); 13 Business
  Context (business-context-severity.md + generation + presets — B-series, CVSS-is-a-floor override,
  applied by all review skills); 14 Context Budget (claude-md-budget-spec.md / ADR 0040 — adherence not
  capacity, ~200-line budget, system-wide no-auto-load/hard-stops/caps). Lens boundaries set: 12↔3
  (landscape vs one-repo graph), 13↔11 (policy vs airgapped grounding), 14↔4 (attention vs cost).
  Entries warm + Claude Code disclosure line included; logs kept crisp. **Portfolio now 14 entries, all
  READY.**
- 2026-09-16 — **Measurable-tightening pass** (developer: "do not assume or invent; tighten everything
  measurable"). Re-ran `node tests/validate.js` → **300/0 confirmed**. Fixed drift in `measured-claims.md`
  §1 + RESUME + log01: test files 23→**24**, scripts 33→**34**, commits 65→**66** (skills 49 / shared 47 /
  rules 44 / hooks 25 / ADRs 64 unchanged). Corrected Entry 14 demo + backup: `claude-md-audit.js` is
  **advisory-only** (silent when lean; fires when over budget), and the line-count-vs-budget **status** is
  shown by `dream-health` — not the audit script. Aligned Entry 6 log with the developer's tightened entry
  (Upgrade drives an *external* deterministic tool; clusters *scheduled into isolated worktrees*; RESUME =
  LLM re-orientation from last recorded gate, not mechanical replay; Replatform NFR oracle *deferred*).
- 2026-09-16 — **Foldering:** moved `contest/learning-logs/` → `contest/entries/learning-logs/` (per
  "keep all entry-related files inside the entries folder"). Fixed each log's relative links (entry `../NN`,
  shared assets `../../`). Shared assets (measured-claims, demo-scripts, PLAN/TRACKER/RESUME) kept at the
  contest root — they're portfolio-wide, referenced by all 14 entries.
