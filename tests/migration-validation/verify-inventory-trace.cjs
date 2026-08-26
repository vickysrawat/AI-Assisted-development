#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Reads a Stage 0.6 inventory (single file or index+per-cluster dir), extracts
//                      every PROV: token, resolves each against the SOURCE tree (at the baseline SHA
//                      when pinnable, else the working tree), and reports missing files / out-of-range
//                      lines, parse-coverage (F-rows and GAP lines lacking a PROV token), dangling
//                      spine refs (F-NN/GAP-NN cited downstream but absent from the inventory), and
//                      snapshot-pinning status.
// What it touches:     READ-ONLY. Reads the inventory path(s), the SOURCE tree, and optional
//                      --recordings / --feasibility inputs. No files created or modified.
// What it does NOT do: No writes, no network, no git mutations (only read-only `git show`/`cat-file`),
//                      no LLM calls, no semantic judgement of whether a cited line means what is claimed.
// APIs / commands:     Node fs, path, child_process.execFileSync('git', ['show'|'cat-file', ...]).
// How to verify:       Run against tests/migration-validation/fixtures/_selftest — the good fixture
//                      exits 0; the bad fixture exits 1 and names each injected defect.
//
// verify-inventory-trace.cjs — Stage 0.6 inventory trace + spine verifier (Tier A, deterministic).
//
// Validates the migration Source Behavioral Inventory's ONE hard guarantee: every behaviour carries a
// machine-readable PROV: token that resolves to a real file:line in the SOURCE. This is Tier A only —
// gross-hallucination + spine/coverage smoke test. It deliberately does NOT judge whether the cited
// line *means* what the behaviour claims (that is Tier B / LLM, run elsewhere).
//
// Usage:
//   node verify-inventory-trace.cjs --inventory <path|dir> --source <SOURCE_PATH>
//        [--baseline <sha>] [--recordings <dir>] [--feasibility <path>] [--strict] [--json]
//
// Exit: 0 = no hard failures; 1 = at least one missing file / out-of-range line / dangling spine ref
//       (warnings alone do not fail unless --strict).

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------- arg parsing ----------
function parseArgs(argv) {
  const a = { strict: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--strict') a.strict = true;
    else if (t === '--json') a.json = true;
    else if (t.startsWith('--')) a[t.slice(2)] = argv[++i];
  }
  return a;
}

// ---------- inventory file discovery ----------
function inventoryFiles(invPath) {
  const st = fs.statSync(invPath);
  if (st.isDirectory()) {
    return fs.readdirSync(invPath)
      .filter(f => /source-inventory.*\.md$/i.test(f))
      .map(f => path.join(invPath, f));
  }
  return [invPath];
}

