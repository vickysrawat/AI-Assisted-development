#!/usr/bin/env node
// scripts/setup-teardown.cjs
// Deterministic teardown of plugin-managed content from a target project.
//
// Usage (called by skills/setup-teardown/SKILL.md, or run directly in a terminal):
//   node setup-teardown.cjs --scope <full|skills|hooks|rules|commands|state> [--dry-run]
//   node setup-teardown.cjs --scope <full|skills|hooks|rules|commands|state> --execute [--yes]
//   node setup-teardown.cjs                       (interactive: menu → dry-run → CONFIRM → remove)
//
// Default is --dry-run. Pass --execute to perform actual removal.
// Interactive mode (a TTY with no --scope) shows the menu, dry-run, and a CONFIRM prompt.
// --yes / --force skips the CONFIRM prompt (CI / non-interactive execute).

'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const PLUGIN_DIR   = path.resolve(__dirname, '..');
const PROJECT_ROOT = process.cwd();

// ── Args ──────────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const scopeIdx     = args.indexOf('--scope');
const SCOPE_ARG    = scopeIdx >= 0 ? args[scopeIdx + 1] : null;
const SCOPE_PASSED = scopeIdx >= 0;
const EXECUTE      = args.includes('--execute');
const YES          = args.includes('--yes') || args.includes('--force');
const INTERACTIVE  = Boolean(process.stdin.isTTY);

const VALID_SCOPES = ['full', 'skills', 'hooks', 'rules', 'commands', 'state'];
const USAGE = 'Usage: node setup-teardown.cjs --scope <' + VALID_SCOPES.join('|') +
             '> [--dry-run|--execute] [--yes]   (or run with no --scope in a terminal for interactive mode)';

// A scope passed on the command line must be valid; a missing scope is resolved
// interactively (menu) in main() when running in a TTY.
if (SCOPE_PASSED && !VALID_SCOPES.includes(SCOPE_ARG)) {
  console.error(USAGE);
  process.exit(1);
}

function usageError(msg) {
  console.error('Error: ' + msg);
  console.error(USAGE);
  process.exit(1);
}

// ── Plugin section headers for CLAUDE.md stripping ────────────────────────────
// Must match detectRe values in setup-init-bootstrap.cjs CLAUDE_MD_SECTIONS

const CLAUDE_SECTION_HEADERS = [
  '## 0. WRITE GATE',
  '## 0a. Keyword Handlers',
  '## 0b. Shell',
  '## 1. PROJECT OVERVIEW',
  '## Data Access Convention',
  '## Feature Gate',
  '# Dream',
];

// ── Gitignore block markers ───────────────────────────────────────────────────

const GITIGNORE_BEGIN = '# === ai-assisted-development (managed) ===';
const GITIGNORE_END   = '# === end ai-assisted-development ===';

// ── Helpers ───────────────────────────────────────────────────────────────────

function abs(rel) {
  return path.join(PROJECT_ROOT, rel.replace(/\/+$/, ''));
}

function exists(rel) {
  return fs.existsSync(abs(rel));
}

function countFiles(rel) {
  const a = abs(rel);
  if (!fs.existsSync(a)) return 0;
  let n = 0;
  function walk(d) {
    try { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      e.isDirectory() ? walk(path.join(d, e.name)) : n++;
    } } catch(_) {}
  }
  walk(a);
  return n;
}

function rmSafe(rel) {
  const a = abs(rel);
  if (!fs.existsSync(a)) return false;
  fs.statSync(a).isDirectory()
    ? fs.rmSync(a, { recursive: true, force: true })
    : fs.unlinkSync(a);
  return true;
}

// ── CLAUDE.md section stripping ───────────────────────────────────────────────

function stripPluginSections(content) {
  const SEP = '\n---\n';
  const segments = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(SEP);
  let removed = 0;
  const kept = segments.filter(seg => {
    const firstLine = seg.trimStart().split('\n')[0].trim();
    const isPlugin = CLAUDE_SECTION_HEADERS.some(h => firstLine.startsWith(h));
    if (isPlugin) removed++;
    return !isPlugin;
  });
  let result = kept.join(SEP).replace(/\n{3,}/g, '\n\n').trim();
  if (result) result += '\n';
  return { content: result, removed };
}

// ── Gitignore block removal ───────────────────────────────────────────────────

function removeGitignoreBlock(absFile) {
  if (!fs.existsSync(absFile)) return false;
  const orig = fs.readFileSync(absFile, 'utf8');
  const bEsc = GITIGNORE_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const eEsc = GITIGNORE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re   = new RegExp('\\n?' + bEsc + '[\\s\\S]*?' + eEsc + '\\n?', 'g');
  const next = orig.replace(re, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  if (next === orig) return false;
  fs.writeFileSync(absFile, next, 'utf8');
  return true;
}

// ── Pre-commit comparison ─────────────────────────────────────────────────────

function comparePreCommit() {
  const pcAbs     = path.join(PROJECT_ROOT, '.git', 'hooks', 'pre-commit');
  const pluginHook = path.join(PLUGIN_DIR, '_project-deploy', 'hooks', 'findings-gate-precommit.sh');
  if (!fs.existsSync(pcAbs))    return 'NOT_FOUND';
  if (!fs.existsSync(pluginHook)) return 'CUSTOMISED_SKIP';
  try {
    const a = fs.readFileSync(pcAbs,      'utf8').replace(/\r\n/g, '\n');
    const b = fs.readFileSync(pluginHook, 'utf8').replace(/\r\n/g, '\n');
    return a === b ? 'MATCHES_PLUGIN' : 'CUSTOMISED_SKIP';
  } catch(_) { return 'CUSTOMISED_SKIP'; }
}

// ── Scope builders ────────────────────────────────────────────────────────────
//
// Each scope function returns { items, warnings }.
// item shape: { rel, display, type: 'dir'|'file'|'claudeMd'|'gitignore'|'preCommit' }

function scopeSkills() {
  const items = [], warnings = [];
  if (exists('.claude/skills')) {
    const n = countFiles('.claude/skills');
    items.push({ rel: '.claude/skills', display: `.claude/skills/ (${n} files incl. .hashes)`, type: 'dir' });
  }
  return { items, warnings };
}

function scopeHooks() {
  const items = [], warnings = [];
  if (exists('.claude/hooks')) {
    const n = countFiles('.claude/hooks');
    items.push({ rel: '.claude/hooks', display: `.claude/hooks/ (${n} files)`, type: 'dir' });
  }
  const cmp = comparePreCommit();
  if (cmp === 'MATCHES_PLUGIN') {
    const hasBak = fs.existsSync(path.join(PROJECT_ROOT, '.git', 'hooks', 'pre-commit.backup'));
    items.push({
      rel: '.git/hooks/pre-commit',
      display: '.git/hooks/pre-commit' + (hasBak ? ' (backup will be restored)' : ''),
      type: 'preCommit',
    });
  } else if (cmp === 'CUSTOMISED_SKIP') {
    warnings.push('.git/hooks/pre-commit: differs from plugin hook — skipped (customised or from another tool)');
  }
  return { items, warnings };
}

function scopeRules() {
  const items = [], warnings = [];
  let deployed = [];
  const stateAbs = abs('.claude/dream-init-state.json');
  if (fs.existsSync(stateAbs)) {
    try {
      const s = JSON.parse(fs.readFileSync(stateAbs, 'utf8'));
      deployed = Array.isArray(s.deployed_rules) ? s.deployed_rules : [];
    } catch(_) {
      warnings.push('dream-init-state.json unreadable — no rules removed');
    }
  }
  if (deployed.length === 0) {
    warnings.push('deployed_rules[] is empty — no rule files tracked; nothing to remove');
  }
  for (const f of deployed) {
    const rel = path.join('.claude', 'rules', f).replace(/\\/g, '/');
    if (exists(rel)) items.push({ rel, display: rel, type: 'file' });
  }
  return { items, warnings };
}

function scopeCommands() {
  const items = [], warnings = [];
  if (exists('.claude/commands')) {
    const n = countFiles('.claude/commands');
    items.push({ rel: '.claude/commands', display: `.claude/commands/ (${n} stubs)`, type: 'dir' });
  }
  return { items, warnings };
}

function scopeState() {
  const items = [], warnings = [];
  for (const f of ['.claude/dream-init-state.json', '.claude/plugin-path.txt']) {
    if (exists(f)) items.push({ rel: f, display: f, type: 'file' });
  }
  return { items, warnings };
}

function scopeFull() {
  const items = [], warnings = [];

  // Standard scopes
  for (const fn of [scopeSkills, scopeHooks, scopeRules, scopeCommands, scopeState]) {
    const r = fn(); items.push(...r.items); warnings.push(...r.warnings);
  }

  // Extra --full targets
  for (const d of ['.claude/architecture', '.claude/graph', 'temp']) {
    if (exists(d)) {
      const n = countFiles(d);
      if (n > 0 && d !== 'temp') {
        warnings.push(`${d}/ is non-empty — may contain developer notes; will be removed`);
      }
      items.push({ rel: d, display: `${d}/ (${n} files)`, type: 'dir' });
    }
  }

  // CLAUDE.md plugin section stripping
  if (exists('CLAUDE.md')) {
    const txt = fs.readFileSync(abs('CLAUDE.md'), 'utf8');
    const present = CLAUDE_SECTION_HEADERS.filter(h => txt.includes(h));
    if (present.length > 0) {
      items.push({
        rel: 'CLAUDE.md',
        display: `CLAUDE.md — ${present.length} plugin sections removed, developer content preserved`,
        type: 'claudeMd',
      });
    }
  }

  // Gitignore/tfignore managed block
  for (const f of ['.gitignore', '.tfignore']) {
    if (exists(f)) {
      const txt = fs.readFileSync(abs(f), 'utf8');
      if (txt.includes(GITIGNORE_BEGIN)) {
        items.push({ rel: f, display: `${f} — plugin-managed block removed`, type: 'gitignore' });
      }
    }
  }

  return { items, warnings };
}

// ── Execute ───────────────────────────────────────────────────────────────────

function execute(items) {
  const results = [];
  for (const item of items) {
    try {
      if (item.type === 'claudeMd') {
        const txt = fs.readFileSync(abs('CLAUDE.md'), 'utf8');
        const { content, removed } = stripPluginSections(txt);
        fs.writeFileSync(abs('CLAUDE.md'), content, 'utf8');
        results.push({ ...item, status: 'ok', note: `${removed} sections stripped` });

      } else if (item.type === 'gitignore') {
        const changed = removeGitignoreBlock(abs(item.rel));
        results.push({ ...item, status: changed ? 'ok' : 'noop' });

      } else if (item.type === 'preCommit') {
        const pcAbs  = path.join(PROJECT_ROOT, '.git', 'hooks', 'pre-commit');
        const bakAbs = pcAbs + '.backup';
        if (fs.existsSync(bakAbs)) {
          fs.copyFileSync(bakAbs, pcAbs);
          fs.unlinkSync(bakAbs);
          results.push({ ...item, status: 'ok', note: 'backup restored' });
        } else {
          fs.unlinkSync(pcAbs);
          results.push({ ...item, status: 'ok' });
        }

      } else {
        const removed = rmSafe(item.rel);
        results.push({ ...item, status: removed ? 'ok' : 'noop' });
      }
    } catch(e) {
      results.push({ ...item, status: 'error', note: e.message });
    }
  }
  return results;
}

// ── Interactive helpers ─────────────────────────────────────────────────────
// These run only when a real terminal is attached. Inside Claude Code the Bash
// tool is non-interactive, so the command stub supplies --scope and --yes and
// these prompts are never reached (a non-interactive execute without --yes is
// refused rather than left hanging on stdin — see main()).

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans); });
  });
}

