#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/intake-verify.cjs against temp fixtures and asserts the
//                      fail-closed exit contract: verify 0 (pass) · 2 (manifest-missing reason) ·
//                      2 (manifest-empty reason) · 4
//                      (dangling citation) · 7 (module unaccounted) · 8 (behavior cited to a doc) ·
//                      9 (cross-cutting scan missing/empty/uncited); check-gate 10 (ledger absent) ·
//                      11 (re-validation) · 0 (valid, re-validated). Exit 0 = all pass.
// What it touches:     Creates a throwaway fixture tree under os.tmpdir(); spawns node with cwd set
//                      there. Cleans up on exit. Never touches the repo working tree.
// What it does NOT do: No network, no git, no plugin state.
// APIs / commands:     Node fs, os, path; child_process.spawnSync.
// How to verify:       node tests/intake-verify.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'intake-verify.cjs');
let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

// --- build a fixture root -------------------------------------------------------
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-test-'));
const SEG  = path.basename(ROOT);
const W = (rel, body) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); };

W('.claude/settings.local.json', JSON.stringify({ additionalDirectories: [], migrationRoots: [ROOT] }));
W('.claude/graph/graph.json', JSON.stringify({
  meta: { schemaVersion: '1.0', moduleCount: 2 },
  nodes: [{ id: 'orders', module: 'Orders' }, { id: 'shared', module: 'Shared' }],
}));
W('CLAUDE.md', 'line1\nline2\n');
W('arch.md', 'a\nb\n');
W('src/orders.js', 'x\ny\nz\n');
W('src/shared.js', 'p\nq\n');

// A manifest that satisfies every check: root covered (SEG), citations resolve (with #anchors),
// both graph modules have a disposition, behavior-bearing row cited to source.
const goodManifest = `# Source Context Manifest

## Migration roots
| Root | Purpose | Covered | PROV |
|---|---|---|---|
| ${SEG} | Primary source | yes | CLAUDE.md#L1 |

## Source context files
| Doc | Path | Covered | PROV |
| agent-instructions | CLAUDE.md | yes | CLAUDE.md#L1 |

## Source coverage
| Source module | Disposition | Reason | PROV |
| orders (Orders) business-logic | mapped | cluster orders | src/orders.js#L1 |
| shared (Shared) | out-of-scope | shared util, unchanged | src/shared.js#L1 |

## Cross-cutting concern scan
| Concern | Implementation | PROV |
| logging | request logger | src/orders.js#L2 |
| error-handling | global handler | src/shared.js#L1 |
`;
W('manifest.md', goodManifest);

function run(args, opts = {}) {
  const r = spawnSync('node', [SCRIPT, ...args, '--json'], { cwd: ROOT, encoding: 'utf8' });
  let json = {}; try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status };
}

// 1 — verify pass
const ok = run(['verify', '--manifest=manifest.md', '--skill=rewrite']);
assert('verify pass -> exit 0 + verified', ok.code === 0 && ok.json.verified === true, `code=${ok.code} ${JSON.stringify(ok.json)}`);
assert('verify pass -> modules_total 2, fully accounted',
  ok.json.modules_total === 2 && (ok.json.modules_mapped + ok.json.modules_out_of_scope) === 2, JSON.stringify(ok.json));

// 2 — manifest missing (file does not exist)
const miss = run(['verify', '--manifest=nope.md', '--skill=rewrite']);
assert('missing manifest -> exit 2', miss.code === 2, `code=${miss.code}`);
assert('missing manifest -> reason=manifest-missing', miss.json.reason === 'manifest-missing', `reason=${miss.json.reason}`);

// 2 — manifest exists but is empty (file created, write failed or stub committed)
W('empty.md', '');
const emptyMan = run(['verify', '--manifest=empty.md', '--skill=rewrite']);
assert('empty manifest -> exit 2', emptyMan.code === 2, `code=${emptyMan.code}`);
assert('empty manifest -> reason=manifest-empty (distinct from manifest-missing)', emptyMan.json.reason === 'manifest-empty', `reason=${emptyMan.json.reason}`);

