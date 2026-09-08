# Decision Note — Migration quality/security axis: **target-standard-aware**, not source-defect-recurrence

> **Status:** 📋 Decision (governing principle) — Not Implemented.
> **Scope:** Governs how the "code-quality / vulnerability" axis is added to the migration engine.
> Constrains the two open remediation plans so implementation doesn't build the infeasible design.
> **Author context:** AI-architect brainstorm, 2026-09-05.

---

## The three related plans

| Plan (ephemeral mirror) | Status | Axis |
|---|---|---|
| Migration-owned stack-neutral **source detection** (`prancy-nibbling-raven.md`; saved: [2026-09-05-migration-owned-source-detection.md](2026-09-05-migration-owned-source-detection.md)) | Approved, not impl. | *What* the source **is** (stack) |
| **parnas** — "one engine, two contracts, mode-gated remediation" (`soft-jumping-parnas.md`) | Design seed, not scheduled | Defect remediation as a separate future `RewriteAndMigrate`, mode-gated OFF in `migration` |
| **Source-Defect-Aware Migration** — quality ledger → remediation → verification (unsaved draft) | Ready for review | Defect remediation folded INTO `migration`, on by default |

These are two axes of "understand the source better," and **detection is the substrate for the
quality axis** (the quality ledger and the target scan both run `code-review`, which needs the
stack detected — for the **source** *and* the **target**).

---

## Conflict identified

parnas (#2) and Source-Defect-Aware (#3) are the **same quality loop** (Source Quality Ledger →
remediation mapping → Stage-6 recurrence check, reusing `code-review` as detector) with **opposite
architectures**:

- **parnas:** remediation must NOT live in `migration` — mixing defect-elimination into a faithful
  port breaks the hard rule *"NEVER migrate + refactor + change behaviour in one step."* → separate
  command, different oracle (approved inventory + sign-off, not golden-master), dormant in `migration`.
- **#3:** folds remediation into `migration`, on by default, as *"behavior-safe auto-eliminate,"*
  arguing behavior-preserving idiom translation isn't a prohibited refactor.

They cannot both be built as written.

---

## Governing principle (the decision)

### 1. Target quality/security is **target-standard-aware**, not source-defect-recurrence
For **cross-stack** migration (source stack ≠ target stack), "prove each source defect class was
eliminated in the target" is often **infeasible**. Defect/vuln classes split:

| Kind | Cross-stack | Recurrence gate meaningful? |
|---|---|---|
| **Stack-agnostic** (SQLi, missing authz, hardcoded secrets, God class, missing validation, tight coupling) | concept survives | **Yes** — commensurable |
| **Stack-specific** (.NET `.Result` sync-over-async, `IDisposable` leak, EF6 N+1, WCF quirks) | usually `N/A` or **transforms** into a different target defect | **No** — incommensurable |

Two failures of a source-defect-recurrence gate across stacks:
- The class may **cease to exist** in the target idiom (inline SQL → ORM target) — nothing to "resolve."
- It is **blind to the target's own native vuln surface** (GraphQL introspection, SSRF in a new HTTP
  client, over-permissive CORS) — giving false "all clear."

**Therefore:** hold the target to the **target stack's own** standards — run the stack-agnostic
`code-review` / `security` skills on the **generated target** (they auto-load target-stack checkers,
via the detection substrate). *That* is "resolve vulnerabilities in the target," done correctly:
stack-native, always feasible, catches target-native risks, reuses existing skills.

- **Source Quality Ledger** → demoted to a **context/decision artifact**: disposition per source
  defect = `fixed-by-target-design` / **`N/A — different stack`** / `carried-as-debt`. Not a gate.
- **Cross-stack recurrence gate** → keep **only for the commensurable subset**; stack-specific
  classes are `N/A`, no gate.

### 2. Reconcile #2 vs #3 by splitting the seam (two layers of one design)
- **Always-on in `migration` (verification layer):** the Source Quality Ledger + a **target-native
  scan** (run `code-review`/`security` on the generated target against its own bar). Non-mutating —
  no hard-rule tension. Note: most of #3 isn't "remediation" — it's **conformance** (the target is
  already built to its own standards, so source inline-SQL simply isn't carried).
- **Mode-gated to intent / `RewriteAndMigrate` (active-remediation layer, per parnas):** fixes that
  go beyond target-standard conformance and **can touch behavior** (sync-over-async→async,
  no-DI→DI-lifetime, God-class restructuring). Different oracle. #3's "behavior-safe" label is
  **overstated** for these — async/DI changes can alter timing/lifetime/behavior — so they belong
  here, not in a faithful port.

### 3. Detection is the shared substrate
The generalized detector (raven) must detect **both** the source (for the ledger) **and** the target
(to pick the target's checkers for the native scan). Build it first.

---

## Corrections this imposes on the Source-Defect-Aware plan (#3)
- **Replace/weaken Stage-6 "Check 5"**: (a) recurrence check only for the *commensurable* subset;
  (b) add a **target-native `code-review`/`security` scan** as the real target-side gate.
- **Reframe the ledger** as context/decision (with a first-class `N/A — different stack` disposition),
  not a cross-stack elimination gate.
- **Move behavior-touching auto-fixes** (async, DI-lifetime, restructuring) into the mode-gated
  intent path (parnas), out of default `migration`.
- **Rebase versions:** the plan assumes checkpoint schema `1.10 → 1.11`, but it is **already 1.11**
  (the implemented integration/asbuilt hardening plans took it there). Build on 1.11 and on the
  implemented `asbuilt-reconciliation-spec.md` (Check 5 extends the existing four checks).
- **Single owner** for `stage_gates.quality_remediation_verified` (both #2 and #3 add it).

## Sequencing
1. **raven** — stack-neutral detection substrate (source + target). *(approved)*
2. **This decision** — target-standard-aware; #2/#3 split into verification-now / active-remediation-later.
3. **Build the verification layer** on raven, rebased onto schema 1.11 + implemented asbuilt/integration specs.
4. **Active remediation** — deferred with `RewriteAndMigrate` (parnas), intent-contract, separate oracle.

## Relationship to the implemented hardening plans
The target-native scan is the **quality/security analogue** of the already-implemented
`migration-asbuilt-fidelity-hardening` (architecture reconciliation) and
`migration-integration-verification-hardening` (integration ground-truth) — same Stage-6 gate/ledger
pattern, a third reconciliation dimension. Reuse that machinery; do not invent parallel gates.
