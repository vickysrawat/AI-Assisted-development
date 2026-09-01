# Dream Memory Reading — shared primitive

_Spec version: 1.0 · Created: 2026-08-31_
_Used by: `dream`, `dream-health`, `session-start`, `dream-audit`_

> **Related:** `dream-reference.md` owns the memory **model** (file hierarchy, consolidation cadence,
> confidence-scoring contract). This spec owns the **read procedure** — the exact file set to load and
> the session-id → URL resolution rules — so the four consumers don't each restate it. Severity
> language, where surfaced, follows `business-context-severity.md`.

## 1. Canonical memory read set

Read these, in this order, before doing any analysis. All are optional-if-absent (guard each read):

1. `CLAUDE.md` — promoted knowledge (the `# Dream` block + any promoted entries).
2. `memory/MEMORY.md` — manual-override inbox + auto-capture entries (`Trigger:` tagged).
3. `memory/topic-*.md` — consolidated topic knowledge (glob; may be zero files).
4. `memory/dream-log.md` — append-only audit trail.

**dream-log parsing rule (mandatory):** `dream-log.md` mixes two entry kinds — `## Dream run — <date>`
(H2) records and `### [capture] …` lines written by the memory-log PostToolUse hook. When finding the
**last dream-run date**, match only `## Dream run —` headers; never treat a `### [capture]` line as a run.

Consumers that only report (dream-health, dream-audit, session-start) MUST NOT modify any of these files.

## 2. Session-id → claude.ai URL resolution

Some entries cite a session id (`session-001`, `s-006`, `### [session-N]`). To turn ids into links:

1. Collect every unique session id across MEMORY.md headers, dream-log operation rows, and topic-file
   source references.
2. For each id, call `conversation_search` with 2–3 project-specific keywords from that entry (plus the
   entry date if available) to find the claude.ai conversation.
3. If multiple conversations match, pick the one whose `updated_at` is closest to the entry date.
4. If none match, mark the id `unresolved` — never invent a URL.
5. Cap at the **20 most recent** ids per run; mark older ones `archive — not searched`.

Produce a map `{ session-id → url | null }` for the caller to render links from.

## 3. Who reads what

| Skill | Uses §1 read set | Uses §2 URL resolution |
|---|---|---|
| `dream` | yes (+ `conversation_search` for the search window) | yes (for dream-log source links) |
| `dream-health` | yes (read-only) | yes (for the dashboard's clickable links) |
| `session-start` | yes (read-only, warm-up) | no (warm-up doesn't resolve URLs) |
| `dream-audit` | yes (read-only, audit) | no |

Callers cite this spec instead of restating the file list or the resolution rules.
