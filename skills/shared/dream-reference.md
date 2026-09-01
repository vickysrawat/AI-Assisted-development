# Shared spec: Dream memory — reference detail

The operative auto-capture triggers live in `CLAUDE.md` (# Dream). This spec holds the
consolidation guidance, thresholds, and the confidence-scoring contract moved out of the
`dream` skill so `dream`, `dream-health`, and `dream-audit` share one source of truth.
The memory read set + session-URL resolution live in `dream-memory-reading-spec.md`.

## Consolidation rules

- Run `/dream` every 5–8 sessions to consolidate memory.
- Run `/dream-health` to see confidence scores and the decay dashboard.
- Max entries promoted to `memory/MEMORY.md`: **20** — demote stale entries to topic files.
- `memory/topic-*.md` holds detail; `MEMORY.md` holds only promoted, high-confidence facts.
- `memory/health.html` is generated — do not commit it (it is in the managed ignore block).

## Auto-capture entry format

```
### [auto] YYYY-MM-DD — <topic>
<what to remember>
Trigger: <which trigger fired>  Confidence: 0.70  Source: auto-capture
```

These live under `memory/MEMORY.md`.

## Confidence scoring contract

The single source of truth for how `/dream` scores entries (dream applies it; dream-health
displays the results; dream-audit feeds penalties back into it).

**Score bands**

| Score | Meaning |
|-------|---------|
| 0.9 – 1.0 | Confirmed multiple times, no conflicts, still actively used |
| 0.7 – 0.8 | Confirmed, minor age or single source |
| 0.5 – 0.6 | Single session, unverified, possibly outdated |
| 0.3 – 0.4 | Contradicted by newer entry or stale |
| 0.0 – 0.2 | Likely wrong or superseded — candidate for deletion |

**Base scores**
- Session-sourced entry: **0.65** (real work context, not yet user-confirmed).
- Auto-capture entry (`Trigger:` tag from MEMORY.md): **0.70** (fired at a specific moment; high signal).

**Age-based survival bonus** — apply only when the entry has NO `Confidence:` field (never scored by a
prior run). Compute `days_since_capture` from the `### [YYYY-MM-DD]` header; missing/malformed date → +0.00.

| Entry age at this run | Bonus | Rationale |
|-----------------------|-------|-----------|
| < 14 days             | +0.00 | Too recent — no survival signal |
| 14–28 days            | +0.05 | Survived one sprint |
| 28–56 days            | +0.10 | Survived two sprints |
| > 56 days             | +0.15 | Survived 3+ sprints |

- Cap **baseline + age bonus at 0.85** before per-session reference bonuses.
- Entries that already carry `Confidence:` were scored before — start from that value, apply decay/bonus.
- Known limitation: pre-deployment entries with no `Confidence:` get the age bonus once on the first
  post-deployment run; the decay rule corrects any inflation the next cycle.

**Reference & decay**
- **+0.15 per additional session** an entry is confirmed in, up to **0.95** (before PROMOTE).
- **Decay −0.1 per dream cycle** in which an existing entry was not referenced. Entries seen this cycle do not decay.

**Thresholds:** PROMOTE ≥ **0.85** (and needed every session); watch/explain < **0.5**; DELETE candidate ≤ **0.2**.

**Audit-hints penalty:** if `memory/audit-hints.md` exists (from `/dream-audit`), apply the listed
penalty (one band = −0.1) to entries in any category flagged for elevated rollback rates.

See `skills/dream/SKILL.md` / `skills/dream-health/SKILL.md` for how the contract is applied and displayed.
