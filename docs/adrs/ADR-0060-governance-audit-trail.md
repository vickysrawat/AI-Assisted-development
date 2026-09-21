# ADR-0060: Governance audit trail via per-event committed JSON files

**Status:** Accepted · 2026-09-20
**Supersedes:** none · **Related:** ADR-0061 (RBAC), ADR-0065 (ICEA signals)

## Context

The plugin governs software development through a set of gates (ICEA approval, test gate,
RBAC checks, finding dismissals, config writes). For regulated-industry clients, it must be
possible to demonstrate who performed each governance action and when. Without an audit trail,
bypasses are invisible and governance is advisory only.

Requirements:
- Team-shared: all developers must see all events
- Append-only: no single event can be silently overwritten
- Merge-conflict-free: multiple developers writing simultaneously must not conflict
- Permanent: events must survive beyond sessions
- No central server: law firm context prohibits external telemetry

## Decision

Per-event JSON files in `.claude/audit/`:
- One file per governance event, named `{ms-timestamp}-{EVENT_TYPE}.json`
- Millisecond timestamp prefix guarantees uniqueness and chronological sort order
- Files are committed to git — git history is the immutability mechanism
- `.claude/audit/` is explicitly NOT gitignored

Event schema: `{ timestamp, actor, role, event, model, ado_id, finding_id, path, verdict, context }`

Audited event types: `APPROVE_ADO`, `APPROVE_CONFIG`, `APPROVE_ALL`, `DISMISS`,
`BYPASS_TEST_GATE`, `BYPASS_HOTFIX`, `RBAC_BLOCK`, `REVISE_ADO`.

## Rationale

**Per-event files over single JSONL append:** a single shared file causes merge conflicts when
two developers commit audit events simultaneously. Per-event files have independent paths —
git merges them cleanly regardless of commit order.

**Committed files over gitignored:** gitignored files are machine-local. Team-shared governance
requires files that any developer (or CI) can inspect after a git pull.

**Git history over cryptographic signing:** git history provides tamper-evidence sufficient for
the use case. Cryptographic signing adds key management complexity without proportionate benefit
for an internal developer tool.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Single `.claude/audit/audit.jsonl` (append-only) | Merge conflicts when two developers commit simultaneously |
| Write events to `MEMORY.md` | Mixed concerns; MEMORY.md is cleared by Dream; governance events must persist |
| External audit service / webhook | Prohibited by law firm context; adds network dependency |

## Consequences

- `.claude/audit/*.json` must remain uncommitted in gitignore discussions — it is intentionally committed
- CI can validate audit trail completeness via `validate-audit.py` hook
- `GOVERNANCE REPORT` reads this directory to produce sprint retrospectives
- `setup-status` check 1p monitors audit trail health
