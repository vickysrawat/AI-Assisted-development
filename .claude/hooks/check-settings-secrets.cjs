#!/usr/bin/env node
// hooks/check-settings-secrets.cjs — secret guard for the now-shared .claude/settings.json
//
// .claude/settings.json is committed and shared with the team (hooks, customInstructions,
// non-secret env such as model routing). Secrets — PATs, tokens, passwords — must live ONLY
// in the gitignored .claude/settings.local.json or an OS environment variable. This guard
// makes that guarantee mechanical: it blocks a secret from reaching the shared file, both at
// Claude write-time (PreToolUse) and at git commit-time (pre-commit).
//
// Modes:
//   --hook           Read a Claude Code PreToolUse JSON on stdin. If the write targets
//                    .claude/settings.json, scan the new content. Exit 2 (block, stderr shown
//                    to the model) on a secret; exit 0 otherwise or for any other file.
//   --staged         Scan the git-staged copy of .claude/settings.json. Exit 1 on a secret.
//   --file <path>    Scan the given file (or stdin when <path> is omitted). Exit 1 on a secret.
//
// Exit 0 = clean or not applicable. Override the git tier with SKIP_FINDINGS_GATE=1 (the
// pre-commit hook already honours that flag).
//
// Wiring:
//   PreToolUse (in .claude/settings.json):
//     { "matcher": "Write|Edit",
//       "hooks": [{ "type": "command",
//                   "command": "node .claude/hooks/check-settings-secrets.cjs --hook" }] }
//   pre-commit: called from findings-gate-precommit.sh via
//     node .claude/hooks/check-settings-secrets.cjs --staged

'use strict';

const fs = require('fs');
const { execSync } = require('child_process');

// ── Detection ───────────────────────────────────────────────────────────────────────
// Two independent signals: (1) a secret-shaped KEY holding a real value, and (2) a
// secret-shaped VALUE anywhere (token formats). Content may be a partial Edit fragment,
// not valid JSON, so everything is regex-based on raw text rather than JSON.parse.

// Placeholder / reference values that are NOT secrets (safe to share).
function isPlaceholder(v) {
  if (!v) return true;                                   // empty string
  const t = v.trim();
  if (t.length < 8) return true;                         // too short to be a real credential
  if (/^\$\{[^}]+\}$/.test(t)) return true;              // ${AZURE_DEVOPS_PAT} — env reference
  if (/^%[^%]+%$/.test(t)) return true;                  // %AZURE_DEVOPS_PAT% — Windows env ref
  if (/^(your|my|the)[-_ ]/i.test(t)) return true;       // your-pat-here, my_token…
  if (/^(x{3,}|\.{3,})$/i.test(t)) return true;          // xxxxxx, ......
  if (/(placeholder|changeme|change-me|example|sample|dummy|redacted|todo|tbd|none|null)/i.test(t)) return true;
  return false;
}

// Key names that imply a secret value.
const SECRET_KEY_RE =
  /^[A-Za-z0-9_\-]*(?:PAT|TOKEN|SECRET|PASSWORD|PASSWD|APIKEY|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|CONN(?:ECTION)?STRING|CLIENT[_-]?SECRET)[A-Za-z0-9_\-]*$/i;

// Value shapes that are almost certainly a live credential regardless of the key.
const SECRET_VALUE_RES = [
  { name: 'Azure DevOps PAT',        re: /\b[a-z2-7]{52}\b/ },
  { name: 'GitHub PAT (classic)',    re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub PAT (fine-grained)', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'AWS access key id',       re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token',             re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'JWT',                     re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { name: 'Private key block',       re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

// Scan raw text; return an array of human-readable hit descriptions.
function scanText(text) {
  const hits = [];
  if (!text) return hits;

  // (1) secret-shaped "key": "value" pairs (JSON string values only)
  const kvRe = /"([A-Za-z0-9_\-]+)"\s*:\s*"([^"]*)"/g;
  let m;
  while ((m = kvRe.exec(text)) !== null) {
    const [, key, val] = m;
    if (SECRET_KEY_RE.test(key) && !isPlaceholder(val)) {
      hits.push(`key "${key}" holds a non-placeholder value`);
    }
  }

  // (2) secret-shaped values anywhere in the text
  for (const { name, re } of SECRET_VALUE_RES) {
    if (re.test(text)) hits.push(`looks like a ${name}`);
  }

  return [...new Set(hits)];
}

// ── Reporting ───────────────────────────────────────────────────────────────────────

function report(hits, where) {
  console.error('❌ settings-secret-guard: a secret must not be committed to ' + where + '.');
  for (const h of hits) console.error('   • ' + h);
  console.error('');
  console.error('   Move it to .claude/settings.local.json (gitignored) or set an OS env var');
  console.error('   (e.g. AZURE_DEVOPS_PAT). Claude Code merges settings.local.json over');
  console.error('   settings.json at runtime, so nothing is lost by keeping the shared file');
  console.error('   secret-free.');
}

function isSettingsJson(p) {
  return /(^|[\\/])\.claude[\\/]settings\.json$/.test(String(p).replace(/\\/g, '/'));
}

// ── Modes ─────────────────────────────────────────────────────────────────────────────

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

function runHook() {
  const raw = readStdin();
  let input;
  try { input = JSON.parse(raw); } catch (e) { return 0; }   // not parseable → allow
  const ti = input.tool_input || {};
  if (!isSettingsJson(ti.file_path || '')) return 0;         // not our file → allow
  const parts = [];
  if (typeof ti.content === 'string')    parts.push(ti.content);      // Write
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);   // Edit
  if (Array.isArray(ti.edits)) for (const e of ti.edits) {            // MultiEdit
    if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  }
  const hits = scanText(parts.join('\n'));
  if (hits.length) { report(hits, '.claude/settings.json'); return 2; }
  return 0;
}

function runStaged() {
  let text;
  try {
    // The staged blob, not the working tree — this is what would actually be committed.
    text = execSync('git show :.claude/settings.json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return 0;   // not staged (or not a git repo) → nothing to guard
  }
  const hits = scanText(text);
  if (hits.length) { report(hits, 'the staged .claude/settings.json'); return 1; }
  return 0;
}

function runFile(p) {
  const text = p ? (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '') : readStdin();
  const hits = scanText(text);
  if (hits.length) { report(hits, p || 'stdin'); return 1; }
  return 0;
}

// ── Entry ───────────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--hook'))   return runHook();
  if (argv.includes('--staged')) return runStaged();
  const fi = argv.indexOf('--file');
  if (fi !== -1) return runFile(argv[fi + 1]);
  console.error('usage: check-settings-secrets.cjs --hook | --staged | --file <path>');
  return 0;
}

process.exit(main());
