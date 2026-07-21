#!/usr/bin/env node
'use strict';
// install.cjs — Node.js installer for ai-assisted-development plugin
//
// Use when both bash (install.sh) and PowerShell (install.ps1) are blocked.
// Requires only Node.js, git, and the claude CLI — all of which must be available
// for the plugin to function regardless of which installer is used.
//
// Usage:
//   node install.cjs                    # fresh install
//   node install.cjs --update           # update existing install
//   node install.cjs --uninstall        # uninstall (prompts for confirmation)
//   node install.cjs --uninstall --yes  # uninstall without prompt

const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const readline = require('readline');
const { execSync, spawnSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────────────────

const PLUGIN_NAME = 'ai-assisted-development';
const argv        = process.argv.slice(2);
const UPDATE      = argv.includes('--update');
const UNINSTALL   = argv.includes('--uninstall');
const YES         = argv.includes('--yes');

// ── Config (single source of truth: .claude-plugin/config.json) ───────────────

const CONFIG_JSON = path.join(__dirname, '.claude-plugin', 'config.json');
let COMPANY = 'Your Company', ADO_ORG = 'your-org', ADO_PROJECT = 'your-project';
let ADO_BASE = 'https://dev.azure.com', ADO_PLUGIN_REPO = PLUGIN_NAME;

if (fs.existsSync(CONFIG_JSON)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf8'));
    if (cfg.company)        COMPANY        = cfg.company;
    if (cfg.organization)   ADO_ORG        = cfg.organization;
    if (cfg.project)        ADO_PROJECT    = cfg.project;
    if (cfg.adoBaseUrl)     ADO_BASE       = cfg.adoBaseUrl;
    if (cfg.pluginRepoName) ADO_PLUGIN_REPO = cfg.pluginRepoName;
  } catch {}
}

function deriveMarketplace(org) {
  return (org && org !== 'your-org') ? `${org}-marketplace` : 'local-marketplace';
}

// ── Path resolution ────────────────────────────────────────────────────────────

const pluginsRoot = path.join(os.homedir(), '.claude', 'plugins');
let EXISTING_PLUGIN_DIR = null;
try {
  for (const mkt of fs.readdirSync(pluginsRoot)) {
    const candidate = path.join(pluginsRoot, mkt, 'plugins', PLUGIN_NAME);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      EXISTING_PLUGIN_DIR = candidate;
      break;
    }
  }
} catch {}

let MARKETPLACE_NAME, MARKETPLACE_DIR, PLUGIN_DIR;
if (EXISTING_PLUGIN_DIR) {
  PLUGIN_DIR       = EXISTING_PLUGIN_DIR;
  MARKETPLACE_DIR  = path.dirname(path.dirname(PLUGIN_DIR));
  MARKETPLACE_NAME = path.basename(MARKETPLACE_DIR);
} else {
  MARKETPLACE_NAME = deriveMarketplace(ADO_ORG);
  MARKETPLACE_DIR  = path.join(pluginsRoot, MARKETPLACE_NAME);
  PLUGIN_DIR       = path.join(MARKETPLACE_DIR, 'plugins', PLUGIN_NAME);
}

let ADO_REPO_URL = `${ADO_BASE}/${ADO_ORG}/${ADO_PROJECT}/_git/${ADO_PLUGIN_REPO}`;
const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');

// ── Utilities ──────────────────────────────────────────────────────────────────

function ok(msg)   { console.log(`✓ ${msg}`); }
function warn(msg) { console.log(`⚠  ${msg}`); }
function err(msg)  { console.error(`✗ ${msg}`); }

function commandExists(cmd) {
  // execSync (not spawnSync) — uses cmd.exe on Windows, finding .cmd wrappers like
  // claude.cmd and git.cmd without triggering DEP0190 (spawnSync args + shell: true).
  try { execSync(`${cmd} --version`, { stdio: 'ignore' }); return true; }
  catch(e) { return false; }
}

function run(cmd, opts) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function tryRun(cmd, opts) {
  try { run(cmd, opts); return true; } catch { return false; }
}

