#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Reads every .md file from {PLUGIN_DIR}/.claude/commands/,
//                      compares content to the matching file in {cwd}/.claude/commands/,
//                      overwrites files with differing content, creates files absent from
//                      the target. Reports updated / added / kept counts and exits.
// What it touches:     .claude/commands/*.md in the current working directory.
//                      Creates .claude/commands/ if missing. Never modifies source files.
// What it does NOT do: Never deletes target files absent from the plugin source (kept as-is).
//                      No changes to hooks, rules, state, CLAUDE.md, .gitignore.
//                      No network calls, no git operations.
// APIs / commands:     Node.js fs (readFileSync, writeFileSync, readdirSync, mkdirSync,
//                      existsSync) and path. No child_process.
// How to verify:       Output shows Updated (N), Added (N), Kept (N, target-only) counts.
//                      Inspect .claude/commands/ in the target to confirm files match plugin.

// scripts/deploy-commands.cjs
// Deterministic deployment of plugin command stubs to the current target project.
//
// Usage (called by skills/setup-sync/SKILL.md --commands branch, or run directly):
//   node deploy-commands.cjs
//
// Copies every .md file from {PLUGIN_DIR}/.claude/commands/ to
// {cwd}/.claude/commands/, overwriting changed files and adding new ones.
// Files present in the target but absent from the plugin are never deleted.
// Exits 0 on success, 1 on any write error.

'use strict';

const fs   = require('fs');
const path = require('path');

const PLUGIN_DIR   = path.resolve(__dirname, '..');
const PROJECT_ROOT = process.cwd();

const SOURCE = path.join(PLUGIN_DIR, '_project-deploy', 'commands');
const TARGET = path.join(PROJECT_ROOT, '.claude', 'commands');
const BAR    = '━'.repeat(40);

if (!fs.existsSync(SOURCE)) {
  console.error('ERROR: Plugin commands directory not found: ' + SOURCE);
  process.exit(1);
}

try {
  fs.mkdirSync(TARGET, { recursive: true });
} catch (e) {
  console.error('ERROR: Cannot create target directory ' + TARGET + ': ' + e.message);
  process.exit(1);
}

const sourceFiles = new Set(
  fs.readdirSync(SOURCE).filter(f => f.endsWith('.md'))
);
const targetFiles = new Set(
  fs.readdirSync(TARGET).filter(f => f.endsWith('.md'))
);

const counts = { updated: [], added: [], kept: [] };
let errors = 0;

for (const file of Array.from(sourceFiles).sort()) {
  const srcPath = path.join(SOURCE, file);
  const dstPath = path.join(TARGET, file);

  let srcContent;
  try { srcContent = fs.readFileSync(srcPath, 'utf8'); } catch (e) {
    console.error('  ✗ error reading source ' + file + ': ' + e.message);
    errors++;
    continue;
  }

  if (targetFiles.has(file)) {
    let dstContent = '';
    try { dstContent = fs.readFileSync(dstPath, 'utf8'); } catch (_) {}
    if (srcContent === dstContent) continue; // identical — silent skip
    try {
      fs.writeFileSync(dstPath, srcContent, 'utf8');
      counts.updated.push(file);
    } catch (e) {
      console.error('  ✗ error updating ' + file + ': ' + e.message);
      errors++;
    }
  } else {
    try {
      fs.writeFileSync(dstPath, srcContent, 'utf8');
      counts.added.push(file);
    } catch (e) {
      console.error('  ✗ error adding ' + file + ': ' + e.message);
      errors++;
    }
  }
}

for (const file of Array.from(targetFiles).sort()) {
  if (!sourceFiles.has(file)) counts.kept.push(file);
}

const deployed = counts.updated.length + counts.added.length;
console.log('\n📋 deploy-commands — ' + deployed + ' file(s) deployed');
console.log(BAR);
if (counts.updated.length) console.log('  Updated (' + counts.updated.length + '): ' + counts.updated.join(', '));
if (counts.added.length)   console.log('  Added   (' + counts.added.length   + '): ' + counts.added.join(', '));
if (counts.kept.length)    console.log('  Kept    (' + counts.kept.length    + ', target-only): ' + counts.kept.join(', '));
if (!deployed && !counts.kept.length) console.log('  All command files up to date.');
console.log(BAR);

if (errors > 0) {
  console.error('  ' + errors + ' error(s) — see messages above');
  process.exit(1);
}
