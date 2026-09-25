'use strict';
// scripts/validate-governance.cjs — target-project governance enforcement
//
// Two gates run in sequence on every staged file:
//   Gate 1 — ICEA gate      : source code requires approved ICEA + audit trail
//   Gate 2 — Security gate  : config files get secret scan + audit entry
//
// Called by:
//   _project-deploy/hooks/governance-gate-precommit.cjs  (pre-commit, all tools)
//   _project-deploy/ci/icea-gate.yml                     (CI pipeline, PR gate)
//
// Exit codes: 0 = pass · 1 = blocked
// Environment: NODE_GOVERNANCE_MODE=ci disables TTY-interactive output

const fs            = require('fs');
const path          = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// File category maps
// ---------------------------------------------------------------------------
const CATEGORIES = {
  env:         [/^\.env$/, /^\.env\./, /\.env\.\w+$/],
  source:      [/\.(cs|ts|tsx|js|cjs|mjs|py|java|vb|cpp|c|h|go|rs|rb|php|swift|kt|fs|scala)$/i],
  appConfig:   [/appsettings(\.\w+)?\.json$/i, /web\.config$/i, /app\.config$/i, /application\.(yml|yaml|properties)$/i],
  cicd:        [/azure-pipelines.*\.ya?ml$/i, /\.github[/\\]workflows[/\\].+\.ya?ml$/i, /^Jenkinsfile$/, /\.circleci[/\\]config\.ya?ml$/i],
  iac:         [/\.(tf|tfvars|bicep)$/i, /\.arm\.json$/i, /cloudformation.*\.ya?ml$/i, /serverless\.ya?ml$/i],
  buildTooling:[/^package\.json$/, /\.(csproj|vbproj|fsproj|sln)$/i, /tsconfig.*\.json$/i, /^pom\.xml$/, /\.gradle$/i, /^Makefile$/],
  docs:        [/\.(md|txt|rst|docx|pdf)$/i],
};

