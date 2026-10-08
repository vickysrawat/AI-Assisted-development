# Feature Plan — Copilot Migration Extension
ADO #9020 · Release 3 · Sprint 13

---

## Problem Statement

The migration family (Upgrade · Rewrite · Replatform) is only accessible via Claude Code,
requiring the Claude Code CLI and an Anthropic subscription. Developers on GitHub Copilot
Business/Enterprise have no access to these workflows and must run migrations manually — a
process that is error-prone and produces inconsistent Gap & Risk analysis. The Phase 1 spike
(ADO-9020 pre-work) validated the VS Code Chat participant mechanics (all 7 criteria passed);
Phase 3 converts that scaffold into a production VS Code extension delivering all three migration
skills through @migration in Copilot Chat. Success is measurable: a developer with only a
Copilot subscription can complete a full Upgrade intake — stack detection, Gap & Risk report,
Write Gate approval, and file write to disk — without opening Claude Code.

## Story

As a developer using GitHub Copilot, I want to run `@migration upgrade/rewrite/replatform`
from Copilot Chat, so that I receive AI-guided migration analysis and decision-grade reports
without needing a separate Claude Code subscription or context switch.

## Personas

**Dev on Copilot** — GitHub Copilot Business/Enterprise user · migrating .NET 8→10,
Angular 17→19, or on-prem→Azure · frustrated by needing Claude Code just for migrations ·
success = completes intake + receives report without leaving VS Code.

**Tech Lead** — owns the migration go/no-go decision · needs decision-grade Gap & Risk reports
accurate enough for stakeholder review · frustrated when reports miss breaking changes or
deprecated APIs · success = judge-gate analysis is high enough quality to replace a manual
migration spike.

**Platform Engineer** — manages org-wide extension deployment · success = extension installs
cleanly as a VSIX / Marketplace item, PAT management needs no help desk.

## Feature Priority (MoSCoW)

**Must Have:**
- Upgrade skill: full TypeScript stage machine (intake → gap/risk → write gate → report).
  Rationale: highest-frequency migration; spike proved the path; blocks release if absent.
