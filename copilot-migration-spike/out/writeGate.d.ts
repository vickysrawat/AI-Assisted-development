/**
 * writeGate.ts — Write Gate state machine for the migration family.
 *
 * Replaces the Claude Code keyword-based `APPROVE ADO-{ID}` pattern with an
 * explicit VS Code command (`migration.approve`). Approval is stored in
 * workspaceState so it survives the current session but resets on workspace close.
 *
 * Gate semantics (mirrors CLAUDE.md §0):
 *   - Each ADO ID has an independent approval flag.
 *   - `APPROVE ALL` is not supported in the spike — per-ADO only.
 *   - A gate check that fails returns a ChatResponseButtonPart prompting the
 *     developer to run the approve command, keeping the prompt on-screen.
 */
import * as vscode from 'vscode';
/**
 * Check whether the Write Gate is open for a given ADO ID.
 * Returns true only if the developer has explicitly approved via `migration.approve`.
 */
export declare function isApproved(context: vscode.ExtensionContext, adoId: string): boolean;
/**
 * Open the Write Gate for a given ADO ID.
 * Called by the `migration.approve` command handler.
 */
export declare function approve(context: vscode.ExtensionContext, adoId: string): Promise<void>;
/**
 * Close (revoke) the Write Gate for a given ADO ID.
 * Called by the `migration.revokeApproval` command handler.
 */
export declare function revoke(context: vscode.ExtensionContext, adoId: string): Promise<void>;
/**
 * Assert the gate is open before performing any write operation.
 * If the gate is locked, streams a blocked message with a clickable button
 * to run the approve command, then throws to stop the caller.
 *
 * Usage in participant handler:
 *   await assertGateOpen(context, adoId, stream);
 *   // safe to write below here
 */
export declare function assertGateOpen(context: vscode.ExtensionContext, adoId: string, stream: vscode.ChatResponseStream): Promise<void>;
/** Thrown by assertGateOpen when the gate is locked. Callers catch this to exit cleanly. */
export declare class WriteGateLockedError extends Error {
    constructor(message: string);
}
