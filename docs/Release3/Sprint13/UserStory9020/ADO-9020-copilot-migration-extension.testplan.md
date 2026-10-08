# Test Plan — Copilot Migration Extension (Phase 3 Full Implementation)
ADO #9020 · Release 3 · Sprint 13
Source: ICEA + Tech Spec · Generated: 2026-10-07

---

## Execution Summary

| Suite | Title | TCs | Priority | Story |
|---|---|---|---|---|
| Suite-1 | Smoke: Extension Install & Activation | 3 | P0 | Story 1 |
| Suite-2 | Upgrade — Happy Path | 5 | P0 | Story 2 |
| Suite-3 | Upgrade — Edge Cases & Error States | 6 | P1 | Story 2 |
| Suite-4 | Rewrite Handler | 4 | P1 | Story 3 |
| Suite-5 | Replatform Handler | 3 | P1 | Story 4 |
| Suite-6 | Write Gate & Security | 4 | P0 | Story 1+2 |
| Suite-7 | Model Routing & HIGH-risk Gate | 5 | P0 | Story 2+5 |
| Suite-8 | Ledger Persistence & Multi-root | 3 | P2 | Story 5 |
| Suite-9 | Regression | 2 | P1 | All |

**Total test cases: 35**

---

## Prerequisites (all suites)

- VS Code 1.90+ with GitHub Copilot extension installed
- `copilot-extension/` VSIX installed (`Extensions → Install from VSIX`)
- A real workspace open (KE.KMS.Trackers.Adapter recommended for Upgrade)
- Node.js on system PATH (`node --version` returns ≥18)
- `Migration: Approve Write` command available in Command Palette

---

## Suite-1 — Smoke: Extension Install & Activation (AC-F20, AC-F22)

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-1.1 | VSIX installs cleanly | 1. `code --install-extension copilot-migration-extension-*.vsix` 2. Reload VS Code | No install error; extension listed in Extensions panel |
| TC-1.2 | @migration appears in Copilot Chat | 1. Open Copilot Chat 2. Type `@migration` | Participant auto-completes; `upgrade`, `rewrite`, `replatform` commands listed |
| TC-1.3 | 4 commands in Command Palette | 1. Press Ctrl+Shift+P 2. Type "Migration:" | `Migration: Approve Write`, `Migration: Revoke Approval`, `Migration: Set ADO PAT`, `Migration: Clear ADO PAT` all present |

---

## Suite-2 — Upgrade Happy Path (AC-F1, AC-F4, AC-F6, AC-F7)

**Setup:** Open KE.KMS.Trackers.Adapter workspace. Set `migration.anthropicApiKey` in User Settings.

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-2.1 | Stack detection streams before LLM call | `@migration upgrade ADO-1234 to .NET 10` | First response line is "**Scanning:** `<path>`"; stack table shown before any gap/risk content |
| TC-2.2 | Gap & Risk report generated via Anthropic | As TC-2.1 with valid Anthropic key | Report content references .NET 10 breaking changes; no "[STUB]" markers present |
| TC-2.3 | Write Gate blocks write before approval | After report is generated, do NOT run `migration.approve` | Chat streams "Write Gate locked for ADO-1234"; button rendered; no file at `.migration/ADO-1234-upgrade-gap-risk.md` |
| TC-2.4 | Write Gate unblocks after approval | Run `Migration: Approve Write`, enter 1234, then retry | Report file written to `.migration/ADO-1234-upgrade-gap-risk.md`; Chat confirms path |
| TC-2.5 | Report path confirmed in Chat | As TC-2.4 | Chat message ends with the full workspace-relative path of the written file |

---

