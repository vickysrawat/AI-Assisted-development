"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnthropicApiKey = getAnthropicApiKey;
exports.getJudgeModel = getJudgeModel;
exports.getCopilotFallbackFamily = getCopilotFallbackFamily;
exports.hasAnthropicKey = hasAnthropicKey;
exports.buildAnthropicClient = buildAnthropicClient;
exports.askAnthropic = askAnthropic;
exports.storeAdoPat = storeAdoPat;
exports.getAdoPat = getAdoPat;
exports.clearAdoPat = clearAdoPat;
const vscode = __importStar(require("vscode"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
// SecretStorage key for the ADO PAT.
const PAT_SECRET_KEY = 'migration.adoPat';
// ── Anthropic API key ────────────────────────────────────────────────────────
/**
 * Returns the Anthropic API key from VS Code settings, or undefined if not set.
 * Reads from the machine-scoped `migration.anthropicApiKey` setting.
 */
function getAnthropicApiKey() {
    const key = vscode.workspace
        .getConfiguration('migration')
        .get('anthropicApiKey');
    return key && key.trim() !== '' ? key.trim() : undefined;
}
/**
 * Returns the judge/critic model name from settings.
 * Default: claude-opus-4-6 (highest capability for gate decisions).
 */
function getJudgeModel() {
    return (vscode.workspace
        .getConfiguration('migration')
        .get('judgeModel') ?? 'claude-opus-4-6');
}
/**
 * Returns the Copilot model family used when the Anthropic key is absent.
 * Default: gpt-4o (broadly available across Copilot subscription tiers).
 */
function getCopilotFallbackFamily() {
    return (vscode.workspace
        .getConfiguration('migration')
        .get('copilotFamilyFallback') ?? 'gpt-4o');
}
/**
 * True when an Anthropic API key is configured — determines model routing mode.
 */
function hasAnthropicKey() {
    return getAnthropicApiKey() !== undefined;
}
// ── Anthropic client ─────────────────────────────────────────────────────────
/**
 * Builds and returns an Anthropic client using the configured API key.
 * Throws if no key is set — callers should check hasAnthropicKey() first.
 */
function buildAnthropicClient() {
    const key = getAnthropicApiKey();
    if (!key) {
        throw new Error('Anthropic API key is not configured. ' +
            'Set `migration.anthropicApiKey` in VS Code settings or use the Copilot fallback.');
    }
    return new sdk_1.default({ apiKey: key });
}
/**
 * Send a single-turn prompt to the Anthropic API.
 * Returns the text content of the first response block.
 *
 * @param systemPrompt  System instructions for the model.
 * @param userPrompt    User message.
 * @param maxTokens     Token budget for the response (default 4096).
 */
async function askAnthropic(systemPrompt, userPrompt, maxTokens = 4096) {
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
async function storeAdoPat(secrets, pat) {
    await secrets.store(PAT_SECRET_KEY, pat);
}
/**
 * Retrieves the ADO PAT from SecretStorage, or undefined if not set.
 */
async function getAdoPat(secrets) {
    return secrets.get(PAT_SECRET_KEY);
}
/**
 * Removes the ADO PAT from SecretStorage.
 */
async function clearAdoPat(secrets) {
    await secrets.delete(PAT_SECRET_KEY);
}
//# sourceMappingURL=configManager.js.map