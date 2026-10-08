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
/**
 * Creates the Chat request handler for the @migration participant.
 * Called once during extension activation; the returned handler is registered
 * with vscode.chat.createChatParticipant.
 */
export declare function createParticipantHandler(context: vscode.ExtensionContext): vscode.ChatRequestHandler;
