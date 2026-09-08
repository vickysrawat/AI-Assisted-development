# Migration Skill Redesign — Three-Skill Family

# Status - In design (Upgrade documented; Rewrite & Replatform pending)

> Run this in the **plugin repository** (ai-assisted-development). Paths are relative to the plugin root.
> Origin: redesign discussion — the single `migration` engine assumes ONE shape and mis-serves
> in-place upgrades and cloud replatforms. This folder splits it into three isolation-deployable skills.

---

## Context

Today's `migration` skill is a single 7-stage engine whose every hard rule assumes ONE shape:
*source ≠ target · source is read-only · target is a new empty folder · the oracle is the running
source.* That shape fits out-of-place **code translation**, but silently mis-serves the other things
called "migration":

- **In-place version upgrade** violates the cardinal rules — the source **is** the target folder, you
  edit working code, and there is no separate source to run as an oracle.
- **Cloud replatform** is a *different axis* — hosting/topology, not code translation — and its
  correctness is non-functional (latency, cost, failover) which a request/response golden-master
  oracle cannot capture. A green report there would be false confidence.

**Goal.** Split into **three skills carved on the real seams**, each **deployable in isolation**
(shippable · hard-bounded · self-bootstrapping), sharing a **versioned substrate** so they don't drift.

---

## The three skills

| Skill | Locality | LLM role | Oracle | Doc |
|---|---|---|---|---|
| **Upgrade** | in-place (same repo) | orchestrator of deterministic tools | pre-upgrade baseline commit | [upgrade.md](upgrade.md) |
| **Rewrite** | out-of-place (new target folder) | generative author | running source / inventory-as-intent | *pending* |
| **Replatform** | hosting axis (on-prem → cloud) | infra/IaC author + assessor | NFR / Well-Architected | *pending* |

---

## Decisions locked (from design discussion)

1. **Three skills:** Upgrade, Rewrite, Replatform.
2. **Carve on locality, not labels.** The seam that justifies a hard skill boundary is
   *in-place vs out-of-place* (bimodal), plus the *hosting axis* for Replatform — not the four
   marketing labels.
3. **"Lift-and-shift" is not a standalone skill.** It is overloaded and collapses: *code-port*
   lift-shift = **Rewrite** with posture `port`; *infra rehost* lift-shift = **Replatform** at low
   intensity.
4. **Upgrade = LLM orchestrator around deterministic tools**, not a generative author.
5. **Shared substrate becomes a versioned vendored core** (governance TBD) to prevent drift across
   standalone skills.
6. **Isolation driver = all of the above:** shippable standalone + hard module boundary + runs on a
   repo that never saw `setup-init`.

---

## Shared substrate (governance decided)

Members: detection · checkpoint schema + single-writer + merge-write · gate keyword grammar ·
Write Gate · personas · model-routing · goal-loop + rubric-score · **feasibility engine** ·
**migration-knowledge cache** · **LLM-as-judge layer**.

### Governance — vendored-copy + drift-check, two modes
Chosen over a shared dependency because the isolation driver (*runs on a repo that never saw setup-init* +
self-bootstrapping) vetoes runtime dependency resolution.
- **In-plugin (dev):** skills read the **single canonical** `skills/shared/` directly — no copies, zero drift.
- **Standalone (packaging):** a **build step vendors** canonical into the bundle, stamped
  `{substrate-version, content-hash}` in a manifest, each copy banner-marked **GENERATED — DO NOT EDIT**.
- **Drift-check** reuses the repo's `.hashes` pattern → a `tests/` check **fails the build in CI** on any
  `vendored ≠ canonical` or manifest mismatch. Substrate is **semver**'d; changes → bump → re-vendor →
  drift-check → ADR → re-validate consumers (governance is a *change process*, not just anti-drift).
- **Path resolution** prefers the vendored copy when standalone, canonical when in-plugin.

### Shared checkpoint schema — one ledger, envelope+core / payload split
One checkpoint **per project/ADO** = a *migration ledger* (records the whole `upgrade → hand-off → rewrite`
journey; single active writer).
- **Shared CORE** (substrate-governed, versioned, drift-checked, **additive-only**): `schema_version` ·
  `skill` discriminator · `ado_id`/timestamps · source descriptor · `stage_gates` (names differ per skill,
  shape common) · `decision_log` (ADR/precedent refs) · `judge_verdicts` · `phase_history` (the journey).
  **The core is the hand-off contract.**
