#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Verifies the /articulate-as-human contract across live command, deploy command,
//                      and skill docs: dual mode (file + direct text), --text/--file flags, path auto-detect,
//                      file-mode scan/report/safety, and text-mode chat/console output with no report/files.
// What it touches:     Reads markdown files from the repository. Writes NOTHING.
// What it does NOT do: No network, no git, no plugin state, no npm deps.
// APIs / commands:     Node fs, path, assert. Run: node tests/articulate-as-human-contract.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const READ = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const LIVE_CMD = READ('commands/articulate-as-human.md');
const DEPLOY_CMD = READ('_project-deploy/commands/articulate-as-human.md');
const SKILL = READ('skills/articulate-as-human/SKILL.md');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL- ${name}\n        ${e.message}`);
  }
}

function assertAllContains(text, required, label) {
  required.forEach((needle) => {
    assert.ok(text.includes(needle), `${label} missing: ${needle}`);
  });
}

test('live command defines direct-text mode + explicit flags', () => {
  assertAllContains(LIVE_CMD, ['direct-text mode', '--text <text>', '--file <path>'], 'commands/articulate-as-human.md');
});

test('live command defines auto mode detection and file workflow', () => {
  assertAllContains(
    LIVE_CMD,
    ['existing file or directory path', 'direct text', 'node "$PLUGIN_DIR/scripts/check-tone.cjs" <path-to-file-or-dir> [--json report.json]'],
    'commands/articulate-as-human.md'
  );
});

test('live command keeps file safety + no silent rewrite', () => {
  assertAllContains(
    LIVE_CMD,
    ['fact/name/number/citation', 'show a before/after diff', 'Never a silent full-document rewrite'],
    'commands/articulate-as-human.md'
  );
});

test('deploy command help includes dual-mode contract and examples', () => {
  assertAllContains(
    DEPLOY_CMD,
    ['<path-or-text>', '--text <text>', '--file <path>', 'chat/console', '/articulate-as-human --text'],
    '_project-deploy/commands/articulate-as-human.md'
  );
});

test('deploy command keeps file-mode safety and explicit no silent rewrite', () => {
  assertAllContains(
    DEPLOY_CMD,
    ['file:line locations', 'Never rewrites files silently', 'only on explicit request'],
    '_project-deploy/commands/articulate-as-human.md'
  );
});

test('skill defines separate text and file mode workflows', () => {
  assertAllContains(
    SKILL,
    ['## Text mode workflow', '## File mode workflow (always in this order)', 'existing file or directory path => **file mode**'],
    'skills/articulate-as-human/SKILL.md'
  );
});

test('skill text mode returns chat/console output only with no report/files', () => {
  assertAllContains(
    SKILL,
    ['Return only the humanized text by default', 'chat/console', 'Do not create files or reports'],
    'skills/articulate-as-human/SKILL.md'
  );
});

test('skill file mode keeps deterministic scan-first/report-before-rewrite flow', () => {
  assertAllContains(
    SKILL,
    ['Run the script first', 'Report before rewriting', 'Only rewrite on request'],
    'skills/articulate-as-human/SKILL.md'
  );
});

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