async function promptScope() {
  const menu = [
    '', '🧹 setup-teardown — select what to remove:', '',
    '  1. --full          Remove all plugin-managed content (complete clean slate)',
    '  2. --skills        Remove .claude/skills/ and .hashes only',
    '  3. --hooks         Remove .claude/hooks/ and pre-commit hook only',
    '  4. --rules         Remove deployed rule files from .claude/rules/ only',
    '  5. --commands      Remove command stubs from .claude/commands/ only',
    '  6. --state         Remove dream-init-state.json and plugin-path.txt only',
    '',
  ].join('\n');
  const map = { '1': 'full', '2': 'skills', '3': 'hooks', '4': 'rules', '5': 'commands', '6': 'state' };
  for (;;) {
    console.log(menu);
    const ans = (await prompt('Enter a number (1–6) or the flag name directly: ')).trim().replace(/^--/, '');
    if (map[ans]) return map[ans];
    if (VALID_SCOPES.includes(ans)) return ans;
    console.log('  Invalid choice — try again.');
  }
}

// ── Reporting ───────────────────────────────────────────────────────────────

const BAR = '━'.repeat(40);

function printDryRun(scope, items, warnings) {
  console.log(`\n📋 setup-teardown dry-run — scope: --${scope}`);
  console.log(BAR);
  if (items.length === 0) {
    console.log('  Files to remove:    0 (nothing to remove)');
  } else {
    console.log(`  Files to remove:    ${items.length}`);
    for (const item of items) console.log(`    • ${item.display}`);
  }
  const warnDisplay = warnings.length ? warnings.map(w => `    ⚠ ${w}`).join('\n') : '    none';
  console.log(`  Warnings:\n${warnDisplay}`);
  console.log(BAR);
}