- **Skill-owned PAYLOAD** (opaque to other skills, versioned by the skill, *not* in the shared contract):
  `upgrade{hops…}` · `rewrite{clusters,BAL,ERL,DAG,posture…}` · `replatform{resources,IaC,NFR…}`.
- **Skew-safe** (e.g. `upgrade@2.0` + `rewrite@2.1` sharing one ledger): additive-only core +
  **tolerant reader** (ignore unknown) + **merge-write** (preserve unowned).
- **Shared gate-name registry** so hand-off/judge tooling reasons generically.

### Migration-knowledge cache (two volatility classes)
- **Stable delta-KB** — breaking-change / deprecation facts keyed `{stack, from_version, to_version}`;
  *immutable once a version ships* → cache-once, reuse-forever. (Upgrade)
- **Volatile layer** — tool capability + **cloud run-cost pricing** keyed `{provider, service, SKU, region}`
  + retrieval date; short TTL, re-fetch when stale; every price cited + dated. (Rewrite run-cost, Replatform)
- One **web-grounding + verify + cache** engine; a claim/price is `VERIFIED` only when traced to an
  authoritative source, else `INFERRED`. Three consumers (Upgrade · Rewrite · Replatform).

### LLM-as-judge layer (session-wide, all three skills)
- **Independence at two levels:** separate **agent** (reads only artifact + rubric + ground-truth, not the
  generator's reasoning) **and** separate **model** (different failure modes, not just different context).
- **Adversarial by default** — refute, not confirm; default-skeptical when uncertain.
- **Per-gate verdict** (PASS / REVISE / BLOCK) against a rubric (`rubric-score-schema`) + a **session-level
  meta-judge** (cross-stage consistency + end-of-run completeness critic).
- **Depth *and* judge-capability scale with risk** (same friction-proportional-to-risk principle as the BAL gate).

### Model-routing (three-tier judge ladder)
| Gate risk | Creator | Judge |
|---|---|---|
| Low / routine | `ICEA_MODEL` (Opus 4.8) | `CRITIC_MODEL` (Sonnet) |
| High-risk / B-series | `ICEA_MODEL` (Opus 4.8) | **`CRITIC_MODEL_MAX`** = Opus 4.8 **@ max effort** (default) |
| Top-risk / B-series | — | + different-family **panel** {Opus 4.8@max + Sonnet}, agree-or-escalate |

- `CRITIC_MODEL_MAX` = **strongest available** model; auto-upgrades to **Opus 5** when it ships + is validated.
  **Never hardcode a phantom model ID** — max reasoning effort on Opus 4.8 is the available high-assurance
  lever today. Effort buys *thoroughness*; a different model buys *diverse blind spots* — they compose.

---

## Progress / resume point

- **Upgrade** — [upgrade.md](upgrade.md) — design complete.
- **Rewrite** — [rewrite.md](rewrite.md) — **fully designed (T1–T4).** Framing: greenfield-with-defined-intent,
  enterprise-grade. Two **shift-left** staged assurance axes, both captured at intake & gated at completion:
  **behavioral (BAL)** + **enterprise-readiness (ERL)** — ERL reuses the `app-readiness` 8 domains, designed-in
  (readiness backbone built in Tier 0), not audited at the end.
- **Shared substrate** — **governance decided** (vendored-copy + drift-check; one shared checkpoint ledger,
  envelope+core / payload split, skew-safe). Migration-knowledge cache has a **3rd content class —
  decision-precedent ADRs** (from Rewrite D1 governance).
- **Replatform** — [replatform.md](replatform.md) — **fully designed (R1–R5).** Hosting axis; NFR/Well-Architected
  primary oracle; cloud-capability decomposition; human-executed data/cutover/IaC.

**✅ Entire three-skill family design is COMPLETE.** Next phase: turn these design docs into ICEA(s) +
implementation.

### Family-wide invariant — "LLM authors, human executes"
Anything that touches **real infrastructure or data**, in **any** environment, is **authored (+ rehearsed)
by the LLM and executed by a human** (R4 data/cutover, R5 IaC apply). Delivered as human-executable
**runbooks** (per-step transparency + PASS/FAIL gate). A **future-autonomy feature flag (default OFF)**
sits behind an **executor seam** and, if ever enabled, **graduates by risk tier** (non-prod/low-risk first;
prod + regulated stay human) with cost caps, kill-switch, and audit.
