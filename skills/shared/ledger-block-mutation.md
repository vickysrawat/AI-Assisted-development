# Ledger Block Mutation — shared primitive

_Spec version: 1.0 · Created: 2026-08-31_
_Used by: `fix` (Open→Fixed), `dismiss` (Open→Dismissed and `--undo` Dismissed→Open)_

> **Related:** `ledger-schema.md` owns the ledger **structure** (sections + Summary + block format)
> and reconciliation policy. This spec owns the **machinery** for moving one `### [FP-xxxx]` block
> between sections and keeping the `## Summary` counts correct. Skills MUST delegate here instead of
> re-implementing the parse/move/re-count logic inline. Severity language, where surfaced, follows
> `business-context-severity.md`.

## Why this exists

`fix` and `dismiss` both need to move a single finding block from one ledger section to another,
add or strip metadata fields, flip the `Status:` line, and adjust the Summary counts. The parse +
reassemble logic is identical; only the target section, status value, and metadata differ. Keeping
one copy here prevents the two from drifting (they previously carried ~50 near-identical lines each).

## The `moveBlock` primitive (canonical implementation)

Run this with `node`, filling the `PARAMS` object at the top. It is section-agnostic and direction-agnostic
(forward moves add fields; `--undo` moves strip them). It reads the ledger, moves the block, updates counts,
and writes the file back — reporting a one-line result.

```javascript
// node -e "<this script>"  — fill PARAMS from the calling skill.
const fs = require('fs');
const PARAMS = {
  ledgerPath : '{LEDGER_PATH}',   // e.g. CodeReviews/code-review-ledger.md
  fp         : '{FP}',            // e.g. FP-a1b2c3d4
  fromHeader : '{FROM_HEADER}',   // e.g. '## Open Findings'
  toHeader   : '{TO_HEADER}',     // e.g. '## Fixed Findings' | '## Dismissed Findings' | '## Open Findings'
  ensureTo   : true,              // create the target section if absent (append after Fixed, else at end)
  // Status line handling: match the current status and replace it with a block of new lines.
  statusFrom : '{STATUS_FROM}',   // regex source, e.g. '- \\*\\*Status\\*\\*: Open'
  statusTo   : '{STATUS_TO}',     // replacement text (may be multi-line: new metadata + new Status)
  stripFields: [],               // field labels to remove on the block, e.g. ['Dismissed date','Reason'] (undo)
  summaryDec : '{DEC_KEY}',       // Summary key to decrement, e.g. 'Open'  (or '' to skip)
  summaryInc : '{INC_KEY}',       // Summary key to increment, e.g. 'Fixed' (created as 1 if absent; '' to skip)
};

let led = fs.readFileSync(PARAMS.ledgerPath, 'utf8');

// 1. Ensure the target section exists.
if (PARAMS.ensureTo && !led.includes(PARAMS.toHeader)) {
  led = led.trimEnd() + '\n\n---\n\n' + PARAMS.toHeader + '\n\n';
}

// 2. Isolate the FROM section (header → next '## ' or EOF).
const fromIdx = led.indexOf(PARAMS.fromHeader);
if (fromIdx === -1) { console.error('missing section: ' + PARAMS.fromHeader); process.exit(1); }
const fromNext = led.indexOf('\n## ', fromIdx + PARAMS.fromHeader.length);
const fromEnd  = fromNext === -1 ? led.length : fromNext;
const fromSec  = led.slice(fromIdx, fromEnd);

// 3. Extract the FP block (### [FP-xxx] → next '### [FP-' or section end).
const bStart = fromSec.indexOf('### [' + PARAMS.fp + ']');
if (bStart === -1) { console.error(PARAMS.fp + ' not in ' + PARAMS.fromHeader); process.exit(1); }
const bNext = fromSec.indexOf('\n### [FP-', bStart + 1);
const bEnd  = bNext === -1 ? fromSec.length : bNext;
let block   = fromSec.slice(bStart, bEnd).trimEnd();

// 4. Strip requested metadata fields (undo path).
for (const f of PARAMS.stripFields) {
  block = block.replace(new RegExp('\\n- \\*\\*' + f + '\\*\\*:.*', 'g'), '');
}

// 5. Flip the Status line (+ add any new metadata carried in statusTo).
block = block.replace(new RegExp(PARAMS.statusFrom), PARAMS.statusTo);

// 6. Remove the block from the FROM section.
const newFrom = fromSec.slice(0, bStart) + fromSec.slice(bEnd).replace(/^\n+/, '\n');
let out = led.slice(0, fromIdx) + newFrom + led.slice(fromEnd);

// 7. Insert the block just after the TO header line.
const tIdx = out.indexOf(PARAMS.toHeader);
const afterHeader = out.indexOf('\n', tIdx) + 1;
out = out.slice(0, afterHeader) + '\n' + block + '\n' + out.slice(afterHeader);

// 8. Update Summary counts.
if (PARAMS.summaryDec) {
  out = out.replace(new RegExp(PARAMS.summaryDec + ':\\s*(\\d+)'), (m, n) => PARAMS.summaryDec + ': ' + Math.max(0, parseInt(n) - 1));
}
if (PARAMS.summaryInc) {
  if (new RegExp(PARAMS.summaryInc + ':\\s*\\d+').test(out)) {
    out = out.replace(new RegExp(PARAMS.summaryInc + ':\\s*(\\d+)'), (m, n) => PARAMS.summaryInc + ': ' + (parseInt(n) + 1));
  } else {
    out = out.replace(/(## Summary[\s\S]*?)(\n---|\n## )/, (m, s, e) => s.trimEnd() + '\n- ' + PARAMS.summaryInc + ': 1' + e);
  }
}

fs.writeFileSync(PARAMS.ledgerPath, out, 'utf8');
console.log(PARAMS.fp + ' moved ' + PARAMS.fromHeader + ' → ' + PARAMS.toHeader + ' in ' + PARAMS.ledgerPath);
```