## Suite-3 — Upgrade Edge Cases & Error States (AC-F2, AC-F3, AC-F5, AC-F17, AC-NF1, AC-NF2)

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-3.1 | Missing target version prompts before advance | `@migration upgrade ADO-1234` (no version) | Chat asks "Which target version?" before any LLM call; second turn with ".NET 10" continues normally |
| TC-3.2 | Rewrite axis → stop | `@migration upgrade ADO-1234 to React` on an Angular workspace | Chat informs "This is a stack migration, not an upgrade — use `@migration rewrite` instead."; no gap/risk report generated |
| TC-3.3 | HIGH-risk WARN+ack required | No Anthropic key; run upgrade on code with HIGH-risk breaking changes | WARN banner shown; turn ends; reply "NO" → WARN re-streamed, no advance; reply "YES" → continues to Write Gate |
| TC-3.4 | No model at all → error, no blank report | Remove Anthropic key AND ensure no active Copilot model | Chat streams "No AI model available. Configure `migration.anthropicApiKey` or ensure GitHub Copilot is active."; no partial file written |
| TC-3.5 | Stack detection timing (AC-NF1) | Run upgrade on workspace with ~1,000 source files | Stack table appears within 10 s of command; verified by developer stopwatch |
| TC-3.6 | No workspace open → error | Close all workspace folders, run `@migration upgrade ADO-1234` | Chat streams "No workspace folder open. Open a project folder before running @migration." |

---

## Suite-4 — Rewrite Handler (AC-F8, AC-F9, AC-F10, AC-F11)

**Setup:** Open Angular 17 workspace.

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-4.1 | Options document generated with 3+ paths | `@migration rewrite ADO-5678` | Chat streams 3+ migration path options with pros/cons |
| TC-4.2 | Options.md Write Gate + worktree deferral note | Approve Write Gate for ADO-5678, then run rewrite | `options.md` appears in workspace; gate verbiage includes "Worktree generation deferred to V2" |
| TC-4.3 | Architecture gate requires option selection | After options doc shown, send option selection reply | Chat generates architecture doc for the selected option only; other options not expanded |
| TC-4.4 | Arch.md written after Write Gate | Ensure Write Gate approved for ADO-5678 | `arch.md` written to workspace; path confirmed in Chat |

---

## Suite-5 — Replatform Handler (AC-F12, AC-F13, AC-F14)

**Setup:** Open .NET API workspace.

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-5.1 | 6R posture streamed | `@migration replatform ADO-9999` | Chat streams 6R assessment table (Rehost / Replatform / Repurchase / Refactor / Retire / Retain) |
| TC-5.2 | NFR spec shown before IaC | Advance past 6R stage | NFR spec (availability %, RTO, RPO, DR) appears in Chat before any Bicep/Terraform content |
| TC-5.3 | Bicep written after Write Gate; terraform keyword switches format | Approve Write Gate; then run `@migration replatform ADO-9999 terraform` | First run → Bicep files; second run with `terraform` keyword → Terraform files; path confirmed each time |

---

## Suite-6 — Write Gate & Security (AC-F6, AC-F18, AC-F19)

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-6.1 | Approval persists across Chat sessions | Run `migration.approve` for ADO-1234, close Chat, reopen | Write Gate still approved for ADO-1234 (workspaceState survives Chat session restart) |
| TC-6.2 | Revoke clears approval | Run `Migration: Revoke Approval`, enter 1234, retry write | Chat streams "Write Gate locked" again; no file written |
| TC-6.3 | ADO PAT stored in SecretStorage, not settings | Run `Migration: Set ADO PAT`, enter a test PAT | PAT does NOT appear in `settings.json`; not visible via File → Preferences → Settings search |
| TC-6.4 | No shell injection via user input | Enter `ADO-1234; rm -rf /` as ADO ID in the approve prompt | Extension normalises the ID; no shell command executed; `require()` invoked safely |

---

## Suite-7 — Model Routing & HIGH-risk Gate (AC-F4, AC-F5, AC-F15, AC-F16, AC-F17)

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-7.1 | Anthropic model used when key present | Set `migration.anthropicApiKey`; run upgrade | Report contains specific breaking-change references; response latency consistent with Anthropic API (not Copilot) |
| TC-7.2 | `migration.judgeModel` setting respected | Set `migration.judgeModel = claude-opus-4-6`; run upgrade | Extension host logs (Output → Migration) show model name `claude-opus-4-6` |
| TC-7.3 | Copilot fallback for LOW risk without key | Remove Anthropic key; LOW-risk workspace; run upgrade | Report generated via Copilot model; no WARN banner displayed |
| TC-7.4 | HIGH-risk WARN: non-YES reply re-streams (AC-F5) | HIGH-risk; no Anthropic key; reply "maybe" | WARN banner re-streamed; state does not advance; only "YES" advances to WRITE_GATE |
| TC-7.5 | No model → clear error, no malformed output (AC-F17) | Both models absent | Error message is actionable (states what to configure); no `undefined`, empty string, or partial file written to `.migration/` |

