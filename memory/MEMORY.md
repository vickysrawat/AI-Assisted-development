# MEMORY.md — manual override inbox

### [2026-08-11] Plan approved — migration skill context-budget-aware + resumable (Option 1)
Decision: add a context-budget check (reusing skills/shared/context-budget-check.md, in-skill, NO new hook) at the START of the document-heavy stages 1/2/3 (Stage 4.0 already had the only one), write .claude/migration-checkpoint.json EARLY (end of Stage 0, not Stage 3) and update phase+stage_gates at every gate, and add stage-level recovery keywords MIGRATE ARCH / MIGRATE FEAS / MIGRATE CLUSTERS ADO-{ID} that re-enter each stage reading prior approved docs from disk (gated by prior-stage approval flags; each doubles as its check's skip_keyword). Checkpoint schema bumped 1.5→1.6 (adds stage_gates{}, mode{graph,track,source_token,target_token}, decision_log.source_module_count). Root cause = cross-stage accumulation, NOT single-stage size — the fix breaks accumulation via /compact + resume-from-disk. Also backfilling the 3 existing MIGRATE rows into root CLAUDE.md §0a (drift: they were only in _project-deploy/CLAUDE.md). REJECTED heavier sub-agent doc-offload (parallel or single): only helps a narrow edge case the budget warning already guards, degrades everyday revision UX, and adds machinery against "simplicity first". Stage 1 authoring stays inline. Register keywords in SKILL.md trigger list + both CLAUDE.md §0a (byte-identical patterns).
Trigger: Plan approved  Confidence: 0.85  Source: auto-capture

### [2026-08-11] Plan approved — lift always-true guardrails from migration stacks/ refs into rule files
Decision: the `skills/migration/references/stacks/*.md` "Anti-Patterns (never generate these)" tables + .NET middleware-pipeline ordering are always-true coding guardrails → lift the net-new ones into the matching `_project-deploy/rules/*.md` (rules are the single source; they load on every matching edit). Migration-only content (coming-FROM gotchas, NuGet/npm catalogs, mapping/RxJS tables, WCF matrices) stays in the references. Trim the lifted tables from references → replace with a pointer to the authoritative rule; add a note in migration SKILL.md to also load the matching rule file (rule wins on conflict) so guardrails survive when a target-stack rule isn't deployed yet. Found + fixing live drift: rule says Moq, stacks/dotnet.md said NSubstitute. Stack rule files live ONLY in `_project-deploy/rules/` (`.claude/rules/` has no stack files). Rejected alternatives: full copy (context bloat + drift), pointers-only (no enrichment).
Trigger: Plan approved  Confidence: 0.80  Source: auto-capture

### [2026-08-07] Architecture decision — PLUGIN_DIR resolution via UserPromptSubmit hook (plugin-dir-context.cjs)
PLUGIN_DIR is resolved once per session via a UserPromptSubmit hook that reads `.claude/plugin-path.txt` and injects `PLUGIN_DIR: /path/to/plugin` into every message's context. Claude substitutes the literal value wherever `$PLUGIN_DIR` appears in skill instructions — no bash variable scope issues, no re-resolution in each bash block. Fallback: if plugin-path.txt absent, hook runs the Node.js scanner and writes the result. This replaces the Step 0.1 resolution bash block and fixes the circular reference in Codebase Orientation (B-04). All three skills that use PLUGIN_DIR benefit — not migration-specific.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### [2026-08-07] Task completed — confirmed UserPromptSubmit hook receives user message in `prompt` field
Claude Code's UserPromptSubmit hook stdin JSON payload includes: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, and crucially `prompt` (the exact text the user typed). This makes deterministic keyword detection in hooks fully viable — a hook can read `input.prompt`, regex-match against migration keywords, resolve PLUGIN_DIR via file I/O, and inject skill content + checkpoint state before Claude responds. Hook output format: `hookSpecificOutput.hookEventName + additionalContext`. Test hook written at `.claude/hooks/test-prompt-hook.cjs`.
Trigger: Task completed  Confidence: 1.00  Source: auto-capture

### [2026-08-07] Architecture decision — migration keyword routing via UserPromptSubmit hook (deterministic layer)
Decision: use a UserPromptSubmit hook for migration keyword detection instead of relying solely on §0a text instructions. Hook reads `input.prompt`, matches MIGRATE RESUME/STATUS/RETRY CLUSTER patterns, resolves PLUGIN_DIR from `.claude/plugin-path.txt`, injects relevant SKILL.md section + checkpoint JSON into context before Claude responds. This is deterministic (shell execution, not AI inference) unlike §0a keyword matching which Claude can skip. §0a keeps one-line dispatch entries as fallback; hook is the authoritative trigger.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### [2026-08-05] Task completed — 3-iteration review of SKILL.md v1.5, 42 findings identified
Workflow ran 3 parallel review agents (plugin integration, spec completeness, execution correctness) + synthesis agent. 7 BLOCKERs: B-01 (not in consent/personas tables), B-02 (wrong Write Gate keyword APPROVE MIGRATION instead of APPROVE), B-03 (stage gate keywords not in CLAUDE.md 0a), B-04 (PLUGIN_DIR circular bootstrap), B-05 ({port} never defined), B-06 ({Name} never defined), B-07 (Python silently fails). 18 HIGH, 13 MEDIUM, 4 LOW. Three unconditional runtime failures: B-02, B-05, B-06. User will discuss each finding before approving fixes.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-08-05] Task completed — all 5 specs/ reference files created + tracker fully updated
Created: target-app-architecture-spec.md (compact standards reference for cluster agents), feasibility-spec.md (GREEN/YELLOW/RED format + architecture alignment section), phase1-architecture-spec.md (docs 6-10: Component/Data/Security/Infrastructure/Decisions with Mermaid + ADR format), integration-contract-spec.md (API endpoint format, breaking-change table), migration-report-spec.md (clusters migrated, E2E results, coverage, residual risks). All 10 docs now ✅ in tracker. SKILL.md v1.5 loads each spec only at its phase; Stage 4 agents don't load any specs.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Plan approved — docs 6-10 content specs agreed for phase1-architecture-spec.md
Doc 6 COMPONENT-ARCHITECTURE: system overview, tech stack, C4 context (Mermaid), C4 component map (Mermaid), layer architecture (Mermaid), external deps table, ADR per component. Doc 7 DATA-ARCHITECTURE: data strategy ADR, entity inventory, ER diagram (Mermaid), data flow sequence (Mermaid), PII inventory, schema migration approach. Doc 8 SECURITY-ARCHITECTURE: auth strategy ADR, auth flow sequence (Mermaid), authorization model, secrets management, data protection, threat model brief. Doc 9 INFRASTRUCTURE-ARCHITECTURE: environment map, hosting topology (Mermaid), CI/CD flow (Mermaid), external services, observability, hosting ADR. Doc 10 ARCHITECTURE-DECISIONS: running ADR log, initial ADRs from docs 6-9 (architecture pattern, auth, data access, hosting, bounded context boundaries).
Trigger: Plan approved  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Task completed — SKILL.md v1.5 rewritten with revised stage structure
SKILL.md rewritten from scratch as v1.5 with: Stage 0 (show source first, 3 questions only), Stage 1 (AI proposes all 5 architecture docs with Mermaid + ADR per component, gates on APPROVE ARCHITECTURE), Stage 2 (feasibility after architecture approval), Stage 3 (cluster plan + specs), Stage 4+ (parallel cluster migration with branch-per-cluster), Stage 5 (test coverage + Playwright E2E), Stage 6 (verification + visual checklist). Phase -1 eliminated. 6-question Q&A bloc gone — AI infers and proposes, asks only on genuine ambiguity.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Plan approved — migration skill: revised stage structure + minimal Q&A principle
Revised skill flow: Stage 0 (show source first, ask only 3 questions: target platform, cloud/hosting, hard constraints), Stage 1 (AI proposes full architecture with Mermaid diagrams + ADR per component, asks only on genuine ambiguity — never assumes), Stage 2 (feasibility after architecture approval), Stage 3 (cluster plan + specs), Stage 4+ (parallel migration). Previous Phase -1 6-question bloc eliminated — AI infers standards from source analysis and proposes them, user reviews. Principle: minimal questions upfront, ask targeted questions at the exact decision point.
Trigger: Plan approved  Confidence: 0.90  Source: auto-capture

### [2026-08-05] Plan approved — migration skill: document specs moved to references/specs/ folder
Architecture document specifications (what each doc contains, format, sections) extracted from SKILL.md into separate reference files under skills/migration/references/specs/. Five spec files: target-app-architecture-spec.md (Phase -1), feasibility-spec.md (Phase 0.5), phase1-architecture-spec.md (Phase 1 — 8 docs), integration-contract-spec.md (Phase 1 two-track), migration-report-spec.md (Phase 4). SKILL.md becomes lean — just loads spec file at phase entry, generates doc from spec. Phase 2 agents don't load any specs (work from generated docs on disk).
Trigger: Plan approved  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Task completed — Phase 3/4 updated with full Playwright E2E spec
Phase 3 Step 3.5 now generates 5 test files from migration knowledge (health, auth, api-contract, navigation, forms). data-testid convention added to cluster spec template. Phase 4 Step 4.2 added: pre-flight placeholder check, app startup sequence, token acquisition per auth strategy, npx playwright test headless, app teardown. Visual Verification Checklist generated for developer. Remaining TARGET_PATH refs cleaned to relative paths.
Trigger: Task completed  Confidence: 0.80  Source: auto-capture

### [2026-08-05] Plan approved — Phase 3/4 Playwright: generated from migration knowledge, executed via Bash (no LLM)
Phase 3 Step 3.5 generates Playwright tests from: integration contract (API tests), Phase -1 auth (auth tests), Angular routing module (navigation tests), cluster specs with data-testid convention (form tests), Phase -1 A4 health check (health test). Phase 4 checks placeholder connection strings first, then: start app via Bash, wait for health, acquire test token per Phase -1 A1, run npx playwright test headless, read stdout result. LLM only writes tests (Phase 3) and reads output summary (Phase 4) — execution is 100% OS process, zero LLM tokens during test run.
Trigger: Plan approved  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Architecture decision — Phase 4 browser verification: headless Playwright + visual checklist
Three-layer verification: (1) Agent runs headless Playwright E2E tests automatically in Phase 4 — app started in background, Playwright tests pre-generated in Phase 3 exercise all API endpoints + Angular routes + auth flows; (2) Developer completes Visual Verification Checklist for CSS/UX; (3) /verify skill for interactive testing. Angular must use Jest preset (not Karma) for headless unit tests — no display server needed. Playwright tests generated from integration contract + routing module + Phase -1 auth strategy.
Trigger: Plan approved  Confidence: 0.80  Source: auto-capture

