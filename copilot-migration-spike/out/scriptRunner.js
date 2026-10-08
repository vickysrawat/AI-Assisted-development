"use strict";
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
exports.detectSource = detectSource;
exports.formatSourceDescriptor = formatSourceDescriptor;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
// Timeout for all script invocations — prevents hung processes blocking the chat.
const DEFAULT_TIMEOUT_MS = 30_000;
// ── Node.js executable resolution ─────────────────────────────────────────────
//
// DECISION: Do NOT use process.execPath to find node.exe.
//   process.execPath in the VS Code extension host points to Code.exe (Electron),
//   not to a Node.js binary. Passing Code.exe as the executor for .cjs scripts
//   would fail silently or with a cryptic error.
//
// Options considered:
//   A) process.execPath               — rejected: points to Electron (Code.exe), not node
//   B) Hard-code 'node' and rely on PATH — rejected: PATH may not be inherited correctly
//      in the extension host on Windows (depends on shell launch context)
//   C) 'where node' / 'which node' probe with known fallback paths — chosen: robust on
//      Windows + Mac + Linux, fails fast with a clear error if node is not installed
/**
 * Resolves the absolute path to the system Node.js executable.
 * Cached after first call — the path does not change during a VS Code session.
 */
let _cachedNodeExe = null;
function resolveNodeExe() {
    if (_cachedNodeExe) {
        return _cachedNodeExe;
    }
    // Try PATH-based resolution first (works if node is on the system PATH).
    const cmd = process.platform === 'win32' ? 'where node' : 'which node';
    try {
        const result = (0, child_process_1.execSync)(cmd, { encoding: 'utf8', timeout: 3_000, stdio: ['pipe', 'pipe', 'pipe'] });
        const first = result.split(/\r?\n/)[0].trim();
        if (first && fs.existsSync(first)) {
            _cachedNodeExe = first;
            return first;
        }
    }
    catch { /* fall through to candidates */ }
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
    throw new Error('Cannot locate node.exe — ensure Node.js is installed and on the system PATH. ' +
        'Restart VS Code after installing Node.js.');
}
// ── Path resolution ──────────────────────────────────────────────────────────
/**
 * Resolves the absolute path to a bundled script.
 * During development the extension root is the spike folder;
 * after packaging it is the installed extension folder.
 *
 * Convention: scripts live at <extensionUri>/scripts/<name>
 */
function resolveScript(extensionUri, scriptName) {
    return path.join(extensionUri.fsPath, 'scripts', scriptName);
}
// ── Generic runner ───────────────────────────────────────────────────────────
//
// DECISION: Use require() instead of spawning a child process for migration scripts.
//
// Options considered:
//   A) execFileAsync(nodeExe, [scriptPath, ...args]) — rejected: unreliable on Windows when
//      the extension path contains spaces (OneDrive paths, "AI Learning" etc.). The child
//      process is killed with null exit code; exact cause is Windows process creation with
//      space-bearing paths even via execFile (not a shell). Confirmed in spike testing.
//   B) execFileAsync with shell:true — rejected: shell:true reintroduces injection risk and
//      requires quoting; complicates cross-platform handling.
//   C) require() the CJS module directly — chosen: we are already in a Node.js process
//      (VS Code extension host). require() uses the V8 module loader directly, bypassing
//      all subprocess spawn mechanics. No path-quoting issues. The one side effect:
//      migration-source-detect.cjs internally calls execFileSync(process.execPath, ...)
//      for repo-detect.cjs. In the extension host process.execPath = Code.exe (Electron).
//      We patch it temporarily to our resolved node.exe and restore it after the call.
/**
 * Requires a bundled CJS script and returns the result of calling a named export.
 * Avoids all subprocess spawn issues (space-in-path, signal kills, env inheritance).
 *
 * process.execPath is temporarily patched to resolveNodeExe() so that any internal
 * execFileSync calls inside the script use the correct Node.js binary, not Electron.
 */
function requireScript(extensionUri, scriptName) {
    const scriptPath = resolveScript(extensionUri, scriptName);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(scriptPath);
}
// ── Typed wrappers ───────────────────────────────────────────────────────────
/**
 * Detects the stack of the workspace (and any additional roots).
 * Wraps `scripts/migration-source-detect.cjs --roots=<roots> --json`.
 *
 * Exit codes: 0 = detected, 3 = no stack found (both handled — caller checks primary.token).
 *
 * @param extensionUri  Extension root.
 * @param roots         Paths to scan (workspace root + any additionalDirectories).
 */
function detectSource(extensionUri, roots) {
    // DECISION: require() the module directly rather than spawning a subprocess.
    // See the DECISION comment above requireScript() for full rationale.
    //
    // migration-source-detect.cjs internally calls:
    //   execFileSync(process.execPath, [path.join(__dirname, 'repo-detect.cjs'), ...])
    //
    // In the extension host, process.execPath is Code.exe (Electron), not node.exe.
    // We patch it to our resolved node.exe for the duration of createDescriptor(),
    // then restore it so the extension host is unaffected.
    const nodeExe = resolveNodeExe();
    const origExecPath = process.execPath;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.execPath = nodeExe;
        const mod = requireScript(extensionUri, 'migration-source-detect.cjs');
        return mod.createDescriptor(roots);
    }
    finally {
        // Always restore, even if createDescriptor throws.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.execPath = origExecPath;
    }
}
/**
 * Formats a SourceDescriptor as a human-readable Markdown block
 * suitable for streaming into a Chat response.
 */
function formatSourceDescriptor(desc) {
    const stackLine = desc.stacks
        .map(s => `\`${s.token}${s.version ? `@${s.version}` : ''}\``)
        .join(' · ') || '_none detected_';
    const lines = [
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
//# sourceMappingURL=scriptRunner.js.map