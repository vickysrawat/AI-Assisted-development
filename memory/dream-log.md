# dream-log.md — audit trail

> This file is append-only. Never edit previous entries.
> Each entry records a complete dream run: what changed, why, and the memory health snapshot.

---

<!-- Dream run entries will be appended below -->
<!-- Example of what a completed entry looks like:

## Dream run — 2025-01-20 14:32

**Sessions since last dream:** 6
**Trigger:** manual /dream

### Operations applied
| Operation | Entry | File | Confidence | Reason |
|-----------|-------|------|------------|--------|
| ADD | Vitest config location | memory/topic-testing.md | 0.75 | First noted in session-003 |
| UPDATE | Package manager | memory/topic-tooling.md | 0.90 | session-006 corrected npm → pnpm |
| DELETE | Use webpack for bundling | memory/topic-tooling.md | 0.10 | Superseded by Vite in session-004 |
| PROMOTE | pnpm is the package manager | CLAUDE.md § Stack & tooling | 0.92 | Confirmed in sessions 002,004,006 |
| KEEP | Redis required for integration tests | memory/topic-infra.md | 0.80 | Still accurate |

### Conflicts resolved
- **package manager**: "use npm" vs "use pnpm" → kept "use pnpm" because session-006 explicitly corrected this with the reason "npm causes lockfile conflicts on this project"

### What was pruned
- "Use webpack": superseded by Vite migration. Confidence decayed to 0.10 over 3 dream cycles.

### Memory health
- Entries before: 18
- Entries after: 15
- CLAUDE.md lines before: 12
- CLAUDE.md lines after: 16
- Average confidence: 0.74

### Notes
Three entries referenced files in the old /src/api/v1 path which was deleted in session-005.
These were deleted. Watch for more stale v1 references in future sessions.

-->

### [capture] [2026-07-20] Architecture decision — clean three-path hook architecture (no dispatch)
### [capture] [2026-07-20] Task completed — bash/PS1/Node three-path hook architecture implemented
### [capture] [2026-07-13] Error resolved — node -e bash quote issue when writing JSON with backticks

### [capture] [2026-07-20] Error resolved — 3-iteration adversarial review found 6 real bugs post-implementation
### [capture] [2026-07-20] Architecture decision — clean three-path hook architecture (no dispatch)

### [capture] [2026-07-20] Task completed — 4 remaining issues fixed (dream-sync, graph hooks, shell-type override, stale version)
### [capture] [2026-07-20] Error resolved — 3-iteration adversarial review found 6 real bugs post-implementation

### [capture] [2026-07-20] Error resolved — detectShell() missed Claude Code settings Bash denial
### [capture] [2026-07-20] Task completed — 4 remaining issues fixed (dream-sync, graph hooks, shell-type override, stale version)

### [capture] [2026-07-20] Error resolved — autoMemoryEnabled not added to settings.json on re-run

### [capture] [2026-07-20] Error resolved — architect skill missing diagram sections in generated architecture.md
### [capture] [2026-07-20] Error resolved — autoMemoryEnabled not added to settings.json on re-run

### [capture] 2026-07-20 Task completed — Developer guide restructured with 3 end-to-end shell paths
### [capture] 2026-07-18 Task completed — Knowledge graph refreshed post-VSTO

### [capture] 2026-07-23 Task completed — icea-feature Step 8 completeness self-check added
### [capture] 2026-07-18 Task completed — Mermaid diagram standards applied across all plugin templates

### [capture] 2026-07-23 Architecture decision — context budget enforcement: 3-layer hook + skill design
### [capture] 2026-07-23 Task completed — icea-feature Step 8 completeness self-check added

### [capture] 2026-07-23 Error resolved — context-budget-tech-write.cjs regex bug + scope expansion
### [capture] 2026-07-23 Architecture decision — context budget enforcement: 3-layer hook + skill design

