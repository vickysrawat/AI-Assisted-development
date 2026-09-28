#!/usr/bin/env node
// hooks/icea-revision-signal.cjs — PostToolUse hook
//
// Captures a `revision` signal whenever any ADO artifact or source code
// file is edited outside the formal skill flow (without running REVISE ADO-{ID}).
//
// This closes the gap where live discussion changes to an ICEA, tech spec,
// plan, or implementation go untracked in .claude/signals/.
//
// Triggers on: Write | Edit tool use
// Exits 0 always — never blocks any tool use.
//
// Covered artifacts:
//   docs/**/UserStory{ID}/ADO-{ID}-*.icea.md      → infers category from changed section
//   docs/**/UserStory{ID}/ADO-{ID}-*.techspec.md  → context-incomplete
//   docs/**/UserStory{ID}/ADO-{ID}-*.plan.md      → context-incomplete
//   docs/**/UserStory{ID}/ADO-{ID}-*.test-plan.md → examples-underspecified
//   source code on feature/ADO-{ID}-* branch       → scope-changed
//
// Excluded: tracker.md (expected during implementation), ai-audit.md, critic files.
//
// Signal written: .claude/signals/{ms}-revision-ADO-{ID}.json
// Dream processes these between runs — promotes patterns to project-knowledge.md.

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Guard: only active when plugin is initialised
if (!fs.existsSync('.claude/dream-init-state.json')) process.exit(0);

// Locate signal-write.cjs — try plugin-path.txt first, then repo-local scripts/
function resolveSignalWrite() {
  try {
    const pluginPath = fs.readFileSync('.claude/plugin-path.txt', 'utf8').trim().replace(/\\/g, '/');
    const candidate = path.join(pluginPath, 'scripts', 'signal-write.cjs');
    if (fs.existsSync(candidate)) return candidate;
  } catch (_) {}
  // Fallback: look in the local repo scripts/ directory
  const local = path.join(process.cwd(), 'scripts', 'signal-write.cjs');
  if (fs.existsSync(local)) return local;
  return null;
}

// Infer revision category from section headings present in the changed content.
// For ICEA files: map ICEA section → revision category.
// Returns the most specific matching category, or 'context-incomplete' as default.
function inferCategory(filePath, changedContent) {
  const fp  = filePath.toLowerCase();
  const txt = (changedContent || '').toLowerCase();

  // Tech spec changed
  if (fp.endsWith('.techspec.md')) return 'context-incomplete';

  // Plan changed
  if (fp.endsWith('.plan.md')) return 'context-incomplete';

  // Test plan changed
  if (fp.endsWith('.test-plan.md')) return 'examples-underspecified';

  // Source code changed on feature branch (not a docs file)
  // NOTE: fp may be relative (docs/...) or absolute (/abs/path/docs/...) — check both forms
  const isDocFile = fp.includes('/docs/') || fp.startsWith('docs/');
  if (!isDocFile) return 'scope-changed';

  // ICEA file — inspect which section was changed
  if (fp.endsWith('.icea.md')) {
    // Check from most specific to least specific
    if (txt.includes('## acceptance') || txt.includes('ac-f') || txt.includes('ac-nf')) {
      return 'ac-not-testable';
    }
    if (txt.includes('## examples') || txt.includes('given') || txt.includes('when') || txt.includes('then')) {
      return 'examples-underspecified';
    }
    if (txt.includes('## intent') || txt.includes('**goal:**') || txt.includes('business impact')) {
      return 'intent-unclear';
    }
    if (txt.includes('## context') || txt.includes('system context') || txt.includes('constraint context')) {
      return 'context-incomplete';
    }
    // Post-approval change (status line still shows Approved)
    if (txt.includes('approved') && (txt.includes('scope') || txt.includes('feedback'))) {
      return 'tech-lead-feedback';
    }
    return 'context-incomplete'; // default for ICEA
  }

  return 'context-incomplete';
}

