/**
 * replatformHandler.ts — Replatform skill: hosting/topology migration (on-prem → cloud).
 *
 * Single-turn state machine (no multi-turn acks — no blocking gates between stages):
 *   INTAKE → 6R_CLASSIFY → NFR_SPEC → IaC_AUTHORING → WRITE_GATE → WRITE → COMPLETE
 *
 * Design rule from ICEA: "LLM authors IaC + human-executable runbooks; human executes;
 * LLM never touches real infrastructure."
 *
 * IaC format:
 *   - Default: Azure Bicep (Azure-first context per tech spec decision).
 *   - Terraform: when "terraform" appears in the original @migration replatform prompt.
 *   This avoids a blocking question when the default is unambiguous.
 *
 * Written artifacts (all under .migration/ADO-{adoId}-replatform/):
 *   Bicep:     main.bicep · runbook.md
 *   Terraform: main.tf · variables.tf · runbook.md
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { detectSource, formatSourceDescriptor, SourceDescriptor } from '../scriptRunner';
import { resolveRoots } from '../workspaceRoots';
import { assertGateOpen } from '../writeGate';
import { callJudge } from '../judgeGate';

// ── Types ──────────────────────────────────────────────────────────────────────

/** The six Rs of cloud migration. */
type SixR = 'Rehost' | 'Replatform' | 'Repurchase' | 'Refactor' | 'Retire' | 'Retain';

/** IaC format — Bicep (default) or Terraform. */
type IaCFormat = 'bicep' | 'terraform';

/** Structured output from the 6R classification stage. */
interface SixRResult {
  recommended: SixR;
  rawText: string;
}

/** Structured output from the NFR specification stage. */
interface NfrResult {
  rawText: string;
}

// ── IaC format detection ───────────────────────────────────────────────────────

/**
 * Detects the requested IaC format from the original @migration replatform prompt.
 *
 * DECISION: Default to Bicep; switch to Terraform only if "terraform" is explicit.
 * Options considered:
 *   A) Ask the developer in a follow-up Chat turn — rejected: adds a blocking round-trip
 *      when the default (Bicep for Azure-first teams) is clear and reversible.
 *   B) Detect from prompt keyword (chosen) — simple, immediate, no extra turn needed.
 *   C) Read from VS Code settings — rejected: overkill for a per-migration choice.
 */
function detectIaCFormat(prompt: string): IaCFormat {
  return prompt.toLowerCase().includes('terraform') ? 'terraform' : 'bicep';
}

// ── 6R classification ──────────────────────────────────────────────────────────

/**
 * Parses the recommended 6R value from the LLM-generated classification text.
 * Returns the first recognised 6R noun found; defaults to 'Replatform' if none detected.
 */
function parseSixR(text: string): SixR {
  const sixRs: SixR[] = ['Rehost', 'Replatform', 'Repurchase', 'Refactor', 'Retire', 'Retain'];
  const upper = text.toUpperCase();
  for (const r of sixRs) {
    if (upper.includes(r.toUpperCase())) { return r; }
  }
  return 'Replatform'; // sensible default for most on-prem → cloud migrations
}

// ── Stage machine stages ───────────────────────────────────────────────────────

/**
 * 6R_CLASSIFY stage.
 *
 * Generates and streams a 6R posture assessment (AC-F12).
 * The classification drives NFR scope and IaC choices in subsequent stages.
 */
