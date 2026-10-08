/**
 * upgradeHandler.ts — Upgrade skill: in-place same-stack version upgrade.
 *
 * Implements a 6-state machine:
 *   INTAKE → TARGET_VERSION_PENDING → GAP_RISK → HIGH_RISK_ACK_PENDING
 *         → WRITE_GATE → REPORT_WRITE → COMPLETE
 *
 * Story 2 delivers the full Upgrade E2E with in-memory pending state.
 * Story 5 replaces in-memory Maps with ledger.ts checkpoint JSON so state
 * survives VS Code window reloads.
 *
 * Multi-turn design:
 *   Chat turns are stateless. Pending states (TARGET_VERSION_PENDING and
 *   HIGH_RISK_ACK_PENDING) are stored in module-level Maps keyed by adoId.
 *   participant.ts calls checkAndResumePending() FIRST on every turn before
 *   routing — this is where suspended state machines are resumed.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { detectSource, formatSourceDescriptor, SourceDescriptor } from '../scriptRunner';
import { resolveRoots } from '../workspaceRoots';
import { assertGateOpen } from '../writeGate';
import { hasAnthropicKey } from '../configManager';
import { callJudge } from '../judgeGate';
import { writeCheckpoint, readCheckpoint, clearCheckpoint } from '../ledger';

// ── In-memory pending state ────────────────────────────────────────────────────
//
// DECISION: Module-level Maps for inter-turn state.
// Options considered:
//   A) vscode.workspaceState — rejected: designed for primitive values; requires
//      ExtensionContext threading through every function; complex to serialize SourceDescriptor.
//   B) Module-level Maps (chosen) — simple, zero overhead, survives multiple Chat turns in
//      the same VS Code session. Story 5 layers ledger.ts checkpoint JSON on top for
//      persistence across window reloads.
//   C) Closure variables in createParticipantHandler — rejected: breaks single responsibility;
//      the upgrade handler should own its own state.

/** Data held while waiting for the developer to supply a target version. */
interface PendingTargetVersionState {
  descriptor: SourceDescriptor;
  roots: string[];
}

/** Data held while waiting for the developer to acknowledge a HIGH-risk gate. */
interface PendingHighRiskAckState {
  descriptor: SourceDescriptor;
  targetVersion: string;
  report: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  roots: string[];
}

const pendingTargetVersionMap = new Map<string, PendingTargetVersionState>();
const pendingHighRiskAckMap   = new Map<string, PendingHighRiskAckState>();

// ── Axis classification ────────────────────────────────────────────────────────

/**
 * Determines whether a detected workspace + target version is a same-stack upgrade
 * or a cross-stack rewrite. Returns 'upgrade' when the target is in the same stack
 * family, 'rewrite' when a different stack is mentioned, and 'unknown' when the
 * primary stack could not be detected.
 *
 * AC-F3: if axis is 'rewrite', the handler must stop and redirect the developer.
 */
function classifyAxis(
  descriptor: SourceDescriptor,
  targetVersion: string
): 'upgrade' | 'rewrite' | 'unknown' {
  const primary = (descriptor.primary.token ?? '').toLowerCase();
  const target  = targetVersion.toLowerCase();

  // Explicit cross-stack signals in the target string.
  // e.g. .NET workspace targeting "Spring Boot" → rewrite.
  const crossStackSignals: Record<string, string[]> = {
    dotnet:  ['java', 'spring', 'python', 'node', 'react', 'angular', 'go', 'rust'],
    java:    ['dotnet', '.net', 'python', 'node', 'react', 'angular', 'go'],
    angular: ['react', 'vue', 'dotnet', '.net', 'java', 'python'],
    nodejs:  ['dotnet', '.net', 'java', 'spring', 'python', 'go'],
    react:   ['angular', 'vue', 'dotnet', '.net', 'java'],
    spring:  ['dotnet', '.net', 'python', 'node', 'react', 'angular'],
  };

  const signals = crossStackSignals[primary] ?? [];
  for (const signal of signals) {
    if (target.includes(signal)) { return 'rewrite'; }
  }

  // Same-stack version patterns — a version number with or without the stack name.
  const upgradePatterns: Record<string, RegExp[]> = {
    dotnet:  [/\.net\s*\d+/i, /netcoreapp\d/i, /net\s*\d+/i, /^\d+(\.\d+)*$/],
    java:    [/java\s*\d+/i, /jdk\s*\d+/i, /^\d+(\.\d+)*$/],
    angular: [/angular\s*\d+/i, /ng\s*\d+/i, /^\d+(\.\d+)*$/],
    nodejs:  [/node\s*\d+/i, /node\.js\s*\d+/i, /lts/i, /^\d+(\.\d+)*$/],
    react:   [/react\s*\d+/i, /^\d+(\.\d+)*$/],
    spring:  [/spring[\s.-]*\d+/i, /^\d+(\.\d+)*$/],
  };

  const patterns = upgradePatterns[primary];
  if (patterns) {
    for (const p of patterns) {
      if (p.test(target)) { return 'upgrade'; }
    }
    // Primary stack known but no upgrade pattern matched → likely rewrite.
    return 'rewrite';
  }

  // Primary stack unknown — allow as 'upgrade' (benefit of the doubt).
  return 'unknown';
}

