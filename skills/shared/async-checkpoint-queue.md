# Async Checkpoint Queue — Shared Spec
_Spec version: 0.9 (PROPOSAL — prototype on pr-create draft pattern first) · Last changed: 2026-06-11_

Evolves the plugin's human gates from **synchronous interrupts** to
**asynchronous checkpoints**, preserving the accountability thesis (every
approval is a named person taking responsibility) while supporting agent runs
that do more between human touchpoints.

The APPROVED moment is accountability transfer, not throughput control. That
need intensifies with agent autonomy — "an agent did it" is never an acceptable
answer in this environment. What changes is *when* the human engages: on their
schedule, against complete reviewable artifacts, instead of being pinged at
every transition.

**Template:** the pr-create draft artifact already works this way — do the work,
produce a complete reviewable artifact, let the human engage later. This spec
generalizes that pattern.

---

## The queue

`docs/checkpoint-queue/` holds pending approvals as files, one per checkpoint:

```
docs/checkpoint-queue/
  001-icea-ADO-1847.md          ← ICEA awaiting approval
  002-critic-escalation-1847.md ← critic gave up after 2 retries; accept/guide/halt
  003-dismiss-FP-a1b2c3d4.md    ← accepted-risk dismissal awaiting confirmation
```

Each entry carries: the full artifact (or a path to it), the decision required,
the options, the provisional state, and a `Queued:` timestamp.

## Provisional execution

In queued mode (`--async` on the originating command, or an agent-run session),
work proceeds on **provisionally-approved** artifacts under strict bounds:

- Provisional code is generated and critiqued but **never committed** — it lives
  in the working tree only, clearly labelled in the queue entry
- Provisional ICEAs carry `Status: Provisional` — the icea-floor hook (which
  requires `Approved` or `Tier: T1`) blocks any commit-path writes, so the
  mechanical floor already contains the blast radius
- A provisional dismissal does NOT suppress the finding in any gate until confirmed
- Nothing provisional ever reaches `checkin`, `pr-create`, or a ledger write

## Review session

`/checkpoint-review` presents the queue oldest-first:

```
━━ Checkpoint queue — 3 pending ━━━━━━━━━━━━━━
1. ICEA ADO-1847 (T2) — queued 2h ago
   {full ICEA inline}
   APPROVE / EDIT / REJECT          [provisional code: 4 files staged in tree]
2. Critic escalation ADO-1847 artifact 2 — queued 1h ago
   {concerns + final attempt inline}
   ACCEPT / GUIDE "<text>" / HALT
3. Dismissal FP-a1b2c3d4 accepted-risk (Critical) — queued 30m ago
   {finding + justification inline}
   CONFIRM / REJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

On APPROVE: the artifact's status flips, provisional work is confirmed (files
keep their staging, now commit-eligible), the queue entry moves to
`docs/checkpoint-queue/resolved/` with the decision, decider, and timestamp.
On REJECT/HALT: provisional work is unwound (working-tree changes for that
artifact reverted), entry resolved with the reason.

## Audit invariants

- Every queue resolution records: decision, named decider (git user), timestamp
- The resolved/ directory is the audit trail; entries are never deleted
- Unresolved entries older than 24h surface in dream-status as ⚠️ amber
- The critic remains always-on between checkpoints — it is the supervising
  reviewer in the gaps the human no longer fills synchronously

## Rollout

Phase 1 (prototype): pr-create draft path only — it already works async.
Phase 2: ICEA queue for T2 (T3 stays synchronous — elevated changes warrant the interrupt).
Phase 3: critic escalations and accepted-risk dismissals.
Each phase gated on the previous phase's gate-override and churn telemetry
staying green in the net-value scorecard.

## Hard rules

- NEVER commit, ledger-write, or PR-submit provisional work
- NEVER queue a T3 checkpoint — elevated changes interrupt synchronously by design
- ALWAYS unwind provisional work on rejection — no orphaned changes
- The icea-floor hook is the mechanical containment for this entire spec; it
  MUST be installed before async mode is enabled
