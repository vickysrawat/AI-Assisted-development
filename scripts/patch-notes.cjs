'use strict';
// Reads ai-assisted-development-story-narration-humanized.md and patches
// the s.addNotes() calls in gen-story-pptx.cjs, then regenerates the PPTX.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const narrationPath = path.join(ROOT, 'docs/presentations/ai-assisted-development-story-narration-humanized.md');
const scriptPath = path.join(ROOT, 'scripts/gen-story-pptx.cjs');

// ─── Parse narration file ─────────────────────────────────────────────────────

const raw = fs.readFileSync(narrationPath, 'utf8');

// Split into per-slide sections on ### SLIDE N headers
const sections = raw.split(/(?=\n### SLIDE \d+)/).map(s => s.trim()).filter(Boolean);

const slideMap = {}; // slideNum → narration string (null = keep original)

for (const section of sections) {
  const numMatch = section.match(/^### SLIDE (\d+)/);
  if (!numMatch) continue;
  const n = parseInt(numMatch[1]);

  // SKIPPED or REMOVED → keep original notes
  if (/\*\*SKIPPED\*\*|\*\*REMOVED\*\*/.test(section) && !/\*\*HUMANIZED:\*\*/.test(section)) {
    slideMap[n] = null;
    continue;
  }

  // Extract HUMANIZED block — everything between **HUMANIZED:** and **WHY IT'S BETTER:** or ---
  const humMatch = section.match(/\*\*HUMANIZED:\*\*\n([\s\S]*?)(?=\n\*\*WHY IT'S BETTER:|(?:\n---)|$)/);
  if (!humMatch) { slideMap[n] = null; continue; }

  const text = humMatch[1].trim();

  if (!text || text.startsWith('**SKIPPED**') || text.startsWith('**REMOVED**')) {
    slideMap[n] = null;
    continue;
  }

  slideMap[n] = text;
}

console.log('Parsed slides:', Object.entries(slideMap).map(([k, v]) => `${k}:${v ? 'updated' : 'kept'}`).join(', '));

// ─── Patch gen-story-pptx.cjs ────────────────────────────────────────────────

let script = fs.readFileSync(scriptPath, 'utf8');

let slideCounter = 0;
let updatedCount = 0;

// Match s.addNotes(`...`) — backtick template literals (non-greedy, single-line safe via [\s\S])
script = script.replace(/s\.addNotes\(`([\s\S]*?)`\)/g, (fullMatch) => {
  slideCounter++;
  const narration = slideMap[slideCounter];

  if (narration) {
    // Escape backticks, backslashes, and template literal interpolation in the narration
    const escaped = narration
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
    updatedCount++;
    return `s.addNotes(\`${escaped}\`)`;
  }

  return fullMatch; // keep original
});

fs.writeFileSync(scriptPath, script, 'utf8');
console.log(`\nPatched ${updatedCount} of ${slideCounter} slides.`);

// ─── Regenerate PPTX ─────────────────────────────────────────────────────────
console.log('\nRegenerating PPTX...');
execSync(`node "${scriptPath}"`, { stdio: 'inherit', cwd: ROOT });
console.log('\nDone.');