// Extract ADO ID from a file path.
// Matches: ADO-{digits}-*.icea.md, docs/Release*/Sprint*/UserStory{digits}/, feature/ADO-{digits}-
function extractAdoId(filePath) {
  // Direct filename match: ADO-9006-feature.icea.md
  let m = filePath.match(/ADO-(\d+)-/);
  if (m) return m[1];
  // UserStory folder: docs/.../UserStory9006/
  m = filePath.match(/UserStory(\d+)/);
  if (m) return m[1];
  return null;
}

// Check git branch for feature/ADO-{ID}-* pattern
function getAdoIdFromBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', timeout: 3000 }).trim();
    const m = branch.match(/ADO[-_]?(\d+)/i);
    return m ? m[1] : null;
  } catch (_) { return null; }
}

// Should this file path generate a revision signal?
function shouldCapture(filePath) {
  const fp = filePath.replace(/\\/g, '/');

  // Always exclude: tracker, audit, critic output files (expected to change)
  if (fp.endsWith('.tracker.md'))   return false;
  if (fp.endsWith('.ai-audit.md'))  return false;
  if (fp.includes('icea-critic'))   return false;
  if (fp.includes('icea-tech-critic')) return false;

  // Include: any ADO doc artifact
  if (/ADO-\d+-.+\.(icea|techspec|plan|test-plan)\.md$/.test(fp)) return true;

  // Include: files inside a UserStory folder (covers future artifact types)
  if (/UserStory\d+\/ADO-\d+/.test(fp)) return true;

  // Include: source code on a feature branch (any non-docs file on feature/ADO-* branch)
  // This is checked separately in the main flow using git branch
  if (!fp.includes('/docs/') && !fp.includes('/.claude/') && !fp.includes('/memory/')) {
    return 'check-branch'; // sentinel — caller checks branch
  }

  return false;
}

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  try {
    const ev   = JSON.parse(raw.replace(/\r\n/g, '\n'));
    const tool = ev.tool_name || '';

    if (tool !== 'Write' && tool !== 'Edit') process.exit(0);

    const fp = ((ev.tool_input || {}).file_path || (ev.tool_input || {}).path || '')
                 .replace(/\\/g, '/');
    if (!fp) process.exit(0);

    const capture = shouldCapture(fp);
    if (!capture) process.exit(0);

    // For source code files, only capture if on a feature/ADO-* branch
    let adoId = extractAdoId(fp);
    if (capture === 'check-branch') {
      const branchAdo = getAdoIdFromBranch();
      if (!branchAdo) process.exit(0); // not on a feature branch — skip
      adoId = branchAdo;
    }

    if (!adoId) process.exit(0);

    // Determine what content changed
    let changedContent = '';
    if (tool === 'Edit') {
      changedContent = (ev.tool_input.new_string || '') + '\n' + (ev.tool_input.old_string || '');
    } else if (tool === 'Write') {
      changedContent = ev.tool_input.content || '';
    }

    const category = inferCategory(fp, changedContent);

    // Build detail: filename + first changed heading (if detectable)
    const fileName = path.basename(fp);
    let changedHeading = '';
    const headingMatch = changedContent.match(/^#{1,3} .+/m);
    if (headingMatch) changedHeading = ' — ' + headingMatch[0].replace(/^#+\s*/, '').slice(0, 60);

    const detail = `${fileName}${changedHeading} [edited outside formal skill flow — ${tool} tool]`;

    const signalWrite = resolveSignalWrite();
    if (!signalWrite) process.exit(0);

    // Write the revision signal (always exits 0 — never blocks)
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [
      signalWrite,
      '--type',     'revision',
      '--category', category,
      '--ado-id',   adoId,
      '--detail',   detail,
    ], { encoding: 'utf8', timeout: 5000 });

  } catch (_) { /* always exit 0 */ }
  process.exit(0);
});