### [capture] 2026-07-27 Task completed — command files: <command> → <skill> tag fix + examples + --help
### [capture] 2026-07-27 Error resolved — <command> tag deprecated in .claude/commands/*.md
### [capture] 2026-07-23 Error resolved — context-budget-tech-write.cjs regex bug + scope expansion

### [capture] 2026-07-27 Architecture decision — command files must use fully-qualified skill names
### [capture] 2026-07-27 Task completed — command files: <command> → <skill> tag fix + examples + --help

### [capture] 2026-07-27 Task completed — setup-init-bootstrap.cjs: stepWireLocalSettings added as step 2
### [capture] 2026-07-27 Architecture decision — setup-init auto-run: permissions in settings.local.json, scoped
### [capture] 2026-07-27 Architecture decision — command files must use fully-qualified skill names

### [capture] [2026-07-27] Task completed — setup-teardown preserves architecture and graph directories

### [capture] [2026-07-27] Error resolved — context-budget-tech-write.cjs sparse-stub bypass

### [capture] [2026-07-27] Error resolved — icea-feature Step 8 PLUGIN_DIR resolved too late

### [capture] 2026-07-27 Architecture decision — PLUGIN_DIR resolution must be the first step in every skill
### [capture] 2026-07-27 Task completed — setup-init-bootstrap.cjs: stepWireLocalSettings added as step 2

### [capture] [2026-07-29] Architecture decision — Epic story spec generation moved to pre-SAVE (temp/ staging)

### [capture] 2026-07-27 Architecture decision — setup-init auto-run: permissions in settings.local.json, scoped
### [capture] 2026-07-30 Approach abandoned — parallel sub-agents for setup-init (architect ∥ graph ∥ rules)
### [capture] 2026-07-30 Architecture decision — setup-init refactor: extract repo-detection as sequential prerequisite only
### [capture] 2026-07-30 Architecture decision — unified install via install.sh dispatcher + install.cmd
### [capture] 2026-07-30 Task completed — stepWireLocalSettings gaps: hooks + utilities + stale-path missing

### [capture] 2026-07-30 Architecture decision — graph pipeline is architect-doc-independent; deterministic module-derive is the right decomposition
### [capture] 2026-07-30 Task completed — stepWireLocalSettings gaps: hooks + utilities + stale-path missing

### [capture] 2026-07-30 Architecture decision — decouple-before-parallelising: decoupling IN the install/setup plan, parallelising → proposal doc
### [capture] 2026-07-30 Task completed — stepWireLocalSettings gaps: hooks + utilities + stale-path missing

### [capture] 2026-07-30 Plan approved — install/setup ease + path-scoped permissions + graph decoupling persisted to docs/plans
### [capture] 2026-07-30 Architecture decision — decouple-before-parallelising: decoupling IN the install/setup plan, parallelising → proposal doc

### [capture] 2026-07-30 Error resolved — installer flag styles differ: ps1 uses PowerShell switches, sh/cjs use --flags
### [capture] 2026-07-30 Error resolved — graph.json node `type` is a required enum; skeleton "unclassified" violates schema
### [capture] 2026-07-30 Error resolved — fingerprints are bash-helper-owned; a Node re-hash diverges (marks everything stale)
### [capture] 2026-07-30 Plan approved — install/setup ease + path-scoped permissions + graph decoupling persisted to docs/plans

### [capture] 2026-07-30 Error resolved — hooks run via the hook runner, NOT the Bash tool (no Bash permission needed)
### [capture] 2026-07-30 Architecture decision — decoupling graph-create requires ADR-0038 supersede + graph-sync shared derivation (churn risk)
### [capture] 2026-07-30 Plan approved — install/setup ease + path-scoped permissions + graph decoupling persisted to docs/plans

### [capture] 2026-07-30 Error resolved — auto-allowing Write(.claude/**) un-gates the enforcement hooks (security regression)
### [capture] 2026-07-30 Approach abandoned (pending verify) — install.sh→PowerShell/Node delegation may NOT fix the mintty hang
### [capture] 2026-07-30 Architecture decision — ADR 0038 only PARTIALLY superseded by graph-create move; do not modify 0038 file
### [capture] 2026-07-30 Error resolved — hooks run via the hook runner, NOT the Bash tool (no Bash permission needed)