### [2026-08-05] Architecture decision — migration skill runs IN target project, reads from SOURCE_PATH
CRITICAL INVERSION: migration skill runs in the TARGET project (developer cd's into new empty repo, runs /migration). SOURCE_PATH is collected in Step 0 and registered as additionalDirectories in .claude/settings.local.json. All source reads use SOURCE_PATH prefix. isolation:"worktree" now correctly creates branches of the TARGET repo. Planning docs go into TARGET's docs/. This makes the Workflow tool's worktree isolation work as designed.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### [2026-08-05] Task completed — SKILL.md v1.3: Phase -1 target architecture + graph cluster plan + parallel Phase 2
SKILL.md updated to v1.3 with: Phase -1 (6 Q&A questions for auth/infra/security/observability/API/code standards producing TARGET-APP-ARCHITECTURE.md), graph-reading step with graph-absent /graph-sync prompt, cluster derivation via BFS connected components + hub detection, per-cluster executable specs in TARGET-ARCHITECTURE.md (self-contained for Phase 2 agents), parallel cluster agents with isolation:worktree, checkpoint v1.3 with decision_log (compact JSON replacing full doc re-reads on resume).
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Plan approved — migration skill: graph-sync prompt + worktree isolation for Phase 2 agents
If graph absent at Phase 0: prompt developer to run /graph-sync before continuing (user confirmed "Yes"). Phase 2 parallel cluster agents use isolation: "worktree" — each agent reads source files from its own isolated worktree branch, writes generated code to TARGET_PATH/{cluster}/ (filesystem write persists outside worktree lifecycle). Orchestrator handles tracker updates after all agents complete (not individual agents, since they're in isolated branches).
Trigger: Plan approved  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Architecture decision — migration skill: two separate docs (human reference + AI spec)
docs/migration-architecture.md stays as human-readable reference (keep as-is). A separate AI-executable spec needs to be created where reference file sections are restructured into RULE blocks with Trigger/Phase/Action. Context budget strategy: (1) slice-scoped source reading via source file manifest in Phase 1, (2) phase-isolated sessions, (3) reference file summary sections, (4) checkpoint decision log as compact JSON replacing full planning doc re-reads on resume.
Trigger: Plan approved  Confidence: 0.80  Source: auto-capture

### [2026-08-05] Task completed — added dotnet-upgrade.md + dotnet-framework-to-dotnet.md mapping files
Two missing .NET migration mapping files created. dotnet-upgrade.md covers .NET Core/5-8 → .NET 10 (in-place TFM bump, 4 slices, package audit procedure, version-specific breaking changes). dotnet-framework-to-dotnet.md covers .NET Fx 4.x → .NET 10 (8 slices, Strangler Fig + YARP pattern, WebForms/WCF RED items, EF6 references shared ef6-to-efcore.md). SKILL.md mapping pair list updated to include both.
Trigger: Task completed  Confidence: 0.80  Source: auto-capture

### [2026-08-05] Task completed — migration skill full refactor into SKILL.md + 13 reference files
Refactored monolithic SKILL.md into lean orchestrator + references/stacks/ (6 files: dotnet, dotnet-framework, java-spring, nodejs-express, react, angular) + references/mappings/ (3 files: java-dotnet bidirectional, nodejs-dotnet, react-angular) + references/shared/ (3 files: ef6-to-efcore, clean-architecture, fullstack-integration). Added command stub at _project-deploy/commands/migration.md and MIGRATE RESUME/MIGRATE STATUS to _project-deploy/CLAUDE.md §0a. Key pattern: source stack file loaded after Q1, target + mapping files loaded after Q2 — timing matters for Q3/Q4 warnings.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### [2026-08-05] Architecture decision — migration skill: runs IN source project, writes to separate target path
Migration skill runs in the SOURCE application (setup-init already done, stack already known). Target application is a new/empty folder — its path is collected in Step 0 Q&A. All planning docs (feasibility, architecture, tracker) stay in SOURCE project's docs/. All generated code writes go to TARGET_PATH. Build/test commands run inside TARGET_PATH. Checkpoint lives in SOURCE project's .claude/. This means SOURCE_PATH = current directory (no collection needed); TARGET_PATH is the only new variable.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### [2026-08-05] Plan approved — migration skill refactor: single-stack reference files + mappings layer
Agreed approach: split monolithic SKILL.md into orchestrator + `references/stacks/{stack}.md` (per-stack idioms/patterns) + `references/mappings/{pair}.md` (parity GREEN/YELLOW/RED tables) + `references/shared/` (cross-cutting: EF6, clean-architecture, fullstack-integration). Single-stack files scale O(n); mapping files are optional thin overlays. If no mapping file exists for a pair, LLM derives parity from the two stack files with explicit UNKNOWN disclaimer. Rejected source→target pair files (O(n²) duplication).
Trigger: Plan approved  Confidence: 0.80  Source: auto-capture

### [2026-08-05] Task completed — skills/migration/SKILL.md v1.1 with research findings
Migration skill updated to v1.1 incorporating: 4 BLOCKER fixes (contract hash sync, RETRY/RESET/SKIP slice recovery, Q8 monorepo detection, Step 0.6 proportionality validation), EF6 silent bug table (9 items), Strangler Fig + YARP guidance, @Transactional→SaveChanges as #1 Java→.NET correctness bug (in Hard Rules), Angular Signals migration mapping, JWT RS256+JWKS hybrid pattern, CORS AllowAnyOrigin prohibition, app model alignment check Phase 4. Three parallel research agents + one critical analysis agent run concurrently.
Trigger: Task completed  Confidence: 0.80  Source: auto-capture

### [2026-08-05] Task completed — skills/migration/SKILL.md created
New migration skill created at `skills/migration/SKILL.md` covering open-matrix migrations (.NET Fx→.NET 10, Java↔.NET, React+Express→Angular+.NET, Node.js→.NET). Key patterns: interactive Q&A replaces Decision Tree; two-track BACKEND/FRONTEND model for full-stack; `APPROVE MIGRATION ADO-{ID}` as Write Gate keyword; characterization tests before Phase 2; per-slice checkpoint + resume.
Trigger: Task completed  Confidence: 0.80  Source: auto-capture

### [2026-08-05] Architecture decision — migrate skill: interactive Q&A over Decision Tree
Replaced the original Decision Tree (auto-defaults, .NET-only) with an interactive Q&A sequence (Q1–Q7) following `interactive-menu-spec.md`. Rejected fallback/manual-plan mode for unsupported stacks — skill stops with an error instead. Two-track model (combined-but-separable BACKEND + FRONTEND tracks) chosen over separate invocations for full-stack migrations.
Trigger: Architecture decision  Confidence: 0.80  Source: auto-capture

> Sessions are now the primary memory source.
> /dream reads your Claude Code conversations directly via conversation_search.
> You do not need to write here manually.
>
> This file is for EXCEPTIONS ONLY:
> - Things Claude should remember that didn't arise naturally in a session
> - Explicit corrections you want to force into memory immediately
> - Context that exists outside Claude Code (e.g. from a document or meeting)
>
> Auto-capture writes here automatically at trigger points (see CLAUDE.md).
> /dream will process and clear entries after each run.

---

## When to write here manually

Only write here if:
1. You have knowledge that Claude Code sessions won't contain
2. You want to guarantee something is captured before the next /dream run
3. You need to correct something that is already in topic-*.md files

For everything else — just work normally. /dream will find it in sessions.

---

### 2026-07-27 Architecture decision — PLUGIN_DIR resolution must be the first step in every skill

All skills that reference `$PLUGIN_DIR` must resolve it as the VERY FIRST operational step (before Codebase Orientation or equivalent), not in a later step. The root cause of search-thrashing was that `$PLUGIN_DIR` appeared in Codebase Orientation and Step 1 personas but was only resolved in Step 8. Convention: add `## Resolve PLUGIN_DIR — do this first, before any step` immediately after the frontmatter `---` separator in every skill. The §1a node resolver is the fallback when `plugin-path.txt` is absent.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### 2026-07-27 Task completed — setup-init-bootstrap.cjs: stepWireLocalSettings added as step 2
Added `stepWireLocalSettings()` to `scripts/setup-init-bootstrap.cjs` that writes scoped `permissions.allow` rules to `.claude/settings.local.json` early in setup-init (step 2, right after directory creation). Permissions are scoped to `{PLUGIN_DIR}/scripts/*.cjs` only — not a blanket `node *` wildcard — to prevent prompt-injection risk. This allows Claude's Bash tool to auto-run plugin scripts without per-call permission prompts during the rest of setup-init.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-07-27 Architecture decision — setup-init auto-run: permissions in settings.local.json, scoped
The fix for setup-init asking users to manually run scripts is writing `permissions.allow` to `settings.local.json` (not settings.json — machine-specific, gitignored) early in the bootstrap. `BASH_PATH` env var approach abandoned — not a recognized Claude Code key. `Bash(node *)` wildcard abandoned — too broad, prompt-injection risk. Correct approach: scope to `Bash(node "{PLUGIN_DIR}/scripts/*.cjs"*)`.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### 2026-07-30 Approach abandoned — parallel sub-agents for setup-init (architect ∥ graph ∥ rules)
Explored parallelising setup-init's architect, graph extraction, and rules deployment under sub-agents. ABANDONED for two fatal reasons: (1) `graph-extract-edges.js` is NOT independent of architect — it requires `graph.json` to already contain the node structure (modules + `paths` globs), which architect produces via LLM analysis in Step 7-2; the "deterministic" edge extraction is downstream of the LLM node definition. (2) The plugin is a documented single-writer/sequential system (`skills/shared/single-writer-assumption.md`) with NO file locking, NO atomic manifest job-IDs, NO merge semantics — concurrent writers to dream-init-state.json/manifest/graph.json silently corrupt (last-write-wins). Skills invoke skills inline ("Read SKILL.md and execute"), not by spawning agents. Do not retry parallel sub-agents without net-new locking+merge infra.
Trigger: Approach abandoned  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Architecture decision — setup-init refactor: extract repo-detection as sequential prerequisite only
Instead of parallelism, the safe setup-init refactor is a clean separation of concerns kept SEQUENTIAL: extract repo type detection into `scripts/repo-detect.cjs` (Layer 1 deterministic file scan → signals AMBIGUOUS exit → setup-init.md orchestrates Layer 2 LLM fallback inline → hard-fail if both fail), and make architect READ `detected_repo_type` from dream-init-state.json instead of detecting internally. Graph extraction stays inside architect (depends on its node output). Rules deployment is the ONLY genuinely architect-independent step but moving it buys only seconds. repo-detect.cjs is Node so it cannot call the LLM itself — it only signals; the skill orchestrates the fallback. Detection must MERGE into detected_stacks[] on re-run (not overwrite) to avoid orphaning deployed rules, and must return a primary type + stacks[] list for polyglot repos.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### 2026-07-30 Architecture decision — unified install via install.sh dispatcher + install.cmd
Plan to keep 3 installers but make install.sh a dispatcher: after the winpty re-exec block, if on Windows (uname MINGW/MSYS/CYGWIN) AND bash cannot open /dev/tty, delegate via exec to powershell.exe install.ps1 (probe `powershell -Command "exit 0"` first — Group Policy can block Bypass) else `node install.cjs`. Add install.cmd for CMD users (where bash → powershell → node; use separate `if` blocks with `exit /b %errorlevel%` on next line — the inline `&& (cmd & exit /b %errorlevel%)` form is a CMD bug that always yields 0). All 3 installers stay standalone; dispatcher is a no-op on Mac/Linux and Git-Bash-with-winpty. Guard exec with a _DISPATCHED env var to prevent loops. Repo path has spaces (OneDrive - Kirkland) — keep all paths quoted.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### 2026-07-30 Architecture decision — graph pipeline is architect-doc-independent; deterministic module-derive is the right decomposition
Verified against source: module derivation happens 3× (architect Steps 2-6, architect Step 7 graph nodes, graph-sync Step 4), EACH from the directory tree — NOT from architect's prose. graph-sync Step 4 (`find . -mindepth 2 -maxdepth 3 -type d`) only cross-references architecture.md "when a module's purpose is unclear" (optional hint). So the whole graph pipeline is cleanly separable from architect docs. Right decomposition = ONE deterministic module-derive step (module list + path globs + fingerprints via graph_module_fingerprint + graph-extract-edges.js EXTRACTED edges) consumed by architect (prose) AND graph-create (typing/INFERRED), writing to DISJOINT dirs (.claude/architecture vs .claude/graph → no conflict). Removes triple-orientation cost + guarantees module-boundary consistency. Reusable value is the DECOMPOSITION pattern (deterministic prep → disjoint-output consumers → orchestrator merge), not a parallel executor. Consumer family = per-module fan-out (code-review [docs/plans/multi-agent-code-review already exists], security, graph, architect) — NOT cross-module reasoning. DECISION: documented as future direction (Appendix A of the install/setup plan), NOT implemented now. Sequence if pursued: (1) deterministic module-derive, (2) separate graph-create sequential, (3) reusable fan-out primitive. Can't parallelise what isn't first decoupled.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### 2026-07-30 Error resolved — installer flag styles differ: ps1 uses PowerShell switches, sh/cjs use --flags
Verified: install.sh & install.cjs parse `--update/--uninstall/--yes`; install.ps1 declares `param([switch]$Update,[switch]$Uninstall,[switch]$Yes)` → invoked as `-Update/-Uninstall/-Yes`. Any dispatcher/install.cmd that forwards raw `$@`/`%*` to install.ps1 SILENTLY DROPS the bash flags → a requested `--update` becomes a FRESH INSTALL. Fix: translate flags when delegating to PowerShell, OR prefer node (flag-compatible) before PowerShell. Also `where bash` on Windows can resolve to WSL's System32\bash.exe (false positive) — probe `%ProgramFiles%\Git\bin\bash.exe` explicitly.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Error resolved — graph.json node `type` is a required enum; skeleton "unclassified" violates schema
Verified graph-json-schema.md:86 — node `type` is REQUIRED ∈ {service,repository,ui,datastore,external-api,shared-lib,domain}. A "skeleton graph.json" with type:"unclassified" corrupts the authoritative graph and any validator/consumer. Also graph-extract-edges.js exit(2) if graph.json unreadable OR nodes empty (lines 26-29), and reads only nodes/paths/edges (never type). Fix for the module-derive decoupling: module-derive writes a PRIVATE non-schema `.claude/graph/.module-skeleton.json` (module list + paths only); graph.json + fingerprints + graph-extract-edges ALL stay in graph-create so graph.json is only ever written schema-valid.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Error resolved — fingerprints are bash-helper-owned; a Node re-hash diverges (marks everything stale)
graph-json-schema.md + graph-sync explicitly state module fingerprints come from the BASH `graph_module_fingerprint` helper (find|sort -z|xargs sha1sum) and "a Node re-hash would diverge." So a new module-derive.cjs must NOT compute fingerprints in Node — it would make every module show STALE on the first /graph-sync. Fingerprints stay owned by the bash helper (used by architect, graph-sync, and graph-stale-detect hook alike). Also: dream-init-state field is `repo_type` (architect Step 4 reads it) + `detected_stacks[]` — do NOT invent `detected_repo_type`.
Trigger: Error resolved  Confidence: 0.85  Source: auto-capture

### 2026-07-31 Task completed — Phase C: graph-create skill extracted from architect; module-derive.cjs shared skeleton
Implemented full graph pipeline decoupling (ADR 0056): (1) scripts/module-derive.cjs — deterministic module-skeleton writer (SAME exclusion list as graph-sync Step 4 for S6 compliance, NO graph.json/fingerprints/edge extraction, atomic write to .claude/graph/.module-skeleton.json, gitignored via GITIGNORE_BASE, exit 0/1/2); (2) skills/graph-create/SKILL.md — extracted exactly from architect Step 7, reads skeleton, LLM classifies type (required enum), bash-helper fingerprints, graph-extract-edges.js for EXTRACTED edges, projects index+detail files; (3) architect SKILL.md: Step 7 replaced with delegation note, Step 1 now reads repo_type from state if set by repo-detect (avoids double detection); (4) setup-init.md: Step 1.5 (module-derive) + Step 3c (graph-create) inserted; (5) graph-sync SKILL.md: S6 sync note added to Step 4; (6) ADR 0056 created (0038 file untouched, only index annotated); (7) plugin.json: graph-create registered as skill #12; (8) S15: setup-status "architect generates graph" prose updated. All 4 node -c checks pass.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Task completed — Phase B: repo-detect.cjs + setup-init Step 0.5 gate
scripts/repo-detect.cjs created: 12-type detection ladder matching architect Step 1 order exactly (R7), atomic state write (write-tmp→rename), exit codes 0=detected/1=already-set/2=AMBIGUOUS/3=UNKNOWN, --force/--dry-run flags, stacks MERGE not overwrite. Wired into commands/setup-init.md as Step 0.5 (hard prerequisite before bootstrap), with resume-check (skip if repo_type already in state), LLM fallback on exit 2, hard-fail on exit 3. Smoke-tested: .sln→DOTNET_API, package.json+react→REACT, empty→exit 3+message, state-merge preserves other fields, --force overrides. Node.js sync only (no LLM in script). script-review-gate hook required the SCRIPT REVIEW header (confirmed it accepted it).
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Task completed — Phase A of the install/setup plan implemented (dispatcher deferred)
Implemented Phase A: (1) install.cmd new entry (Git Bash→Node→PowerShell, WSL-safe Git Bash probe, PS flag translation, with SCRIPT REVIEW header required by script-review-gate hook for .cmd files) + README quick-start table; (2) stepWireLocalSettings extended in setup-init-bootstrap.cjs (append-only utilities, path-aware re-run guard, malformed-json warn-and-abort, NO broad Write(.claude/**)); (3) setup-init resume hint in printSummary; setup-status new check 1a-ii scoped CLAUDE.md §2 placeholder scan; setup-sync Step 1c prereq + migration header + prominent graph-sync line; setup-teardown case-insensitive CONFIRM (.cjs:421 + skill) + --rules empty guard + --state cross-scope warning + bootstrap pre-commit .local.bak collision guard. install.sh dispatcher DEFERRED pending S10 (delegation may just relocate the mintty hang — must verify PS/Node prompt from a winpty-less mintty first). Both .cjs pass node -c; isolated smoke test confirmed append-only/malformed/no-Write behavior. Changes are working-tree only, not committed.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Error resolved — auto-allowing Write(.claude/**) un-gates the enforcement hooks (security regression)
Adding `Write(.claude/**)`/`Edit(.claude/**)` to settings.local.json permissions.allow would let ANY write to `.claude/hooks/*.cjs` and `.claude/settings.json` proceed WITHOUT a prompt — silently un-gating the icea-floor/secrets/script-review hooks that enforce the plugin. Prompt-injection foothold. Gotcha: never broadly auto-allow Write/Edit under .claude/; keep Read(.claude/**) + narrow Edit(CLAUDE.md)/Edit(memory/*.md) only; writes to hooks/settings must stay prompted.
Trigger: Error resolved  Confidence: 0.85  Source: auto-capture

### 2026-07-30 Approach abandoned (pending verify) — install.sh→PowerShell/Node delegation may NOT fix the mintty hang
The mintty hang is caused by no Windows console allocation (why winpty fixes it). PowerShell.exe/node spawned from the SAME console-less mintty may hang on interactive prompts identically — so the dispatcher could just relocate the hang, not fix it. Do NOT build the Part-1 dispatcher before empirically confirming PS/Node interactive prompts work from a winpty-less mintty. If they don't, the fix is guidance (re-run under winpty / use install.cmd from CMD), not silent delegation. Also: delegating passes Git-Bash `/c/...` paths that MSYS may not convert → normalise to Windows path before exec.
Trigger: Approach abandoned  Confidence: 0.70  Source: auto-capture

### 2026-07-30 Architecture decision — ADR 0038 only PARTIALLY superseded by graph-create move; do not modify 0038 file
ADR 0038 = "knowledge graph is the single orientation layer" (still valid); only its sub-claim "architect generates the graph (Step 7)" moves to the new graph-create skill. So 0038 is NOT fully superseded. Per user directive + partial nature: do NOT modify the 0038 ADR file at all. New ADR = 0056 (next free number after 0055). Record linkage in docs/adr/README.md index only (add 0056 row; annotate 0038 row "graph generation moved to 0056"). Repo convention normally adds a `Status: Superseded by` line to old ADRs (see 0017) — we deliberately deviate here because 0038 is only partially affected; confirm acceptable.
Trigger: Architecture decision  Confidence: 0.80  Source: auto-capture

### 2026-07-30 Error resolved — hooks run via the hook runner, NOT the Bash tool (no Bash permission needed)
Verified `scripts/setup-init-bootstrap.cjs:80`: settings.json hooks execute via Claude Code's hook subsystem, not the Bash tool. So a hook command like `node .claude/hooks/icea-floor.cjs` NEVER triggers a `Bash(...)` permission prompt. Gotcha: do NOT add `Bash(node .claude/hooks/*.cjs)` to settings.local.json to "stop hook prompts" — there are none; the entry is inert. Bash permission entries only matter for commands a SKILL invokes through the Bash tool (node scripts, ls/grep/cp/etc.). Also: `find` is deliberately never allowlisted (ADR 0054) so architect/graph-sync find calls keep prompting by design.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Architecture decision — decoupling graph-create requires ADR-0038 supersede + graph-sync shared derivation (churn risk)
Two Phase-C constraints from stress test: (1) ADR 0038 explicitly states "the architect skill generates the graph (Step 7)"; moving graph gen to a new graph-create skill CONTRADICTS it → must ship a superseding ADR + fix DEVELOPER-GUIDE/setup-init prose. (2) graph-sync Step 4 derives modules independently via its own `find`; if module-derive/graph-create use a different derivation, the FIRST graph-sync churns (spurious renames) → graph-sync MUST consume the shared module-derive skeleton (required, not optional). Also: register the new graph-create skill in plugin.json components.skills + sync-config + version-check; make it an INTERNAL helper (no command stub) to minimise surface.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### 2026-07-30 Plan approved — install/setup ease + path-scoped permissions + graph decoupling persisted to docs/plans
Approved 4-part plan persisted to docs/plans/2026-07-30-install-setup-ease-permissions-graph-decoupling.md with a Status lifecycle header (📋 Planned → 🚧 In progress → ✅ Implemented) + per-phase ⬜ boxes. Parts: (1) install.sh dispatcher + install.cmd + README; (2) stepWireLocalSettings hook+utility+stale-path gaps; (3) setup-init/sync/teardown/status UX + graph decoupling; (4) module-derive + graph-create extraction. Implementation sequencing = Phase A (low-risk, independent) → Phase B (repo-detect) → Phase C (graph decoupling, CHECKPOINT before starting). Parallel-execution primitive spun to docs/proposals/parallel-execution-primitive.md (v0.1) + README row. Convention: repo persistent plans live in docs/plans/ (dated YYYY-MM-DD-slug.md), proposals in docs/proposals/ (plural). Not yet implemented — deferred for later.
Trigger: Plan approved  Confidence: 0.90  Source: auto-capture

### 2026-07-30 Architecture decision — decouple-before-parallelising: decoupling IN the install/setup plan, parallelising → proposal doc
Decision: the install/setup plan now DOES the decoupling (new deterministic scripts/module-derive.cjs producing a graph.json skeleton with type:"unclassified" + EXTRACTED edges; extract skills/graph-create/SKILL.md out of architect Step 7; architect keeps only docs; setup-init orchestrates detection→module-derive→Phase2→architect→graph-create→graph-sync, all SEQUENTIAL, single-writer preserved). The PARALLELISATION layer (reusable fan-out primitive) is spun out to a new RFC docs/proposals/parallel-execution-primitive.md (v0.1, following async-checkpoint-queue.md format) + a row in docs/proposals/README.md, for future refinement. Biggest risk = extracting graph-create touches ADR 0038/0041/0053 contracts (marker semantics, EXTRACTED-edge ownership, graph.json-as-authoritative-projection); must preserve byte-equivalent graph.json output on a fixture repo. Note: docs/ dir is docs/proposals (plural), NOT docs/proposal. Proposal doc could not be written during plan mode — it is an on-approval deliverable specified verbatim in the plan.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### 2026-07-30 Task completed — stepWireLocalSettings gaps: hooks + utilities + stale-path missing
Reviewing the existing `stepWireLocalSettings` (bootstrap.cjs §F0 ~line 412): it scopes node to `{pluginDir}/scripts/*.cjs` but is INCOMPLETE — missing `Bash(node .claude/hooks/*.cjs)` (causes silent permission prompt on first Write after setup, for icea-floor.cjs etc.) and common utilities (ls/grep/cp/mkdir/sed/which/where.exe). Also its `isDone(manifest,'wireLocalSettings')` guard leaves a STALE absolute plugin path after reinstall in init mode (sync mode resets manifest so unaffected). Fix = add hook+utility entries and a path-aware re-run guard comparing prevOp.scriptsDir to current. API is `isDone(manifest,key)` / `markStep(manifest,key,data)` — manifest-first arg order. Do NOT change the existing double-backslash escaping (production, working).
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### 2026-07-27 Architecture decision — command files must use fully-qualified skill names
`<skill>` tags in `.claude/commands/*.md` must use `<skill>ai-assisted-development:skill-name</skill>` (not `<skill>skill-name</skill>`). In the plugin's own project session, unqualified names resolve because the plugin registers both forms. In target project sessions (e.g. RealEstateTracker), only the `ai-assisted-development:` prefixed names are registered — unqualified names silently fail with "Unknown skill". The correct reference pattern is confirmed in `sync-dirs.md` in RealEstateTracker which already uses the qualified form.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### 2026-07-27 Task completed — command files: <command> → <skill> tag fix + examples + --help
All 37 `.claude/commands/*.md` files updated: (1) 17 files using deprecated `<command>X</command>` body tag changed to `<skill>X</skill>` — this fixes "Unknown skill" errors when running standalone `/critic`, `/code-review`, `/bug`, etc.; (2) all descriptions now end with `  Example: /command args`; (3) all files now include a `--help`/`?help` conditional block that prints arguments and usage. Root cause of flickering: `<command>` tag not recognized by Claude Code command processor for skill dispatch; skills called internally via Skill tool (by icea-feature etc.) worked fine. Deployed to RealEstateTracker (24 files); KE.KMS.Trackers.Phase12 has no `.claude/commands/` dir.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-07-27 Error resolved — <command> tag deprecated in .claude/commands/*.md
17 command files in this plugin used `<command>skill-name</command>` instead of `<skill>skill-name</skill>`. Claude Code's command processor only recognizes the `<skill>` tag for skill dispatch — the `<command>` tag silently fails with "Unknown skill: X". Pattern for future reference: command body must use `<skill>skill-name</skill>` to invoke a skill. The `<command>` tag is NOT equivalent.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### 2026-07-23 Error resolved — context-budget-tech-write.cjs regex bug + scope expansion
The hook had a critical regex bug (`ADO-\d+-.*-tech\.md` — extra literal `-` prevented match of `temp/ADO-54050-tech.md`; hook was completely inert). Fix: `ADO-\d+.*-tech\.md`. Hook expanded from 1 rule to 6-rule dispatch table covering: temp tech spec, docs tech spec, temp ICEA, docs ICEA, architecture files, graph markdown files. Code block detection (```` ``` ```` fence tracking) added to `countPlaceholders` to prevent false positives from TypeScript/C# code examples. Batch writers (architect=8 files, graph-sync=N files) use time-bounded force flags (10 min TTL, not deleted on read) instead of single-use flags to avoid requiring one developer action per file. `context-budget-icea-save.cjs` expanded to cover `SAVE TECH` (placeholder count, not line count) and `REVISE` (recursive `docs/` search for permanent ICEA) in addition to `SAVE ICEA`.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### 2026-07-23 Architecture decision — context budget enforcement: 3-layer hook + skill design
Context exhaustion during Tech Spec generation is enforced by three non-overlapping layers: (1) `UserPromptSubmit` hook `context-budget-icea-save.cjs` injects an early warning before Claude starts Step 8; (2) shared skill `context-budget-check.md` provides mid-generation guidance with /compact and new-session options; (3) `PreToolUse` Write hook `context-budget-tech-write.cjs` blocks the actual Write call if content has >15 unfilled `{…}` placeholders — this layer runs at OS level and cannot be bypassed by skill instructions. Force escape hatch: write `temp/ADO-{ID}-tech-force.flag` sentinel first; hook sees it, allows one write, deletes flag. The shared skill is parameterized for reuse in icea-implement, code-review, and other large-output skills.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### 2026-07-23 Task completed — icea-feature Step 8 completeness self-check added
Added a completeness self-check to Step 8 of `skills/icea-feature/SKILL.md` (ADO-PLUGIN-1). After the critic gate passes, the model counts unfilled `{…}` placeholder tokens: >15 = scaffold-only (do not write to temp, emit "CONTEXT EXHAUSTED" message with `TECH ADO-{ID}` recovery command); 6–15 = partial derivation (write to temp with a `CONTEXT NOTE` warning); 0–5 = normal flow. Root cause being fixed: long ICEA sessions exhaust context before Step 8 can fully derive the Tech Spec, resulting in a stub with unfilled template sections — developer must use `TECH ADO-{ID}` in a fresh session as the recovery path.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-07-18 Task completed — Mermaid diagram standards applied across all plugin templates
All 15 architecture template files with Mermaid diagrams now use `<div style="background-color: white; padding: 25px; border-radius: 8px;">` wrappers. All template `architecture-deployment.md` files have a CI/CD pipeline `flowchart LR` diagram; `_shared/architecture-integrations.md` has an integration map; all `architecture-security.md` files have trust-zone diagrams. Node color palette: User=`#7F8C8D`, Backend=`#1F618D`, Frontend=`#3498DB`, External=`#1ABC9C`, DataStore=`#2C3E50`, Proxy/Office=`#E67E22`, Auth=`#8E44AD`. Every `style` directive must include `color:`, `stroke:`, and `stroke-width:2px` (not just `fill:`).
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-07-18 Task completed — Architect skill Step 7 additionalDirectories scaffolding
Added Step 7 to `skills/architect/SKILL.md`: reads `additionalDirectories` from `.claude/settings.local.json`, fingerprint-detects the stack for each path (same bash as Step 1 but using `$DIR/` prefix), deploys composed `_shared/` + stack-overlay templates to `<dir>/.claude/architecture/`. Skips directories that already have architecture files. Reports per-directory in Step 7c summary.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### 2026-07-20 Task completed — Developer guide restructured with 3 end-to-end shell paths
Replaced the fragmented install/integrate sections in `docs/workflow/developer-guide.html` with a single tabbed section (Bash → Node.js → PowerShell, each covering install + provision + verify). The Node.js tab has an Option A (plugin-path.txt) / Option B (absolute path) split for fresh projects where `.claude/plugin-path.txt` doesn't exist yet. The orphaned `#node-only-setup` section was removed; `#setup` is now labelled "provisioning reference".
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### 2026-07-18 Task completed — Knowledge graph refreshed post-VSTO
9 modules were stale after VSTO work: architect, code-review, security, app-readiness, dynamic-scan, icea-feature, project-deploy, rules, scripts. Fingerprints recomputed using SHA1 over sorted directory walk and written to `graph.json`. Detail files updated with VSTO-specific additions. `graph-index.md` date bumped to 2026-07-18. Run `/graph-sync` for future incremental updates.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

---

## Format for manual entries

```
### [manual] YYYY-MM-DD — <topic>
<what Claude should know>
Source: <where this came from>
Priority: normal | high | urgent
```

For urgent corrections (do not retry / critical failures):
Use `Priority: urgent` — these get fast-tracked to CLAUDE.md
without waiting for the normal Tier 3 review.

---

## Auto-capture entries

Claude writes below automatically at trigger points.
These are processed and removed by /dream each run.

<!-- Auto-capture entries appear below this line -->

### [2026-08-21] Error resolved — migration APPROVE gate keywords missing from CLAUDE.md §0a (cross-session approval gap)
Final full cross-reference audit of the migration skill was overwhelmingly clean (no dangling `$PLUGIN_DIR/...references/` paths; every `{profile TOKEN}` defined; zero stray old-model terms two-track/Phase 4A-4B/web//stale-schema; versions consistent plugin 3.14.0 · skill 1.16 · model-routing 1.4 · checkpoint 1.8; all 5 profiles STATUS implemented; complete mapping+profile+stack triad for every supported direction; full MIGRATE-keyword parity across SKILL + both CLAUDE.md). ONE finding: the migration APPROVE gates (APPROVE OPTIONS/INVENTORY/ARCHITECTURE/FEASIBILITY/MIGRATION) were in SKILL.md but NOT in either CLAUDE.md §0a (root=0 deploy=0) — while their MIGRATE recovery counterparts ARE global. That breaks cross-session approval, which the Stage 0.6 review gate explicitly anticipates (review the inventory over days → return → `APPROVE INVENTORY ADO-…` in a fresh session with nothing to route it). FIX: one consolidated §0a row in both CLAUDE.md ("APPROVE OPTIONS / INVENTORY / ARCHITECTURE / FEASIBILITY / MIGRATION ADO-{ID}" → invoke the migration skill, set the stage_gate from the on-disk checkpoint, continue). GOTCHA: whenever you add a cross-session MIGRATE recovery keyword, add its paired APPROVE gate to §0a too.
Trigger: Error resolved  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Task completed — React wired as a frontend target (angular→react) + Step 4.6 made target-agnostic
Added React as a frontend migration target, scoped to the well-grounded `angular→react` pair. New `strategies/react.md` (Vite/React execution profile, root-relative like angular.md/dotnet.md; STATUS implemented ⚠unverified) + `mappings/angular-react.md` (Angular→React GREEN/YELLOW/RED; RED items: signal/computed auto-tracking → MANUAL useEffect/useMemo dep arrays (stale-closure risk), Zone.js change detection → explicit React renders, [(ngModel)] two-way → controlled components, complex RxJS orchestration → TanStack Query). `stacks/react.md` already existed (source ref) — header updated to "source OR target". KEY: genericized SKILL.md Step 4.6 (the frontend run's Stage 4) to be TARGET-AGNOSTIC — it now resolves BUILD/LAYOUT/COMPOSITION/RULES/STANDARDS from the frontend target profile (`angular.md` OR `react.md` per target_token), not Angular-hardcoded; agent prompt, client-gen path, and 4.6.3 composition all profile-driven. Q1 `angular+nodejs` frontend-run now offers Angular OR React. Updated honest-STOP, README status table, both CLAUDE.md notes, CHANGELOG, migration doc (also fixed a stale "schema 1.6→1.7" → 1.6→1.8 and skill version v1.13→v1.16). Migration skill v1.15→1.16. Unverified end-to-end (no live run). React-as-target only from Angular; react→react / other-source→react not mapped.
Trigger: Task completed  Confidence: 0.75  Source: auto-capture


### [2026-08-21] Architecture decision — RE-MODEL two-track as two coordinated single-track runs (abandon the monolith)
Critical review (2 iterations) showed the monolithic two-track (one invocation migrating backend+frontend) is "two migrations crammed into one": every singular assumption (one source path, one graph, one parity mapping, one target profile, one skeleton) had to be doubled — fixes 1/2/3 cascaded into G1 (two mappings + four stack refs), G2 (two-graph analysis/derivation), G3 (OpenAPI export step + openapi-generator-cli's Java dependency), G4 (frontend-only needs an existing-backend URL). DECISION (user): abandon the monolith; model a full-stack migration as TWO coordinated SINGLE-TRACK runs sharing a contract. `mode.track` ∈ {backend, frontend, upgrade} (no more "two-track"). BACKEND run = existing flow; at completion PUBLISHES the integration contract (integration-contract.md + openapi.json + hash) to a shareable path. FRONTEND run (react→angular) = first-class single-track: Step 0 CONSUMES a contract (published-by-backend-run OR an existing backend's OpenAPI URL); Stage 3.3 skeleton = the angular `web/` workspace (its target); Stage 4 = the frontend cluster flow (generate typed client from the consumed contract via a JS-native generator to avoid the Java dep, per-cluster contract-hash gate, FE cluster agents, FE integration); verification = Playwright. This makes each run single-everything (dissolves G1–G4), and "Frontend only"/"Backend only" are just these two run types. KEEP (relocated): angular profile, react-angular mapping, stacks/angular+python, FE agent prompt, generated-client discipline, contract-hash gate, fullstack-integration.md. REMOVE: monolithic Phase 4A/4B, Step 4.1 BE/FE tagging, "two source paths in one run", Step 4.6-as-bolt-on. REJECTED: completing the monolith (most machinery for an inherently-two-migrations scenario — violates simplicity-first). Migration skill → v1.15 (large re-architecture).
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture


### [2026-08-21] Architecture decision — two-track FRONTEND execution as Stage 4 Phase 4B
Fleshed out the last under-developed execution path. Stage 4 now explicitly runs in two phases for two-track: PHASE 4A = backend track (Steps 4.2–4.5 over BACKEND-tagged clusters) → CONTRACT FREEZE (regenerate/confirm backend OpenAPI, reconcile with the integration contract, lock contract_hash) → PHASE 4B = new Step 4.6 FRONTEND track over FRONTEND-tagged clusters. Step 4.1 now tags each cluster BACKEND/FRONTEND by layer/module type. Step 4.6: (4.6.0) generate the typed Angular API client + auth interceptor from the FROZEN OpenAPI, commit to main so all FE branches inherit it; (4.6.1) FE tiers = shared UI kernel first, then feature clusters; (4.6.2) per FE cluster: Step 4.3a contract-hash gate (MATCH required — contract is frozen) → spawn FRONTEND agent → merge; (4.6.3) FE integration (app.config/app.routes/environments) + tag stage4-complete. New FRONTEND cluster-agent prompt: angular profile tokens, reads (never edits) the integration contract, calls the API ONLY through the generated client, adds data-testid, RxJS cleanup per angular-rules; FORBIDDEN includes web/src/app/api (generated) + backend src/. stage4-complete tag moves from 4.5 (single-track) to 4.6.3 (two-track). Backend-first is mandatory (FE cannot start until contract frozen). FE behavioural verification stays Playwright (Stage 5.3/6.2), not golden-master (which is API-level). Migration skill v1.13→1.14.
Trigger: Architecture decision  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Error resolved — golden-master must NOT rewrite the human-signed inventory (+4 hardenings)
3-iteration critique of Stage 0.6/golden-master found a showstopper I'd introduced: Stage 5.0 "write results BACK to the inventory (promote INFERRED→OBSERVED in §5/§12, close gaps §11)" MUTATED a human-signed baseline — breaking audit integrity (approved doc ≠ on-disk doc) and mechanically brittle (a "zero-LLM" replay script rewriting confidence cells across index + N per-cluster markdown files). FIX: golden-master records verdicts in its own REPORT (keyed by feature_id) and APPENDS a "Stage 5.0 verification results" block to the inventory §13 Review Log only — §5/§11 stay immutable after APPROVE INVENTORY. Four more fixes: (D) inventory groups by source bounded-context/module, NOT Stage-3 migration clusters (which don't exist yet) — the feature→cluster mapping is completed at Stage 3.1; (F) feature-IDs are STABLE across MIGRATE INVENTORY regenerates (match on provenance, never renumber) or the whole spine breaks; (G) verbatim outcomes containing a dynamic/PII sub-part → assert the stable shape, mask the variable slice; (B) mechanical port may proceed to Stage 1 WITHOUT APPROVE INVENTORY (non-blocking); + OBSERVED tier / source-can't-run ceiling clarifications. Migration skill v1.12→1.13. GOTCHA: a signed review artifact is immutable — post-approval additions are append-only (§13), never in-place edits to reviewed content.
Trigger: Error resolved  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Task completed — golden-master spec aligned to the Stage 0.6 inventory (closed the capture↔inventory loop)
Made a golden-master recording the *executable form* of a Stage 0.6 inventory behaviour: recording + verdict schemas now carry `feature_id`/`gap_id` and `verifies_gwt`/`asserts` (request=When, response=Then verbatim). Worklist is driven from the inventory in priority order (INFERRED GM-verifiable → HIGH-risk → `run-the-source` gaps → regression). Added the rule "never normalize away an ASSERTED outcome" (status/error/threshold ARE the assertion). Step 4 now WRITES BACK to the inventory: reproduced INFERRED→OBSERVED (§5+§12), reproduced gap→close §11 + add OBSERVED behaviour to §5, drift→flag; human-verify-only items explicitly OUT of GM scope. FIXED a stale cross-ref: SKILL.md Stage 5.0 had promotion going to "§11" (now the Gaps Report) — corrected to §5/§12 promote + §11 gap-close. Part of uncommitted v1.12. Traceability spine is now end-to-end: inventory feature ID → architecture → feasibility → acceptance/ADO tasks → golden-master recording.
Trigger: Task completed  Confidence: 0.75  Source: auto-capture


### [2026-08-21] Task completed — Stage 0.6 inventory output organization (index + per-cluster for large scope)
Added an "Output Organization" section to source-inventory-spec.md: group behaviours by feature/cluster (never by source file — "reads like what the app does, not a TOC of the code"); SMALL/module scope = one file `ADO-{ID}-source-inventory.md` (§1–§14 inline); LARGE/whole-app scope = an INDEX (cross-cutting §1/§3/§4/§7–§10 + consolidated §11 gaps + §12–§14 + a cluster table with links/rollups/status) + one file per cluster `ADO-{ID}-source-inventory-{cluster}.md` (that cluster's §5 catalog + §6 rules + G/W/T + its gaps + review status). Feature IDs F-01… are GLOBAL across files; index roll-ups aggregate per-cluster; APPROVE INVENTORY gates the whole set (partial/incremental review OK, but all Review-Focus items across all clusters must be dispositioned). Mirrors the knowledge-graph index+detail projection. Folded into the uncommitted v1.12 (no new bump). Gap was: we grouped by cluster but still emitted ONE monolithic doc — unreviewable/undiffable at scale, undercutting the review-gate purpose.
Trigger: Task completed  Confidence: 0.75  Source: auto-capture


### [2026-08-21] Architecture decision — Stage 0.6 gets a first-class Gaps Report (corrected earlier stance)
User pushed back that a Gaps Report is important; I'd wrongly claimed our §10 + INFERRED tier already covered it. They're DISTINCT and all three now coexist in source-inventory-spec.md: (a) Feature Catalog = behaviours ASSERTED (with confidence tier); (b) §10 "Cannot Be Derived From Code" = intent ABSENT from code (NFRs/why/priorities, no file:line); (c) NEW §11 Gaps Report = code SEEN BUT UNRESOLVED statically (each file:line + gap type {ambiguous-intent / static-unresolvable config-or-flag / conflicting-paths / unreachable-looking} + resolution route + disposition). Without §11, seen-but-unresolved code either gets silently dropped (false completeness) or forced into the catalog as INFERRED (ambiguity masquerading as a stated behaviour). §11 is part of the Review Focus (must disposition) and is the golden-master worklist (gaps tagged "run the source" → reproduced → promoted to OBSERVED). Also folded extraction-craft from the compared behavior-spec-extraction skill: Given/When/Then behaviour detail with VERBATIM outcomes (exact status/error/threshold), mandatory happy+error/edge coverage, behaviour-bearing-code taxonomy + skip-list, "what not how". G/W/T required for INFERRED/high-risk/gap-adjacent, prose OK for OBSERVED/STATIC bulk. Migration skill v1.11→1.12. GOTCHA: three different honesty axes — absent-from-code (§10) vs seen-but-unresolved (§11) vs asserted-low-confidence (INFERRED).
Trigger: Architecture decision  Confidence: 0.80  Source: auto-capture

### [2026-08-21] Architecture decision — Python wired as a migration target (nodejs→python only)
Made Python a real, selectable migration TARGET, scoped to the one well-grounded pair `nodejs→python` (Node/Express→FastAPI — both dynamic/async/JSON-first, so real documented equivalences). Built 4 pieces: `references/stacks/python.md` (FastAPI idioms), `references/mappings/nodejs-python.md` (GREEN/YELLOW/RED parity incl. RED items: sync-call-blocks-loop, GIL≠cluster, streams, socket.io), Q1 matrix row (`nodejs` → "Python FastAPI"), and flipped `strategies/python.md` STATUS→implemented (⚠ unverified). Deliberately did NOT author java→python / dotnet→python or Python-as-source — bigger paradigm jumps; refused to ship a speculative parity table (unverified parity worse than none). target_token `python`→ stacks/python.md + strategies/python.md + mappings/nodejs-python.md. Updated honest-STOP message, README status table, both CLAUDE.md stack notes, CHANGELOG, migration doc 025. GATE-GUARD reminder: Stages 3–6 only run a profile whose STATUS is EXACTLY `implemented`. Could not runtime-verify FastAPI/Node commands (no live target) — flagged unverified throughout. validate 265/0/0.
Trigger: Architecture decision  Confidence: 0.75  Source: auto-capture


### [2026-08-21] Task completed — Java/Python execution profiles populated; STOP guard tightened
Filled `strategies/java-spring.md` (STATUS: implemented, ⚠ unverified) with full Maven/Spring tokens — this makes `.NET → Java` runnable end-to-end through Stages 3–6 (parity already exists bidirectionally in `mappings/java-dotnet.md`; Q1 has the `dotnet → Java` row; target_token `java`→`java-spring.md`). Filled `strategies/python.md` (FastAPI-oriented) but marked STATUS `profile-ready` — Python is NOT a selectable target yet: it has NO source→python parity mapping and NO Q1 matrix row; both must be added (and I won't fabricate a parity table) before flipping to `implemented`. Hardened the profile-load guard: SKILL.md now STOPs unless `STATUS` is EXACTLY `implemented` (so `not-implemented`/`profile-ready` both stop) — defense-in-depth beyond the Q1 gate. Could not runtime-verify the Java commands (no live Java target) — flagged unverified. validate 265/0/0.
Trigger: Task completed  Confidence: 0.75  Source: auto-capture


### [2026-08-21] Plan approved — Stage 0.6 Source Behavioral Inventory as a human review-gate before rewrite
Approved (after 2 critical iterations): add migration Stage 0.6 producing `ADO-{ID}-source-inventory.md` — a behavioral discovery doc (NOT a claimed requirements spec) that a human reviews/signs off BEFORE the rewrite. New spec `references/specs/source-inventory-spec.md`. Key review-gate refinements from the critique: (1) organized by cluster + a "Review Focus" triage that lists the subset a reviewer MUST disposition (all INFERRED business rules, RED-risk features, all human-only gaps); (2) per-item review status (Pending/Confirmed/Corrected/Rejected/Deferred) — `APPROVE INVENTORY ADO-{ID}` requires the triage subset dispositioned, not a blanket rubber-stamp; (3) records the SOURCE commit SHA as the review baseline (drift guard); (4) trust-first exec summary (coverage %, confidence split, #human-only-gaps up front); (5) confidence tiers OBSERVED/STATIC/INFERRED with provenance file:line; INFERRED never auto-promoted; (6) TWO verification moments — human@0.6 + golden-master@5.0 (latter only for externally-observable behavior; internal rules human-only); (7) boundaries: inventory=SOURCE as-is, Stage 1 architecture=TARGET to-be, Stage 2 feasibility CONSUMES the inventory (no re-scan); (8) depth+gate by posture — blocking for rewrite-from-spec, recommended re-arch, light/optional port; (9) PII: field names/shapes only, values masked (shareable doc); (10) traceability spine: feature IDs → architecture → acceptance/ADO tasks → golden-master. Placement: after Step 0.4, before Stage 1. Checkpoint schema 1.7→1.8 (inventory_approved). Keyword MIGRATE INVENTORY. Migration skill v1.10→1.11.
Trigger: Plan approved  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Error resolved — CONFIG pre-flight false-fails DB-less targets (migration Stage 6.2)
The `dotnet.md` CONFIG pre-flight hard-failed when `ConnectionStrings.DefaultConnection` was empty — but a DB-less API legitimately has no connection string, so it blocked E2E wrongly. Fix = made it DB-aware: skip (exit 0) when there is no dev config OR no `ConnectionStrings` section; fail (exit 1) only when a connection string is declared but empty/`{placeholder}`. Verified the node one-liner against 5 synthetic cases (dbless→skip, empty→fail, placeholder→fail, valid→pass, missing-file→skip) before shipping. Same DB-aware wording added to java-spring.md/python.md stub CONFIG notes. Lives in the profile (clean separation) — SKILL.md Step 6.2 just runs `profile CONFIG`.
Trigger: Error resolved  Confidence: 0.75  Source: auto-capture


### [2026-08-21] Error resolved — CONFIG pre-flight false-failed DB-less targets
The migration Step 6.2 E2E pre-flight (now the profile `CONFIG` token in strategies/dotnet.md) required `ConnectionStrings.DefaultConnection` to be non-empty → it hard-failed any target with NO datastore (DB-less API). Fixed with a DB-aware check: no dev config OR no `ConnectionStrings` section → skip cleanly (exit 0); a declared connection string that is empty/`{placeholder}` → fail (exit 1); populated → pass. Verified the node one-liner against 5 synthetic cases (dbless/empty/placeholder/valid/missing) before shipping. Aligned the java-spring.md/python.md stub CONFIG notes to the same "skip if no datastore" rule. Gotcha: this lived in dotnet.md (the profile) — the clean stack-agnostic split meant the fix went to the profile, not SKILL.md.
Trigger: Error resolved  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Error resolved — edge cases from the stack-agnostic migration refactor
Critical review of the `{profile TOKEN}` refactor found two real breakages I introduced + fixed: (F1) cluster-agent prompts and orchestrator bash blocks now contain `{profile BUILD}`/`{profile RULES}` etc., but the spawned cluster SUB-AGENTS don't load the execution profile and bash can't resolve `{profile …}` — a prompt/command handed off with an unresolved token would fail (or, in a `cp … || true` line, SILENTLY skip rule deploy). FIX = explicit "Resolution rule" in the Stage 3 preamble: the orchestrator MUST substitute every `{profile …}` to its concrete value before running/spawning, and in two-track use the backend profile for backend clusters + `angular` profile for FRONTEND clusters. (F2) `MIGRATE CLUSTERS` resume enters at Step 3.2, which is AFTER the new Stage-3 profile-load preamble — could skip it; FIX = the Step 3.0 CLUSTERS resume bullet now explicitly loads the profile. Verified no dangling tokens: `grep {profile [A-Z_]+}` unique vs `## TOKEN` headers in dotnet.md (only false-positive was the literal word "TOKEN" in prose). Two notation styles coexist by design: `{profile X}` = substitute-here, "profile \`X\`" = prose reference. Still-open minor/pre-existing edge cases (flagged, not fixed): CONFIG pre-flight assumes a DB connection string (false-fails DB-less apps); golden-master captures at 5.0 but replays after the 6.1 build (split across stages); no validate.js guard for profile-token drift. validate 265/0/0.
Trigger: Error resolved  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Architecture decision — full stack-agnostic migration: ALL .NET literals move to strategies/dotnet.md
Decision (user: "I want this clean — anything dotnet should be in dotnet strategy"): remove EVERY .NET literal from migration SKILL.md Stages 3–6 (skeleton layout, `dotnet build/test`, `Program.cs`/`appsettings.json`, `.sln`/`.csproj` FORBIDDEN set, coverage cmds, `appsettings.Development.json` config check, `dotnet run`/`ng serve`, NetArchTest, the AUTH/DB/ASYNC idiom examples, and the `STACK_RULE_MAP` rule-filename mapping) and replace with `{TOKEN}` references resolved from the loaded execution profile. Expanded the profile token contract (strategies/README.md) with: SKELETON (project structure to scaffold), STANDARDS_EXAMPLE (idiom examples for the ~20-line standards block), CONFIG (dev config file + placeholder pre-flight), RULES (guardrail rule files to deploy at 3.3a — replaces the inline STACK_RULE_MAP), and richer LAYOUT (shared/cluster/test paths); dotnet.md + angular.md fully populated, java-spring.md/python.md stubs list the tokens to fill. Also moved profile-load from Stage 4 to Stage 3 start (Step 3.0) since the skeleton is a Stage-3 artifact needing LAYOUT/COMPOSITION/BUILD — this also makes the not-implemented STOP fire at Stage 3 instead of failing ugly on `dotnet build` mid-Stage-3 (the root cause of the flagged inconsistency). Stage 4 keeps a re-load for fresh MIGRATE RESUME entry. Migration skill v1.9→1.10. Rejected: keeping the "reference profile + substitution banner" (leaves .NET inline — not clean).
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture


### [2026-08-21] Architecture decision — deploy migration guardrail rules at Step 3.3a (resolves A3)
Decision: fix A3 (guardrail rules only reached the target at /setup-init in Stage 6, AFTER Stage 4 code gen) by deploying `project-rules.md` + the target language rule into the target `.claude/rules/` at NEW Step 3.3a — right after the skeleton is approved, BEFORE Stage 4 — and committing them WITH the skeleton so every cluster branch (branched from that main SHA) inherits them. Because Stage 4 cluster agents are isolated SUB-AGENTS that only get their prompt (they don't auto-load `.claude/rules/`), the cluster-agent prompts (Step 4.2 + 4.3) now carry a GUARDRAILS section telling each agent to READ `.claude/rules/project-rules.md` + the target language rule first (explicitly noted as target rule files, exempt from the "don't reload reference files" rule). Token→rule-filename map mirrors `setup-init-bootstrap.cjs STACK_RULE_MAP` (dotnet→csharp-dotnet-rules.md, java→java-rules.md, angular→angular-rules.md, nodejs→nodejs-typescript-rules.md, python→python-rules.md; two-track deploys backend+frontend). Uses `cp -n` (never overwrites a developer-edited rule). `/setup-init` at Stage 6 stays (idempotent) to complete the full rule set + graph + arch docs. REJECTED: running full /setup-init early (it builds graph/arch on a partial skeleton — inappropriate); a new deploy-rules.cjs script (avoided a second stack→rules map / drift — the skill copies the rule file it already resolves at Stage 0). Migration skill v1.8→1.9. Verified all 6 rule source files exist in _project-deploy/rules/.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture


### [2026-08-21] Task completed — activated inert scenario assertions + runner.js model fix
Converted inline `contains:`/`not_contains:` arrays to block form across `tests/skill-scenarios/` — a `node` transform (JSON.parse the inline array → indented `- "x"` list, content unchanged) touched 91 arrays in 10 files (the other ~30 files were already block form, correcting my earlier "most are inline" assumption). Result: 233 of 236 scenarios now have LIVE assertions (previously the 91 inline ones were silently no-ops under runner.js's parser). Also changed `tests/runner.js` hardcoded model `claude-sonnet-4-20250514` → `process.env.REVIEW_MODEL || "claude-sonnet-4-6"`. validate.js still 265/0/0. CAVEAT: activating assertions means the next real `runner.js` run (needs ANTHROPIC_API_KEY) may surface genuine failures to iterate on — could not run here (no key).
Trigger: Task completed  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Task completed — migration.yaml test scenario + runner.js harness gotchas
Authored `tests/skill-scenarios/migration.yaml` (5 stateless scenarios for the migration skill: trigger collects SOURCE path, no code before gates, options-analysis-before-lock, honest-STOP on unsupported source, run-from-target). TWO harness gotchas: (1) `tests/runner.js` requires `ANTHROPIC_API_KEY` and makes LIVE API calls (model hardcoded `claude-sonnet-4-20250514`) — it cannot run without a key, so behaviour tests are NOT part of `validate.js` (structural, offline). (2) runner's minimal YAML parser ONLY captures BLOCK-form `contains:`/`not_contains:` (indented `- "x"` lines) — INLINE arrays like `contains: ["A","B"]` are silently dropped. Consequence: most existing scenario files (e.g. icea-feature.yaml) use inline arrays, so their contains/not_contains assertions are NO-OPS — those scenarios effectively only assert `triggered` (response ≥50 chars). New/edited scenarios MUST use block form to actually assert. Matching is case-insensitive substring. Verified migration.yaml parses correctly by replicating parseYaml. Could NOT execute runner.js here (no API key) — behaviour pass/fail unverified; run `ANTHROPIC_API_KEY=... node tests/runner.js --skill migration` to execute.
Trigger: Task completed  Confidence: 0.80  Source: auto-capture


### [2026-08-21] Error resolved — half-registered migration command + target_token/profile mismatch (3-iteration validation)
Validating the session's migration changes found 3 real issues I introduced: (1) adding `migration` to `plugin.json components.commands` while NO root `commands/migration.md` existed (all 38 others do) = half-registration — validate.js does NOT check components↔file coverage so it was uncaught; FIX = created root `commands/migration.md` in the rich stub convention (frontmatter description+argument-hint, Model routing, body, Hard Rules). (2) Stage 4 profile-load used `strategies/{target_token}.md` but `target_token`→filename normalization was undefined and could wrongly STOP a .NET run; FIX = added explicit mapping note (dotnet→dotnet.md, java→java-spring.md, nodejs→nodejs-express.md, angular→angular.md, python→python.md — same convention as `references/stacks/`; two-track loads backend + frontend `angular`). (3) Stage 0.3 said "set options_approved=true" before the checkpoint exists (written at 0.4); FIX = reworded to "persisted at the Step 0.4 write". KEY INSIGHT: `scripts/deploy-commands.cjs` deploys command stubs by reading the `_project-deploy/commands/` DIRECTORY (readdirSync), NOT `plugin.json components.commands` — so migration was already deploying to targets; components.commands is manifest/discovery, not the deploy driver. Checkpoint 1.6→1.7 is safe (options_approved is set-only, never a downstream gate; legacy threshold stays <1.6). After fixes: validate.js 265/0/0, manifest coverage clean, drift guard green. Behavior tests (runner.js) + a migration test scenario still not run/authored (pre-existing gap).
Trigger: Error resolved  Confidence: 0.85  Source: auto-capture


### [2026-08-21] Architecture decision — pluggable target execution profiles for migration Stage 4/5/6 (resolves A2)
Decision: resolve the .NET-hardcoding of migration Stage 4 (build/merge), Stage 5 (test/coverage/E2E) and Stage 6 (run/verify) by extracting the stack-specific commands/paths into per-target **execution profiles** at `skills/migration/references/strategies/{target-token}.md`, loaded at Stage 4 start from `checkpoint.mode.target_token` (two-track loads BOTH a backend and a frontend profile). KEY INSIGHT: execution is a function of the TARGET alone (source is read-only), so profiles are target-keyed → O(n), NOT source×target like the parity mappings (which stay in references/mappings/). Orchestration (tier compute, branch-per-cluster, --no-ff merge, agent spawn, gates, checkpoint, golden-master) stays stack-agnostic in SKILL.md; only literal commands/paths move to the profile (BUILD/TEST/COVERAGE/LAYOUT/COMPOSITION/BUILD_UNIT(forbidden set)/PKG_ADD/SERVE+health/E2E/FITNESS). Ship dotnet.md + angular.md fully (zero behavior change for .NET), java-spring.md + python.md as honest-STOP stubs (missing profile → STOP, same pattern as unmapped-source refusal), plus strategies/README.md documenting the token contract. Rejected: fully implementing Java now (unverified, higher risk); ADR-only (defers the fix). Folded into the uncommitted 3.14.0 release; migration SKILL.md v1.7→1.8. New hard rule: never run a target's toolchain without its execution profile.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture


### [2026-08-21] Task completed — v3.14.0 release: guide/doc refresh + model-default blast-radius + migration registration gap
Completed the 3.14.0 release pass. GOTCHA (model default): changing the generation-tier default in `skills/shared/model-routing-spec.md` (opus-4-6→4-8) is NOT localised — the string `claude-opus-4-6` was documented as the default in ~34 more files (README, DEVELOPER-GUIDE, WHITEPAPER, `.claude/architecture/architecture-{api,reference}.md`, every command stub's override-example line, many SKILL.md model-routing notes, `plugin.json` `recommended_models.generation`, both HTML guides' body + tables, and the `new-skill.sh`/`new-command.sh` scaffolding templates). A default bump needs a repo-wide `claude-opus-4-6`→`claude-opus-4-8` sweep (42 occurrences/34 files) + `plugin.json recommended_models` (generation + last_reviewed) + guide `<!-- documents-plugin-version -->` stamps + visible vX.Y.Z badges. Leave CHANGELOG's transition line and the `opus-4-7` "test a new model" example untouched. GOTCHA (registration): the `migration` skill+command were NOT in `plugin.json components.skills/commands` — so setup-init never deployed the migration command stub; now registered in both. HTML guides (user-guide.html, plugin-guide.html) had NO migration coverage at all and stale version stamps (3.9.0 / 3.12.0) — both fixed and given a migration card/row. `tests/validate.js` (265 structural checks) is the release gate — it passed. `node scripts/bump-version.js X.Y.Z` only touches plugin.json + root CLAUDE.md label + CHANGELOG stub; everything above is manual.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture


### [2026-08-21] Task completed — migration skill v1.7 upgrade applied (Sets A/B/C) + version-bump convention learned
Applied all edits: 2 new specs (target-options-spec.md, golden-master-spec.md), SKILL.md v1.6→1.7 (Stage 0.5, Stage 5.0, coverage measurement, contract-hash impl + Step 4.3a gate, honest STOP, model opus-4-6→4-8, schema 1.6→1.7 w/ options_approved, hard rules), both CLAUDE.md (MIGRATE OPTIONS + stack-subset note), model-routing-spec.md v1.3→1.4 (generation default opus-4-6→4-8). VERSIONING CONVENTION: `.claude-plugin/plugin.json` "version" is the SINGLE SOURCE OF TRUTH; `node scripts/bump-version.js X.Y.Z` propagates ONLY to root CLAUDE.md `# Plugin version:` label + prepends a CHANGELOG.md stub + runs check-version-consistency.js (drift guard checks root CLAUDE.md label matches + marketplace.json carries NO version). NOT auto-bumped (must hand-edit): `_project-deploy/CLAUDE.md` `# Plugin version:` line, README.md version banner, the two HTML guide `<!-- documents-plugin-version -->` stamps (warn-only; already stale at 3.9.0/3.12.0), and a new `docs/migrations/NNN-X.Y.Z.md` doc for setup-sync. `.claude/_bootstrap-manifest.json` version is runtime install-cache state — never hand-edit.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture


### [2026-08-21] Plan approved — migration skill upgrade: Target Options Analysis + Golden-Master + enforcement fixes
Approved 3 sets (A,B,C incl. C4). SET A: new Stage 0.5 "Target Options Analysis" (new spec references/specs/target-options-spec.md) that runs AFTER source analysis but BEFORE Q1 — recommends 2-3 scored target candidates + migration posture (port/re-arch/rewrite-from-spec) + ROM as an ADR; Q1 now CONFIRMS the recommendation instead of a cold menu pick; gated by APPROVE OPTIONS ADO-{ID}; skipped for pure `dotnet` version upgrades. SET B: new Stage 5.0 "Golden-Master Behavioral Verification" (new spec references/specs/golden-master-spec.md) — records request→response oracle from the RUNNING source, replays against target, diffs normalized responses; degrades to INFERRED characterization tests (logged) when source can't run; blocks MIGRATION COMPLETE on unexplained HIGH-risk drift. SET C fixes: C1 wire real coverage measurement (coverlet+reportgenerator) into Stage 5.2 thresholds; C2 implement contract_hash (sha256 of integration-contract file into checkpoint) + new Step 4.3a FRONTEND contract-hash gate — fixes the previously-unimplemented "ALWAYS check contract hash" hard rule; C3 honest support-matrix STOP message (Python/React-target listed as stacks but have NO migration mapping refs — refuse rather than fabricate a parity table); C4 model routing opus-4-6→opus-4-8 (plugin-wide model-routing-spec.md + SKILL.md fallbacks). Checkpoint schema bumped 1.6→1.7 (adds stage_gates.options_approved). Audit found but DEFERRED (bigger than "small fixes"): A2 Stage 4/5/6 are hardcoded to .NET (dotnet build/test, src/Shared/, .sln) so Java/Angular targets execute the wrong toolchain + Angular FRONTEND track has no ng build/test path; A3 stack anti-pattern guardrails defer to rules/{stack}-rules.md which aren't deployed until /setup-init runs at the END (after code gen).
Trigger: Plan approved  Confidence: 0.80  Source: auto-capture


### [2026-08-04] Task completed — _project-deploy/CLAUDE.md split implemented (bootstrap + validate.js)
Created _project-deploy/CLAUDE.md as explicit deployment template source (copied from root CLAUDE.md, added header). Updated setup-init-bootstrap.cjs to read _project-deploy/CLAUDE.md first (falls back to root CLAUDE.md for older installs). Updated tests/validate.js with 6 new checks for the deployment template. bump-version.js and check-version-consistency.js blocked by icea-floor hook — diffs provided for manual apply. Gotcha: changes to dev source SKILL.md do NOT auto-propagate to installed plugin cache — always patch the installed path too.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-08-04] Error resolved — VSTO architect templates missing 3 files from v3.8.0 doc-set expansion
VSTO template dir has 5 files; 3 added in the 4→8 expansion (2026-07-10) are missing: architecture-data.md, architecture-integrations.md, architecture-decisions.md. Root cause: VSTO was added on 2026-07-17 AFTER the expansion, so new shared files were never given VSTO-specific overrides. _shared/ fallbacks are web/DB-centric (wrong for VSTO's Office COM model). Fix: create vsto-specific overrides for data and integrations; decisions can inherit from _shared unchanged. Also: _project-deploy/CLAUDE.md supported stacks comment was missing VSTO.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### [2026-08-04] Plan approved — _project-deploy/CLAUDE.md as explicit deployment template
Split root CLAUDE.md (plugin dev-session config) from _project-deploy/CLAUDE.md (pure template for target projects). Only one code change required: setup-init-bootstrap.cjs line 1404 reads `_project-deploy/CLAUDE.md` instead of root CLAUDE.md. bump-version.js and check-version-consistency.js must also stamp/check both files. validate.js gets a _project-deploy/CLAUDE.md check. Root CLAUDE.md stays intact for tests, bump-version, and plugin dev sessions.
Trigger: Plan approved  Confidence: 0.90  Source: auto-capture

### [2026-08-04] Task completed — §0a cross-session recovery handler bug fixed across all target projects + bootstrap self-heal
Fixed PLAN/ICEA/TECH §0a handlers in all 7 discovered target project CLAUDE.md files (ERISATracker, KE.KirklandData, TIPTTSATracker, KE.Web, installed plugin cache). KE.KirklandData had oldest SAVE ICEA/TECH format — those were also updated to current. Added `repairRecoveryHandlers()` to setup-init-bootstrap.cjs so future `/setup-sync` runs auto-fix any remaining old handlers. Also fixed icea-status SKILL.md display text lines 107-108. setup-sync does NOT update existing CLAUDE.md sections — only appends missing ones; the repair function is needed to override this limitation.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-08-04] Architecture decision — _project-deploy/CLAUDE.md proposal: separate deployment template from plugin project config
Current root CLAUDE.md serves dual purpose: plugin dev session config AND deployment template. Proposed split: _project-deploy/CLAUDE.md = pure template with all {ADO_ORG}/{STACK} placeholders (bootstrap reads from here), root CLAUDE.md = plugin project config only. Complication: plugin dev sessions also need Write Gate/§0a/§0b which are in both files. Main trade-off: dual-maintenance when changing deployable sections vs clarity gain (explicit contract of what target projects receive). Decision: implement after full audit of all files referencing root CLAUDE.md.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### [2026-08-03] Task completed — icea-feature EPIC flow bugs fixed across plugin source + installed copy + KE.Web
Fixed four locations: (1) plugin source CLAUDE.md §0a + SKILL.md (Hard Rule 1277, Hard Rule 1301, TEMP_WRITE_EXEMPT); (2) installed plugin cache at 3.13.0 (same three SKILL.md fixes — the copy all target projects actually read); (3) KE.Web CLAUDE.md §0a + updated SAVE ICEA/TECH rows to current plugin version. Gotcha: fixes to the dev source repo do NOT automatically propagate to the installed plugin cache — changes must be applied to BOTH the source AND the installed path at `C:\Users\rawatv\.claude\plugins\cache\KirklandAndEllis-marketplace\ai-assisted-development\{version}\`. Always check the installed copy after fixing plugin source files.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-08-03] Error resolved — Three bugs in icea-feature EPIC flow: CLAUDE.md §0a + TEMP_WRITE_EXEMPT + Hard Rule
Bug 1 (Critical/root cause): CLAUDE.md §0a keyword handlers for `PLAN/ICEA/TECH ADO-{ID}` only said "Draft…cross-session recovery" — unlike APPROVE/IMPLEMENT which say "Run icea-X skill", these handlers didn't invoke the icea-feature skill or read its SKILL.md, so the EPIC branch sizing check was never executed inline. Fix: change Action column to "Invoke icea-feature skill — cross-session recovery entry at Step 5/8". Bug 2 (High): SKILL.md TEMP_WRITE_EXEMPT section (lines 1336-1340) said story specs go "directly to permanent location without temp staging" — contradicting Step 8 (writes to temp/) and Step 10 Epic Save (cp from temp/ to permanent). Fix: remove incorrect claim, correctly describe temp/ → permanent flow. Bug 3 (Medium): Hard Rule "NEVER generate story specs before the epic-level spec is saved via SAVE TECH" conflicts with Step 8 which generates stories to temp/ BEFORE SAVE TECH. Fix: reword to "before the epic-level spec DRAFT is complete and written to temp/ in Step 8". All three fixes applied to CLAUDE.md §0a and skills/icea-feature/SKILL.md.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### [2026-07-29] Architecture decision — Epic story spec generation moved to pre-SAVE (temp/ staging)
The previous Epic flow generated story specs AFTER SAVE TECH (auto-chaining), meaning the developer approved a thin epic-level spec and stories materialized on disk without review. Fixed: Step 8 now generates ALL story specs and a tracker draft and writes them to `temp/ADO-{ID}-Story-{N}-tech.md` + `temp/ADO-{ID}-tracker.md`. SAVE TECH performs one atomic move of all temp files to permanent. The developer reviews the complete package (epic spec + all story specs) in VS Code before committing anything. Step 10 "Epic Chaining" section replaced by "Epic Save" (atomic move) + RESUME-only recovery path.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### [2026-07-27] Error resolved — icea-feature Step 8 PLUGIN_DIR resolved too late
`$PLUGIN_DIR` was used at line 562 (context budget check) and line 655 (overlay `ls` verification) but only resolved at line 672. The `ls` check ran with an empty `$PLUGIN_DIR`, looking in the target project directory instead of the plugin — causing the OVERLAY NOT FOUND error with a bare relative path. Fix: moved PLUGIN_DIR resolution (read `plugin-path.txt` + §1a resolver fallback) to immediately after the ICEA gate passes, before any `$PLUGIN_DIR` reference. Also fixed error message to show `$PLUGIN_DIR/skills/...` path. Skills load from plugin dir at runtime — no setup-sync needed for existing projects.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### [2026-07-27] Error resolved — context-budget-tech-write hook not deployed to target projects
The hook existed only in the plugin repo's `.claude/hooks/` — never in `_project-deploy/hooks/` or wired by `setup-init-bootstrap.cjs`. Claude Code only loads hooks from the CURRENT project, so all three gates (placeholder count, minLines, required sections) were dead for real user workflows. Fix: added hook to `HOOK_FILES`, wired as `PreToolUse Write` in `stepWireSettings()`, copied to `_project-deploy/hooks/`, stamped `.hashes`. Existing target projects need `/setup-sync`.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### [2026-07-27] Error resolved — context-budget-tech-write.cjs sparse-stub bypass
When context exhausts before the model reads the tech spec template, it generates a one-line summary with 0 unfilled `{…}` placeholders — `0 ≤ threshold (15)` passed Gate 1 and the stub was written to disk. Fix: added Gate 2 (`minLines`) — blocks writes where non-empty line count is below threshold (50 for tech specs, 30 for ICEA, 20 for arch docs). Force flag still bypasses both gates. `context-budget-tech-write.cjs` is a plugin-internal hook only (not in `_project-deploy/hooks/`, not tracked in `.hashes`) — only one copy to update.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### [2026-07-27] Task completed — setup-teardown preserves architecture and graph directories
Removed `.claude/architecture/` and `.claude/graph/` from the `--full` scope in `scripts/setup-teardown.cjs`. These directories are now emitted as "preserved" warnings instead of removal items — they are never deleted during any teardown scope. Only `temp/` is removed in the extra-full-targets block. Updated descriptions in `commands/setup-teardown.md` and `_project-deploy/commands/setup-teardown.md` to document this invariant.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-07-20] Error resolved — architect skill missing diagram sections in generated architecture.md
Root cause: Step 1b used `cat .claude/plugin-path.txt 2>/dev/null` to resolve PLUGIN_DIR. If plugin-path.txt is absent/stale, PLUGIN_DIR is empty; `2>/dev/null` swallows the bootstrap failure silently; Step 5 then generates architecture.md without the File 1 prompt (no Mermaid diagram instructions) → End-to-End Architecture and Layered View sections missing entirely.
Fix: Step 1b replaced with node-e registry cross-reference (same pattern as setup-sync/dream-sync Step 1) that reads installed_plugins.json authoritatively, self-heals plugin-path.txt, and fails loudly on error. Step 3 guard replaced with node-e three-signal detector (TEMPLATE marker + scaffold tokens + missing diagram headings). Step 4 adds PLUGIN_DIR + prompt file validation before Step 5 runs.
Gotcha: `2>/dev/null` silently swallowing bootstrap failure is a class of bug to watch for in all skill files that call bootstrap — never suppress errors in critical path calls.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### [2026-07-20] Error resolved — autoMemoryEnabled not added to settings.json on re-run
`stepWireSettings` had an `isDone` guard that caused the entire function to skip on setup-init resume. If `settings.json` was modified externally between runs (VS Code, Claude Code writing defaults, manual edit), `autoMemoryEnabled: false` would be missing from the output. Root cause: `isDone(manifest, 'wireSettings')` returned `true` on resume, skipping the check at `if (settings.autoMemoryEnabled === undefined)`. Fix: removed the `isDone` guard — function is fully idempotent (hooks use `some()` before adding, all other assignments check before setting) so it is safe to re-run every time. Gotcha: never guard idempotent settings steps with `isDone`; `isDone` is only appropriate for non-idempotent one-shot operations.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### [2026-07-17] Plan approved — VSTO stack support for AI-Assisted-Development plugin
Adding VSTO (Visual Studio Tools for Office) as a supported stack: 12 files modified + 14 files created covering stack detection, architect templates, coding rules, code review, security, app readiness, dynamic scan graceful exit, and tech spec overlay. Key gotcha: VSTO csproj lacks System.Web/System.ServiceModel so external-stack-detection.cjs must explicitly force dotnet_framework when VSTO markers found; and csharp-dotnet-rules.md must exclude VSTO fingerprint files or modern .NET rules wrongly deploy. Tech spec overlay selection must check for vsto token BEFORE the generic dotnet_framework row or the wrong ASP.NET MVC overlay fires.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-07-17] Error resolved — install.ps1 parse failure from UTF-8 em dash encoding
install.ps1 contained em dashes (`—`, U+2014) in double-quoted strings inside switch blocks. Windows PowerShell 5.x reads UTF-8-without-BOM scripts as the system code page (Windows-1252); the em dash bytes `E2 80 94` decode as `â€"`, where `0x94` = RIGHT DOUBLE QUOTATION MARK (`"`), which PowerShell 5.x treats as a valid string terminator — premature string close inside the switch case corrupts the block syntax. Fix: replace all `—` with `-` (plain ASCII) throughout the file. Gotcha: any non-ASCII punctuation in PS5 scripts saved without BOM (default for git/VS Code) can trigger the same class of parser error — use only ASCII in PowerShell strings on Windows.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### [2026-07-17] Task completed — Multi-agent code review plan Rounds 5 & 6 critic (11 issues)
Round 5 (8 issues): N4 fixed to merge-base diff (not HEAD); N11 excludes Candidates from ledger; N12 capped tracer confidence at 0.89 (later superseded by Round 6 N14); N13 fixed with file-existence check (later improved by N15 mtime comparison). Round 6 (3 issues): N14 replaced unconditional cap with _source:'tracer' tag in deduplicateBySinkLocation — collision-only fingerprint anchoring, full confidence preserved for non-colliding tracer findings. N15 replaced file-existence with pre/post mtime comparison. N16 added contentHash cache-buster to buildPass1Prompt — converts N9 staleness footgun into solved problem.
Trigger: Task completed  Confidence: 0.70  Source: auto-capture

### [2026-07-17] Architecture decision — _source tag approach for tracer fingerprint stability
Tracer upgrade findings are tagged `_source: 'tracer'` at push time. `deduplicateBySinkLocation` uses this to always anchor collisions on the Pass 1 (sink-side) fingerprint, ensuring ledger continuity. Confidence uses `Math.max` — highest confidence wins regardless of which fingerprint is the anchor. This is strictly better than the Round 5 cap approach (which silently understated confidence for all tracer findings, not just collision cases).
Trigger: Architecture decision  Confidence: 0.70  Source: auto-capture

### [2026-07-17] Task completed — Multi-agent code review plan Round 4 critic (8 issues)
Round 4 incorporated 7 of 8 issues into the plan. N1 (failed suspects vanish from Candidates): push untraced/deferred suspects into allFindings at confidence=0.30 — they appear in report Candidates. N2 (duplicate findings): added `deduplicateBySinkLocation()` secondary dedup by (file:line:checker). N4 (--changed mode missing file diff): git diff in Step 0b, changedFiles arg, module filtering in Section G. N5 (candidates/conflicted uncapped): added 50-item caps matching confirmed pattern. N6 (retired checkers loop forever): RETIRED_CHECKERS constant + Rule 3B check. N7 (HAIKU_MODEL literal string): fixed to `${HAIKU_MODEL:-claude-haiku-4-5-20251001}`. N8 (checkpoint never cleared): write "COMPLETED" marker on success, check for it before resume. N3 was a false alarm — Workflow resumeFromRunId memoizes agent() calls transparently at runtime.
Trigger: Task completed  Confidence: 0.70  Source: auto-capture

### [2026-07-17] Architecture decision — Secondary dedup by sink location in multi-agent code review
`deduplicateBySinkLocation()` performs a second dedup pass keyed on `(file:line:checker)` after fingerprint dedup. Required because tracer confirmed findings use entry-side fingerprints while intra-module Pass 1 findings use sink-side fingerprints — the same physical code defect gets two different fingerprints by design. Merge strategy: keep higher confidence, union callers, prefer dataFlow with confirmed steps.
Trigger: Architecture decision  Confidence: 0.70  Source: auto-capture

### [2026-07-16] Architecture decision — "Coverity-style" replaced with "SAST" throughout
"Coverity-style" was a proprietary brand name that overstated precision (this is LLM-based, not a formal program analysis engine) and was unfamiliar to most developers. "SAST" (Static Application Security Testing) is the correct industry-standard term, consistent with the existing persona `[SAST] Wen Li`. The methodology (inter-procedural, path-sensitive, event path format, fingerprint dedup) is preserved — only the branding changed. Updated: `docs/plans/multi-agent-code-review-with-graph.md` and implementation plan file.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### [2026-07-16] Approach abandoned — area-scoped single-agent approach (code-review context exhaustion)
Single-agent approaches (area-scoped, file-budget-capped, or scope-limited runs) cannot solve the vulnerability coverage problem — they exhaust context window and miss cross-module taints. Direct path: multi-agent Workflow with parallel per-module agents + Phase 2.5 taint tracer + personas + adversarial. Area-scoped was previously documented as an "immediate fix" but is now rejected. Implement multi-agent directly (Phase 1 = Workflow; Phase 2 = LangGraph future). DO NOT revisit area-scoped.
Trigger: Approach abandoned  Confidence: 0.95  Source: architectural review

### [2026-07-16] Architecture decision — Adversarial pass (Pass 3) unified skip logic
Single skip check applies to all modes: skip if scoped modules have no security-critical contact (direct or graph-neighbor). PR mode adds: ICEA keyword check + conservative fallbacks (no ICEA = run). Unconfigured codebase (empty security-critical list) always runs. Full scan always runs in practice (all modules in scope). `--force-pass3` overrides. Never `--skip-pass3`.
Trigger: Architecture decision  Confidence: 0.95  Source: refined from mode-specific to unified logic

### [2026-07-16] Architecture decision — Phase checkpoints for incremental visibility and resume
Orchestrator writes checkpoint JSON after each phase (.code-review/checkpoint-{phase}.json) and rewrites partial.html with phase status. Developer refreshes browser to see live progress. Checkpoint JSON enables --continue to resume from last completed phase after timeout or failure.
Trigger: Architecture decision  Confidence: 0.90  Source: streaming gap identified in plan review

### [2026-07-16] Architecture decision — Multi-agent code review with graph-based context
Phase 2.5 taint tracer (confirmed at 0.85 confidence) + per-module Pass 1 agents (0.95 intra, 0.30 graph-inferred) + three-persona Pass 2 + mandatory holistic adversarial Pass 3. Taint tracer caps at 50 agents per run; chains >5 modules truncate to entry+sink+3 hops. Cross-module findings never silently dropped — <0.50 confidence surfaces as Candidates.
Trigger: Plan approved  Confidence: 0.95  Source: detailed design review of 17 critical gaps

### [2026-07-16] Architecture decision — Orchestrator decoupling (Workflow + LangGraph future)
All prompts, schema, dedup, report logic live in `shared/` modules. Workflow (Claude Code interactive) and LangGraph (CI/CD headless, future) are thin runners that import the same logic. No duplication. Selection via `CODE_REVIEW_ORCHESTRATOR=workflow|langgraph` env var. LangGraph implementation (Phase 3) must follow Workflow stabilization (Phase 2) and shared module extraction.
Trigger: Architecture decision  Confidence: 0.90  Source: decoupling strategy to avoid maintaining two runners

### [2026-07-16] Error resolved — 30% recovery rate (taint tracer confirms vs. suspects)
Initial architecture gave taint finding only 30% confidence (suspected, from graph). Phase 2.5 taint tracer receives actual call-chain source files and produces 0.85-confident confirmed findings. Suspected taints stay at 0.30 (graph-inferred) until tracer processes them. Findings <0.50 are "Candidates" not confirmed issues. Developer never sees unvalidated findings as findings.
Trigger: Error resolved  Confidence: 0.95  Source: critical gap #1 in design review

### [2026-07-16] Approach abandoned — code-review progress markers (LLM state tracking unreliable)
Attempted to add 7 progress marker instructions to code-review SKILL.md so developers see heartbeat output during long scans. Critical flaw: relies on LLM to reliably track state (file counters, finding counts, per-batch timing) across iterations. Practice shows this fails 70-80% of the time — LLM either forgets to emit, emits at wrong moments, or produces wrong counts. The real problem wasn't "no progress during scan" but "silent context exhaustion on large codebases." Do not retry progress markers; they are brittle and do not prevent the actual crash. Root fix is file-count guard + area-scoped accumulation (see architecture decision below).
Trigger: Approach abandoned  Confidence: 0.85  Source: critical flaw analysis

### [2026-07-16] Architecture decision — area-scoped accumulation for large-scan context exhaustion (v3.13.0)
Code-review skill crashes silently on large codebases (300+ files) by exhausting context window. Two approaches considered: (A) multi-agent Workflow with graph+architecture context (solves long-term, requires Workflow infrastructure), (B) file-count guard + area-scoped runs (solves immediately, uses proven infrastructure). Chose (B) as pragmatic fix: add bash file count in Step 0g, if > 100 files on `--full` emit warning with 3-area plan (frontend, backend, config). Findings accumulate in ledger via existing FP-fingerprint deduplication. Cost: modest bash+markdown (~20 lines). Benefit: prevents crash, gives developer clear action plan. Multi-agent approach saved to `docs/plans/multi-agent-code-review-with-graph.md` as future roadmap. Remove 7 progress markers added earlier (unreliable LLM state tracking). Files: skills/code-review/SKILL.md (Step 0g-guard + cleanup).
Trigger: Architecture decision  Confidence: 0.90  Source: critical analysis + user conversation

### [2026-07-16] Task completed — code-review skill progress markers
Added seven progress marker instructions to `skills/code-review/SKILL.md` to eliminate silent periods during multi-pass scans. Developers now see heartbeat output at each pass boundary and every 10 files during Pass 1, matching existing plugin conventions (boxed headers with pass/file counts, emoji status lines, per-batch counting). No changes to shared specs — progress output is a UX concern, not an architectural one. Implementation: 7 insertions at section boundaries (Pass 1/2/3 headers + completions + per-batch counter). Ready for skill testing.
Trigger: Task completed  Confidence: 0.95  Source: implementation complete

### [2026-07-14] Plan approved — dream memory confidence + dream-log + age-aware scoring
Three-part fix: (1) concrete multi-field format in memory-capture.sh so Claude writes
`Confidence: 0.70` reliably (abstract template was being ignored); (2) new memory-log.sh
PostToolUse hook that deterministically appends `### [capture]` entries to dream-log.md on
every MEMORY.md Write/Edit — Edit extracts from new_string (all new headers), Write takes
last header; CRLF + Windows path normalization throughout; (3) age-aware bonus in
commands/dream.md Phase 2 — entries with no Confidence field get +0.00/+0.05/+0.10/+0.15
based on days since header date, capped at 0.85. First-time gate: presence of `Confidence:`
field (no dream-log.md parsing). Key risks resolved: no `< /dev/stdin`, `.replace(/\\/g,"/")`,
date parse failure defaults to +0.00, dream skill skips `### [capture]` lines when finding
last dream run. Verify 260✓/0✗.
Trigger: Plan approved  Confidence: 0.70  Source: auto-capture

### [2026-07-13] Plan approved — icea-feature graph orientation fix
Two-part fix for icea-feature skipping graph orientation and scanning source files:
1. Enrich `graph-index.md` with a Module Summaries section (bounded context + key files per module inline) so the always-loaded file provides bounded context without requiring a second detail-file read.
2. Add a required `ORIENTATION: <module> (domain: <domain>) — <bounded context>` output line at the start of icea-feature Step 1, making orientation verifiable.
Schema ceiling raised 350 → 1,500 tokens. Files: `skills/shared/graph-index-schema.md`, `skills/graph-sync/SKILL.md` (Step 8c), `skills/icea-feature/SKILL.md` (orientation step 2 + Step 1). graph-index.md regenerated in-session from 32 existing detail files. Cache copies updated.

### [2026-07-13] Task completed — prod-readiness/ exempted from icea-floor.sh
`/plugin-readiness` and `/app-readiness` write HTML reports to `prod-readiness/` — these were blocked by the ICEA floor hook because `*.html` is a guarded extension.
Fix: added `*/prod-readiness/*|prod-readiness/*` to the exemption `case` clause in all three copies of the hook:
- `.claude/hooks/icea-floor.sh` (active)
- `_project-deploy/hooks/icea-floor.sh` (deployment template)
- `hooks/icea-floor.sh` (older root-level copy — lacked plugin-guide.html carve-out; added prod-readiness only)
validate.js stays 259✓/0✗.

### [2026-07-13] Task completed — README version updated + plugin-path.txt corrected
README.md line 5 said "Version 3.5.0"; updated to "Version 3.12.0" (current installed version).
`.claude/plugin-path.txt` pointed to old dev source path (`c:/Users/rawatv/source/repos/ai-assisted-development`);
updated to current installed path (`C:/Users/rawatv/.claude/plugins/cache/KirklandAndEllis-marketplace/ai-assisted-development/3.12.0`).
**Gotcha:** plugin-path.txt goes stale when the plugin is reinstalled/upgraded from source to marketplace install.
Re-check and update it if architect or graph-sync fail to find the plugin dir.

### [2026-07-13] Task completed — stepWireUserSettings() added to bootstrap (autoMemoryEnabled fix)
Added `stepWireUserSettings()` to `scripts/setup-init-bootstrap.cjs`. Runs after `stepWireSettings()`
in both init and sync mode (not guarded by isDone). Writes `autoMemoryEnabled: false` to
`~/.claude/settings.json` (user-level) only when the key is undefined; respects existing values.
Failure appends to `manifest.warnings[]` which `printSummary()` already surfaces.
Also added `const os = require('os')` to imports. validate.js 259✓/0✗. `node --check` clean.

Gotcha: validate.js running via background bash tasks returned empty output files — use
`node <path> 2>&1 | tail -N` and watch for the task completion summary "exit code 0" instead.

### [2026-07-13] Plan approved — fix autoMemoryEnabled via user-level settings write
Root cause: `autoMemoryEnabled: false` in project `.claude/settings.json` does NOT suppress
Claude Code's built-in auto-memory (evidence: `# auto memory` context still injected in session).
The env-var approach (`env` block) also rejected — only affects child processes, not CC startup.
Fix: bootstrap `stepWireUserSettings()` writes `autoMemoryEnabled: false` to `~/.claude/settings.json`
(user-level) during both init and sync. If write fails → adds to `manifest.warnings[]` → surfaced
in setup-init Step 4 summary with manual fix instructions. Keep project-level setting as defence-in-depth.
Files: `scripts/setup-init-bootstrap.cjs` only (+ migration note). No skill SKILL.md changes needed.

### [2026-07-13] Task completed — setup-init fully executed for plugin repo (architecture + graph)
setup-init was resumed from manifest (steps 1-3 already done). Completed steps 4-6:
- 8 architecture docs populated under .claude/architecture/ (js-library stack, repo=ai-assisted-development plugin)
- Knowledge graph built: 32 modules, domain structure, 14 INFERRED edges, graph-extract-edges.js added 0 EXTRACTED (expected — skills are markdown, no import statements)
- Deployment doc approved and written (local plugin, no CI/CD, no auth, AZURE_DEVOPS_PAT only)
- plugin-path.txt corrected to v3.12.0 installed path

### [2026-07-13] Task completed — graph-viz generated graph.html (32 modules, 4 hubs)
graph.html written to .claude/graph/graph.html (19KB). Pattern that worked: write a CJS
script to /c/tmp/ via the Write tool, then run it with `node /c/tmp/<script>.cjs`. This
avoids all bash quote/backtick issues when embedding large JSON into HTML. The script reads
graph.json via fs.readFileSync and interpolates it into the template string.
Note: /c/tmp/ in Git-bash = C:\tmp (Write tool path). These scratch scripts are safe to
leave there; they don't affect the project.

### [2026-07-20] Error resolved — detectShell() missed Claude Code settings Bash denial
detectShell() used spawnSync to test OS-level bash availability, but Claude Code has its own permission layer: if 'Bash' or 'Bash(*)' is in permissions.deny in ~/.claude/settings.json or .claude/settings.json, Claude Code's tool system blocks ALL shell commands even if bash.exe exists.
Fix: added isToolDeniedInClaudeSettings() that reads all three settings locations (user, project, local) before the OS check. Broad denials ("Bash", "Bash(*)") return 'node' immediately; pattern-specific denials ("Bash(rm -rf *)") are ignored so node commands are still allowed.
Gotcha: pattern-specific denials should NOT be treated as full Bash denial — only exact "Bash" or "Bash(*)" counts.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### [2026-07-20] Task completed — 4 remaining issues fixed (dream-sync, graph hooks, shell-type override, stale version)
(1) dream-sync Steps 2-4 replaced with single bootstrap --mode sync call — no more bash sha256sum/cp/for loops.
(2) stepGitPostMerge added to bootstrap — graph-stale-detect now auto-installed as post-merge/post-checkout git hooks.
(3) --shell-type=bash|powershell|node override flag added to bootstrap — developers can force shell path when AppLocker context differs from terminal. shell_type persisted to dream-init-state.json; setup-status 1p check updated to node-e using shell_type.
(4) setup-sync + dream-sync Step 1 now reads INSTALLED_VERSION from installed_plugins.json (registry, authoritative) while self-healing plugin-path.txt if stale — restores spirit of original HARD RULE without bash.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-07-20] Error resolved — 3-iteration adversarial review found 6 real bugs post-implementation
(1) findings-gate-precommit.cjs section overreach: split()[1] included Closed Findings — fixed with split-by-heading + line-end anchor to match .sh exactly.
(2) detectShell() called twice in bootstrap (steps gitPreCommit + wireSettings) — inconsistency risk on flaky AppLocker; fixed by detecting once in main() and passing shellType as param.
(3) setup-sync Step 1 version stamp used bash `'$INSTALLED_VERSION'` interpolation — writes literal string in node-only mode; fixed with direct substitution instruction.
(4) setup-sync Step 2 `node "$PLUGIN_DIR/..."` used bash variable — fixed with explicit substitution note.
(5) setup-sync/dream-sync warning said "bash install.sh" — fixed to "node install.cjs".
(6) bootstrap error message said "Run bash install.sh" — fixed to include node install.cjs.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### [2026-07-20] Architecture decision — clean three-path hook architecture (no dispatch)
Replaced dispatch.cjs/dispatch.ps1 (if/else chain at runtime) with detect-once-at-setup-time pattern.
`detectShell()` runs in `setup-init-bootstrap.cjs` at provisioning time, stores `shell_type` in dream-init-state.json,
and wires direct hook commands (bash→.sh, powershell→.ps1, node→.cjs). Five new standalone .cjs files created.
Key insight: `plugin-path.txt` was already the canonical PLUGIN_DIR store; setup-sync and dream-sync were
ignoring it and re-resolving from scratch with complex bash process substitution — fixed to use Read tool directly.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### [2026-07-20] Task completed — bash/PS1/Node three-path hook architecture implemented
Created: icea-floor.cjs, memory-capture.cjs, memory-log.cjs, findings-gate-precommit.cjs, graph-stale-detect.cjs
(both in .claude/hooks/ and _project-deploy/hooks/). Deleted dispatch.cjs, dispatch.ps1, shim.sh.
Updated: settings.json (direct .cjs commands), setup-init-bootstrap.cjs (detectShell+hookCmd),
commands/setup-init.md (plugin-path.txt fast path), skills/setup-sync/SKILL.md (Read-tool Step 1, node Step 4b),
skills/dream-sync/SKILL.md (Read-tool Step 1), scripts/sync-config.cjs (standalone node version).
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-07-13] Error resolved — node -e bash quote issue when writing JSON with backticks
`node -e "..."` in Bash tool fails with "unexpected EOF looking for matching quote" when the JS
string contains backtick characters (`). Root cause: bash interpolates backticks inside double-quoted strings.
Fix: use the **Write tool** to write file content directly (never node -e for JSON or multiline content with backticks).
Also applies to heredocs with apostrophes/Unicode. Confirmed pattern from MEMORY.md 2026-07-10 entry.

### [2026-07-13] Architecture decision — plugin repo type is js-library for architect skill
This repo (ai-assisted-development plugin) does not match any standard architect skill detector:
no .sln, no angular.json, no Spring Boot, no react dep, and package.json has no main/exports/module field.
The closest supported type is `js-library`. The deployment context is also atypical — no CI/CD pipeline,
no hosting model (it's a local Claude Code plugin, not a deployed service). The deployment questionnaire
answers should reflect this: intentionally local, no environments, no auth, no DB.

### [2026-07-09] Architecture decision — dream-* lifecycle commands renamed to setup-*
Plugin lifecycle commands (`dream-init`, `dream-sync`, `dream-teardown`, `dream-status`) renamed to
`setup-*` prefix to separate them from the Dream memory feature (`dream`, `dream-health`, `dream-audit`, `dream-rollback`).

**Files changed:** `_project-deploy/commands/` (4 renames), `commands/` (4 renames), `skills/` (3 dir renames: setup-sync, setup-teardown, setup-status), `scripts/dream-init-bootstrap.cjs` (STUB_FILES + LEGACY_STUB_FILES cleanup), `.claude-plugin/plugin.json` (commands + skills arrays), all 3 renamed SKILL.md files, migration `docs/migrations/018-3.8.0.md`.

**Migration:** On next `/setup-sync` run, bootstrap automatically deletes old `dream-*.md` stubs from `.claude/commands/` and deploys new `setup-*.md` stubs via `LEGACY_STUB_FILES` array in `stepDeployStubs()`.

**Kept as dream-:** `dream`, `dream-health`, `dream-audit`, `dream-rollback` — memory feature, not plugin lifecycle.

### [2026-07-09] Architecture decision — two-phase bootstrap for dream-init
Bootstrap Phase 2 (`--mode post-detect --repo-type <TYPE>`) is a new bootstrap mode
triggered by the architect skill after repo type detection. It: (1) pre-copies 4 architecture
template files with `<!-- TEMPLATE -->` marker stripped so architect skips expensive bash
detection in Steps 0.5–6; (2) deploys matching rules via 4-layer frontmatter selection (Layer 0:
always, Layer 3a: files glob, Layer 3b: npm deps, Layer 1: backend-only after Layer 3 backend fires).

**Why:** architect skill's Step 0.5 ran expensive `find`/`grep` background commands → TaskOutput
race condition caused 20+ minute hangs. Pre-copying templates makes Step 0.5 see files as
non-MISSING and skip detection entirely.

**Rejected alternative:** moving repo detection to bootstrap — user decided repo detection should
stay with LLM (handles ambiguous/unusual structures); only mechanical file operations move to bootstrap.

**Files changed:** `scripts/dream-init-bootstrap.cjs` (Phase 2 entry point + helpers),
`skills/architect/SKILL.md` (Step 1 post-detection trigger + Step 3 populated-files guard),
`commands/dream-init.md` (removed LLM Step 4, updated Step 3a).

### [2026-07-09] Plan approved — architecture doc-set expansion (4 new docs + diagrams)
Approved plan: expand the `architect` skill's per-stack doc set from 4 files to 8 to close
structural blind spots present in ALL 11 stacks. New: `architecture-data.md` (schema/entities/
ownership), `architecture-integrations.md` (external deps + timeout/retry/circuit-breaker/failure
behavior/SLA), `architecture-security.md` (trust zones + authorization model), `architecture-
decisions.md` (evolving AD-NNN log, seed-only — never auto-invent rationale). Plus a
`## Non-Functional Requirements & Constraints` section in `architecture-deployment.md`, and TWO
Mermaid diagrams in `architecture.md` (End-to-End `flowchart LR` + Layered `flowchart TB`,
replacing the ASCII layer diagram).

**Decisions:** hybrid populate (extract from code + `⚠ Could not determine` for gaps);
Mermaid over ASCII/graph-viz (offline, PR-diffable); decisions as single evolving file (not
target-repo docs/adr/, not session memory); wire consumers now (security Step 0g loads
architecture-security.md; icea-feature loads data/integrations + seeds AC-NF; app-readiness
feeds NFR/security scores). Plan file: `~/.claude/plans/here-s-what-s-commonly-missing-toasty-rabbit.md`.

**⚠ Population-path tension to resolve during impl:** repo memory (below, "two-phase bootstrap")
says the marker-strip makes architect SKIP Steps 0.5–6 → docs ship as empty scaffolds. User
stated the flow is copy-then-LLM-populate. Plan resolves by following the IDENTICAL template+
prompt pattern as existing files (so new docs behave exactly like current ones, whichever is
true) + adding `/update-arch --data|--integrations|--security|--decisions` refresh flags. Verify
empirically on a scratch repo before trusting init-time population. See [[latent-tooling-issues]].

**Version note:** v3.8.0 is ALREADY in flight (setup-* rename, migration 018-3.8.0.md) — fold
this into 3.8.0 or bump to 3.9.0; do NOT double-claim 3.8.0. `dream-init` is now `setup-init`.

### [2026-07-10] Task completed — architecture doc-set expansion implemented (ADR 0050, v3.8.0)
Implemented the 4→8 architecture doc expansion across all 11 stacks. What worked / conventions confirmed:

- **Template distribution pattern:** the 3 shared new templates (integrations/security/decisions)
  are near-identical across stacks — authored once, distributed via `cp`; only `data.md` needs
  variants (backend=schema / frontend=state+DTO / library=types). Per-stack intelligence lives in
  the File 4–7 **prompts**, not the template bodies. Kept templates as scaffolds + `⚠` markers.
- **Bootstrap needs NO change** — `stepPreCopyArchTemplates` globs `*.md`, so new templates
  auto-deploy; copy-then-LLM-populate handles the rest (confirmed by user + ADR 0046).
- **Gotcha — heredocs fail in this Bash tool:** `cat <<'EOF'`/`read -d ''` heredocs with
  apostrophes/Unicode hit "unexpected EOF looking for matching quote". Use the **Write tool** for
  file content, then `cp`/`awk` for distribution. Also `/tmp` in the Write tool = Windows `C:\tmp`,
  but Git-bash `/tmp` differs — reference Write-created scratch files as `/c/tmp/...` from bash.
- **awk insertion** before the 2nd `## ` heading cleanly placed the two Mermaid diagram sections;
  a second awk pass removed the now-redundant ASCII `## Layer Dependency Diagram` from spring-boot
  + the 3 python stacks (dotnet/aspnet didn't need it).
- **validate.js is the offline gate** (no API); ran 151✓/13✗ **identical to baseline** (stash test
  confirmed zero new failures). The 13 are pre-existing: the in-flight dream-*→setup-* rename +
  scope-flags/security/code-review drift. `tests/runner.js` needs API+network (N/A here).
- Consumers wired: security Step 0g (+staleness caveat), icea-feature (AC-NF seeding), icea-review,
  app-readiness. `/update-arch` gained `--data|--integrations|--security|--decisions`.
- v3.8.0 shares the release with the setup-* rename; appended arch-docs section to migration
  018-3.8.0.md rather than a new file. See [[latent-tooling-issues]].

### [2026-07-10] Error resolved — validate.js 13 failures are 12 validator-rot + 1 real inconsistency
`node tests/validate.js` shows 151✓/13✗ on this branch — a **red release gate** (the only test
runnable in the air-gapped client env; runner.js needs API+network). Diagnosis:
- **12 = validator staleness** (zero runtime impact): validate.js hardcodes old names/phrases and
  wasn't updated when two changes landed — (a) dream-*→setup-* rename (v3.8.0): it still checks
  `dream-init`/`dream-status` in EXPECTED_COMMANDS/COMMANDS/SKILLS/EXPECTED_SCENARIOS; (b) three-pass
  security restructure (v2.0): checks `## 0.5` (now `## Pre-Scan — Static Asset Audit`) and
  "Free-form Risk Analysis" (now `## Pass 3 — Free-Flow Adversarial Pass`); and exact-string checks
  for `SKIP THE CACHE ENTIRELY` (skills say "skip cache entirely") + CLAUDE.md PAT phrasing.
- **1 = REAL inconsistency (#7 FILE_BUDGET):** the 40-file cap is NOT uniformly removed —
  `security/SKILL.md` removed it (scans all), but `code-review/SKILL.md` STILL enforces it
  (`Step 0e — Apply file budget cap`, `FILE_BUDGET = 40`), and `scope-flags-spec.md` + `README`
  document it. CHANGELOG 3.6.0 has NO cap-removal note, so the validator's "removed in 3.6.0"
  premise is unsubstantiated. **Gotcha: do NOT delete the cap docs** — that would contradict
  code-review. The real fix requires a product decision: cap stays (fix validator) or cap goes
  everywhere (edit code-review + plugin-readiness + spec). See [[latent-tooling-issues]].

**Root cause / avoid repeating:** validators that hardcode command names, section titles, and exact
phrases rot on every rename/restructure. A chronically-red gate destroys its regression-detection
signal. Prefer resilient checks (regex/alternatives) over exact-string matches.

### [2026-07-10] Task completed — validate.js gate restored to green (180✓/0✗) + 2 defects fixed
Fixed the 13 gate failures (was 151✓/13✗ → now 180✓/0✗). Buckets: (B) updated stale validate.js
checks to current three-pass security structure — `## 0.5`→`Static Asset Audit`, "Free-form Risk
Analysis"→`Pass 3 Free-Flow Adversarial`, exact `SKIP THE CACHE ENTIRELY`→regex `skip cache|ignore
cache`, CLAUDE.md PAT phrasing; (C) dream-*→setup-* in EXPECTED_COMMANDS/COMMANDS/SKILLS/
EXPECTED_SCENARIOS + added setup-sync/teardown coverage + renamed dream-status.yaml→setup-status.yaml
+ modernized the setup-init completeness block to check the bootstrap script (ADR 0046 moved
mechanical work there); (#7) removed the 40-file cap everywhere (code-review Step 0e/FILE_BUDGET,
scope-flags-spec, README, interactive-menu-spec, code-review command, plugin-readiness scoring) —
code-review now scans all files like security.

**Two genuine defects the work surfaced & fixed:**
1. **icea-floor.sh Windows path bug** — its `*/tests/*`, `*/docs/*`, `*/memory/*`, `*/.claude/*`
   exemptions used forward slashes but the tool passes native Windows backslash paths, so on Windows
   it over-blocked source edits under those dirs (blocked tests/validate.js). Fixed by normalizing
   `FILE_PATH="${FILE_PATH//\\//}"` before the case match. **Gotcha: the .md/.json exemptions are
   suffix-based so they worked; only separator-based ones broke.**
2. **setup-sync/SKILL.md had NO YAML frontmatter** (siblings setup-status/teardown did) — a skill
   without frontmatter won't register. Lost in the dream-sync→setup-sync rename. Added name+description.
   Caught only because adding setup-sync to the validator's SKILLS array is new coverage.

**Confirmed:** the historical plan `docs/plans/2026-07-07-*.md` shows the cap removal WAS intentional
for the security overhaul (3.6.0) — code-review just lagged. security/SKILL.md body was untouched
(already capless). See [[latent-tooling-issues]].

### [2026-07-10] Plan approved — dedup architect templates via _shared/ base + per-stack overrides
Formalizing the "authored once, cp-distributed" pattern (see 2026-07-10 arch-docs entry) into a real
shared source. md5 verified the duplication: `decisions`/`integrations`/`security.md` are byte-identical
across 10 stacks with **dotnet-api the sole variant**; `data.md` has 4 variants (backend-6 / frontend-3 /
dotnet-api / js-library). Genuinely per-stack: `architecture.md`, `-deployment.md`, `-reference.md`, File-2
(`-callchains`/`-flows`/`-api`).

**Approach:** new `skills/architect/templates/_shared/` holds the common `decisions/integrations/security/
data(backend base)`. Stack folders keep only stack-specific files + overrides (dotnet-api overrides all 4;
frontend-3 + js-library override `data.md`). Bootstrap `stepPreCopyArchTemplates` composes
`union(_shared, <stack>)` keyed by filename, **stack wins collisions**. 88→56 files (−32).

**Decisions locked with author:** (1) templates STAY under `skills/architect/templates/` (NOT relocated to
`_project-deploy/`) — co-located with their `prompts/<stack>.md`; (2) shared-base + per-stack **override**
(NOT full genericization — preserves dotnet-api's .NET seed hints as override files).

**Critical coupling (verified):** the file-moves and the bootstrap compose rewrite MUST ship atomically —
`stepPreCopyArchTemplates` does `readdirSync(srcDir)` on the STACK folder only (:1197), so moving common
files to `_shared/` without the rewrite makes every non-dotnet stack deploy an incomplete 4-file set.

**Breakage analysis (all other consumers verified SAFE):** `update-arch.md` walk (:143) — `existsSync`
guards `_shared`; `validate.py` (:425-437) — only checks architecture.md+deployment.md (per-stack), but its
"4 canonical files" comment is a trap to fix; `validate.js` — no template check (add compose-completeness
check); behavioral scenarios assert deployed output not source. Also update SKILL.md Step 2/3 (the
standalone LLM fallback-copy at :629 + stale counts "4"@:546 / "three"@:626).

**Acceptance gate:** before deleting dupes, compose each stack and md5-compare to current per-stack files —
must be byte-identical (preserve CRLF). Residual: dotnet-api's 4 overrides can still drift from `_shared`
(reduced 10→2, not eliminated). Plan: `~/.claude/plans/here-s-what-s-commonly-missing-toasty-rabbit.md`.
See [[plugin-infra-icea-exempt]] (this is plugin infra — ICEA-exempt).

### [2026-07-10] Task completed — architect template dedup implemented (ADR 0051, v3.8.0)
Executed the [[plan approved]] above. Layout now: `skills/architect/templates/_shared/` (4 base
files) + per-stack folders (specifics + overrides). 88→56 files. Verified end-to-end:
- **Acceptance md5 gate passed:** `_shared/` files byte-match baseline groups (decisions/integ/
  security = non-dotnet variant; data = backend-6 variant), so composed output == pre-dedup output.
- **Bootstrap rewrite** (`stepPreCopyArchTemplates`): builds `Map<filename,src>` from `_shared/` then
  overlays `<stack>/` (stack wins); marker-strip + skip-if-exists unchanged. `node --check` clean.
- **Fresh-init smoke (3 stacks):** DOTNET_API (all-override), REACT (data-override), SPRING_BOOT
  (pure-inherit) each → exactly 8 files, 0 leftover TEMPLATE markers.
- **Sync transparency:** re-run on populated dir → "0 composed, 8 already existed" (skip-if-exists).
- **validate.js:** new `▶ Architecture templates` block (compose==8/stack, `_shared` contents,
  override sanity, marker) → **259 passed / 0 failed**. validate.py: fixed the "4 canonical files"
  trap comment + added union==8 check (couldn't run locally — no Python; mirrors validate.js logic).

**Gotchas confirmed:**
- The redundant per-stack decisions/integrations/security/data were **uncommitted staged additions**
  from the Phase-1 arch-docs work (not in HEAD) → `git rm` refused ("changes staged in the index");
  used `git rm -f`. `architecture.md` IS in HEAD.
- **File-moves + bootstrap rewrite are ONE atomic change** — moving common files to `_shared/` without
  the compose rewrite makes non-dotnet stacks deploy incomplete 4-file sets.
- **This Bash tool auto-backgrounds most commands** (returns "running in background", notifies on
  completion) and `sleep N; cat` while another bg task runs gets SIGTERM'd (exit 143). Redirect output
  to a file and Read it after the completion notification instead of chaining sleep;cat.
- ADR 0051 supersedes ADR 0050's "no bootstrap change needed" claim (added a pointer in 0050).
- Folded into unreleased v3.8.0 (no version bump); appended to migration 018-3.8.0.md, not a new file.
See [[plugin-infra-icea-exempt]]. **Committed** as `36b4d79` — the user chose "one v3.8.0 commit
(everything)" because the four in-flight efforts (setup-* rename, arch-docs expansion, gate
restoration, dedup) share files and can't be split cleanly. Not pushed (user didn't ask).

### [manual] 2026-06-09 — ADO curl flags required on the corporate network
All ADO REST API calls must use `--ssl-no-revoke -4` on every curl invocation.
`--ssl-no-revoke` is required because the corporate proxy blocks certificate
revocation checks (CRYPT_E_NO_REVOCATION_CHECK), causing curl to exit with
code 35 and an empty response body. `-4` is required because IPv6 is
unreachable through the proxy — curl attempts IPv6 first, fails silently, and
wastes time before falling back. Omitting either flag causes silent failures
that are hard to diagnose. This was discovered during ADO-81469 implementation
when multiple connection attempts failed before the root cause was identified.
The fix is now baked into all plugin skills and the ado.sh helper.
Additionally: always use `Authorization: Basic $AUTH` header (PAT pre-encoded
via `printf ':%s' "$PAT" | base64 -w 0` then immediately unset) — never
`-u ":$AZURE_DEVOPS_PAT"` which exposes the raw PAT in shell history. Always
use Node.js for JSON parsing, not python3 — Python may launch the Microsoft
Store on Windows instead of running.
Source: Live failure during ADO-81469 session, 2026-06-09
Priority: high

### [manual] 2026-06-09 — Azure CLI auth not viable; PAT is the correct approach
Azure CLI background calls (`az account get-access-token`) are blocked on the
corporate network/environment. This means the preferred Entra ID token flow
cannot be used as a replacement for PAT-based ADO authentication in Claude Code
skills. PAT stored in AZURE_DEVOPS_PAT environment variable (Windows User
Environment Variable, Option A) remains the correct and only supported auth
method for all ADO REST API calls in this plugin. Do not suggest Azure CLI
auth or Bearer token flows as an improvement — they will not work. If this
restriction is ever lifted, revisit by checking whether `az account show`
succeeds in a Claude Code bash tool call.
Source: Developer confirmation, 2026-06-09
Priority: high

### [2026-07-10] Task completed — dream-* → setup-* rename carried through to internals
The v3.8.0 rename (see [2026-07-09] entry) only renamed the surface (command stubs, skill dirs,
plugin.json). Completed the rest: renamed the bootstrap scripts
`scripts/dream-init-bootstrap.cjs` → `setup-init-bootstrap.cjs` and `dream-teardown.cjs` →
`setup-teardown.cjs` (git mv), updated every caller (commands/setup-init.md, setup-sync/
setup-teardown SKILLs, architect post-detect step, ADR path pointers), fixed both validators
(`tests/validate.js` §7 was silently DEAD since v3.8.0 because it read the removed
`commands/dream-init.md`; `tests/validate.py` `open()`ed the removed `skills/dream-status/SKILL.md`
+ old bootstrap path — both would throw), renamed the 3 lifecycle scenario fixtures, fixed
`skills/shared/source-file-consent.md` (validator joins on skill name), replaced the repo's own
stale `.claude/commands/dream-*.md` stubs, and swept living docs + `install.sh`/`install.ps1`
(which told users to run non-existent `/dream-init` etc.).

**Architecture decision — state file & keys intentionally KEPT:** `.claude/dream-init-state.json`
and its keys `dream_init_plugin_version` / `dream_init_last_run` are NOT renamed. They are a
cross-project contract read by `setup-status`/`setup-sync` in every provisioned repo; renaming
without a migration would make those projects read as unprovisioned (broken version-drift
detection) for zero user-visible benefit. Historical records (CHANGELOG/archive, WHITEPAPER, ADR
prose, dated plans, generated HTML guides, gen-story-pptx quote) also left as point-in-time text.

**Technique:** protective perl one-liner `s/dream-init(?!-state)/setup-init/g; s/dream-status/.../`
— negative lookahead protects the state file; underscore keys are untouched (hyphen pattern);
`dream`/`dream-health`/`dream-audit`/`dream-rollback` (memory feature) never match. `LEGACY_STUB_FILES`
line in the bootstrap (old stub names to DELETE on sync) was guarded by line number. Verified:
both scripts `node --check` clean, `tests/validate.js` 180 passed / 0 failed.

### [2026-07-10] Plan approved — wire critic into icea-feature at ICEA-draft + Tech-Spec gates
The critic was documented ("fires automatically inside icea-feature at two gates") but NEVER
invoked there — grep for "critic" in `skills/icea-feature/SKILL.md` returned zero matches. Only
CODE mode in `icea-implement` Step 4a was wired (runs post-codegen at IMPLEMENT — the latest,
costliest place to catch design/spec drift). Approved plan wires two gates into icea-feature:
- **Step 5 ICEA-draft gate** (`mode=icea`) — inserted after the draft is composed in context,
  before the temp-file write; bounded auto-revise loop (max 2), notes fold into the `⚠ ICEA GAPS` list.
- **Step 8 Tech-Spec gate** (new `mode=tech`) — after the Tech Spec is drafted from the on-disk ICEA,
  before temp write; loop regenerates the **Tech Spec only** (ICEA is already saved/immutable —
  ICEA faults route to `REVISE ADO-{ID}`). Cheapest point to catch AC-with-no-file, file-beyond-ACs,
  and unfulfilled D-option — before any code exists.

**Decisions:** (1) wire BOTH gates (not Tech-Spec only); (2) bounded auto-revise loop (not
fold-into-review) — generalise the existing "CODE mode only" REVISE loop to `icea`/`tech`; (3)
dedicated `tech` mode over reusing `icea` mode — unambiguous revise target + moves the dormant
"Tech Spec conformance check (runs when a Tech Spec is present)" table out of `icea` mode into
`tech`, adds traceability + D-option-fidelity dimensions. Also fix stale critic-doc step refs
("after Step 2"/"inside Step 6" → Step 5/Step 8; code gate is in icea-implement, NOT icea-feature).
Plugin infra — ICEA-exempt. Follow-ups flagged (confirm before stamping): ADR, version bump from
3.8.0, token-cost note. Plan: `~/.claude/plans/we-are-saying-that-smooth-swan.md`.

### [2026-07-10] Task completed — critic planning-gates implemented (ADR 0052, v3.9.0)
Executed the [[plan approved]] above. Both gates wired into `icea-feature` (Step 5 `icea`, Step 8
`tech`), `tech` mode added to `critic/SKILL.md` (v1.1), REVISE loop generalised to all 3 internal
gates, consistency fixes in `change-tier-spec.md`/`source-file-consent.md`/`README.md`/`commands/critic.md`.
User chose **bump to 3.9.0 + write ADR** → ADR 0052 (extends ADR 0012 "critic layer", does NOT
supersede), CLAUDE.md + plugin.json → 3.9.0, CHANGELOG 3.9.0 entry.

**Conventions confirmed:** (1) **No migration doc for prose/doc-only releases** — `docs/migrations/README.md`
says so explicitly and version gaps (3.1/3.4 have none) confirm it; skills load from the plugin dir,
not per-project, so nothing on a project's disk goes stale. (2) `tests/validate.js` is the offline
gate — **259 passed / 0 failed** after each phase (does NOT tie HTML-guide version to plugin version).
(3) HTML guides have their own version contract (ADR 0022) — bump only when their content changes.
Follow-up in progress: updating the 3 HTML guides (were at v3.8.0) for the new gates. See
[[guide-taxonomy]], [[html-guide-assembly]].

### [2026-07-10] Task completed — 3 HTML guides updated to v3.9.0 for critic gates + icea-floor hook fix
Updated all 3 HTML guides (`plugin-guide.html`, `user-guide.html`, `docs/workflow/developer-guide.html`)
for the new critic gates: critic feature-card / dedicated section now describe **three** gates (ICEA
draft, Tech Spec draft, code) instead of two; user-guide gate table gained a Tech Spec row; plugin-guide
got a 3.9.0 "What's new" changelog `<li>`; developer-guide got a critic-gate callout in the ICEA-draft
(3.1) and Tech-Spec-draft (4.1) steps. All `documents-plugin-version` stamps + visible badges bumped
3.8.0→3.9.0 (historical changelog/"As of v3.8.0" prose left intact). `node scripts/check-version-consistency.js`
→ consistent (3.9.0); `tests/validate.js` → all structural checks pass.

**Gotcha — ICEA-floor hook blocks root-level `.html` edits:** `icea-floor.sh` guards `*.html` but only
exempts `*/docs/*` (+ `.md`/`.json`/`memory/`/`.claude/`). So `docs/workflow/developer-guide.html` is
editable but root `plugin-guide.html`/`user-guide.html` are BLOCKED (no approved app ICEA in the plugin
repo — and plugin infra is [[plugin-infra-icea-exempt]]). Fix (user-approved): added
`*/plugin-guide.html|plugin-guide.html|*/user-guide.html|user-guide.html` to the exempt case.

**Gotcha — hook has TWO copies + a hash record; deploy-source had drifted:** `.claude/hooks/icea-floor.sh`
(active) vs `_project-deploy/hooks/icea-floor.sh` (deploy-source, canonical), and `.claude/hooks/.hashes`
tracks the **deploy-source** sha256. The active copy already had the Windows backslash-normalization fix
but the deploy-source did NOT — a latent re-sync regression (a fresh `setup-sync` would have overwritten
the active fix with the un-fixed source). Back-ported the Windows block to the source, added the guide
exemption to BOTH, made them byte-identical, recomputed sha256 and updated `.hashes`. **When editing any
deployed hook: update both copies + re-stamp `.hashes` (sha256 of the deploy-source), or drift/regression
follows.** See [[latent-tooling-issues]].

### [2026-07-12] Architecture decision — disable Claude Code built-in auto-memory so Dream owns repo memory/ (v3.11.0)
**Symptom:** Dream triggers wrote to `~/.claude/projects/<slug>/memory/MEMORY.md` (per-machine
profile, never committed, invisible to `/dream`) instead of the repo `memory/`. Reported on the
KE-Web target app; that profile dir already held `MEMORY.md` + `feedback_story_slicing.md` in the
**native one-file-per-fact + frontmatter** format (not Dream's `### [date] trigger — topic`).

**Root cause — NOT a Dream bug.** Dream's capture path (the `memory-capture.sh` UserPromptSubmit
hook + CLAUDE.md `# Dream` section) correctly targets repo-relative `memory/MEMORY.md`. But Claude
Code ships a **built-in "auto memory" feature that is ON by default**; it injects a per-turn
instruction pointing at the profile dir. Two live "write your memory" targets → the model followed
the built-in one (more elaborate, re-injected each turn), diverting every capture off-repo. No
`autoMemoryEnabled` key existed in user or project settings, so the built-in ran unopposed.

**Fix (chosen):** `setup-init-bootstrap.cjs` `stepWireSettings()` now sets
`"autoMemoryEnabled": false` in `.claude/settings.json` — **only when the key is unset** (preserves
an explicit developer override). Runs on BOTH init and sync (sync ignores the manifest so every
`isDone`-guarded step re-runs — see header comment lines 10–15), so `/setup-sync` fixes existing
projects. Rejected alternatives: (a) leave both on → split-brain memory; (b) strengthen Dream
wording only → fragile, two targets still live. Also hardened the hook + CLAUDE.md `# Dream` to name
the target as the **repo-root** `memory/MEMORY.md`, "NOT the ~/.claude profile memory".

**Reference:** CC memory docs — settings key `autoMemoryEnabled`, env `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
Verified via isolated sync-mode run: `autoMemoryEnabled=false` added, `permissions`/`customInstructions`
preserved, memory-capture hook intact. Files: `scripts/setup-init-bootstrap.cjs`,
`_project-deploy/hooks/memory-capture.sh` (+ deployed `.claude/hooks/` copy), `CLAUDE.md` `# Dream`,
`docs/migrations/020-3.11.0.md` (+ README index), `.claude-plugin/plugin.json`+`CLAUDE.md` version 3.11.0,
`CHANGELOG.md`. Fix-forward: existing profile entries left in place. See [[plugin-infra-icea-exempt]].

### [2026-07-12] Plan approved — commit non-secret settings.json + share durable artifacts, guard secrets
The plugin's `.gitignore` was over-defensive: it ignored `.claude/settings.json` (rationale "PAT
credential storage") AND several output dirs wholesale, trapping shareable config/knowledge behind
un-committable files. Approved plan (plugin infra — [[plugin-infra-icea-exempt]]):

- **settings.json split** (Claude Code merges `settings.local.json` OVER `settings.json`): committed
  `settings.json` holds ONLY `hooks` + `customInstructions` + non-secret `env` (model routing). The
  ENTIRE `permissions`/`Bash(...)` allow list → gitignored `settings.local.json` (user decision:
  permissions are machine/security-sensitive). Secrets (PAT) → `settings.local.json` or OS env only.
- **Layered secret-guard** so nobody (human or Claude) commits a secret to the now-shared file:
  new `scripts/check-settings-secrets.cjs` (modes `--hook` / `--file` / `--staged`; detects
  secret-shaped keys PAT|TOKEN|SECRET|… + values ADO-PAT/`ghp_`/`AKIA`/JWT; allows placeholders +
  `*_MODEL`), consumed by (a) new PreToolUse `.claude/hooks/settings-secret-guard.sh` (write-time,
  models `icea-floor.sh`) and (b) new `.githooks/pre-commit` (commit-time, `git config core.hooksPath
  .githooks` wired into bootstrap).
- **Artifact ignore policy (user: "ledgers only" + "keep analytics ignored"):** commit all of
  `.claude/architecture/` (8 prose docs, no secrets) + the 3 ledgers via the `dir/*` + `!dir/ledger.md`
  negation form (ignoring a whole dir blocks re-including a file). Keep ignored: all dated HTML/MD/JSON
  reports, ALL `dynamic-scan/*.session`/`*.context` (plaintext-cred risk), `token-analysis/`,
  `prod-readiness/`.
- **Managed-block source, not just .gitignore:** these live in `GITIGNORE_BASE` (~L79–88) of
  `scripts/setup-init-bootstrap.cjs` — must edit there (+ gitignore-sync skill / vcs-detect-spec if
  duplicated) or `gitignore-sync` overwrites. Also **invert setup-status check 1i** (RED becomes
  "settings.json contains a secret", reusing the detector). Touches same `stepWireSettings()`/settings.json
  as the [2026-07-12] autoMemoryEnabled work above. Plan: `~/.claude/plans/we-are-adding-some-wise-island.md`.

### [2026-07-12] Task completed — shared settings.json + secret guard implemented (v3.12.0)
Executed the [[plan approved]] above. Key implementation decisions that DEVIATED from the plan sketch
(all improvements, same behaviour):
- **Detector is a DEPLOYED HOOK, not `scripts/`.** `check-settings-secrets.cjs` lives in
  `_project-deploy/hooks/` → copied to `.claude/hooks/` (added to `HOOK_FILES`), so it exists in
  downstream target projects too (plugin `scripts/` don't deploy). Two byte-identical copies +
  `.claude/hooks/.hashes` regenerated (see [[html-guide-assembly]] two-copy gotcha — deploy-source is
  canonical; `sha256sum -c .hashes` must run FROM `.claude/hooks/`, bare filenames).
- **No separate `.sh` wrapper, no new `.githooks/`.** Write-time guard = the detector wired DIRECTLY
  as a `node .claude/hooks/check-settings-secrets.cjs --hook` PreToolUse entry (not `bash …`).
  Commit-time guard = EXTENDED the existing `findings-gate-precommit.sh` (already installed as
  `.git/hooks/pre-commit` via `stepGitPreCommit`) to call `--staged`; honours `SKIP_FINDINGS_GATE=1`.
- **Detector modes:** `--hook` (parse PreToolUse JSON stdin, self-gates on file path ending
  `.claude/settings.json`, exit 2 to block), `--staged` (`git show :.claude/settings.json`, exit 1),
  `--file` (exit 1). Signals: secret-shaped KEY (regex must allow `_-` in surrounding chars — bug
  caught in test: `MY_TOKEN` missed until `[A-Za-z0-9_\-]*`) + secret-shaped VALUE (ADO 52-char base32,
  ghp_/github_pat_, AKIA, Slack, JWT, PEM). Allows placeholders/`${…}` refs/`*_MODEL`.
- **gitignore negation form is mandatory:** ignoring a whole dir blocks re-including a file, so ledgers
  use `dir/*` + `!dir/<ledger>.md`; `writeGitignoreBlock` preserves `GITIGNORE_BASE` array order
  (`blockEntries.join`) so `dir/*` stays before its `!` line. Removed this repo's standalone
  `/dynamic-scan/` + `/token-analysis/` lines that would have defeated the negation.
- **Verified:** 11/11 detector unit tests; commit-time e2e (block secret / allow clean / SKIP override)
  in isolated temp repo; `git check-ignore` matrix (settings.json + architecture + 3 ledgers SHAREABLE;
  reports/.session/settings.local.json/token-analysis/prod-readiness IGNORED); `validate.js` 259/0;
  `sha256sum -c .hashes` all OK; both settings JSONs valid.
- **Release:** bumped 3.11.1→**3.12.0** (distinct feature, downstream migration steps), migration
  `022-3.12.0.md` (+ README index), CHANGELOG. **HTML guides NOT updated** (still say settings.json is
  gitignored) — flagged as follow-up in CHANGELOG; check-version-consistency warns them at v3.9.0
  (pre-existing). **Downstream risk documented:** projects with a PAT in settings.json (Option B) must
  move it to settings.local.json on `/setup-sync`; guards + check 1i are the safety net. Not committed
  (user didn't ask). See [[plugin-infra-icea-exempt]], [[guide-taxonomy]].

### [2026-08-12] Plan approved — LLM-agnostic multi-harness (Claude Code + GitHub Copilot) convergence
Final design saved to `docs/plans/2026-08-12-llm-agnostic-multi-harness-convergence.md` (Status: 📋 Planned, 9-phase tracker). Goal: make the plugin work with Copilot too. Strategy = CONVERGE the existing plugin onto the cross-tool standard (not a 2nd plugin, not a transform layer). Enabled by verified fact: VS Code 1.109 (Jan 2026) added deliberate "Claude compatibility" — Copilot natively reads CLAUDE.md, `.claude/rules` (`paths:`), `.claude/agents`, `.claude/skills`, `.claude/settings.json` hooks.
Trigger: Plan approved  Confidence: 0.85  Source: auto-capture

### [2026-08-12] Architecture decision — scoped Shared/Claude/Copilot source + per-harness projection
Plugin is organised into `Shared/` (neutral single source: skills, rules, instructions, hooks, gate, eval) + thin `Claude/` and `Copilot/` adapters (each owns its own manifest/wiring) + neutral `plugin.manifest.json`. Provisioning PROJECTS `Shared/`+adapter into each tool's NATIVE paths (`.claude/` for Claude, `.github/` for Copilot). Config (skills/rules/hooks/agents/instructions) is projected per-harness; artifacts/data (architecture, graph, memory/, docs/) are generated ONCE in a neutral location and shared (no per-harness duplication → no drift). Clean separation is achievable+verified: Copilot's `.claude/` discovery is disableable via `chat.agentSkillsLocations`/`instructionsFilesLocations` (path→false) + `chat.useClaudeMdFile:false`, so an emitted `.vscode/settings.json` scopes Copilot to `.github/` only (avoids double-registration since Copilot reads BOTH `.claude/` and `.github/`). Harness is selected at APPLICATION-INTEGRATION time (per project, `provision --harness=…`, recorded in `.aidev/manifest.json`), NOT at machine install (machine install must be harness-neutral).
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### [2026-08-12] Architecture decision — v3.13 = frozen git tag, 4.0 convergence on a branch (NOT a 2nd project, NOT a versions/ folder)
Repo/versioning strategy for the multi-harness work. REJECTED: (a) a separate new "multi-harness" project — reintroduces the exact dual-maintenance the convergence plan kills, and discards the single-source-of-truth (`Shared/` projected per harness) benefit; (b) a physical `plugin/versions/` folder — vendoring own history, bloats repo, makes provisioning/`setup-sync` authoritative-tree ambiguous, invites copy-paste drift. CHOSEN: git is the version boundary — tag `v3.13.0` as the permanent, installable Claude-only FALLBACK (rollback point), build 4.0 convergence on a branch while `main` stays 3.13 until 4.0 proves out (Phase 1 spike). User chose FROZEN FALLBACK lifecycle for 3.x (no ongoing parallel Claude-only development → no forward-porting burden); convergence is backward-compatible for Claude so 3.13 need not keep growing. Marketplace can still serve the `v3.13.0` tag to Claude-only users.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### [2026-08-12] Architecture decision — eliminate runtime $PLUGIN_DIR (self-contained project-deployed skills)
Skills stop resolving `$PLUGIN_DIR`/`plugin-path.txt`/`installed_plugins.json` at runtime. Instead: build-time scripts self-locate via `__dirname`; provisioning bundles each skill's deps into the project and skills read PROJECT-RELATIVE (`_shared/` + sibling skills). Confirmed: Claude Code auto-loads project `.claude/skills/` (git-shared, monorepo parent-dir discovery), so this works for Claude AND Copilot (which has no plugin dir at all). Skills are shared-by-default (Agent Skills is a cross-tool standard; ~90% identical) with a mechanical delta-map (frontmatter `allowed-tools`↔`tools`, tool-name tokens) and a per-skill OVERRIDE escape hatch (`Claude|Copilot/skills-override/<name>`) for the rare divergent/orchestrating skill. Trade-off: skill/rule updates now arrive via `setup-sync` re-projection (hash-tracked), not automatic marketplace refresh.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### [2026-08-12] Approach abandoned — greenfield Copilot plugin AND bespoke adapter/transform layer
Rejected (a) building a SEPARATE greenfield Copilot plugin (duplicates content, 2nd codebase; the portable subset is exactly what Copilot needs anyway) and (b) a bespoke adapter/emitter TRANSFORM layer that rewrites skills to a foreign format. Both superseded once VS Code 1.109 Claude-compat was verified: convergence + thin projection is simpler. Also: the earlier code-grounded "porting is impossible" verdict was OVERTURNED by 1.109 — do not retry the "greenfield only" conclusion. Note: `.claude/rules` with `paths:` load ON READ, not on creation, so coding-standard rules that must apply when GENERATING code must be unconditional (no `paths:`) / in CLAUDE.md; user-level `paths:` rules are bugged (#21858) → keep at project level.
Trigger: Approach abandoned  Confidence: 0.80  Source: auto-capture

### [2026-08-12] Architecture decision — 3-tier enforcement + SEV-1 AI-safety hardening as first-class
Enforcement is THREE tiers, not one: Tier A = Claude write-time hooks (HARD/deterministic/GA, unchanged); Tier B = Copilot read-only gate agents + PreToolUse deny (Preview, user-overridable); Tier C = git pre-commit + CI `ai-gate` (harness-INDEPENDENT universal backstop). Claude keeps hard hooks — do NOT claim "git/CI is the only hard gate." AI-architect SEV-1s elevated to first-class work-streams: (1) approval bound to ADO system-of-record (NOT a `Status: Approved` file grep the AI can forge/self-approve); (2) data-egress policy tied to the plugin's own B1–B7 severity — privileged/PII context must NOT reach unapproved/cloud models (law-firm critical); (3) memory/docs treated as UNTRUSTED input (SessionStart auto-injects git-shared AI-written MEMORY.md → prompt-injection persistence vector) + secret context-exclusion; (4) behavioral eval harness in CI (governance tool must detect its own quality decay); (5) per-skill capability floor; (6) audit stamping (model+version+harness+skill-hash); (7) gate pinned+hash-verified, warn-only rollout + audited break-glass. Open item: confirm exact `chat.agentSkillsLocations` disable-syntax hands-on; vendored-vs-npx gate pending Kirkland internal-registry fact.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture
