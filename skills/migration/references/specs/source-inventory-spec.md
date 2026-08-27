# Spec: SOURCE-BEHAVIORAL-INVENTORY.md

_Loaded by migration SKILL.md at Stage 0.6 (after Target Options / posture is set, before Stage 1
architecture). Defines the behavioral-discovery document that a HUMAN reviews and signs off BEFORE
the rewrite/migration proceeds._

---

## What this is — and is NOT

This document is a **behavioral inventory** reverse-engineered from the SOURCE application: what it
*does*, with provenance and a confidence level per item. It is **NOT** a stakeholder-validated
requirements specification. Source code encodes implementation (including bugs, dead code, and
accidental behavior); it does not encode intent, rationale, non-functional requirements, or
priorities. Unknowns are captured in two distinct places and never invented: **§10** for intent that
is *absent from the code* (NFRs / why / priorities), and the **Gaps Report (§11)** for code that was
*seen but could not be confidently resolved* statically.

**Primary purpose:** be the artifact a human reviews and dispositions before any target code is
written. For a **rewrite-from-spec** posture it is the design input (blocking gate). For
**re-architecture** it is the behavior-preservation contract (recommended). For a **mechanical
port** it is a light feature catalog that seeds golden-master + the migration report (optional).

**Depth is set by the Stage 0.5 posture:** port = Light · re-architecture = Medium · rewrite = Full.

---

## Confidence tiers (every item MUST carry one + provenance)

| Tier | Meaning | Promotion |
|---|---|---|
| **OBSERVED** | At authoring: has a passing source test. (A later golden-master reproduction is a stronger signal but is recorded in the Stage 5.0 report / §13 — it does NOT rewrite this signed doc.) | Highest — verifiable |
| **STATIC** | The *existence* of a structural element is mechanically evident: a route/endpoint is declared, a field carries a required/type annotation, a guard/decorator is present on a handler. STATIC asserts the element is THERE — and, when the element is *declarative*, its **framework-guaranteed** outcome (see the Tier cut-line) — never what *imperative* conditional logic decides. | Verifiable by inspection |
| **INFERRED** | Any behaviour that depends on reading IMPERATIVE conditional logic or specific values — what a validator rejects and with which message/threshold, which roles a *custom* (hand-rolled) guard admits, what a branch returns, not-found / error outcomes. If you had to read a branch to state the outcome, it is INFERRED. | **Never** auto-promoted to a requirement; confirmed only by human review (§ below) or a golden-master reproduction |

**Tier cut-line:** an element being *present* → STATIC; the element's *decision / outcome / values* →
INFERRED (or OBSERVED if a passing test covers it). **Exception — declarative, framework-guaranteed
outcomes are STATIC** (they follow mechanically from a declaration, no branch to read): `[Authorize]`
→ 401 for an unauthenticated caller; `[Authorize(Roles="Manager")]` → the framework rejects other
roles; a `[Required]` / non-null annotation → the field is mandatory. Resolve the exception by this
ladder: (1) **is the attribute defined in the SOURCE tree?** → it is custom code, read it → INFERRED;
(2) framework-provided → confirm its **version-specific** guaranteed outcome via the stack's
framework-attribute list in `stacks/{stack}.md`, or — if unlisted / version-sensitive / uncertain —
a WebSearch of the **official docs** for that framework+version, citing the doc URL alongside the
`PROV:` token; (3) still unresolved → INFERRED. Web grounding is an extraction-phase aid ONLY — the
offline verifier never depends on it. INFERRED also covers any imperative outcome: a hand-rolled
`if (!user.IsManager) return Forbid("…")`, what a validator branch returns and with which
message/threshold. So `[Authorize(Roles="Manager")]` rejecting other roles is STATIC; the same rule
as an `if` in the handler body, or via a custom `[ManagerOnly]` attribute defined in the repo, is
INFERRED. When unsure, the lower-confidence tier is the honest choice.

Provenance = `file:line` (or cluster) for every item, so each is falsifiable.

**Machine-readable provenance token (REQUIRED on every §5 / §6 / §11 item).** In addition to any
prose, each item MUST carry at least one `PROV:` token — the canonical, greppable form the Stage 0.6
trace verifier reads:

    PROV:<relpath>#L<start>[-L<end>]   — file provenance; <relpath> is POSIX, relative to the SOURCE root
    PROV:cluster:<cluster-name>        — coarse provenance when no single line applies (use sparingly)

Examples: `PROV:src/services/ApprovalService.cs#L88`, `PROV:src/orders/validate.ts#L40-L57`.
The token is what makes "falsifiable" mechanical: the verifier extracts every `PROV:` token, resolves
it against the SOURCE baseline SHA, and flags any that do not exist. Prose alone is not acceptable
provenance.

