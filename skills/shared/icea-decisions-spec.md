# ICEA Decisions Block (ICEA-D) — Shared Spec
_Spec version: 1.0 · Last changed: 2026-06-11 · Governed by: skills/shared/_

Extends the ICEA with a **D — Decisions** section for complex work where the
model must choose between genuinely competing implementation approaches. The
ICEA captures what and why; the D block captures the load-bearing *how* — so
the tech lead who approves the spec approves the approach, not a blank cheque.

**Callers:** `icea-feature`, `critic`, `icea-review`, `checkin`, `dream`

---

## 1. When the D block exists — fork-triggered, never mandatory

The D block is generated per DECISION POINT, not per feature. During ICEA
drafting, identify genuine forks via mechanical signals plus judgment:

Mechanical fork signals (any one triggers evaluation):
- new external dependency would be introduced
- database schema change or new table vs extending existing
- a pattern not present in the architecture docs / knowledge graph would be introduced
- cross-layer placement question (logic could live in 2+ layers)
- synchronous vs asynchronous boundary decision

Tier rules:
- **T1**: never gets a D block (by definition no fork survives T1 bounds)
- **T2**: D block ONLY when a genuine fork is found; otherwise state plainly
  "No decision forks identified — single evident approach."
- **T3**: D block mandatory; if no fork is found, that itself must be justified

## 2. Anti-strawman mechanics — load-bearing, not optional

For every option:
- **Steelman required**: a "Choose this when…" line stating the conditions
  under which this option genuinely wins. If those conditions cannot be
  articulated, DELETE the option. Two real options beat three decorative ones;
  one real option means there was no fork — say so and skip the block.
- **Repo evidence required** for the recommendation: cite this codebase —
  existing patterns (with locations from the knowledge graph), prior decisions from
  memory, measured constraints. Best-practice generalities ("queues improve
  scalability") are filler and the critic flags them.

## 3. Block format

```
## D — Decisions

### D1 — {fork title, e.g. "Where does filter-query composition live?"}
**Option A — {name}**
  {2-3 lines: approach, trade-offs}
  Choose this when: {steelman}
**Option B — {name}**
  {2-3 lines}
  Choose this when: {steelman}
**Recommendation: Option A** — {repo evidence: "query composition already
  lives in dedicated services in 7 places (DealService, BillingService, …);
  memory: topic-architecture notes the team rejected repository-embedded
  queries in 2025-Q4"}
**Decision: ____ (awaiting selection)**
```

## 4. Selection-shaped approval

The approver's reply for each D item is **`OPTION A` | `OPTION B` | `EDIT` |
`DIRECT <approach>`** — never a bare yes. You cannot rubber-stamp a multiple
choice; selecting IS the act of judgment, recorded with the selector's name.
`DIRECT` records a developer/tech-lead-dictated approach with any risks noted —
no alternatives theater forced on a human who has already decided.

## 5. Role-based approvals block

The ICEA header gains an approvals block reflecting the org's real gate:

```
## Approvals
Product   : {name} — {date}   (approves Intent, Examples, Acceptance)
Tech Lead : {name} — {date}   (approves Context, Decisions — selects D options)
```

The literal-word discipline extends to named people: an approval line is
written only on an explicit reply from that person (relayed by the developer
is acceptable; the relay is recorded: "via {developer}"). Sections are owned:
Product owns the behavioral contract; the tech lead owns Context + D. Keep the
D block skimmable — half a page per fork — or approval latency becomes the
new bottleneck.

## 6. Deviation = amendment, never silent pivot

Once a D option is selected, the implementation is bound to it:
- the critic's code gate checks generated code against the CHOSEN option and
  returns REVISE on deviation
- if implementation genuinely discovers the chosen option doesn't work, the
  path is a recorded AMENDMENT: the D entry is updated with the new choice,
  the reason, the amender, and the date — and re-surfaces for tech-lead
  acknowledgment. An approval of approach A that silently ships approach B is
  false assurance, worse than never asking.
- `icea-review`/`checkin` flag option-drift the way they flag scope creep

## 7. Memory harvest

Selected decisions are first-class memory: Dream harvests "chose {A} over {B}
because {evidence}" into topic memory — the application-level decision history
mirroring what docs/adr/ does for the plugin itself.

## Hard rules

- NEVER generate a D block where no genuine fork exists — fake rigor is worse
  than no artifact
- NEVER include an option without a steelman
- NEVER recommend without repo evidence
- NEVER accept a bare "approved" for a D item — selection only
- NEVER deviate from a selected option without a recorded amendment