## Caller parameters

### `fix` — Open → Fixed
```
fromHeader : '## Open Findings'
toHeader   : '## Fixed Findings'
statusFrom : '- \\*\\*Status\\*\\*: Open'
statusTo   : '- **Fixed date**: {today}\n- **Fixed by**: {git author or [auto-fix via /fix]}\n- **What was done**: {commit subject or "Applied fix from ledger"}\n- **Status**: Fixed'
stripFields: []
summaryDec : 'Open'   summaryInc : 'Fixed'
```

### `dismiss` — Open → Dismissed
```
fromHeader : '## Open Findings'
toHeader   : '## Dismissed Findings'
statusFrom : '- \\*\\*Status\\*\\*: Open'
statusTo   : '- **Status**: Dismissed\n- **Dismissed date**: {today}\n- **Dismissed by**: {git user}\n- **Reason**: {reason}\n- **Justification**: {justification}\n- **Verify flag**: none'
stripFields: []
summaryDec : 'Open'   summaryInc : 'Dismissed'
```

### `dismiss --undo` — Dismissed → Open
```
fromHeader : '## Dismissed Findings'
toHeader   : '## Open Findings'
statusFrom : '- \\*\\*Status\\*\\*: Dismissed'
statusTo   : '- **Status**: Open'
stripFields: ['Dismissed date','Dismissed by','Reason','Justification','Verify flag']
summaryDec : 'Dismissed'   summaryInc : 'Open'
```

## Rules
- The block boundary is `### [FP-` — never split on line numbers (they drift).
- Whole-line, section-scoped matching only; never a global substring replace.
- Always update the Summary; a moved block with stale counts breaks the checkin/pr-create open-findings gates.
- Git attribution (who/when/what) is resolved by the CALLER (e.g. `fix` runs `git log -1 --format=…`)
  and passed in via `statusTo`; this primitive does not shell out.
- Reconciliation policy (when a dismissed finding re-opens on code change) lives in
  `dismissed-findings-reconciliation.md`, not here.