// 2 — whitespace-only manifest is also treated as empty
W('ws.md', '   \n\t  \n');
const wsMan = run(['verify', '--manifest=ws.md', '--skill=rewrite']);
assert('whitespace-only manifest -> exit 2 + reason=manifest-empty', wsMan.code === 2 && wsMan.json.reason === 'manifest-empty', `code=${wsMan.code} reason=${wsMan.json.reason}`);

// 4 — dangling citation
W('bad-cite.md', goodManifest + '\n| extra | mapped | x | src/ghost.js#L9 |\n');
const dang = run(['verify', '--manifest=bad-cite.md', '--skill=rewrite']);
assert('dangling citation -> exit 4', dang.code === 4, `code=${dang.code} ${JSON.stringify(dang.json)}`);

// 4 — A19: glob citation rejected (was unconditionally ok, bypassing disk check)
W('glob-cite.md', goodManifest + '| auth handler | mapped | all js | src/**/*.js#L1 |\n');
const globCite = run(['verify', '--manifest=glob-cite.md', '--skill=upgrade']);
assert('A19: glob citation -> exit 4', globCite.code === 4, `code=${globCite.code} ${JSON.stringify(globCite.json)}`);
assert('A19: glob citation -> reason=glob-citation in dangling array', (globCite.json.dangling || []).some(d => d.reason === 'glob-citation'), `dangling=${JSON.stringify(globCite.json.dangling)}`);

// 7 — a graph module with no disposition (drop the shared row)
W('drop.md', goodManifest.replace(/\| shared .*\n/, ''));
const drop = run(['verify', '--manifest=drop.md', '--skill=rewrite']);
assert('unaccounted module -> exit 7', drop.code === 7 && (drop.json.modules || []).includes('shared'), `code=${drop.code} ${JSON.stringify(drop.json)}`);

// 8 — behavior-bearing unit cited to a doc, not source
W('doc.md', goodManifest.replace('src/orders.js#L1', 'arch.md#L1'));
const doc = run(['verify', '--manifest=doc.md', '--skill=rewrite']);
assert('behavior cited to doc -> exit 8', doc.code === 8, `code=${doc.code} ${JSON.stringify(doc.json)}`);

