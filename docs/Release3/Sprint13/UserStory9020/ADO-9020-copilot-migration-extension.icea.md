# ICEA — Copilot Migration Extension (Phase 3 Full Implementation)
ADO #9020 · Release 3 · Sprint 13
Status: ✅ Approved

---

## Intent

### Goal
Deliver a standalone VS Code extension that exposes the Upgrade, Rewrite, and Replatform migration skills through the `@migration` Copilot Chat participant, so developers on GitHub Copilot subscriptions can run AI-guided migration workflows without a Claude Code subscription.

### Problem Statement
The migration family (Upgrade · Rewrite · Replatform) is only accessible via Claude Code, which requires the Claude Code CLI and an Anthropic subscription. Developers on GitHub Copilot Business/Enterprise have no path to these workflows and must perform migrations manually — a process that is error-prone and produces inconsistent Gap & Risk analysis. The Phase 1 spike (ADO-9020 pre-work) validated the VS Code Chat participant mechanics across all 7 test criteria. Phase 3 converts that scaffold into a production extension where any developer with a Copilot subscription can run `@migration upgrade`, `@migration rewrite`, or `@migration replatform` from Copilot Chat and receive a file-written decision-grade report. Success is observable: a developer with only a Copilot subscription completes a full Upgrade intake — stack detection, Gap & Risk report, Write Gate approval, and file write to disk — without opening Claude Code or a terminal.

### Business Impact
Every manually-performed migration takes 1–3 days of developer time to assess and document; a missed breaking change discovered post-deploy costs far more. Extending the migration family to Copilot subscribers multiplies the tooling's reach to the full developer population, not just Claude Code users, and reduces per-migration ramp time to under 30 minutes for the intake phase.

### Story
As a developer using GitHub Copilot, I want to run `@migration upgrade`, `@migration rewrite`, or `@migration replatform` from Copilot Chat, so that I receive AI-guided migration analysis and decision-grade written reports without needing a Claude Code subscription or context switch.

### Success Metrics
- A developer with only a Copilot subscription can complete a full Upgrade intake (stack detection → Gap & Risk → Write Gate → file write) in one Copilot Chat session.
- HIGH-risk gate prompts display a WARN banner and require explicit acknowledgment before continuing with the Copilot fallback model; no silent degradation occurs.
- The VSIX installs cleanly on a developer machine and registers `@migration` as a Chat participant without requiring the Claude Code plugin.
- All 3 migration skills (Upgrade, Rewrite, Replatform) advance through their stage machines to a written output artifact in the workspace.

---

## Context

### Personas

**Dev on Copilot:** GitHub Copilot Business/Enterprise user · migrating .NET 8→10, Angular 17→19, or on-prem→Azure · frustrated by needing Claude Code just for migrations · success = completes intake + receives report without leaving VS Code or using a terminal.

**Tech Lead:** Owns the migration go/no-go decision · needs decision-grade Gap & Risk reports accurate enough for stakeholder review · frustrated when reports miss breaking changes or deprecated APIs · success = judge-gate analysis quality is high enough to replace a manual migration spike.

**Platform Engineer:** Manages org-wide extension deployment · success = extension installs cleanly as a VSIX / Marketplace item, PAT management needs no help desk, no dependency on the Claude Code plugin repo.

### System Context

| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| Extension root | `copilot-extension/` (promoted from `copilot-migration-spike/`) | new | Fully standalone; zero runtime dependency on plugin repo |
| Extension manifest | `copilot-extension/package.json` | new | Registers `@migration` Chat participant; contributes `migration.approve`, `migration.setAdoPat`, `migration.clearAdoPat`, `migration.revokeApproval` commands; Marketplace-ready publisher/icon/categories |
| Activation | `copilot-extension/src/extension.ts` | new | Registers Chat participant + 4 palette commands; wires subscriptions |
| Participant router | `copilot-extension/src/participant.ts` | extend (spike→production) | Routes `upgrade` / `rewrite` / `replatform` commands; extracts ADO ID + target version from prompt |
| Upgrade stage machine | `copilot-extension/src/skills/upgradeHandler.ts` | new | Full 3-stage / 3-gate TypeScript state machine: intake → gap/risk → write gate → report write |
| Rewrite handler | `copilot-extension/src/skills/rewriteHandler.ts` | new | Options gate + architecture gate (no worktree generation); outputs `options.md` + `arch.md` |
| Replatform handler | `copilot-extension/src/skills/replatformHandler.ts` | new | 6R posture → NFR spec → IaC authoring; outputs Bicep/Terraform + runbook |
| Write Gate | `copilot-extension/src/writeGate.ts` | extend (spike→production) | `assertGateOpen` / `approve` / `revoke` via `workspaceState`; `WriteGateLockedError`; clickable button |
| Config & model routing | `copilot-extension/src/configManager.ts` | extend (spike→production) | Anthropic key → `claude-opus-4-6` for judge gates; absent → Copilot model fallback; WARN banner for HIGH-risk gates without key |
| Script runner | `copilot-extension/src/scriptRunner.ts` | extend (spike→production) | `require()` over subprocess; `resolveNodeExe()` probe; temporary `process.execPath` patch for `migration-source-detect.cjs` |
| Judge ladder | `copilot-extension/src/judgeGate.ts` | new | Anthropic escalation for HIGH-risk critic gates; WARN + ack flow when key absent |
| Ledger persistence | `copilot-extension/src/ledger.ts` | new | Checkpoint JSON written to `.migration-checkpoint/` in workspace root; survives session reload |
| Vendored scripts | `copilot-extension/scripts/` | new | `migration-source-detect.cjs`, `repo-detect.cjs`, `stack-signals.cjs`, `checkpoint-ledger.cjs`, `resolve-migration-roots.cjs` — committed, extension-team-owned |
| Multi-root support | `copilot-extension/src/workspaceRoots.ts` | new | Wraps `resolve-migration-roots.cjs` via `require()`; resolves all workspace folders |

### Constraint Context

| Constraint | Type | Bounds the solution how? |
|---|---|---|
| `require()` instead of `execFileAsync` for CJS scripts | Technical | Subprocess spawn fails silently on Windows when extension path contains spaces (OneDrive, "AI Learning"); `require()` bypasses all subprocess mechanics — verified in spike |
| `process.execPath` patching required | Technical | VS Code extension host sets `process.execPath` to `Code.exe` (Electron), not `node.exe`; must temporarily patch to `resolveNodeExe()` result before calling scripts that internally use `execFileSync(process.execPath, ...)` |
| No SKILL.md execution engine | Technical | Copilot Chat has no equivalent of Claude Code's Bash tool + SKILL.md instruction following; all skill logic must be encoded as TypeScript state machines |
| VS Code 1.90+ required | Technical | `vscode.chat` + `vscode.lm` APIs are only stable from VS Code 1.90; lower versions cannot host the extension |
| Node.js on system PATH | Technical | `resolveNodeExe()` probes `where node` / `which node`; extension fails fast with a user-visible error if Node.js is not installed |
| Option A (vendor) bundling | Architecture | Extension is fully standalone; no runtime or build-time dependency on plugin repo; scripts are vendored into `copilot-extension/scripts/` and committed |
| VSIX delivery for Sprint 13 | Business | Marketplace publish is V2; VSIX is sufficient for Sprint 13; Marketplace-ready structure (publisher, icon, categories, contributes schema) required from day 1 |
| HIGH-risk gates: WARN + ack | Business | When no Anthropic key is configured, HIGH-risk judge gates must display a prominent WARN banner and require explicit developer acknowledgment before continuing with Copilot model; never silently degrade |
| `vscode.SecretStorage` for PAT | Technical | ADO PAT stored via VS Code SecretStorage API; never in `settings.json` (committed) or workspace state |

### Change Tier
**T2** — New standalone VS Code extension; production code that executes LLM prompts, reads workspace files, and writes reports to disk. No auth system or database changes; no changes to existing plugin code.

---

## Examples

> All scenarios use Given/When/Then table format.

### Happy Path

