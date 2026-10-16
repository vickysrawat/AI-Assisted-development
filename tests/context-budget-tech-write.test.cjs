#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Regression test for .claude/hooks/context-budget-tech-write.cjs Gate 3.
//                      Pipes JSON payloads to the hook via stdin and asserts exit codes: an
//                      EPIC-status temp tech spec missing the per-story sections is ALLOWED (0);
//                      a non-epic (story) spec missing them is BLOCKED (2); an EPIC spec still
//                      missing ## Overview is BLOCKED (2); a complete story spec is ALLOWED (0).
// What it touches:     Spawns `node .claude/hooks/context-budget-tech-write.cjs` with stdin only.
//                      Reads no files, writes no files (no force flags created).
// What it does NOT do: NO network, NO git, NO disk writes, NO project-source mutation.
// APIs / commands:     child_process.spawnSync (stdin pipe). Retries once on the Windows
//                      0xC0000005 transient loader crash (exit > 3221225000).
// How to verify:       node tests/context-budget-tech-write.test.cjs   -> "N passed · 0 failed".

'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Resolve the hook: prefer the deployed copy (real target-project layout under .claude/hooks/);
// fall back to the source of truth under _project-deploy/hooks/ so this test runs in a bare
// checkout / CI where the plugin has not been deployed onto itself (no .claude/ present).
// Resolve to an ABSOLUTE path — the hook is spawned with cwd set to a throwaway temp dir (below).
const DEPLOYED = path.resolve('.claude', 'hooks', 'context-budget-tech-write.cjs');
const SOURCE   = path.join(__dirname, '..', '_project-deploy', 'hooks', 'context-budget-tech-write.cjs');
const HOOK = fs.existsSync(DEPLOYED) ? DEPLOYED : SOURCE;

// Isolate the hook's best-effort audit writes (.claude/audit/*.jsonl) and force-flag lookups to a
// throwaway cwd so running this test never pollutes the repo working tree.
const CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'cbtw-'));

// Build a body with >= minLines non-empty lines and no {placeholder} tokens.
function pad(lines) {
  const out = lines.slice();
  let n = 1;
  while (out.filter(l => l.trim().length > 0).length < 60) {
    out.push(`Narrative content line number ${n} — derived, not a scaffold.`);
    n++;
  }
  return out.join('\n');
}

function run(filePath, content) {
  const payload = JSON.stringify({ tool_input: { file_path: filePath, content } });
  let r = spawnSync('node', [HOOK], { input: payload, encoding: 'utf8', cwd: CWD });
  if (r.status !== null && r.status > 3221225000) {         // transient Windows loader crash — retry once
    r = spawnSync('node', [HOOK], { input: payload, encoding: 'utf8', cwd: CWD });
  }
  return r.status;
}

const EPIC_STATUS = 'Status: DRAFT · EPIC · 10 SP total';
const STORY_STATUS = 'Status: DRAFT';

// All 13 required sections (expanded list from RULES).
const ALL_STORY_SECTIONS = [
  '## Overview', '## AC Coverage Matrix', '## Files Changed', '## API Changes',
  '## Auth & Security', '## Error Handling', '## Sizing and Story Breakdown',
  '## Definition of Done', '## Open Questions', '## Request Flow',
  '## Rollback', '## Handover', '## Test Cases',
];
// Non-exempt sections an EPIC spec must still include (EPIC_EXEMPT_SECTIONS removes 7 of the 13).
const EPIC_REQUIRED = [
  '## Overview', '## Sizing and Story Breakdown', '## Definition of Done',
  '## Open Questions', '## Rollback', '## Handover',
];

// EPIC spec: has all non-exempt required sections, omits the 7 per-story-exempt sections.
const epicNoStorySections = pad([
  '# Epic Tech Spec — sample', EPIC_STATUS, '',
  ...EPIC_REQUIRED.flatMap(s => [s, 'content here.', '']),
]);
// EPIC spec missing ## Overview — must still block.
const epicNoOverview = pad([
  '# Epic Tech Spec — sample', EPIC_STATUS, '',
  ...EPIC_REQUIRED.filter(s => s !== '## Overview').flatMap(s => [s, 'content.', '']),
]);
// Non-epic (story) spec missing most required sections — must block.
const storyNoSections = pad([
  '# Tech Spec — sample', STORY_STATUS, '', '## Overview', 'Story overview prose.',
]);
// Complete story spec with all 13 required sections — must be allowed.
const storyComplete = pad([
  '# Tech Spec — sample', STORY_STATUS, '',
  ...ALL_STORY_SECTIONS.flatMap(s => [s, 'content here.', '']),
]);
// Complete story spec with numbered section headings — must be allowed (e.g. ## 1. Overview).
const storyCompleteNumbered = pad([
  '# Tech Spec — sample', STORY_STATUS, '',
  ...ALL_STORY_SECTIONS.map((s, i) => s.replace('## ', `## ${i + 1}. `))
    .flatMap(s => [s, 'content here.', '']),
]);

const cases = [
  ['EPIC temp tech spec missing per-story sections -> ALLOW', () =>
    run('temp/ADO-9004-tech.md', epicNoStorySections) === 0],
  ['EPIC spec still missing ## Overview -> BLOCK', () =>
    run('temp/ADO-9004-tech.md', epicNoOverview) === 2],
  ['Non-epic story spec missing per-story sections -> BLOCK', () =>
    run('temp/ADO-9004-Story-1-tech.md', storyNoSections) === 2],
  ['Complete story spec -> ALLOW', () =>
    run('temp/ADO-9004-Story-1-tech.md', storyComplete) === 0],
  ['Complete story spec with numbered headings (## 1. Overview) -> ALLOW', () =>
    run('temp/ADO-9004-Story-1-tech.md', storyCompleteNumbered) === 0],
];

let passed = 0, failed = 0;
for (const [name, fn] of cases) {
  let ok = false;
  try { ok = fn(); } catch (e) { ok = false; }
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else    { failed++; console.log(`  ✗ ${name}`); }
}
try { fs.rmSync(CWD, { recursive: true, force: true }); } catch (_) { /* best-effort */ }

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