### [capture] 2026-07-30 Task completed — Phase A of the install/setup plan implemented (dispatcher deferred)
### [capture] 2026-07-30 Error resolved — auto-allowing Write(.claude/**) un-gates the enforcement hooks (security regression)

### [capture] 2026-07-30 Task completed — Phase B: repo-detect.cjs + setup-init Step 0.5 gate
### [capture] 2026-07-30 Task completed — Phase A of the install/setup plan implemented (dispatcher deferred)

### [capture] 2026-07-31 Task completed — Phase C: graph-create skill extracted from architect; module-derive.cjs shared skeleton
### [capture] 2026-07-30 Task completed — Phase B: repo-detect.cjs + setup-init Step 0.5 gate

### [capture] [2026-08-03] Error resolved — Three bugs in icea-feature EPIC flow: CLAUDE.md §0a + TEMP_WRITE_EXEMPT + Hard Rule

### [capture] [2026-08-03] Task completed — icea-feature EPIC flow bugs fixed across plugin source + installed copy + KE.Web

### [capture] [2026-08-04] Task completed — §0a cross-session recovery handler bug fixed across all target projects + bootstrap self-heal
### [capture] [2026-08-04] Architecture decision — _project-deploy/CLAUDE.md proposal: separate deployment template from plugin project config

### [capture] [2026-08-04] Plan approved — _project-deploy/CLAUDE.md as explicit deployment template

### [capture] [2026-08-04] Task completed — _project-deploy/CLAUDE.md split implemented (bootstrap + validate.js)
### [capture] [2026-08-04] Error resolved — VSTO architect templates missing 3 files from v3.8.0 doc-set expansion

### [capture] [2026-08-05] Task completed — skills/migration/SKILL.md created
### [capture] [2026-08-05] Architecture decision — migrate skill: interactive Q&A over Decision Tree

### [capture] [2026-08-05] Task completed — skills/migration/SKILL.md v1.1 with research findings
### [capture] [2026-08-05] Task completed — skills/migration/SKILL.md created

### [capture] [2026-08-05] Plan approved — migration skill refactor: single-stack reference files + mappings layer
### [capture] [2026-08-05] Task completed — skills/migration/SKILL.md v1.1 with research findings

### [capture] [2026-08-05] Architecture decision — migration skill: runs IN source project, writes to separate target path
### [capture] [2026-08-05] Plan approved — migration skill refactor: single-stack reference files + mappings layer

### [capture] [2026-08-05] Task completed — migration skill full refactor into SKILL.md + 13 reference files
### [capture] [2026-08-05] Architecture decision — migration skill: runs IN source project, writes to separate target path

### [capture] [2026-08-05] Task completed — added dotnet-upgrade.md + dotnet-framework-to-dotnet.md mapping files
### [capture] [2026-08-05] Task completed — migration skill full refactor into SKILL.md + 13 reference files

### [capture] [2026-08-05] Architecture decision — migration skill: two separate docs (human reference + AI spec)
### [capture] [2026-08-05] Task completed — added dotnet-upgrade.md + dotnet-framework-to-dotnet.md mapping files

### [capture] [2026-08-05] Plan approved — migration skill: graph-sync prompt + worktree isolation for Phase 2 agents
### [capture] [2026-08-05] Architecture decision — migration skill: two separate docs (human reference + AI spec)

### [capture] [2026-08-05] Task completed — SKILL.md v1.3: Phase -1 target architecture + graph cluster plan + parallel Phase 2
### [capture] [2026-08-05] Plan approved — migration skill: graph-sync prompt + worktree isolation for Phase 2 agents

### [capture] [2026-08-05] Architecture decision — migration skill runs IN target project, reads from SOURCE_PATH
### [capture] [2026-08-05] Task completed — SKILL.md v1.3: Phase -1 target architecture + graph cluster plan + parallel Phase 2

