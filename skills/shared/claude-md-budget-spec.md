# Shared spec: CLAUDE.md context budget

Canonical source for the CLAUDE.md length target used by the size advisory
(`scripts/claude-md-audit.js --budget 200`) and reported by `setup-init` / `dream-health`.
Decision record: ADR 0040.

## The budget is about adherence, not context-window capacity

CLAUDE.md length is **not** bounded by Claude's context window. A markdown line is
~10–14 tokens, so a 150-line CLAUDE.md is ~2K tokens — about **1% of a 200K window**
(~0.2% of the 1M beta). Even a bloated 500-line file (~6K tokens) is ~3% of 200K.
Capacity has ~100× more room than CLAUDE.md will ever need; it is a non-constraint.

What actually sets the optimum:

1. **Instruction adherence (the real limiter).** CLAUDE.md is always-on directive text —
   every line competes for the model's attention and compliance. Past a few hundred lines,
   adherence measurably degrades and rules start being missed. Keep it high-signal, not
   comprehensive.
2. **Recurring cost, mostly amortised.** It is re-sent every turn, but with prompt caching
   the marginal cost after the first turn is a cheap cache-read. Signal-to-noise matters
   more than raw tokens.
3. **It is not alone.** `session-start` loads CLAUDE.md **+** `memory/MEMORY.md` +
   `.claude/architecture/architecture.md` (head) + `.claude/graph/graph-index.md` + rules
   (on edit). Judge CLAUDE.md as part of that whole always-on preamble.

## Target

| Band | Lines | ~Tokens | Verdict |
|---|---|---|---|
| Ideal core | ≤ ~150 | ~2K | Best — high adherence |
| **Practical ceiling** | **~200–250** | **~2.5–3.5K** | Design to this |
| Smell threshold | > ~300–400 | > ~5K | Move detail to `.claude/rules/`, a doc, or a skill |
| Capacity limit | ~thousands | — | Irrelevant to quality |

**Target: ≤ ~200 lines (~2.5–3K tokens).** The `--budget 200` in the size advisory derives
from this row — it is an adherence/hygiene budget, **not** a context-window limit.

## What must stay in CLAUDE.md (cannot be "moved to save space")

Always-active governance is output-gated and must load every session, so it cannot move to
a `paths`-scoped rule (which only fires at edit time): the WRITE GATE, Keyword Handlers,
Shell/Git config, and the Feature Gate. Required config also stays — §2 AZURE DEVOPS is a
hard dependency (`ado-tasks` and `sprint-metrics` grep `^- Organization:` from CLAUDE.md).
This is why the plugin's injected footprint has a practical floor (~126–148 lines) and was
deliberately not driven lower — see ADR 0040.

## What can be externalised

Reference/config/duplicated content: design philosophy (enforced via `rules/project-rules.md`),
model routing (env defaults + `skills/shared/model-routing-spec.md`), verbose rationale
(`skills/shared/write-gate-spec.md`, `dream-reference.md`), and long project prose (a doc or a
skill). Leave a one-line pointer in CLAUDE.md.
