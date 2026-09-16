#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Fail-closed source-context intake gate for the migration family (upgrade ·
//                      rewrite · replatform). `verify` validates the Source Context Manifest:
//                      every expected root covered, every PROV citation resolves to a real
//                      file+line, no PARTIAL integration whose source is reachable, no source
//                      module left unaccounted (graph.json denominator), behavior-bearing units
//                      cited to source not a doc, and the cross-cutting concern scan present +
//                      source-grounded. `check-gate` re-validates from the ledger so a
//                      hand-set gate is not trusted (the keystone that makes intake unskippable).
// What it touches:     READ-ONLY. Reads the manifest, graph.json, settings.local.json, an optional
//                      integration inventory, source docs, and the migration ledger. Writes NOTHING.
// What it does NOT do: No LLM, no network, no git, no ledger writes (the skill records the gate on
//                      exit 0), no inference beyond the documented heuristic.
// APIs / commands:     Node fs, path. Reuses the multi-root scanRoots() contract (multi-root-scan.md).
//   node scripts/intake-verify.cjs verify --manifest=<md> --skill=<rewrite|upgrade|replatform> [--graph=<json>] [--inventory=<md>] [--json]
//   node scripts/intake-verify.cjs check-gate --ado=<id> [--file=<ledger>] [--graph=<json>] [--json]
// How to verify:       verify exits 0 ok · 2 manifest missing · 3 root uncovered · 4 dangling
//                      citation · 5 PARTIAL w/ reachable source · 6 unwired dependency · 7 module
//                      unaccounted · 8 behavior unit cited to a doc · 9 cross-cutting scan
//                      missing/empty/uncited.  check-gate: 0 ok · 10 gate not
//                      PASS/ledger absent · 11 re-validation failed.  node tests/intake-verify.test.cjs

'use strict';
const fs   = require('fs');
const path = require('path');

const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const normP = p => p ? path.resolve(p).replace(/[\\/]+$/, '').split('\\').join('/') : '';
const DOC_EXT = /\.(md|markdown|txt|adoc|rst)$/i;

// --- multi-root roots (contract: multi-root-scan.md; repo first, then additionalDirectories) ------
function scanRoots(settingsPath) {
  const repo = normP(process.cwd());
  const roots = [repo];
  try {
    const s = JSON.parse(fs.readFileSync(settingsPath || '.claude/settings.local.json', 'utf8'));
    const dirs = Array.isArray(s.additionalDirectories) ? s.additionalDirectories : [];
    for (const d of dirs) {
      const nd = normP(d);
      if (!nd || !fs.existsSync(nd)) continue;                       // skip-missing
      if (roots.some(r => nd === r || nd.startsWith(r + '/'))) continue; // dup / nested
      roots.push(nd);
    }
  } catch (_) { /* no settings → repo only */ }
  return [...new Set(roots)];
}

function emit(obj, humanLines, code) {
  if (JSON_OUT) console.log(JSON.stringify({ ...obj, exit: code }, null, 2));
  else humanLines.forEach(l => (code === 0 ? console.log : console.error)(l));
  process.exit(code);
}

// Resolve a cited path against the repo and every scan root. Returns {ok, file, line}.
// A citation is `path#anchor`; a numeric `#L<n>` anchor is line-checked, a `#section` anchor is not.
function resolveCitation(token, roots) {
  const [relRaw, anchor] = token.split('#');
  const rel = (relRaw || '').trim();
  const lm = anchor && anchor.match(/^L?(\d+)/);
  const line = lm ? parseInt(lm[1], 10) : null;
  if (!rel) return { ok: false, reason: 'no-path' };
  if (rel.includes('*')) return { ok: true, file: rel, line, glob: true }; // globs not line-checked
  for (const root of roots) {
    const abs = path.resolve(root, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      if (line != null) {
        const n = fs.readFileSync(abs, 'utf8').split('\n').length;
        if (line > n) return { ok: false, file: rel, line, reason: `line ${line} > ${n}` };
      }
      return { ok: true, file: rel, line, ext: path.extname(abs) };
    }
  }
  return { ok: false, file: rel, line, reason: 'unresolved' };
}