### [capture] [2026-08-05] Architecture decision — Phase 4 browser verification: headless Playwright + visual checklist
### [capture] [2026-08-05] Architecture decision — migration skill runs IN target project, reads from SOURCE_PATH

### [capture] [2026-08-05] Plan approved — Phase 3/4 Playwright: generated from migration knowledge, executed via Bash (no LLM)
### [capture] [2026-08-05] Architecture decision — Phase 4 browser verification: headless Playwright + visual checklist

### [capture] [2026-08-05] Task completed — Phase 3/4 updated with full Playwright E2E spec
### [capture] [2026-08-05] Plan approved — Phase 3/4 Playwright: generated from migration knowledge, executed via Bash (no LLM)

### [capture] [2026-08-05] Plan approved — migration skill: document specs moved to references/specs/ folder
### [capture] [2026-08-05] Task completed — Phase 3/4 updated with full Playwright E2E spec

### [capture] [2026-08-05] Plan approved — migration skill: revised stage structure + minimal Q&A principle
### [capture] [2026-08-05] Plan approved — migration skill: document specs moved to references/specs/ folder

### [capture] [2026-08-05] Task completed — SKILL.md v1.5 rewritten with revised stage structure
### [capture] [2026-08-05] Plan approved — migration skill: revised stage structure + minimal Q&A principle

### [capture] [2026-08-05] Plan approved — docs 6-10 content specs agreed for phase1-architecture-spec.md
### [capture] [2026-08-05] Task completed — SKILL.md v1.5 rewritten with revised stage structure

### [capture] [2026-08-05] Task completed — all 5 specs/ reference files created + tracker fully updated
### [capture] [2026-08-05] Plan approved — docs 6-10 content specs agreed for phase1-architecture-spec.md

### [capture] [2026-08-05] Task completed — 3-iteration review of SKILL.md v1.5, 42 findings identified
### [capture] [2026-08-05] Task completed — all 5 specs/ reference files created + tracker fully updated

### [capture] [2026-08-07] Task completed — confirmed UserPromptSubmit hook receives user message in `prompt` field
### [capture] [2026-08-07] Architecture decision — migration keyword routing via UserPromptSubmit hook (deterministic layer)
### [capture] [2026-08-05] Task completed — 3-iteration review of SKILL.md v1.5, 42 findings identified

### [capture] [2026-08-07] Architecture decision — PLUGIN_DIR resolution via UserPromptSubmit hook (plugin-dir-context.cjs)
### [capture] [2026-08-07] Task completed — confirmed UserPromptSubmit hook receives user message in `prompt` field

### [capture] [2026-08-11] Plan approved — lift always-true guardrails from migration stacks/ refs into rule files

### [capture] [2026-08-11] Plan approved — migration skill context-budget-aware + resumable (Option 1)
### [capture] [2026-08-11] Plan approved — lift always-true guardrails from migration stacks/ refs into rule files

### [capture] [2026-08-12] Plan approved — LLM-agnostic multi-harness (Claude Code + GitHub Copilot) convergence
### [capture] [2026-08-12] Architecture decision — scoped Shared/Claude/Copilot source + per-harness projection
### [capture] [2026-08-12] Architecture decision — eliminate runtime $PLUGIN_DIR (self-contained project-deployed skills)
### [capture] [2026-08-12] Approach abandoned — greenfield Copilot plugin AND bespoke adapter/transform layer
### [capture] [2026-08-12] Architecture decision — 3-tier enforcement + SEV-1 AI-safety hardening as first-class

### [capture] [2026-08-12] Architecture decision — v3.13 = frozen git tag, 4.0 convergence on a branch (NOT a 2nd project, NOT a versions/ folder)
### [capture] [2026-08-12] Architecture decision — eliminate runtime $PLUGIN_DIR

### [capture] [2026-08-21] Plan approved — migration skill upgrade: Target Options Analysis + Golden-Master + enforcement fixes

