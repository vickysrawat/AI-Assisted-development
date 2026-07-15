---
description: Quarterly memory quality audit — flags uncited facts, surfaces contradicted promotions, and feeds rollback history into confidence scoring. Closes Dream's feedback loop.
argument-hint: "[--days <N>] (citation window, default 90)"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`). See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

---

# /dream-audit — Memory quality feedback loop

Dream consolidates session learnings into memory; this command measures whether
that memory is actually earning its place. Three signals, none requiring new
infrastructure — all derived from files Dream already writes:

| Signal | Source | Meaning |
|---|---|---|
| Citation rate | `last-cited` stamps in topic files | A fact never cited in N days is dead weight |
| Contradiction events | dream-log correction entries | A developer corrected something memory asserted |
| Rollback rate by category | `memory/dream-log.md` history | Categories rolled back often deserve lower promotion confidence |

---

## Step 1 — Parse arguments

`--days <N>` sets the citation window. Default 90.

## Step 2 — Citation analysis

For each `memory/topic-*.md` file, read the `Last-cited:` stamp from its header.
(Stamps are written by session-start when a topic file influences the session —
see the Citation Telemetry section in `commands/session-start.md`.)

```
For each topic file:
  - Last-cited within window  → ACTIVE
  - Last-cited outside window → STALE (candidate for archive)
  - No Last-cited stamp ever  → NEVER CITED (strongest archive candidate)
```

## Step 3 — Contradiction scan

Search `memory/dream-log.md` for entries tagged `[CORRECTION]` (written by Dream
when a session contains a developer explicitly correcting a remembered fact).
List each contradicted fact with its topic file and the session where it was
contradicted.

## Step 4 — Rollback-informed confidence

Group dream-log rollback entries by fact category (architecture / convention /
preference / decision). Compute rollback rate per category:

```
rollback_rate(category) = rollbacks(category) / promotions(category)
```

Report categories whose rate exceeds 10% — Dream's promotion step should apply
a confidence penalty to these (note for the developer to confirm; the penalty
is applied by Dream on its next run via the `audit-hints` block below).

## Step 5 — Report and propose

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Memory audit — {date} · window: {N} days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic files     : {total}  (active {A} · stale {S} · never cited {Z})
Contradictions  : {C} facts corrected by developers
Rollback rates  : {category}: {rate}% {⚠️ if >10%}

Proposed actions:
  archive  — move {S+Z} stale/uncited topic files to memory/archive/
  flag     — {C} contradicted facts listed for review (below)
  hint     — write audit-hints block lowering promotion confidence for: {categories}

Apply: all / archive / flag / hint / none
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Wait for the developer's choice. On `archive`, move files (never delete) and log
the move in dream-log. On `hint`, write/update `memory/audit-hints.md`:

```markdown
# Audit hints — read by Dream at promotion time
_Last audit: {date}_
- Lower promotion confidence by one band for category: {category} (rollback rate {rate}%)
```

Dream reads this file during consolidation and applies the penalty when scoring.

## Hard rules

- NEVER delete memory files — archive only, logged and reversible
- NEVER modify CLAUDE.md promoted facts directly — flag for review; /dream-rollback is the removal path
- ALWAYS log every audit action to dream-log (audits are themselves auditable)
- This command is read-only until the developer chooses an action
