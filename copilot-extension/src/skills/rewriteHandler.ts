/**
 * rewriteHandler.ts — Rewrite skill: out-of-place stack translation.
 *
 * Implements a 4-state machine:
 *   INTAKE → OPTIONS → OPTIONS_ACK_PENDING → ARCHITECTURE → COMPLETE
 *
 * Worktree generation and cluster code generation are explicitly deferred to V2.
 * This handler produces two written artifacts:
 *   {workspaceRoot}/.migration/ADO-{adoId}-rewrite-options.md
 *   {workspaceRoot}/.migration/ADO-{adoId}-rewrite-arch.md
 *
 * Both writes require Write Gate approval (assertGateOpen).
 * No HIGH-risk ack gate for Rewrite — that gate is specific to in-place Upgrade risk.
 *
 * Multi-turn design follows the same module-level Map pattern as upgradeHandler.ts.
 * Story 5 replaces Maps with ledger.ts checkpoint JSON for session-persistent state.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { detectSource, formatSourceDescriptor, SourceDescriptor } from '../scriptRunner';
import { resolveRoots } from '../workspaceRoots';
import { assertGateOpen } from '../writeGate';
import { callJudge } from '../judgeGate';

// ── In-memory pending state ────────────────────────────────────────────────────

/** One parsed option extracted from the LLM-generated options document. */
interface RewriteOption {
  /** 1-based index matching the option number in the document. */
  index: number;
  /** Short title, e.g. "Rewrite to React" */
  title: string;
}

/**
 * State stored while waiting for the developer to select a migration option.
 * Set after options.md is written; cleared when a valid selection is received.
 */
interface PendingOptionsAckState {
  descriptor: SourceDescriptor;
  optionsText: string;
  parsedOptions: RewriteOption[];
  roots: string[];
}

// DECISION: Module-level Map for OPTIONS_ACK_PENDING state.
// Same rationale as upgradeHandler.ts: simple, survives multiple Chat turns in one
// VS Code session, no ExtensionContext dependency in every function.
// DECISION: No ledger persistence for OPTIONS_ACK_PENDING (unlike upgradeHandler's
// HIGH_RISK_ACK_PENDING). Rationale: losing an option selection is low-cost — the
// developer re-runs @migration rewrite and picks again in one turn. The HIGH-risk gate
// is higher-stakes (developer already acknowledged risk) so it warrants disk persistence.
// Ledger persistence for OPTIONS_ACK_PENDING is deferred to V2.
const pendingOptionsAckMap = new Map<string, PendingOptionsAckState>();

// ── Option parsing ─────────────────────────────────────────────────────────────

/**
 * Extracts structured options from the LLM-generated options document.
 * Looks for headings formatted as "### Option N: <title>" (the required LLM output format).
 * Falls back to bold-prefixed list items if no headings are found.
 * Returns an array of { index, title } objects (1-based index).
 */
function parseOptionsFromText(text: string): RewriteOption[] {
  const options: RewriteOption[] = [];

  // Primary pattern: "### Option 1: Rewrite to React" or "## Option 2 — ..."
  const headingPattern = /^#{1,4}\s+Option\s+(\d+)[:\s–-]+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(text)) !== null) {
    options.push({ index: parseInt(match[1], 10), title: match[2].trim() });
  }
  if (options.length > 0) { return options; }

  // Fallback: "**Option 1:** ..." or "1. ..." at the start of a line
  const listPattern = /^(?:\*\*Option\s+(\d+)\*\*[:\s]|(\d+)\.\s+)(.+)$/gm;
  while ((match = listPattern.exec(text)) !== null) {
    const idx   = parseInt(match[1] ?? match[2], 10);
    const title = match[3].trim();
    options.push({ index: idx, title });
  }

  return options;
}

/**
 * Parses the developer's option selection from a Chat reply.
 *
 * Accepts:
 *   "1" / "2" / "3"           — leading number (most common)
 *   "Option 1" / "option 2"   — named reference
 *   "React" / "Spring Boot"   — text match against option titles (case-insensitive)
 *
 * Returns the matching RewriteOption, or null if none matched.
 */
