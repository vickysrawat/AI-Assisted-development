# ICEA — Migration Skill Family (Upgrade · Rewrite · Replatform)
ADO #9000 · Release 1 · Sprint 1
Status: ✅ COMPLETE · EPIC · 76 SP (all 3 stories code-complete — 2026-09-09)

---

## Intent

### Goal
Replace the single one-shape `migration` skill with three fit-for-purpose, isolation-deployable skills —
**Upgrade** (in-place version upgrade), **Rewrite** (out-of-place code translation), and **Replatform**
(on-prem → cloud) — over a shared, drift-checked substrate, so each migration type gets safe, honest,
purpose-built tooling.

### Problem Statement
The current `migration` skill hard-codes one shape (source ≠ target · source read-only · new target folder ·
running-source oracle). That shape only fits out-of-place code translation, so in-place upgrades and cloud
replatforms are either handled dangerously (an LLM rewriting working code) or with false confidence (a green
report that never measured what matters). The skill also cannot be deployed standalone to teams outside the
full suite. Cost of not solving: unsafe migrations, undetected behavioral/NFR loss, and no adoption path for
isolated teams. Success is measurable: three skills each pass their own acceptance gates, the legacy skill is
retired with no orphaned `MIGRATE` invocations, and any skill can be vendored + drift-checked for standalone
use.

### Business Impact
Reduces the risk of corrupting working applications during migration and of shipping migrations whose
correctness was never actually verified; unlocks standalone distribution of migration tooling to teams that
do not run the full plugin. Value is primarily risk-reduction and reach, not revenue.

### Story
As a developer or enterprise architect running an application migration, I want a skill matched to my actual
migration shape, so that the tooling is safe, honest about its assurance level, and does not force my
migration through the wrong pipeline.

### Success Metrics
- Three skills (Upgrade, Rewrite, Replatform) each exist with passing acceptance gates and `tests/validate.js`
  green.
- Upgrade correctly classifies and **rejects false-upgrades** (e.g. .NET Framework→.NET, AngularJS→Angular)
  routing them to Rewrite — verified by fixture tests.
- Every skill's completion report surfaces an explicit **assurance grade** (BAL / ERL / NFR) with a
  mechanically-derived coverage denominator — no green report without a stated ceiling.
- Legacy `migration` skill retired; `MIGRATE` keyword redirects to a router with **zero** orphaned invocations.
- Any skill is buildable into a standalone bundle whose vendored substrate passes the CI drift-check.

---

## Context

### Personas
**Dev/Tech-Lead "Sam":** runs migrations hands-on · works in the target repo · goal: a correct, verifiable
migration without corrupting working code · frustration: a one-size pipeline that rewrites what it should
leave alone · success: a decision-grade report plus gated, reversible changes.

**Enterprise Architect "Ava":** owns the migration decision · reviews options before commit · goal: honest
options with assurance ceilings, effort, and TCO up front · frustration: green reports that hide risk ·
success: chooses an option knowing its BAL/ERL/NFR ceiling and cost.

### System Context
| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| Skill | `skills/upgrade/` | new | Story 1 — in-place, tool-orchestrated |
| Skill | `skills/rewrite/` | new | Story 2 — out-of-place generative |
| Skill | `skills/replatform/` | new | Story 3 — hosting axis, IaC output |
| Substrate | `skills/shared/` (checkpoint ledger, gate grammar, judge, cache, feasibility, model-routing) | extend | extracted at Story 2 (rule of three) |
| Skill | `skills/migration/` | retire | Story 3 — remove after coverage |
| Detection | `scripts/migration-source-detect.cjs` | reuse | raven (ADR 0060) |
| Commands | `commands/`, `.claude-plugin/plugin.json` | modify | register new skills; route/retire `MIGRATE` |
| Governance | `CLAUDE.md` §0a keyword handlers | modify | `MIGRATE` → router; new keywords per skill |
| Packaging | vendored-copy + drift-check (build + `tests/`) | new | Story 3, CI-enforced |
| Reuse | `app-readiness`, `code-review`, `security`, `critic`, golden-master infra | reuse | ERL, target-native scan, LLM-as-judge |

### Constraint Context
| Constraint | Type | Bounds the solution how? |
|---|---|---|
| LLM **authors, human executes** anything touching real infra/data, any env | business/safety | no autonomous prod apply/cutover; runbook + human-approval model |
| Plugin is markdown + CJS, no binary distribution | technical | deterministic upgrade tools are **checked + guided**, never bundled |
| Assurance honesty is **gated**, not advisory, for regulated/B-series paths | regulatory | hard-block completion below floor for B-series |
| Reuse existing skills as substrate | technical | no re-implementation of app-readiness/critic/feasibility/golden-master |
| Standalone deployability (no setup-init assumed) | technical | vendored-copy + drift-check; self-bootstrapping |

