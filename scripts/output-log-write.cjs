#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Appends a timestamped Markdown section to a per-ADO session log file
//                      in .claude/logs/. Creates the file and directory if they don't exist.
//                      Reads verbose content from a file (--content-file) or inline string
//                      (--content). Writes nothing and exits 0 if --step is missing or
//                      no content is provided.
// What it touches:     .claude/logs/ADO-{ID}-session-{YYYY-MM-DD}.md (create/append)
//                      .claude/logs/ directory (create if absent)
// What it does NOT do: No network calls. No git operations. Does not read or modify source
//                      code, ICEA docs, tracker files, or dream-init-state.json.
// APIs / commands:     Node.js built-ins: fs.mkdirSync, fs.existsSync, fs.writeFileSync,
//                      fs.appendFileSync, fs.readFileSync. No child_process.
// How to verify:       After running, check .claude/logs/ for a file named
//                      ADO-{ID}-session-{YYYY-MM-DD}.md and confirm a new ## section
//                      was appended with the expected step label and content.

// scripts/output-log-write.cjs
// Appends verbose skill output to a per-ADO session log file.
//
// Skills call this when output_mode="compact" so verbose details (critic output,
// AC scoring, step narratives) are captured without cluttering the chat window.
//
// Log path: .claude/logs/ADO-{ID}-session-{YYYY-MM-DD}.md
//           or .claude/logs/session-{YYYY-MM-DD}.md when no ADO ID is in context
//
// Usage — from a file (preferred for multi-line content):
//   node "$PLUGIN_DIR/scripts/output-log-write.cjs" \
//     --ado-id 9006 \
//     --step "critic-gate" \
//     --content-file "/tmp/critic-output.txt"
//
// Usage — inline for short content:
//   node "$PLUGIN_DIR/scripts/output-log-write.cjs" \
//     --ado-id 9006 \
//     --step "goal-loop" \
//     --content "AC-F1 met, AC-F2 met, AC-NF1 met"
//
// Arguments:
//   --ado-id       optional  ADO work item ID (for log file name)
//   --step         required  step label (e.g. 'critic-gate', 'goal-loop', 'step-4')
//   --content-file optional  path to a file whose entire contents become the log entry
//   --content      optional  inline string content (use for short single-line entries)
//
// Precedence: --content-file wins over --content when both are given.
// Always exits 0 — never blocks the calling skill flow.

'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Read a named CLI argument value (--name value).
 * Returns null if the argument is absent or has no following value.
 */
function arg(name) {
  const idx = process.argv.indexOf('--' + name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const adoId       = arg('ado-id');        // optional: ADO work item ID
const step        = arg('step');          // required: step label
const contentFile = arg('content-file'); // optional: read verbose content from this file
const inlineText  = arg('content');       // optional: short inline content string

// --step is required — without it the log entry has no heading
if (!step) {
  process.stderr.write('output-log-write: --step is required\n');
  process.exit(0);
}

try {
  // Resolve the verbose content to log
  let verboseContent = '';
  if (contentFile) {
    // Read from file — supports multi-line critic output, diffs, AC tables, etc.
    try {
      verboseContent = fs.readFileSync(contentFile, 'utf8');
    } catch (e) {
      verboseContent = '[content-file not readable: ' + e.message + ']';
    }
  } else if (inlineText) {
    verboseContent = inlineText;
  } else {
    // Nothing to log — exit silently (caller may have omitted content intentionally)
    process.exit(0);
  }

  const now     = new Date();
  // Date for the filename: YYYY-MM-DD
  const dateStr = now.toISOString().slice(0, 10);
  // Time for the section heading: HH:MM:SS
  const timeStr = now.toTimeString().slice(0, 8);

  // Build the log file name — include ADO ID when available
  const fileName = adoId
    ? 'ADO-' + adoId + '-session-' + dateStr + '.md'
    : 'session-' + dateStr + '.md';

  const logsDir = path.join(process.cwd(), '.claude', 'logs');
  const logPath = path.join(logsDir, fileName);

  // Create .claude/logs/ if it does not exist yet
  fs.mkdirSync(logsDir, { recursive: true });

  // Write the document header on first write, then append entries
  if (!fs.existsSync(logPath)) {
    const header = adoId
      ? '# Session Log — ADO #' + adoId + ' — ' + dateStr + '\n'
      : '# Session Log — ' + dateStr + '\n';
    fs.writeFileSync(logPath, header, 'utf8');
  }

  // Build a headed Markdown section: timestamp + step label as the heading,
  // followed by the verbose content as the body
  const adoTag = adoId ? ' — ADO #' + adoId : '';
  const entry  = [
    '',
    '## ' + timeStr + ' — ' + step + adoTag,
    '',
    verboseContent.trimEnd(),
    '',
  ].join('\n');

  fs.appendFileSync(logPath, entry, 'utf8');

} catch (e) {
  // Never crash the calling skill — errors go to stderr only
  process.stderr.write('output-log-write: ' + e.message + '\n');
}

process.exit(0);