---

## Suite-8 — Ledger Persistence & Multi-root (Story 5)

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-8.1 | Checkpoint survives VS Code reload | Start upgrade, advance to GAP_RISK; close VS Code completely; reopen; run same command | Chat offers to resume from GAP_RISK; no re-detection; `.migration-checkpoint/1234.json` exists in workspace root |
| TC-8.2 | Module cache reused across calls (AC-NF2) | Run `@migration upgrade` twice in same session; observe timing | Second invocation's stack detection is measurably faster than first (module already in `require()` cache) |
| TC-8.3 | Multi-root workspace scans all roots | Open VS Code with 2 workspace folders | "**Scanning:** `<path1>`, `<path2>`" line appears; stack detection result covers both roots |

---

## Suite-9 — Regression

| TC | Title | Steps | Expected |
|---|---|---|---|
| TC-9.1 | Existing Claude Code plugin unaffected | With VSIX installed, use a Claude Code skill (e.g. `ICEA ADO-9016`) | Claude Code skills work normally; no `@migration` participant conflict |
| TC-9.2 | Memory stable across 5 repeated calls | Run `@migration upgrade` 5× in one VS Code session; check Dev Host memory | VS Code memory does not grow linearly; heap stable below 500 MB for a typical workspace |

---

## Execution Tracker

| TC | Suite | Assignee | Sprint | Status |
|---|---|---|---|---|
| TC-1.1 | Suite-1 | QA | Sprint 13 | Not Started |
| TC-1.2 | Suite-1 | QA | Sprint 13 | Not Started |
| TC-1.3 | Suite-1 | QA | Sprint 13 | Not Started |
| TC-2.1 | Suite-2 | QA | Sprint 13 | Not Started |
| TC-2.2 | Suite-2 | QA | Sprint 13 | Not Started |
| TC-2.3 | Suite-2 | QA | Sprint 13 | Not Started |
| TC-2.4 | Suite-2 | QA | Sprint 13 | Not Started |
| TC-2.5 | Suite-2 | QA | Sprint 13 | Not Started |
| TC-3.1 | Suite-3 | QA | Sprint 13 | Not Started |
| TC-3.2 | Suite-3 | QA | Sprint 13 | Not Started |
| TC-3.3 | Suite-3 | QA | Sprint 13 | Not Started |
| TC-3.4 | Suite-3 | QA | Sprint 13 | Not Started |
| TC-3.5 | Suite-3 | QA | Sprint 13 | Not Started |
| TC-3.6 | Suite-3 | QA | Sprint 13 | Not Started |
| TC-4.1 | Suite-4 | QA | Sprint 13 | Not Started |
| TC-4.2 | Suite-4 | QA | Sprint 13 | Not Started |
| TC-4.3 | Suite-4 | QA | Sprint 13 | Not Started |
| TC-4.4 | Suite-4 | QA | Sprint 13 | Not Started |
| TC-5.1 | Suite-5 | QA | Sprint 13 | Not Started |
| TC-5.2 | Suite-5 | QA | Sprint 13 | Not Started |
| TC-5.3 | Suite-5 | QA | Sprint 13 | Not Started |
| TC-6.1 | Suite-6 | QA | Sprint 13 | Not Started |
| TC-6.2 | Suite-6 | QA | Sprint 13 | Not Started |
| TC-6.3 | Suite-6 | QA | Sprint 13 | Not Started |
| TC-6.4 | Suite-6 | QA | Sprint 13 | Not Started |
| TC-7.1 | Suite-7 | QA | Sprint 13 | Not Started |
| TC-7.2 | Suite-7 | QA | Sprint 13 | Not Started |
| TC-7.3 | Suite-7 | QA | Sprint 13 | Not Started |
| TC-7.4 | Suite-7 | QA | Sprint 13 | Not Started |
| TC-7.5 | Suite-7 | QA | Sprint 13 | Not Started |
| TC-8.1 | Suite-8 | QA | Sprint 13 | Not Started |
| TC-8.2 | Suite-8 | QA | Sprint 13 | Not Started |
| TC-8.3 | Suite-8 | QA | Sprint 13 | Not Started |
| TC-9.1 | Suite-9 | QA | Sprint 13 | Not Started |
| TC-9.2 | Suite-9 | QA | Sprint 13 | Not Started |