### Change Tier
**T3** — new skills + shared-substrate refactor + retirement of an existing skill + keyword/command/metadata
changes. Highest ceremony; multi-story epic.

---

## Examples

> Given/When/Then. Epic-level scenarios; per-story specs add detailed ACs.

### Happy Path
| Given | When | Then (observable outcome) |
|---|---|---|
| a .NET 6 app in place, `dotnet upgrade-assistant` installed | developer runs the Upgrade skill targeting .NET 8 | a decision-grade gap/risk report is produced; work runs on a branch off a baseline tag with one commit per hop; tests verified against baseline |
| a Node+Express app, chosen target .NET | developer runs the Rewrite skill | options (assurance × effort × TCO) presented; chosen posture drives per-cluster generation; completion report shows per-cluster BAL + ERL |
| an on-prem app targeting Azure | developer runs the Replatform skill | NFR spec captured; cloud-capability plan + IaC + human-executable cutover/reconciliation runbooks produced (LLM does not execute prod) |

### Edge Cases
| Given | When | Then (expected behaviour) |
|---|---|---|
| a .NET **Framework** 4.8 app, developer asks to "upgrade" to .NET 8 | Upgrade intake classifies | **false-upgrade rejected**; routed to Rewrite (cross-runtime boundary, no in-place path) |
| the required deterministic tool is **not installed** | Upgrade preflight probes | not a failure — exact install + verify steps emitted (per tool/OS); skill pauses; re-checks after install |
| source cannot run and no reachable URL (Rewrite) | assurance is computed | affected clusters capped at BAL C/D; ceiling shown in options **before** the developer commits |

### Error States
| Given | When | Then (user-visible message + system behaviour) |
|---|---|---|
| source stack has no mapping reference | any skill intake | HARD STOP with message listing supported sources; no fabrication |
| a B-series/regulated cluster is below its BAL/ERL floor at completion | completion gate runs | **blocked**: "Cannot complete — {cluster} below required assurance; named approver + reason required"; no silent pass |
| a data-reconciliation step fails (Replatform) | pre-cutover gate | cutover blocked; reconciliation runbook shows the failing PASS/FAIL step; human decides |

### Permission Boundary (mandatory)
| Given | When | Then (observable outcome) |
|---|---|---|
| any actor (incl. the LLM) attempts to create/apply real cloud resources or execute prod cutover | apply/cutover step reached | **denied** — the LLM only authors + rehearses; execution requires human action (default), or a future-autonomy flag that is OFF by default and, if enabled, still bars prod + regulated actions |
| source/config changes attempted without approval | write reached | Write Gate blocks until `APPROVE ADO-9000`; no code written to disk |

---

## Acceptance

### Acceptance Criteria
- [x] AC-F1: Upgrade classifies stack + version and **rejects false-upgrades**, routing them to Rewrite (fixture-tested across .NET/Angular/Java/Python/Node).
- [x] AC-F2: Upgrade **preflights tool availability** and, when missing, emits per-tool/OS install + verify steps, pauses, and re-checks; never bundles a tool.
- [x] AC-F3: Upgrade produces a decision-grade gap/risk report (web-grounded, source-verified, cached) and executes via baseline tag + branch + commit-per-hop, verifying against the baseline oracle.
- [x] AC-F4: Rewrite decomposes in target space, sets posture from stack distance, and presents options (assurance ceiling × effort × TCO) with a BYO-design escape hatch held to the same scrutiny.
- [x] AC-F5: Rewrite computes **per-cluster BAL** (weakest-link, mechanical denominators) and an **ERL** grade (reusing app-readiness); completion is gated (hard-block for B-series below floor).
- [x] AC-F6: Design-Quality (Simplicity/Readability/Maintainability/Testability) is gated at design + implementation, verified in generated code by the judge.
- [x] AC-F7: Replatform captures an NFR spec, decomposes by cloud capability (landing-zone Tier-0 first), and produces IaC + **human-executable** migration/reconciliation/cutover/rollback runbooks; the LLM never executes prod infra/data.
- [x] AC-F8: Replatform proves "done" via NFR assurance (measurability-ceilinged) + Well-Architected grade + behavioral regression (reused golden-master).
- [x] AC-F9: LLM-as-judge runs per-gate with a **separate model** (CRITIC_MODEL → CRITIC_MODEL_MAX for high-risk; panel for top-risk); routing configurable.
- [x] AC-F10: One shared **checkpoint ledger** (envelope+core / skill-owned payload) supports cross-skill hand-off; skew-safe (additive-only + tolerant-reader + merge-write).
- [x] AC-F11: Standalone build **vendors** the substrate with version+hash manifest; a CI drift-check fails on any vendored ≠ canonical.
- [x] AC-F12: Legacy `migration` skill retired; `MIGRATE` keyword resolves to a static Upgrade/Rewrite/Replatform signpost (human-chosen; no auto-routing classifier); deprecation notice shipped; no orphaned invocations.
- [x] AC-NF1: `tests/validate.js` stays green (0 failures) after each story merges — verification: CI run.
- [x] AC-NF2: All source/config writes pass the Write Gate (`APPROVE ADO-9000`) — verification: no un-gated writes in the diff.

