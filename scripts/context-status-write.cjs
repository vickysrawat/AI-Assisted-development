'use strict';
// SCRIPT REVIEW
// What it does:        Reads the Claude Code status line JSON payload from stdin and writes
//                      context window stats (remaining_percentage, used_percentage, etc.) to
//                      a session-scoped temp file at os.tmpdir()/ctx-{session_id}.json.
// What it touches:     One file per session: os.tmpdir()/ctx-{session_id}.json (created or overwritten).
// What it does NOT do: No network calls. No git operations. No project file reads or writes.
//                      Does not print to stdout (output would appear in the Claude Code status bar).
// APIs / commands:     Node.js built-ins: fs.writeFileSync, os.tmpdir, path.join, JSON.parse.
// How to verify:       After a Claude Code session starts, check os.tmpdir() for a file named
//                      ctx-{session_id}.json and confirm it contains remaining_percentage.
const fs   = require('fs');
const os   = require('os');
const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(raw);
    const sessionId = data.session_id;
    if (!sessionId) return;
    const payload = {
      session_id:           sessionId,
      remaining_percentage: data.context_window?.remaining_percentage  ?? null,
      used_percentage:      data.context_window?.used_percentage       ?? null,
      context_window_size:  data.context_window?.context_window_size   ?? null,
      updated_at:           new Date().toISOString(),
    };
    fs.writeFileSync(path.join(os.tmpdir(), `ctx-${sessionId}.json`), JSON.stringify(payload), 'utf8');
  } catch (_) { /* never crash — stderr is shown to the user by Claude Code */ }
});