function getPluginVersion(pluginDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8')).version || 'unknown';
  } catch { return 'unknown'; }
}

function safeCopy(src, dest) {
  const exclude = new Set(['.git', 'docs', '.vs', 'node_modules']);
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      safeCopy(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// Inline port of sync-config.sh (which is itself just `node -e '...'` wrapped in bash)
function syncConfig(pluginDir) {
  const cfgPath = path.join(pluginDir, '.claude-plugin', 'config.json');
  if (!fs.existsSync(cfgPath)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const realOrg = cfg.organization && cfg.organization !== 'your-org';
    const mktName = realOrg ? `${cfg.organization}-marketplace` : 'local-marketplace';
    let changed = false;
    if (cfg.marketplaceName !== mktName) { cfg.marketplaceName = mktName; changed = true; }
    if (changed) fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

    const cloneUrl = `${cfg.adoBaseUrl}/${cfg.organization}/${cfg.project}/_git/${cfg.pluginRepoName || PLUGIN_NAME}`;
    const pjPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(pjPath)) {
      const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
      pj.author = pj.author || {};
      pj.author.name = cfg.company;
      if (cfg.companyUrl) pj.author.url = cfg.companyUrl; else delete pj.author.url;
      pj.repository = cloneUrl;
      fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n');
    }
    const mkPath = path.join(pluginDir, '.claude-plugin', 'marketplace.json');
    if (fs.existsSync(mkPath)) {
      const mk = JSON.parse(fs.readFileSync(mkPath, 'utf8'));
      if (cfg.marketplaceName) mk.name = cfg.marketplaceName;
      mk.description = `${cfg.company} internal Claude Code plugins`;
      fs.writeFileSync(mkPath, JSON.stringify(mk, null, 2) + '\n');
    }
    ok(`Config synced (plugin.json author, marketplace.json description)`);
  } catch (e) { warn(`Config sync skipped: ${e.message}`); }
}

function writePluginConfig(pluginDir) {
  const dest = path.join(pluginDir, '.claude-plugin', 'config.json');
  if (!fs.existsSync(dest)) return;
  try {
    const c = JSON.parse(fs.readFileSync(dest, 'utf8'));
    c.company = COMPANY; c.organization = ADO_ORG;
    c.project = ADO_PROJECT; c.adoBaseUrl = ADO_BASE;
    fs.writeFileSync(dest, JSON.stringify(c, null, 2) + '\n');
    ok(`Identity saved to config.json (${ADO_ORG}/${ADO_PROJECT})`);
    syncConfig(pluginDir);
  } catch (e) { warn(`Could not save config.json: ${e.message}`); }
}

function writeMarketplaceJson(version) {
  fs.mkdirSync(path.join(MARKETPLACE_DIR, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(MARKETPLACE_DIR, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({
      name: MARKETPLACE_NAME,
      owner: { name: 'Product Engineering' },
      description: `${COMPANY} internal Claude Code plugins`,
      plugins: [{
        name: PLUGIN_NAME,
        source: `./plugins/${PLUGIN_NAME}`,
        description: `ICEA-driven development workflow - v${version}`,
      }],
    }, null, 2),
    'utf8'
  );
}

function registerInSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, '{}', 'utf8');
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
  if (!settings.extraKnownMarketplaces) settings.extraKnownMarketplaces = {};
  if (settings.extraKnownMarketplaces[MARKETPLACE_NAME]) {
    console.log(`  - extraKnownMarketplaces.${MARKETPLACE_NAME} already exists, skipping.`);
  } else {
    settings.extraKnownMarketplaces[MARKETPLACE_NAME] = {
      source: { source: 'directory', path: MARKETPLACE_DIR },
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`  + extraKnownMarketplaces.${MARKETPLACE_NAME} registered in settings.json`);
  }
}

function clearCache() {
  const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache');
  if (!fs.existsSync(cacheDir)) return;
  let cleared = 0;
  for (const entry of fs.readdirSync(cacheDir)) {
    if (entry.startsWith('temp_local_')) {
      try { fs.rmSync(path.join(cacheDir, entry), { recursive: true, force: true }); cleared++; } catch {}
    }
  }
  if (cleared) console.log(`  Cleared ${cleared} stale cache entries`);
}

function setupAdoEnv(pluginDir) {
  const envFile     = path.join(pluginDir, 'tools', 'ado-helper', '.env');
  const envTemplate = path.join(pluginDir, 'tools', 'ado-helper', '.env.template');
  if (!fs.existsSync(envFile)) {
    if (fs.existsSync(envTemplate)) {
      fs.copyFileSync(envTemplate, envFile);
      ok('Created tools/ado-helper/.env (paste your PAT in ADO_PAT= before use)');
    }
  } else {
    const content = fs.readFileSync(envFile, 'utf8');
    if (!content.includes('ADO_PAT=')) {
      fs.appendFileSync(envFile, '\nADO_PAT=paste_your_pat_here');
      warn('ADO_PAT key added to existing tools/ado-helper/.env - fill in your token');
    } else {
      ok('tools/ado-helper/.env already configured');
    }
  }
}

// ── Prompts (sequential, single readline instance per prompt) ──────────────────

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
  });
}