- Rewrite skill: full stage machine through options + architecture gates (worktree/cluster
  generation deferred — see Won't Have).
  Rationale: most complex skill; options + architecture deliverable without worktrees.
- Replatform skill: full stage machine through 6R posture + NFR spec + IaC authoring.
  Rationale: on-prem→Azure is active demand; IaC output is the primary deliverable.
- Anthropic API key model routing with Copilot model fallback (from spike).
- HIGH-risk judge gates: WARN when no Anthropic key + require explicit developer
  acknowledgment before continuing with Copilot model (never silently degrade).
- Write Gate enforced via `migration.approve` VS Code command + workspaceState (from spike).
- ADO PAT stored in VS Code SecretStorage (from spike).
- Vendored scripts: migration-source-detect.cjs, repo-detect.cjs, stack-signals.cjs,
  checkpoint-ledger.cjs, resolve-migration-roots.cjs committed to copilot-extension/scripts/.
- Marketplace-ready structure: correct publisher, icon, categories, contributes schema —
  even though Sprint 13 ships as VSIX only.

**Should Have:**
- Judge ladder: Anthropic escalation for HIGH-risk gate decisions (critic gates).
- Ledger persistence: checkpoint JSON written to workspace disk, survives session reload.
- Multi-root workspace support (resolve-migration-roots.cjs wrapped via require()).

**Could Have:**
- ADO REST API calls (task creation, PR description) using stored PAT.
- Progress reporting via vscode.window.withProgress for long-running stages.

**Won't Have (this sprint — with deferral reason):**
- Rewrite git worktree generation: VS Code extension host state management across worktrees
  is not feasible in sprint; deferred to V2.
- Rewrite cluster code generation: depends on worktrees; deferred with worktrees.
- Full Claude Code parity (hooks, audit trail, dream memory): different execution model;
  out of scope permanently for the Copilot channel.

## Release Plan

**MVP (Sprint 13):** Upgrade full stage machine + Rewrite options/architecture gates
(no worktrees) + Replatform IaC authoring + Write Gate + Anthropic/Copilot routing +
HIGH-risk warning gate. Ships as VSIX, Marketplace-ready structure.
_User outcome: developer can run any of the 3 migration skills end-to-end through Copilot
Chat and receive a file-written report._

**V2 (future):** Rewrite worktree + cluster generation + ADO REST API + Marketplace publish.

## Bundling Architecture

**Decision: Option A — Vendor (self-contained extension).**
Options B (npm package) and C (monorepo) were evaluated and rejected:
- B requires a private npm registry — infrastructure cost not justified for Sprint 13.
- Full C requires repo restructure (all existing paths shift to `plugin/` subfolder) — too
  disruptive. Lightweight C assumes co-location which contradicts the standalone deployment goal.

The `copilot-extension/` folder is structured as a fully standalone product:
- No runtime dependency on the Claude Code plugin repo.
- No build-time dependency on the plugin repo.
- All shared scripts vendored into `copilot-extension/scripts/` and committed.
- The extension team owns and maintains their vendored copies independently.
- Deploys as a VSIX on any developer machine without the plugin installed.

## Assumptions

1. Spike patterns (require() over execFile, process.execPath patching) hold for the full
   implementation — **verified in Phase 1 spike**.
2. Vendored scripts bundle as committed assets in copilot-extension/scripts/ without
   install-time side effects — **verified in spike**. Extension team maintains their copies.
3. vscode.chat + vscode.lm APIs are stable in VS Code 1.90+ — **verified in spike**.
4. Upgrade SKILL.md stage flow (3 gates, auto-advance) maps to a TypeScript state machine
   without material behavioral loss — **unverified**; gap analysis needed in Sprint 13.
5. Rewrite options + architecture gates (no cluster/worktree) are deliverable without git
   worktree management — **unverified**; depends on how options.md writes are structured.
6. BAL/ERL assurance measurement can be expressed as structured Anthropic prompts with the
   judge model — **unverified**.

## Risks

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | SKILL.md → TypeScript fidelity: 3×~400-line Markdown → state machines may miss edge cases; behavioral regression vs Claude Code baseline | M | H | Side-by-side output comparison testing before sign-off |
| 2 | Judge ladder quality: Copilot model may not catch HIGH-risk breaking changes at the same rate as claude-opus-4-6 | M | H | Require Anthropic key for HIGH-risk gates; WARN + ack rather than silent degrade |
| 3 | Rewrite options gate without worktrees: Rewrite skill design assumes worktrees exist before options approval; Stage 2 may be partially incomplete | M | M | Scope clearly to "options doc only" in ACs; gate verbiage states worktrees deferred |
| 4 | Extension host memory on large codebases: graph.json + multiple migration scripts via require() may exhaust Node heap on monorepos | L | M | Lazy-load modules; cap graph reads |

## Pre-mortem

"This shipped and failed. What went wrong?" — The extension shipped but the Upgrade stage
machine silently produced incorrect Gap & Risk reports — it missed breaking changes that the
Claude Code skill (via SKILL.md instruction following) would have caught, because the TypeScript
state machine simplified or omitted a gate. A developer approved an upgrade based on the report,
hit runtime failures in production, and traced them back to the missed ACs. Lesson: the stage
machine must be validated against the SKILL.md gate list before shipping; the judge escalation
must be enforced for HIGH-risk gates, not optional.

## Dependencies

| # | Dependency | Owner | Blocking |
|---|---|---|---|
| 1 | Phase 1 spike (copilot-migration-spike/) — complete ✅ | Plugin team | No |
| 2 | Upgrade/Rewrite/Replatform SKILL.md gate lists (state machine fidelity source) | Plugin team | Yes |
| 3 | VS Code 1.90+ with Copilot Chat activated on developer machine | Developer | Yes |
| 4 | Node.js on system PATH (for resolveNodeExe()) | Developer | Yes |

## Open Questions

| # | Question | Decision |
|---|---|---|
| 1 | Folder name and bundling strategy | ✅ DECIDED: copilot-extension/ as standalone self-contained folder; Option A vendor — scripts committed to extension/scripts/ |
| 2 | VSIX vs Marketplace for Sprint 13 | ✅ DECIDED: VSIX sufficient for Sprint 13; structure Marketplace-ready from day 1 (publisher, icon, categories, schema) |
| 3 | HIGH-risk gate behavior without Anthropic key | ✅ DECIDED: WARN prominently + require explicit developer acknowledgment to continue with Copilot model; never silently degrade |
