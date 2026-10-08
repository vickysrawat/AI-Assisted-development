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
export declare function activate(context: vscode.ExtensionContext): void;
export declare function deactivate(): void;