// ── Risk classification ────────────────────────────────────────────────────────

/**
 * Classifies the overall risk level from a Gap & Risk report text.
 * Scans for explicit risk markers produced by the LLM; defaults to LOW if none found.
 * Case-insensitive; checks the most severe level first.
 */
function classifyRisk(report: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const upper = report.toUpperCase();
  if (
    upper.includes('RISK LEVEL: HIGH') ||
    upper.includes('RISK: HIGH') ||
    upper.includes('**HIGH') ||
    upper.includes('HIGH RISK') ||
    upper.includes('HIGH-RISK')
  ) {
    return 'HIGH';
  }
  if (
    upper.includes('RISK LEVEL: MEDIUM') ||
    upper.includes('RISK: MEDIUM') ||
    upper.includes('**MEDIUM') ||
    upper.includes('MEDIUM RISK') ||
    upper.includes('MEDIUM-RISK')
  ) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// ── LLM prompt builder ─────────────────────────────────────────────────────────

/**
 * Builds the system and user prompts used for Gap & Risk report generation.
 * The same prompt is used for both Anthropic and Copilot model calls so that
 * report structure and risk markers are consistent regardless of model.
 */
function buildGapRiskPrompts(
  descriptor: SourceDescriptor,
  targetVersion: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    'You are an expert software migration analyst. Produce a concise, decision-grade ' +
    'Gap & Risk report for the described version upgrade. Use Markdown. Always include ' +
    'a "Risk Level" line that states exactly one of: HIGH, MEDIUM, or LOW. ' +
    'Be specific about breaking changes and deprecated APIs.';

  const userPrompt =
    `## Gap & Risk Analysis — Upgrade to ${targetVersion}\n\n` +
    `**Detected workspace:**\n\n${formatSourceDescriptor(descriptor)}\n\n` +
    `## Required sections\n\n` +
    `1. **Risk Level** — HIGH / MEDIUM / LOW with one-sentence justification.\n` +
    `2. **Breaking Changes** — list all known breaking changes between current and ${targetVersion}.\n` +
    `3. **Deprecated APIs** — APIs in current stack that are removed or deprecated in ${targetVersion}.\n` +
    `4. **Estimated Effort** — T-shirt size (XS/S/M/L/XL) with rationale.\n` +
    `5. **Recommended Migration Steps** — ordered list of concrete actions.\n` +
    `6. **Top 3 Risks & Mitigations** — most likely failure modes with mitigations.\n`;

  return { systemPrompt, userPrompt };
}

// ── Target version extraction ──────────────────────────────────────────────────

/**
 * Extracts a target version string from a free-text prompt.
 *
 * Accepts patterns such as:
 *   "to .NET 10", "upgrade to Java 21", "Angular 19", "version 17", "10"
 *
 * Returns null if no version string is found.
 * Used both in INTAKE (from the original prompt) and TARGET_VERSION_PENDING resume.
 */
export function extractTargetVersionFromPrompt(prompt: string): string | null {
  // Named version with preposition: "to .NET 10", "→ Java 21", "version 17"
  const named = prompt.match(
    /(?:to|→|version|upgrade\s+to|target)\s+((?:\.net|java|angular|react|node(?:\.js)?|spring\s*boot?)\s*[\d.]+|\d+(?:\.\d+)*)/i
  );
  if (named) { return named[1].trim(); }

  // Stack + version without preposition: ".NET 10", "Java 21", "Angular 19"
  const stackVer = prompt.match(
    /\b(\.net|java|angular|react|node(?:\.js)?|spring\s*boot?)\s+(\d+(?:\.\d+)*)\b/i
  );
  if (stackVer) { return stackVer[0].trim(); }

  // Bare number as the whole (trimmed) prompt: developer replied "10" or "21"
  const bare = prompt.trim().match(/^\d+(?:\.\d+)*$/);
  if (bare) { return bare[0]; }

  return null;
}

// ── Pending state API (called by participant.ts) ───────────────────────────────

/**
 * Returns the ADO ID of any in-flight upgrade that is waiting for developer input,
 * or null if no upgrade has pending state.
 *
 * Used by participant.ts to resolve the effective ADO ID when the developer's reply
 * ("YES", a bare version, etc.) contains no explicit ADO ID in the prompt.
 * Note: only reflects in-memory state; does not scan the ledger (Maps reset on reload).
 */
export function getPendingAdoId(): string | null {
  for (const adoId of pendingHighRiskAckMap.keys()) { return adoId; }
  for (const adoId of pendingTargetVersionMap.keys()) { return adoId; }
  return null;
}

/**
 * Clears all in-memory pending state for the given ADO ID.
 *
 * Called by participant.ts when the developer explicitly invokes a skill command
 * (fresh run), ensuring that any stale pending state from a previous session
 * does not intercept the new invocation. The ledger checkpoint is cleared separately
 * by participant.ts via clearCheckpoint().
 *
 * @param adoId  ADO work item ID whose pending state should be discarded.
 */
export function clearPendingState(adoId: string): void {
  pendingHighRiskAckMap.delete(adoId);
  pendingTargetVersionMap.delete(adoId);
}

/**
 * Checks for pending upgrade state for the given ADO ID and resumes the stage machine
 * if the current prompt satisfies the pending condition.
 *
 * Called by participant.ts FIRST on every turn, before command routing.
 * Returns true when the pending state consumed this turn (caller must return immediately).
 * Returns false when no pending state exists for this adoId (normal routing continues).
 *
 * State: HIGH_RISK_ACK_PENDING
 *   - Prompt = "YES"  → clear flag, stream acknowledgment, advance to WRITE_GATE.
 *   - Prompt ≠ "YES"  → re-stream WARN reminder, stay in HIGH_RISK_ACK_PENDING. AC-F5.
 *   - Always returns true (this turn is consumed by the gate).
 *
 * State: TARGET_VERSION_PENDING
 *   - Version found  → clear flag, advance to GAP_RISK. AC-F2.
 *   - No version     → re-ask, stay in TARGET_VERSION_PENDING.
 *   - Always returns true.
 */
export async function checkAndResumePending(
  adoId: string,
  request: vscode.ChatRequest,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<boolean> {

  // ── HIGH_RISK_ACK_PENDING ──────────────────────────────────────────────────
  // Story 5: restore from ledger if the in-memory Map was cleared by a window reload.
  // This lets the developer reply "YES" even after restarting VS Code.
  if (!pendingHighRiskAckMap.has(adoId)) {
    const saved = readCheckpoint(context, adoId, 'upgrade');
    if (saved?.stage === 'HIGH_RISK_ACK_PENDING') {
      pendingHighRiskAckMap.set(adoId, saved.data as unknown as PendingHighRiskAckState);
    }
  }

  if (pendingHighRiskAckMap.has(adoId)) {
    const trimmed = request.prompt.trim().toUpperCase();
    const isYes   = trimmed === 'YES' || trimmed.startsWith('YES ');

    if (isYes) {
      const state = pendingHighRiskAckMap.get(adoId)!;
      pendingHighRiskAckMap.delete(adoId);
      // Clear the persisted checkpoint — state has resolved.
      clearCheckpoint(context, adoId);
      stream.markdown(
        `**Acknowledged** — continuing with Copilot model ` +
        `(Risk level: **${state.riskLevel}**).\n\n`
      );
      await runWriteGateAndReport(adoId, state.report, state.roots, context, stream);
    } else {
      // Non-YES reply: re-stream WARN reminder, never advance state. AC-F5.
      stream.markdown(
        `> ⚠ **HIGH-risk gate still pending for ADO-${adoId}.** ` +
        `Reply \`YES\` to continue with the Copilot model, or close this Chat to cancel.\n\n` +
        `_To use the higher-quality Anthropic model instead: set ` +
        `\`migration.anthropicApiKey\` in VS Code settings and re-run the upgrade._`
      );
    }
    return true;
  }

  // ── TARGET_VERSION_PENDING ─────────────────────────────────────────────────
  if (pendingTargetVersionMap.has(adoId)) {
    const state         = pendingTargetVersionMap.get(adoId)!;
    const targetVersion = extractTargetVersionFromPrompt(request.prompt);

    if (!targetVersion) {
      // Still missing — re-ask. AC-F2.
      stream.markdown(
        `**@migration upgrade ADO-${adoId}:** Target version still needed. ` +
        `Reply with the version you are upgrading to — for example: \`.NET 10\`, ` +
        `\`Java 21\`, or \`Angular 19\`.`
      );
    } else {
      pendingTargetVersionMap.delete(adoId);
      await runGapRiskStage(
        adoId, targetVersion, state.descriptor, state.roots, context, stream, token
      );
    }
    return true;
  }

  return false;
}

// ── Stage machine internals ────────────────────────────────────────────────────

/**
 * INTAKE stage.
 *
 * Detects the workspace stack via migration-source-detect.cjs, classifies the upgrade
 * axis, and either:
 *   (a) Asks for the target version if not in the prompt → TARGET_VERSION_PENDING. AC-F2.
 *   (b) Stops with a redirect message if the axis is a rewrite, not an upgrade. AC-F3.
 *   (c) Advances to GAP_RISK when all inputs are present.
 */
async function runIntakeStage(
  adoId: string,
  targetVersion: string | null,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  // Story 5: pass extensionUri so resolveRoots() can read pre-resolved multi-roots from
  // .claude/settings.local.json when available.
  const roots = resolveRoots(context.extensionUri); // throws if no workspace — caught by participant.ts

  stream.markdown(`## Migration: Upgrade — ADO-${adoId}\n\n_Scanning workspace..._\n\n`);

  // AC-F1: detect workspace stack via migration-source-detect.cjs (require() call).
  const descriptor = detectSource(context.extensionUri, roots);
  stream.markdown(formatSourceDescriptor(descriptor) + '\n\n');

  if (targetVersion) {
    // AC-F3: classify axis — same-stack upgrade or rewrite?
    const axis = classifyAxis(descriptor, targetVersion);
    if (axis === 'rewrite') {
      stream.markdown(
        `> ⚠ **Axis mismatch** — the target \`${targetVersion}\` is a different stack ` +
        `from the detected workspace (\`${descriptor.primary.token ?? 'unknown'}\`). ` +
        `This looks like a **rewrite** (stack translation), not an in-place upgrade. ` +
        `An upgrade report will not be generated.\n\n` +
        `To perform a rewrite: \`@migration rewrite ADO-${adoId}\``
      );
      return;
    }
  }

  // AC-F2: target version not supplied → ask, set TARGET_VERSION_PENDING, and return.
  if (!targetVersion) {
    pendingTargetVersionMap.set(adoId, { descriptor, roots });
    stream.markdown(
      `**Target version not specified.** Which version are you upgrading to?\n\n` +
      `Examples: \`.NET 10\` · \`Java 21\` · \`Angular 19\` · \`Node.js 22\`\n\n` +
      `_Reply with the target version and I will continue the upgrade analysis._`
    );
    return;
  }

  await runGapRiskStage(adoId, targetVersion, descriptor, roots, context, stream, token);
}

/**
 * GAP_RISK stage.
 *
 * Generates the Gap & Risk report using the appropriate AI model:
 *   - Anthropic (claude-opus-4-6 or configured judge model) if key present. AC-F15.
 *   - Copilot model if no Anthropic key and risk is LOW/MEDIUM. AC-F4.
 *   - WARN banner + ack pause if no Anthropic key and risk is HIGH. AC-F5/AC-F16.
 *   - Error halt if no model is available at all. AC-F17.
 */
async function runGapRiskStage(
  adoId: string,
  targetVersion: string,
  descriptor: SourceDescriptor,
  roots: string[],
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  const stackLabel = descriptor.primary.token ?? 'unknown';
  stream.markdown(`### Gap & Risk Analysis — \`${stackLabel}\` → \`${targetVersion}\`\n\n`);

  let report: string;

  // Route to Anthropic (if key set) or Copilot — callJudge centralises AC-F4/AC-F15/AC-F17.
  stream.markdown(hasAnthropicKey()
    ? '_Analysing with Anthropic judge model..._\n\n'
    : '_Analysing with Copilot model..._\n\n'
  );
  const { systemPrompt, userPrompt } = buildGapRiskPrompts(descriptor, targetVersion);
  report = await callJudge(systemPrompt, userPrompt, stream, token);

  const riskLevel = classifyRisk(report);

  // AC-F5/AC-F16: HIGH risk without Anthropic key → WARN + ack required; turn ends here.
  if (riskLevel === 'HIGH' && !hasAnthropicKey()) {
    stream.markdown(
      `\n\n---\n\n` +
      `> ⚠ **HIGH-risk gate — acknowledgment required (ADO-${adoId})**\n>\n` +
      `> Risk classification: **HIGH**. The above analysis was generated by the Copilot model. ` +
      `For HIGH-risk upgrades, the Anthropic judge model (\`claude-opus-4-6\`) provides more ` +
      `reliable breaking-change detection.\n>\n` +
      `> **To continue with the Copilot model:** reply \`YES\` in this Chat.\n` +
      `> **To use the Anthropic model:** set \`migration.anthropicApiKey\` in VS Code settings and retry.`
    );
    pendingHighRiskAckMap.set(adoId, { descriptor, targetVersion, report, riskLevel, roots });
    // Story 5: persist to ledger so HIGH_RISK_ACK_PENDING survives a window reload.
    writeCheckpoint(context, {
      adoId, skill: 'upgrade', stage: 'HIGH_RISK_ACK_PENDING',
      data: {
        descriptor: descriptor as unknown as Record<string, unknown>,
        targetVersion, report, riskLevel, roots,
      },
      updatedAt: new Date().toISOString(),
    });
    return; // Turn ends; state is HIGH_RISK_ACK_PENDING.
  }

  // LOW/MEDIUM risk, or HIGH risk with Anthropic key (judge already ran) → proceed.
  await runWriteGateAndReport(adoId, report, roots, context, stream);
}

/**
 * WRITE_GATE + REPORT_WRITE stages.
 *
 * Asserts the Write Gate is open (AC-F6), then writes the report to the workspace.
 * Report path: {workspaceRoot}/.migration/ADO-{adoId}-upgrade-gap-risk.md
 * Confirms the written path in Chat. AC-F7.
 */
async function runWriteGateAndReport(
  adoId: string,
  report: string,
  roots: string[],
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream
): Promise<void> {
  // WRITE_GATE: assertGateOpen throws WriteGateLockedError when not approved.
  // The error propagates to participant.ts which catches it and exits cleanly.
  await assertGateOpen(context, adoId, stream);

  // REPORT_WRITE: write to .migration/ in the primary workspace root.
  const workspaceRoot = roots[0];
  const outputDir  = vscode.Uri.file(path.join(workspaceRoot, '.migration'));
  const reportPath = path.join(workspaceRoot, '.migration', `ADO-${adoId}-upgrade-gap-risk.md`);
  const reportUri  = vscode.Uri.file(reportPath);

  // Create .migration/ directory if it does not already exist.
  await vscode.workspace.fs.createDirectory(outputDir);

  const content = buildReportDocument(adoId, report);
  await vscode.workspace.fs.writeFile(reportUri, Buffer.from(content, 'utf-8'));

  // COMPLETE: AC-F7 — confirm the written path in Chat.
  stream.markdown(
    `\n\n---\n\n` +
    `✅ **Report written:** \`${reportPath}\`\n\n` +
    `Open the file to review the full Gap & Risk analysis before proceeding with the upgrade.`
  );
}

/**
 * Wraps the raw LLM report in a full Markdown document with a header and generation note.
 */
function buildReportDocument(adoId: string, report: string): string {
  const date = new Date().toISOString().split('T')[0];
  return (
    `# Upgrade Gap & Risk Report — ADO-${adoId}\n` +
    `Generated: ${date} · Source: @migration upgrade\n\n` +
    `---\n\n` +
    report +
    `\n\n---\n\n` +
    `_Generated by the Migration Family VS Code extension. ` +
    `Review all breaking changes with your Tech Lead before proceeding._\n`
  );
}

// ── Public entry point ─────────────────────────────────────────────────────────

/**
 * Main entry point for the Upgrade skill.
 * Called by participant.ts when the 'upgrade' command is routed (or inferred).
 *
 * Starts the INTAKE stage. Depending on inputs and model availability, the state
 * machine may advance through all stages in a single turn, or pause at
 * TARGET_VERSION_PENDING or HIGH_RISK_ACK_PENDING awaiting developer input.
 *
 * @param adoId         ADO work item ID extracted from the Chat prompt.
 * @param targetVersion Target version string (may be null if not in the prompt).
 * @param context       VS Code extension context — Write Gate state + script URIs.
 * @param stream        Chat response stream for all output.
 * @param token         Cancellation token forwarded from the Chat request.
 */
export async function handleUpgrade(
  adoId: string,
  targetVersion: string | null,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  await runIntakeStage(adoId, targetVersion, context, stream, token);
}