async function promptIdentity() {
  console.log('\nAzure DevOps identity - press Enter to keep the shown default:\n');
  const org     = await ask(`  Organization     [${ADO_ORG}]: `);
  const project = await ask(`  Project          [${ADO_PROJECT}]: `);
  const company = await ask(`  Company / team   [${COMPANY}]: `);
  const base    = await ask(`  ADO base URL     [${ADO_BASE}]: `);
  if (org)     ADO_ORG     = org;
  if (project) ADO_PROJECT = project;
  if (company) COMPANY     = company;
  if (base)    ADO_BASE    = base;
  ADO_REPO_URL = `${ADO_BASE}/${ADO_ORG}/${ADO_PROJECT}/_git/${ADO_PLUGIN_REPO}`;
  if (!EXISTING_PLUGIN_DIR) {
    MARKETPLACE_NAME = deriveMarketplace(ADO_ORG);
    MARKETPLACE_DIR  = path.join(pluginsRoot, MARKETPLACE_NAME);
    PLUGIN_DIR       = path.join(MARKETPLACE_DIR, 'plugins', PLUGIN_NAME);
    console.log(`  Marketplace: ${MARKETPLACE_NAME}`);
  }
  console.log('');
}

async function selectSource(isUpdate) {
  const verb = isUpdate ? 'update' : 'install';
  console.log(`\nHow would you like to ${verb} the plugin?\n`);
  console.log(`  1) Pull from Azure DevOps (git)\n     ${ADO_REPO_URL}\n`);
  console.log('  2) Copy from a local folder\n     (use this if you have the plugin files on your machine)\n');
  return await ask('Enter choice [1/2]: ');
}

// ── Preflight ──────────────────────────────────────────────────────────────────

function preflight() {
  const required = { claude: 'npm install -g @anthropic-ai/claude-code', git: 'https://git-scm.com', node: 'https://nodejs.org' };
  for (const [cmd, hint] of Object.entries(required)) {
    if (!commandExists(cmd)) {
      err(`${cmd} not found. Install from: ${hint}`);
      process.exit(1);
    }
  }
}

// ── Install ────────────────────────────────────────────────────────────────────

