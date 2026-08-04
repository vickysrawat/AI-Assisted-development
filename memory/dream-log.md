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
