# ai-assisted-development — Claude Code Plugin

ICEA-driven development workflow for distributed teams using **Azure DevOps**. Language-agnostic across **.NET (Framework 4.x → .NET 10) · Java/Spring Boot · Python (FastAPI/Django/Flask) · Node.js** backends and **Angular / React** frontends — the active stack is detected per repo and drives detection, generation, review, and scanning.

**Version 3.25.0** — Makes the plugin **dependency-aware**: scanners and the knowledge graph now read `.claude/settings.local.json → additionalDirectories` (curated, locally-cloned dependency repos) as additional scan roots via the new `skills/shared/multi-root-scan.md` spec. The knowledge graph, `explain`, `icea-feature`, and `update-arch` include dependency modules by default; the heavy scanners (`security`, `code-review`, `app-readiness`) stay repo-only unless invoked with `--with-deps`. The Write Gate now requires per-file confirmation for any write resolving **outside the repo root**, un-blanketable by `APPROVE ALL` (see [docs/migrations/033-3.25.0.md](docs/migrations/033-3.25.0.md)). v3.22.0 added **`/knowledge-freshness`** to keep the migration family's offline knowledge tier trustworthy; v3.21.0 split the single `migration` skill into **Upgrade · Rewrite · Replatform** (see [CHANGELOG.md](CHANGELOG.md)). Earlier, v3.20.0 added two **operational-documentation skills** for the support-handover lifecycle. **`/operations`** generates a master **Operational Runbook** from the codebase — the single document a support engineer opens during an incident — as Markdown (the source of truth, written to `docs/operations/`) plus a self-contained **offline HTML** companion, with 16 sections and Mermaid architecture / triage / escalation diagrams. **`/go-live`** generates a **Support-Transition Acceptance Checklist** — the one-time go/no-go gate an incoming support team uses to accept the app — by ingesting the latest prod-readiness report, the security ledger, and the code-review ledger plus the deployment architecture; missing inputs degrade to greppable `⚠ TODO` rows rather than a silent pass, and nothing is ever fabricated. Both are documentation generators (like `/product-docs`) — no ICEA and no Write Gate. Recent releases also added: **version-aware .NET detection** (a per-project runtime `versions[]` spread so a mixed .NET Framework 4.x + .NET 8/9/10 solution is detected **per project**, with opt-in `PER_PROJECT_RULES` scoping); a bounded, gated **goal-loop** (`/goal-loop`); **migration hardening** (integration ground-truth verification, as-built reconciliation, golden-master provided-URL capture); **scored stack-key rule deployment** ([ADR 0059](docs/adr/0059-scored-stack-key-detection-and-rule-deployment.md)); domain-aware **business-context severity** (`SET DOMAIN`); and a tamper-evident **governance audit trail** under `.claude/audit/`. The codebase knowledge graph (`.claude/graph/`) remains the **single codebase-orientation layer**, backed by a machine-readable `graph.json` (typed nodes/edges with confidence) whose **`EXTRACTED` dependency edges are derived deterministically from source imports** by a script rather than the model ([ADR 0041](docs/adr/0041-deterministic-edge-extraction.md)), then projected into the always-loaded index + per-module detail files, with `/graph-viz` for an offline visual map ([ADR 0039](docs/adr/0039-graph-json-sidecar.md)). `CLAUDE.md` is kept lean under a ~200-line context budget ([ADR 0040](docs/adr/0040-claude-md-context-budget.md)), and the plugin version is single-sourced in `.claude-plugin/plugin.json`. See [CHANGELOG.md](CHANGELOG.md) for the full history. **Upgrading from an older version?** Run `/setup-sync`.

---

## What's included

### Commands (slash commands)

