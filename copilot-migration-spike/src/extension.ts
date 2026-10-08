/**
 * extension.ts — VS Code extension entry point.
 *
 * Registers:
 *   - The @migration Copilot Chat participant.
 *   - The migration.approve / migration.revokeApproval Write Gate commands.
 *   - The migration.setAdoPat / migration.clearAdoPat credential commands.
 *
 * Lifecycle:
 *   activate()   — called by VS Code when the extension first activates
 *                  (activationEvent: onStartupFinished).
 *   deactivate() — called on extension host shutdown; clean-up if needed.
 */

import * as vscode from 'vscode';
import { createParticipantHandler } from './participant';
import { approve, revoke, isApproved } from './writeGate';
import { storeAdoPat, clearAdoPat } from './configManager';

export function activate(context: vscode.ExtensionContext): void {

  // ── Chat participant ───────────────────────────────────────────────────────

  const handler = createParticipantHandler(context);

  // The participant ID must match `contributes.chatParticipants[].id` in package.json.
  const participant = vscode.chat.createChatParticipant('migration', handler);

  // Icon shown next to the participant name in the Chat panel (optional in spike).
  participant.iconPath = new vscode.ThemeIcon('arrow-swap');

  context.subscriptions.push(participant);

  // ── Write Gate commands ────────────────────────────────────────────────────

  /**
   * migration.approve — opens the Write Gate for a given ADO ID.
   *
   * Can be invoked:
   *   (a) Via the clickable button streamed by assertGateOpen (args = [adoId]).
   *   (b) Via the Command Palette (prompts for ADO ID if args are empty).
   */
  const approveCmd = vscode.commands.registerCommand(
    'migration.approve',
    async (...args: unknown[]) => {
      // Argument from the button click contains the ADO ID as a string.
      let adoId = typeof args[0] === 'string' ? args[0] : undefined;

      if (!adoId) {
        // Command palette path — ask the developer.
        adoId = await vscode.window.showInputBox({
          title:       'Approve Migration Write Gate',
          prompt:      'Enter the ADO ID to approve writes for (e.g. 1234 or ADO-1234)',
          placeHolder: '1234',
          validateInput: v => /^\d{3,6}$/.test(v.trim()) ? undefined : 'Enter digits only (3–6 digits)',
        });
      }

      if (!adoId) { return; } // Developer cancelled.

      const normId = adoId.replace(/[^0-9]/g, '');

      await approve(context, normId);

      vscode.window.showInformationMessage(
        `Migration write gate OPEN for ADO-${normId}. ` +
        `Re-send your @migration request to proceed with file writes.`
      );
    }
  );

  /**
   * migration.revokeApproval — closes (locks) the Write Gate for a given ADO ID.
   * Use this after writes are complete or if you change your mind.
   */
  const revokeCmd = vscode.commands.registerCommand(
    'migration.revokeApproval',
    async (...args: unknown[]) => {
      let adoId = typeof args[0] === 'string' ? args[0] : undefined;

      if (!adoId) {
        adoId = await vscode.window.showInputBox({
          title:       'Revoke Migration Write Gate',
          prompt:      'Enter the ADO ID to revoke write approval for',
          placeHolder: '1234',
        });
      }

      if (!adoId) { return; }

      const normId = adoId.replace(/[^0-9]/g, '');

      if (!isApproved(context, normId)) {
        vscode.window.showInformationMessage(`Write gate for ADO-${normId} was already locked.`);
        return;
      }

      await revoke(context, normId);
      vscode.window.showInformationMessage(`Migration write gate LOCKED for ADO-${normId}.`);
    }
  );

  // ── Credential commands ────────────────────────────────────────────────────

  /**
   * migration.setAdoPat — prompts for an Azure DevOps PAT and stores it in SecretStorage.
   * The PAT is encrypted at rest; never written to disk in plaintext.
   */
  const setPatCmd = vscode.commands.registerCommand(
    'migration.setAdoPat',
    async () => {
      const pat = await vscode.window.showInputBox({
        title:    'Set Azure DevOps PAT',
        prompt:   'Enter your Azure DevOps Personal Access Token',
        password: true, // masks input — VS Code shows dots
        ignoreFocusOut: true,
        validateInput: v => v.trim().length < 10 ? 'PAT appears too short' : undefined,
      });

      if (!pat) { return; } // Developer cancelled.

      await storeAdoPat(context.secrets, pat.trim());
      vscode.window.showInformationMessage('Azure DevOps PAT stored securely.');
    }
  );

  /**
   * migration.clearAdoPat — removes the stored ADO PAT from SecretStorage.
   */
  const clearPatCmd = vscode.commands.registerCommand(
    'migration.clearAdoPat',
    async () => {
      const confirmed = await vscode.window.showWarningMessage(
        'Remove the stored Azure DevOps PAT?',
        { modal: true },
        'Remove'
      );

      if (confirmed !== 'Remove') { return; }

      await clearAdoPat(context.secrets);
      vscode.window.showInformationMessage('Azure DevOps PAT removed.');
    }
  );

  context.subscriptions.push(approveCmd, revokeCmd, setPatCmd, clearPatCmd);

  // Log activation so the developer can confirm the extension loaded.
  console.log('[migration-spike] Extension activated — @migration participant registered.');
}

export function deactivate(): void {
  // No teardown needed — VS Code disposes all registered subscriptions automatically.
}