| Given | When | Then (observable outcome) |
|---|---|---|
| Developer has Copilot + Anthropic key configured; workspace is a .NET 8 project | Types `@migration upgrade ADO-1234 to .NET 10` in Chat | Participant responds with detected stack table, then Gap & Risk report; WRITE PENDING prompt appears before file write |
| Developer has approved Write Gate (`migration.approve`) for ADO-1234 | Upgrade gap/risk stage completes | Report written to `{workspace}/.migration/ADO-1234-upgrade-gap-risk.md`; Chat confirms path |
| Developer types `@migration rewrite ADO-5678` on an Angular 17 project | Participant runs Rewrite handler | Options doc (`options.md`) streamed with 3+ migration paths; developer sees architecture gate prompt before `arch.md` is written |
| Developer types `@migration replatform ADO-9999` on a .NET on-prem API | Participant runs Replatform handler | 6R assessment streamed, then NFR spec, then Bicep IaC; WRITE PENDING before IaC files written |
| Developer has no Anthropic key but has Copilot; Upgrade gap/risk is LOW-risk | Intake completes with LOW-risk classification | Report generated via Copilot model with no WARN banner; no degradation notice needed for LOW-risk |

### Edge Cases

| Given | When | Then (expected behaviour) |
|---|---|---|
| No Anthropic key; Upgrade gap/risk is HIGH-risk (e.g., breaking API removal) | Stage 2 completes risk classification | WARN banner displayed: "HIGH-risk gate — Anthropic key not configured. Continue with Copilot model? (reply YES to acknowledge)"; stage pauses until developer types `YES` |
| Developer types `@migration upgrade` with no ADO ID in the prompt | Participant routes to upgrade handler | Participant asks: "Which ADO work item is this upgrade for? (e.g., ADO-1234)"; does not proceed until ID provided |
| Workspace has multiple folders (multi-root workspace) | Any migration command runs | `resolve-migration-roots.cjs` identifies all roots; Scanning line lists all resolved paths; analysis covers all roots |
| Developer has not run `migration.approve` before gap/risk write | Write Gate asserts | Chat streams: "Write Gate locked for ADO-{ID}. Run `Migration: Approve Write` from the Command Palette first."; button rendered; no file written |
| `migration-source-detect.cjs` is loaded via `require()` and Node.js is not on PATH | Stack detection executes | `resolveNodeExe()` throws; Chat streams: "Cannot locate node.exe — ensure Node.js is installed and on the system PATH. Restart VS Code after installing." |
| Session reloaded mid-migration (ledger checkpoint exists) | Developer runs same migration command | `ledger.ts` reads checkpoint; participant responds with current stage and offers to resume from last completed gate |

### Error States

| Given | When | Then (user-visible message + system behaviour) |
|---|---|---|
| No workspace folder is open in VS Code | Any `@migration` command runs | Chat streams: "No workspace folder open. Open a project folder (File → Open Folder) before running @migration." |
| Copilot subscription not active; no Anthropic key | Upgrade gap/risk stage reaches LLM call | Chat streams: "No AI model available. Configure `migration.anthropicApiKey` in settings or ensure GitHub Copilot is active." — stage machine halts cleanly; no partial file written |
| Anthropic API returns rate-limit error (429) | Judge gate calls Anthropic during HIGH-risk evaluation | Chat streams: "Anthropic rate limit reached. Retrying in 10 seconds... (1/3)" — 3 retries with backoff; on final failure: "Anthropic unavailable. Continue with Copilot model? (reply YES to acknowledge)" |
| Write Gate is approved but workspace folder is read-only | File write attempted | Chat streams: "Could not write report — workspace path is read-only: {path}. Check folder permissions."; Write Gate remains approved; developer can retry after fixing permissions |
| Script `migration-source-detect.cjs` throws during `require()` | Stack detection runs | Chat streams: "Stack detection failed: {error message}. Check that scripts/ folder is intact in the extension installation." |

### Permission Boundary (mandatory)