**Two verification moments (complementary, not redundant):**
- **Human review @ Stage 0.6** — dispositions INFERRED items and answers §10. This gate.
- **Golden-master @ Stage 5.0** — automated replay against the running source; verifies only
  *externally observable* behaviour. Internal business rules that produce no observable output are
  **human-verifiable only** — say so; do not imply golden-master will cover them.

Golden-master results are always **recorded in the Stage 5.0 report and appended to §13** — this
signed doc (§5/§11) is never rewritten after `APPROVE INVENTORY`. And if the source cannot run
(golden-master Step 1 fails), NO item is GM-promotable — the confidence ceiling is human-review-only;
state that in §12.

---

## Execution instructions for Stage 0.6

- **Baseline:** record the SOURCE commit SHA (`git -C {SOURCE_PATH} rev-parse HEAD`, or a timestamp
  if not a git repo) in the header — the review is against this snapshot; later source drift
  invalidates the sign-off.
- **Decompose by the source's bounded contexts / graph modules** to handle scale; extract per module,
  then synthesize. (Stage 3 later derives the *migration clusters* and maps each feature-ID to its
  cluster — that mapping is completed at Stage 3, not assumed here.) Run the shared context-budget check first.
- **Stable feature IDs.** Assign `F-NN` once and PRESERVE it across `MIGRATE INVENTORY` regenerates by
  matching on provenance/behaviour — new behaviours get the next unused number; retired ones are never
  reused. Downstream (architecture, feasibility, golden-master) references these IDs, so renumbering
  silently breaks the spine.
- **Triangulate across layers** — a feature usually spans UI + API + service + DB + job; stitch
  them into one feature row.
- **No silent caps.** If budget forces a subset, inventory the top-N clusters by importance and list
  every un-inventoried cluster in §3. Never imply completeness you do not have.
- **PII/secrets:** record field names and shapes only — mask values. The doc is shared for review.
- **Never fabricate §10.** If the "why", an NFR, a priority, or intended-vs-bug cannot be
  determined from code, that is the correct finding — list it as a stakeholder question.
- **Behaviour-bearing code only.** Look for entry points (routes/controllers, event handlers, queue
  consumers, scheduled jobs, webhooks), decision logic (validators, guards, permission/role checks,
  rule-encoding conditionals, state machines), and boundary behaviour (invalid input, missing auth,
  empty results, timeouts, retries). Use `stacks/{stack}.md` for where behaviour lives per stack.
  SKIP pure plumbing with no observable effect (DI wiring, getters/setters, styling, logging — unless
  a log is the only observable side effect of a branch).
- **Happy AND error/edge paths.** A feature documented only on its success path is incomplete — cover
  invalid input, missing auth, empty/not-found, and timeout/retry for each behaviour.
- **Express behaviours as Given/When/Then** (precondition / trigger / observable outcome). REQUIRED
  for INFERRED, high-risk, and gap-adjacent behaviours (they feed acceptance + golden-master 1:1);
  prose is acceptable for the OBSERVED/STATIC bulk to keep a large inventory reviewable.
- **Quote outcomes verbatim.** Exact status codes, exact error messages, exact validation thresholds
  — never paraphrase (`returns an error` is not a behaviour; `400 "Path is not mapped"` is). If an
  asserted value has a dynamic/PII sub-part, assert the stable shape and mark the variable slice
  (e.g. `404 "user {…} not found"`).
- **What, not how.** State what the app does, not its internal implementation; internal class/var
  names belong only in the `file:line` provenance, not in the behaviour statement.
- **Log unresolved code as a GAP (§11), never as a guessed behaviour** (see the gap-logging rules).
- **Emit a `PROV:` token on every §5 / §6 / §11 item** (grammar in *Machine-readable provenance
  token* above). The Stage 0.6 trace verifier resolves each token against the SOURCE baseline SHA and
  flags any that do not exist — prose-only provenance will not pass.

---

## Output Organization (single file vs index + per-cluster)

Group behaviours by **feature / bounded context** — here "cluster" means a source
bounded-context/module, NOT yet a Stage-3 migration cluster (Stage 3 maps feature-IDs to those
later) — mirroring how the app is organized, never by source file. The inventory should read like a
description of *what the app does*, not a table of contents for the code. Layout depends on scope:

- **Small / module scope** (Light depth, roughly ≤6 clusters, or a single feature area): **one file**
  — `docs/.../ADO-{ADO_ID}-source-inventory.md` with sections §1–§14 inline. Prefer this whenever the
  whole inventory is reviewable in one sitting (simplicity first).