function categorize(filePath) {
  const base = path.basename(filePath);
  const norm = filePath.replace(/\\/g, '/');
  for (const [cat, patterns] of Object.entries(CATEGORIES)) {
    if (patterns.some(p => p.test(base) || p.test(norm))) return cat;
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------
function git(...args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

function getStagedFiles() {
  const r = git('diff', '--cached', '--name-only', '--diff-filter=ACMRT');
  return r.status === 0 ? r.stdout.trim().split('\n').filter(Boolean) : [];
}

function getBranch() {
  const r = git('rev-parse', '--abbrev-ref', 'HEAD');
  return r.status === 0 ? r.stdout.trim() : '';
}

function extractAdoIds(str) {
  const matches = str.match(/(?:ADO[-#\s]?|\/ADO-)(\d{3,6})/gi) || [];
  return [...new Set(matches.map(m => m.replace(/\D/g, '')))];
}

function getAdoIds(branch) {
  const ids = new Set(extractAdoIds(branch));
  const log = git('log', '--format=%s %b', '-20');
  if (log.status === 0) extractAdoIds(log.stdout).forEach(id => ids.add(id));
  return [...ids];
}

function isGitIgnored(filePath) {
  return git('check-ignore', '-q', filePath).status === 0;
}

// ---------------------------------------------------------------------------
// ICEA lookup (pure Node.js — cross-platform)
// ---------------------------------------------------------------------------
function walkDocs(dir, pattern, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDocs(full, pattern, results);
    else if (pattern.test(entry.name)) results.push(full);
  }
  return results;
}

function findApprovedIcea(adoId) {
  const files = walkDocs('docs', new RegExp(`ADO-${adoId}-.*\\.icea\\.md$`));
  return files.find(f => fs.readFileSync(f, 'utf8').includes('Status: ✅ Approved')) || null;
}

function hasAuditTrail(iceaPath) {
  const dir = path.dirname(iceaPath);
  return fs.existsSync(dir) && fs.readdirSync(dir).some(f => f.includes('ai-audit.md'));
}

// ---------------------------------------------------------------------------
// Secret scan patterns
// ---------------------------------------------------------------------------
const SECRET_PATTERNS = [
  { re: /(?:password|passwd|pwd)\s*=\s*(?!["']?\s*(?:\{\{|<|\*{3,}|your[-_]|xxx|placeholder|changeme))[^\s;,'"]{4,}/i,    label: 'hardcoded password' },
  { re: /api[_-]?(?:key|secret|token)\s*[:=]\s*['"]?(?!\{\{|<|\*{3,}|your|xxx)[A-Za-z0-9_\-]{10,}/i,                      label: 'API key/secret' },
  { re: /AKIA[0-9A-Z]{16}/,                                                                                                  label: 'AWS access key ID' },
  { re: /sk-[A-Za-z0-9]{32,}/,                                                                                               label: 'OpenAI/Anthropic key' },
  { re: /https?:\/\/[^:@\s]{1,64}:[^@\s]{1,64}@/,                                                                           label: 'URL with embedded credentials' },
  { re: /AccountKey=[A-Za-z0-9+/=]{40,}/,                                                                                    label: 'Azure storage account key' },
  { re: /(?:connection.?string|connstr)\s*=.*(?:password|pwd)=[^;'"]{4,}/i,                                                  label: 'connection string with password' },
];

function scanForSecrets(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return SECRET_PATTERNS.filter(({ re }) => re.test(content)).map(({ label }) => label);
}

// ---------------------------------------------------------------------------
// Audit (best-effort — never blocks commit)
// ---------------------------------------------------------------------------
function audit(evt) {
  try {
    const hookPath = path.join('.claude', 'hooks', 'audit-append.cjs');
    if (fs.existsSync(hookPath)) require(path.resolve(hookPath)).appendEvent(evt);
  } catch (_) {}
}

// auditWrite — per-event JSON file via scripts/audit-write.cjs (Item 6).
// Resolves plugin dir from .claude/plugin-path.txt; silently no-ops if absent.
function auditWrite(event, { adoId, verdict, context: ctx } = {}) {
  try {
    const pluginDir = fs.readFileSync(
      path.join(process.cwd(), '.claude', 'plugin-path.txt'), 'utf8').trim();
    const script = path.join(pluginDir, 'scripts', 'audit-write.cjs');
    if (!fs.existsSync(script)) return;
    const args = [script, '--event', event];
    if (adoId)   args.push('--ado-id',  adoId);
    if (verdict) args.push('--verdict', verdict);
    if (ctx)     args.push('--context', ctx);
    spawnSync(process.execPath, args, { stdio: 'ignore', timeout: 5000 });
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const staged = getStagedFiles();
  if (!staged.length) process.exit(0);

  const branch    = getBranch();
  const branchType = /^hotfix\//i.test(branch)  ? 'hotfix'
                   : /^bugfix\//i.test(branch)   ? 'bugfix'
                   : /^feature\//i.test(branch)  ? 'feature'
                   : 'other';

  const errors   = [];
  const warnings = [];
  let highRiskConfig = false;

  for (const file of staged) {
    const cat = categorize(file);

    // --- DOCS: no gate ---
    if (cat === 'docs') continue;

    // --- ENV FILES: hard-block if not gitignored ---
    if (cat === 'env') {
      if (!isGitIgnored(file)) {
        errors.push(
          `🔴 ENV FILE COMMITTED: ${file}\n` +
          `   Env files must be in .gitignore and never committed.\n` +
          `   Add to .gitignore: echo "${file}" >> .gitignore`
        );
        audit({ event: 'gate.block', action: 'env-committed', result: 'blocked', source: 'governance-gate', detail: file });
      }
      continue;
    }

    // --- SOURCE CODE: ICEA gate ---
    if (cat === 'source') {
      if (branchType === 'hotfix') {
        warnings.push(`⚠  HOT-FIX: ICEA gate skipped for ${file} (bypass logged)`);
        audit({ event: 'gate.bypass', action: 'icea-gate', result: 'hotfix-exempt', source: 'governance-gate', detail: `${branch}: ${file}` });
        auditWrite('BYPASS_HOTFIX', { verdict: 'hotfix-exempt', context: `${branch}: ${file}` });
        continue;
      }

      const adoIds = getAdoIds(branch);
      if (!adoIds.length) {
        errors.push(
          `🔴 NO ADO ID in branch/commits for: ${file}\n` +
          `   Branch must include ADO-{ID} (e.g. feature/ADO-1234-my-feature).`
        );
        audit({ event: 'gate.block', action: 'icea-gate', result: 'no-ado-id', source: 'governance-gate', detail: file });
        continue;
      }

      for (const adoId of adoIds) {
        const iceaPath = findApprovedIcea(adoId);
        if (!iceaPath) {
          const msg = branchType === 'bugfix'
            ? `🔴 NO BUG ICEA: ADO-${adoId}\n   bugfix/ branches require a lightweight bug ICEA (Status: ✅ Approved).`
            : `🔴 NO APPROVED ICEA: ADO-${adoId}\n   Run: SAVE PLAN ADO-${adoId} → SAVE ICEA → APPROVE ADO-${adoId}`;
          errors.push(msg);
          audit({ event: 'gate.block', action: 'icea-gate', result: 'no-approved-icea', source: 'governance-gate', detail: `ADO-${adoId}` });
        } else if (!hasAuditTrail(iceaPath)) {
          warnings.push(`⚠  ADO-${adoId}: ICEA approved but ai-audit.md missing — ICEA may not have used the plugin flow.`);
        }
      }
      continue;
    }

    // --- CONFIG: secret scan + audit entry ---
    const secrets = scanForSecrets(file);
    if (secrets.length) {
      errors.push(`🔴 SECRET DETECTED in ${file}: ${secrets.join(', ')}\n   Remove credentials before committing.`);
      audit({ event: 'gate.block', action: 'secret-scan', result: 'blocked', source: 'governance-gate', detail: `${file}: ${secrets.join(', ')}` });
      continue;
    }

    audit({ event: 'config.change', action: 'audit-entry', result: 'logged', source: 'governance-gate', detail: file });

    if (cat === 'cicd' || cat === 'iac') {
      highRiskConfig = true;
      warnings.push(`⚠  HIGH-RISK CONFIG (${cat}): ${file} — audit entry written. Ensure this change has been peer-reviewed.`);
    }
  }

  if (warnings.length) {
    process.stderr.write('\n');
    warnings.forEach(w => process.stderr.write(w + '\n'));
  }

  if (errors.length) {
    process.stderr.write('\n❌ COMMIT BLOCKED — resolve the following before committing:\n');
    errors.forEach(e => process.stderr.write('\n' + e + '\n'));
    process.stderr.write('\nFor hotfix branches: rename to hotfix/ADO-{ID}-* to skip the ICEA gate (bypass is audited).\n\n');
    process.exit(1);
  }

  process.exit(0);
}

main();