| Given | When | Then (observable outcome) |
|---|---|---|
| Write Gate has NOT been approved for ADO-1234 | Stage machine reaches file-write step | File write is blocked; `WriteGateLockedError` thrown; Chat streams locked message with `migration.approve` button; no file created in workspace |
| ADO PAT has not been set via `migration.setAdoPat` | Any ADO REST call is attempted (Could Have) | Chat streams: "ADO PAT not configured. Run `Migration: Set ADO PAT` from the Command Palette."; no ADO REST call proceeds |

---

## Acceptance

### Acceptance Criteria

**Upgrade skill (full stage machine):**
- [ ] AC-F1: `@migration upgrade ADO-{ID} [to <version>]` detects the workspace stack via `migration-source-detect.cjs` and streams the detected stack table before any LLM call.
- [ ] AC-F2: When target version is not in the prompt, participant asks for it before advancing past intake.
- [ ] AC-F3: When detected axis is "rewrite" (not a same-stack upgrade), participant informs developer and stops; does not generate an upgrade report.
- [ ] AC-F4: Gap & Risk report is generated via Anthropic API when `migration.anthropicApiKey` is configured; generated via Copilot model when key is absent and risk is LOW/MEDIUM.
- [ ] AC-F5: When risk classification is HIGH and no Anthropic key is configured, a WARN banner is streamed and the current Chat turn ends; developer must send a follow-up Chat message containing `YES` to continue; the ledger stores a `pendingHighRiskAck` flag checked at the start of the next turn; no continuation occurs without this acknowledgment.
- [ ] AC-F6: Report file is written to workspace only after Write Gate is approved (`migration.approve ADO-{ID}` executed or button clicked); attempting to write before approval streams the locked message and button.
- [ ] AC-F7: Written report path is confirmed in Chat after successful write.

**Rewrite skill (options + architecture gates, no worktrees):**
- [ ] AC-F8: `@migration rewrite ADO-{ID}` runs stack detection and generates an options document listing 3+ migration path options with pros/cons.
- [ ] AC-F9: Options doc is written only after Write Gate approval; gate verbiage explicitly notes worktree generation is deferred to V2.
- [ ] AC-F10: Developer must acknowledge options selection before architecture gate runs; architecture doc is generated for the selected option.
- [ ] AC-F11: Architecture doc written to workspace only after Write Gate approval.

**Replatform skill (6R posture + NFR + IaC):**
- [ ] AC-F12: `@migration replatform ADO-{ID}` runs stack detection and streams a 6R posture assessment (Rehost / Replatform / Repurchase / Refactor / Retire / Retain).
- [ ] AC-F13: NFR specification (availability %, RTO, RPO, DR targets) is generated and streamed before IaC authoring.
- [ ] AC-F14: IaC files (Bicep or Terraform, auto-detected from plan context) are written to workspace after Write Gate approval.

**Model routing and HIGH-risk gate:**
- [ ] AC-F15: When `migration.anthropicApiKey` is set, all judge gate LLM calls use `claude-opus-4-6` (or the configured `migration.judgeModel`).
- [ ] AC-F16: When key is absent and risk is HIGH, WARN banner is displayed before proceeding; developer acknowledgment (`YES`) is required; no silent degradation occurs.
- [ ] AC-F17: When key is absent and no Copilot model is available, participant streams a clear error message and halts — it does not produce a blank or malformed report.

**Infrastructure:**
- [ ] AC-F18: `migration.approve ADO-{ID}` command approves the Write Gate for that ADO; `migration.revokeApproval` revokes it; both persist via `workspaceState` across Chat sessions within the same VS Code window.
- [ ] AC-F19: `migration.setAdoPat` stores PAT in `vscode.SecretStorage`; `migration.clearAdoPat` deletes it; PAT never appears in `settings.json` or workspace state.
- [ ] AC-F20: Extension installs from VSIX on VS Code 1.90+ without requiring the Claude Code plugin or any npm install on the developer machine.
- [ ] AC-F21: Vendored scripts (`migration-source-detect.cjs`, `repo-detect.cjs`, `stack-signals.cjs`, `checkpoint-ledger.cjs`, `resolve-migration-roots.cjs`) are present in `copilot-extension/scripts/` and committed.
- [ ] AC-F22: `package.json` is Marketplace-ready: `publisher`, `icon`, `categories`, and `contributes` schema are correct even though Sprint 13 ships as VSIX only.