// ---------- PROV token extraction ----------
// Grammar (source-inventory-spec.md): PROV:<relpath>#L<start>[-L<end>]  |  PROV:cluster:<name>
const PROV_RE = /PROV:(cluster:[A-Za-z0-9_.\/-]+|[^\s`|)\]]+?#L\d+(?:-L\d+)?)/g;

function extractProv(text, file) {
  const out = [];
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    let m;
    PROV_RE.lastIndex = 0;
    while ((m = PROV_RE.exec(line)) !== null) {
      const payload = m[1];
      if (payload.startsWith('cluster:')) {
        out.push({ kind: 'cluster', name: payload.slice(8), file, lineNo: idx + 1, raw: m[0] });
      } else {
        const pm = payload.match(/^(.*)#L(\d+)(?:-L(\d+))?$/);
        out.push({
          kind: 'file', relpath: pm[1], start: +pm[2], end: pm[3] ? +pm[3] : null,
          file, lineNo: idx + 1, raw: m[0],
        });
      }
    }
  });
  return out;
}

// ---------- IDs (spine) ----------
const FID_RE = /\bF-\d{2,}\b/g;
const GID_RE = /\bGAP-\d{2,}\b/g;
function idsIn(text) {
  return {
    features: new Set(text.match(FID_RE) || []),
    gaps: new Set(text.match(GID_RE) || []),
  };
}

// ---------- parse-coverage: F-rows and GAP lines must carry a PROV token ----------
function coverageItems(text) {
  const items = [];
  text.split('\n').forEach((line, idx) => {
    const isFRow = /^\|\s*F-\d+/.test(line);
    const isGap = /^GAP-\d+/.test(line);
    if (isFRow || isGap) items.push({ lineNo: idx + 1, kind: isGap ? 'gap' : 'feature', hasProv: /PROV:/.test(line) });
  });
  return items;
}

// ---------- snapshot resolution ----------
// DECISION: how to resolve PROV paths to source content
// Options considered:
//   A) Always read the working tree — rejected: silently validates against a drifted source, defeating
//      the "review is against this snapshot" guarantee.
//   B) Require a pinnable git SHA, hard-fail otherwise — rejected: source is often non-git or a copy
//      (spec header allows "@ timestamp"), which would make the verifier unusable on the common case.
//   C) Prefer the baseline SHA via read-only `git show`; fall back to the working tree and REPORT
//      snapshot-integrity: UNVERIFIABLE — chosen: honest, always-runnable, never silently drifts.
function resolveSnapshot(source, baseline) {
  if (baseline) {
    try {
      execFileSync('git', ['-C', source, 'cat-file', '-e', baseline], { stdio: 'ignore' });
      return { mode: 'git', sha: baseline, verifiable: true };
    } catch { /* fall through */ }
  }
  return { mode: 'worktree', sha: null, verifiable: false };
}

function readSource(source, relpath, snap) {
  try {
    if (snap.mode === 'git') {
      const buf = execFileSync('git', ['-C', source, 'show', `${snap.sha}:${relpath}`], { maxBuffer: 64 * 1024 * 1024 });
      return buf.toString('utf8');
    }
    return fs.readFileSync(path.join(source, relpath), 'utf8');
  } catch {
    return null; // missing
  }
}

// ---------- baseline from header ----------
function headerBaseline(text) {
  const m = text.match(/Source baseline:.*@\s*([0-9a-f]{7,40})\b/i);
  return m ? m[1] : null;
}

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv);
  if (!args.inventory || !args.source) {
    console.error('usage: verify-inventory-trace.cjs --inventory <path|dir> --source <dir> [--baseline <sha>] [--recordings <dir>] [--feasibility <path>] [--strict] [--json]');
    process.exit(2);
  }

  const files = inventoryFiles(args.inventory);
  const invText = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const baseline = args.baseline || headerBaseline(invText);
  const snap = resolveSnapshot(args.source, baseline);

  const provAll = files.flatMap(f => extractProv(fs.readFileSync(f, 'utf8'), f));
  const fails = [];   // hard failures
  const warns = [];   // advisories

  // 1) Trace resolution (file tokens)
  const cache = new Map();
  let resolved = 0, clusterTokens = 0;
  for (const p of provAll) {
    if (p.kind === 'cluster') { clusterTokens++; continue; }
    if (!cache.has(p.relpath)) cache.set(p.relpath, readSource(args.source, p.relpath, snap));
    const content = cache.get(p.relpath);
    if (content === null) { fails.push(`MISSING FILE  ${p.raw}  (cited in ${path.basename(p.file)}:${p.lineNo})`); continue; }
    const lineCount = content.split('\n').length;
    const worst = p.end || p.start;
    if (worst > lineCount) { fails.push(`LINE OUT OF RANGE  ${p.raw}  (file has ${lineCount} lines; cited in ${path.basename(p.file)}:${p.lineNo})`); continue; }
    resolved++;
  }

  // 2) Parse-coverage
  const items = files.flatMap(f => coverageItems(fs.readFileSync(f, 'utf8')));
  const missingProv = items.filter(i => !i.hasProv);
  const coveragePct = items.length ? Math.round(100 * (items.length - missingProv.length) / items.length) : 100;
  missingProv.forEach(i => warns.push(`ITEM WITHOUT PROV  ${i.kind} at line ${i.lineNo}`));
  if (clusterTokens > 0) warns.push(`${clusterTokens} coarse cluster-level PROV token(s) — prefer file:line where possible`);

  // 3) Spine integrity — downstream refs must resolve to inventory IDs
  const invIds = idsIn(invText);
  const downstream = [];
  if (args.feasibility) downstream.push(fs.readFileSync(args.feasibility, 'utf8'));
  if (args.recordings) {
    for (const f of fs.readdirSync(args.recordings).filter(f => f.endsWith('.json'))) {
      downstream.push(fs.readFileSync(path.join(args.recordings, f), 'utf8'));
    }
  }
  for (const d of downstream) {
    const dIds = idsIn(d);
    dIds.features.forEach(id => { if (!invIds.features.has(id)) fails.push(`DANGLING SPINE REF  ${id} referenced downstream but absent from inventory`); });
    dIds.gaps.forEach(id => { if (!invIds.gaps.has(id)) fails.push(`DANGLING SPINE REF  ${id} referenced downstream but absent from inventory`); });
  }

  // 4) Snapshot integrity
  if (!snap.verifiable) warns.push(`snapshot-integrity: UNVERIFIABLE — resolved against working tree (baseline ${baseline || 'none'} not pinnable); source may have drifted since sign-off`);

  // ---------- report ----------
  const report = {
    inventoryFiles: files.map(f => path.basename(f)),
    snapshot: snap.verifiable ? `git @ ${snap.sha}` : 'working-tree (UNVERIFIABLE)',
    provTokens: provAll.length, fileTokensResolved: resolved, clusterTokens,
    parseCoveragePct: coveragePct, itemsChecked: items.length, itemsMissingProv: missingProv.length,
    hardFailures: fails, warnings: warns,
  };
  if (args.json) { console.log(JSON.stringify(report, null, 2)); }
  else {
    console.log(`\n  Inventory trace verification`);
    console.log(`  ${'─'.repeat(52)}`);
    console.log(`  Files:      ${report.inventoryFiles.join(', ')}`);
    console.log(`  Snapshot:   ${report.snapshot}`);
    console.log(`  PROV:       ${provAll.length} tokens (${resolved} file resolved, ${clusterTokens} cluster)`);
    console.log(`  Coverage:   ${coveragePct}% of ${items.length} items carry a PROV token`);
    fails.forEach(f => console.log(`  ✗ ${f}`));
    warns.forEach(w => console.log(`  ⚠ ${w}`));
    console.log(`  ${'─'.repeat(52)}`);
    console.log(`  ${fails.length === 0 ? '✓ PASS' : '✗ FAIL'}  (${fails.length} hard, ${warns.length} advisory)\n`);
  }

  const failed = fails.length > 0 || (args.strict && warns.length > 0);
  process.exit(failed ? 1 : 0);
}

main();
