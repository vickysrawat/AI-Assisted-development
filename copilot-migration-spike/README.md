# Migration Family — Copilot Spike (Phase 1)

VS Code extension that exposes the migration family (Upgrade · Rewrite · Replatform) as a
Copilot Chat participant (`@migration`). This is a **time-boxed Phase 1 spike** — it validates
the key mechanics before full ICEA-driven implementation.

---

## Spike success criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | `@migration upgrade ADO-1234` triggers the participant | Type it in Copilot Chat — see stack detection output |
| 2 | Write Gate blocks file writes | Attempt an upgrade without approving — see the gate message + button |
| 3 | `migration.approve` unlocks writes | Run the command → re-send request → report written to disk |
| 4 | Anthropic key routes to `claude-opus-4-6` | Set `migration.anthropicApiKey` in settings → see judge model in response |
| 5 | Absent key falls back gracefully | Clear key → participant responds using Copilot model |
| 6 | `migration-source-detect.cjs` runs as child process | Stack detection results appear in Chat |
| 7 | Upgrade intake produces a Gap & Risk stub | Report content streams into Chat |

---

## Setup

### 1. Install dependencies

```bash
cd copilot-migration-spike
npm install
```

### 2. Copy migration scripts

The extension bundles three scripts from the plugin repo root.
`repo-detect.cjs` requires `stack-signals.cjs` as a sibling — all three must be present.

```bash
# From the repo root:
mkdir -p copilot-migration-spike/scripts
cp scripts/migration-source-detect.cjs copilot-migration-spike/scripts/
cp scripts/repo-detect.cjs             copilot-migration-spike/scripts/
cp scripts/stack-signals.cjs           copilot-migration-spike/scripts/
```

> Scripts are read-only (they write nothing) — safe to bundle.
> If you only copy `migration-source-detect.cjs` + `repo-detect.cjs`, detection silently
> returns null because `repo-detect.cjs` requires `./stack-signals.cjs` at runtime.

### 3. Compile TypeScript

```bash
npm run compile
```

### 4. Launch in VS Code Extension Development Host

Open `copilot-migration-spike/` in VS Code, then press **F5**.
A new VS Code window opens with the extension loaded.

### 5. Configure credentials (optional for spike)

**Anthropic API key** (for judge-gate escalation):

In VS Code settings, set:
```json
"migration.anthropicApiKey": "sk-ant-..."
```

**ADO PAT** (for future ADO integration):

Run from the Command Palette: `Migration: Set Azure DevOps PAT`

---

## Usage

Open GitHub Copilot Chat and type:

```
@migration upgrade ADO-1234 to .NET 8
@migration /upgrade ADO-1234 to version 17
@migration rewrite ADO-1234      ← stub in spike
@migration replatform ADO-1234   ← stub in spike
```

### Write Gate

Before any file is written to disk, the extension checks the Write Gate for the ADO ID.

- **Locked (default):** A message and a clickable button appear — click "Approve writes for ADO-1234".
- **Alternative:** Run `Migration: Approve write gate for ADO` from the Command Palette.
- **Revoke:** Run `Migration: Revoke write gate approval for ADO`.

The gate is stored in `workspaceState` — it resets when you close the workspace.

---

## Architecture

```
src/
  extension.ts          activate() — registers participant + commands
  participant.ts         @migration Chat participant handler (routing)
  writeGate.ts          workspaceState-backed Write Gate state machine
  configManager.ts      Anthropic API key + ADO PAT (SecretStorage)
  scriptRunner.ts        child_process wrapper for migration scripts
  skills/
    upgradeIntake.ts    Upgrade Stage 1 PoC (stack detect → Gap & Risk report)
scripts/                Migration scripts bundled from the plugin repo (read-only)
  migration-source-detect.cjs
  repo-detect.cjs
```

### Model routing

| Condition | Model used |
|---|---|
| `migration.anthropicApiKey` set | `claude-opus-4-6` (or value of `migration.judgeModel`) |
| Key absent | Active Copilot model (`migration.copilotFamilyFallback`, default `gpt-4o`) |

---

## What is NOT in the spike

- Rewrite and Replatform stage machines (stubs only).
- Full BAL/ERL gate enforcement.
- ADO REST API calls (PAT stored but not used).
- Ledger persistence across VS Code sessions.
- Multi-root workspace support beyond the first workspace folder.
- Marketplace packaging.

These are Phase 3 deliverables.

---

## Known limitations / open questions surfaced by the spike

Track answers here as you validate each criterion:

- [ ] Does `vscode.lm.selectChatModels` work inside the Extension Development Host without a
      real Copilot subscription? (Fallback path relies on this.)
- [ ] Does `vscode.chat.createChatParticipant` require a Copilot for Business or Enterprise seat,
      or does it work with any GitHub Copilot plan?
- [ ] Child process Node.js path (`process.execPath`) — does it resolve correctly inside the
      Extension Development Host on Windows with Git Bash as the configured shell?
- [ ] `TextEncoder` is available globally in Node 18+; confirm the VS Code extension host version.
