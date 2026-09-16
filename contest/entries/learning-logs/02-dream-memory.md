# Learning Log — Entry 02: Dream (Project Memory)

> Judge-defense study log. One section per concept: plain explanation + judge-ready answers.
> Goal: present live and defend under questioning; answer any of the 9 form fields from memory.
> Companion docs: entry = `../02-dream-memory.md`; evidence = `../../measured-claims.md` §4;
> demo = `../../demo-scripts.md` §Entry 2. Source specs: `skills/dream/SKILL.md`,
> `skills/shared/dream-reference.md`.

**The spine:** Dream is not "AI that remembers"; it's **memory that stays TRUSTWORTHY as it
grows** (scored, tiered-approval, reversible, audited, cited). The lead categories are Creativity
+ Practical value; the creative hook is the sleep/consolidation metaphor.

**Concept map (7):** (1) the core problem, amnesia AND rot · (2) what Dream is (sessions are
truth; proposes, never writes) · (3) confidence scoring, memory with a half-life · (4) tiered
approval by blast radius · (5) reversible + audited + cited, the responsible-AI spine · (6) human
checkpoints / flow · (7) evidence + the creative "dream" metaphor.

Status: ✅ Concepts 1–7 locked (all covered).

---

## Concept 1 — The core problem (two problems, not one)

### Explanation

Shallow framing = "AI forgets between sessions." Real problem is both ends:
1. **Amnesia**: every session restarts from zero; decisions, fixes, lessons evaporate.
2. **Rot (harder half)**: the naive fix ("save everything") makes a swamp: stale facts,
   contradictions, unbounded growth, no way to know what to trust. A memory you can't trust is
   worse than none; it confidently misleads.

Dream must solve amnesia WITHOUT creating rot. That tension is the whole design.

### Judge-ready line

*"Remembering is easy; a text file remembers. The hard part is a memory that stays trustworthy
as it grows: forgets what's stale, flags what's contradicted, and never asserts something you
can't trace."*

### Summary (memorize)

*Two problems: amnesia (forgetting) and rot (untrustworthy accumulation). Dream solves the first
without causing the second.*

**Covers form fields:** #2.

---

## Concept 2 — What Dream *is* (proposes, never writes)

### Explanation

A reflective consolidation pass, run every 5–8 sessions (`/dream`):
- **Sessions are the source of truth**: reads actual Claude Code session history since the last
  run, extracting knowledge matching 5 triggers: plan approved · task completed · error resolved
  · approach abandoned · architecture decision.
- **Scores** each candidate, then **proposes** ADD / UPDATE / DELETE / PROMOTE / DEMOTE, each
  with a justification block (reason, evidence + URLs, before→after, confidence, risk-if-skipped,
  source).
- **Writes nothing that matters on its own**: AI proposes, human approves.

### Judge-ready line

*"Dream reads what actually happened, scores what's worth keeping, and proposes changes with
evidence. It's a librarian, not an author; it never silently edits your memory."*

### Summary (memorize)

*Consolidation pass over real sessions (the source of truth); extracts by 5 triggers, scores,
and proposes operations with justification. Proposes, never silently writes.*

**Covers form fields:** #3, #4.

---

## Concept 3 — Confidence scoring: memory with a half-life (kills rot)

### Explanation

Every entry has a **confidence score 0.0–1.0**; the contract makes memory self-cleaning:
- **Base:** session-sourced 0.65; auto-captured 0.70.
- **Reinforcement:** +0.15 per additional confirming session (cap 0.95).
- **Decay:** −0.1 per dream cycle unreferenced.
- **Thresholds:** PROMOTE ≥ 0.85; DELETE candidate ≤ 0.2.
- **Correction:** a developer contradicting a promoted fact → confidence drops ≤ 0.4 immediately
  + `[CORRECTION]` logged.

Elegant part: rot is handled by **physics, not vigilance**; unreferenced entries decay below
threshold and fall out; you don't prune manually.

### Judge-ready line

*"Every fact has a half-life. Confirm it and it strengthens; ignore it and it decays; contradict
it and it's demoted on the spot. The memory cleans itself."*

### Summary (memorize)

*Scores: base 0.65/0.70, +0.15 per confirming session (cap 0.95), −0.1 decay per unreferenced
cycle, PROMOTE ≥0.85 / DELETE ≤0.2, contradiction → ≤0.4. Self-cleaning by decay.*

**Covers form fields:** #3, #6.

---

## Concept 4 — Tiered approval by blast radius (control that scales)

### Explanation

Operations tiered by blast radius:
- **Tier 1, auto-apply:** KEEP, timestamp fixes, minor edits, a *new* topic file ≥0.70. No
  interruption.
- **Tier 2, show diff, wait:** major content update, append to existing topic, merge, borderline
  delete. (approve / skip / apply all / revise)
- **Tier 3, always human, one at a time:** PROMOTE, DEMOTE, permanent low-confidence DELETE,
  unresolved conflict.
- **Hard boundary:** CLAUDE.md writes (PROMOTE/DEMOTE) are ALWAYS Tier 3, regardless of score.
  Max 3 promotions/run; max 20 promoted entries total.