| Command | What it does |
|---|---|
| `/ai-assisted-development:setup-init` | One-time project setup. Runs the architect deployment questionnaire, seeds `file-cache.json` and `token-graph.json`, deploys command stubs, `.claude/rules/`, populates `.claude/architecture/` and generates the knowledge graph `.claude/graph/`, ensures `CLAUDE.md` has Dream sections. Step 2d asks whether the project depends on services in separate repositories (e.g. a .NET API in its own repo); paths provided are added to `additionalDirectories` and immediately scanned for stack detection — `external_detected_stacks` is populated so `icea-feature` can select the correct multi-layer Tech Spec overlay from the first session. Creates and populates `.gitignore` automatically. Safe to re-run. |
| `/ai-assisted-development:setup-status` | Read-only health check. Reports green/amber/red on all **23** infrastructure checks including `architecture-deployment.md` status, .NET version-detection freshness, and knowledge graph checks. |
| `/ai-assisted-development:setup-sync` | Re-provision an existing project after a plugin upgrade. Compares the version that provisioned the project against the installed version and applies only the version-sensitive changes (hooks, shared specs, ignore-file managed block, new state/rule files) per `docs/migrations/`, then re-stamps the version. Idempotent; never overwrites your own content. Run when `setup-status` reports **UPGRADE PENDING**. Flags: `--commands` (deploy command stubs only, deterministic), `--reinstall` (push plugin source changes to the installed copy — run from the plugin source directory). Alias: `setup-init --upgrade`. |
| `/ai-assisted-development:dream` | 6-phase memory consolidation — reads sessions, scores entries, proposes ADD/UPDATE/DELETE with full justification, waits for tiered approval before writing. Includes token-budget guard. |
| `/ai-assisted-development:dream-health` | Generates `memory/health.html` — browser dashboard with confidence scores, decay curve, promote candidates, and clickable justification panels. |
| `/ai-assisted-development:dream-rollback` | Reverses a specific `/dream` run using the audit trail in `memory/dream-log.md`. Auditable and itself reversible. |
| `/ai-assisted-development:dream-audit` | Quarterly memory quality audit — citation rates, contradiction events, rollback-prone categories. Archives stale topic files (reversibly) and writes audit hints that tune Dream's promotion confidence. |
| `/ai-assisted-development:session-start` | Zero-cost session warm-up — loads stack, last decision, last fix, and sessions-since-dream in one pass. Surfaces any Red infrastructure items. |
| `/ai-assisted-development:update-arch` | Targeted refresh of the prose `architecture.md` for changed areas. Use `--deployment` to re-run the deployment questionnaire only. For the module graph, use `/graph-sync`. |
| `/ai-assisted-development:code-review` | Static code analysis with persistent cross-run tracking. **Cache-aware** — skips unchanged files. Supports `--changed`, `--pr`, `--full`, `--ci`, `--area` scope flags. Writes to `CodeReviews/`. |
| `/ai-assisted-development:security-review` | Full codebase security review (OWASP/CVSS/CWE). Static asset directory audit runs first. **Cache-aware + lazy language loading**. Same scope flags as code-review. Writes HTML to `security/`. |
| `/ai-assisted-development:dynamic-scan` | Dynamic (DAST) scan of a **running** app or API with OWASP ZAP via Docker. Runtime counterpart to security-review. Angular / ASP.NET MVC / Web API / Blazor / Razor Pages, plus npm/pip/NuGet dependency audit. Safe passive default; `--full`/`--scope` for gated active scans. Flags: `--url --stack --auth --swagger --deps-only --diff --ci --fail-on`. Writes HTML to `dynamic-scan/` and updates `dynamic-scan/dynamic-scan-ledger.md`. |
| `/ai-assisted-development:ado-tasks` | Generate a complete Azure DevOps task breakdown from an approved ICEA document. One task per Acceptance Criterion per layer (Angular, .NET, Node.js, DB, QA, Infra) with titles, tags, and effort estimates. Run after ICEA approval and before sprint planning. Argument: `ADO-<id>`. |
| `/ai-assisted-development:icea-feature` | Explicitly invoke the ICEA feature planning gate. Use when the auto-trigger did not fire, to re-generate an existing ICEA, or to start deliberate feature planning. The ICEA gate also triggers automatically on keywords like "build", "implement", "add feature". Argument: `ADO-<id>` or feature description. |
| `/ai-assisted-development:icea-approve` or `APPROVE ADO-{ID}` | Approve an ICEA and Tech Spec by ADO ID. Works in any session — reads state from disk. Use after Tech Lead or Product team approval. |
| `/ai-assisted-development:icea-implement` or `IMPLEMENT ADO-{ID} [Story-N]` | Generate and write implementation code for an approved ICEA. Story-by-story for Epics. All source code gated behind APPROVE ADO-{ID}. |
| `/ai-assisted-development:icea-revise` or `REVISE ADO-{ID}` | Revise an existing ICEA and Tech Spec — resolve open questions, incorporate feedback, update any section. Re-gates code generation after revision. |
| `/ai-assisted-development:icea-status` or `STATUS ADO-{ID}` | Show current state of all ICEA files for an ADO ID — status, open questions, tracker progress, bugs, and exact next action. Re-entry point after a session gap. |
| `/ai-assisted-development:critic` | Standalone critique pass. `icea` mode critiques an ICEA spec (completeness, testability, B1–B7 coverage, scope); `code` mode critiques generated/changed code (ICEA traceability, simplicity, rules compliance, decision transparency, hidden assumptions). Runs automatically inside `icea-feature` at two gates; this command is the on-demand path for a single phase. Args: `icea` or `code`, optional `ADO-<id>`. |
| `/ai-assisted-development:gitignore-sync` | Ensure `.gitignore` exists and contains the plugin-required entries (in a managed block; never touches your own lines). Creates the file if missing and verifies the result. The single-purpose path for the logic `setup-init` also runs — use it directly if `.gitignore` is missing or out of date. Arg: `--with-artifacts` to also offer detected build/env files. |
| `/ai-assisted-development:sync-dirs` | Re-syncs `.claude/settings.local.json` `additionalDirectories` by re-running the external-dir-map skill. After updating directories, also re-runs `external-stack-detection.cjs` to keep `external_detected_stacks` in `dream-init-state.json` current — ensuring icea-feature overlay selection always reflects the full multi-repo stack. Safe to run at any time. |
| `/ai-assisted-development:bug` | Lightweight ICEA-lite for confirmed bug fixes. One-screen spec → one approval cycle → fix applied. Redirects to `icea-feature` if the bug requires new design. |
| `/ai-assisted-development:checkin` | Pre-commit quality gate — code quality + ICEA compliance + secrets scan in a single shared-context pass. Produces one pass/fail verdict and a pre-filled commit command. |
| `/ai-assisted-development:explain` | Answers structural codebase questions using only architecture docs and the knowledge graph — no source scanning. Points to the specific file to read when docs are insufficient. |
| `/ai-assisted-development:fix` | Applies a fingerprinted finding from the code-review ledger directly to source. Args: `FP-xxxxxxxx`. |
| `/ai-assisted-development:app-readiness` | Enterprise Architect + Solution Architect production readiness assessment across 8 domains (pipeline, resilience, observability, security, scalability, data integrity, runbook, tests). Reads `architecture-deployment.md` for hosting-specific checks. Flags: `--quick` `--full`. |
| `/ai-assisted-development:plugin-readiness` | AI Architect production readiness assessment across 6 domains (infrastructure, model routing, memory health, governance rails, skill quality, session budget). Reads plugin state only — never application source. |
| `/ai-assisted-development:token-analysis` | Analyses token consumption. Persistent graph cache — subsequent runs process only new sessions and changed files. Writes to `token-analysis/`. |
| `/ai-assisted-development:sprint-metrics` | Post-sprint KPI report via ADO REST API. Metrics: ICEA compliance rate, PR rejection rate, rework hours. Args: `sprint=<name>` or `from=<date> to=<date>`. |
| `/ai-assisted-development:product-docs` | Generates Product Detail Document and/or User Guide as self-contained HTML. Always asks which documents to create before generating anything. |
| `/ai-assisted-development:graph-sync` | Incremental refresh of the codebase knowledge graph in `.claude/graph/`. Recomputes module-wide fingerprints and regenerates only stale modules — unchanged modules skipped entirely. Reconciles removed/renamed/orphaned modules, derives typed dependency edges, updates `graph.json` (authoritative) and its markdown projection, restructures flat→domain at 30+ modules, clears `.stale` flag on success. For first-time graph creation use `/setup-init` instead. |
| `/ai-assisted-development:graph-viz` | Renders the knowledge graph as a self-contained **offline** HTML visualization at `.claude/graph/graph.html` — nodes by type, edges by type/confidence, hub (god) nodes and stale modules flagged, hover shows dependencies and dependents. Reads `graph.json` only (never source); `graph.html` is gitignored. `--3d` uses a locally vendored WebGL library. |
| `/ai-assisted-development:upgrade` or `UPGRADE ADO-{ID}` | **In-place, same-stack version upgrade** (e.g. .NET 6→8). Orchestrates a deterministic tool, rejects false-upgrades → Rewrite, gap/risk report, baseline-tag → commit-per-hop → baseline-oracle verify. Status/resume: `UPGRADE STATUS\|RESUME ADO-{ID}`. |
| `/ai-assisted-development:rewrite` or `REWRITE ADO-{ID}` | **Out-of-place generative migration** to a NEW target folder (Java→.NET, Express→Angular). Posture · options × assurance × TCO (or BYO) · target-space DAG · one cluster per worktree · design-quality + per-cluster BAL + ERL · merge+completion two-gate. Status/resume: `REWRITE STATUS\|RESUME ADO-{ID}`. |
| `/ai-assisted-development:replatform` or `REPLATFORM ADO-{ID}` | **Hosting/topology migration** (on-prem → cloud). NFR/Well-Architected oracle (measurability-ceilinged), cloud-capability decomposition (landing-zone Tier-0), LLM authors IaC + **human-executed** migration/reconciliation/cutover/rollback runbooks. Status/resume: `REPLATFORM STATUS\|RESUME ADO-{ID}`. |
| _(retired)_ `MIGRATE` · `/migration` · `/migration-status` | The single `migration` skill was **split** into Upgrade · Rewrite · Replatform (above). `MIGRATE …` now returns a signpost — nothing auto-routes. See [`docs/migrations/2026-09-migration-skill-family.md`](docs/migrations/2026-09-migration-skill-family.md). |
| `/ai-assisted-development:knowledge-freshness` | **Validate + refresh the offline migration-knowledge tier** (plugin-maintainer). `check` classifies every ref FRESH / STALE-BY-AGE / STALE-BY-VERSION / UNKNOWN (deterministic, no-network — the LLM supplies `--latest`); `refresh` web-grounds a stale ref → unified diff → higher-tier judge → Write Gate → updates the ref, bumps `last_verified`, re-tags authority. Not keyword-auto-invoked. |
| `/ai-assisted-development:goal-loop` | Thin cradle-to-grave orchestrator — sequences `icea-feature` → `icea-approve` → `icea-implement`, stopping at every SAVE/APPROVE gate and self-approving nothing. The only loop-till-done runs inside `icea-implement` Step 4b: it self-scores generated code against the approved acceptance criteria and revises, capped by a hard iteration ceiling (+ optional token budget) and a diminishing-returns guard. Never writes to disk or issues `APPROVE`. Argument: `ADO-<id>`. |
| `/ai-assisted-development:operations` | Generate a master **Operational Runbook** for the app from the codebase — Markdown (source of truth in `docs/operations/`, grep-discoverable by `app-readiness`) plus a self-contained offline HTML companion. 16 sections with Mermaid architecture / triage / escalation diagrams: environments, routine ops (deploy/rollback/restart/migrations), health/logs/alerts, secrets + rotation, failure-mode playbooks, backup/DR, escalation, incident comms. Documentation generator — no ICEA/Write Gate; every unknowable renders as a greppable `⚠ TODO`. |
| `/ai-assisted-development:go-live` | Generate a **Support-Transition Acceptance Checklist** — the one-time go/no-go gate an incoming support team uses to accept the app. Capstone that ingests the latest `prod-readiness/` report, `security/` ledger, and `CodeReviews/` ledger (open findings only) plus deployment architecture to derive Section-A blockers and Section-B fast-follow; auto-links the Operational Runbook. Missing inputs degrade to `⚠ TODO` rows — never a silent pass. Documentation generator — no ICEA/Write Gate. |

