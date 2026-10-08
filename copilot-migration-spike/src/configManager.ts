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

// SecretStorage key for the ADO PAT.
const PAT_SECRET_KEY = 'migration.adoPat';

// ── Anthropic API key ────────────────────────────────────────────────────────

/**
 * Returns the Anthropic API key from VS Code settings, or undefined if not set.
 * Reads from the machine-scoped `migration.anthropicApiKey` setting.
 */
export function getAnthropicApiKey(): string | undefined {
  const key = vscode.workspace
    .getConfiguration('migration')
    .get<string>('anthropicApiKey');
  return key && key.trim() !== '' ? key.trim() : undefined;
}

/**
 * Returns the judge/critic model name from settings.
 * Default: claude-opus-4-6 (highest capability for gate decisions).
 */
export function getJudgeModel(): string {
  return (
    vscode.workspace
      .getConfiguration('migration')
      .get<string>('judgeModel') ?? 'claude-opus-4-6'
  );
}

/**
 * Returns the Copilot model family used when the Anthropic key is absent.
 * Default: gpt-4o (broadly available across Copilot subscription tiers).
 */
export function getCopilotFallbackFamily(): string {
  return (
    vscode.workspace
      .getConfiguration('migration')
      .get<string>('copilotFamilyFallback') ?? 'gpt-4o'
  );
}

/**
 * True when an Anthropic API key is configured — determines model routing mode.
 */
export function hasAnthropicKey(): boolean {
  return getAnthropicApiKey() !== undefined;
}

// ── Anthropic client ─────────────────────────────────────────────────────────

/**
 * Builds and returns an Anthropic client using the configured API key.
 * Throws if no key is set — callers should check hasAnthropicKey() first.
 */
export function buildAnthropicClient(): Anthropic {
  const key = getAnthropicApiKey();
  if (!key) {
    throw new Error(
      'Anthropic API key is not configured. ' +
      'Set `migration.anthropicApiKey` in VS Code settings or use the Copilot fallback.'
    );
  }
  return new Anthropic({ apiKey: key });
}

/**
 * Send a single-turn prompt to the Anthropic API.
 * Returns the text content of the first response block.
 *
 * @param systemPrompt  System instructions for the model.
 * @param userPrompt    User message.
 * @param maxTokens     Token budget for the response (default 4096).
 */
export async function askAnthropic(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096
): Promise<string> {
  const client = buildAnthropicClient();
  const model = getJudgeModel();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Extract the first text block from the response.
  for (const block of response.content) {
    if (block.type === 'text') {
      return block.text;
    }
  }
  throw new Error('Anthropic returned no text content in the response.');
}

// ── Azure DevOps PAT ─────────────────────────────────────────────────────────

/**
 * Stores the ADO PAT in VS Code SecretStorage (encrypted at rest).
 * Never written to disk in plaintext or to any settings file.
 */
export async function storeAdoPat(
  secrets: vscode.SecretStorage,
  pat: string
): Promise<void> {
  await secrets.store(PAT_SECRET_KEY, pat);
}

/**
 * Retrieves the ADO PAT from SecretStorage, or undefined if not set.
 */
export async function getAdoPat(
  secrets: vscode.SecretStorage
): Promise<string | undefined> {
  return secrets.get(PAT_SECRET_KEY);
}

/**
 * Removes the ADO PAT from SecretStorage.
 */
export async function clearAdoPat(
  secrets: vscode.SecretStorage
): Promise<void> {
  await secrets.delete(PAT_SECRET_KEY);
}