- **Large / whole-app scope** (Medium/Full depth, many clusters): an **index + one file per cluster**,
  so a reviewer can take one cluster at a time (partial/incremental review), re-run (`MIGRATE
  INVENTORY`) diffs stay local, SMEs review in parallel, and downstream stages load only the cluster
  they need:
  - **Index** — `docs/.../ADO-{ADO_ID}-source-inventory.md`: everything cross-cutting — §1 Exec
    Summary, §3 Coverage, §4 Actor/Capability map, §7 Data, §8 Integrations, §9 Cross-cutting, §10
    Cannot-Be-Derived, a **consolidated §11 Gaps Report**, §12 Confidence, §13 Review Log, §14
    Traceability — plus a **cluster table** linking each cluster file with a one-line summary, its
    Review-Focus counts, and status.
  - **Per cluster** — `docs/.../ADO-{ADO_ID}-source-inventory-{cluster}.md`: that cluster's §5 Feature
    Catalog + §6 Business Rules (with G/W/T detail), its own gaps, and per-item Review status.

Either layout: feature IDs (`F-01…`) are **global** across files; the index's roll-ups (coverage,
confidence split, Review-Focus totals, verdict) aggregate the per-cluster files; and `APPROVE
INVENTORY` gates the **whole set** — a partial review may disposition cluster-by-cluster, but approval
requires every Review-Focus item across all clusters dispositioned.

---

## Document: ADO-{ADO_ID}-source-inventory.md

**Header:**
```
SOURCE BEHAVIORAL INVENTORY — ADO-{ADO_ID}
Behavioral discovery from source — NOT a stakeholder-validated requirements spec.
Source baseline: {SOURCE_PATH} @ {commit SHA | timestamp}
Posture (Stage 0.5): {mechanical port | re-architecture | rewrite-from-spec}   Depth: {Light|Medium|Full}
Status: ⏳ AWAITING REVIEW   (→ APPROVE INVENTORY ADO-{ADO_ID} once the Review Focus items are dispositioned)
```

### 1. Executive Summary (trust-first — a reviewer reads this before anything else)
- One-paragraph description of what the application does.
- **Coverage:** {N/M endpoints} · {N/M entities} · {clusters deep / light / skipped}.
- **Confidence split:** OBSERVED {n} · STATIC {n} · INFERRED {n}.
- **Human-only gaps (§10):** {count} — the things only stakeholders can answer.
- **Open code gaps (§11):** {count} — code seen but not confidently resolved.
- **Review readiness verdict:** {READY FOR REVIEW | PARTIAL — see §3 coverage | LOW-CONFIDENCE — treat as draft}.

### 2. Review Focus & How to Disposition (the gate mechanics)
The reviewer MUST disposition every item in these categories before `APPROVE INVENTORY`:
- every **INFERRED** business rule (§6),
- every feature rated **RED** migration-risk (once §Feasibility exists) or flagged high-impact,
- every item in **§10** (stakeholder questions),
- every open **GAP** in the Gaps Report (§11).

Mark each such item's **Review status** as one of: `Confirmed` · `Corrected: {note}` · `Rejected` ·
`Deferred: {reason}`. Items left `Pending` in the Review Focus set BLOCK approval. Everything else
(OBSERVED/STATIC) may be accepted in bulk.

### 3. Coverage & Method
Concrete accounting: endpoints/entities/clusters covered vs. total; deep vs. light vs. **skipped**
(name them); graph vs. directory-derivation; anything sampled. This section is what lets a reviewer
trust — or bound their trust in — the rest.

### 4. Actor & Capability Map
Primary user roles and the top-level capabilities each exercises.

### 5. Feature Catalog (grouped by cluster / capability — never one flat list)
(In whole-app scope, §5 + §6 live in the per-cluster files — see **Output Organization** above.)
Per cluster, a table:
```
| ID | Feature | Layers (UI·API·svc·DB·job) | Behaviour / rules | Confidence | Provenance | GM-verifiable? | Priority | Review status |
|F-01| ... | ... | ... | OBSERVED/STATIC/INFERRED | PROV:src/orders/OrderService.cs#L42 | yes/no | UNKNOWN (ask) | Pending |
```
`GM-verifiable?` = will golden-master (Stage 5.0) be able to check this (externally observable) or is
it human-verify-only. `Priority` is always `UNKNOWN (ask)` — code cannot tell you.

For INFERRED / high-risk / gap-adjacent behaviours, give the detail as **Given / When / Then** with
the outcome quoted **verbatim**:
```
Behaviour F-07: reject over-limit invoice approval
  Given an invoice total > 10000 and the caller lacks the "manager" role
  When POST /invoices/{id}/approve is called
  Then respond 403 "Approval limit exceeded" — no state change   (INFERRED · PROV:src/services/ApprovalService.cs#L88)
```
Prose is fine for the OBSERVED/STATIC bulk. Cover the error/edge paths, not just the happy path.