function runExecute(scope, items, warnings) {
  if (items.length === 0) {
    console.log(`\n✅ setup-teardown — scope: --${scope} — nothing to remove`);
    return 0;
  }

  const results = execute(items);
  let okCount = 0, errCount = 0;
  console.log('');
  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`  ✓ removed: ${r.display}${r.note ? ' — ' + r.note : ''}`);
      okCount++;
    } else if (r.status === 'error') {
      console.log(`  ✗ error: ${r.display} — ${r.note}`);
      errCount++;
    }
    // 'noop' (already gone) — silent
  }
  for (const w of warnings) console.log(`  ⚠ ${w}`);

  console.log(`\n✅ setup-teardown complete — scope: --${scope}`);
  console.log(BAR);
  console.log(`  Removed:  ${okCount} item(s)`);
  if (errCount  > 0)       console.log(`  Errors:   ${errCount}`);
  if (warnings.length > 0) console.log(`  Warnings: ${warnings.length}`);
  console.log(BAR);

  return errCount > 0 ? 1 : 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const scopeFns = {
  full: scopeFull, skills: scopeSkills, hooks: scopeHooks,
  rules: scopeRules, commands: scopeCommands, state: scopeState,
};

async function main() {
  // Resolve scope — interactive menu when none was passed on the command line.
  let scope = SCOPE_ARG;
  if (!SCOPE_PASSED) {
    if (!INTERACTIVE) usageError('no --scope given and not running in an interactive terminal');
    scope = await promptScope();
  }

  const { items, warnings } = scopeFns[scope]();

  // Dry-run only: an explicit --scope without --execute reports and stops (back-compat).
  if (SCOPE_PASSED && !EXECUTE) {
    printDryRun(scope, items, warnings);
    process.exit(0);
  }

  // An interactive session that began without a scope arg shows the dry-run first,
  // then falls through to the CONFIRM gate below.
  if (!SCOPE_PASSED) printDryRun(scope, items, warnings);

  // Confirmation gate — skipped by --yes/--force.
  if (!YES) {
    if (!INTERACTIVE) {
      usageError('refusing to --execute without confirmation in a non-interactive shell; pass --yes');
    }
    const ans = await prompt('\n⚠ Type CONFIRM to permanently remove the items above (anything else cancels): ');
    if (ans.trim() !== 'CONFIRM') {
      console.log('Cancelled — nothing removed.');
      process.exit(0);
    }
  }

  process.exit(runExecute(scope, items, warnings));
}

main().catch((e) => { console.error('Error: ' + (e && e.message ? e.message : e)); process.exit(1); });
