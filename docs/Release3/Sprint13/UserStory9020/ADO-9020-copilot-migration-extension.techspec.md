# Epic Tech Spec — Copilot Migration Extension (Phase 3 Full Implementation)
ADO #9020 · Release 3 · Sprint 13
Status: DRAFT · EPIC · 21 SP total

---

## Overview

This epic delivers a standalone VS Code extension (`copilot-extension/`) promoted from the Phase 1 spike (`copilot-migration-spike/`). The extension registers `@migration` as a GitHub Copilot Chat participant and exposes all three migration skills — Upgrade, Rewrite, and Replatform — as TypeScript state machines. Each skill is driven by developer prompts in Copilot Chat and produces file-written artifacts in the workspace, enforced by a Write Gate. The extension uses Anthropic API for HIGH-risk judge gates when a key is configured, falls back to the Copilot model for LOW/MEDIUM risk, and requires explicit developer acknowledgment (via a follow-up Chat message) before continuing with the Copilot model on any HIGH-risk gate. The extension is fully standalone: it has no runtime or build-time dependency on the Claude Code plugin repo; all shared CJS scripts are vendored into `copilot-extension/scripts/`.

**Scope boundaries (what this epic does NOT do):** git worktree generation, cluster code generation, ADO REST API calls, VS Code Marketplace publish, hooks/audit trail/dream memory parity with Claude Code.

---

## Story Breakdown

All implementation detail (AC Coverage Matrix, Files Changed, Test Cases) lives in each story's individual tech spec linked below.

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Scaffold promotion + shared infrastructure | 4 | Yes — installs and activates; no skill output | None | ADO-9020-Story-1-scaffold.techspec.md | Pending |
| 2 | Upgrade full stage machine | 4 | Yes — Upgrade E2E against real repo | Story 1 | ADO-9020-Story-2-upgrade.techspec.md | Pending |
| 3 | Rewrite handler (options + architecture gates) | 5 | Yes — Rewrite options+arch without worktrees | Story 1 | ADO-9020-Story-3-rewrite.techspec.md | Pending |
| 4 | Replatform handler (6R + NFR + IaC) | 5 | Yes — Replatform IaC output to workspace | Story 1 | ADO-9020-Story-4-replatform.techspec.md | Pending |
| 5 | Should-haves: judge ladder + ledger + multi-root | 3 | Yes — additive; skills degrade gracefully without it | Story 1 | ADO-9020-Story-5-shouldhaves.techspec.md | Pending |

> Story 1 owns all shared infrastructure (writeGate, configManager, scriptRunner, participant router, package.json manifest) that every later story depends on. Stories 2–4 each add exactly one skill handler. Story 5 wires the judge ladder, ledger persistence, and multi-root resolution into the already-working skills.

---

## Auth & Security

**Authentication pattern:** No traditional auth. Extension operates inside the VS Code extension host; Copilot authentication is managed by VS Code's Copilot extension natively. Anthropic API key is a user-configured VS Code setting (`migration.anthropicApiKey`), not a secret — no secret store for API keys in VS Code settings is provided by the platform.

**ADO PAT storage:** `vscode.SecretStorage` exclusively. Never stored in `settings.json` (committed/shared), workspace state, or extension-global state. `configManager.ts` is the sole accessor.

**Authorization:** No multi-user authorization surface. The extension operates as the logged-in developer's process only.

**Cross-cutting security concerns:**

| Concern | Mitigation |
|---|---|
| Shell injection | Eliminated: `require()` is used instead of `execFileAsync`/shell:true; no shell string is ever constructed from user input |
| Sensitive data in settings | ADO PAT stored in SecretStorage; Anthropic API key is in VS Code settings (non-secret; acceptable for API keys per VS Code conventions) |
| Arbitrary file write | Write Gate (`writeGate.assertGateOpen`) must pass before any `vscode.workspace.fs.writeFile` call; all writes go to workspace-relative paths only |
| process.execPath mutation | `process.execPath` is patched only in `scriptRunner.detectSource()` via a try/finally guard that always restores it; no other code reads `process.execPath` during the window |
| Vendored script tampering | Scripts are committed to source control; the extension host loads them via `require()` from the extension's own bundle folder — no network fetch, no dynamic download |

