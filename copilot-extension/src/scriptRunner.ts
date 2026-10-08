/**
 * scriptRunner.ts — Runs migration Node.js scripts in the VS Code extension host.
 *
 * In Claude Code the skills invoke scripts via the Bash tool:
 *   node scripts/migration-source-detect.cjs --roots=<path> --json
 *
 * In the VS Code extension the scripts are vendored under `scripts/` (committed).
 * This module provides typed wrappers that:
 *   1. Resolve the script path relative to the extension bundle (extensionUri).
 *   2. Load the script via require() — never a subprocess spawn.
 *   3. Return a typed result; errors surface as thrown Error instances caught by the caller.
 *
 * Scripts are read-only (they write nothing) — safe to run without the Write Gate.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// ── Node.js executable resolution ─────────────────────────────────────────────
//
// DECISION: Do NOT use process.execPath to find node.exe.
//   process.execPath in the VS Code extension host points to Code.exe (Electron),
//   not to a Node.js binary. Passing Code.exe as the executor for .cjs scripts
//   would fail silently or with a cryptic error.
//
// DECISION: Use require() instead of execFileAsync for CJS script invocation.
//   Options considered:
//     A) execFileAsync(nodeExe, [scriptPath, ...args]) — rejected: unreliable on Windows
//        when the extension path contains spaces (OneDrive, "AI Learning" etc.). The child
//        process is killed with null exit code. Confirmed in Phase 1 spike testing.
//     B) execFileAsync with shell:true — rejected: reintroduces injection risk.
//     C) require() the CJS module directly — chosen: we are already in a Node.js process
//        (VS Code extension host). require() uses the V8 module loader directly, bypassing
//        all subprocess spawn mechanics. No path-quoting issues.
//
// One side effect of C: migration-source-detect.cjs internally calls
//   execFileSync(process.execPath, ...)
// In the extension host process.execPath = Code.exe (Electron). We patch it temporarily
// to our resolved node.exe and restore after the call.

/**
 * Resolves the absolute path to the system Node.js executable.
 * Cached after first call — the path does not change during a VS Code session.
 */
let _cachedNodeExe: string | null = null;

export function resolveNodeExe(): string {
  if (_cachedNodeExe) { return _cachedNodeExe; }

  // Try PATH-based resolution first (works if node is on the system PATH).
  const cmd = process.platform === 'win32' ? 'where node' : 'which node';
  try {
    const result = execSync(cmd, { encoding: 'utf8', timeout: 3_000, stdio: ['pipe', 'pipe', 'pipe'] });
    const first = result.split(/\r?\n/)[0].trim();
    if (first && fs.existsSync(first)) {
      _cachedNodeExe = first;
      return first;
    }
  } catch { /* fall through to candidates */ }

  // Fallback: well-known install locations on Windows.
  const candidates = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    path.join(process.env['APPDATA'] ?? '', 'nvm', 'current', 'node.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      _cachedNodeExe = c;
      return c;
    }
  }

  throw new Error(
    'Cannot locate node.exe — ensure Node.js is installed and on the system PATH. ' +
    'Restart VS Code after installing Node.js.'
  );
}

// ── Path resolution ──────────────────────────────────────────────────────────

/**
 * Resolves the absolute path to a vendored script.
 * Convention: scripts live at <extensionUri>/scripts/<name>
 */
function resolveScript(
  extensionUri: vscode.Uri,
  scriptName: string
): string {
  return path.join(extensionUri.fsPath, 'scripts', scriptName);
}

// ── Module loader ────────────────────────────────────────────────────────────

/**
 * Loads a vendored CJS script via require() and returns the module exports.
 * Avoids all subprocess spawn issues (space-in-path, signal kills, env inheritance).
 */
function requireScript<T>(extensionUri: vscode.Uri, scriptName: string): T {
  const scriptPath = resolveScript(extensionUri, scriptName);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(scriptPath) as T;
}

/** Shape of the migration-source-detect.cjs module exports we use. */
interface DetectModule {
  createDescriptor(roots: string[]): SourceDescriptor;
}

// ── Typed result types ───────────────────────────────────────────────────────

/** Output of migration-source-detect.cjs — describes the detected workspace. */
export interface SourceDescriptor {
  roots: string[];
  primary: { token: string | null; version: string | null };
  stacks: Array<{ token: string; version?: string; projectPath?: string; role?: string; generation?: string }>;
  dataLayer: string[];
  auth: string[];
  integrations: Array<{ kind: string; evidence: string }>;
  sizeEstimate: { files: number };
  graphPresent: boolean;
  archDocsPresent: boolean;
}

// ── Typed wrappers ───────────────────────────────────────────────────────────

/**
 * Detects the stack of the workspace (and any additional roots).
 * Wraps `scripts/migration-source-detect.cjs` via require().
 *
 * process.execPath is temporarily patched to resolveNodeExe() so that any internal
 * execFileSync calls inside the script use the correct Node.js binary, not Electron.
 *
 * @param extensionUri  Extension root URI.
 * @param roots         Paths to scan (resolved workspace roots).
 */
export function detectSource(
  extensionUri: vscode.Uri,
  roots: string[]
): SourceDescriptor {
  const nodeExe = resolveNodeExe();
  const origExecPath = process.execPath;

  try {
    // Patch process.execPath so internal execFileSync calls in the script use node, not Electron.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process as any).execPath = nodeExe;
    const mod = requireScript<DetectModule>(extensionUri, 'migration-source-detect.cjs');
    return mod.createDescriptor(roots);
  } finally {
    // Always restore, even if createDescriptor throws.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process as any).execPath = origExecPath;
  }
}

/**
 * Formats a SourceDescriptor as a human-readable Markdown block
 * suitable for streaming into a Chat response.
 */
export function formatSourceDescriptor(desc: SourceDescriptor): string {
  const stackLine = desc.stacks
    .map(s => `\`${s.token}${s.version ? `@${s.version}` : ''}\``)
    .join(' · ') || '_none detected_';

  const lines: string[] = [
    '### Source detection',
    '',
    `| Field | Value |`,
    `|---|---|`,
    `| Primary stack | ${desc.primary.token ? `\`${desc.primary.token}${desc.primary.version ? ` ${desc.primary.version}` : ''}\`` : '_unknown_'} |`,
    `| All stacks | ${stackLine} |`,
    `| Data layer | ${desc.dataLayer.length ? desc.dataLayer.map(d => `\`${d}\``).join(', ') : '_none_'} |`,
    `| Auth | ${desc.auth.length ? desc.auth.join(', ') : '_not detected_'} |`,
    `| Source files | ${desc.sizeEstimate.files} |`,
    `| Knowledge graph | ${desc.graphPresent ? 'available' : 'not available'} |`,
    `| Arch docs | ${desc.archDocsPresent ? 'available' : 'not available'} |`,
  ];

  if (desc.integrations.length) {
    lines.push('', '**Integrations detected:**');
    for (const i of desc.integrations) {
      lines.push(`- ${i.kind} (${i.evidence})`);
    }
  }

  return lines.join('\n');
}
