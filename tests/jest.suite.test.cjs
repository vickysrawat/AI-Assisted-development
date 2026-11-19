'use strict';
/**
 * Jest wrapper for the plugin unit suite.
 *
 * Why a wrapper: the raw *.test.cjs files use a custom assert() + process.exit()
 * pattern. Running them directly under Jest kills the Jest process. Each file is
 * instead spawned as a child process; Jest records pass/fail per file. c8 wraps
 * the entire Jest run so NODE_V8_COVERAGE propagates to children and coverage is
 * collected across all subprocesses.
 */
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const TESTS_DIR        = __dirname;
const MIGRATION_SELF   = path.join(TESTS_DIR, 'migration-validation', 'run-selftest.cjs');
const TIMEOUT_UNIT     = 120_000;
const TIMEOUT_MIGRATION = 90_000;
// Files that drive several real end-to-end runs get more time: starting a child process can
// cost 1–2 s on a locked-down Windows machine, and setup-sync.test.cjs starts dozens (ADO-83).
const SLOW_FILES = { 'setup-sync.test.cjs': 300_000 };

// Discover raw test files — exclude this wrapper
const unitFiles = fs
  .readdirSync(TESTS_DIR)
  .filter(f => f.endsWith('.test.cjs') && f !== 'jest.suite.test.cjs')
  .sort();

function run(file, timeoutMs) {
  const result = spawnSync('node', [file], {
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env },
  });
  if (result.status !== 0) {
    const out = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`Exit ${result.status ?? 'timeout'}\n${out}`);
  }
}

describe('Unit suite', () => {
  for (const file of unitFiles) {
    const timeoutMs = SLOW_FILES[file] || TIMEOUT_UNIT;
    test(file, () => {
      run(path.join(TESTS_DIR, file), timeoutMs);
    }, timeoutMs);
  }
});

describe('Migration validators', () => {
  test('migration-validation/run-selftest.cjs', () => {
    run(MIGRATION_SELF, TIMEOUT_MIGRATION);
  }, TIMEOUT_MIGRATION);
});