### 6. Business Rules & Calculations
Validation, pricing/tax/eligibility, and workflow/state-machine transitions — each with confidence
+ provenance. INFERRED, misread-prone rules flagged for mandatory review.

### 7. Data & Entities
Entities, key relationships, constraints; PII fields flagged (names/shapes only, values masked).

### 8. Integrations & External Contracts
External services, queues, third-party APIs, and their observable contracts.

### 9. Cross-cutting
Auth mechanism, authorization model (roles/policies), error contract, audit/logging, i18n.

### 10. ⚠ Cannot Be Derived From Code — confirm with stakeholders
Explicit questions, never guesses:
- Non-functional requirements (performance SLAs, scale, availability).
- The "why" / business rationale behind non-obvious rules.
- Priorities (which features are must-keep vs. droppable).
- Compliance/regulatory obligations.
- Deprecated-but-present features (needs usage data).
- **Intended behaviour vs. known bug** — for each surprising behaviour, ask which it is.

### 11. Gaps Report (always present — even if empty)
Code locations the extractor **saw but could not confidently resolve statically** — deliberately NOT
asserted as behaviours. Distinct from §10 (intent *absent* from code) and from INFERRED catalog
items (which ARE asserted, at low confidence). Each gap is code-anchored and part of the Review Focus.
```
GAP-001 | {PROV:<relpath>#L<nn>} | type: {ambiguous-intent | static-unresolvable (config/feature-flag) | conflicting-paths | unreachable-looking}
        | {what is unresolved} | resolve by: {ask a developer | run the source (golden-master) | check runtime config | usage data}
        | disposition: Pending
```
Log a gap whenever:
- intent cannot be confidently determined from code alone (a magic number/threshold with no basis; a
  branch whose reachability is unclear);
- behaviour depends on runtime configuration / feature flags that static reading cannot resolve;
- two code paths conflict on what should happen in the same situation — do NOT silently pick one.

Gaps tagged `run the source` are the priority worklist for the Stage 5.0 golden-master; a reproduced
gap is recorded **resolved in the Stage 5.0 report** (and noted in §13) — the approved §5/§11 are not
rewritten. Write `No gaps found.` only if genuinely true.

### 12. Confidence & Verification Summary
Counts by tier; list of INFERRED items still `Pending`; restate the two verification moments and
which items are human-verify-only.

### 13. Review Log / Sign-off
Records the human dispositions (who / when / item → status / correction notes). This is the
evidence that the gate was met. `APPROVE INVENTORY ADO-{ADO_ID}` stamps it. After Stage 5.0, an
**append-only "Stage 5.0 verification results"** block is added here (GM-verified / gap-resolved /
drifted feature-IDs) — the ONLY post-approval addition; §5 confidence and §11 stay exactly as signed.

### 14. Traceability Contract
The feature IDs (F-01…) are the spine: each flows forward to a Stage 1 architecture component, a
Stage 2 feasibility rating, an acceptance criterion / ADO task, and (where GM-verifiable) a
golden-master recording. State that downstream artifacts reference these IDs. The feature→**migration
cluster** link is established at **Stage 3** when the clusters are derived (not assumed here), so a
Stage-4 agent can trace the behaviours its cluster must preserve back to their feature-IDs.

---

## Stage 0.6 Gate
```
SOURCE BEHAVIORAL INVENTORY — ADO-{ADO_ID}
  Coverage: {N/M endpoints · N/M entities · clusters deep/light/skipped}
  Confidence: OBSERVED {n} · STATIC {n} · INFERRED {n}
  Review Focus (must disposition): {k} inferred rules · {k} high-risk features · {k} stakeholder questions · {k} open gaps
  Verdict: {READY FOR REVIEW | PARTIAL | LOW-CONFIDENCE}

Open ADO-{ADO_ID}-source-inventory.md, disposition the Review Focus items, then reply
APPROVE INVENTORY ADO-{ADO_ID}.  (rewrite-from-spec: this BLOCKS Stage 1 architecture.)
```
On approval: set `stage_gates.inventory_approved = true`. For **rewrite-from-spec**, Stage 1
architecture is designed FROM the approved inventory. For port/re-architecture the inventory informs
feasibility + seeds golden-master but does not block — a **mechanical port** may proceed to Stage 1
**without** `APPROVE INVENTORY` (the light catalog still seeds golden-master); only rewrite-from-spec
hard-blocks.