**Non-functional:**
- [ ] AC-NF1: Stack detection via `require()` returns in under 10 s for workspaces with < 5,000 source files; verified by timing `detectSource()` against KE.KMS.Trackers.Adapter. Because `require()` is a synchronous blocking call there is no external timeout guard — a detection failure surfaces as a thrown error caught by the stage machine and streamed to Chat.
- [ ] AC-NF2: Extension host memory does not grow unboundedly across repeated `@migration` calls in the same session; `require()` module cache is reused after first load (module not re-required on each call); verified by monitoring heap in Dev Host across 10 sequential invocations.

### Out of Scope

- **We will NOT generate git worktrees during Rewrite** — extension host state management across worktrees is not feasible in Sprint 13; deferred to V2 with explicit gate verbiage in the Rewrite handler.
- **We will NOT generate cluster code** — depends on worktrees; deferred to V2 alongside worktree generation.
- **We will NOT publish to the VS Code Marketplace** — VSIX delivery is sufficient for Sprint 13; Marketplace structure is required but publish is deferred to V2 pending publisher account setup.
- **We will NOT provide full Claude Code parity (hooks, audit trail, dream memory)** — different execution model; out of scope permanently for the Copilot channel.
- **We will NOT make ADO REST API calls (task creation, PR descriptions)** — stored PAT is prepared but REST calls are a Could Have deferred to V2.
- **We will NOT support Python-as-source or Java→Python rewrites** — migration knowledge refs have no mappings for these paths; same limitation as the Claude Code skills.

### Assumptions

- `vscode.chat` + `vscode.lm` APIs are stable in VS Code 1.90+ — **verified in Phase 1 spike (all 7 criteria passed)**.
- `require()` over CJS scripts is reliable in the VS Code extension host without subprocess spawn — **verified in Phase 1 spike against KE.KMS.Trackers.Adapter (stack detected correctly)**.
- `process.execPath` patching to `resolveNodeExe()` is safe: the patch is temporary (try/finally), synchronous, and no concurrent code in the extension host reads `process.execPath` during the window — **verified in spike**.
- Upgrade SKILL.md stage flow (3 gates, auto-advance) maps to a TypeScript state machine without material behavioural loss — **unverified; gap analysis required in implementation**.
- Rewrite options + architecture gates are deliverable without worktree management — **unverified; depends on how options.md write is structured in the Rewrite SKILL.md**.
- BAL/ERL assurance measurement can be expressed as structured Anthropic prompts with the judge model — **unverified**.
- Node.js is installed on the developer machine and is resolvable via `where node` / `which node` — **assumed; extension surfaces a clear error if not**.

### Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Which Marketplace publisher account will be used for the eventual Marketplace publish? (Does not block Sprint 13 VSIX.) | Platform Engineer | deferred — not required for Sprint 13 |

### Risks & Pre-Mortem

| Risk | Probability | Impact |
|---|---|---|
| SKILL.md → TypeScript fidelity: 3×~400-line Markdown → state machines may miss edge cases; behavioural regression vs Claude Code baseline | M | H |
| Judge ladder quality: Copilot model may not catch HIGH-risk breaking changes at the same rate as `claude-opus-4-6` | M | H |
| Rewrite options gate without worktrees: Rewrite skill design assumes worktrees exist before options approval; Stage 2 may be partially incomplete | M | M |
| Extension host memory on large codebases: graph.json + multiple migration scripts via `require()` may exhaust Node heap on monorepos | L | M |

**Pre-mortem:** This shipped and failed. The Upgrade stage machine silently produced incorrect Gap & Risk reports — it missed breaking changes that the Claude Code skill (via SKILL.md instruction following) would have caught, because a gate condition was simplified or omitted during TypeScript translation. A developer approved an upgrade based on the report, hit runtime failures in production, and traced them back to the missed gate. Mitigation applied during Sprint 13: each stage machine gate must be validated side-by-side against the SKILL.md gate list before sign-off; judge escalation must be enforced (not optional) for HIGH-risk gates; WARN + ack must be audited in integration testing.