### Skills (auto-invoked by keyword)

| Skill | Trigger keywords | What it does |
|---|---|---|
| `icea-feature` | "build", "implement", "add feature", "create", "I need", ADO #, user story | Reads architecture docs including `architecture-deployment.md` for hosting/auth context. Creates ICEA with B1–B7 sensitivity flags on relevant ACs. Blocks code generation until explicitly approved. Tech Spec overlay is selected from the **combined** `detected_stacks` ∪ `external_detected_stacks` — multi-repo projects (e.g. Angular + separate .NET API) get a full-stack overlay automatically. Available overlays: `techspec-aspnet-mvc-jquery.md` (.NET MVC), `techspec-aspnet-api-angular.md` (Angular + .NET API direct), `techspec-angular-nodejs.md` (Angular + Node.js BFF ± .NET API). |
| `icea-review` | "review this PR", "check against ICEA", "ICEA compliance", "self-review" | Reads the knowledge graph and architecture docs for orientation. Reviews PR/diff against ICEA — structured pass/fail report with business context overrides. |
| `architect` | "populate architecture docs", "document the architecture", "run architect" | Runs deployment questionnaire first (Step 0.5), then detects repo type, deploys templates, populates `.claude/architecture/`, generates the knowledge graph `.claude/graph/` (index + per-module detail files, each with a SHA-1 entry-point fingerprint). |
| `ado-tasks` | "break down this story", "create tasks", "generate ADO tasks", "estimate work" | Generates ADO task breakdown from an approved ICEA. One task per AC per layer — Angular, .NET, Node.js, DB, QA, Infra. Never generates without an ICEA. |
| `pr-describe` | "write PR", "create pull request", "PR description", "ready to merge" | Generates an ICEA-compliant PR description for ADO. Flags scope creep. Always includes a self-review checklist. |
| `pr-create` | "create PR", "open PR", "raise PR", "submit PR to ADO or GitHub" | Creates a PR on **Azure DevOps or GitHub** — the git remote provider is auto-detected. Auto-runs `icea-review` before confirming; blocked PRs cannot be created unless `--skip-icea-check` is passed (noted in the PR description). Falls back to saving a PR draft artifact if the connection is skipped. |
| `pr-spec-review` | "review PR against spec", "spec compliance", "traceability matrix" | Reviews a PR against a spec/ICEA — four outputs: compliance check, code review, traceability matrix, gaps/risks report. Business context overrides mandatory. |
| `security` | "security", "vulnerability", "CVE", "OWASP", "threat model", "compliance", "is this secure?" | Full-spectrum security: static asset audit, SAST, cloud IaC, threat modeling, compliance, incident response, weekly HTML reports. B1–B7 business severity applied to all findings. |
| `dynamic-scan` | "dynamic scan", "DAST", "OWASP ZAP", "active/passive scan", "baseline scan", "scan my running app", "fuzz endpoints" | Runtime DAST counterpart to `security`. Runs OWASP ZAP via Docker (Automation Framework) against a live Angular / ASP.NET MVC / Web API / Blazor / Razor Pages target, plus npm/pip/NuGet dependency audit. Safe passive default; gated active scans. Auth-verification gate, route seeding, baseline tuning, run-to-run diff, source-mapped fixes, B1–B7 severity. Writes HTML report and `dynamic-scan/dynamic-scan-ledger.md` with FP-fingerprinted findings — use `/fix FP-xxxxxxxx` to apply remediations. |
| `setup-status` | "dream status", "plugin status", "check setup", "is the plugin set up" | Read-only 20-check health report. Never modifies any file. |
| `dream-rollback` | "rollback dream", "undo dream", "reverse dream run", "restore memory" | Reverses a specific dream run from the audit trail. Confirmation required before any change. Rollback is itself logged and reversible. |
| `product-docs` | "generate product detail", "write user guide", "product documentation" | Generates Product Detail Document and/or User Guide as self-contained HTML. Always asks before generating — never creates a document the developer said no to. |
| `sprint-metrics` | "sprint metrics", "ICEA compliance rate", "PR rejection rate", "rework hours" | Measures post-sprint KPIs via ADO REST API. Reads ADO org/project from CLAUDE.md — never hardcoded. |
| `token-analysis` | "analyse token usage", "token cost", "context window usage", "expensive prompts" | Session token analysis with persistent graph cache. Includes skill usage telemetry, prompt rewrite recommendations, and a secrets-safe 200-char truncation rule. |
| `external-dir-map` | Called internally by `setup-init` and `/sync-dirs` — not keyword-triggered | Scans project manifests for module references outside the solution root and writes resolved absolute paths to `.claude/settings.local.json` as `additionalDirectories`. Gives Claude Code access to external projects without manual `--add-dir` flags. Idempotent. |
| `app-readiness` | "is the app production ready", "app readiness", "go-live readiness", "enterprise architecture review" | 8-domain EA/SA production readiness assessment. Reads `architecture-deployment.md` for hosting-model-specific checks. |
| `plugin-readiness` | "is the plugin production ready", "plugin readiness", "AI governance review" | 6-domain AI Architect readiness assessment. Plugin state files only — never reads application source. |
| `critic` | "critique", "second opinion on this spec", "review this before saving", "is this over-engineered", "does this match the ICEA" | Second-pass generator-critic. Auto-runs at three internal gates, each **before the artefact is written** with up to 2 auto-retries: the ICEA draft (`icea-feature` Step 5) and the Tech Spec draft (`icea-feature` Step 8) — both before the `temp/` write — and generated code (`icea-implement` Step 4a) before the disk write. `icea` mode checks completeness/testability/B1–B7/scope; `tech` mode checks ICEA↔design traceability/D-option fidelity/coverage-matrix; `code` mode checks traceability/simplicity/rules/decision-transparency/hidden-assumptions. Ephemeral — no ledger, no fingerprints. Also available standalone via `/critic`. |
| `graph-sync` | "refresh knowledge graph", "update graph", "graph is stale", "sync the graph", "knowledge graph stale" | Incremental knowledge graph refresh. Triggered by `/graph-sync` or keyword detection. Recomputes module-wide fingerprints, regenerates only stale modules, reconciles removed/renamed/orphaned modules, derives typed edges, updates `graph.json` + markdown projection, restructures flat→domain at 30+ modules. |
| `graph-viz` | "visualize the graph", "show the knowledge graph", "graph diagram", "render the dependency graph", "graph visualization" | Renders the knowledge graph as a self-contained offline HTML view (`.claude/graph/graph.html`) — nodes by type, edges by type/confidence, hubs and stale modules flagged, hover shows dependencies/dependents. Reads `graph.json` only; `--3d` uses a locally vendored WebGL library. |
| `icea-approve` | "APPROVE ADO-<id>", "approve the ICEA", "approve tech spec" | Approves an ICEA and Tech Spec by ADO ID, reading all state from disk. Works in any session. Sets `Status: ✅ Approved`, unblocking `icea-implement`. |
| `icea-implement` | "IMPLEMENT ADO-<id>", "implement the ICEA", "generate the code" | Generates and writes implementation code for an approved ICEA read from disk. For Epics, implements story by story. Requires an approved ICEA — refuses otherwise. |
| `icea-revise` | "REVISE ADO-<id>", "revise the ICEA", "update the tech spec" | Revises an existing ICEA/Tech Spec (feedback, resolved open questions, changed requirements) and re-blocks the code-generation gate until re-approved. Never starts from scratch — redirects to `icea-feature` for new features. |
| `icea-status` | "STATUS ADO-<id>", "ICEA status", "where is this feature" | Read-only re-entry point: shows ICEA/Tech Spec state, open questions, tracker progress, open bugs, and the exact next action for an ADO ID. |
| `goal-loop` | "goal loop", "iterate to done", "drive this ADO to done", "/goal-loop ADO-<id>" | Thin cradle-to-grave orchestrator: sequences `icea-feature` → `icea-approve` → `icea-implement`, stopping at every gate and approving nothing on your behalf. The only loop-till-done runs inside `icea-implement` Step 4b, scoring generated code against the approved ACs until met or a hard iteration ceiling. ICEA/Tech Spec are never self-scored — they keep the critic's bounded revise. |
| `operations` | "generate a runbook", "operational runbook", "on-call guide", "support runbook" | Generates the master Operational Runbook (Markdown + offline HTML) from architecture/config/IaC — SRE persona, generation tier, Category B consent (playbook derivation only). Evidence-derived; unknowables become greppable `⚠ TODO` — never fabricated. |
| `go-live` | "go-live checklist", "go/no-go", "support handover gate", "acceptance checklist" | Generates the Support-Transition Acceptance Checklist by ingesting the prod-readiness report + security + code-review ledgers + deployment architecture. EA persona, infrastructure tier, Category C (reads reports/ledgers/architecture only — never application source). Auto-links the Operational Runbook. |
| `setup-sync` | "dream sync", "re-provision after upgrade", "plugin upgrade" | Re-provisions a project after a plugin upgrade — calls the bootstrap script (sync mode) to re-copy hooks and deploy missing stubs, restores missing rules from `deployed_rules[]`, applies migration notes, re-stamps the version. Also runs a **post-sync external stack detection check**: seeds `external_detected_stacks` and `external_stacks_prompted` if absent, detects stacks from existing `additionalDirectories`, or asks the developer for external repo paths if none are configured (once, then suppressed). |
| `upgrade` | "upgrade version", "bump to .NET 8", "UPGRADE ADO-<id>" | In-place same-stack version upgrade; orchestrates a deterministic tool; rejects false-upgrades → Rewrite. Shared migration ledger for status/resume. |
| `rewrite` | "port to", "rewrite in", "translate to", "Java to .NET", "REWRITE ADO-<id>" | Out-of-place generative translation to a new target folder; posture/options/DAG/BAL/ERL, two-gate. |
| `replatform` | "move to cloud", "lift and shift", "on-prem to Azure", "REPLATFORM ADO-<id>" | Hosting/topology migration; NFR/Well-Architected oracle; LLM authors IaC + human-executed runbooks. |
| `dream` | "consolidate memory", "run dream", "/dream" | Memory consolidation pass — reads Claude Code sessions, scores entries by confidence, proposes ADD/UPDATE/DELETE/PROMOTE with justification, applies via tiered approval. Session history + memory only — never reads source. |
| `dream-health` | "memory health", "dream dashboard", "/dream-health" | Generates `memory/health.html` — a self-contained browser dashboard (confidence distribution, decay curve, promote candidates, dream-run history with clickable justification panels). Read-only. |
| `dismiss` | "dismiss finding", "false positive", "won't fix", "/dismiss FP-…" | Dismisses a finding from any ledger (false-positive / wont-fix / accepted-risk / by-design) with a required justification, or `--undo`. Reads/writes ledgers only — never source. |
| `fix` | "apply the fix", "fix FP-…", "/fix FP-…" | Applies a ledger finding's recorded fix directly to the one named source file via str_replace and moves the entry Open→Fixed. No re-analysis. |
| `bug` | "log a bug", "quick bug fix", "/bug ADO-…" | Lightweight bug-fix flow — trimmed Root Cause / Fix / Regression Test spec, one approval, then the fix. Bypasses the full ICEA gate for confirmed defects on existing behaviour. |
| `update-arch` | "refresh architecture docs", "update architecture", "/update-arch" | Targeted architecture-doc refresh — updates only the changed sections of the prose `architecture.md` (and `--deployment` re-runs the deployment questionnaire) without a full re-scan. Delegates to `architect` prompts. |
| `gitignore-sync` | "fix gitignore", "sync ignore file", "/gitignore-sync" | Writes/refreshes the repo's ignore file (managed block) after detecting the VCS (.gitignore on Git, .tfignore on TFVC); `--with-artifacts` also offers detected build/env files. Never touches your own lines. |
| `explain` | "how does X work", "where is Y", "explain the codebase", "/explain" | Answers codebase questions from architecture docs + the knowledge graph; optionally reads ONE source file with explicit consent (Category B). Points you to the exact file for deeper detail. |
| `dream-audit` | "audit memory", "memory quality", "/dream-audit" | Quarterly memory quality audit — flags uncited facts, contradicted promotions, and rollback-prone categories; feeds penalties back into Dream's confidence scoring. Read-only. |
| `session-start` | "warm up", "start session", "load context", "/session-start" | Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context in one pass; flags plugin version drift. Read-only. |
| `setup-init` | "set up the plugin", "initialise project", "/setup-init" | One-time per-project setup — runs the bootstrap (dirs, stubs, hooks, state, ignore file), then choreographs CLAUDE.md via /init, the architect skill, and graph-sync. Safe to re-run. |