function parseOptionSelection(
  prompt: string,
  parsedOptions: RewriteOption[]
): RewriteOption | null {
  const trimmed = prompt.trim();

  // Leading number: "1", "2", " 3 ..."
  const leadingNum = trimmed.match(/^(\d+)/);
  if (leadingNum) {
    const found = parsedOptions.find(o => o.index === parseInt(leadingNum[1], 10));
    if (found) { return found; }
  }

  // "Option N" reference
  const optionRef = trimmed.match(/option\s+(\d+)/i);
  if (optionRef) {
    const found = parsedOptions.find(o => o.index === parseInt(optionRef[1], 10));
    if (found) { return found; }
  }

  // Text match: developer typed a stack name contained in an option title
  const lower = trimmed.toLowerCase();
  for (const opt of parsedOptions) {
    if (opt.title.toLowerCase().includes(lower) || lower.includes(opt.title.toLowerCase())) {
      return opt;
    }
  }

  return null;
}

// ── Pending state API (called by participant.ts) ───────────────────────────────

/**
 * Returns the ADO ID of any in-flight Rewrite awaiting an option selection,
 * or null if no Rewrite has pending state.
 *
 * Used by participant.ts to resolve the effective ADO ID when the developer
 * replies with a bare number ("1", "2") that contains no ADO ID.
 * Note: only reflects in-memory state; does not scan the ledger (Maps reset on reload).
 */
export function getPendingAdoId(): string | null {
  for (const adoId of pendingOptionsAckMap.keys()) { return adoId; }
  return null;
}

/**
 * Clears all in-memory pending state for the given ADO ID.
 *
 * Called by participant.ts when the developer explicitly invokes a skill command
 * (fresh run), ensuring a stale OPTIONS_ACK_PENDING Map entry cannot intercept
 * the new invocation within the same VS Code session.
 *
 * @param adoId  ADO work item ID whose pending state should be discarded.
 */
export function clearPendingState(adoId: string): void {
  pendingOptionsAckMap.delete(adoId);
}

/**
 * Checks for pending OPTIONS_ACK state for the given ADO ID and resumes the stage
 * machine when the current prompt contains a valid option selection.
 *
 * Called by participant.ts on every turn after upgradeHandler.checkAndResumePending.
 * Returns true when this turn was consumed (caller must return immediately).
 * Returns false when no pending Rewrite state exists for this adoId.
 *
 * State: OPTIONS_ACK_PENDING
 *   - Valid selection parsed → clear state, advance to ARCHITECTURE. AC-F10.
 *   - No valid selection    → re-list options and wait.
 *   - Always returns true (this turn is consumed by the gate).
 */