---

## Overall Request Flow

The Chat participant handler is the entry point for all `@migration` invocations. Below is the full turn-by-turn flow for the Upgrade skill (all other skills follow the same pattern with their own stage machines).

```
Turn 1: "@migration upgrade ADO-1234 to .NET 10"
  → participant.ts createParticipantHandler(context)
      → checkPendingAck(adoId, stream)   ← checks ledger FIRST (no pending ack here)
      → extractCommand()  → 'upgrade'
      → extractAdoId()    → '1234'
      → extractTargetVersion() → '.NET 10'
      → upgradeHandler.handleUpgrade('1234', '.NET 10', context, request, stream, token)

          [Stage: INTAKE]
          → workspaceRoots.resolveRoots(context)      → string[]
          → stream.markdown("**Scanning:** ...")
          → scriptRunner.detectSource(extensionUri, roots)
              → resolveNodeExe()
              → process.execPath = nodeExe  (patch)
              → require('migration-source-detect.cjs').createDescriptor(roots)
              → process.execPath = original  (restore)
          → stream.markdown(formatSourceDescriptor(descriptor))
          → classifyAxis(descriptor, '.NET 10')
              → if not same-stack upgrade → stream mismatch message → return
          → if targetVersion missing → stream question → return
          (ledger checkpoint: adoId → stage=GAP_RISK)

          [Stage: GAP_RISK]
          → configManager.hasAnthropicKey()
              → true  → judgeGate.generateGapRisk(descriptor, '.NET 10', 'anthropic')
              → false → judgeGate.generateGapRisk(descriptor, '.NET 10', 'copilot')
          → classifyRisk(report) → 'HIGH' | 'MEDIUM' | 'LOW'
          → if HIGH + !hasAnthropicKey:
              → stream WARN banner
              → ledger.setPendingAck(adoId, 'highRiskAck')
              → (ledger checkpoint: adoId → stage=HIGH_RISK_ACK_PENDING)
              → return  ← turn ends here

Turn 2: "YES"  (developer replies to WARN banner)
  → participant.ts createParticipantHandler(context)
      → checkPendingAck('1234', stream)
          → ledger.getPendingAck('1234', 'highRiskAck') === true
          → stream: "Acknowledged — continuing with Copilot model."
          → ledger.clearPendingAck('1234', 'highRiskAck')
          → resume from GAP_RISK stage (ledger checkpoint read)
          → continue to WRITE_GATE...

          [Stage: WRITE_GATE]
          → writeGate.assertGateOpen(context, '1234', stream)
              → if !approved → stream locked message + stream.button() → throw WriteGateLockedError
          → (ledger checkpoint: adoId → stage=REPORT_WRITE)

          [Stage: REPORT_WRITE]
          → reportPath = `{workspaceRoot}/.migration/ADO-1234-upgrade-gap-risk.md`
          → vscode.workspace.fs.writeFile(vscode.Uri.file(reportPath), encode(report))
          → stream.markdown(`Report written to \`${reportPath}\``)
          (ledger checkpoint: adoId → stage=COMPLETE)
```

---

## Module Architecture

```
copilot-extension/
├── package.json              # Extension manifest (Story 1)
├── tsconfig.json             # TypeScript config (Story 1)
├── src/
│   ├── extension.ts          # activate() — registers participant + 4 commands (Story 1)
│   ├── participant.ts        # createParticipantHandler — routes commands, checks pending acks (Story 1)
│   ├── writeGate.ts          # assertGateOpen / approve / revoke via workspaceState (Story 1)
│   ├── configManager.ts      # Anthropic key, judge model, ADO PAT via SecretStorage (Story 1)
│   ├── scriptRunner.ts       # require() + process.execPath patch + resolveNodeExe() (Story 1)
│   ├── workspaceRoots.ts     # resolveRoots() — single-root now, multi-root in Story 5 (Story 1 + 5)
│   ├── judgeGate.ts          # generateGapRisk() — model dispatch + risk classification (Story 5)
│   ├── ledger.ts             # checkpoint JSON to .migration-checkpoint/ (Story 5)
│   └── skills/
│       ├── upgradeHandler.ts    # Upgrade 5-state machine (Story 2)
│       ├── rewriteHandler.ts    # Rewrite 4-state machine (Story 3)
│       └── replatformHandler.ts # Replatform 4-state machine (Story 4)
└── scripts/                  # Vendored CJS (Story 1)
    ├── migration-source-detect.cjs
    ├── repo-detect.cjs
    ├── stack-signals.cjs
    ├── checkpoint-ledger.cjs
    └── resolve-migration-roots.cjs
