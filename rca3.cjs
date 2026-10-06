// SCRIPT REVIEW
// What it does:        For lines 50–339 of a Claude Code session JSONL transcript, prints every
//                      assistant message that contains a reply-seeking phrase (CONTINUE, Reply, ?, APPROVE,
//                      choose, confirm), followed by the next user-role entry. Also prints all permission
//                      modes found in the transcript.
// What it touches:     Reads the transcript file passed as argv[2]. Writes nothing.
// What it does NOT do: No network calls, no git operations, no file writes, no registry changes.
// APIs / commands:     Node.js fs.readFileSync, JSON.parse, Array methods only.
// How to verify:       Output shows ASKED lines with the next USER-ROLE entry. Check whether
//                      task-notification messages appear as the "next user role" after a question.

// rca3.cjs — usage: node rca3.cjs <transcript.jsonl>
const L = require('fs').readFileSync(process.argv[2], 'utf8').split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } });
const modes = new Set(L.filter(e => e?.permissionMode).map(e => e.permissionMode));
console.log('permission modes:', [...modes].join(', ') || '(field not present)');
L.forEach((e, n) => {
  if (!e || e.isSidechain || n < 50 || n > 339 || e.type !== 'assistant') return;
  const t = (e.message?.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ');
  if (!/CONTINUE|Reply|\?|APPROVE|choose|confirm/i.test(t)) return;
  const nx = L.findIndex((x, k) => k > n && x && !x.isSidechain && x.type === 'user');
  const c = L[nx]?.message?.content;
  const next = typeof c === 'string' ? c : JSON.stringify(c);
  console.log(`${n} ASKED: ${t.slice(0, 110)}\n   → ${nx} NEXT USER-ROLE: ${(next || '').slice(0, 90)}`);
});