### [capture] [2026-08-21] Task completed — migration skill v1.7 upgrade applied (Sets A/B/C) + version-bump convention learned

### [capture] [2026-08-21] Task completed — v3.14.0 release: guide/doc refresh + model-default blast-radius + migration registration gap

### [capture] [2026-08-21] Architecture decision — pluggable target execution profiles for migration Stage 4/5/6 (resolves A2)

### [capture] [2026-08-21] Error resolved — half-registered migration command + target_token/profile mismatch (3-iteration validation)

### [capture] [2026-08-21] Task completed — migration.yaml test scenario + runner.js harness gotchas

### [capture] [2026-08-21] Task completed — activated inert scenario assertions + runner.js model fix

### [capture] [2026-08-21] Architecture decision — deploy migration guardrail rules at Step 3.3a (resolves A3)

### [capture] [2026-08-21] Architecture decision — full stack-agnostic migration: ALL .NET literals move to strategies/dotnet.md

### [capture] [2026-08-21] Error resolved — edge cases from the stack-agnostic migration refactor

### [capture] [2026-08-21] Error resolved — CONFIG pre-flight false-failed DB-less targets

### [capture] [2026-08-21] Error resolved — CONFIG pre-flight false-fails DB-less targets (migration Stage 6.2)

### [capture] [2026-08-21] Plan approved — Stage 0.6 Source Behavioral Inventory as a human review-gate before rewrite

### [capture] [2026-08-21] Task completed — Java/Python execution profiles populated; STOP guard tightened

### [capture] [2026-08-21] Architecture decision — Python wired as a migration target (nodejs→python only)

### [capture] [2026-08-21] Architecture decision — Stage 0.6 gets a first-class Gaps Report (corrected earlier stance)
### [capture] [2026-08-21] Architecture decision — Python wired as a migration target (nodejs→python only)

### [capture] [2026-08-21] Task completed — Stage 0.6 inventory output organization (index + per-cluster for large scope)

### [capture] [2026-08-21] Task completed — golden-master spec aligned to the Stage 0.6 inventory (closed the capture↔inventory loop)

### [capture] [2026-08-21] Error resolved — golden-master must NOT rewrite the human-signed inventory (+4 hardenings)

### [capture] [2026-08-21] Architecture decision — two-track FRONTEND execution as Stage 4 Phase 4B

### [capture] [2026-08-21] Architecture decision — RE-MODEL two-track as two coordinated single-track runs (abandon the monolith)

### [capture] [2026-08-21] Task completed — React wired as a frontend target (angular→react) + Step 4.6 made target-agnostic

### [capture] [2026-08-21] Error resolved — migration APPROVE gate keywords missing from CLAUDE.md §0a (cross-session approval gap)

### [capture] [2026-08-25] Plan approved — fix stale `docs/icea/` paths plugin-wide + bug specs into hierarchy
### [capture] [2026-08-11] Plan approved — migration skill context-budget-aware + resumable (Option 1)

### [capture] [2026-08-25] Task completed — stale `docs/icea/` paths fixed plugin-wide (9 files)
### [capture] [2026-08-25] Plan approved — fix stale `docs/icea/` paths plugin-wide + bug specs into hierarchy

### [capture] [manual] YYYY-MM-DD — <topic>

### [capture] [2026-08-25] Architecture decision — /bug must persist approved spec BEFORE writing fix code

## Dream run — 2026-08-25T19:00:00Z

**Sessions searched:** 0 (conversation_search unavailable in CLI mode)
**Sessions with knowledge:** 0 (used MEMORY.md auto-capture entries as primary source)
**Trigger:** manual /dream
**This conversation:** CLI session (no URL)

### Sources this run
| Session | Date | URL | Knowledge extracted |
|---------|------|-----|---------------------|
| MEMORY.md | 2026-06-09 to 2026-08-25 | manual | ~70 auto-capture entries processed (first dream run) |

