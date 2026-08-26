# Migration Skill

> Consolidated from MEMORY.md auto-capture entries (2026-08-05 to 2026-08-25).
> Dream run: 2026-08-25. Confidence: 0.80 (avg across entries).

---

## Stage Structure (v1.16)

The migration skill follows a staged, gate-controlled flow:

| Stage | Purpose | Gate |
|-------|---------|------|
| 0 | Source analysis + 3 questions (target platform, cloud/hosting, hard constraints) | — |
| 0.5 | Target Options Analysis — recommends 2-3 scored target candidates + migration posture + ROM as ADR | APPROVE OPTIONS ADO-{ID} |
| 0.6 | Source Behavioral Inventory — behavioral discovery doc for human review before rewrite | APPROVE INVENTORY ADO-{ID} |
| 1 | AI proposes full target architecture (5 docs with Mermaid + ADR per component) | APPROVE ARCHITECTURE ADO-{ID} |
| 2 | Feasibility assessment (GREEN/YELLOW/RED) after architecture approval | APPROVE FEASIBILITY ADO-{ID} |
| 3 | Cluster plan + per-cluster specs + guardrail rule deployment (Step 3.3a) | — |
| 4 | Parallel cluster migration (branch-per-cluster, sub-agents) | — |
| 5 | Golden-master behavioral verification + test coverage + Playwright E2E | — |
| 6 | Full verification + visual checklist | APPROVE MIGRATION ADO-{ID} |

## Stack-Agnostic Execution Profiles

ALL stack-specific literals (build commands, paths, skeleton layout, config checks) live in per-target execution profiles at `skills/migration/references/strategies/{target-token}.md`. SKILL.md Stages 3-6 use `{profile TOKEN}` references resolved from the loaded profile.

**Token contract** (strategies/README.md): BUILD, TEST, COVERAGE, LAYOUT, COMPOSITION, BUILD_UNIT (forbidden set), PKG_ADD, SERVE+health, E2E, FITNESS, SKELETON, STANDARDS_EXAMPLE, CONFIG, RULES.

**Profile status:**
- `dotnet.md` — implemented (verified)
- `angular.md` — implemented (verified)
- `java-spring.md` — implemented (unverified)
- `python.md` — implemented (unverified, nodejs->python only)
- `react.md` — implemented (unverified, angular->react only)

**Hard rule:** never run a target's toolchain without its execution profile. SKILL.md STOPs unless STATUS is EXACTLY `implemented`.

## Profile Resolution Rule

The orchestrator MUST substitute every `{profile TOKEN}` to its concrete value BEFORE running/spawning. Sub-agents don't load the profile — they receive resolved values. In two-track, use the backend profile for backend clusters + frontend profile for frontend clusters.

## Source Behavioral Inventory (Stage 0.6)

Produces `ADO-{ID}-source-inventory.md` — behavioral discovery (NOT claimed requirements spec). Key design:
- Organized by bounded-context/module (NOT migration clusters, which don't exist yet)
- Confidence tiers: OBSERVED / STATIC / INFERRED (with file:line provenance)
- Given/When/Then detail required for INFERRED/high-risk/gap-adjacent items
- Three honesty axes: absent-from-code (section 10) vs seen-but-unresolved (section 11 Gaps Report) vs asserted-low-confidence (INFERRED)
- Review Focus triage: subset a reviewer MUST disposition (all INFERRED business rules, RED-risk, human-only gaps)
- Large scope: index + per-cluster files (mirrors knowledge-graph projection)
- Feature IDs (F-01...) are GLOBAL and STABLE across regenerates
- A signed review artifact is IMMUTABLE — post-approval additions are append-only (section 13 Review Log)

## Golden-Master Behavioral Verification (Stage 5.0)

Records request-to-response oracle from RUNNING source, replays against target, diffs normalized responses. Key rules:
- Verdicts go in the golden-master's own REPORT — never mutate the human-signed inventory
- Reproduced INFERRED items get promoted to OBSERVED in an APPEND to inventory section 13
- "Never normalize away an ASSERTED outcome" — status/error/threshold ARE the assertion
- Blocks MIGRATION COMPLETE on unexplained HIGH-risk drift
- Degrades to INFERRED characterization tests when source can't run

## Two Coordinated Single-Track Runs (NOT Monolithic Two-Track)

Full-stack migration = TWO coordinated SINGLE-TRACK runs sharing a contract. `mode.track` is one of: backend, frontend, upgrade (no more "two-track").
- BACKEND run = existing flow; at completion PUBLISHES integration contract (integration-contract.md + openapi.json + hash)
- FRONTEND run = first-class single-track; Step 0 CONSUMES contract from backend run or existing backend's OpenAPI URL
- Backend-first is mandatory (frontend cannot start until contract frozen)

## Target Scope

| Source | Target(s) |
|--------|-----------|
| .NET Framework 4.x | .NET 10 |
| .NET Core/5-8 | .NET 10 (upgrade) |
| Java/Spring | .NET (bidirectional mapping exists) |
| Node.js/Express | .NET, Python (FastAPI) |
| Angular | React |

Python-as-source and java/dotnet-to-python have NO mapping refs — refuse rather than fabricate.

## Context Budget + Resume

Context-budget check (reusing shared spec, in-skill, NO new hook) at START of document-heavy stages 1/2/3. Checkpoint written EARLY (end of Stage 0) and updated at every gate. Stage-level recovery keywords: MIGRATE ARCH / MIGRATE FEAS / MIGRATE CLUSTERS / MIGRATE OPTIONS / MIGRATE INVENTORY ADO-{ID}. Each re-enters reading prior approved docs from disk.

## Migration Runs IN Target Project

The migration skill runs in the TARGET project (developer cd's into new repo). SOURCE_PATH is collected in Step 0 and registered as additionalDirectories. All source reads use SOURCE_PATH prefix.

## Key Gotchas

- CONFIG pre-flight: skip cleanly when no DB (exit 0 if no ConnectionStrings section); fail only when declared but empty/placeholder
- Guardrail rules deploy at Step 3.3a (BEFORE code gen), not at /setup-init (Stage 6)
- APPROVE gate keywords must be in CLAUDE.md section 0a for cross-session approval to work
- `deploy-commands.cjs` deploys by reading `_project-deploy/commands/` directory, NOT plugin.json components.commands
- Checkpoint schema is at 1.8