### Dependencies

- Blocked by: Phase 1 spike (copilot-migration-spike/) — **complete**
- Blocked by: Upgrade, Rewrite, and Replatform SKILL.md gate lists (state machine fidelity source) — available in `skills/upgrade/SKILL.md`, `skills/rewrite/SKILL.md`, `skills/replatform/SKILL.md`
- Blocks: Nothing (standalone extension, no downstream ADOs depend on it in Sprint 13)

### Irreversibility Flags

- **Option A vendor bundling (scripts committed to extension/scripts/):** Once the extension team owns their vendored copies, divergence from the plugin repo's canonical scripts is possible. This is intentional and documented; future plugin script updates require manual sync by the extension team. Flagged because this is a long-term maintenance commitment, not a reversible architectural choice.
- **Renaming `copilot-migration-spike/` to `copilot-extension/`:** The spike folder will be removed and its contents promoted. This is a one-way rename; the spike is not preserved as a separate artifact post-promotion.

### D-Blocks

None. All architectural decisions were resolved in the plan:
- Bundling strategy: Option A (vendor) — decided.
- VSIX vs Marketplace: VSIX for Sprint 13 — decided.
- HIGH-risk gate without Anthropic key: WARN + explicit developer ack — decided.
- Script invocation: `require()` over subprocess — decided and verified in spike.

---

## Story Breakdown

**Type:** EPIC
**Total SP:** 21

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | TBD | **Scaffold promotion** (spike→extension rename) + **shared infra**: `writeGate.ts`, `configManager.ts`, `scriptRunner.ts`, `workspaceRoots.ts`, `participant.ts` router; `package.json` Marketplace-ready; VSIX build verified; `extension.ts` activates + registers 4 commands | 4 | Yes — installs and activates; no skill output yet | None | Pending |
| 2 | TBD | **Upgrade full stage machine** — `upgradeHandler.ts`: intake → gap/risk (Anthropic + Copilot model routing) → HIGH-risk WARN+ack (ledger `pendingHighRiskAck`) → Write Gate → report write; E2E verified against real .NET repo | 4 | Yes — Upgrade is the primary deliverable | Story 1 | Pending |
| 3 | TBD | **Rewrite handler** — `rewriteHandler.ts`: options gate + architecture gate (no worktrees); `options.md` and `arch.md` written to workspace; gate verbiage explicitly defers worktree generation to V2 | 5 | Yes — adds Rewrite without breaking Upgrade | Story 1 | Pending |
| 4 | TBD | **Replatform handler** — `replatformHandler.ts`: 6R posture assessment + NFR spec + IaC authoring (Bicep/Terraform auto-detected); IaC files written to workspace after Write Gate | 5 | Yes — adds Replatform without breaking others | Story 1 | Pending |
| 5 | TBD | **Should-haves:** `judgeGate.ts` — Anthropic escalation for HIGH-risk critic gates; `ledger.ts` — checkpoint JSON to `.migration-checkpoint/` (survives session reload); `workspaceRoots.ts` — multi-root support via `resolve-migration-roots.cjs` | 3 | Yes — additive; all skills degrade gracefully without Story 5 | Story 1 | Pending |

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | Auto-approved via SAVE TECH | 2026-10-07 | ✅ Approved |
| Tech Lead | Auto-approved via SAVE TECH | 2026-10-07 | ✅ Approved |

---
### Revision Log
2026-10-07 — Initial ICEA draft from approved plan (ADO-9020, Phase 3 full implementation).
2026-10-07 — Critic gate: PASS WITH NOTES. Applied 3 corrections: Story 1 split (8 SP → 4+4 SP, now Stories 1+2); AC-NF2 reworded (require() is synchronous, no external timeout guard); AC-F5 ack mechanism specified (ledger pendingHighRiskAck flag, follow-up Chat turn).
2026-10-07 — ICEA approved via SAVE TECH ADO-9020.