async function doInstall() {
  preflight();
  await promptIdentity();

  if (fs.existsSync(PLUGIN_DIR)) {
    warn(`Existing install found at ${PLUGIN_DIR} (v${getPluginVersion(PLUGIN_DIR)})`);
    warn('To update an existing install use: node install.cjs --update');
    const confirm = await ask('  Overwrite with a fresh install anyway? (y/N): ');
    if (confirm.toLowerCase() !== 'y') { console.log('Cancelled.'); process.exit(0); }
    fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
  }

  fs.mkdirSync(path.join(MARKETPLACE_DIR, 'plugins'), { recursive: true });

  const choice = await selectSource(false);
  if (choice === '1') {
    console.log('Cloning from Azure DevOps...');
    run(`git clone "${ADO_REPO_URL}" "${PLUGIN_DIR}"`);
  } else if (choice === '2') {
    const defaultPath = __dirname;
    console.log('Enter the full path to the plugin folder.');
    console.log(`Press Enter to use the current folder: ${defaultPath}`);
    const rawPath = await ask('Path: ');
    const localPath = rawPath || defaultPath;
    if (!fs.existsSync(localPath)) { err(`Folder not found: ${localPath}`); process.exit(1); }
    if (!fs.existsSync(path.join(localPath, '.claude-plugin', 'plugin.json'))) {
      err("No plugin.json found. Make sure you're pointing at the ai-assisted-development folder.");
      process.exit(1);
    }
    console.log(`Copying from ${localPath} ...`);
    safeCopy(localPath, PLUGIN_DIR);
  } else {
    err('Invalid choice. Run again and enter 1 or 2.'); process.exit(1);
  }

  if (!fs.existsSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'))) {
    err('Install failed - plugin.json not found. Check the source and retry.');
    process.exit(1);
  }

  const newVersion = getPluginVersion(PLUGIN_DIR);
  writePluginConfig(PLUGIN_DIR);
  writeMarketplaceJson(newVersion);
  registerInSettings();
  clearCache();
  setupAdoEnv(PLUGIN_DIR);

  console.log('\nRegistering marketplace and installing plugin...\n');
  run(`claude plugin marketplace add "${MARKETPLACE_DIR}"`);
  tryRun(`claude plugin marketplace update ${MARKETPLACE_NAME}`, { stdio: 'ignore' });

  let installOk = tryRun(`claude plugin install "${PLUGIN_NAME}@${MARKETPLACE_NAME}" --scope user`);
  if (!installOk) {
    err('\nInstallation failed - rolling back...\n');
    tryRun(`claude plugin uninstall "${PLUGIN_NAME}@${MARKETPLACE_NAME}" --scope user`, { stdio: 'ignore' });
    tryRun(`claude plugin marketplace remove ${MARKETPLACE_NAME}`, { stdio: 'ignore' });
    if (fs.existsSync(MARKETPLACE_DIR)) fs.rmSync(MARKETPLACE_DIR, { recursive: true, force: true });
    err('Rollback complete. Plugin has been fully removed.');
    process.exit(1);
  }

  tryRun(`claude plugin update "${PLUGIN_NAME}@${MARKETPLACE_NAME}"`, { stdio: 'ignore' });

  const commandCount = fs.existsSync(path.join(PLUGIN_DIR, 'commands'))
    ? fs.readdirSync(path.join(PLUGIN_DIR, 'commands')).filter(f => f.endsWith('.md')).length : 0;

  console.log(`\n=======================================================================`);
  ok(`Plugin installed successfully - v${newVersion}`);
  console.log(`=======================================================================\n`);
  console.log(`+- Next steps ----------------------------------------------------------+`);
  console.log(`|  1. Open your project in VS Code                                       |`);
  console.log(`|  2. Open a terminal and run: claude                                    |`);
  console.log(`|  3. Inside the session, run: /setup-init (new project)                 |`);
  console.log(`|                          or: /setup-sync (existing project)            |`);
  console.log(`|  4. Set AZURE_DEVOPS_PAT as a Windows User Environment Variable        |`);
  console.log(`|  5. Run /setup-status to verify all infrastructure checks are green    |`);
  console.log(`|                                                                        |`);
  console.log(`|  Available commands (type / in Claude Code to see all ${commandCount}):           |`);
  console.log(`|  To update later:    node install.cjs --update                         |`);
  console.log(`|  To uninstall later: node install.cjs --uninstall                      |`);
  console.log(`+------------------------------------------------------------------------+\n`);
}

// ── Update ─────────────────────────────────────────────────────────────────────

