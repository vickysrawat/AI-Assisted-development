/**
 * upgradeIntake.ts — Upgrade Stage 1 (intake) proof-of-concept.
 *
 * This is the spike implementation of the UPGRADE skill's first stage:
 *   Stage 1: Detect source stack + version → confirm migration axis → produce Gap & Risk
 *            report stub.
 *
 * In the full plugin this is driven by `skills/upgrade/SKILL.md` which Claude reads
 * and follows as a Markdown instruction set. Here the same logic is encoded as
 * TypeScript so it runs inside the VS Code Chat participant.
 *
 * Spike scope:
 *   - Detects the workspace stack using migration-source-detect.cjs.
 *   - Asks the developer to confirm (or specify) the target version.
 *   - Produces a minimal Gap & Risk report stub via the judge model (Anthropic or Copilot).
 *   - Validates the Write Gate before offering to write the report to disk.
 *
 * Full implementation will add: multi-hop version path planning, tool-driven upgrade
 * execution, residual remediation, and baseline-vs-target verification.
 */
import * as vscode from 'vscode';
/**
 * Handles an `@migration upgrade` request.
 *
 * @param adoId         ADO work item ID (extracted from the user's message, or prompted).
 * @param targetVersion Target version specified by developer, or null to ask.
 * @param context       Extension context (for Write Gate and secrets).
 * @param request       VS Code Chat request.
 * @param stream        Response stream.
 * @param token         Cancellation token.
 */
export declare function handleUpgradeIntake(adoId: string, targetVersion: string | null, context: vscode.ExtensionContext, request: vscode.ChatRequest, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<void>;
