# 0028 — Write Gate: explicit APPROVE before source code and config file writes

**Status:** Accepted
**Date:** 2026-06-15
**Amended:** 2026-06-15 (v1.31.1 — ICEA and Tech Spec scoped out of gate)
**Amended:** 2026-06-15 (v2.0.0 — *.epic.md and *.tracker.md added to ungated
table; APPROVE instruction updated to APPROVE ADO-{ID} form per ADR 0032)

## Context

Skills and commands were writing files to disk automatically as part of their
normal flow — ICEA documents after approval, memory entries on trigger, code
after the critic passed. There was no moment where the developer could review
the exact content and path before the write happened. Files were appearing in
unexpected locations (e.g. memory/ during ICEA flow) without the developer
being aware.

## Decision

ICEA, Tech Spec, Epic doc, and Tracker are collaboration artefacts — they
are written to disk immediately so they can be shared for review. Source
code and config files are gated behind `APPROVE ADO-{ID}`.

| Artefact | When written |
|---|---|
| `*.icea.md` | Immediately after draft — no gate |
| `*.techspec.md` | Immediately after draft — no gate |
| `*.epic.md` | Immediately after draft — no gate |
| `*.tracker.md` | Immediately after draft — no gate |
| `memory/` | Automatic on trigger — no gate (Dream pipeline) |
| Source code, config files | Blocked until `APPROVE ADO-{ID}` |

When a skill would normally write source code or config files it must instead:
1. Show the full intended content (or a clear summary if very large)
2. Show the target file path
3. Display a WRITE PENDING prompt and stop

`APPROVE ADO-{ID}` is required (per ADR 0032 keyword handlers). Partial
responses do not count. For multiple files, all paths are listed in a single
prompt.

**Exclusion:** `memory/` is explicitly out of scope. Auto-capture writes to
`memory/MEMORY.md` remain automatic so the Dream consolidation pipeline
is not disrupted. This boundary is stated explicitly in CLAUDE.md § 0 to
prevent the two rules from conflicting.

## Consequences

- Developers have full visibility and control over every file write
- No surprise files in unexpected locations
- Slightly more friction on the happy path (one extra APPROVE reply)
- Skills must generate all content in context first, then present a
  consolidated write-gate block rather than writing incrementally
