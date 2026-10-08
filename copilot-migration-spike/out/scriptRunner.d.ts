/**
 * scriptRunner.ts — Runs migration Node.js scripts as child processes.
 *
 * In Claude Code the skills invoke scripts via the Bash tool:
 *   node scripts/migration-source-detect.cjs --roots=<path> --json
 *
 * In the VS Code extension the scripts are bundled under `scripts/` (copied from
 * the plugin repo at build time). This module provides typed wrappers that:
 *   1. Resolve the script path relative to the extension bundle (extensionUri).
 *   2. Spawn the script via child_process.execFile (never a shell string — no injection).
 *   3. Return stdout as a typed result, stderr as a thrown Error.
 *   4. Apply a timeout (default 30 s) so a hung script never blocks the UI.
 *
 * Scripts are read-only (they write nothing) — safe to run without the Write Gate.
 */
import * as vscode from 'vscode';
/** Output of migration-source-detect.cjs --json */
export interface SourceDescriptor {
    roots: string[];
    primary: {
        token: string | null;
        version: string | null;
    };
    stacks: Array<{
        token: string;
        version?: string;
        projectPath?: string;
        role?: string;
        generation?: string;
    }>;
    dataLayer: string[];
    auth: string[];
    integrations: Array<{
        kind: string;
        evidence: string;
    }>;
    sizeEstimate: {
        files: number;
    };
    graphPresent: boolean;
    archDocsPresent: boolean;
}
/**
 * Detects the stack of the workspace (and any additional roots).
 * Wraps `scripts/migration-source-detect.cjs --roots=<roots> --json`.
 *
 * Exit codes: 0 = detected, 3 = no stack found (both handled — caller checks primary.token).
 *
 * @param extensionUri  Extension root.
 * @param roots         Paths to scan (workspace root + any additionalDirectories).
 */
export declare function detectSource(extensionUri: vscode.Uri, roots: string[]): SourceDescriptor;
/**
 * Formats a SourceDescriptor as a human-readable Markdown block
 * suitable for streaming into a Chat response.
 */
export declare function formatSourceDescriptor(desc: SourceDescriptor): string;
