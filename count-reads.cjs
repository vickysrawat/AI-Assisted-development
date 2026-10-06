// SCRIPT REVIEW
// What it does:        Reads a Claude Code session JSONL transcript and counts Read, Edit, and Write
//                      tool calls per file (basename). Prints a table sorted by total call count,
//                      main session only (isSidechain entries excluded).
// What it touches:     Reads the transcript file passed as argv[2]. Writes nothing.
// What it does NOT do: No network calls, no git operations, no file writes, no registry changes.
// APIs / commands:     Node.js fs.readFileSync, JSON.parse, Array/Map methods only.
// How to verify:       Look for migration-feasibility.md in the output; Edit count should match
//                      the figure from the earlier WCF run evidence (reported as 27).

// count-reads.cjs — usage: node count-reads.cjs <transcript.jsonl>
const lines = require('fs').readFileSync(process.argv[2], 'utf8').split('\n');
const counts = new Map(); // basename → { Read: 0, Edit: 0, Write: 0 }

lines.forEach(l => {
  let e; try { e = JSON.parse(l); } catch { return; }
  if (e.isSidechain) return;
  const c = e.message?.content;
  if (!Array.isArray(c)) return;
  for (const b of c) {
    if (b.type !== 'tool_use') continue;
    const op = b.name; // 'Read', 'Edit', 'Write', 'Bash', ...
    if (!['Read', 'Edit', 'Write'].includes(op)) continue;
    const path = b.input?.file_path || b.input?.path || '';
    const base = path.split(/[\\/]/).pop() || path || '(unknown)';
    if (!counts.has(base)) counts.set(base, { Read: 0, Edit: 0, Write: 0 });
    counts.get(base)[op]++;
  }
});

// Sort by total descending
const rows = [...counts.entries()]
  .map(([f, c]) => ({ f, ...c, total: c.Read + c.Edit + c.Write }))
  .sort((a, b) => b.total - a.total);

const w = Math.max(40, ...rows.map(r => r.f.length));
console.log('File'.padEnd(w), 'Read', 'Edit', 'Write', 'Total');
console.log('-'.repeat(w + 25));
for (const r of rows) {
  console.log(
    r.f.padEnd(w),
    String(r.Read).padStart(4),
    String(r.Edit).padStart(5),
    String(r.Write).padStart(6),
    String(r.total).padStart(6)
  );
}
