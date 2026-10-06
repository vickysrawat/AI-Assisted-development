// SCRIPT REVIEW
// What it does:        Reads a Claude Code session JSONL transcript and prints the full JSON of
//                      specific line numbers passed as arguments (argv[3], argv[4], ...).
// What it touches:     Reads the transcript file passed as argv[2]. Writes nothing.
// What it does NOT do: No network calls, no git operations, no file writes, no registry changes.
// APIs / commands:     Node.js fs.readFileSync, JSON.parse only.
// How to verify:       Output shows === LINE N === followed by indented JSON for each requested line.

// rca-lines.cjs — usage: node rca-lines.cjs <transcript.jsonl> <line1> [line2] ...
const lines = require('fs').readFileSync(process.argv[2], 'utf8').split('\n');
const targets = process.argv.slice(3).map(Number);
targets.forEach(n => {
  const l = lines[n];
  if (!l || !l.trim()) { console.log(`LINE ${n}: (empty)`); return; }
  try {
    const e = JSON.parse(l);
    console.log(`=== LINE ${n} ===`);
    console.log(JSON.stringify(e, null, 2).slice(0, 5000));
  } catch(err) {
    console.log(`LINE ${n} parse error: ${err.message}`);
    console.log(l.slice(0, 500));
  }
});
