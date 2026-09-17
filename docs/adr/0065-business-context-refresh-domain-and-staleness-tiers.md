# ADR 0065 — REFRESH DOMAIN: on-demand business-context refresh with staleness tiers

Date: 2026-09-16 · Status: Accepted · Extends ADR 0057 and ADR 0064

## Context

Business-context severity policy (`.claude/business-context.md`) is generated once at
setup time from regulatory frameworks current at that date. Two forces cause it to go
stale over time:

1. **Regulatory change** — statutes are amended, new guidance is issued, enforcement
   decisions add interpretive weight. A policy grounded in 2025 regulations may miss
   obligations that came into force in 2026.
2. **Application scope change** — new features may introduce data types (e.g., adding
   healthcare identifiers to a previously generic app) that fall under B-series categories
   not present in the original policy.

`SET DOMAIN` already offered a refresh path (Step 0 offers `refresh` or `keep` when the
file exists), but two gaps remained:

- No direct, unambiguous command to refresh without navigating the `refresh or keep` dialog.
- No staleness signal — `setup-status` reported only presence/absence, not age.

## Decision

**`REFRESH DOMAIN` keyword handler** — added to both `CLAUDE.md` and `_project-deploy/CLAUDE.md`.
Invokes `business-context-generation.md` in refresh mode: skips the `refresh or keep` prompt,
re-grounds the B-series against current regulations, and shows a before/after diff (Step 4b)
before the APPROVED gate. Project-specific entries are always preserved in the merged output.
`SET DOMAIN` continues to offer `refresh or keep` when the file exists, so the behavior of the
existing command is unchanged.

**Step 4b (diff) in `business-context-generation.md`** — runs only in refresh mode. Produces
three sections before the APPROVED gate: triggers modified (field-level diff), triggers added,
and triggers removed. If nothing changed, states so explicitly: "APPROVED will update the
`retrievalDate` only." For verbatim-locked domains (e.g., legal), locked entries are shown in
"unchanged" and any grounding attempt to rewrite them is surfaced as a warning, never silently
applied.

**Staleness tiers in `setup-status` check 1v** — reads `retrievalDate` from the file's
comment block and computes age:

| Age | Status | Meaning |
|---|---|---|
| < 6 months | ✅ Green | Current |
| 6–12 months | ⚠️ Amber | Regulatory drift likely — `REFRESH DOMAIN` recommended |
| > 12 months | ❌ Red | Policy must be refreshed before the next review cycle |
| No metadata | ⚠️ Amber | Provenance unverifiable — `REFRESH DOMAIN` to re-establish |

## Consequences

- Developers have a single unambiguous command (`REFRESH DOMAIN`) for policy refresh with
  a clear diff to review before approving, matching the UX pattern of `REFRESH RULES` (ADR 0066).
- Regulatory drift is surfaced proactively in `setup-status` rather than discovered after a
  finding is under-scored.
- The APPROVED gate is preserved — the developer always owns the final write decision.
- The `retrievalDate` field was already present in generated files; the staleness check adds
  no new write obligations.
- Rollback: remove Step 4b from generation, remove 1v staleness tiers, remove `REFRESH DOMAIN`
  handler. `SET DOMAIN` refresh path is unaffected.

## Alternatives rejected

- Automatic scheduled refresh (cron) — business-context requires domain + jurisdiction
  confirmation and an APPROVED gate; fully automated refresh violates the human checkpoint
  principle from ADR 0057.
- Single staleness threshold (no tiers) — a binary fresh/stale signal loses the "action
  recommended but not required" nuance at 6–12 months vs the "must refresh" urgency at 12+.
