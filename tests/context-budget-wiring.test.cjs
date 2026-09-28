#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:    Validates that every step declared in .claude-plugin/context-budgets.json
//                  has a matching active-task.json write instruction in the corresponding
//                  SKILL.md file. Also validates that non-migration skills include a
//                  resume_cmd field in their active-task.json writes (migration skills use
//                  the default {SKILL} RESUME ADO-{ID} pattern; ICEA skills do not).
// What it touches: Reads .claude-plugin/context-budgets.json and skills/*/SKILL.md.
//                  Writes nothing. No network, no git, no disk mutation.
// What it does NOT do: NO network, NO git, NO disk writes, NO process spawning.
// APIs / commands: fs.readFileSync, String.prototype.matchAll (regex scan only).
// How to verify:   node tests/context-budget-wiring.test.cjs  ->  "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

// Maps budget skill key → relative path to SKILL.md
const SKILL_PATHS = {
  'rewrite':        'skills/rewrite/SKILL.md',
  'upgrade':        'skills/upgrade/SKILL.md',
  'replatform':     'skills/replatform/SKILL.md',
  'icea-implement': 'skills/icea-implement/SKILL.md',
  'icea-feature':   'skills/icea-feature/SKILL.md',
};

// Migration skills use the default {SKILL} RESUME ADO-{ID} pattern — no resume_cmd needed.
// All other skills must include resume_cmd in every active-task.json write.
const MIGRATION_SKILLS = new Set(['rewrite', 'upgrade', 'replatform']);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts all active-task.json write entries from skill file content.
 * Handles two formats:
 *   Inline JSON:  active-task.json`: `{"skill":"...","step":"stepX",...}`
 *   Bash node-e:  active-task.json', JSON.stringify({skill:'...', step:'stepX',...})
 * Returns array of { step, hasResumCmd } objects.
 */
function extractWrites(content) {
  const results = [];

  // Format 1: inline JSON — `{"skill":"...","step":"stepX",...}`
  // Captures the entire JSON object on the same line as active-task.json
  const inlineRe = /active-task\.json[^\n`]*`(\{[^`]+\})`/g;
  for (const m of content.matchAll(inlineRe)) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj.step) results.push({ step: obj.step, hasResumeCmd: 'resume_cmd' in obj });
    } catch (_) {
      // Malformed JSON in file — step captured via regex fallback below
    }
  }
  // Fallback for inline when JSON.parse fails: extract step value directly
  const inlineStepRe = /active-task\.json[^\n]*"step"\s*:\s*"([^"]+)"/g;
  for (const m of content.matchAll(inlineStepRe)) {
    if (!results.find(r => r.step === m[1])) {
      const hasResumeCmd = content
        .slice(Math.max(0, m.index - 10), m.index + 200)
        .includes('resume_cmd');
      results.push({ step: m[1], hasResumeCmd });
    }
  }

  // Format 2: bash node -e — step:'stepX'
  const bashStepRe = /active-task\.json[^\n]*step:'([^']+)'/g;
  for (const m of content.matchAll(bashStepRe)) {
    if (!results.find(r => r.step === m[1])) {
      const snippet = content.slice(Math.max(0, m.index - 10), m.index + 300);
      const hasResumeCmd = /resume_cmd/.test(snippet);
      results.push({ step: m[1], hasResumeCmd });
    }
  }

  return results;
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    if (detail) console.log(`     ${detail}`);
    failed++;
  }
}

// ── Load budgets ──────────────────────────────────────────────────────────────

const budgetsPath = path.join(ROOT, '.claude-plugin', 'context-budgets.json');
let budgets;
try {
  budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));
} catch (e) {
  console.error(`❌ Cannot parse context-budgets.json: ${e.message}`);
  process.exit(1);
}

// ── Test 1: model_windows sanity ─────────────────────────────────────────────

console.log('\n── Model windows ──────────────────────────────────────────────');
const windows = budgets.model_windows || {};
assert(
  (windows['claude-sonnet-4-6'] || 0) >= 500000,
  'claude-sonnet-4-6 window ≥ 500K',
  `Got: ${windows['claude-sonnet-4-6'] ?? '(missing)'}`
);
assert(
  'claude-sonnet-4-6[1m]' in windows,
  'claude-sonnet-4-6[1m] variant present (defensive fallback)'
);
assert(
  (budgets.default_window || 0) > 0,
  'default_window set'
);

// ── Test 2: every declared step has a matching active-task.json write ─────────

console.log('\n── Active-task.json wiring ────────────────────────────────────');
const skills = budgets.skills || {};

for (const [skillName, steps] of Object.entries(skills)) {
  const relPath = SKILL_PATHS[skillName];
  if (!relPath) {
    assert(false, `${skillName}: SKILL_PATHS entry missing in test`,
      `Add "${skillName}" → "skills/${skillName}/SKILL.md" to SKILL_PATHS in this test`);
    continue;
  }

  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    assert(false, `${skillName}: SKILL.md not found`, `Expected: ${relPath}`);
    continue;
  }

  const content  = fs.readFileSync(absPath, 'utf8');
  const writes   = extractWrites(content);
  const found    = new Set(writes.map(w => w.step));
  const declared = Object.keys(steps);
  const missing  = declared.filter(s => !found.has(s));

  assert(
    missing.length === 0,
    `${skillName}: all declared steps wired (${declared.join(', ')})`,
    missing.length ? `Missing writes for: ${missing.join(', ')}` : ''
  );

  // ── Test 3: non-migration skills must include resume_cmd ─────────────────

  if (!MIGRATION_SKILLS.has(skillName)) {
    const withoutResume = writes.filter(w => declared.includes(w.step) && !w.hasResumeCmd);
    assert(
      withoutResume.length === 0,
      `${skillName}: all wired steps include resume_cmd`,
      withoutResume.length
        ? `Missing resume_cmd on steps: ${withoutResume.map(w => w.step).join(', ')}`
        : ''
    );
  }
}

// ── Test 4: context-guard.cjs supports resume_cmd ────────────────────────────

console.log('\n── context-guard.cjs ──────────────────────────────────────────');
const guardPath = path.join(ROOT, '_project-deploy', 'hooks', 'context-guard.cjs');
assert(fs.existsSync(guardPath), 'context-guard.cjs present in _project-deploy/hooks/');
if (fs.existsSync(guardPath)) {
  const guardContent = fs.readFileSync(guardPath, 'utf8');
  assert(
    guardContent.includes('activeTask.resume_cmd'),
    'context-guard.cjs reads resume_cmd from active-task.json'
  );
}

// ── Test 5: context-guard.cjs deployment wiring ──────────────────────────────

console.log('\n── Deployment wiring ──────────────────────────────────────────');

// 5a: HOOK_FILES in setup-init-bootstrap.cjs includes context-guard.cjs
const bootstrapPath = path.join(ROOT, 'scripts', 'setup-init-bootstrap.cjs');
assert(fs.existsSync(bootstrapPath), 'setup-init-bootstrap.cjs present');
if (fs.existsSync(bootstrapPath)) {
  const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
  // Match the string literal inside the HOOK_FILES array
  assert(
    /['"]context-guard\.cjs['"]/.test(bootstrap),
    'setup-init-bootstrap.cjs: context-guard.cjs in HOOK_FILES',
    'Add \'context-guard.cjs\' to the HOOK_FILES array'
  );
  assert(
    bootstrap.includes('contextGuardWired'),
    'setup-init-bootstrap.cjs: UserPromptSubmit wiring block present'
  );
}

// 5b: .claude/settings.json UserPromptSubmit has context-guard wired (plugin dev session)
const settingsPath = path.join(ROOT, '.claude', 'settings.json');
if (fs.existsSync(settingsPath)) {
  let settings;
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) { settings = null; }
  if (settings) {
    const ups = settings.hooks?.UserPromptSubmit || [];
    assert(
      ups.some(h => h.hooks && h.hooks.some(x => x.command && x.command.includes('context-guard.cjs'))),
      '.claude/settings.json: context-guard.cjs in UserPromptSubmit',
      'Add { "hooks": [{ "type": "command", "command": "node .claude/hooks/context-guard.cjs" }] } to UserPromptSubmit'
    );
  }
} else {
  console.log('  ⚠ .claude/settings.json not present — skipping deployment check (CI path)');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`${passed + failed} assertions · ${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
