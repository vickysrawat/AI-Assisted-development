#!/usr/bin/env node
// hooks/icea-revision-signal.cjs — PostToolUse hook
//
// Captures a `revision` signal whenever any ADO artifact is edited outside
// the formal skill flow (without running REVISE ADO-{ID}).
//
// The ADO ID is included when determinable (from filename or git branch).
// When not determinable, ado_id is null — the pattern is still captured.
// Dream uses signals for category-based pattern learning, not ADO attribution.
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
//   any other source edit                           → scope-changed, ado_id null
//
// Excluded: tracker.md, ai-audit.md, critic output files (expected to change).

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Guard: only active when plugin is initialised
if (!fs.existsSync('.claude/dream-init-state.json')) process.exit(0);

// Locate signal-write.cjs
function resolveSignalWrite() {
  try {
    const pluginPath = fs.readFileSync('.claude/plugin-path.txt', 'utf8').trim().replace(/\\/g, '/');
    const candidate = path.join(pluginPath, 'scripts', 'signal-write.cjs');
    if (fs.existsSync(candidate)) return candidate;
  } catch (_) {}
  const local = path.join(process.cwd(), 'scripts', 'signal-write.cjs');
  if (fs.existsSync(local)) return local;
  return null;
}

// Extract ADO ID from file path (most reliable — ADO ID is in the filename)
function extractAdoId(filePath) {
  let m = filePath.match(/ADO-(\d+)-/);
  if (m) return m[1];
  m = filePath.match(/UserStory(\d+)/i);
  if (m) return m[1];
  return null;
}

// Try to get ADO ID from the current git branch (feature/ADO-{ID}-*)
function extractAdoIdFromBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', timeout: 3000 }).trim();
    const m = branch.match(/ADO[-_]?(\d+)/i);
    return m ? m[1] : null;
  } catch (_) { return null; }
}

// Infer revision category from section headings in the changed content
function inferCategory(filePath, changedContent) {
  const fp  = filePath.toLowerCase();
  const txt = (changedContent || '').toLowerCase();

  if (fp.endsWith('.techspec.md'))  return 'context-incomplete';
  if (fp.endsWith('.plan.md'))      return 'context-incomplete';
  if (fp.endsWith('.test-plan.md')) return 'examples-underspecified';

  // Source code (not a docs file)
  const isDocFile = fp.includes('/docs/') || fp.startsWith('docs/');
  if (!isDocFile) return 'scope-changed';

  // ICEA file — infer from which section changed
  if (fp.endsWith('.icea.md')) {
    if (txt.includes('## acceptance') || txt.includes('ac-f') || txt.includes('ac-nf')) {
      return 'ac-not-testable';
    }
    if (txt.includes('## examples') || (txt.includes('given') && txt.includes('then'))) {
      return 'examples-underspecified';
    }
    if (txt.includes('## intent') || txt.includes('**goal:**') || txt.includes('business impact')) {
      return 'intent-unclear';
    }
    if (txt.includes('## context') || txt.includes('system context') || txt.includes('constraint')) {
      return 'context-incomplete';
    }
    return 'context-incomplete';
  }

  return 'context-incomplete';
}

// Should this Edit generate a revision signal?
// Only 'Edit' qualifies — 'Write' is new-file creation (normal workflow, not a revision).
// Only ADO doc artifacts carry ICEA quality signal value.
function shouldCapture(filePath, toolName) {
  const fp = filePath.replace(/\\/g, '/');

  // Only Edit qualifies — Write creates a new file (initial SAVE is expected, not a revision)
  if (toolName !== 'Edit') return false;

  // Never capture these expected-to-change files
  if (fp.endsWith('.tracker.md'))      return false;
  if (fp.endsWith('.ai-audit.md'))     return false;
  if (fp.includes('icea-critic'))      return false;
  if (fp.includes('icea-tech-critic')) return false;
  if (fp.includes('/signals/'))        return false;
  if (fp.includes('dream-log'))        return false;
  if (fp.endsWith('MEMORY.md'))        return false;

  // Only ADO doc artifacts carry ICEA quality signal value.
  // Source code, plugin files (skills/, scripts/, tests/), and config are excluded.
  return /ADO-\d+-.+\.(icea|techspec|plan|test-plan)\.md$/.test(fp);
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

    if (!shouldCapture(fp, tool)) process.exit(0);

    // Resolve ADO ID — best effort, null is acceptable
    let adoId = extractAdoId(fp) || extractAdoIdFromBranch();
    // adoId may be null — signal is still written with ado_id: null

    // Determine changed content for category inference
    let changedContent = '';
    if (tool === 'Edit') {
      changedContent = (ev.tool_input.new_string || '') + '\n' + (ev.tool_input.old_string || '');
    } else if (tool === 'Write') {
      changedContent = (ev.tool_input.content || '').slice(0, 500); // first 500 chars sufficient
    }

    const category = inferCategory(fp, changedContent);

    // Build detail string
    const fileName = path.basename(fp);
    const headingMatch = changedContent.match(/^#{1,3} .+/m);
    const headingHint  = headingMatch ? ' — ' + headingMatch[0].replace(/^#+\s*/, '').slice(0, 60) : '';
    const detail = `${fileName}${headingHint} [${tool} outside formal skill flow]`;

    const signalWrite = resolveSignalWrite();
    if (!signalWrite) process.exit(0);

    // Build args — omit --ado-id entirely when null (signal-write handles missing arg as null)
    const args = [
      signalWrite,
      '--type',     'revision',
      '--category', category,
      '--detail',   detail,
    ];
    if (adoId) {
      args.push('--ado-id', adoId);
    }

    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 5000 });

    // Write test-plan-stale marker when ICEA, Tech Spec, or Plan is revised so that
    // icea-approve and icea-implement know to require a REFRESH TEST before proceeding.
    // .plan.md covers lightweight mode — the test plan is derived from Must Have items,
    // so a plan revision makes the test plan stale just as an ICEA revision does.
    // Only written when we have an ADO ID (otherwise we can't target the right test plan).
    if (adoId && (fp.endsWith('.icea.md') || fp.endsWith('.techspec.md') || fp.endsWith('.plan.md'))) {
      const staleEntry = {
        timestamp: new Date().toISOString(),
        ado_id:    adoId,
        reason:    'hook',
        file:      path.basename(fp),
      };
      const signalsDir = path.join(process.cwd(), '.claude', 'signals');
      const staleFile  = path.join(signalsDir, 'test-plan-stale-ADO-' + adoId + '.json');
      try {
        fs.mkdirSync(signalsDir, { recursive: true });
        fs.writeFileSync(staleFile, JSON.stringify(staleEntry, null, 2) + '\n', 'utf8');
      } catch (_) { /* never block on stale marker write failure */ }
    }

  } catch (_) { /* always exit 0 */ }
  process.exit(0);
});
