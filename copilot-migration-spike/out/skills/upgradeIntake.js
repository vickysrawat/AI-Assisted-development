"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpgradeIntake = handleUpgradeIntake;
const vscode = __importStar(require("vscode"));
const scriptRunner_1 = require("../scriptRunner");
const writeGate_1 = require("../writeGate");
const configManager_1 = require("../configManager");
// ── Public entry point ───────────────────────────────────────────────────────
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
async function handleUpgradeIntake(adoId, targetVersion, context, request, stream, token) {
    // Step 1 — Resolve workspace roots.
    const workspaceRoots = resolveWorkspaceRoots();
    if (workspaceRoots.length === 0) {
        stream.markdown('**No workspace folder is open.** Open the project folder in VS Code first.');
        return;
    }
    // Step 2 — Detect source stack (script invocation — no Write Gate needed).
    // Always show the scanned paths so workspace misconfiguration is immediately obvious.
    stream.markdown(`**Scanning:** \`${workspaceRoots.join('`, `')}\`\n\n`);
    stream.progress('Detecting source stack...');
    let descriptor;
    try {
        // detectSource is now synchronous (uses require() internally, no subprocess).
        descriptor = (0, scriptRunner_1.detectSource)(context.extensionUri, workspaceRoots);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stream.markdown(`**Stack detection failed:** ${msg}`);
        return;
    }
    if (!descriptor.primary.token) {
        stream.markdown('**No supported stack detected** in the scanned path(s) above.\n\n' +
            'Supported stacks: `.NET`, `Java/Spring Boot`, `Node.js`, `Angular`, `React`, `Python`.\n\n' +
            '**If the path above is wrong:** open your project folder in VS Code ' +
            '(`File → Open Folder`) before running `@migration upgrade`.');
        return;
    }
    // Stream detection results.
    stream.markdown((0, scriptRunner_1.formatSourceDescriptor)(descriptor));
    // Step 3 — Classify migration axis.
    if (token.isCancellationRequested) {
        return;
    }
    const axis = classifyAxis(descriptor, targetVersion);
    if (axis.type === 'rewrite') {
        stream.markdown('\n\n> **This is not an upgrade — it is a stack translation.**\n' +
            `> Moving from \`${descriptor.primary.token}\` to \`${axis.targetStack}\` ` +
            `requires a **Rewrite**, not an Upgrade.\n\n` +
            'Use `@migration rewrite` instead.');
        return;
    }
    if (axis.type === 'unknown') {
        stream.markdown('\n\nCould not determine the target version. ' +
            `Please specify it in your next message, e.g.:\n\n` +
            `> \`@migration upgrade ADO-${adoId} to version 8\``);
        return;
    }
    stream.markdown(`\n\n**Migration axis confirmed:** in-place upgrade of \`${descriptor.primary.token}\` ` +
        `from \`${descriptor.primary.version ?? 'current'}\` → \`${axis.targetVersion}\`.\n`);
    // Step 4 — Produce Gap & Risk report stub via judge model.
    if (token.isCancellationRequested) {
        return;
    }
    stream.progress('Generating Gap & Risk report...');
    let reportContent;
    try {
        reportContent = await generateGapRiskReport(descriptor, axis.targetVersion, request, token);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stream.markdown(`**Gap & Risk report generation failed:** ${msg}`);
        return;
    }
    stream.markdown('\n\n---\n\n');
    stream.markdown(reportContent);
    // Step 5 — Offer to write the report to disk (Write Gate check).
    stream.markdown('\n\n---\n\n' +
        `To write this report to \`docs/migrations/${adoId}/${adoId}-gap-risk.md\`, ` +
        `the Write Gate must be open for ADO-${adoId}.\n`);
    try {
        await (0, writeGate_1.assertGateOpen)(context, adoId, stream);
    }
    catch (err) {
        if (err instanceof writeGate_1.WriteGateLockedError) {
            // Gate is locked — message and button already streamed by assertGateOpen.
            // Re-send this request after approving to proceed with the write.
            return;
        }
        throw err;
    }
    // Gate is open — write the report.
    stream.progress('Writing Gap & Risk report to disk...');
    try {
        await writeReport(adoId, reportContent);
        stream.markdown(`\nReport written to \`docs/migrations/${adoId}/${adoId}-gap-risk.md\`.`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stream.markdown(`**Write failed:** ${msg}`);
    }
}
// ── Helpers ──────────────────────────────────────────────────────────────────
/** Returns workspace root paths. Uses all open workspace folders. */
function resolveWorkspaceRoots() {
    return (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
}
/**
 * Determines whether the requested migration is an in-place upgrade or a stack
 * translation (which should go to the Rewrite skill).
 *
 * Spike heuristic: if targetVersion contains a different stack token (e.g. "python"),
 * classify as rewrite. Otherwise, attempt to infer from the request.
 */
function classifyAxis(descriptor, targetVersion) {
    if (!targetVersion) {
        return { type: 'unknown' };
    }
    const knownStacks = ['dotnet', 'java', 'spring', 'python', 'angular', 'react', 'nodejs', 'node'];
    const targetLower = targetVersion.toLowerCase();
    // If the target mentions a DIFFERENT stack keyword, route to Rewrite.
    for (const stack of knownStacks) {
        if (targetLower.includes(stack) &&
            !descriptor.primary.token?.includes(stack)) {
            return { type: 'rewrite', targetStack: stack };
        }
    }
    return { type: 'upgrade', targetVersion };
}
/**
 * Generates a Gap & Risk report stub using the configured judge model
 * (Anthropic SDK if key present, Copilot language model API as fallback).
 */
async function generateGapRiskReport(descriptor, targetVersion, request, token) {
    const systemPrompt = buildGapRiskSystemPrompt();
    const userPrompt = buildGapRiskUserPrompt(descriptor, targetVersion);
    if ((0, configManager_1.hasAnthropicKey)()) {
        // Use Anthropic SDK for the judge-quality analysis.
        return (0, configManager_1.askAnthropic)(systemPrompt, userPrompt, 4096);
    }
    // Fallback: use the Copilot language model API.
    return askCopilotModel(descriptor, targetVersion, systemPrompt, userPrompt, request, token);
}
/**
 * Sends a prompt to the active Copilot language model.
 * This is the degraded single-model path used when no Anthropic key is configured.
 * Falls back to a static stub report if no Copilot model is available (spike env without subscription).
 */
async function askCopilotModel(descriptor, targetVersion, systemPrompt, userPrompt, request, token) {
    const family = (0, configManager_1.getCopilotFallbackFamily)();
    const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family });
    if (!model) {
        // Spike fallback: no AI model available — produce a static stub report.
        // This lets the full end-to-end flow (detect → classify → report → write gate → write)
        // be validated without a Copilot subscription or Anthropic key.
        return buildStaticStubReport(descriptor, targetVersion);
    }
    const messages = [
        vscode.LanguageModelChatMessage.User(`${systemPrompt}\n\n${userPrompt}`),
    ];
    const response = await model.sendRequest(messages, {}, token);
    // Accumulate streamed text fragments.
    let result = '';
    for await (const part of response.text) {
        result += part;
    }
    return result;
}
// ── Static stub report (no-model fallback for spike validation) ──────────────
/**
 * Produces a static Gap & Risk report stub when no AI model is available.
 * Used in the spike to validate the full write-gate → write-file flow without
 * requiring a Copilot subscription or Anthropic API key.
 *
 * In Phase 3 this path is removed — a real model is always required for gate-quality analysis.
 */