---

## Developer Workflow Guide — Commit & Governance

The plugin installs a pre-commit hook (`governance-gate-precommit.cjs`) that runs on every
commit regardless of tool — CLI, VS Code Source Control, Visual Studio, or any Git GUI. It
enforces two gates:

- **ICEA gate** — source code changes require an approved ICEA for the ADO ID on the branch.
- **Security gate** — config file changes are scanned for secrets; env files are blocked if not gitignored.

The CI pipeline (`_project-deploy/ci/icea-gate.yml`) runs the same checks server-side on PRs.
Teams without CI access get enforcement via the pre-commit hook alone.

---

### Feature development

**Branch naming:** `feature/ADO-{ID}-short-description`

1. Create the branch with the ADO ID in the name.
2. Run the ICEA flow: `SAVE PLAN ADO-{ID}` → `SAVE ICEA ADO-{ID}` → `APPROVE ADO-{ID}`.
3. Implement: `IMPLEMENT ADO-{ID}` (gated by Write Gate — each file requires `APPROVE ADO-{ID}`).
4. Commit — the pre-commit hook verifies the approved ICEA exists on disk. ✅

If you commit without an approved ICEA the hook blocks with:
```
🔴 NO APPROVED ICEA: ADO-1234
   Run: SAVE PLAN ADO-1234 → SAVE ICEA → APPROVE ADO-1234
```

---

### Bug fixes

There are two bug tiers depending on urgency:

