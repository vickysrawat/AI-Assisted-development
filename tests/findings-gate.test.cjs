#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Extracts the canonical bash block from skills/shared/findings-gate.md and
//                      runs get_open_critical_high() / get_accepted_risk_dismissed() against a
//                      fixture ledger, asserting exactly which FP IDs each returns. Guards against
//                      the gate going silently blind (ADO-8000: awk range closed on its own heading).
// What it touches:     Reads skills/shared/findings-gate.md. Creates and destroys one temp
//                      directory under os.tmpdir(). No changes to the repo.
// What it does NOT do: No network calls. No git operations. Does not modify repo files.
// APIs / commands:     Node stdlib: fs, os, path, child_process.spawnSync('bash', ...).
// How to verify:       node tests/findings-gate.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PLUGIN_DIR = path.join(__dirname, '..');
const SPEC_MD    = path.join(PLUGIN_DIR, 'skills', 'shared', 'findings-gate.md');

let passed = 0;
let failed = 0;

// Records one assertion result and prints a pass/fail line.
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else    { failed++; console.log(`  ✗ ${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`); }
}

// Pulls the first ```bash block under "## Canonical bash functions" — the code skills copy verbatim.
function extractCanonicalBash() {
  const md = fs.readFileSync(SPEC_MD, 'utf8');
  const section = md.split('## Canonical bash functions')[1] || '';
  const match = section.match(/```bash\r?\n([\s\S]*?)```/);
  if (!match) throw new Error('canonical bash block not found in findings-gate.md');
  return match[1];
}

// Converts a Windows path to forward slashes so Git Bash can open it.
function toBashPath(p) {
  return p.split(path.sep).join('/');
}

// Ledger fixture in the ledger-schema.md format. FP-aaaaaaaab shares a prefix with FP-aaaaaaaa
// to prove the section lookup matches the exact heading, not a prefix.
const LEDGER = `# Code Review Ledger

## Open Findings

### [FP-aaaaaaaa] SQL-INJECTION — Critical
- **File**: src/a.cs
- **Status**: Open
- **Severity**: Critical

### [FP-aaaaaaaab] XSS — High
- **File**: src/a2.ts
- **Status**: needs-confirmation
- **Severity**: High

### [FP-bbbbbbbb] XSS — High
- **File**: src/b.ts
- **Status**: needs-confirmation
- **Severity**: High

### [FP-dddddddd] WEAK-HASH — Medium
- **File**: src/d.cs
- **Status**: Open
- **Severity**: Medium

### [FP-eeeeeeee] PATH-TRAVERSAL — High
- **File**: src/e.cs
- **Status**: Open
- **Severity**: High

---

## Dismissed Findings

### [FP-cccccccc] SSRF — High
- **File**: src/c.cs
- **Status**: Dismissed
- **Reason**: accepted-risk

### [FP-ffffffff] CSRF — Critical
- **File**: src/f.cs
- **Status**: Dismissed
- **Reason**: wont-fix
`;

// Runs one canonical function against a ledger and returns its FP IDs as a sorted array.
function runFn(fnName, ledgerPath) {
  const script = `${extractCanonicalBash()}\n${fnName} "$1"\n`;
  const r = spawnSync('bash', ['-c', script, 'findings-gate', toBashPath(ledgerPath)], { encoding: 'utf8' });
  if (r.error) throw r.error;
  return r.stdout.split(/\r?\n/).filter(Boolean).sort();
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'findings-gate-'));
try {
  const ledger = path.join(tmp, 'ledger.md');
  fs.writeFileSync(ledger, LEDGER);

  console.log('findings-gate.md canonical functions');
  check('get_open_critical_high returns only open Critical/High findings',
    runFn('get_open_critical_high', ledger), ['FP-aaaaaaaa', 'FP-eeeeeeee']);
  check('get_accepted_risk_dismissed returns only accepted-risk dismissals',
    runFn('get_accepted_risk_dismissed', ledger), ['FP-cccccccc']);
  check('missing ledger returns nothing',
    runFn('get_open_critical_high', path.join(tmp, 'absent.md')), []);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
