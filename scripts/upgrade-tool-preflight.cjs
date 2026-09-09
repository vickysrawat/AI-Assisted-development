#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Upgrade-skill tool-availability preflight. For a given stack it identifies
//                      the deterministic upgrade tool, PROBES whether it is installed at a
//                      compatible version (a read-only `--version` query), and classifies the
//                      result as available | outdated | needs-install | unknown-stack. When the
//                      tool is missing/outdated it PRINTS copy-pasteable install + verify steps for
//                      the current OS. Prints JSON (--json) or a human summary.
// What it touches:     Runs one read-only version query (execFileSync of the tool's --version).
//                      Reads process.argv + process.platform. Writes NOTHING; edits nothing.
// What it does NOT do: NEVER installs anything, NEVER runs the install commands it prints, no
//                      network, no git, no LLM, no project mutation. Bundles no tool binaries.
// APIs / commands:     Node stdlib: child_process.execFileSync (version probe only). Exit codes
//                      ARE the contract: 0=available · 2=outdated · 3=needs-install · 4=unknown-stack.
// How to verify:       node scripts/upgrade-tool-preflight.cjs --stack=nodejs --probe-bin=node --probe-args=--version --min=0 --json
//                      -> {"status":"available",...}   (node stands in as a present tool)
//                      node tests/upgrade-tool-preflight.test.cjs  -> "N passed · 0 failed".

'use strict';
const { execFileSync } = require('child_process');

// ── Args ────────────────────────────────────────────────────────────────────
const JSON_OUT = process.argv.includes('--json');
const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const STACK = (arg('stack') || '').trim().toLowerCase();

// ── Tool table (design of record: docs/plans/migrationSkill/upgrade.md tool-coverage) ──
// Per stack: the deterministic tool, how to probe it (read-only), the minimum acceptable major
// version, and per-OS install + verify steps. Steps are PRINTED for the developer to run — the
// skill never runs them (LLM authors, human executes).
const TOOL_TABLE = {
  dotnet: {
    tool: 'dotnet upgrade-assistant', probeBin: 'dotnet', probeArgs: ['--version'], min: 6,
    install: {
      windows: 'winget install Microsoft.DotNet.SDK.8 ; dotnet tool install -g upgrade-assistant',
      macos:   'brew install --cask dotnet-sdk ; dotnet tool install -g upgrade-assistant',
      linux:   'sudo apt-get install -y dotnet-sdk-8.0 ; dotnet tool install -g upgrade-assistant',
      verify:  'dotnet tool list -g | grep upgrade-assistant',
    },
  },
  angular: {
    tool: 'ng update (Angular CLI)', probeBin: 'ng', probeArgs: ['version'], min: 15,
    install: {
      windows: 'npm install -g @angular/cli', macos: 'npm install -g @angular/cli',
      linux: 'npm install -g @angular/cli', verify: 'ng version',
    },
  },
  java: {
    tool: 'OpenRewrite (via Maven)', probeBin: 'mvn', probeArgs: ['--version'], min: 3,
    install: {
      windows: 'choco install maven', macos: 'brew install maven',
      linux: 'sudo apt-get install -y maven',
      verify: 'mvn --version   # then: mvn org.openrewrite.maven:rewrite-maven-plugin:dryRun',
    },
  },
  python: {
    tool: 'pyupgrade', probeBin: 'pyupgrade', probeArgs: ['--version'], min: 3,
    install: {
      windows: 'pipx install pyupgrade', macos: 'pipx install pyupgrade',
      linux: 'pipx install pyupgrade', verify: 'pyupgrade --version',
    },
  },
  nodejs: {
    tool: 'npm-check-updates', probeBin: 'ncu', probeArgs: ['--version'], min: 16,
    install: {
      windows: 'npm install -g npm-check-updates', macos: 'npm install -g npm-check-updates',
      linux: 'npm install -g npm-check-updates', verify: 'ncu --version',
    },
  },
  react: {
    tool: 'npm-check-updates + jscodeshift', probeBin: 'ncu', probeArgs: ['--version'], min: 16,
    install: {
      windows: 'npm install -g npm-check-updates jscodeshift',
      macos: 'npm install -g npm-check-updates jscodeshift',
      linux: 'npm install -g npm-check-updates jscodeshift', verify: 'ncu --version',
    },
  },
};

// ── OS ──────────────────────────────────────────────────────────────────────
function osKey() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

// ── Version helpers ───────────────────────────────────────────────────────────
const firstVersion = (s) => { const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(s || ''); return m ? m[0] : null; };
const majorOf = (v) => { const m = /^(\d+)/.exec(v || ''); return m ? Number(m[1]) : NaN; };

// ── Impure probe (read-only version query) ────────────────────────────────────
function probe(bin, args) {
  try {
    const out = execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
    return { found: true, version: firstVersion(out) };
  } catch (_) {
    return { found: false, version: null }; // ENOENT or non-zero exit → treat as not usable
  }
}

// ── Pure evaluation (unit-tested directly) ─────────────────────────────────────
// DECISION: how to classify a probe result
// Options considered:
//   A) present/absent only — rejected: an installed-but-too-old tool would be reported "available"
//      and then fail mid-upgrade
//   B) present + version-floor (available/outdated/needs-install) — chosen: matches the honest
//      "check + guide" feature; outdated is distinct from missing so guidance differs
function evaluate({ found, version, min }) {
  if (!found) return 'needs-install';
  const major = majorOf(version);
  if (Number.isFinite(min) && Number.isFinite(major) && major < min) return 'outdated';
  return 'available';
}

// ── Main ───────────────────────────────────────────────────────────────────────
const EXIT = { available: 0, outdated: 2, 'needs-install': 3, 'unknown-stack': 4 };

function main() {
  const spec = TOOL_TABLE[STACK];
  if (!spec) {
    return { stack: STACK || null, status: 'unknown-stack',
             reason: `No deterministic upgrade tool mapped for '${STACK}'`, supported: Object.keys(TOOL_TABLE) };
  }

  // Test/override seams — let the caller force a probe target + floor deterministically.
  const bin  = arg('probe-bin')  || spec.probeBin;
  const args = arg('probe-args') ? arg('probe-args').split(',') : spec.probeArgs;
  const min  = arg('min') !== undefined ? Number(arg('min')) : spec.min;

  const p = probe(bin, args);
  const status = evaluate({ found: p.found, version: p.version, min });
  const result = { stack: STACK, tool: spec.tool, status, version: p.version, min };
  if (status !== 'available') {
    const os = osKey();
    result.install = { os, command: spec.install[os], verify: spec.install.verify };
    result.note = 'Author-only: run these yourself — the skill never installs tools (LLM authors, human executes).';
  }
  return result;
}

// Exports are assigned unconditionally so `require()` can unit-test the pure logic without
// running the CLI or calling process.exit (which would kill the requiring process).
module.exports = { evaluate, probe, TOOL_TABLE };

if (require.main === module) {
  const result = main();
  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    const lines = [`stack: ${result.stack}`, `status: ${result.status}`];
    if (result.tool) lines.push(`tool: ${result.tool}`);
    if (result.version) lines.push(`detected: ${result.version} (min ${result.min})`);
    if (result.supported) lines.push(`supported: ${result.supported.join(', ')}`);
    if (result.install) {
      lines.push('', `install (${result.install.os}) — run this yourself:`, `  ${result.install.command}`,
                 `verify:`, `  ${result.install.verify}`, '', result.note);
    }
    process.stdout.write(lines.join('\n') + '\n');
  }
  process.exit(EXIT[result.status] ?? 4);
}