**Normal bug — `bugfix/ADO-{ID}-short-description`**

A lightweight bug ICEA is required — faster than a feature ICEA (no Tech Spec, simplified Examples, single critic round). Use `/bug ADO-{ID}` to generate the lightweight spec. The pre-commit hook checks for an approved bug ICEA before allowing the commit.

**Hot-fix (production incident) — `hotfix/ADO-{ID}-short-description`**

The ICEA gate is skipped entirely — production fixes must not be blocked by process. The bypass is automatically logged to `.claude/audit/` with the branch name, ADO ID, and timestamp. The PR description must contain `[HOT-FIX ADO-{ID}]`.

```
⚠  HOT-FIX: ICEA gate skipped for src/MyService.cs (bypass logged)
```

The CI pipeline still runs the secret scan and security gate on hotfix branches.

---

### Config file changes

Config files have a different gate than source code — no ADO or ICEA required, but a secret scan is always enforced.

**When Claude makes the config change:**

The Write Gate shows a config-specific prompt before writing:
```
📁 WRITE PENDING — config change
   Path: src/MyApp/appsettings.json
   Secret scan: ✅ clean

   Reply APPROVE CONFIG to write, or SKIP to discard.
```

Reply `APPROVE CONFIG` to write. An audit entry is written automatically. No ADO ID needed.

For high-risk config files (CI/CD pipelines like `azure-pipelines.yml`, IaC like `*.tf`, `*.bicep`), an escalation acknowledgment is required first:
```
⚠ HIGH-RISK CONFIG — this file affects infrastructure/pipeline configuration.
  Confirm you have peer-reviewed this change: reply ACKNOWLEDGE then APPROVE CONFIG.
```

**When you edit config manually (outside Claude):**

The pre-commit hook runs the same secret scan automatically on commit. If secrets are found the commit is blocked:
```
🔴 SECRET DETECTED in appsettings.json: hardcoded password
   Remove credentials before committing.
```

High-risk config changes (CI/CD, IaC) are allowed through but emit a warning and write an audit entry for traceability.

---

### Environment files

`.env`, `.env.local`, `.env.production`, and any `.env.*` file are hard-blocked if they appear in a commit and are not in `.gitignore`. There is no bypass for this — env files must never be committed.

```
🔴 ENV FILE COMMITTED: .env.local
   Add to .gitignore immediately — env files must never be committed.
   Add to .gitignore: echo ".env.local" >> .gitignore
```

Run `/gitignore-sync` to ensure all env files are covered in `.gitignore`. The `setup-init` command does this automatically on first setup.

---

### CI gate (teams with pipeline access)

Copy the task template from `_project-deploy/ci/icea-gate.yml` into your project's `azure-pipelines.yml`. It runs `validate-governance.cjs` on every PR — the same script as the pre-commit hook.

If a developer bypassed the pre-commit hook with `--no-verify`, the CI gate catches it server-side before the PR can merge. The `.env` block and secret scan have no bypass path at either layer.

---

### Quick reference

| Scenario | Branch prefix | Gate | Bypass? |
|---|---|---|---|
| New feature | `feature/ADO-{ID}-*` | Full ICEA required | No |
| Bug fix | `bugfix/ADO-{ID}-*` | Lightweight bug ICEA required | No |
| Production hot-fix | `hotfix/ADO-{ID}-*` | ICEA gate skipped | Yes — audited automatically |
| Config change via Claude | any | `APPROVE CONFIG` + secret scan | No (secret scan has no bypass) |
| Config change manual | any | Pre-commit secret scan | No (secret scan has no bypass) |
| Env file committed | any | Hard blocked | No |

---

### Keeping the plugin up to date

`setup-status` checks whether a new released version of the plugin is available in your local
plugin repo and always reminds you to pull:

```
  plugin release    ⚠️  v3.26.0 (2026-09-20) available — run /setup-sync to apply
                        ℹ git pull in /path/to/plugin to check for remote updates
```

**To update the plugin in a project:**

1. Pull the plugin repo:
   ```bash
   # In your local plugin repo directory:
   git pull
   ```
2. Run `setup-sync` in the target project to apply the update.
3. Run `setup-status` to confirm the version is current.

**For plugin maintainers — releasing a new version:**

```bash
npm run bump:patch    # or bump:minor / bump:major
# Fill in CHANGELOG.md stub
npm run release
git push origin main && git push origin v{N}
```

