#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Asserts the legacy migration skill family is fully retired (AC-F12) and the
//                      relocation is intact: migration + migration-status deregistered from plugin.json
//                      + dirs/command files gone + skill-scenario removed; the offline-knowledge tier +
//                      freshness manifest present; the §0a retirement signpost in both CLAUDE.md files;
//                      and scripts/migration-source-detect.cjs (family dependency) preserved.
// What it touches:     Reads plugin.json, CLAUDE.md files, and checks path existence. Writes NOTHING.
// What it does NOT do: No network, no git, no mutation.
// APIs / commands:     fs, path, assert. Run: node tests/migration-retirement.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const ROOT = path.join(__dirname, '..');
const exists = p => fs.existsSync(path.join(ROOT, p));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log(`  ok  - ${n}`); } catch (e) { failed++; console.log(`  FAIL- ${n}\n        ${e.message}`); } }

test('plugin.json skills[] deregisters migration + migration-status', () => {
  assert.ok(!plugin.components.skills.includes('migration'), 'migration still in skills[]');
  assert.ok(!plugin.components.skills.includes('migration-status'), 'migration-status still in skills[]');
});
test('plugin.json commands[] deregisters migration + migration-status', () => {
  assert.ok(!plugin.components.commands.includes('migration'));
  assert.ok(!plugin.components.commands.includes('migration-status'));
});
test('legacy skill dirs removed', () => {
  assert.ok(!exists('skills/migration'), 'skills/migration/ still present');
  assert.ok(!exists('skills/migration-status'), 'skills/migration-status/ still present');
});
test('legacy command files removed (live + deploy)', () => {
  ['commands/migration.md', 'commands/migration-status.md',
   '_project-deploy/commands/migration.md', '_project-deploy/commands/migration-status.md']
    .forEach(p => assert.ok(!exists(p), `${p} still present`));
});
test('relocated offline-knowledge tier is intact', () => {
  assert.ok(exists('skills/shared/migration-knowledge/refs/mappings/java-dotnet.md'));
  assert.ok(exists('skills/shared/migration-knowledge/refs/stacks/dotnet.md'));
  assert.ok(exists('skills/shared/migration-knowledge/refs/specs/golden-master-spec.md'));
});
test('freshness manifest present + valid JSON + INFERRED', () => {
  const m = JSON.parse(read('skills/shared/migration-knowledge/freshness-manifest.json'));
  assert.strictEqual(m.authority, 'INFERRED');
  assert.ok(Array.isArray(m.refs) && m.refs.length > 0);
});
test('zero-orphan: §0a retirement signpost in both CLAUDE.md files; no legacy handler', () => {
  [read('CLAUDE.md'), read('_project-deploy/CLAUDE.md')].forEach(t => {
    assert.ok(t.includes('**RETIRED**'), 'signpost missing');
    assert.ok(t.includes('Do NOT auto-route'), 'no-auto-route line missing');
    assert.ok(!t.includes('Run migration skill for that ADO ID'), 'legacy MIGRATE handler still present');
  });
});
test('family dependency scripts/migration-source-detect.cjs preserved', () => {
  assert.ok(exists('scripts/migration-source-detect.cjs'), 'source-detect must survive retirement');
});

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
