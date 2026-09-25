# Shared spec: project-knowledge.md — per-project ICEA pattern library

## Purpose

`.claude/project-knowledge.md` accumulates what the plugin learns about a specific target
application across all ADOs and releases. Scoped exclusively to patterns that improve ICEA
writing and implementation quality. It is NOT:
- `memory/MEMORY.md` — developer decisions, errors resolved, architecture choices
- `ai-audit.md` — per-ADO governance (fragmented across `docs/`)

The team multiplier: Developer A's pattern from ADO-1234 improves Developer B's ICEA
six months later on ADO-5678 — no redundant discovery, no repeated revision cycles.

---

## Entry format

```
### [{N}] {short title}
Source ADO  : ADO-{ID} [, ADO-{ID}]
Added       : {YYYY-MM-DD}  Release {R}
Code anchor : {ClassName or InterfaceName}   ← optional; used for auto-validation
---
{Pattern — one to three sentences, concrete and actionable.}
```

Example:
```
### [3] ICEA Examples must specify dependency return contracts
Source ADO  : ADO-1234, ADO-1291
Added       : 2026-09-20  Release 3
Code anchor : IUserRepository
---
When an Example calls IUserRepository.GetById, the Context section must describe the return
shape (User object with Id, Email, IsActive). Without it the LLM cannot generate a real assertion
and ICEA implementation will hard-block with a gap annotation.
```

---

## Content model — what belongs

- Recurring dependency patterns — "service layer always needs `IUserRepository` and `IEmailService` — declare in ICEA Context"
- Team naming conventions discovered from code — "test classes follow `{ClassName}Tests` pattern"
- ICEA anti-patterns that caused revision cycles — "Examples must specify return object shape, not just method name"
- Stack-specific patterns unique to this codebase — "Repository pattern throughout — all unit tests need `IRepository<T>` mock"
- AC patterns — "Every endpoint AC must specify the HTTP status code for success and error cases"

## What does NOT belong

- General language/framework best practices (those belong in rule files)
- Information already in `architecture.md` (duplication creates drift)
- Transient information (sprint goals, one-time setup steps, status updates)

---

## Staleness — three-layer defence

### Layer 1 — Code anchor check (at Dream time)

If an entry carries a `Code anchor`, Dream verifies it exists in the codebase:

```bash
grep -r "{AnchorName}" src/ 2>/dev/null | head -1 || echo "ANCHOR_MISSING"
```

If `ANCHOR_MISSING` → flag entry as `⚠ ANCHOR MISSING` and propose REMOVE.

### Layer 2 — Age threshold

Entries older than 180 days (or 2 releases if release cadence is known) are flagged
`⚠ AGE THRESHOLD` and proposed for REVALIDATE review regardless of anchor status.

### Layer 3 — LLM framing

`icea-feature` reads this file with this instruction embedded:
> "Treat as patterns observed at a point in time. Verify each against the current
> codebase before applying. Flag conflicts rather than silently following a stale entry."

---

## Population paths

### Manual — KNOWLEDGE commands (immediate)

| Command | Action |
|---|---|
| `KNOWLEDGE ADD` | Prompt for title, source ADO, code anchor (optional), pattern text → write entry |
| `KNOWLEDGE UPDATE {N}` | Show current entry N → prompt for replacement text → write |
| `KNOWLEDGE REMOVE {N}` | Show entry N → confirm → remove |

### Via `LESSONS ADO-{ID}` (semi-automatic)

After generating lessons, Claude asks: "Does any lesson here belong in project-knowledge.md?"
On `yes`, shows the candidate entry and writes on confirmation.

### Auto-promotion from gap signals

When the same ICEA gap topic appears across 2+ ADOs, Dream Phase 3.6 proposes an ADD with
both source ADOs cited. This path is **fully implemented** as of v3.25.0.

Pipeline:
1. `icea-implement` writes a `gap` signal to `.claude/signals/` (via `scripts/signal-write.cjs`)
   whenever an Example cannot produce a real assertion.
2. Dream Phase 3.6 reads all signal files, tallies counts by topic in `memory/topic-signals.md`,
   and deletes the signal files (they are ephemeral; the tally persists).
3. When a topic's count reaches `gap_promotion_threshold` (default: 2), Dream proposes a
   project-knowledge ADD — shows the candidate entry and waits for the developer to reply
   `PROMOTE-{category}` (adds the entry) or `SKIP-{category}` (defers; count stays in tally).
4. On PROMOTE, the entry is written to `project-knowledge.md` and the topic section is removed
   from `memory/topic-signals.md` (count resets).

---

## Dream management

During a Dream run, project-knowledge entries are checked as a second pass (after the
MEMORY.md pass, before Phase 4). For each flagged entry, Dream proposes:

| Proposed action | Trigger |
|---|---|
| `REMOVE` | Code anchor missing OR age > threshold + content superseded |
| `REVALIDATE` | Age > threshold but anchor still present |
| `KEEP` | No staleness signal |

Developer responds inline: `KEEP-{N}` / `REMOVE-{N}` / `UPDATE-{N}`.
`UPDATE-{N}` opens a follow-up prompt for the corrected text.

All project-knowledge writes go through the standard Write Gate (no ADO required —
treated as plugin infrastructure, same as `ApprovalRoles.json`).
