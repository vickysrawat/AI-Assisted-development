/**
 * participant.ts — @migration Copilot Chat participant handler.
 *
 * Routes incoming chat requests to the appropriate migration skill:
 *   @migration upgrade   → Upgrade skill (in-place same-stack version bump)
 *   @migration rewrite   → Rewrite skill (out-of-place stack translation) [stub in spike]
 *   @migration replatform → Replatform skill (on-prem to cloud) [stub in spike]
 *
 * Message parsing:
 *   The participant command (/upgrade, /rewrite, /replatform) is available in
 *   `request.command`. The ADO ID and any version hint are parsed from the
 *   free-text `request.prompt`.
 *
 * ADO ID extraction:
 *   The user can specify it as: "ADO-1234", "ADO 1234", or just "1234".
 *   If absent the participant asks for it before proceeding.
 */

import * as vscode from 'vscode';
import { handleUpgradeIntake } from './skills/upgradeIntake';
import { WriteGateLockedError } from './writeGate';

// ── Message parsing ──────────────────────────────────────────────────────────

/** Extracts a numeric ADO ID from a free-text prompt. Returns null if none found. */
function extractAdoId(prompt: string): string | null {
  // Matches: ADO-1234, ADO 1234, #1234, or a standalone 3-6 digit number.
  const match = prompt.match(/(?:ADO[-\s#]?)(\d{3,6})/i) ?? prompt.match(/\b(\d{3,6})\b/);
  return match ? match[1] : null;
}

/** Extracts a version string from the prompt (e.g. "to 8", "→ .NET 8", "version 17"). */
function extractTargetVersion(prompt: string): string | null {
  // Matches "to <version>", "→ <version>", "version <version>".
  const match = prompt.match(/(?:to|→|version)\s+([\w.\-]+)/i);
  return match ? match[1] : null;
}

// ── Participant handler ──────────────────────────────────────────────────────

/**
 * Creates the Chat request handler for the @migration participant.
 * Called once during extension activation; the returned handler is registered
 * with vscode.chat.createChatParticipant.
 */
export function createParticipantHandler(
  context: vscode.ExtensionContext
): vscode.ChatRequestHandler {

  return async (
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> => {

    // Determine which skill the developer wants.
    const command = request.command ?? inferCommandFromPrompt(request.prompt);

    // Extract ADO ID — required for all skills (gates are per-ADO).
    const adoId = extractAdoId(request.prompt);
    if (!adoId) {
      stream.markdown(
        'Please include an ADO ID in your request, for example:\n\n' +
        '> `@migration upgrade ADO-1234 to .NET 8`\n\n' +
        '> `@migration rewrite ADO-1234 to React 18`'
      );
      return;
    }

    try {
      switch (command) {
        case 'upgrade':
          await handleUpgrade(adoId, request, context, stream, token);
          break;

        case 'rewrite':
          await handleRewriteStub(adoId, stream);
          break;

        case 'replatform':
          await handleReplatformStub(adoId, stream);
          break;

        default:
          await handleHelp(stream);
      }
    } catch (err) {
      if (err instanceof WriteGateLockedError) {
        // Already handled — assertGateOpen streamed the message and button.
        return;
      }
      // Unexpected error — surface it cleanly without crashing VS Code.
      const msg = err instanceof Error ? err.message : String(err);
      stream.markdown(`\n\n**Unexpected error:** ${msg}`);
    }
  };
}

// ── Skill dispatchers ────────────────────────────────────────────────────────

/** Dispatches to the Upgrade intake PoC (the only fully implemented skill in the spike). */
async function handleUpgrade(
  adoId: string,
  request: vscode.ChatRequest,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  const targetVersion = extractTargetVersion(request.prompt);

  stream.markdown(
    `## Migration: Upgrade — ADO-${adoId}\n\n` +
    `Running intake for **ADO-${adoId}**${targetVersion ? ` → target version \`${targetVersion}\`` : ''}.\n\n`
  );

  await handleUpgradeIntake(adoId, targetVersion, context, request, stream, token);
}

/**
 * Stub handler for the Rewrite skill.
 * Full implementation is Phase 3 — shows what the participant will do.
 */
async function handleRewriteStub(
  adoId: string,
  stream: vscode.ChatResponseStream
): Promise<void> {
  stream.markdown(
    `## Migration: Rewrite — ADO-${adoId}\n\n` +
    '> **Spike stub** — Rewrite skill is not yet implemented in the Phase 1 spike.\n\n' +
    'The full Rewrite skill will:\n' +
    '1. Detect source stack and resolve migration posture (port / re-architecture).\n' +
    '2. Present target OPTIONS across assurance × effort × TCO.\n' +
    '3. Decompose the work along a dependency DAG in target space.\n' +
    '4. Generate one cluster per git worktree, each gated by BAL and ERL.\n\n' +
    'Phase 3 will implement the full stage machine.'
  );
}

/**
 * Stub handler for the Replatform skill.
 * Full implementation is Phase 3.
 */
async function handleReplatformStub(
  adoId: string,
  stream: vscode.ChatResponseStream
): Promise<void> {
  stream.markdown(
    `## Migration: Replatform — ADO-${adoId}\n\n` +
    '> **Spike stub** — Replatform skill is not yet implemented in the Phase 1 spike.\n\n' +
    'The full Replatform skill will:\n' +
    '1. Classify the 6R posture (rehost / replatform / refactor-for-cloud).\n' +
    '2. Capture an NFR spec as the primary intent.\n' +
    '3. Decompose by cloud capability (compute · data · identity · messaging · observability).\n' +
    '4. Author IaC + runbooks — human executes (LLM never touches real infrastructure).\n\n' +
    'Phase 3 will implement the full stage machine.'
  );
}

/** Help message shown when no recognisable command or skill is found. */
async function handleHelp(stream: vscode.ChatResponseStream): Promise<void> {
  stream.markdown(
    '## @migration — Migration Family\n\n' +
    'Available commands:\n\n' +
    '| Command | Description | Example |\n' +
    '|---|---|---|\n' +
    '| `/upgrade` | In-place same-stack version bump | `@migration upgrade ADO-1234 to .NET 8` |\n' +
    '| `/rewrite` | Out-of-place stack translation (stub) | `@migration rewrite ADO-1234 to React 18` |\n' +
    '| `/replatform` | On-prem to cloud migration (stub) | `@migration replatform ADO-1234 to Azure` |\n\n' +
    '**Other commands (palette):**\n' +
    '- `Migration: Approve write gate for ADO` — unlocks file writes for a given ADO ID.\n' +
    '- `Migration: Set Azure DevOps PAT` — stores your ADO personal access token.\n'
  );
}

// ── Prompt-based command inference ───────────────────────────────────────────

/**
 * Infers the migration command when the developer types free-text without /upgrade etc.
 * e.g. "@migration upgrade my app ADO-1234" → "upgrade"
 */
function inferCommandFromPrompt(prompt: string): string | undefined {
  const lower = prompt.toLowerCase();
  if (lower.includes('upgrade') || lower.includes('bump') || lower.includes('update version')) {
    return 'upgrade';
  }
  if (lower.includes('rewrite') || lower.includes('port to') || lower.includes('translate')) {
    return 'rewrite';
  }
  if (lower.includes('replatform') || lower.includes('move to cloud') || lower.includes('lift and shift')) {
    return 'replatform';
  }
  return undefined;
}