### Score rationale
- All entries: 0.70-1.00 base (auto-capture with explicit Confidence tags) — no adjustments needed
- Age bonus not applied (entries already had Confidence fields)
- No decay (first dream run)
- Manual ADO/corporate entries: 0.90 (high priority, production-confirmed)

### Operations applied

| Operation | Entry | Target | Confidence |
|-----------|-------|--------|------------|
| ADD | Migration Skill (~28 entries) | memory/topic-migration-skill.md | 0.80 |
| ADD | Setup Infrastructure (~15 entries) | memory/topic-setup-infrastructure.md | 0.85 |
| ADD | ICEA Workflow (~8 entries) | memory/topic-icea-workflow.md | 0.90 |
| ADD | Code Review / SAST (~6 entries) | memory/topic-code-review.md | 0.85 |
| ADD | Architecture Templates (~6 entries) | memory/topic-architecture-templates.md | 0.85 |
| ADD | Plugin Infrastructure (~8 entries) | memory/topic-plugin-infrastructure.md | 0.88 |
| ADD | Graph System (~4 entries) | memory/topic-graph-system.md | 0.85 |
| ADD | Dream/Memory System (3 entries) | memory/topic-dream-memory.md | 0.80 |
| ADD | ADO & Corporate (2 manual entries) | memory/topic-ado-corporate.md | 0.90 |
| ADD | Multi-Harness Convergence (5 entries) | memory/topic-multi-harness.md | 0.80 |

### Conflicts resolved
- None (first dream run, no prior knowledge to conflict with)

### Memory health
- Entries before: ~70 in MEMORY.md (1049 lines), 0 topic files
- Entries after: 1 in MEMORY.md (new auto-capture during run), 10 topic files
- CLAUDE.md lines before: unchanged
- CLAUDE.md lines after: unchanged (no PROMOTE operations)
- Average confidence: 0.84
- MEMORY.md entries processed: ~70 (all removed from inbox)

### Notes
- First dream run ever. MEMORY.md accumulated ~70 entries over 2.5 months without consolidation.
- conversation_search unavailable in CLI — MEMORY.md auto-capture entries used as sole source.
- Migration skill is dominant topic (~40% of knowledge). Many entries flagged "unverified."
- No PROMOTE candidates — knowledge needs session confirmation before CLAUDE.md elevation.
- A new auto-capture entry arrived during this run (bug spec architecture decision) — left in MEMORY.md for next cycle.
- Recommend /dream every 5-8 sessions to prevent accumulation.

### [capture] [2026-08-25] Task completed — first /dream consolidation run (70 entries -> 10 topic files)

### [capture] [2026-08-25] Plan approved — migration Stage 0.6 inventory validation/hardening harness
### [capture] [2026-08-25] Architecture decision — 3 anti-hallucination controls for Stage 0.6 (provenance token, absolute-scope gate, sub-agent extraction)

### [capture] [2026-08-25] Error resolved — verifier fixture prose must not contain the ID tokens it scans for

### [capture] [2026-08-26] Task completed — Increment 1 harness caught a real defect (STATIC/INFERRED under-specified)

### [capture] [2026-08-26] Task completed — spec fix verified: tier inflation 10→0, score 15/25→23/25

### [capture] [2026-08-26] Architecture decision — LLM scoring runs via a session SUBAGENT + rubric, NOT an API-calling script

### [capture] [2026-08-26] Task completed — Increment 2 (dotnet-fw) confirms stack-agnosticism; Increment-1 fix generalized

### [capture] [2026-08-26] Architecture decision — declarative-STATIC exception + web-grounded, self-learning framework-fact cache

### [capture] [2026-08-26] Architecture decision — SUPERSEDE: framework-fact self-learning goes via memory → /dream promotion, NOT inline auto-write

### [capture] [2026-08-26] Error resolved — setup-sync CANNOT preserve the stacks LEARNED block; /dream re-promotion is the durability mechanism

### [capture] [2026-08-26] Task completed — Increment 3 (Angular) cleanest run; refined cut-line validated across 3 stacks
