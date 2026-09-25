#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Resolves a target execution profile (strategies/{target}.md) for a migration
//                      skill's generate/verify phase. Verifies the profile exists, is STATUS:
//                      implemented, and defines the required token contract. Surfaces the profile's
//                      role + unverified maturity flag so the skill can warn the developer.
// What it touches:     READ-ONLY. Reads the one profile file. Writes nothing.
// What it does NOT do: No LLM, no network, no git, no inference, no fallback to another stack.
// APIs / commands:     Node fs, path. Run: node scripts/strategy-resolve.cjs --target=dotnet --json
//                      Subset consumers (e.g. Replatform verify-only): --tokens=BUILD,TEST_ALL,SERVE,E2E
// How to verify:       exit 0 implemented+complete · 2 malformed (missing token, blank body,
//                      or unfilled placeholder in body) · 3 not-implemented · 4 missing profile file.

'use strict';
const fs   = require('fs');
const path = require('path');

// The full token contract every profile must define (strategies/README.md § The contract).
const FULL_CONTRACT = [
  'STACK', 'SKELETON', 'STANDARDS_EXAMPLE', 'BUILD', 'TEST_CLUSTER', 'TEST_ALL',
  'TEST_FRAMEWORK', 'COVERAGE', 'LAYOUT', 'COMPOSITION', 'CONFIG', 'BUILD_UNIT',
  'RULES', 'PKG_ADD', 'SERVE', 'E2E', 'FITNESS',
];

function parseArgs(argv) {
  const a = { json: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--json') a.json = true;
    else if (t.startsWith('--target=')) a.target = t.slice('--target='.length).trim();
    else if (t.startsWith('--strategies-dir=')) a.dir = t.slice('--strategies-dir='.length);
    else if (t.startsWith('--tokens=')) a.tokens = t.slice('--tokens='.length);
  }
  return a;
}

// Read a "KEY: value" header line (matched at column 0), else null.
function headerValue(content, key) {
  const m = content.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

// A profile declares a token as a "## TOKEN" heading.
function hasToken(content, token) {
  return new RegExp(`^##\\s+${token}\\b`, 'm').test(content);
}

// Extract the text body of a "## TOKEN" section (content between heading and next ##).
function tokenBody(content, token) {
  const sections = content.split(/\n(?=##\s)/);
  for (const section of sections) {
    if (new RegExp(`^##\\s+${token}\\b`).test(section)) {
      return section.replace(/^##[^\n]*\n?/, '');
    }
  }
  return '';
}

function emit(json, obj, humanLines) {
  if (json) console.log(JSON.stringify(obj, null, 2));
  else humanLines.forEach(l => console.log(l));
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.target) {
    console.error('Usage: strategy-resolve.cjs --target=<token> [--tokens=A,B,...] [--strategies-dir=<path>] [--json]');
    process.exit(2);
  }

  const dir = args.dir || path.join(
    __dirname, '..', 'skills', 'shared', 'migration-knowledge', 'refs', 'strategies');
  const profilePath = path.join(dir, `${args.target}.md`);

  // exit 4 — no profile for this target (honest refusal; never fall back to another stack).
  if (!fs.existsSync(profilePath)) {
    emit(args.json,
      { target: args.target, resolved: false, reason: 'missing', profile_path: profilePath },
      [`❌ No execution profile for target "${args.target}" (looked for ${profilePath}).`,
       '   The skill STOPs — it never falls back to another stack\'s toolchain.']);
    process.exit(4);
  }

  const content = fs.readFileSync(profilePath, 'utf8');
  const status  = headerValue(content, 'STATUS');
  const role    = headerValue(content, 'ROLE');
  const maturity = headerValue(content, 'MATURITY');

  // exit 3 — present but not runnable (not-implemented / profile-ready / absent STATUS).
  if (status !== 'implemented') {
    emit(args.json,
      { target: args.target, resolved: false, reason: 'not-implemented',
        status: status || null, profile_path: profilePath },
      [`❌ Profile "${args.target}" is not runnable (STATUS: ${status || 'absent'}).`,
       '   Only STATUS: implemented profiles run; the skill STOPs.']);
    process.exit(3);
  }

  // Token contract — full by default, or a caller-supplied subset (e.g. Replatform verify-only).
  const required = args.tokens
    ? args.tokens.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : FULL_CONTRACT;
  const missing = required.filter(tok => !hasToken(content, tok));

  // exit 2 — implemented but the required token contract is incomplete (malformed profile).
  if (missing.length > 0) {
    emit(args.json,
      { target: args.target, resolved: false, reason: 'incomplete',
        missing_tokens: missing, profile_path: profilePath },
      [`❌ Profile "${args.target}" is STATUS: implemented but missing required tokens:`,
       `   ${missing.join(', ')}`,
       '   The profile is malformed; the skill STOPs.']);
    process.exit(2);
  }

  // A8: validate token bodies — empty body or unsubstituted placeholder both exit 2.
  // Lookbehind excludes shell ${VAR} expansions; matches {BUILD}, {build}, {Build}, etc.
  const PLACEHOLDER_RE = /(?<!\$)\{[A-Za-z][A-Za-z0-9_]*\}/g;
  const emptyBodies = [];
  const unfilledPlaceholders = {};
  for (const tok of required) {
    const body = tokenBody(content, tok).trim();
    if (!body) {
      emptyBodies.push(tok);
    } else {
      const matches = body.match(PLACEHOLDER_RE);
      if (matches) unfilledPlaceholders[tok] = [...new Set(matches)];
    }
  }
  if (emptyBodies.length > 0 || Object.keys(unfilledPlaceholders).length > 0) {
    emit(args.json,
      { target: args.target, resolved: false, reason: 'incomplete-bodies',
        empty_tokens: emptyBodies,
        unfilled_placeholders: unfilledPlaceholders,
        profile_path: profilePath },
      [`❌ Profile "${args.target}" has incomplete token bodies:`,
       emptyBodies.length ? `   Empty bodies (blank sections): ${emptyBodies.join(', ')}` : null,
       Object.keys(unfilledPlaceholders).length
         ? `   Unfilled placeholders: ${JSON.stringify(unfilledPlaceholders)}` : null,
       `   Open the profile at ${profilePath}, complete each listed section, then re-run.`,
      ].filter(Boolean));
    process.exit(2);
  }

  // exit 0 — resolved. unverified surfaces the ⚠ MATURITY flag so the skill can warn the developer.
  const unverified = !!(maturity && maturity.includes('⚠'));
  emit(args.json,
    { target: args.target, resolved: true, status, role: role || null,
      unverified, maturity: maturity || null,
      tokens_required: required, profile_path: profilePath },
    [`✅ Resolved execution profile "${args.target}" (${role || 'role unset'}).`,
     unverified ? `   ⚠ Unverified end-to-end — warn the developer before relying on it.` : '   Verified profile.',
     `   ${required.length} required tokens present.`]);
  process.exit(0);
}

main();