export async function checkAndResumePending(
  adoId: string,
  request: vscode.ChatRequest,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<boolean> {
  if (!pendingOptionsAckMap.has(adoId)) { return false; }

  const state     = pendingOptionsAckMap.get(adoId)!;
  const selection = parseOptionSelection(request.prompt, state.parsedOptions);

  if (!selection) {
    // Could not parse — re-list options and wait.
    const optionList = state.parsedOptions
      .map(o => `**${o.index}.** ${o.title}`)
      .join('\n');

    stream.markdown(
      `**@migration rewrite ADO-${adoId}:** Could not identify your selection. ` +
      `Reply with the option number.\n\n` +
      (optionList || '_Re-run \`@migration rewrite\` to regenerate options._')
    );
    return true;
  }

  // Valid selection — advance to ARCHITECTURE.
  pendingOptionsAckMap.delete(adoId);
  stream.markdown(
    `**Selected: Option ${selection.index} — ${selection.title}**\n\n` +
    `_Generating architecture document..._\n\n`
  );

  await runArchitectureStage(
    adoId, selection, state.descriptor, state.roots, context, stream, token
  );
  return true;
}

// ── Stage machine internals ────────────────────────────────────────────────────

/**
 * INTAKE + OPTIONS stages (run in the same turn when the Write Gate is open).
 *
 * Detects workspace stack (AC-F8), generates 3+ migration options with
 * pros/cons (AC-F8), gates options.md write with V2 deferral note (AC-F9),
 * writes options.md, and sets OPTIONS_ACK_PENDING awaiting selection (AC-F10).
 */
async function runIntakeAndOptions(
  adoId: string,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  // Story 5: pass extensionUri so resolveRoots() can use pre-resolved multi-roots.
  const roots = resolveRoots(context.extensionUri); // throws if no workspace — caught by participant.ts

  stream.markdown(`## Migration: Rewrite — ADO-${adoId}\n\n_Scanning workspace..._\n\n`);

  // AC-F8: detect stack.
  const descriptor = detectSource(context.extensionUri, roots);
  stream.markdown(formatSourceDescriptor(descriptor) + '\n\n');

  const stackLabel = descriptor.primary.token ?? 'unknown';
  stream.markdown(`### Migration Options — \`${stackLabel}\`\n\n_Generating options..._\n\n`);

  // AC-F8: generate 3+ migration options with pros/cons, assurance, effort, TCO.
  const optionsSystemPrompt =
    'You are an expert software migration architect. Given a detected workspace, ' +
    'generate 3 to 5 migration rewrite options. Format each option exactly as:\n\n' +
    '### Option N: <Target Stack Name>\n' +
    '**Assurance:** High | Medium | Low\n' +
    '**Effort:** XS | S | M | L | XL\n' +
    '**TCO Impact:** <one sentence>\n' +
    '**Pros:**\n- <point>\n' +
    '**Cons:**\n- <point>\n\n' +
    'Always number options sequentially starting from 1. ' +
    'End with a brief recommendation paragraph.';

  const optionsUserPrompt =
    `## Rewrite Options Request\n\n` +
    `**Source workspace:**\n\n${formatSourceDescriptor(descriptor)}\n\n` +
    `Generate 3–5 migration target options appropriate for this stack. ` +
    `Consider modern, well-supported target stacks with active ecosystems. ` +
    `Include realistic effort and TCO estimates. ` +
    `Each option must be independently viable as a full rewrite target.`;

  const optionsText = await callJudge(optionsSystemPrompt, optionsUserPrompt, stream, token);

  // AC-F9: gate verbiage must explicitly note worktree/cluster generation is deferred to V2.
  stream.markdown(
    `\n\n---\n\n` +
    `> ⚠ **V2 scope note:** Worktree generation and cluster code generation are ` +
    `out of scope for Sprint 13 and deferred to V2. This options document covers ` +
    `analysis only — no code will be generated automatically.\n\n`
  );

  // AC-F9: Write Gate required before writing options.md.
  await assertGateOpen(context, adoId, stream);

  const workspaceRoot = roots[0];
  const outputDir     = vscode.Uri.file(path.join(workspaceRoot, '.migration'));
  const optionsPath   = path.join(workspaceRoot, '.migration', `ADO-${adoId}-rewrite-options.md`);

  await vscode.workspace.fs.createDirectory(outputDir);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(optionsPath),
    Buffer.from(buildOptionsDocument(adoId, descriptor, optionsText), 'utf-8')
  );

  // AC-F10: set OPTIONS_ACK_PENDING — architecture stage runs in the next Chat turn.
  const parsedOptions = parseOptionsFromText(optionsText);
  pendingOptionsAckMap.set(adoId, { descriptor, optionsText, parsedOptions, roots });

  const optionList = parsedOptions.length > 0
    ? parsedOptions.map(o => `**${o.index}.** ${o.title}`).join('\n')
    : '_(reply with the option number shown above)_';

  stream.markdown(
    `✅ **Options written:** \`${optionsPath}\`\n\n` +
    `---\n\n` +
    `**Select a migration option** by replying with its number:\n\n${optionList}`
  );
}

/**
 * ARCHITECTURE stage.
 *
 * Generates the architecture document for the developer-selected option (AC-F10),
 * gates the arch.md write (AC-F11), and writes the file. Streams COMPLETE confirmation.
 */