Same instinct as Entry 01 (*proportionate* friction) applied to memory.

### Judge-ready line

*"Trivial tidy-ups apply themselves; anything that touches durable, top-level memory always stops
for a human, one at a time. Friction scales with blast radius."*

### Summary (memorize)

*Three tiers: auto (low risk) / diff-and-wait / always-human. CLAUDE.md promotions are always
Tier 3. Max 3 promotions per run, 20 total.*

**Covers form fields:** #4, #5, #8.

---

## Concept 5 — Reversible + audited + cited (responsible-AI spine)

### Explanation

Three properties make Dream safe to trust:
1. **Reversible**: every run logged to an append-only `dream-log.md`; `/dream-rollback` undoes
   any run.
2. **Audited**: `/dream-audit` (quarterly) flags uncited facts + contradicted promotions and
   feeds penalties back into the scores via `audit-hints.md`. A **closed feedback loop**: the
   memory grades itself and adjusts.
3. **Cited**: PROMOTE requires evidence (session URLs). Every promoted fact is traceable; no
   assertion-from-nowhere in top-level memory.

Plus **Consent Category C**: reads session history + memory only, never application source.

### Judge-ready line

*"Reversible, audited, and cited. Every promotion carries a citation; every run can be rolled
back; a quarterly audit feeds its own findings back into the scores. And it never reads your
source, only the sessions."*

### Summary (memorize)

*Reversible (dream-rollback + append-only log), audited (dream-audit closed loop), cited
(promotion needs a source URL), Category C (never reads source). That's the trust spine.*

**Covers form fields:** #6, #8.

---

## Concept 6 — Human checkpoints / flow

### Explanation (with checkpoints)

1. `/dream` → reads sessions, builds scored candidate inventory. → **HUMAN sees inventory +
   scores.**
2. Proposes tiered operations. → **HUMAN CHECKPOINT: Tier 2 diffs approved/skipped; Tier 3
   (PROMOTE/DEMOTE) one at a time.**
3. Applies; writes append-only `dream-log.md` + last-run summary. → **`/dream-health` review;
   `/dream-rollback` if needed.**

Split: **AI** reads/scores/proposes; **scoring contract + tiers** (deterministic) decide auto vs
human; **human** approves anything with blast radius.

### Summary (memorize)

*Read+score → propose tiered ops → human approves Tier 2/3 → apply + log → health/rollback. AI
proposes, rules tier, human approves.*

**Covers form fields:** #5.

---

## Concept 7 — Evidence + the creative "dream" metaphor

### Explanation

- **Measured (design facts, §4):** reversible (`/dream-rollback`), audited (`/dream-audit` +
  trail), cited (promotion needs evidence), scored (confidence contract). Each is a checkable
  file/behavior.
- **NOT-YET-EVALUATED:** fewer repeated mistakes / faster onboarding; design goal, not measured.
  Don't claim a productivity number.
- **Creative hook (why it leads on Creativity):** modeled on human **memory consolidation during
  sleep**, hence "dream." Facts strengthen with use, decay with neglect, consolidate short-term
  (inbox) → long-term (promoted). The `health.html` decay curve makes it visual + memorable.
- **Resourceful:** derives memory from sessions that already exist; no new data collection.

### Judge-ready line

*"It's called Dream because it works like memory during sleep: consolidating the day's sessions,
strengthening what recurs, letting the rest fade. And every bit of it is reversible and cited."*

### Data-use disclosure (field 8 boilerplate)

*Operates on the local repo + Claude Code sessions; no source leaves the environment except
explicit ADO/Anthropic API calls the user initiates. Secrets are hook-blocked from committed
config; sensitive data is flagged via B1–B7 severity.*

### Summary (memorize)

*Evidence = reversible/audited/cited/scored (measured design facts). Productivity gains =
not-yet-evaluated. Creative hook = sleep-consolidation metaphor + decay curve.*

**Covers form fields:** #6, #7, #8.

---

## Quick map: concept → form field

| Form field | Concepts that answer it |
|---|---|
| #1 title / pitch | 1 (trustworthy memory) + 7 (dream metaphor) |
| #2 problem + audience | 1 |
| #3 what's working today | 2, 3 |
| #4 AI role + tools | 2, 4 |
| #5 solution flow + checkpoints | 4, 6 |
| #6 value + evidence | 3, 5, 7 |
| #7 resourceful / memorable | 7 (sleep metaphor, existing-sessions source) |
| #8 responsible AI / limits / data | 4, 5, 7 |
| #9 demo (+ backup) | 6 (flow = demo beats); `../../demo-scripts.md` §Entry 2 |

---

## The 3 lines that win Entry 02

1. **The problem (trust):** "Remembering is easy; a text file remembers. The hard part is a
   memory that stays trustworthy as it grows."
2. **Self-cleaning:** "Every fact has a half-life: confirm it and it strengthens, ignore it and
   it decays, contradict it and it's demoted on the spot."
3. **The metaphor + safety:** "It's called Dream because it works like memory during sleep, and
   every bit of it is reversible, audited, and cited."