// Pull every PROV citation (`path#anchor` — must carry a #line or #section anchor) out of the text.
// Requiring an anchor is what keeps prose mentions of a filename from being treated as citations.
function citations(text) {
  const out = [];
  const re = /([A-Za-z0-9_./\\*-]+#[A-Za-z0-9_.-]+)/g;
  let m; while ((m = re.exec(text))) out.push(m[1].replace(/\\/g, '/'));
  return [...new Set(out)];
}

// Markdown table rows as arrays of trimmed cells.
function tableRows(text) {
  return text.split('\n').filter(l => l.trim().startsWith('|'))
    .map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
    .filter(cells => !cells.every(c => /^-*:?-*$/.test(c) || c === '')); // drop separators/blank
}

// ── verify ───────────────────────────────────────────────────────────────────
function opVerify() {
  const manifest = arg('manifest');
  const skill = (arg('skill') || '').toLowerCase();
  if (!manifest || !skill) emit({}, ['Usage: intake-verify.cjs verify --manifest=<md> --skill=<rewrite|upgrade|replatform> [--graph] [--inventory] [--json]'], 1);

  if (!fs.existsSync(manifest) || fs.readFileSync(manifest, 'utf8').trim() === '')
    emit({ reason: 'manifest-missing' }, [`❌ Manifest missing/empty: ${manifest} — read the source first.`], 2);

  const text = fs.readFileSync(manifest, 'utf8');
  const roots = scanRoots(arg('settings'));

  // (3) every expected root covered — matched by full path or last segment appearing in the manifest.
  const hay = text.replace(/\\/g, '/').toLowerCase();
  const uncovered = roots.filter(r => {
    const seg = r.split('/').pop().toLowerCase();
    return !(hay.includes(r.toLowerCase()) || hay.includes(seg));
  });
  if (uncovered.length) emit({ reason: 'root-uncovered', uncovered }, [`❌ Root(s) not covered by the manifest: ${uncovered.join(', ')}`], 3);

  // (4) every citation resolves.
  const dangling = citations(text).map(t => resolveCitation(t, roots)).filter(r => !r.ok);
  if (dangling.length) emit({ reason: 'dangling-citation', dangling }, [`❌ ${dangling.length} PROV citation(s) do not resolve:`, ...dangling.map(d => `   ${d.file || '?'}${d.line ? '#L' + d.line : ''} — ${d.reason}`)], 4);

  // (5) PARTIAL / unknown integration whose source is reachable under a configured root.
  const invPath = arg('inventory');
  const invText = invPath && fs.existsSync(invPath) ? fs.readFileSync(invPath, 'utf8') : text;
  const partialReachable = tableRows(invText)
    .filter(r => r.some(c => /^(partial|unknown)$/i.test(c)))
    .filter(r => citations(r.join(' ')).some(t => resolveCitation(t, roots).ok));
  if (partialReachable.length) emit({ reason: 'partial-reachable', rows: partialReachable.map(r => r.join(' | ')) },
    [`❌ ${partialReachable.length} PARTIAL/unknown row(s) whose source is reachable — resolve now, do not defer:`, ...partialReachable.map(r => '   ' + r.join(' | '))], 5);

  // (6) unwired dependency: dependency-like references in source docs not present in additionalDirectories.
  const docPaths = (arg('docs') || 'CLAUDE.md').split(',').map(s => s.trim()).filter(Boolean);
  const depTokens = new Set();
  for (const dp of docPaths) {
    if (!fs.existsSync(dp)) continue;
    const dt = fs.readFileSync(dp, 'utf8');
    let m; const re = /\b([A-Z][A-Za-z0-9]+(?:\.[A-Z][A-Za-z0-9]+)+)\b/g;  // Namespaced.Identifier
    while ((m = re.exec(dt))) depTokens.add(m[1]);
  }
  const rootSegs = roots.map(r => r.split('/').pop().toLowerCase());
  const manifestLc = text.toLowerCase();
  const unwired = [...depTokens].filter(t => {
    const seg = t.toLowerCase();
    const wired = rootSegs.some(rs => seg.includes(rs) || rs.includes(seg.split('.').pop()));
    const justified = manifestLc.includes(seg); // named + justified/mapped in the manifest
    return !wired && !justified;
  });
  if (unwired.length) emit({ reason: 'unwired-dependency', unwired_candidates: unwired },
    [`❌ Dependency-like references in source docs are neither wired (additionalDirectories) nor accounted for in the manifest:`, ...unwired.map(u => `   ${u}`), '   Wire the source, or record it in the manifest with a reason (judge confirms).'], 6);

  // (7)+(8) source coverage against graph.json (full accounting) + behavior-bearing cited to source.
  const graphPath = arg('graph') || '.claude/graph/graph.json';
  let modules = [];
  if (fs.existsSync(graphPath)) {
    const g = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    modules = (g.nodes || g.modules || []).map(n => ({ id: n.id || n.module || n.name, mod: n.module || '' }));
  }
  const rows = tableRows(text);
  const unaccounted = modules.filter(mo => {
    return !rows.some(r => {
      const joined = r.join(' ').toLowerCase();
      const named = joined.includes(String(mo.id).toLowerCase()) || (mo.mod && joined.includes(mo.mod.toLowerCase()));
      const disp  = /\b(mapped|out[- ]of[- ]scope)\b/.test(joined);
      return named && disp;
    });
  });
  if (unaccounted.length) emit({ reason: 'module-unaccounted', modules: unaccounted.map(m => m.id) },
    [`❌ ${unaccounted.length} source module(s) have no mapped/out-of-scope disposition (silent drop):`, ...unaccounted.map(m => `   ${m.id}`)], 7);

  const behaviorDocCited = rows
    .filter(r => /\b(business-logic|b-series|integration|behaviou?r|logging|auth|authentication|authorization|authn|authz|tracing|telemetry|error[- ]handling|error[- ]handler|exception|interceptor|middleware|aspect|cross[- ]cutting|caching|resilience|retry|validation)\b/i.test(r.join(' ')))
    .filter(r => { const cs = citations(r.join(' ')); return cs.length > 0 && cs.every(t => DOC_EXT.test(t.split('#')[0])); });
  if (behaviorDocCited.length) emit({ reason: 'behavior-cited-to-doc', rows: behaviorDocCited.map(r => r.join(' | ')) },
    [`❌ Behavior-bearing unit(s) cited to a doc, not source — cite the implementation file#line:`, ...behaviorDocCited.map(r => '   ' + r.join(' | '))], 8);

  // (9) cross-cutting concern scan — must be PRESENT, and for deep-scan skills grounded in source.
  //     Closes the "empty section passes silently" hole: an absent/blank scan is how infra behaviors
  //     (logging · auth · tracing · error-handling · DI/interceptors) slip through unread.
  const ccHead = text.match(/^#{1,6}[^\n]*cross[- ]cutting[^\n]*$/im);
  if (!ccHead) emit({ reason: 'cross-cutting-missing' },
    ['❌ No cross-cutting concern scan section — add a "## Cross-cutting concern scan" section (impl, not declaration).'], 9);
  const ccAfter = text.slice(ccHead.index + ccHead[0].length);
  const ccNext = ccAfter.search(/^#{1,6}\s/m);
  const ccSection = ccNext === -1 ? ccAfter : ccAfter.slice(0, ccNext);
  const ccRows = tableRows(ccSection);
  const ccSourceCites = citations(ccSection)
    .filter(t => !DOC_EXT.test(t.split('#')[0]) && resolveCitation(t, roots).ok);
  const deepScan = skill === 'rewrite' || skill === 'replatform';
  if (deepScan) {
    if (!ccRows.length) emit({ reason: 'cross-cutting-empty' },
      [`❌ Cross-cutting concern scan is empty — ${skill} requires a deep scan (logging · auth · tracing · error-handling · DI/interceptors), each cited to implementation source.`], 9);
    if (!ccSourceCites.length) emit({ reason: 'cross-cutting-uncited' },
      ['❌ Cross-cutting concern scan cites no resolvable source — cite the implementation (file#line), not a declaration or doc.'], 9);
  } else if (!ccRows.length && !/\b(none|no delta|n\/?a|not applicable)\b/i.test(ccSection)) {
    emit({ reason: 'cross-cutting-stub' },
      ['❌ Cross-cutting concern scan is an unfilled stub — record the delta, or state "none" explicitly.'], 9);
  }

  const mapped = rows.filter(r => /\bmapped\b/.test(r.join(' ').toLowerCase())).length;
  const oos    = rows.filter(r => /out[- ]of[- ]scope/.test(r.join(' ').toLowerCase())).length;
  emit({ skill, verified: true, roots_expected: roots, modules_total: modules.length, modules_mapped: mapped, modules_out_of_scope: oos, manifest_path: normP(manifest) },
    [`✅ Intake verified for ${skill}.`, `   roots: ${roots.length} · graph modules: ${modules.length} (mapped ${mapped} / out-of-scope ${oos}) · citations resolved.`, `   Record stage_gates.intake_context=PASS + core.source_context.`], 0);
}

// ── check-gate ─────────────────────────────────────────────────────────────────
function opCheckGate() {
  const ado = arg('ado');
  if (!ado) emit({}, ['Usage: intake-verify.cjs check-gate --ado=<id> [--file=<ledger>] [--graph] [--json]'], 1);
  const ledgerPath = arg('file') || path.join('.claude', 'migration', `${ado}.checkpoint.json`);
  if (!fs.existsSync(ledgerPath)) emit({ reason: 'ledger-absent', ledger: ledgerPath }, [`❌ No ledger for ADO ${ado} — intake not run. STOP.`], 10);

  const led = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  if ((led.stage_gates || {}).intake_context !== 'PASS')
    emit({ reason: 'gate-not-pass', gate: (led.stage_gates || {}).intake_context || null }, [`❌ stage_gates.intake_context is not PASS — run intake-verify.cjs verify first. STOP.`], 10);

  // Re-validate rather than trust the boolean (keystone).
  const sc = led.source_context || {};
  const problems = [];
  if (!sc.manifest_path || !fs.existsSync(sc.manifest_path)) problems.push('manifest_path missing on disk');
  else {
    const cites = citations(fs.readFileSync(sc.manifest_path, 'utf8')).length;
    const expected = (sc.roots_expected || []).length || 1;
    if (cites < expected) problems.push(`citations (${cites}) < expected roots (${expected})`);
  }
  const graphPath = arg('graph') || '.claude/graph/graph.json';
  if (fs.existsSync(graphPath)) {
    const g = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    const total = (g.nodes || g.modules || []).length;
    const accounted = (sc.modules_mapped || 0) + (sc.modules_out_of_scope || 0);
    if (total && accounted !== total) problems.push(`accounted ${accounted} ≠ graph modules ${total} (full accounting)`);
  }
  // keystone: re-validate the cross-cutting scan (verify's exit-9 rule) so a hand-set gate can't bypass it.
  if (sc.manifest_path && fs.existsSync(sc.manifest_path)) {
    const mtext = fs.readFileSync(sc.manifest_path, 'utf8');
    const cc = mtext.match(/^#{1,6}[^\n]*cross[- ]cutting[^\n]*$/im);
    if (!cc) problems.push('cross-cutting concern scan section missing');
    else if (sc.skill === 'rewrite' || sc.skill === 'replatform') {
      const after = mtext.slice(cc.index + cc[0].length);
      const nh = after.search(/^#{1,6}\s/m);
      if (!tableRows(nh === -1 ? after : after.slice(0, nh)).length)
        problems.push('cross-cutting concern scan empty');
    }
  }
  if (problems.length) emit({ reason: 're-validation-failed', problems }, [`❌ intake_context=PASS but re-validation failed:`, ...problems.map(p => `   ${p}`)], 11);

  emit({ ado, gate: 'PASS', source_context: sc }, [`✅ Intake gate PASS re-validated for ADO ${ado}.`], 0);
}

if (OP === 'verify') opVerify();
else if (OP === 'check-gate') opCheckGate();
else emit({}, ['Usage: intake-verify.cjs <verify|check-gate> ... [--json]'], 1);
