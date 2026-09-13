#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Asserts the migration-knowledge tier is free of retired-skill tokens, has no
//                      dead sibling-spec links, and that the new design-phase specs all exist.
//                      This is the automated form of the grep-for-zero-hits de-coupling check.
// What it touches:     READ-ONLY. Reads every .md under skills/shared/migration-knowledge/. Writes nothing.
// What it does NOT do: No network, no git, no mutation, no LLM.
// APIs / commands:     fs, path. Run: node tests/migration-specs.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass, 1 on any failure.

'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TIER = path.join(ROOT, 'skills', 'shared', 'migration-knowledge');
const SPECS = path.join(TIER, 'refs', 'specs');

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log(`  ok  - ${n}`); } catch (e) { failed++; console.log(`  FAIL- ${n}\n        ${e.message}`); } }

// Recursively collect all .md files under a directory
function mdFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...mdFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// ── Retired-token ban-list ──────────────────────────────────────────────────
// These are the retired 9-stage migration skill's tokens. NONE may appear in the
// migration-knowledge tier. Exact strings — NOT substrings that legitimately occur
// (e.g. "Step 6" and "§2" are fine; "Stage 6" and "§13" are banned).
// NOTE: integration-verification-spec is NOT banned — it is a real file this session.
// 'Stage 6' also catches the retired 'Stage 6.1'/'Stage 6.2' as substrings.
// Generic step numbers (Step 6.5 etc.) are NOT banned — they occur legitimately
// (e.g. golden-master-runbook Step 6.5). Only distinctive retired tokens are banned.
const BANNED = [
  'Stage 0.5', 'Stage 0.6', 'Stage 5.0', 'Stage 6',
  'MIGRATION COMPLETE', 'APPROVE INVENTORY', '§13',
  'stage_gates', 'Step 2.0b',
  'source-inventory', 'Source Behavioral Inventory',
];

test('no retired tokens anywhere in the migration-knowledge tier', () => {
  const files = mdFiles(TIER);
  const hits = [];
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const token of BANNED) {
        if (line.includes(token)) {
          hits.push(`${path.relative(ROOT, f)}:${i + 1}  «${token}»  ${line.trim().slice(0, 80)}`);
        }
      }
    });
  }
  if (hits.length) throw new Error(`retired tokens found:\n        ${hits.join('\n        ')}`);
});

// ── Dead sibling-spec links ─────────────────────────────────────────────────
// Every markdown link to a same-directory .md (no slash in target) must resolve
// to an existing file in the specs folder. This is the check that would have
// caught the old dead integration-verification-spec.md link.
test('no dead sibling-spec links in the specs folder', () => {
  const files = mdFiles(SPECS);
  // Matches both same-dir links `](x.md)` and specs-prefixed links `](specs/x.md)`
  const linkRe = /\]\((?:specs\/)?([a-z0-9-]+\.md)(?:#[^)]*)?\)/gi;
  const dead = [];
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = linkRe.exec(content)) !== null) {
      const target = m[1];
      if (!fs.existsSync(path.join(SPECS, target))) {
        dead.push(`${path.relative(ROOT, f)} → ${target} (missing)`);
      }
    }
  }
  if (dead.length) throw new Error(`dead links:\n        ${dead.join('\n        ')}`);
});

// ── Expected design-phase specs exist ───────────────────────────────────────
test('all new design-phase specs exist', () => {
  const expected = [
    'target-design-spec.md',
    'integration-verification-spec.md',
    'design-revision-spec.md',
    'document-orchestrator.md',
    'document-feedback.md',
    'document-graph-derive.md',
    'option-change-spec.md',
    'options-insight-spec.md',
    'migration-log-spec.md',
  ];
  const missing = expected.filter(f => !fs.existsSync(path.join(SPECS, f)));
  if (missing.length) throw new Error(`missing specs: ${missing.join(', ')}`);
});

// ── integration-verification-spec.md is real (formerly a dead link) ─────────
test('integration-verification-spec.md exists (formerly dead link, now real)', () => {
  if (!fs.existsSync(path.join(SPECS, 'integration-verification-spec.md')))
    throw new Error('integration-verification-spec.md must exist — it is referenced as a live link');
});

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
