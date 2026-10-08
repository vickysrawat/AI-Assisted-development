/**
 * participant.ts — @migration Copilot Chat participant handler.
 *
 * Routes incoming chat requests to the appropriate migration skill:
 *   @migration upgrade    → Upgrade skill (in-place same-stack version bump)
 *   @migration rewrite    → Rewrite skill (out-of-place stack translation)
 *   @migration replatform → Replatform skill (on-prem to cloud)
 *
 * Turn structure:
 *   Each Chat turn calls this handler. Before routing to any skill, the handler
 *   checks for pending multi-turn state (e.g. HIGH-risk acknowledgment awaiting YES).
 *   An explicit command invocation (upgrade/rewrite/replatform keyword) always starts
 *   a fresh run — stale pending state is cleared before routing.
 *
 * Message parsing:
 *   The participant command (/upgrade, /rewrite, /replatform) is available in
 *   `request.command`. The ADO ID and any version hint are parsed from the
 *   free-text `request.prompt`.
 */

import * as vscode from 'vscode';
import { WriteGateLockedError } from './writeGate';
import { resolveRoots } from './workspaceRoots';
import { clearCheckpoint, listActiveAdoIds } from './ledger';
import * as upgradeHandler from './skills/upgradeHandler';
import * as rewriteHandler from './skills/rewriteHandler';
import * as replatformHandler from './skills/replatformHandler';

// ── Message parsing ──────────────────────────────────────────────────────────

/**
 * Extracts a numeric ADO ID from a free-text prompt.
 * Accepts: "ADO-1234", "ADO 1234", "#1234", or a standalone 3-6 digit number.
 * Returns null if none found.
 */