async function runArchitectureStage(
  adoId: string,
  selection: RewriteOption,
  descriptor: SourceDescriptor,
  roots: string[],
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  const stackLabel = descriptor.primary.token ?? 'unknown';

  stream.markdown(
    `### Architecture Plan — ${selection.title}\n\n` +
    `_Generating architecture for \`${stackLabel}\` → \`${selection.title}\`..._\n\n`
  );

  const archSystemPrompt =
    'You are an expert software architect specialising in migration projects. ' +
    'Generate a detailed, actionable architecture document for the described rewrite. ' +
    'Use Markdown with clear section headings. Be specific and practical. ' +
    'Always include an explicit note that worktree generation and cluster code ' +
    'generation are deferred to V2.';

  const archUserPrompt =
    `## Architecture Document Request\n\n` +
    `**Rewrite:** \`${stackLabel}\` → \`${selection.title}\`\n\n` +
    `**Source workspace:**\n\n${formatSourceDescriptor(descriptor)}\n\n` +
    `## Required sections\n\n` +
    `1. **Target Architecture Overview** — describe the target system structure.\n` +
    `2. **Key Design Decisions** — 3–5 major architectural choices with rationale.\n` +
    `3. **Migration Phases** — 4–6 phases, each with objectives and deliverables.\n` +
    `4. **Risk Register** — top 5 risks with probability, impact, and mitigation.\n` +
    `5. **Technology Stack** — complete list of target technologies and versions.\n` +
    `6. **V2 Scope** — explicitly state that worktree generation and cluster code ` +
    `generation are deferred to V2; this document covers planning only.\n`;

  // AC-F10: generate arch doc for selected option.
  const archText = await callJudge(archSystemPrompt, archUserPrompt, stream, token, 12288);

  // AC-F11: Write Gate required before writing arch.md.
  await assertGateOpen(context, adoId, stream);

  const workspaceRoot = roots[0];
  const outputDir     = vscode.Uri.file(path.join(workspaceRoot, '.migration'));
  const archPath      = path.join(workspaceRoot, '.migration', `ADO-${adoId}-rewrite-arch.md`);

  await vscode.workspace.fs.createDirectory(outputDir);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(archPath),
    Buffer.from(buildArchDocument(adoId, descriptor, selection, archText), 'utf-8')
  );

  // COMPLETE.
  stream.markdown(
    `\n\n---\n\n` +
    `✅ **Architecture document written:** \`${archPath}\`\n\n` +
    `Review the plan with your Tech Lead before beginning implementation. ` +
    `Worktree generation and cluster code generation are deferred to V2.`
  );
}

// ── Document builders ──────────────────────────────────────────────────────────

/** Wraps the LLM options text in a full Markdown document with header and V2 note. */
function buildOptionsDocument(
  adoId: string,
  descriptor: SourceDescriptor,
  optionsText: string
): string {
  const date       = new Date().toISOString().split('T')[0];
  const stackLabel = descriptor.primary.token ?? 'unknown';
  return (
    `# Rewrite Migration Options — ADO-${adoId}\n` +
    `Generated: ${date} · Source: @migration rewrite\n` +
    `Source stack: \`${stackLabel}\`\n\n` +
    `---\n\n` +
    optionsText +
    `\n\n---\n\n` +
    `> ⚠ **V2 scope:** Worktree generation and cluster code generation are deferred to V2. ` +
    `This document covers options analysis only.\n\n` +
    `_Generated by the Migration Family VS Code extension. Review with your Tech Lead._\n`
  );
}

/** Wraps the LLM architecture text in a full Markdown document with header and V2 note. */
function buildArchDocument(
  adoId: string,
  descriptor: SourceDescriptor,
  selection: RewriteOption,
  archText: string
): string {
  const date       = new Date().toISOString().split('T')[0];
  const stackLabel = descriptor.primary.token ?? 'unknown';
  return (
    `# Rewrite Architecture — ADO-${adoId}\n` +
    `Generated: ${date} · Source: @migration rewrite\n` +
    `Migration: \`${stackLabel}\` → \`${selection.title}\`\n\n` +
    `---\n\n` +
    archText +
    `\n\n---\n\n` +
    `> ⚠ **V2 scope:** Worktree generation and cluster code generation are deferred to V2. ` +
    `This document covers architecture planning only.\n\n` +
    `_Generated by the Migration Family VS Code extension. Review with your Tech Lead._\n`
  );
}

// ── Public entry point ─────────────────────────────────────────────────────────

/**
 * Main entry point for the Rewrite skill.
 * Called by participant.ts when the 'rewrite' command is routed.
 *
 * Runs INTAKE + OPTIONS in a single turn (if the Write Gate is already open).
 * If the gate is locked, WriteGateLockedError propagates to participant.ts which
 * catches it and exits cleanly — no partial output is written.
 *
 * After options.md is written, the state machine pauses at OPTIONS_ACK_PENDING.
 * The developer's next Chat reply routes through checkAndResumePending to
 * the ARCHITECTURE stage.
 *
 * @param adoId   ADO work item ID extracted from the Chat prompt.
 * @param context VS Code extension context — Write Gate state + script URIs.
 * @param stream  Chat response stream for all output.
 * @param token   Cancellation token forwarded from the Chat request.
 */
export async function handleRewrite(
  adoId: string,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  await runIntakeAndOptions(adoId, context, stream, token);
}