async function doUpdate() {
  if (!fs.existsSync(PLUGIN_DIR)) {
    err('Plugin not installed. Run: node install.cjs'); process.exit(1);
  }
  console.log(`Update mode - plugin found at ${PLUGIN_DIR}\n`);

  const installedCfg = path.join(PLUGIN_DIR, '.claude-plugin', 'config.json');
  const cfgBackup    = fs.existsSync(installedCfg) ? fs.readFileSync(installedCfg, 'utf8') : null;

  const choice = await selectSource(true);
  if (choice === '1') {
    if (!fs.existsSync(path.join(PLUGIN_DIR, '.git'))) {
      err('Plugin was not installed via git - use option 2 (local folder) instead.'); process.exit(1);
    }
    console.log('Pulling latest from Azure DevOps...');
    run(`git -C "${PLUGIN_DIR}" pull origin main`);
  } else if (choice === '2') {
    console.log('Enter the full path to the folder containing the new plugin version.');
    const localPath = await ask('Path: ');
    if (!localPath || !fs.existsSync(localPath)) { err('Folder not found.'); process.exit(1); }
    if (!fs.existsSync(path.join(localPath, '.claude-plugin', 'plugin.json'))) {
      err('No plugin.json found.'); process.exit(1);
    }
    console.log(`Copying from ${localPath} ...`);
    safeCopy(localPath, PLUGIN_DIR);
  } else { err('Invalid choice.'); process.exit(1); }

  const newVersion = getPluginVersion(PLUGIN_DIR);
  if (cfgBackup) {
    fs.writeFileSync(installedCfg, cfgBackup, 'utf8');
    syncConfig(PLUGIN_DIR);
    ok('Preserved your identity (config.json) across the update');
  }

  writeMarketplaceJson(newVersion);
  tryRun(`claude plugin marketplace update ${MARKETPLACE_NAME}`, { stdio: 'ignore' });
  tryRun(`claude plugin update "${PLUGIN_NAME}@${MARKETPLACE_NAME}"`, { stdio: 'ignore' });

  console.log(`\n========================================`);
  ok(`Plugin updated to v${newVersion}`);
  console.log(`========================================\n`);
  console.log('Start a new Claude Code session to load the updated plugin.');
  console.log('Then run /setup-sync in each project to update the plugin version.\n');
}

// ── Uninstall ──────────────────────────────────────────────────────────────────

async function doUninstall() {
  warn(`Uninstalling ${PLUGIN_NAME}...`);

  if (commandExists('claude')) {
    tryRun(`claude plugin uninstall "${PLUGIN_NAME}@${MARKETPLACE_NAME}" --scope user`, { stdio: 'ignore' });
    tryRun(`claude plugin marketplace remove ${MARKETPLACE_NAME}`, { stdio: 'ignore' });
  } else {
    warn('claude CLI not found - skipping plugin uninstall commands.');
  }

  const cleanupJs = path.join(__dirname, 'scripts', 'uninstall-cleanup.js');
  if (!fs.existsSync(cleanupJs)) {
    warn(`uninstall-cleanup.js not found — remove ${MARKETPLACE_DIR} manually.`);
    process.exit(0);
  }

  run(`node "${cleanupJs}" --plugin ${PLUGIN_NAME} --marketplace ${MARKETPLACE_NAME}`);

  let doApply = YES;
  if (!doApply) {
    const ans = await ask('  Proceed with removal? (y/N): ');
    doApply = ans.toLowerCase() === 'y';
  }

  if (!doApply) {
    warn('\nAborted - nothing removed. Re-run with --yes to remove without a prompt.\n');
    process.exit(0);
  }

  run(`node "${cleanupJs}" --plugin ${PLUGIN_NAME} --marketplace ${MARKETPLACE_NAME} --apply`);
  console.log('');
  ok('Uninstalled successfully.');
  warn('Note: If you stored AZURE_DEVOPS_PAT in .claude/settings.json, remove it manually.\n');
}

// ── Entry point ────────────────────────────────────────────────────────────────

const installedVersion = fs.existsSync(PLUGIN_DIR) ? getPluginVersion(PLUGIN_DIR) : 'not installed';
console.log(`\n========================================`);
console.log(`  ai-assisted-development  |  v${installedVersion}`);
console.log(`========================================\n`);

const main = UNINSTALL ? doUninstall : UPDATE ? doUpdate : doInstall;
main().catch(e => { err(e.message); process.exit(1); });
