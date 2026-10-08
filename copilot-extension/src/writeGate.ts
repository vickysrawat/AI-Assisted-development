/**
 * writeGate.ts — Write Gate state machine for the migration family.
 *
 * Replaces the Claude Code keyword-based `APPROVE ADO-{ID}` pattern with an
 * explicit VS Code command (`migration.approve`). Approval is stored in
 * workspaceState so it survives the current session but resets on workspace close.
 *
 * Gate semantics (mirrors CLAUDE.md §0):
 *   - Each ADO ID has an independent approval flag.
 *   - `APPROVE ALL` is not supported — per-ADO approval only.
 *   - A gate check that fails returns a ChatResponseButtonPart prompting the
 *     developer to run the approve command, keeping the prompt on-screen.
 */

import * as vscode from 'vscode';

// Storage key prefix — namespaced to avoid collisions with other extensions.
const KEY_PREFIX = 'migration.writeGate.approved.';

/**
 * Returns the workspaceState key for a given ADO ID.
 * ADO ID is normalised to digits only (e.g. "ADO-1234" → "1234").
 */
function stateKey(adoId: string): string {
  const normalised = adoId.replace(/[^0-9]/g, '');
  return `${KEY_PREFIX}${normalised}`;
}

/**
 * Check whether the Write Gate is open for a given ADO ID.
 * Returns true only if the developer has explicitly approved via `migration.approve`.
 */
export function isApproved(context: vscode.ExtensionContext, adoId: string): boolean {
  return context.workspaceState.get<boolean>(stateKey(adoId), false);
}

/**
 * Open the Write Gate for a given ADO ID.
 * Called by the `migration.approve` command handler.
 */
export async function approve(
  context: vscode.ExtensionContext,
  adoId: string
): Promise<void> {
  await context.workspaceState.update(stateKey(adoId), true);
}

/**
 * Close (revoke) the Write Gate for a given ADO ID.
 * Called by the `migration.revokeApproval` command handler.
 */
export async function revoke(
  context: vscode.ExtensionContext,
  adoId: string
): Promise<void> {
  await context.workspaceState.update(stateKey(adoId), false);
}

/**
 * Assert the gate is open before performing any write operation.
 * If the gate is locked, streams a blocked message with a clickable button
 * to run the approve command, then throws to stop the caller.
 *
 * Usage in skill handlers:
 *   await assertGateOpen(context, adoId, stream);
 *   // safe to write below here
 */
export async function assertGateOpen(
  context: vscode.ExtensionContext,
  adoId: string,
  stream: vscode.ChatResponseStream
): Promise<void> {
  if (isApproved(context, adoId)) {
    return; // gate is open — caller may proceed
  }

  const normId = adoId.replace(/[^0-9]/g, '');

  stream.markdown(
    `\n> **Write Gate is locked for ADO-${normId}.**\n` +
    `> No files will be written until you explicitly approve.\n\n` +
    `Run the approve command below, then re-send your request.\n`
  );

  // Clickable button — opens the approve command pre-filled with the ADO ID.
  stream.button({
    command: 'migration.approve',
    arguments: [normId],
    title: `Approve writes for ADO-${normId}`,
  });

  // Throw so the caller aborts the current response without writing anything.
  throw new WriteGateLockedError(`Write Gate locked for ADO-${normId}`);
}

/** Thrown by assertGateOpen when the gate is locked. Callers catch this to exit cleanly. */
export class WriteGateLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteGateLockedError';
  }
}