function buildStaticStubReport(descriptor, targetVersion) {
    const from = descriptor.primary.version ?? 'current';
    const stack = descriptor.primary.token ?? 'unknown';
    const projects = descriptor.stacks.map(s => `- \`${s.projectPath ?? s.token}\` (${s.role ?? 'lib'})`).join('\n');
    return [
        `# Gap & Risk Report — ${stack} ${from} → ${targetVersion}`,
        '',
        '> **SPIKE STUB** — Generated without an AI model (no Copilot subscription or Anthropic key detected).',
        '> In production this report is produced by the judge model. Sections marked STUB require manual completion.',
        '',
        `## Projects detected (${descriptor.stacks.length})`,
        '',
        projects,
        '',
        '## 1. Breaking changes',
        '',
        '| Change | Risk | Notes |',
        '|---|---|---|',
        `| STUB — requires analysis of ${stack} ${from} → ${targetVersion} release notes | HIGH | Populate in Phase 3 |`,
        '',
        '## 2. Deprecated APIs',
        '',
        '| API | Removed in | Replacement |',
        '|---|---|---|',
        '| STUB — codebase scan required | — | — |',
        '',
        '## 3. Dependency risks',
        '',
        '| Package | Current | Status in target |',
        '|---|---|---|',
        '| STUB — NuGet/npm audit required | — | — |',
        '',
        '## 4. Operational risks',
        '',
        '- STUB: Runtime / hosting compatibility with target version',
        '- STUB: CI/CD pipeline toolchain version requirements',
        '- STUB: Docker base image update (if containerised)',
        '',
        '## 5. Unknowns (require codebase inspection)',
        '',
        `- Does this repo use any APIs removed in ${targetVersion}? (HIGH — code scan needed)`,
        `- Are there any pinned package versions incompatible with ${targetVersion}? (MEDIUM)`,
        `- Does the test suite pass under ${targetVersion}? (HIGH — must run before approving upgrade)`,
        '',
        '---',
        `_Report generated by @migration upgrade spike · ${new Date().toISOString().slice(0, 10)}_`,
    ].join('\n');
}
// ── Prompt builders ──────────────────────────────────────────────────────────
function buildGapRiskSystemPrompt() {
    return [
        'You are a senior software engineer conducting a migration gap and risk analysis.',
        'Your job is to produce a structured Gap & Risk report for an in-place version upgrade.',
        'Be concise. Use Markdown tables and bullet lists. Focus on breaking changes,',
        'deprecated APIs, and operational risks. Do not invent facts — mark unknowns explicitly.',
        'This is a STUB report for a spike — flag sections that need full codebase analysis.',
    ].join(' ');
}
function buildGapRiskUserPrompt(descriptor, targetVersion) {
    const stackInfo = descriptor.stacks
        .map(s => `${s.token}${s.version ? `@${s.version}` : ''}`)
        .join(', ');
    return [
        `## Source stack`,
        `- Primary: ${descriptor.primary.token ?? 'unknown'} ${descriptor.primary.version ?? ''}`,
        `- All detected: ${stackInfo || 'none'}`,
        `- Source files: ${descriptor.sizeEstimate.files}`,
        `- Data layer: ${descriptor.dataLayer.join(', ') || 'none detected'}`,
        `- Auth: ${descriptor.auth.join(', ') || 'not detected'}`,
        '',
        `## Target version`,
        targetVersion,
        '',
        `## Task`,
        'Produce a Gap & Risk report with these sections:',
        '1. **Breaking changes** — known breaking changes between the source and target version.',
        '2. **Deprecated APIs** — APIs removed or deprecated in the target version.',
        '3. **Dependency risks** — transitive dependencies likely to need updates.',
        '4. **Operational risks** — runtime, deployment, or infrastructure concerns.',
        '5. **Unknowns** — items that require codebase inspection to assess (label STUB).',
        '',
        'Mark each item with a risk level: HIGH / MEDIUM / LOW.',
    ].join('\n');
}
// ── File write ───────────────────────────────────────────────────────────────
/**
 * Writes the Gap & Risk report to `docs/migrations/<adoId>/<adoId>-gap-risk.md`
 * in the workspace root. Gate must be open before calling this.
 */
async function writeReport(adoId, content) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) {
        throw new Error('No workspace folder open — cannot write report.');
    }
    const reportDir = vscode.Uri.joinPath(workspaceRoot, 'docs', 'migrations', adoId);
    const reportPath = vscode.Uri.joinPath(reportDir, `${adoId}-gap-risk.md`);
    // Ensure the directory exists.
    await vscode.workspace.fs.createDirectory(reportDir);
    // Write the file (UTF-8 encoded as Uint8Array).
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(reportPath, encoder.encode(content));
}
//# sourceMappingURL=upgradeIntake.js.map