function extractAdoId(prompt: string): string | null {
  const match = prompt.match(/(?:ADO[-\s#]?)(\d{3,6})/i) ?? prompt.match(/\b(\d{3,6})\b/);
  return match ? match[1] : null;
}

/**
 * Extracts a version string from the prompt.
 * Accepts: "to 8", "to .NET 10", "→ .NET 8", "version 17".
 */
function extractTargetVersion(prompt: string): string | null {
  const match = prompt.match(/(?:to|→|version)\s+([\w.\-]+(?:\s+\d+)?)/i);
  return match ? match[1].trim() : null;
}

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

/**
 * Returns true when the prompt looks like a gate acknowledgment or option/version
 * selection rather than a fresh skill invocation.
 *
 * Used to show a helpful reload-hint when no ADO ID was found in the prompt or
 * in-memory Maps (Bug 1: in-memory state is lost after a VS Code window reload).
 *
 * Recognised gate-response patterns:
 *   "YES" / "YES ..."           — HIGH-risk ack (Upgrade)
 *   Bare integer ("1", "2")     — Rewrite option selection
 *   Stack + version             — Target version supply ("to .NET 10", "Java 21", "10")
 */
function looksLikeGateResponse(prompt: string): boolean {
  const t = prompt.trim();
  if (/^yes\b/i.test(t)) { return true; }               // YES / YES ...
  if (/^\d+$/.test(t)) { return true; }                  // bare integer (option or version)
  if (/^\.net\s*\d+/i.test(t)) { return true; }          // .NET 10
  if (/^java\s*\d+/i.test(t)) { return true; }           // Java 21
  if (/^angular\s*\d+/i.test(t)) { return true; }        // Angular 19
  if (/^node(\.js)?\s*\d+/i.test(t)) { return true; }   // Node.js 22
  if (/^react\s*\d+/i.test(t)) { return true; }          // React 19
  return false;
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

    // ── Guard: workspace must be open ────────────────────────────────────────
    // Checked before any other logic so every skill gets a clean workspace guarantee.
    try {
      resolveRoots(); // throws if no workspace folder open
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stream.markdown(`\n> **@migration:** ${msg}`);
      return;
    }

    // ── Resolve effective ADO ID ──────────────────────────────────────────────
    // Extract from the current prompt first. When the developer replies "YES" or
    // a bare version string (with no ADO ID), fall back to any in-flight pending state.
    const command        = request.command ?? inferCommandFromPrompt(request.prompt);
    const promptAdoId    = extractAdoId(request.prompt);
    const effectiveAdoId = promptAdoId
      ?? upgradeHandler.getPendingAdoId()
      ?? rewriteHandler.getPendingAdoId();

    // ── Bug 2 fix: explicit command = fresh invocation ────────────────────────
    // When the developer explicitly invokes a skill (slash command or free-text keyword),
    // it is always a fresh run — never a pending-gate response.
    // Clear any stale in-memory AND ledger state so the new run is never hijacked by
    // a stale HIGH_RISK_ACK_PENDING or OPTIONS_ACK_PENDING from a prior session.
    const hasExplicitCommand = command !== undefined;
    if (effectiveAdoId && hasExplicitCommand) {
      upgradeHandler.clearPendingState(effectiveAdoId);
      rewriteHandler.clearPendingState(effectiveAdoId);
      clearCheckpoint(context, effectiveAdoId);
    }

    // ── Pending multi-turn ack check ──────────────────────────────────────────
    // Only run when NOT a fresh command invocation (gate responses: YES, option number,
    // bare version string). Each skill handler is tried in order; the first to claim
    // the turn returns true and routing stops.
    if (effectiveAdoId && !hasExplicitCommand) {
      if (await upgradeHandler.checkAndResumePending(effectiveAdoId, request, context, stream, token)) { return; }
      if (await rewriteHandler.checkAndResumePending(effectiveAdoId, request, context, stream, token)) { return; }
    }

    // ── Bug 1 fix: no ADO ID + looks like a gate response ────────────────────
    // The developer is likely responding to a pending gate after a VS Code window reload.
    // In-memory Maps reset on reload, so getPendingAdoId() returns null even when a
    // HIGH_RISK_ACK_PENDING checkpoint exists on disk.
    //
    // Scan the ledger directory to find any active checkpoint and tell the developer
    // exactly what to type. Without this message they would see the generic "requires
    // ADO ID" prompt and not understand why their "YES" was rejected.
    if (!effectiveAdoId && looksLikeGateResponse(request.prompt)) {
      const pendingIds = listActiveAdoIds(context);

      if (pendingIds.length === 1) {
        stream.markdown(
          `> ⚠ **Migration state lost — include the ADO ID in your reply**\n>\n` +
          `> A pending migration was found for **ADO-${pendingIds[0]}**, but the ` +
          `in-memory state was reset (this happens when VS Code reloads its window).\n>\n` +
          `> **To resume the HIGH-risk gate:** \`YES ADO-${pendingIds[0]}\`\n>\n` +
          `> **To start a fresh run instead:** \`@migration upgrade ADO-${pendingIds[0]} to <version>\``
        );
        return;
      }

      if (pendingIds.length > 1) {
        const list = pendingIds.map(id => `\`ADO-${id}\``).join(', ');
        stream.markdown(
          `> ⚠ **Migration state lost — include the ADO ID in your reply**\n>\n` +
          `> Multiple pending migrations were found: ${list}.\n>\n` +
          `> Include the ADO ID explicitly — for example: \`YES ADO-9020\``
        );
        return;
      }

      // No checkpoint on disk either — fall through to the standard "requires ADO ID" message.
    }

    // ── Route to skill ────────────────────────────────────────────────────────
    const adoId = effectiveAdoId;

    if (!adoId) {
      stream.markdown(
        '**@migration** requires an ADO work item ID. Examples:\n\n' +
        '> `@migration upgrade ADO-1234 to .NET 10`\n\n' +
        '> `@migration rewrite ADO-1234`\n\n' +
        '> `@migration replatform ADO-1234`'
      );
      return;
    }

    try {
      switch (command) {
        case 'upgrade':
          await upgradeHandler.handleUpgrade(
            adoId,
            extractTargetVersion(request.prompt),
            context,
            stream,
            token
          );
          break;

        case 'rewrite':
          await rewriteHandler.handleRewrite(adoId, context, stream, token);
          break;

        case 'replatform':
          await replatformHandler.handleReplatform(adoId, request.prompt, context, stream, token);
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
      stream.markdown(`\n\n**@migration error:** ${msg}`);
    }
  };
}

/** Help message shown when no recognisable command or skill is found. */
async function handleHelp(stream: vscode.ChatResponseStream): Promise<void> {
  stream.markdown(
    '## @migration — Migration Family\n\n' +
    'Available commands:\n\n' +
    '| Command | Description | Example |\n' +
    '|---|---|---|\n' +
    '| `/upgrade` | In-place same-stack version bump | `@migration upgrade ADO-1234 to .NET 10` |\n' +
    '| `/rewrite` | Out-of-place stack translation | `@migration rewrite ADO-1234` |\n' +
    '| `/replatform` | On-prem to cloud migration | `@migration replatform ADO-1234` |\n\n' +
    '**Command Palette:**\n' +
    '- `Migration: Approve Write` — unlock file writes for a given ADO ID\n' +
    '- `Migration: Revoke Approval` — re-lock writes\n' +
    '- `Migration: Set ADO PAT` — store your Azure DevOps PAT\n' +
    '- `Migration: Clear ADO PAT` — remove the stored PAT\n'
  );
}
