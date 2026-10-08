# Epic Tracker — Copilot Migration Extension (Phase 3 Full Implementation)
ADO #9020 · Release 3 · Sprint 13 · EPIC · 21 SP

---

## Stories

| Story | Child ADO # | Title | SP | Status |
|---|---|---|---|---|
| 1 | TBD | Scaffold promotion + shared infrastructure | 4 | ✅ Done |
| 2 | TBD | Upgrade full stage machine | 4 | ✅ Done |
| 3 | TBD | Rewrite handler (options + architecture gates) | 5 | ✅ Done |
| 4 | TBD | Replatform handler (6R + NFR + IaC) | 5 | ✅ Done |
| 5 | TBD | Should-haves: judge ladder + ledger + multi-root | 3 | ✅ Done |

---

## Story 1 — AC Coverage

| AC | Description | Status |
|---|---|---|
| AC-F18 | approve/revoke via workspaceState (writeGate.ts) | ✅ Done |
| AC-F19 | PAT in SecretStorage (configManager.ts) | ✅ Done |
| AC-F20 | VSIX installs on VS Code 1.90+ without Claude Code | ✅ Done — tsc 0 errors; `npm run package` to produce VSIX |
| AC-F21 | 5 vendored scripts in copilot-extension/scripts/ | ✅ Done |
| AC-F22 | package.json Marketplace-ready (publisher, categories, contributes) | ✅ Done |
| Infra | scriptRunner.ts + workspaceRoots.ts + participant.ts routing scaffold | ✅ Done |

---

## Story 2 — AC Coverage

| AC | Description | Status |
|---|---|---|
| AC-F1 | detectSource() streams stack table before any LLM call (upgradeHandler.ts INTAKE) | ✅ Done |
| AC-F2 | TARGET_VERSION_PENDING state: ask + store, re-ask on next turn if still absent | ✅ Done |
| AC-F3 | classifyAxis() rejects cross-stack targets with redirect to @migration rewrite | ✅ Done |
| AC-F4 | GAP_RISK: Anthropic when key present; Copilot model when key absent | ✅ Done |
| AC-F5 | HIGH-risk + no Anthropic key: WARN banner, pendingHighRiskAckMap set, turn ends; YES resumes | ✅ Done |
| AC-F6 | assertGateOpen() before every writeFile call; WriteGateLockedError propagates cleanly | ✅ Done |
| AC-F7 | Report path confirmed in Chat after successful write | ✅ Done |
| AC-F15 | Anthropic key present → uses configured judgeModel (askAnthropic in configManager) | ✅ Done |
| AC-F16 | HIGH-risk without key: explicit WARN, never silent degradation | ✅ Done |
| AC-F17 | No model available: throws user-visible Error; participant.ts streams it; no partial write | ✅ Done |
| participant.ts | getPendingAdoId() + checkAndResumePending() wired in before routing on every turn | ✅ Done |

---

## Revision Log

2026-10-07 — Tracker created, Story 1 started.
2026-10-07 — Story 1 complete (6/6 ACs). Story 2 started.
2026-10-07 — Story 2 complete (11/11 ACs). tsc --noEmit EXIT:0.
2026-10-08 — Story 3 complete (4/4 ACs). tsc --noEmit EXIT:0.
2026-10-08 — Story 4 complete (3/3 ACs). tsc --noEmit EXIT:0.
2026-10-08 — Story 5 complete (3/3 ACs). tsc --noEmit EXIT:0.

## Story 4 — AC Coverage

| AC | Description | Status |
|---|---|---|
| AC-F12 | detectSource + 6R posture assessment streamed (runSixRClassify) | ✅ Done |
| AC-F13 | NFR spec generated and streamed BEFORE IaC authoring (runNfrSpec) | ✅ Done |
| AC-F14 | IaC (Bicep default / Terraform from prompt) + runbook written after assertGateOpen; all paths confirmed in Chat | ✅ Done |
| participant.ts | replatformHandler.handleReplatform(adoId, request.prompt, ...) wired; stub removed | ✅ Done |

## Story 5 — AC Coverage

| AC | Description | Status |
|---|---|---|
| judgeGate | `callJudge()` centralises Anthropic/Copilot dispatch — all 3 handlers use it; `callModel`/`generateVia*` removed | ✅ Done |
| ledger | `ledger.ts` wraps `checkpoint-ledger.cjs`; `writeCheckpoint`/`readCheckpoint`/`clearCheckpoint` typed API | ✅ Done |
| multi-root | `resolveRoots(extensionUri?)` reads `migrationRoots` from `.claude/settings.local.json`; falls back gracefully | ✅ Done |
| persist | HIGH_RISK_ACK_PENDING written to ledger on set; restored from ledger on `checkAndResumePending` if Map empty; cleared on YES | ✅ Done |

## Story 3 — AC Coverage

| AC | Description | Status |
|---|---|---|
| AC-F8 | detectSource + 3+ options with pros/cons/assurance/effort/TCO (rewriteHandler.ts INTAKE+OPTIONS) | ✅ Done |
| AC-F9 | Options.md gated by assertGateOpen; explicit V2 deferral note in stream + document | ✅ Done |
| AC-F10 | OPTIONS_ACK_PENDING state: developer replies with option number; arch doc generated for selection | ✅ Done |
| AC-F11 | arch.md gated by assertGateOpen before write | ✅ Done |
| participant.ts | rewriteHandler.getPendingAdoId() + checkAndResumePending() chained after upgrade check | ✅ Done |
