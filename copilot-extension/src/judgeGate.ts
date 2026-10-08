/**
 * judgeGate.ts — Centralised LLM dispatch for the Migration Family.
 *
 * All three skill handlers (Upgrade, Rewrite, Replatform) previously duplicated
 * the same Anthropic / Copilot model selection logic. This module extracts it into
 * one place (DRY principle from project-rules.md).
 *
 * Routing rule (ICEA AC-F4 / AC-F15):
 *   - migration.anthropicApiKey set → Anthropic (claude-opus-4-6 or configured model).
 *   - No key → VS Code Language Model API (GitHub Copilot).
 *   - No Copilot model available → user-visible Error (AC-F17).
 */

import * as vscode from 'vscode';
import { hasAnthropicKey, askAnthropic, getCopilotFallbackFamily } from './configManager';

/**
 * Calls the appropriate AI model and returns the full generated text.
 * Streams output to the Chat response stream as each token arrives.
 *
 * This is the single point of model selection for the entire Migration Family.
 * Callers pass prompts and receive text; they do not need to know which model ran.
 *
 * @param systemPrompt  Describes the model's role and required output format.
 * @param userPrompt    The specific request with context and data.
 * @param stream        Chat response stream — text is streamed token by token.
 * @param token         VS Code cancellation token from the Chat request.
 * @param maxTokens     Maximum tokens to generate (default: 8192).
 * @returns             The complete generated text (same content as streamed to Chat).
 * @throws Error        If no AI model is available at all (AC-F17).
 */
export async function callJudge(
  systemPrompt: string,
  userPrompt: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  maxTokens = 8192
): Promise<string> {
  if (hasAnthropicKey()) {
    // AC-F15: Anthropic key present — use the configured judge model (claude-opus-4-6 by default).
    const text = await askAnthropic(systemPrompt, userPrompt, maxTokens);
    stream.markdown(text);
    return text;
  }

  // AC-F4: No Anthropic key — fall back to the VS Code Language Model (GitHub Copilot).
  // DECISION: selectChatModels with configured family (default: gpt-4o).
  // Configurable via migration.copilotFamilyFallback in VS Code settings.
  const family = getCopilotFallbackFamily();
  const models = await vscode.lm.selectChatModels({ family });

  if (models.length === 0) {
    // AC-F17: No model available at all — throw; participant.ts surfaces this in Chat.
    throw new Error(
      `No AI model available. Configure \`migration.anthropicApiKey\` in VS Code settings ` +
      `or ensure GitHub Copilot is active with the \`${family}\` model family.`
    );
  }

  // Combine system + user into a single user message (Copilot LM API does not accept
  // separate system messages in all model families).
  const chatResponse = await models[0].sendRequest(
    [vscode.LanguageModelChatMessage.User(`${systemPrompt}\n\n${userPrompt}`)],
    {},
    token
  );

  let text = '';
  for await (const part of chatResponse.stream) {
    if (part instanceof vscode.LanguageModelTextPart) {
      text += part.value;
      stream.markdown(part.value);
    }
  }
  return text;
}