// 9 — cross-cutting scan section absent (rewrite requires it)
W('nocc.md', goodManifest.replace(/## Cross-cutting concern scan[\s\S]*$/, ''));
const nocc = run(['verify', '--manifest=nocc.md', '--skill=rewrite']);
assert('cross-cutting missing -> exit 9', nocc.code === 9 && nocc.json.reason === 'cross-cutting-missing', `code=${nocc.code} ${JSON.stringify(nocc.json)}`);

// 9 — cross-cutting section present but empty (heading only, no rows)
W('emptycc.md', goodManifest.replace(/## Cross-cutting concern scan[\s\S]*$/, '## Cross-cutting concern scan\n\n'));
const emptycc = run(['verify', '--manifest=emptycc.md', '--skill=rewrite']);
assert('cross-cutting empty -> exit 9', emptycc.code === 9 && emptycc.json.reason === 'cross-cutting-empty', `code=${emptycc.code} ${JSON.stringify(emptycc.json)}`);

// 9 — cross-cutting rows present but cited only to a doc, not source
// (prose-only rows: no #anchor citation at all — exit 9 owns "section present but ungrounded";
//  a doc-anchored infra row is caught earlier by broadened exit 8, tested separately below.)
W('doccc.md', goodManifest.replace(/## Cross-cutting concern scan[\s\S]*$/,
  '## Cross-cutting concern scan\n| Concern | Implementation | Notes |\n| logging | request logger module | described in arch |\n'));
const doccc = run(['verify', '--manifest=doccc.md', '--skill=rewrite']);
assert('cross-cutting doc-only -> exit 9', doccc.code === 9 && doccc.json.reason === 'cross-cutting-uncited', `code=${doccc.code} ${JSON.stringify(doccc.json)}`);

// 8 — broadened keywords: an infra cross-cutting row (logging) cited to a doc, not source
W('infra8.md', goodManifest.replace('src/orders.js#L2', 'arch.md#L2'));
const infra8 = run(['verify', '--manifest=infra8.md', '--skill=rewrite']);
assert('infra concern cited to doc -> exit 8', infra8.code === 8, `code=${infra8.code} ${JSON.stringify(infra8.json)}`);

// 9 — FIRST-CLASS per-row grounding: a doc-cited concern row is NOT masked by a source-cited sibling,
//     even when its name is outside the exit-8 keyword list (the scenario that was slipping through).
W('maskcc.md', goodManifest.replace(/## Cross-cutting concern scan[\s\S]*$/,
  '## Cross-cutting concern scan\n| Concern | Implementation | PROV |\n| logging | request logger | src/orders.js#L2 |\n| feature-flags | toggle provider | arch.md#L1 |\n'));
const maskcc = run(['verify', '--manifest=maskcc.md', '--skill=rewrite']);
assert('cross-cutting doc-cited sibling not masked -> exit 9', maskcc.code === 9 && maskcc.json.reason === 'cross-cutting-uncited', `code=${maskcc.code} ${JSON.stringify(maskcc.json)}`);

// 9 — a header-only table (no concern rows) is empty, not "has rows"
W('headcc.md', goodManifest.replace(/## Cross-cutting concern scan[\s\S]*$/,
  '## Cross-cutting concern scan\n| Concern | Implementation | PROV |\n|---|---|---|\n'));
const headcc = run(['verify', '--manifest=headcc.md', '--skill=rewrite']);
assert('cross-cutting header-only -> exit 9 empty', headcc.code === 9 && headcc.json.reason === 'cross-cutting-empty', `code=${headcc.code} ${JSON.stringify(headcc.json)}`);

// upgrade is lenient (delta-only): an empty scan with an explicit "none" note passes
W('upcc.md', goodManifest.replace(/## Cross-cutting concern scan[\s\S]*$/, '## Cross-cutting concern scan\nnone — no cross-cutting delta in this upgrade.\n'));
const upcc = run(['verify', '--manifest=upcc.md', '--skill=upgrade']);
assert('upgrade empty-with-none -> exit 0', upcc.code === 0, `code=${upcc.code} ${JSON.stringify(upcc.json)}`);

// 10 — check-gate with no ledger
const noLed = run(['check-gate', '--ado=9000']);
assert('check-gate no ledger -> exit 10', noLed.code === 10, `code=${noLed.code}`);

// 0 — check-gate valid + re-validated
W('.claude/migration/9000.checkpoint.json', JSON.stringify({
  stage_gates: { intake_context: 'PASS' },
  source_context: { manifest_path: path.join(ROOT, 'manifest.md'), roots_expected: [ROOT], modules_mapped: 1, modules_out_of_scope: 1 },
}));
const gate = run(['check-gate', '--ado=9000']);
assert('check-gate valid -> exit 0', gate.code === 0 && gate.json.gate === 'PASS', `code=${gate.code} ${JSON.stringify(gate.json)}`);

// NOTE: The stored-counter accounting mismatch check (modules_mapped + modules_out_of_scope != graph
// total) was intentionally removed by A15. check-gate now re-runs opVerify() directly against the
// manifest and graph — live re-validation is more correct than comparing stale stored counters.
// A manifest that disposes all modules correctly passes check-gate even if source_context counters
// are wrong, because the live verify reads the manifest (the source of truth), not the summary.

// 11 — check-gate re-validation catches a missing cross-cutting scan (keystone; hand-set gate can't bypass)
W('.claude/migration/9002.checkpoint.json', JSON.stringify({
  stage_gates: { intake_context: 'PASS' },
  source_context: { manifest_path: path.join(ROOT, 'nocc.md'), roots_expected: [ROOT], modules_mapped: 1, modules_out_of_scope: 1, skill: 'rewrite' },
}));
const noccGate = run(['check-gate', '--ado=9002']);
assert('check-gate missing cross-cutting -> exit 11', noccGate.code === 11, `code=${noccGate.code} ${JSON.stringify(noccGate.json)}`);

// 3 — A18: no ## Migration roots section at all
W('no-mr-section.md', `# Source Context Manifest\n\n## Source context files\n| Doc | Path | Covered | PROV |\n| agent-instructions | CLAUDE.md | yes | CLAUDE.md#L1 |\n\n## Source coverage\n| Source module | Disposition | Reason | PROV |\n| orders (Orders) business-logic | mapped | cluster orders | src/orders.js#L1 |\n| shared (Shared) | out-of-scope | shared util, unchanged | src/shared.js#L1 |\n\n## Cross-cutting concern scan\n| Concern | Implementation | PROV |\n| logging | request logger | src/orders.js#L2 |\n| error-handling | global handler | src/shared.js#L1 |\n`);
const noMrSection = run(['verify', '--manifest=no-mr-section.md', '--skill=upgrade']);
assert('A18: no Migration roots section -> exit 3', noMrSection.code === 3, `code=${noMrSection.code} ${JSON.stringify(noMrSection.json)}`);
assert('A18: no Migration roots section -> detail=no-migration-roots-section', noMrSection.json.detail === 'no-migration-roots-section', `detail=${noMrSection.json.detail}`);

// 3 — A18: additional root missing from ## Migration roots table
const extraRoot = path.join(ROOT, 'a18-extra-dep');
fs.mkdirSync(extraRoot, { recursive: true });
const extraSeg = path.basename(extraRoot);
W('.claude/two-roots.settings.json', JSON.stringify({ migrationRoots: [ROOT, extraRoot] }));
const noExtraRow = run(['verify', '--manifest=manifest.md', '--skill=upgrade', '--settings=.claude/two-roots.settings.json']);
assert('A18: extra root not in table -> exit 3', noExtraRow.code === 3, `code=${noExtraRow.code} ${JSON.stringify(noExtraRow.json)}`);
assert('A18: extra root not in table -> reason=root-uncovered', noExtraRow.json.reason === 'root-uncovered', `reason=${noExtraRow.json.reason}`);

// 0 — A18: all roots declared in table -> exit 0
W('two-roots-manifest.md', goodManifest.replace(
  `| ${SEG} | Primary source | yes | CLAUDE.md#L1 |`,
  `| ${SEG} | Primary source | yes | CLAUDE.md#L1 |\n| ${extraSeg} | Extra dep | yes | CLAUDE.md#L1 |`
));
const allRootsInTable = run(['verify', '--manifest=two-roots-manifest.md', '--skill=upgrade', '--settings=.claude/two-roots.settings.json']);
assert('A18: all roots in table -> exit 0', allRootsInTable.code === 0, `code=${allRootsInTable.code} ${JSON.stringify(allRootsInTable.json)}`);

// 3 — roots-not-initialized: migrationRoots absent from settings
W('.claude/no-roots.settings.json', JSON.stringify({ additionalDirectories: [] }));
const noRoots = run(['verify', '--manifest=manifest.md', '--skill=upgrade', '--settings=.claude/no-roots.settings.json']);
assert('roots-not-initialized -> exit 3', noRoots.code === 3, `code=${noRoots.code} ${JSON.stringify(noRoots.json)}`);
assert('roots-not-initialized -> reason field', noRoots.json.reason === 'roots-not-initialized', `reason=${noRoots.json.reason}`);

// 3 — root-missing: a migrationRoots entry does not exist on disk
const nonExistentRoot = path.join(ROOT, 'nonexistent-root-for-test');
W('.claude/bad-root.settings.json', JSON.stringify({ migrationRoots: [ROOT, nonExistentRoot] }));
const badRoot = run(['verify', '--manifest=manifest.md', '--skill=upgrade', '--settings=.claude/bad-root.settings.json']);
assert('root-missing -> exit 3', badRoot.code === 3, `code=${badRoot.code} ${JSON.stringify(badRoot.json)}`);
assert('root-missing -> reason field', badRoot.json.reason === 'root-missing', `reason=${badRoot.json.reason}`);

// --- cleanup + summary ----------------------------------------------------------
try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (_) {}
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
