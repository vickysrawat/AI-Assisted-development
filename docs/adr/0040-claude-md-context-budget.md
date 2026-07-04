# 0040 — CLAUDE.md context budget: ≤ ~200 lines, set by adherence not window capacity
Status: Accepted · Date: 2026-07-03
Governs: `skills/shared/claude-md-budget-spec.md`, `scripts/claude-md-audit.js`, the CLAUDE.md size advisory

## Problem
CLAUDE.md is loaded whole every session and is always-on directive text. We needed a defensible
target length — and a clear answer to "why not shrink the injected footprint further (e.g. to
~71 lines)?" The intuitive framing ("fit the context window") is wrong and would justify almost
any length: a 150-line CLAUDE.md is ~2K tokens, ~1% of a 200K window (~0.2% of the 1M beta), and
even 500 lines is ~3%. Capacity is a non-constraint, so it cannot set the budget.

## Decision
Target **CLAUDE.md ≤ ~200 lines (~2.5–3K tokens)**, justified by **instruction adherence**, not
context-window capacity. The size advisory `scripts/claude-md-audit.js` uses `--budget 200` as
its default, deriving from this ADR; the canonical guidance/table lives in
`skills/shared/claude-md-budget-spec.md`.

- Always-active governance (WRITE GATE, Keyword Handlers, Shell/Git, Feature Gate) **stays in
  CLAUDE.md** — it is output-gated and must load every session; a `paths`-scoped rule would only
  fire at edit time, so it cannot host these (see ADR 0002, 0028).
- Reference/config/duplicated content is externalised to rules/specs/docs with a one-line pointer.
- The injector is **not** re-architected to chase a smaller injected footprint. §2 AZURE DEVOPS is
  a hard consumer dependency (`ado-tasks`, `sprint-metrics` grep `^- Organization:` from CLAUDE.md;
  `dream-init` Step 5d seeds it), so it must ship. Only ~22 lines (§1/§3/§4) are safely droppable —
  not worth governance-injection risk.

## Rationale
- **Capacity is a non-constraint** (~100× headroom); the real limiters are adherence (long directive
  text dilutes compliance and rules get missed past a few hundred lines) and the shared always-on
  preamble `session-start` loads (CLAUDE.md + MEMORY.md + architecture head + graph-index + rules).
- **Recurring cost is largely amortised** by prompt caching, so signal-to-noise matters more than
  raw tokens — argues for a small, high-signal file rather than a big-but-under-capacity one.
- **~200 is a round, safe adherence ceiling**: comfortably holds the mandatory governance + §2
  config + a lean project section, while staying in the high-adherence band.

## Consequences
- New shared spec `skills/shared/claude-md-budget-spec.md` (registered in `components.shared`).
- `scripts/claude-md-audit.js` cites this ADR for its `--budget 200`; `dream-init` (creation) and
  `dream-health` (size card) surface the advisory. `DEVELOPER-GUIDE.md` links here for the floor.
- The injected footprint floor (~126–148 lines, plugin CLAUDE.md ~153) is accepted as by-design,
  not a defect — v3.3.0 slimming already captured the worthwhile reduction.

## Revisit when
Claude's instruction-adherence characteristics change materially (e.g. a model that reliably follows
much longer standing instructions), or the always-on preamble is restructured so CLAUDE.md is no
longer sent whole every turn.