async function runSixRClassify(
  descriptor: SourceDescriptor,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<SixRResult> {
  stream.markdown(`### 6R Posture Assessment\n\n_Classifying migration posture..._\n\n`);

  const systemPrompt =
    'You are a cloud migration architect. Classify an application\'s migration posture ' +
    'using the 6R framework (Rehost · Replatform · Repurchase · Refactor · Retire · Retain). ' +
    'Always start with "**Recommended: <6R>**" on the first line, followed by a 2–3 sentence ' +
    'rationale. Then list pros and cons. Include a brief note on the next-best alternative 6R.';

  const userPrompt =
    `## 6R Classification Request\n\n` +
    `**Detected workspace:**\n\n${formatSourceDescriptor(descriptor)}\n\n` +
    `Classify this application for on-premises → Azure cloud migration. ` +
    `Consider: application architecture, data layer, integrations, and typical migration ` +
    `risk for this stack.`;

  const rawText = await callJudge(systemPrompt, userPrompt, stream, token);
  const recommended = parseSixR(rawText);

  return { recommended, rawText };
}

/**
 * NFR_SPEC stage.
 *
 * Generates and streams the NFR specification based on the 6R result (AC-F13).
 * Covers availability target, RTO, RPO, DR strategy, scalability, and security.
 * Streamed to Chat BEFORE IaC authoring, as required by the ICEA.
 */
async function runNfrSpec(
  descriptor: SourceDescriptor,
  sixR: SixRResult,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<NfrResult> {
  stream.markdown(`\n\n### NFR Specification\n\n_Generating non-functional requirements..._\n\n`);

  const systemPrompt =
    'You are a cloud infrastructure architect. Generate a concise NFR specification ' +
    'for the described migration. Use a Markdown table for quantitative targets. ' +
    'Be specific with realistic numbers — not open-ended ranges.';

  const userPrompt =
    `## NFR Specification Request\n\n` +
    `**6R Posture:** ${sixR.recommended}\n\n` +
    `**Source workspace:**\n\n${formatSourceDescriptor(descriptor)}\n\n` +
    `## Required sections\n\n` +
    `1. **Availability Table** — target SLA (e.g. 99.9%), monthly downtime budget.\n` +
    `2. **RTO** — Recovery Time Objective (how fast the system must recover after failure).\n` +
    `3. **RPO** — Recovery Point Objective (maximum acceptable data loss window).\n` +
    `4. **DR Strategy** — active-passive / active-active / backup-restore + Azure region pair.\n` +
    `5. **Scalability** — expected load, autoscale triggers, peak capacity targets.\n` +
    `6. **Security Baseline** — authentication, network isolation, encryption at rest and in transit.\n`;

  const rawText = await callJudge(systemPrompt, userPrompt, stream, token);
  return { rawText };
}

/**
 * IaC_AUTHORING stage.
 *
 * Generates IaC (Bicep or Terraform) and a human-executable deployment runbook.
 *
 * DESIGN RULE: The LLM authors the IaC; the human executes it.
 * No CLI commands are ever run by the extension against real infrastructure.
 */
async function runIaCAuthoring(
  descriptor: SourceDescriptor,
  sixR: SixRResult,
  nfr: NfrResult,
  iacFormat: IaCFormat,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<{ iacText: string; runbookText: string }> {
  const formatLabel = iacFormat === 'bicep' ? 'Azure Bicep' : 'Terraform (Azure provider)';
  const stackLabel  = descriptor.primary.token ?? 'unknown';

  stream.markdown(`\n\n### IaC Authoring — ${formatLabel}\n\n_Generating IaC files..._\n\n`);

  // IaC generation
  const iacSystemPrompt =
    `You are an expert ${formatLabel} engineer. Generate production-quality IaC for the ` +
    `described migration. Include inline comments explaining each resource. Target: Azure cloud. ` +
    (iacFormat === 'terraform'
      ? 'Reference variables via var.* — define no variable blocks here (they go in variables.tf).'
      : 'Use parameters for environment-specific values. Use modules where appropriate.');

  const iacUserPrompt =
    `## IaC Generation Request\n\n` +
    `**Stack:** ${stackLabel} · **6R:** ${sixR.recommended}\n\n` +
    `**NFR Specification:**\n${nfr.rawText}\n\n` +
    `Generate ${formatLabel} IaC to host this application on Azure. ` +
    `Include compute (App Service / AKS / Container Apps appropriate for the stack), ` +
    `networking (VNet, subnets, NSG), storage, database (if data layer detected), ` +
    `and monitoring (Application Insights + Log Analytics Workspace).`;

  const iacText = await callJudge(iacSystemPrompt, iacUserPrompt, stream, token, 12288);

  // Runbook generation
  stream.markdown(`\n\n_Generating deployment runbook..._\n\n`);

  const runbookSystemPrompt =
    'You are a DevOps engineer. Generate a concise human-executable deployment runbook ' +
    'in Markdown. Use numbered steps. Include prerequisite checks, deployment order, ' +
    'rollback procedure, and post-deployment smoke tests. Never include actual credentials — ' +
    'reference Azure Key Vault or environment variables instead.';

  const runbookUserPrompt =
    `## Runbook Generation Request\n\n` +
    `**Stack:** ${stackLabel} → Azure · **6R:** ${sixR.recommended} · **IaC:** ${formatLabel}\n\n` +
    `Generate a step-by-step runbook for deploying the generated IaC. ` +
    `Include prerequisites, deployment order, rollback procedure, and smoke tests.`;

  const runbookText = await callJudge(runbookSystemPrompt, runbookUserPrompt, stream, token, 4096);

  return { iacText, runbookText };
}

// ── File builders ──────────────────────────────────────────────────────────────

/**
 * Returns all IaC files to write, each as { relativePath, content }.
 * Relative paths are under .migration/ (the base output directory).
 */
function buildIaCFiles(
  adoId: string,
  iacFormat: IaCFormat,
  iacText: string,
  runbookText: string,
  descriptor: SourceDescriptor,
  sixR: SixRResult
): Array<{ relativePath: string; content: string }> {
  const date       = new Date().toISOString().split('T')[0];
  const stackLabel = descriptor.primary.token ?? 'unknown';
  const dir        = `ADO-${adoId}-replatform`;

  const runbookDoc =
    `# Deployment Runbook — ADO-${adoId}\n` +
    `Generated: ${date} · Source: @migration replatform\n` +
    `Stack: ${stackLabel} · 6R: ${sixR.recommended}\n\n` +
    `> ⚠ **Human-executed:** This runbook must be reviewed and executed by a human. ` +
    `The extension authors IaC only — it never connects to or modifies real infrastructure.\n\n` +
    `---\n\n` +
    runbookText +
    `\n\n---\n\n` +
    `_Generated by the Migration Family VS Code extension. Review with your Tech Lead._\n`;

  if (iacFormat === 'bicep') {
    const bicepHeader =
      `// Replatform IaC — ADO-${adoId}\n` +
      `// Generated: ${date} · Source: @migration replatform\n` +
      `// Stack: ${stackLabel} · 6R: ${sixR.recommended}\n` +
      `// HUMAN-EXECUTED: review with Tech Lead before deploying.\n\n`;

    return [
      { relativePath: `${dir}/main.bicep`, content: bicepHeader + iacText },
      { relativePath: `${dir}/runbook.md`, content: runbookDoc },
    ];
  }

  // Terraform
  const tfHeader =
    `# Replatform IaC — ADO-${adoId}\n` +
    `# Generated: ${date} · Source: @migration replatform\n` +
    `# Stack: ${stackLabel} · 6R: ${sixR.recommended}\n` +
    `# HUMAN-EXECUTED: review with Tech Lead before running terraform apply.\n\n`;

  const variablesContent =
    `# variables.tf — ADO-${adoId} replatform\n` +
    `# Generated: ${date} · Define values in terraform.tfvars (gitignored).\n\n` +
    `variable "environment" {\n` +
    `  type        = string\n` +
    `  description = "Deployment environment (dev / staging / prod)"\n` +
    `}\n\n` +
    `variable "location" {\n` +
    `  type        = string\n` +
    `  default     = "australiaeast"\n` +
    `  description = "Azure region for all resources"\n` +
    `}\n\n` +
    `variable "project_name" {\n` +
    `  type        = string\n` +
    `  description = "Project name used as resource name prefix"\n` +
    `}\n`;

  return [
    { relativePath: `${dir}/main.tf`,      content: tfHeader + iacText },
    { relativePath: `${dir}/variables.tf`, content: variablesContent },
    { relativePath: `${dir}/runbook.md`,   content: runbookDoc },
  ];
}

// ── Public entry point ─────────────────────────────────────────────────────────

/**
 * Main entry point for the Replatform skill.
 * Called by participant.ts when the 'replatform' command is routed.
 *
 * Runs all stages in a single Chat turn:
 *   1. Detect workspace stack (INTAKE).
 *   2. Classify 6R posture and stream assessment (AC-F12).
 *   3. Generate and stream NFR specification (AC-F13).
 *   4. Generate IaC + runbook (AC-F14).
 *   5. Assert Write Gate — throws WriteGateLockedError if not approved (participant.ts catches).
 *   6. Write all IaC files to .migration/ADO-{adoId}-replatform/.
 *   7. Stream COMPLETE confirmation listing all written file paths.
 *
 * @param adoId   ADO work item ID extracted from the Chat prompt.
 * @param prompt  The original Chat prompt text (used for IaC format detection).
 * @param context VS Code extension context — Write Gate state + script URIs.
 * @param stream  Chat response stream for all output.
 * @param token   Cancellation token forwarded from the Chat request.
 */
export async function handleReplatform(
  adoId: string,
  prompt: string,
  context: vscode.ExtensionContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  // Story 5: pass extensionUri so resolveRoots() can use pre-resolved multi-roots.
  const roots = resolveRoots(context.extensionUri); // throws if no workspace — caught by participant.ts

  const iacFormat   = detectIaCFormat(prompt);
  const formatLabel = iacFormat === 'bicep' ? 'Azure Bicep' : 'Terraform';

  stream.markdown(
    `## Migration: Replatform — ADO-${adoId}\n\n` +
    `_Scanning workspace... IaC format: **${formatLabel}**_\n\n`
  );

  // INTAKE: detect workspace stack.
  const descriptor = detectSource(context.extensionUri, roots);
  stream.markdown(formatSourceDescriptor(descriptor) + '\n\n');

  // 6R_CLASSIFY: AC-F12.
  const sixR = await runSixRClassify(descriptor, stream, token);

  // NFR_SPEC: AC-F13 — streamed BEFORE IaC authoring.
  const nfr = await runNfrSpec(descriptor, sixR, stream, token);

  // IaC_AUTHORING: AC-F14 — generate IaC + runbook.
  const { iacText, runbookText } = await runIaCAuthoring(
    descriptor, sixR, nfr, iacFormat, stream, token
  );

  // WRITE_GATE: AC-F14 — required before any file write.
  // WriteGateLockedError propagates to participant.ts which catches and exits cleanly.
  await assertGateOpen(context, adoId, stream);

  // WRITE: create directories and write all IaC files.
  const workspaceRoot = roots[0];
  const baseDir = vscode.Uri.file(path.join(workspaceRoot, '.migration'));
  const iacDir  = vscode.Uri.file(path.join(workspaceRoot, '.migration', `ADO-${adoId}-replatform`));

  await vscode.workspace.fs.createDirectory(baseDir);
  await vscode.workspace.fs.createDirectory(iacDir);

  const filesToWrite = buildIaCFiles(adoId, iacFormat, iacText, runbookText, descriptor, sixR);
  const writtenPaths: string[] = [];

  for (const f of filesToWrite) {
    const fullPath = path.join(workspaceRoot, '.migration', f.relativePath);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(fullPath),
      Buffer.from(f.content, 'utf-8')
    );
    writtenPaths.push(fullPath);
  }

  // COMPLETE: AC-F14 — confirm all written files.
  const fileList = writtenPaths.map(p => `- \`${p}\``).join('\n');
  stream.markdown(
    `\n\n---\n\n` +
    `✅ **IaC files written (${formatLabel}):**\n\n${fileList}\n\n` +
    `> ⚠ **Human-executed:** Review all files with your Tech Lead and Platform Engineer ` +
    `before running. The runbook contains the deployment steps — no code has been executed.\n\n` +
    `The extension authors IaC only — it never connects to or modifies real infrastructure.`
  );
}