```

---

## State Machines

### Upgrade state machine (`upgradeHandler.ts`)

| State | Input | Action | Next state |
|---|---|---|---|
| `INTAKE` | adoId, targetVersion, context | detectSource + classifyAxis; if targetVersion missing → stream question, set ledger `stage=TARGET_VERSION_PENDING`, return | `TARGET_VERSION_PENDING` or `GAP_RISK` or stop (wrong axis) |
| `TARGET_VERSION_PENDING` | next Chat turn (any text) | `participant.ts` resolves pending session for adoId; extracts targetVersion from prompt; if still absent → re-stream question; if present → continue | `GAP_RISK` |
| `GAP_RISK` | SourceDescriptor, targetVersion | `judgeGate.generateGapRisk()` — dispatches: (a) Anthropic if key present, (b) Copilot if key absent + LOW/MEDIUM risk, (c) stream error + halt if no model at all (AC-F17). If (b) + HIGH risk → stream WARN, set `pendingHighRiskAck=true`, return | `HIGH_RISK_ACK_PENDING` or `WRITE_GATE` or halt |
| `HIGH_RISK_ACK_PENDING` | next Chat turn | `participant.ts` checks for pending ack FIRST; if prompt = "YES" → clear flag, resume; if prompt ≠ "YES" → re-stream WARN reminder, return; never routes to next state on unrecognized reply | `WRITE_GATE` or stay |
| `WRITE_GATE` | adoId | `writeGate.assertGateOpen()` | `REPORT_WRITE` or throw `WriteGateLockedError` |
| `REPORT_WRITE` | report, adoId | `vscode.workspace.fs.writeFile` to `.migration/ADO-{id}-upgrade-gap-risk.md` | `COMPLETE` |
| `COMPLETE` | — | stream path confirmation | — |

### Rewrite state machine (`rewriteHandler.ts`)

| State | Input | Action | Next state |
|---|---|---|---|
| `INTAKE` | adoId | detectSource + classifyPosture | `OPTIONS` |
| `OPTIONS` | SourceDescriptor | generateOptions (3+ paths with pros/cons) + Write Gate + write `options.md` | `OPTIONS_ACK_PENDING` |
| `OPTIONS_ACK_PENDING` | developer option selection | parse selected option | `ARCHITECTURE` |
| `ARCHITECTURE` | selected option | generateArchDoc + Write Gate + write `arch.md` (note: "Worktree generation deferred to V2") | `COMPLETE` |
| `COMPLETE` | — | stream confirmation | — |

### Replatform state machine (`replatformHandler.ts`)

| State | Input | Action | Next state |
|---|---|---|---|
| `INTAKE` | adoId | detectSource + classify6R posture | `NFR_SPEC` |
| `NFR_SPEC` | 6R posture | generate NFR spec (availability %, RTO, RPO, DR) | `IaC_AUTHORING` |
| `IaC_AUTHORING` | NFR spec, posture | generate Bicep (default) or Terraform (if `terraform` in prompt); Write Gate; write IaC files | `COMPLETE` |
| `COMPLETE` | — | stream confirmation listing written files | — |

> **IaC format decision:** default to Bicep (Azure-first context); developer can include `terraform` in the `@migration replatform` prompt to switch. This avoids a blocking question when the default is clear.

---

## Ledger Schema (Story 5)

Checkpoint written to `{workspaceRoot}/.migration-checkpoint/{adoId}.json` after each state transition:

```json
{
  "adoId": "1234",
  "skill": "upgrade",
  "stage": "GAP_RISK",
  "pendingAcks": {
    "highRiskAck": true
  },
  "data": {
    "descriptor": { ... },
    "targetVersion": ".NET 10",
    "report": "...",
    "riskLevel": "HIGH"
  },
  "updatedAt": "2026-10-07T00:00:00Z"
}
```

`ledger.ts` uses `vscode.workspace.fs.writeFile` to write the checkpoint and `readFile` to read it on resume. The `.migration-checkpoint/` folder is the checkpoint store; the `.migration/` folder is the output artifact store.

---

## Rollback

**Schema migrations:** None — no database involved.

**Rollback procedure:**
1. Uninstall the VSIX from VS Code (`Extensions → Manage → Uninstall`).
2. If needed, delete `.migration-checkpoint/` and `.migration/` from the workspace (these are developer-owned artifacts, not application code).
3. No code changes to existing repos — the extension is additive only.

**Per-story rollback:** Each story adds files to `copilot-extension/`; all stories are additive. Rolling back Story N means removing its handler file. Stories 2–5 have no cross-story runtime dependencies beyond Story 1's shared modules.

---

## Handover

### QA Team

**What was added:**
- `@migration upgrade ADO-{ID} [to <version>]` — stack detection + Gap & Risk report + Write Gate + file write
- `@migration rewrite ADO-{ID}` — options gate + architecture gate (no worktrees)
- `@migration replatform ADO-{ID}` — 6R posture + NFR spec + IaC output
- 4 Command Palette commands: `Migration: Approve Write`, `Migration: Revoke Approval`, `Migration: Set ADO PAT`, `Migration: Clear ADO PAT`

**Test entry points:**

| Story | Environment | Setup | What to verify |
|---|---|---|---|
| 1 | VS Code Dev Host with spike→extension folder | Open `copilot-extension/` in Dev Host, press F5 | Extension activates, `@migration` appears in Chat, 4 commands in palette |
| 2 | VS Code Dev Host with a .NET workspace open | Run `@migration upgrade ADO-TEST to .NET 10` | Stack detected, report streamed, Write Gate blocks write, report written after approve |
| 3 | VS Code Dev Host with Angular workspace | Run `@migration rewrite ADO-TEST` | Options doc written, arch doc written after selection |
| 4 | VS Code Dev Host with .NET API workspace | Run `@migration replatform ADO-TEST` | 6R shown, NFR spec shown, Bicep files written |
| 5 | VS Code Dev Host with multi-root workspace | Any command | All roots listed in Scanning line; checkpoint JSON survives window reload |

**Regression risk:** The spike (`copilot-migration-spike/`) is renamed but not deleted from git history. No existing plugin code is modified; regression risk is zero for existing skills.

**Test data:** No seed scripts needed. Use any real .NET/Angular workspace. `KE.KMS.Trackers.Adapter` (already verified in spike) is the canonical test workspace for Upgrade.

### DevOps / Platform Team

**Deployment:** VSIX file produced by `vsce package` in `copilot-extension/`. Install via `Extensions → Install from VSIX...` or `code --install-extension copilot-migration-extension-{version}.vsix`.

| Item | Story | Detail |
|---|---|---|
| Node.js on PATH required | 1 | Developer machine must have Node.js ≥18; extension surfaces error if absent |
| VS Code ≥ 1.90 required | 1 | Copilot Chat participant API unavailable in earlier versions |
| GitHub Copilot extension active | 1 | Required for Copilot model fallback; Anthropic key covers judge gates without it |
| `migration.anthropicApiKey` setting | 2 | Optional; set in VS Code User Settings; unlocks Anthropic judge model for HIGH-risk gates |
| ADO PAT via Command Palette | 1 | `Migration: Set ADO PAT` — stored in VS Code SecretStorage; no environment variable required |
| `.migration-checkpoint/` folder | 5 | Auto-created in workspace root; can be added to `.gitignore` if preferred |
| `.migration/` output folder | 2 | Auto-created in workspace root; contains written reports and IaC files |

### Future Developer — Follow-on Work

1. All shared infrastructure lives in `copilot-extension/src/` (Story 1 modules). New skill handlers go in `copilot-extension/src/skills/`.
2. To add a new skill: (a) add a handler in `skills/`, (b) add a command entry in `package.json` → `contributes.chatParticipants[0].commands`, (c) add a routing case in `participant.ts` `extractCommand()`.
3. To update vendored scripts: copy the updated `.cjs` from `scripts/` in the plugin repo into `copilot-extension/scripts/`; run `node <script> --json --roots=<path>` to verify before committing.
4. For Marketplace publish (V2): update `publisher` field in `package.json`, acquire a verified publisher account, run `vsce publish`. The structure is already Marketplace-ready.
5. Worktree generation (V2): Story 3 has an explicit deferral comment in the Rewrite handler; the `ARCHITECTURE` state is where worktree creation would be wired in.
6. `judgeGate.ts` (Story 5) is the single point for all LLM judge calls — add new gate types there, not in individual skill handlers.

---

## Definition of Done — Epic

The epic is done when ALL of the following are true:

**Delivery**
- [ ] All 5 story tech specs generated and saved (tracker shows all complete)
- [ ] All stories implemented, reviewed, and merged (tracker Child ADO # filled)
- [ ] All child ADOs closed in Azure DevOps

**Quality**
- [ ] VSIX builds cleanly from `copilot-extension/` with zero TypeScript errors
- [ ] Upgrade E2E verified against KE.KMS.Trackers.Adapter (stack detected, report written)
- [ ] Write Gate blocks writes before `migration.approve`, unblocks after
- [ ] HIGH-risk WARN + ack flow tested: no continuation without explicit YES
- [ ] No Anthropic key configured: Copilot fallback works for LOW/MEDIUM risk
- [ ] No Copilot model + no Anthropic key: clear error message, no blank report
- [ ] `require()` module cache verified: second invocation does not re-load scripts
- [ ] All 5 vendored scripts present and committed in `copilot-extension/scripts/`

**Review**
- [ ] Epic tech spec reviewed by Tech Lead
- [ ] Each story's PR maps changed files to ACs (AC Coverage Matrix)
- [ ] ICEA and all story tech specs committed in the feature branch

---

## Reviewer Checklist

- [ ] Every `vscode.workspace.fs.writeFile` call is preceded by `assertGateOpen` — no unguarded writes
- [ ] `process.execPath` is always restored in `scriptRunner.detectSource()` — verify the try/finally is present in the submitted code
- [ ] `judgeGate.ts` dispatches to Anthropic for HIGH-risk when key present; never silent Copilot fallback on HIGH-risk without WARN
- [ ] `ledger.ts` writes checkpoint after each state transition — no lost state on VS Code reload between turns
- [ ] `participant.ts` checks `pendingAck` at the START of every handler turn — no route that bypasses the ack check
- [ ] ADO PAT never appears in any `stream.markdown()` output, any log, or any checkpoint JSON
- [ ] All TypeScript: no `any` types; every function has a single responsibility; `// DECISION:` comments on all non-obvious design choices
- [ ] `copilot-extension/` has zero `import` or `require()` references to paths outside its own folder — no runtime dependency on plugin repo

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| 1 | Which Marketplace publisher account will be used? (Does not block Sprint 13 VSIX — deferred from ICEA.) | Platform Engineer | V2 planning | Deferred |

---

## Revision Log

2026-10-07 — Epic tech spec drafted from approved ICEA (ADO-9020, critic PASS WITH NOTES applied).
2026-10-07 — Critic gate: PASS WITH NOTES. Applied 3 corrections: TARGET_VERSION_PENDING state added to Upgrade machine (AC-F2 multi-turn flow); AC-F17 no-model error halt path explicit in GAP_RISK state; HIGH_RISK_ACK_PENDING non-YES path specified (re-stream WARN, never advance).
