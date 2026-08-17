// SCRIPT REVIEW
// What it does:        Reads the three placed icea-status SKILL.md copies (Shared/Claude/Copilot) under
//                      spike/story-1/ and checks each for a runtime plugin-dir token; prints OK/RESIDUAL
//                      per file and a PASS/FAIL summary; exits 1 if any token is found or a file is missing.
// What it touches:     Reads only those three files under spike/story-1/. Writes nothing.
// What it does NOT do: No network, no git, no file writes/deletes, no env/registry access, no child processes.
// APIs / commands:     node:fs readFileSync, import.meta.url (URL resolution), process.exit, console.error.
// How to verify:       Run `node spike/story-1/check-residual-plugindir.mjs` → expect three "OK:" lines and exit code 0.
// spike/story-1 — AC-F1 mechanical guard (run via `node`; no shebang — SCRIPT REVIEW header must be line 1).
// Fails (exit 1) if any placed icea-status copy still carries a runtime plugin-dir token.
import { readFileSync } from 'node:fs';

const targets = [
  'Shared/skills/icea-status/SKILL.md',
  'Claude/skills/icea-status/SKILL.md',
  'Copilot/skills/icea-status/SKILL.md',
];
// Runtime plugin-dir tokens the self-containment work (ICEA #7) retires.
const banned = ['$PLUGIN' + '_DIR', 'plugin-path.txt', 'installed_plugins.json'];

let failed = false;
for (const rel of targets) {
  let text;
  try {
    text = readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8');
  } catch {
    console.error(`MISSING: ${rel}`);
    failed = true;
    continue;
  }
  const hits = banned.filter((b) => text.includes(b));
  if (hits.length) {
    console.error(`RESIDUAL: ${rel} → ${hits.join(', ')}`);
    failed = true;
  } else {
    console.error(`OK: ${rel} — no runtime plugin-dir token`);
  }
}
console.error(failed ? 'FAIL — AC-F1 residual-token guard' : 'PASS — AC-F1 residual-token guard');
process.exit(failed ? 1 : 0);