### Out of Scope
- We will NOT enable autonomous execution of prod infrastructure/data by default — because safety requires human execution; a future-autonomy flag ships OFF.
- We will NOT support source stacks with no mapping reference (e.g. Python-as-source) — because fabricating a mapping produces unsafe migrations.
- We will NOT bundle deterministic upgrade tool binaries in the plugin — because the plugin is markdown+CJS, versions drift, and licensing/size are prohibitive; we check + guide instead.
- We will NOT parallel-run the legacy `migration` skill — because it is being retired; it is replaced, not kept alongside.

### Assumptions
- Web search + a cache are available for grounding breaking-change facts & cloud pricing — **verified** (design premise this session).
- Existing skills (app-readiness, code-review, security, critic, feasibility, golden-master, checkpoint/single-writer, model-routing, personas) are reusable as substrate — **verified** (present in the graph).
- Claude Code harness supports subagents + git worktrees — **verified**.
- `migration-source-detect.cjs` (raven) is the detection substrate — **verified** (ADR 0060).
- Deterministic upgrade tools are installable in target environments — **unverified** (handled by preflight + guidance, not assumed present).

### Open Questions
| # | Question (product / stakeholder) | Owner | Status |
|---|---|---|---|
| — | None. | — | — |

### Risks & Pre-Mortem
| Risk | Probability | Impact |
|---|---|---|
| Epic scope is enormous (3 skills + substrate) | H | H |
| Speculative substrate abstraction if built top-down | M | M |
| Deterministic tool coverage uneven (Node/npm weak) | M | M |
| LLM-as-judge cost/latency at every gate | M | M |
| Replatform data/cutover mis-design | L | H |
| Retiring legacy `migration` strands in-progress migrations / breaks `MIGRATE` | M | M |

**Pre-mortem:** "This shipped and failed. What went wrong?" The most likely fatal failure is a *confidence*
failure, not a code failure — a skill emits a green report that hides an unverified risk (Upgrade mutating a
working app after misrouting a false-upgrade; Rewrite reporting success on a partial inventory with a
non-runnable oracle; Replatform "passing" without measuring an NFR). The design counters each (honest
classification + false-upgrade guard; per-cluster BAL weakest-link with mechanical denominators;
measurability-ceilinged NFR assurance; LLM-authors-human-executes). The guardrail that must not be
value-engineered away: **assurance honesty is gated, not advisory, for regulated/B-series paths.**

### Dependencies
- Blocked by: none (existing skills + raven already present).
- Blocks: Story 2 (Rewrite) depends on Story 1 (Upgrade) existing to extract the substrate; Story 3
  (Replatform) depends on the extracted substrate and may overlay Rewrite.

### Irreversibility Flags
- **Retiring the legacy `migration` skill** — mitigated by retiring only after new skills cover mapped cases,
  a `MIGRATE` router redirect, and a one-version deprecation notice.
- **Production data cutover** (Replatform) — never executed by the LLM; human-executed with tested rollback.

### D-Blocks
None — the major architectural forks (locality-based split, per-cluster BAL, two-gate model, shift-left
ERL/Design-Quality, vendored-copy governance, shared ledger, LLM-authors-human-executes) were decided during
design and are recorded in `docs/plans/migrationSkill/` + `memory/MEMORY.md`. The future-autonomy flag is a
deferred *capability* (default OFF), not an open decision.

---

## Story Breakdown

> Sized precisely at Tech Spec (Step 11). Each story is itself substantial (a whole skill) — broken by
> logical completion, not by AC. Child ADO #s recorded at `IMPLEMENT ADO-9000 Story-{N}`.

**Type:** EPIC
**Total SP:** 76 (Story 1 = 21 · Story 2 = 34 · Story 3 = 21) — sized at Tech Spec (Step 11).

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | ADO-9001 | **Upgrade** skill (MVP) — tool-orchestrated in-place upgrade + tool preflight/guidance + gap/risk report + minimal inline substrate | 21 | Yes | None | ✅ Code-complete |
| 2 | ADO-9002 | **Rewrite** skill + **extract shared substrate** (rule of three) + shared checkpoint ledger + migration-knowledge cache + vendored-copy/drift-check seam | 34 | Yes | Story 1 | ✅ Code-complete (Inc A–D) |
| 3 | ADO-9003 | **Replatform** skill + **standalone packaging** (vendored-copy + drift-check, CI-enforced) + **retire legacy** `migration` + future-autonomy flag (OFF) | 21 | Yes | Story 2 | ✅ Code-complete |

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---
### Revision Log
2026-09-07 — ICEA drafted from ADO-9000 plan + design docs (docs/plans/migrationSkill/).
2026-09-07 — Approved
