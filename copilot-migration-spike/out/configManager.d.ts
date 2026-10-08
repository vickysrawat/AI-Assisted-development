/**
 * configManager.ts — Manages API keys and credentials for the migration family.
 *
 * Two credential types:
 *   1. Anthropic API key — stored in VS Code settings (machine-scoped, not committed).
 *      Used for judge-gate escalation. Falls back to the active Copilot model when absent.
 *   2. Azure DevOps PAT — stored in VS Code SecretStorage (encrypted, never in settings).
 *      Required for ADO API calls (ADO task creation, PR creation, work item updates).
 *
 * Model routing (mirrors migration-family model-routing-spec.md):
 *   - Anthropic key present  → claude-opus-4-6 for generation, configurable judge model
 *   - Anthropic key absent   → Copilot active model (fallback, single-model degraded mode)
 */
import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
/**
 * Returns the Anthropic API key from VS Code settings, or undefined if not set.
 * Reads from the machine-scoped `migration.anthropicApiKey` setting.
 */
export declare function getAnthropicApiKey(): string | undefined;
/**
 * Returns the judge/critic model name from settings.
 * Default: claude-opus-4-6 (highest capability for gate decisions).
 */
export declare function getJudgeModel(): string;
/**
 * Returns the Copilot model family used when the Anthropic key is absent.
 * Default: gpt-4o (broadly available across Copilot subscription tiers).
 */
export declare function getCopilotFallbackFamily(): string;
/**
 * True when an Anthropic API key is configured — determines model routing mode.
 */
export declare function hasAnthropicKey(): boolean;
/**
 * Builds and returns an Anthropic client using the configured API key.
 * Throws if no key is set — callers should check hasAnthropicKey() first.
 */
export declare function buildAnthropicClient(): Anthropic;
/**
 * Send a single-turn prompt to the Anthropic API.
 * Returns the text content of the first response block.
 *
 * @param systemPrompt  System instructions for the model.
 * @param userPrompt    User message.
 * @param maxTokens     Token budget for the response (default 4096).
 */
export declare function askAnthropic(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string>;
/**
 * Stores the ADO PAT in VS Code SecretStorage (encrypted at rest).
 * Never written to disk in plaintext or to any settings file.
 */
export declare function storeAdoPat(secrets: vscode.SecretStorage, pat: string): Promise<void>;
/**
 * Retrieves the ADO PAT from SecretStorage, or undefined if not set.
 */
export declare function getAdoPat(secrets: vscode.SecretStorage): Promise<string | undefined>;
/**
 * Removes the ADO PAT from SecretStorage.
 */
export declare function clearAdoPat(secrets: vscode.SecretStorage): Promise<void>;
