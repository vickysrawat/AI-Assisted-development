#!/usr/bin/env node
// hooks/manifest-read-guard.cjs — PreToolUse hook
//
// SCRIPT REVIEW
// What it does:    Blocks Read tool calls targeting source-context-manifest.md when a
//                  cached summary already exists in the migration ledger. Redirects the
//                  model to read source_context.summary from the ledger (~100 tokens)
//                  instead of the full manifest (~16,000 tokens for a 1,000-module codebase).
//                  Extra gate: if stage_gates.intake_context === PASS but summary is absent,
//                  blocks with a diagnostic — the set-payload call was skipped in SKILL.md.
// What it reads:   tool_input.file_path (from hook payload);
//                  .claude/migration/{ADO}.checkpoint.json — the migration ledger.
// What it writes:  Nothing. Read-only, never mutates state.
// Allow signals:   (1) file path does not contain source-context-manifest.md → exit 0
//                  (2) ADO cannot be extracted from path → exit 0
//                  (3) ledger absent (Step 1.5 authoring in progress) → exit 0
//                  (4) ledger unreadable/corrupt → exit 0 (validation is intake-verify's job)
//                  (5) summary absent AND intake_context gate != PASS → exit 0 (still in flux)
// Block signals:   (A) summary.coverage_verdict present → exit 2 (redirect to ledger)
//                  (B) intake_context=PASS but summary absent → exit 2 (diagnostic: write skipped)
// Wiring:          .claude/settings.json → PreToolUse, matcher "Read"
//                  setup-init deploys this automatically when migration skills are detected.

'use strict';
const fs   = require('fs');
const path = require('path');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    filePath = (payload.tool_input && payload.tool_input.file_path) || '';
  } catch (_) { process.exit(0); }

  if (!filePath) process.exit(0);
  const normPath = filePath.replace(/\\/g, '/');

  // ── 1. Only intercept reads targeting source-context-manifest.md ─────────────────
  if (!normPath.includes('source-context-manifest.md')) process.exit(0);

  // ── 2. Extract ADO ID from canonical path: docs/migrations/{ADO}/source-context-manifest.md ──
  const adoMatch = normPath.match(/docs\/migrations\/([^/]+)\/source-context-manifest\.md/i);
  if (!adoMatch) process.exit(0);
  const ado = adoMatch[1];

  // ── 3. Load checkpoint ledger ─────────────────────────────────────────────────────
  // Absent ledger → Step 1.5 authoring in progress; manifest read is legitimate → allow.
  const ledgerPath = path.join(process.cwd(), '.claude', 'migration', `${ado}.checkpoint.json`);
  if (!fs.existsSync(ledgerPath)) process.exit(0);

  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); }
  catch (_) { process.exit(0); } // corrupt ledger → allow; validation is intake-verify's job

  const cp = ledger.checkpoint && ledger.checkpoint.payload;

  // ── 4. Search for cached summary across all migration skills ──────────────────────
  const SKILLS = ['rewrite', 'upgrade', 'replatform'];
  let summary = null;
  let foundSkill = null;
  let intakeGatePassed = false;

  for (const skill of SKILLS) {
    const ns       = cp && cp[skill];
    const sc       = ns && ns.source_context;
    const gates    = ledger.checkpoint && ledger.checkpoint.stage_gates;

    if (gates && gates.intake_context === 'PASS') intakeGatePassed = true;

    if (sc && sc.summary && sc.summary.coverage_verdict) {
      summary    = sc.summary;
      foundSkill = skill;
      break;
    }
  }

  // ── 5. Extra gate: PASS recorded but summary missing → diagnostic block ────────────
  // The narrow window between set-gate and set-payload, or a SKILL.md that skipped set-payload.
  if (!summary && intakeGatePassed) {
    process.stderr.write(
      `⛔ MANIFEST READ GUARD — intake_context=PASS but no cached summary found (ADO ${ado})\n\n` +
      `  The manifest-summary write (set-payload source_context.summary) may have been\n` +
      `  skipped or not yet run. Re-run the Step 1.5 summary flush:\n\n` +
      `    VERIFY_OUT=$(node "$PLUGIN_DIR/scripts/intake-verify.cjs" verify \\\n` +
      `      --manifest=docs/migrations/${ado}/source-context-manifest.md \\\n` +
      `      --skill=<skill> --json)\n` +
      `    # Then write source_context with summary — see SKILL.md Step 1.5 flush block.\n\n` +
      `  After writing the summary, retry the operation.\n`
    );
    process.exit(2);
  }

  // ── 6. No cached summary yet — Step 1.5 still in progress → allow ─────────────────
  if (!summary) process.exit(0);

  // ── 7. Summary cached — block and redirect to ledger ─────────────────────────────
  process.stderr.write(
    `⛔ MANIFEST READ GUARD — blocked Read of source-context-manifest.md (ADO ${ado})\n\n` +
    `  A cached summary is stored in the ledger from Step 1.5 completion.\n` +
    `  Reading the full manifest wastes ~16,000 tokens. Use the cached summary:\n\n` +
    `    node scripts/checkpoint-ledger.cjs get --skill=${foundSkill} --ado=${ado} --json\n` +
    `    → checkpoint.payload.${foundSkill}.source_context.summary\n\n` +
    `  Cached values:\n` +
    `    coverage_verdict     : ${summary.coverage_verdict}\n` +
    `    modules_total        : ${summary.modules_total ?? 'n/a'}\n` +
    `    modules_mapped       : ${summary.modules_mapped ?? 'n/a'}\n` +
    `    modules_out_of_scope : ${summary.modules_out_of_scope ?? 'n/a'}\n` +
    `    partial_row_count    : ${summary.partial_row_count ?? 0}\n\n` +
    `  To re-verify after manifest revision:\n` +
    `    1. node scripts/intake-verify.cjs verify --manifest=<path> --skill=${foundSkill} --json\n` +
    `    2. Overwrite source_context.summary via set-payload (see SKILL.md Step 1.5 flush block)\n` +
    `    3. Retry the operation.\n`
  );
  process.exit(2);
});
