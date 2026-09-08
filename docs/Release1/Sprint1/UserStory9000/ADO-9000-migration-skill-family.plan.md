# Feature Plan — Migration Skill Family (Upgrade · Rewrite · Replatform)

ADO #9000 · Release 1 · Sprint 1 · Type: EPIC · Status: Plan saved

> Source design: `docs/plans/migrationSkill/` (README + upgrade.md + rewrite.md + replatform.md)
> and dated architecture-decision entries in `memory/MEMORY.md` (2026-09-06 / 2026-09-07).

---

## Problem Statement
The plugin's single `migration` skill assumes ONE migration shape (source ≠ target · source read-only ·
new target folder · running-source oracle). That shape only fits out-of-place code translation, so it
silently mis-serves in-place version upgrades and cloud replatforms — producing either dangerous behavior
(rewriting working code) or false confidence (a green report that never measured what matters). Teams doing
the other migration types get no fit-for-purpose tooling, and the skill can't be deployed in isolation to
teams outside the full suite. **Success** = three fit-for-purpose, isolation-deployable skills
(Upgrade · Rewrite · Replatform) over a shared, drift-checked substrate, each making only the promises it
can keep.

## Story
As a developer or enterprise architect running an application migration, I want a skill matched to my actual
migration shape (version upgrade / rewrite / replatform), so that the tooling is safe, honest about
assurance, and doesn't force my migration through the wrong pipeline.

## Personas (end-users)
- **Dev/Tech-Lead "Sam"** — runs migrations hands-on · goal: correct, verifiable migration without
  corrupting working code · frustration: a one-size pipeline that rewrites things it should leave alone ·
  success: a decision-grade report + gated, reversible changes.
- **Enterprise Architect "Ava"** — owns the migration decision · goal: honest options with assurance
  ceilings, effort, and TCO up front · frustration: green reports that hide risk · success: picks an option
  knowing its BAL/ERL/NFR ceiling and cost.

## Feature Priority (MoSCoW)
**Must Have**
- **Upgrade skill** (walking-skeleton MVP): detect → classify (reject false-upgrades) → web-grounded
  gap/risk report → baseline tag + branch → tool orchestration (commit-per-hop) → gated residual → verify.
  - **Tool-availability preflight + install guidance** — probe whether the deterministic tool
    (dotnet upgrade-assistant / ng update / OpenRewrite / pyupgrade) is installed at a compatible version
    at intake; if missing, emit exact copy-pasteable install + verify steps (per tool/OS,
    script-transparency format), pause, re-check. **Never bundle** the tool.
- **Minimal inline substrate** for Upgrade (checkpoint envelope, gate grammar, feasibility, model routing,
  LLM-as-judge) — enough to run one skill; not yet extracted.
- **Standalone packaging — vendored-copy + drift-check** (CI-enforced) — delivered Story 3.
- **Retire the legacy `migration` skill** — delivered Story 3.

**Should Have**
- **Rewrite skill** + **EXTRACTED shared substrate** (rule of three, from Upgrade + Rewrite).
- Shared **checkpoint ledger** (envelope+core / payload split); **migration-knowledge cache**.

**Could Have**
- **Future-autonomy feature flag** (default OFF) behind the executor seam; **decision-precedent ADR library**.

**Won't Have (this Epic)**
- Autonomous execution of prod infra/data ON by default (flag ships OFF — safety: LLM authors, human executes).
- Migration-matrix expansions with no mapping ref (e.g. Python-as-source).

## Release Plan (walking-skeleton)
- **MVP (Story 1 — Upgrade):** tool-orchestrated in-place upgrade with a decision-grade gap/risk report,
  including tool-availability preflight + install guidance. | Deferred: substrate extraction, other skills.
- **V1 (Story 2 — Rewrite):** out-of-place generative rewrite (posture, per-cluster BAL, ERL, design-quality
  gates, options + BYO) + shared substrate **EXTRACTED** from the two consumers; establish the vendored-copy
  + drift-check **seam**. | Deferred: replatform, full packaging.
- **V2 (Story 3 — Replatform):** hosting-axis skill (NFR/Well-Architected oracle, cloud-capability
  decomposition, human-executed data/cutover/IaC, future-autonomy flag) + **standalone packaging**
  (vendored-copy + drift-check governance, CI-enforced) + **retire the legacy `migration` skill**.

## Assumptions
- [1] ~~Tools assumed present~~ → **REMOVED**: Upgrade actively CHECKS tool availability and GUIDES
  installation (now a feature, not an assumption).
- [2] Web search + a cache are available for grounding breaking-change facts & cloud pricing — verified.
- [3] Existing plugin skills are reusable as substrate: app-readiness (ERL/Well-Architected),
  code-review/security (target-native scan), critic (LLM-as-judge), feasibility engine, golden-master infra,
  checkpoint/single-writer, model-routing, personas — verified (present in graph).
- [4] Claude Code harness supports subagents + git worktrees — verified.
- [5] `migration-source-detect.cjs` (raven) is the detection substrate — verified (ADR 0060).

## Risks
- [1] Epic scope is enormous (3 skills + substrate) — Prob: H | Impact: H → walking-skeleton mitigates.
- [2] Speculative substrate abstraction if built top-down — Prob: M | Impact: M → extract-at-2nd-consumer.
- [3] Deterministic tool coverage uneven (Node/npm weak) — Prob: M | Impact: M → gap/risk report states it.
- [4] LLM-as-judge cost/latency at every gate — Prob: M | Impact: M → depth + judge model scale with risk.
- [5] Replatform data/cutover mis-design — Prob: L | Impact: H → LLM authors, human executes; tested
  rollback; reconciliation gate.
- [6] Retiring the legacy `migration` skill could strand in-progress migrations or break the `MIGRATE`
  keyword — Prob: M | Impact: M → retire only after new skills cover mapped cases; redirect `MIGRATE` to a
  router selecting Upgrade/Rewrite/Replatform; one-version deprecation notice.

## Pre-mortem — "This shipped and failed. What went wrong?"
The most likely fatal failure is a *confidence* failure, not a code failure: a skill emits a green report
that hides an unverified risk — an Upgrade that misroutes a false-upgrade (Framework→Core) and mutates a
working app, a Rewrite that reports success on a partial inventory with a non-runnable oracle, or a
Replatform that "passes" without ever measuring an NFR. The design counters each (honest classification +
false-upgrade guard, per-cluster BAL weakest-link with mechanical denominators, measurability-ceilinged NFR
assurance, LLM-authors-human-executes for infra/data). **The guardrail that must not be value-engineered
away: assurance honesty is gated, not advisory, for regulated/B-series paths.**

## Dependencies
- [1] Existing skills (app-readiness, code-review, security, critic, golden-master, feasibility,
  checkpoint/single-writer, model-routing, personas) — Owner: plugin | Blocking: no (reused as-is).
- [2] `migration-source-detect.cjs` (raven) — Owner: plugin | Blocking: no (implemented).
- [3] Claude Code subagent/worktree capabilities — Owner: harness | Blocking: no.
- [4] Deterministic upgrade tools in the target env — Owner: target team | Blocking: **no** (absence handled
  by the preflight + guidance feature; pauses gracefully rather than blocking).

## Open Questions
- None remaining. Resolved during planning:
  - Vendored-copy + drift-check → **in scope this Epic** (Story 3).
  - Tool bundling → **check + guide, do not bundle**.
  - Legacy migration skill → **retire** (not parallel-run); `MIGRATE` keyword redirects to the new skills.