CI validates tests and version consistency on the tag push. Full release guide: [DEVELOPER-GUIDE.md — Releasing a new version](DEVELOPER-GUIDE.md#releasing-a-new-version).

---

## How this plugin evolved

The current feature set reflects continuous iteration driven by three architectural lessons:

**Stateless skills are expensive.** The original plugin treated each skill as an independent unit. Code review re-scanned all 50 files daily even when only 2 changed. The ICEA skill read source files to orient itself. The security skill loaded Python, JS, and Java reference material for a pure C# codebase. The shared primitives layer — the knowledge graph, file-cache, scope flags — reduced daily review token cost by 80–95% after the first baseline run.

**Orientation documents beat source reads.** Every skill that read source files for structural context was replaced with architecture doc + knowledge-graph reads. The graph is generated once and read in milliseconds. The source scan it replaces added latency to every single invocation. The `architecture-deployment.md` file extends this: hosting model, auth strategy, and environment config are captured once and available to every skill that needs them.

**Governance must be explicit and auditable.** The source-file-consent spec, business-context-severity spec, and the structural validator (`tests/validate.py`) exist because informal conventions drift. Every skill now has a declared consent category. B1–B7 sensitivity flags appear in ICEA acceptance criteria — not just in security findings. The validator catches structural drift before it ships.

## Design philosophy

Every skill and rule in this plugin enforces two overarching principles:

> **Do not over-complicate. Prefer the simplest solution that correctly solves the problem.**

> **Never read source files without telling the developer why.**

This is enforced globally via `rules/project-rules.md` and is always present in `CLAUDE.md`. It applies to every piece of code the plugin generates, reviews, or validates.

| Principle | What it means in practice |
|---|---|
| **Simplicity** | If a simpler approach exists, take it — even if it means more lines. Complexity without a concrete requirement is a defect. |
| **Readability** | Code is read far more often than written. Optimise for the reader, not the writer. Self-documenting names over clever shortcuts. |
| **Maintainability** | Explicit and self-contained over clever abstractions. A future developer should understand and change any piece without reading the whole codebase. |
| **Testability** | No hidden side effects, no global state, no deep coupling. Code that cannot be unit-tested without heroic effort is a design smell. |

The code review and ICEA skills will flag violations — over-engineered abstractions, unnecessary generics, premature optimisation, and deep coupling are treated as findings, not style preferences.

---

## Rules (scoped — auto-loads per file type)

The plugin ships **~44 layered rule files** organised into base languages, ecosystem overlays,
framework overlays, and cross-cutting concerns ([ADR 0043](docs/adr/0043-ecosystem-and-layered-rule-organisation.md)).
`/setup-init` does **not** deploy them all — it runs **scored stack-key detection** ([ADR 0059](docs/adr/0059-scored-stack-key-detection-and-rule-deployment.md))
and deploys only the rule files whose stack crosses the confidence threshold, so a .NET 10 API
never draws legacy `csharp-framework48`/`ado-net-legacy` rules. Deployed rules activate
automatically when Claude edits a file matching the rule's `paths` glob.

| Layer | Example rule files | What they enforce |
|---|---|---|
| **Always-on** | `project-rules.md` | Scope control, no hardcoded secrets, no `any` in TypeScript, no `TODO` without ADO item, decision transparency |
| **Base languages** | `csharp-dotnet-rules.md`, `nodejs-typescript-rules.md`, `angular-rules.md`, `java-rules.md`, `python-rules.md`, `javascript-rules.md`, `css-rules.md` | Clean Architecture / ProblemDetails / Azure AD (.NET); standalone components, OnPush, async pipe, WCAG 2.1 AA (Angular); Zod + AppError + no PII in logs (Node); Spring Boot layering + Bean Validation (Java); type hints + mypy + boundary validation (Python) |
| **Ecosystem overlays** | `react-ecosystem-rules.md`, `nextjs-ecosystem-rules.md`, `nuxt-ecosystem-rules.md`, `remix-ecosystem-rules.md`, `solid-ecosystem-rules.md`, `astro-ecosystem-rules.md`, `sass-rules.md`, `css-modules-rules.md` | Framework-specific conventions layered on top of the base language rule |
| **Framework overlays (legacy .NET)** | `csharp-framework48-rules.md`, `ef6-rules.md`, `wcf-rules.md`, `ado-net-legacy-rules.md`, `csharp-vsto-rules.md` | Patterns for brownfield .NET Framework 4.x / EF6 / WCF / classic ADO.NET / VSTO code |
| **Data access** | `data-access-rules.md`, `postgresql-rules.md`, `nosql-document-rules.md`, `prisma-drizzle-rules.md` | Dapper + parameterised SQL (never EF Core/ORM); DB-specific patterns |
| **Cross-cutting** | `api-security-rules.md`, `auth-rules.md`, `rest-api-rules.md`, `graphql-server-rules.md`, `observability-rules.md`, `caching-rules.md`, `cypress-rules.md`, `playwright-rules.md` | API security, auth, REST/GraphQL contracts, observability, caching, e2e testing |

---

## Token efficiency architecture

After the first run, token cost drops **60–95% per invocation** through shared infrastructure.

### How it works

| Primitive | Written by | Read by | Purpose |
|---|---|---|---|
| `.claude/architecture/architecture-deployment.md` | `architect` Step 0.5 | `icea-feature`, `app-readiness`, `plugin-readiness` | Hosting model, auth strategy, environments, CI/CD, **non-functional requirements** — captured once, used by multiple skills |
| `.claude/architecture/architecture-security.md` | `architect` File 6 | `security`, `icea-feature`, `icea-review`, `app-readiness` | Trust zones + authorization model (Action → Role/Policy → Enforced-at) — the security review's authz map |
| `skills/shared/source-file-consent.md` | maintainers | all skills and commands | Category A/B/C consent — when to announce, when to gate, when to never read source |
| `skills/shared/business-context-severity.md` | maintainers | all review skills, `icea-feature` | B1–B7 override triggers — immigration IDs, privileged matter data, vulnerable clients |
| `skills/shared/findings-gate.md` | maintainers | `checkin`, `pr-create` | Canonical detection logic for open Critical/High findings across all three ledgers |
| `skills/shared/dismissed-findings-reconciliation.md` | maintainers | `code-review`, `security`, `dynamic-scan` | Canonical Rule 5 — dismissed finding reconciliation; keeps dismissals stable across re-scans unless code changes |
| `.claude/file-cache.json` | `code-review`, `security` | `code-review`, `security`, `setup-status` | Character count per file — skills skip files unchanged since last scan |
| `.claude/architecture/*.md` | `architect` skill | `icea-feature`, `icea-review`, `explain`, `security`, `app-readiness` | 8-doc set: system overview + two Mermaid diagrams (End-to-End, Layered), call chains/flows, reference, **data model**, **integrations & resilience**, **security (trust zones + authorization model)**, and an append-only **decision log** |
| `token-analysis/token-graph.json` | `token-analysis` | `token-analysis`, `setup-status` | Session + file delta cache — only new sessions processed |
| `.claude/graph/graph-index.md` + per-module detail files | `architect` (Step 7), `graph-sync` | `icea-feature`, `icea-review`, `code-review`, `security`, `explain`, `session-start`, `setup-status` | **The single codebase-orientation layer** — module → entry point (index) + bounded context/key files/dependencies/patterns (per-module, ≤400 tokens); per-module SHA-1 fingerprint, git-hook staleness. Committed & PR-reviewed. Replaced `domain-map.md` in v3.0.0 (ADR 0038). |

### Scope flags (code-review and security)

| Flag | Behaviour |
|---|---|
| `--changed` | Only git-staged and unstaged modified files |
| `--pr` | Only files changed in this branch vs base branch |
| `--full` | Force full scan — ignore cache |
| `--ci` | CI mode: same as `--full`, plus warns if a cache file is found on disk |
| `--area backend` | Only `.cs` files |
| `--area frontend` | Only `.ts` and `.html` files |
| `--area <Name>` | Entry-point + key files for that knowledge-graph module |
| `--continue` | Resume from checkpoint after a connection drop |
| (none) | Default: cache-aware full-project scan (no file cap) |

### Generated files — do not commit

Regenerable, secret, and per-developer files are gitignored by `setup-init`:

```
.claude/settings.local.json     # secrets + machine-specific permissions
.claude/file-cache.json
CodeReviews/*                    # dated reports (the ledger is shared — see below)
security/*
dynamic-scan/*                   # incl. *.session/*.context — may hold plaintext creds
token-analysis/
memory/health.html
prod-readiness/
```

> **Shared, not gitignored (team knowledge & tracking state):**
> - **`.claude/settings.json`** — team config (hooks, `customInstructions`, non-secret
>   `env`). Secret-free by policy; a write-time + pre-commit guard
>   (`.claude/hooks/check-settings-secrets.cjs`) blocks any secret from landing here.
> - **`.claude/architecture/`** — the architecture doc set (durable, prose, no secrets).
> - **The three review ledgers** — `CodeReviews/code-review-ledger.md`,
>   `security/security-ledger.md`, `dynamic-scan/dynamic-scan-ledger.md` — shared via
>   `!<dir>/<ledger>.md` negations so fingerprints/dismissals travel with the repo while
>   the bulky dated reports stay ignored.
> - **`.claude/graph/`** — the knowledge graph, the single orientation layer,
>   version-controlled and PR-reviewed like source (v3.0.0). See
>   [ADR 0038](docs/adr/0038-knowledge-graph-orientation.md).

---

## Model routing

### Default routing

| Task type | Skills | Default model |
|---|---|---|
| **Generation** — ICEA planning, code generation, ADO task breakdown | `icea-feature`, `ado-tasks`, `pr-describe`, `product-docs` | `claude-opus-4-8` |
| **Review** — compliance checks, static analysis, security scanning, spec review, dynamic scanning | `icea-review`, `code-review`, `security`, `dynamic-scan`, `pr-spec-review`, `pr-create` gate | `claude-sonnet-4-6` |
| **Infrastructure** — Dream, architect, session tools, operational, readiness | `dream`, `architect`, `setup-status`, `dream-rollback`, `session-start`, `update-arch`, `sprint-metrics`, `token-analysis`, `checkin`, `explain`, `fix`, `bug`, `app-readiness`, `plugin-readiness` | `claude-sonnet-4-6` |

### Why this split

**Opus for generation:** ICEA planning and code generation are the most consequential tasks. A thin ICEA causes rework. Bad generated code blocks the PR gate. Opus produces tighter specs and more architecturally sound code.

**Sonnet for reviews:** Reviews are analytical pattern-matching, not creative generation. Sonnet is fully capable of vulnerability detection, ICEA compliance checking, and code analysis — and is faster, reducing connection timeout risk on long security scans.

### Overriding the defaults

Non-secret model routing goes in the **shared, committed** `.claude/settings.json`:

```json
// .claude/settings.json — committed & team-shared (NO secrets)
{
  "env": {
    "ICEA_MODEL":   "claude-opus-4-8",
    "REVIEW_MODEL": "claude-sonnet-4-6",
    "INFRA_MODEL":  "claude-sonnet-4-6"
  }
}
```

The secret PAT goes in the **gitignored** `.claude/settings.local.json` (or an OS env var).
Claude Code merges `settings.local.json` over `settings.json` at runtime:

```json
// .claude/settings.local.json — gitignored; never committed
{
  "env": { "AZURE_DEVOPS_PAT": "your-pat-here" }
}
```

Model defaults are recorded in `.claude-plugin/plugin.json` under `recommended_models` with a `last_reviewed` date. `setup-status` warns when this date is older than 90 days.

---

## PR compliance gate

`pr-create` automatically runs `icea-review` before showing the confirmation prompt:

| icea-review verdict | pr-create behaviour |
|---|---|
| ✅ Ready for review | Proceeds to confirmation with compliance badge |
| ⚠️ Needs work | Shows warnings in confirmation — developer can proceed or fix first |
| ❌ Blocked | Halts PR creation — shows block reason and required action |

To bypass in an emergency: add `--skip-icea-check`. The bypass is always noted in the PR description.

---

## Prerequisites — Azure DevOps PAT

The `sprint-metrics` and `app-readiness` skills use the ADO REST API and require a PAT. `pr-create` requires a PAT **only when the remote is Azure DevOps** — for a GitHub remote it uses the `gh` CLI / a GitHub token instead (provider auto-detected):

| Skill | Required scope |
|---|---|
| `pr-create` | Code → Read & Write |
| `sprint-metrics` | Work Items → Read, Code → Read |
| `app-readiness` | Pipelines → Read, Environments → Read, Service Connections → Read |

### Store the PAT

**Option A — Windows User Environment Variable (recommended)**

Win + S → `environment variables` → User variables → New → `AZURE_DEVOPS_PAT` = token → restart VS Code

**Option B — Claude Code project settings (local, gitignored)**

```json
// .claude/settings.local.json — gitignored; secrets live here, never in settings.json
{
  "env": {
    "AZURE_DEVOPS_PAT": "paste-your-token-here"
  }
}
```

> ⚠️ Put the PAT in `.claude/settings.local.json` (gitignored), **never** in the shared
> `.claude/settings.json`. `setup-status` (check 1i) flags a ❌ Red **credential leak risk**
> if the secret store `settings.local.json` is not ignored, and a ❌ Red **secret in shared
> config** if a secret is found inside `settings.json`. A write-time + pre-commit guard
> (`check-settings-secrets.cjs`) blocks a secret from reaching `settings.json`.

---

## Installation

### Quick start — one command per platform

| Platform | Command | Notes |
|----------|---------|-------|
| Windows (CMD / PowerShell / Explorer) | `install.cmd` | Auto-selects a runtime: **Git Bash → Node.js → PowerShell** |
| Windows (Git Bash terminal) | `bash install.sh` | Uses bash directly (auto re-execs under `winpty`) |
| macOS / Linux | `bash install.sh` | Uses bash directly |

`install.cmd` is the simplest entry point on Windows — it finds whichever runtime you have
and forwards your arguments (`--update`, `--uninstall`, `--yes`). All three underlying
installers remain fully usable on their own:

```powershell
.\install.ps1          # PowerShell (switches: -Update / -Uninstall / -Yes)
```
```bash
bash install.sh        # Git Bash / macOS / Linux (flags: --update / --uninstall / --yes)
```
```
node install.cjs       # Universal fallback (flags: --update / --uninstall / --yes)
```

> **Flag note:** `install.ps1` uses PowerShell switches (`-Update`), while `install.sh`
> and `install.cjs` use `--update`-style flags. `install.cmd` translates automatically when
> it delegates to PowerShell, so you can always pass the `--update`/`--uninstall`/`--yes`
> form regardless of which runtime ends up running.

The install scripts auto-detect the plugin source from the directory they are run from — no ADO clone option and no path prompt. Run from the plugin source directory. Identity (org/project/company) is still prompted on a fresh install and saved to `.claude-plugin/config.json`.

To update the installed copy after modifying plugin source:

```
/setup-sync --reinstall      # from the plugin source project
/setup-sync --commands       # from each target project (deploys command stubs)
```

> **Windows Git Bash note:** mintty (Git Bash's terminal) doesn't give a child process a
> usable console, which makes interactive prompts hang after the first one. `install.sh`
> now detects this and **transparently re-execs itself under `winpty`** (bundled with Git
> for Windows), so plain `bash install.sh` just works — no `winpty` prefix needed. If your
> Git install somehow lacks `winpty`, run `winpty bash install.sh`, or use `.\install.ps1`
> in PowerShell (recommended on Windows).

---

## First-time project setup

Open the project in Claude Code and run:

```
/ai-assisted-development:setup-init
```

This seeds all infrastructure in order:

1. Creates `memory/MEMORY.md` and `dream-log.md`
2. Deploys **43** command stubs to `.claude/commands/` (one per command; all include a `--help`/`?help` flag for usage discovery)
3. Deploys scoped rule files to `.claude/rules/`
4. Appends Dream sections to `CLAUDE.md` (or creates it via `/init`)
5. Seeds `.claude/file-cache.json`
6. **Runs the architect deployment questionnaire** — captures hosting model, CI/CD, auth strategy, environments to `architecture-deployment.md`. Required by `app-readiness` and `icea-feature`.
7. Runs the architect skill — detects repo type, populates `.claude/architecture/`, generates the knowledge graph `.claude/graph/` (index + per-module detail files with fingerprints)
7b. Generates the codebase knowledge graph in `.claude/graph/` — one index file plus per-module detail files (max 400 tokens each). Installs `post-merge` and `post-checkout` git hooks for stale-detection.
8. Seeds `token-analysis/token-graph.json`
9. Creates or updates `.gitignore` — plugin entries added automatically; full repo walk prompts developer to add `bin/`, `obj/`, `.env`, and other artifact patterns found on disk

After setup, confirm everything is green:

```
/ai-assisted-development:setup-status
```

This checks all **23** infrastructure checks including `architecture-deployment.md` and the knowledge graph.

---

## Usage

### Session warm-up (run every session)

```
/ai-assisted-development:session-start
```

Loads stack, last decision, last fix, and sessions-since-dream in one pass. Surfaces any Red items without running the full health check.

### Check plugin health

```
/ai-assisted-development:setup-status
```

Reports green/amber/red on all **23** infrastructure checks (`1a`–`1u`, plus sub-checks `1a-ii` and `1c-bis`):

1. `1a` `CLAUDE.md` — exists and has the Dream section
2. `1a-ii` CLAUDE.md identity placeholders — §2 Azure DevOps org/project resolved
3. `1b` `memory/` — both files present
4. `1c` `.claude/rules/` — detected-stack rules deployed (per `_deploy-manifest.json`)
5. `1c-bis` .NET version-detection freshness — `versions[]`/fingerprint current (v3.19.0)
6. `1d` `.claude/commands/` — all 43 command stubs deployed (all have `--help`/`?help`)
7. `1e` `.claude/architecture/` — templates populated by the architect skill (incl. `architecture-deployment.md`)
8. `1f` `.claude/graph/graph-index.md` — orientation graph present
9. `1g` `.claude/file-cache.json` — seeded and valid
10. `1h` `token-analysis/token-graph.json` — seeded and valid
11. `1i` ignore-file coverage — all generated files protected
12. `1j` Dream rollback log — no rollback left un-consolidated
13. `1k` skill usage — top invoked skills from token-graph
14. `1l` model-version freshness — defaults reviewed within the last 90 days
15. `1m` production-readiness reports — app and plugin reports present and fresh
16. `1n` skipped gitignore entries — sensitive-pattern check
17. `1o` open findings — Critical/High count across all three ledgers
18. `1p` enforcement-floor integrity — hooks present and wired
19. `1q` Phase D coverage health
20. `1r` plugin version drift — provisioned version matches installed
21. `1s` knowledge graph — `graph-index.md` exists
22. `1t` knowledge-graph freshness — all module fingerprints current
23. `1u` knowledge-graph stale flag — no pending refresh from a git hook

### Production readiness

```
/ai-assisted-development:app-readiness      # application readiness (8 domains)
/ai-assisted-development:plugin-readiness   # AI plugin readiness (6 domains)
```

Run before any production deployment. Both produce self-contained HTML reports in `prod-readiness/`. `setup-status` tracks report age and warns when reports are stale.

### Code review

```
/ai-assisted-development:code-review              # cache-aware full scan
/ai-assisted-development:code-review --changed    # only staged/modified files
/ai-assisted-development:code-review --pr         # only files in this branch vs dev
/ai-assisted-development:code-review --full       # force full scan, ignore cache
/ai-assisted-development:code-review --ci         # CI mode: full scan + cache-presence warning
/ai-assisted-development:code-review --area backend  # .NET files only
```

Reports are written to `CodeReviews/`. A running ledger (`code-review-ledger.md`) tracks findings across runs. Use `/fix FP-xxxxxxxx` to apply any finding's remediation directly to source.

### Pre-commit check

```
/ai-assisted-development:checkin
```

Runs code quality + ICEA compliance + secrets scan + open security/DAST findings check (Check D) in one pass. Produces a unified pass/fail verdict and a pre-filled commit command if everything passes.

### Security review

```
/ai-assisted-development:security-review           # cache-aware, lazy language loading
/ai-assisted-development:security-review --pr      # PR-scoped
/ai-assisted-development:security-review --full    # force full scan
```

Reports written to `security/`. A running ledger (`security/security-ledger.md`) tracks findings across runs with FP-fingerprint IDs — use `/fix FP-xxxxxxxx` to apply remediations.

Static asset directories (`public/`, `wwwroot/`, `assets/`) are audited first — before SAST analysis — because exposed data files are the highest-risk finding class.

### Sprint metrics

```
/ai-assisted-development:sprint-metrics sprint=Sprint 5
/ai-assisted-development:sprint-metrics from=2026-05-01 to=2026-05-31 capacity=320
```

### Memory consolidation

```
/ai-assisted-development:dream
```

Run every 5–8 sessions. Works in 6 phases: session discovery → inventory → score → propose → tiered approval → log.

---

## Source file consent

Every skill operates under one of three consent categories (defined in `skills/shared/source-file-consent.md`):

| Category | Who | Behaviour |
|---|---|---|
| **A — Implicit** | `/code-review`, `/security-review`, `/checkin` | Developer consented by invoking the command. Skill announces scope before touching any file. |
| **B — Explicit gate** | `icea-review`, `pr-spec-review`, `/bug`, `/update-arch`, `/explain`, `app-readiness` (Phase 3), `pr-create` (via icea-review) | Before reading any source file, the skill asks: which file, why, what it's looking for, token cost. |
| **C — Hard rule never** | `session-start`, `setup-status`, `dream`, `dream-rollback`, `ado-tasks`, `sprint-metrics`, `token-analysis`, `dream-health`, `icea-feature`, `pr-describe`, `plugin-readiness` | Must never read source files regardless of instruction. |

## CI integration

```yaml
# Azure DevOps pipeline example
- script: |
    claude /ai-assisted-development:code-review --ci
    claude /ai-assisted-development:security-review --ci
  displayName: 'AI-assisted review'
  env:
    ANTHROPIC_API_KEY: $(ANTHROPIC_API_KEY)
```

Never commit `.claude/file-cache.json` or `token-analysis/token-graph.json` from CI.

---

## Testing and validation

### Structural validator (no API key required)

```bash
node tests/validate.js        # primary, Node — 270+ structural checks
python3 tests/validate.py     # legacy secondary (subset)
```

Runs 270+ structural consistency checks in under a second. Catches stub count mismatches, stale check counts, missing consent table entries, inline spec duplication, deploy-stub delegation drift, stack-key detection gaps, and more. Run before every release.

### Skill scenario tests

```bash
node tests/runner.js                          # all skill scenarios (one YAML per skill)
node tests/runner.js --skill icea-feature     # one skill
```

Requires `ANTHROPIC_API_KEY`. Estimated cost: ~$0.02 per full run.

---

## Repo structure

```
ai-assisted-development/
├── .claude-plugin/
│   └── plugin.json
├── commands/                                ← command files
│   ├── dream.md / dream-health.md / setup-init.md
│   ├── setup-status.md / dream-rollback.md
│   ├── session-start.md / update-arch.md
│   ├── code-review.md / security-review.md / dynamic-scan.md
│   ├── bug.md / checkin.md / explain.md / fix.md
│   ├── app-readiness.md / plugin-readiness.md
│   ├── token-analysis.md / sprint-metrics.md / product-docs.md
│   ├── ado-tasks.md / icea-feature.md / critic.md
│   └── graph-sync.md                        ← knowledge graph refresh
├── skills/
│   ├── shared/                              ← cross-skill primitives
│   │   ├── README.md
│   │   ├── source-file-consent.md           ← Category A/B/C for all skills and commands
│   │   ├── business-context-severity.md     ← B1–B7 override triggers
│   │   ├── scope-flags-spec.md              ← --changed/--pr/--full/--ci/--area
│   │   ├── file-cache-schema.md             ← .claude/file-cache.json schema
│   │   ├── single-writer-assumption.md      ← concurrency constraints
│   │   ├── model-routing-spec.md            ← model routing tiers, env vars, defaults
│   │   ├── graph-index-schema.md            ← .claude/graph/graph-index.md schema
│   │   └── graph-module-schema.md           ← .claude/graph/<module>.md schema
│   ├── architect/                           ← deployment questionnaire + knowledge graph generation
│   │   └── templates/_shared/ + <stack>/    ← architecture-doc templates: shared base + per-stack overrides (ADR 0051)
│   ├── icea-feature/                        ← ICEA gate with B1–B7 AC flags
│   ├── icea-review/ / pr-describe/ / pr-create/ / pr-spec-review/
│   ├── code-review/ / security/ / dynamic-scan/ / ado-tasks/
│   ├── app-readiness/ / plugin-readiness/
│   ├── setup-status/ / dream-rollback/
│   ├── sprint-metrics/ / token-analysis/ / product-docs/
│   ├── graph-sync/                          ← knowledge graph incremental refresh
│   └── (command stubs moved to _project-deploy/commands/)
├── _project-deploy/                         ← hooks/, rules/, commands/, skills/ — deployed to target projects
├── memory/
├── tests/
│   ├── runner.js                            ← Node.js test runner
│   ├── validate.js / validate.py            ← structural consistency checkers
│   └── skill-scenarios/                     ← YAML scenario files (all skills covered)
├── .gitignore / CLAUDE.md / CHANGELOG.md
├── install.ps1 / install.sh
├── guides/                                  ← HTML guides — plugin-guide.html · user-guide.html · developer-guide.html
├── DEVELOPER-GUIDE.md                        ← contributor guide (Markdown)
└── README.md
```
