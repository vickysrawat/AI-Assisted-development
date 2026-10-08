/**
 * workspaceRoots.ts — Resolves workspace root paths for migration scans.
 *
 * Story 1: returns all VS Code workspace folders directly.
 * Story 5: enhanced to read migrationRoots from .claude/settings.local.json when
 *          extensionUri is provided. resolve-migration-roots.cjs (vendored in scripts/)
 *          can be run once by the developer to populate that key via --write-to; after
 *          that, this function returns the BFS-resolved multi-root list on every turn,
 *          fast and without any subprocess. Falls back to all workspace folders when the
 *          key is absent so the extension works in projects not set up with the plugin.
 *
 * DECISION: Read migrationRoots from settings.local.json rather than require()'ing
 *   resolve-migration-roots.cjs directly.
 *   Options considered:
 *     A) require() the CJS script inline — rejected: resolve-migration-roots.cjs runs all
 *        BFS logic at the top level (no require.main === module guard), so require() would
 *        execute the full BFS immediately, including process.exit() calls.
 *     B) execSync subprocess — rejected: unreliable on Windows when the extension path
 *        contains spaces (same problem that led to require() in scriptRunner.ts).
 *     C) Read the pre-resolved migrationRoots key from settings.local.json (chosen):
 *        the developer runs resolve-migration-roots.cjs --write-to=.claude/settings.local.json
 *        once to populate the key; this function reads it on every turn. Fast, read-only,
 *        no subprocess, no path-quoting issues.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Returns the list of workspace root paths to scan for migration targets.
 *
 * When extensionUri is provided, attempts to read pre-resolved roots from
 * .claude/settings.local.json in the primary workspace folder (the migrationRoots
 * key written by resolve-migration-roots.cjs --write-to). Falls back to returning
 * all workspace folders if the key is absent or the file cannot be read.
 *
 * @param extensionUri  When provided, enables enhanced multi-root resolution.
 *                      Omit (or pass undefined) for the basic workspace folder list.
 * @throws Error if called with no workspace folders open in VS Code.
 */
export function resolveRoots(extensionUri?: vscode.Uri): string[] {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error(
      'No workspace folder open. Open a project folder (File → Open Folder) before running @migration.'
    );
  }

  // Story 5: When extensionUri is supplied, try reading pre-resolved migrationRoots
  // from the primary workspace folder's .claude/settings.local.json.
  // The key is populated by running:
  //   node scripts/resolve-migration-roots.cjs --source-path=. --write-to=.claude/settings.local.json
  if (extensionUri) {
    try {
      const primaryRoot  = folders[0].uri.fsPath;
      const settingsPath = path.join(primaryRoot, '.claude', 'settings.local.json');
      const settingsText = fs.readFileSync(settingsPath, 'utf-8');
      const settings     = JSON.parse(settingsText) as { migrationRoots?: unknown };

      if (Array.isArray(settings.migrationRoots) && settings.migrationRoots.length > 0) {
        // Guard against non-string entries that would break downstream path operations.
        const roots = (settings.migrationRoots as unknown[]).filter(
          (r): r is string => typeof r === 'string' && r.length > 0
        );
        if (roots.length > 0) { return roots; }
      }
    } catch {
      // No settings.local.json, malformed JSON, or no migrationRoots key.
      // Fall through to the basic workspace folder list — the extension works without it.
    }
  }

  // Default (Story 1 behaviour): return all open workspace folders.
  return folders.map(f => f.uri.fsPath);
}
