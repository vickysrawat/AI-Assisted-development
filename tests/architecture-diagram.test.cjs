#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/architecture-diagram.py (ADO-8001 Story 1): every example
//                      spec renders and passes --check, an ADO-90-format spec still renders, the
//                      new hosting presets are known, todo: true adds the "Unverified" legend entry,
//                      --check exits 1 when an arrow has no clear path, and spec mistakes give a
//                      one-line "spec error:". The Python cases are skipped with a notice when
//                      Python 3.10+ / matplotlib / pyyaml are missing (ARCH_DIAGRAM_PYTHON=none
//                      forces that). The AC-F13 allow-list case always runs: every hostname / IP
//                      in the skill folder, the fixtures and the two scripts must be a
//                      documentation value (RFC 2606 / RFC 5737). Exits 0 if all pass, 1 if any fail.
// What it touches:     Reads scripts/, skills/arch-diagram/, tests/fixtures/arch-diagram/. Runs
//                      python on the renderer; writes PNGs and small specs only under a temp folder
//                      in os.tmpdir(), removed at the end.
// What it does NOT do: No network calls, no git operations, no writes inside the repository.
// APIs / commands:     Node stdlib: child_process.spawn / spawnSync, fs, os, path.
//                      python scripts/architecture-diagram.py <spec> <png> [--check].
//                      require('../scripts/arch-spec-scan.cjs').
// How to verify:       node tests/architecture-diagram.test.cjs -> "N passed · 0 failed", exit 0.
//                      ARCH_DIAGRAM_PYTHON=none node tests/architecture-diagram.test.cjs -> skip notice, exit 0.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { extractHosts, isDocHost } = require('../scripts/arch-spec-scan.cjs');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'architecture-diagram.py');
const EXAMPLES = path.join(ROOT, 'skills', 'arch-diagram', 'references', 'examples');
// No __pycache__ inside the repository when the tests import the renderer.
const PY_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' };
let passed = 0;
let failed = 0;

/**
 * Records one named check as passed or failed and prints it.
 */
function assert(name, condition, detail) {
  if (condition) {
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } else {
    failed++;
    process.stdout.write(`  ✗ ${name}\n      ${detail || ''}\n`);
  }
}

/**
 * Finds a Python 3.10+ with matplotlib and pyyaml: ARCH_DIAGRAM_PYTHON if set ('none' = pretend
 * there is none), else python3, else python. Returns the command or null.
 */
function resolvePython() {
  const forced = process.env.ARCH_DIAGRAM_PYTHON;
  if (forced === 'none') return null;
  const probe = 'import sys, matplotlib, yaml; assert sys.version_info >= (3, 10)';
  for (const cmd of forced ? [forced] : ['python3', 'python', 'py']) {
    const r = spawnSync(cmd, ['-c', probe], { encoding: 'utf8', env: PY_ENV });
    if (r.status === 0) return cmd;
  }
  return null;
}

/**
 * Runs a command without blocking, so several renders can run at the same time.
 * Resolves to { status, stdout, stderr }.
 */
function run(cmd, args) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { env: PY_ENV });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

/**
 * Lists every file below a folder (empty list when the folder does not exist yet).
 */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

// ---- AC-F13 allow-list: always runs, no Python needed ----------------------------------------
function allowListCase() {
  process.stdout.write('AC-F13 allow-list (no real hostnames or IPs)\n');
  const CODE = new Set(['.js', '.cjs', '.mjs', '.ts', '.py', '.cs', '.java', '.sh', '.ps1']);
  // Server names without dots in docs / config / specs must be visibly made up.
  const MADE_UP_NAME = /^(?:[a-z0-9-]*contoso[a-z0-9-]*|[a-z0-9-]*example[a-z0-9-]*|localhost)$/i;
  const BINARY = new Set(['.png', '.jpg', '.gif', '.ico', '.pdf', '.docx']);
  const trees = [path.join(ROOT, 'skills', 'arch-diagram'), path.join(ROOT, 'tests', 'fixtures', 'arch-diagram')];
  const files = [...trees.flatMap(walk), SCRIPT, path.join(ROOT, 'scripts', 'arch-spec-scan.cjs')]
    .filter(f => !BINARY.has(path.extname(f).toLowerCase()));
  const bad = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    // Strict mode (any dotted lower-case name) for docs and config; normal mode for code,
    // where dotted identifiers such as self.name are everywhere.
    const hosts = extractHosts(fs.readFileSync(file, 'utf8'), { markdown: ext === '.md', strict: !CODE.has(ext) });
    for (const h of hosts) {
      // A dotless key value (server: web01) cannot be judged in code, where "server" is often a
      // variable; in docs, config and specs it is a server name and must be a made-up one.
      if (h.kind === 'name' && CODE.has(ext)) continue;
      const ok = h.kind === 'name' ? MADE_UP_NAME.test(h.value) : isDocHost(h.value);
      if (!ok) bad.push(`${path.relative(ROOT, file)}:${h.line} ${h.value}`);
    }
  }
  assert(`AC-F13 P-U8 every hostname / IP in ${files.length} files is a documentation value`, bad.length === 0, bad.join('\n      '));
}

// ---- AC-NF3: the suite passes without Python -----------------------------------------------
function noPythonCase() {
  if (process.env.ARCH_DIAGRAM_SELFTEST) return; // the child run below must not recurse
  const r = spawnSync('node', [__filename], {
    encoding: 'utf8',
    env: { ...process.env, ARCH_DIAGRAM_PYTHON: 'none', ARCH_DIAGRAM_SELFTEST: '1' },
  });
  assert('AC-NF3 P-U9 without Python the renderer cases are skipped with a notice and the run passes',
    r.status === 0 && r.stdout.includes('skipped — python/matplotlib not found'), `${r.status} ${r.stdout}`);
}

// ---- Renderer cases (need Python) -------------------------------------------------------------
async function rendererCases(py) {
  process.stdout.write('architecture-diagram.py\n');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archdiag-'));
  const spec = (name, text) => {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, text);
    return p;
  };
  const png = name => path.join(tmp, `${name}.png`);
  const render = (specPath, name, extra = []) => run(py, [SCRIPT, specPath, png(name), '--dpi', '60', ...extra]);

  const presets = ['docker-host', 'compose-service', 'node-server', 'process-manager', 'reverse-proxy',
    'linux-server', 'container-apps', 'aws-ecs', 'aws-lambda', 'aws-rds', 's3', 'app-server'];
  const presetSpec = spec('presets.yaml', [
    'title: "Preset grid"',
    'zones:',
    '  - name: "All new presets"',
    '    columns: 4',
    '    components:',
    ...presets.map(t => `      - {id: ${t}, name: "${t}", type: ${t}}`),
  ].join('\n'));
  // A spec in the ADO-90 format (no todo keys anywhere).
  const ado90Spec = spec('ado90.yaml', [
    'title: "Contoso Billing — Recovery"',
    'zones:',
    '  - {id: uz, name: "", style: plain, components: [{id: users, name: Users, type: users, tag: ""}]}',
    '  - name: "Primary"',
    '    row: 1',
    '    span: 2',
    '    components:',
    '      - {id: web, name: web01, type: iis-server, children: [{id: site, name: Billing, type: iis-site}]}',
    '      - {id: db, name: SQL, type: sql-server, details: ["sql.contoso.example.com"]}',
    '  - {name: "DR", row: 1, style: failover, components: [{id: web2, name: web02, type: iis-server, standby: true}]}',
    'flows:',
    '  - {from: users, to: site, label: "HTTPS"}',
    '  - {from: site, to: db}',
    '  - {from: db, to: web2, kind: recovery, label: "Restore"}',
  ].join('\n'));
  const badTodo = spec('bad-todo.yaml', 'zones:\n  - name: Z\n    components:\n      - {id: a, name: A, todo: "yes"}\n');
  const badFlow = spec('bad-flow.yaml', 'zones:\n  - name: Z\n    components:\n      - {id: a, name: A}\nflows:\n  - {from: a, to: nowhere}\n');
  const unknownType = spec('unknown.yaml', 'zones:\n  - name: Z\n    components:\n      - {id: a, name: A, type: mainframe}\n');

  // Legend entries come from a pure function, so they are read without parsing the PNG.
  const legendOf = file => run(py, ['-c', [
    'import importlib.util, json, sys',
    'from pathlib import Path',
    `s = importlib.util.spec_from_file_location("ad", r"${SCRIPT}")`,
    'm = importlib.util.module_from_spec(s); s.loader.exec_module(m)',
    `z, f = m.build(m.load_spec(Path(r"${file}")))`,
    'print(json.dumps([e[0] for e in m.legend_entries(z, f)]))',
  ].join('\n')]);
  // --check must fail when an arrow cannot be routed: force every route to fail.
  const forcedFallback = run(py, ['-c', [
    'import importlib.util, sys',
    `s = importlib.util.spec_from_file_location("ad", r"${SCRIPT}")`,
    'm = importlib.util.module_from_spec(s); s.loader.exec_module(m)',
    'm.Router.route = lambda self, a, b: None',
    `sys.argv = ["architecture-diagram.py", r"${ado90Spec}", r"${png('forced')}", "--dpi", "60", "--check"]`,
    'm.main()',
  ].join('\n')]);

  // check() must report every kind of problem: draw a clean spec, then break it on purpose.
  const brokenLayout = run(py, ['-c', [
    'import importlib.util, json',
    'from pathlib import Path',
    `s = importlib.util.spec_from_file_location("ad", r"${SCRIPT}")`,
    'm = importlib.util.module_from_spec(s); s.loader.exec_module(m)',
    `zones, flows, fb = m.draw(m.load_spec(Path(r"${ado90Spec}")), r"${png('broken')}", 40)`,
    'nodes = {n.id: n for z in zones for n in z.walk()}',
    'zones[2].rect = zones[1].rect                                   # overlap',
    'w = nodes["web"].rect',
    'nodes["site"].rect = (w[2] + 5, w[1], w[2] + 15, w[1] + 5)       # not inside',
    'flows[0].points = [(1.0, 1.0), (6.0, 6.0)]                      # diagonal, off edge',
    'u = nodes["users"].rect; cy = (u[1] + u[3]) / 2',
    'flows[1].points = [(u[0] - 1, cy), (u[2] + 1, cy)]              # crosses a box',
    't = m.label_rects(zones[1])[0]; ty = (t[1] + t[3]) / 2',
    'flows[2].points = [(t[0] - 1, ty), (t[2] + 1, ty)]              # crosses heading text',
    'flows[1].badge_xy = (flows[0].badge_xy[0] + 1, flows[0].badge_xy[1])   # badges on top of each other',
    'print(json.dumps(m.check(zones, flows, fb)))',
  ].join('\n')]);
  // Long dotted / camelCase names break at "." or a capital, not mid-word.
  const wrapCase = run(py, ['-c', [
    'import importlib.util, json',
    `s = importlib.util.spec_from_file_location("ad", r"${SCRIPT}")`,
    'm = importlib.util.module_from_spec(s); s.loader.exec_module(m)',
    'print(json.dumps([m.wrap("RealEstateTracker.UI.Web", 12, m.TITLE_SIZE, True), m.wrap("Plain words wrap on spaces", 14, m.DETAIL_SIZE)]))',
    'print(json.dumps([m.badge_spot([(0, 0), (2, 0)], []), m.badge_spot([(5, 5)], [(1, 1)])]))',
  ].join('\n')]);

  // The generated-spec example in spec-format.md (Story 2) must render cleanly too.
  const formatDoc = fs.readFileSync(path.join(ROOT, 'skills', 'arch-diagram', 'references', 'spec-format.md'), 'utf8');
  const generated = /## Example: generated[\s\S]*?```yaml\r?\n([\s\S]*?)```/.exec(formatDoc);
  const generatedSpec = spec('generated-example.yaml', generated ? generated[1] : 'zones: []\n');

  const examples = fs.readdirSync(EXAMPLES).filter(f => f.endsWith('.yaml')).sort();
  const [exampleRuns, ado90, presetRun, todoRun, flowRun, unknownRun, legendTodo, legendPlain, fallback, broken,
    generatedRun, wrapRun] =
    await Promise.all([
      Promise.all(examples.map(f => render(path.join(EXAMPLES, f), path.basename(f, '.yaml'), ['--check']))),
      render(ado90Spec, 'ado90', ['--check']),
      render(presetSpec, 'presets'),
      render(badTodo, 'bad-todo'),
      render(badFlow, 'bad-flow'),
      render(unknownType, 'unknown'),
      legendOf(path.join(EXAMPLES, 'node-server.yaml')),
      legendOf(path.join(EXAMPLES, 'kubernetes.yaml')),
      forcedFallback,
      brokenLayout,
      render(generatedSpec, 'generated-example', ['--check']),
      wrapCase,
    ]);

  let wrapped = [];
  let spots = [];
  try {
    const out = wrapRun.stdout.trim().split(/\r?\n/);
    wrapped = JSON.parse(out[0]);
    spots = JSON.parse(out[1]);
  } catch (err) { wrapped = []; }
  assert('badge_spot handles a first badge on a short arrow and a one-point route (no crash)',
    JSON.stringify(spots) === JSON.stringify([[1, 0], [5, 5]]), `${JSON.stringify(spots)} ${wrapRun.stderr}`);
  assert('long dotted / camelCase names break at "." or a capital, plain text on spaces',
    JSON.stringify(wrapped) === JSON.stringify([['RealEstate', 'Tracker.UI.Web'], ['Plain words wrap on', 'spaces']]),
    `${JSON.stringify(wrapped)} ${wrapRun.stderr}`);

  assert('AC-F6 AC-F8 the generated-spec example in spec-format.md renders with check: ok',
    generated !== null && generatedRun.status === 0 && generatedRun.stdout.includes('check: ok'),
    `${generatedRun.status} ${generatedRun.stdout}${generatedRun.stderr}`);
  assert('AC-F3 P-U1 the example folder has the five hosting examples', examples.length === 5, examples.join(', '));
  examples.forEach((f, i) => {
    const r = exampleRuns[i];
    const name = path.basename(f, '.yaml');
    const size = fs.existsSync(png(name)) ? fs.statSync(png(name)).size : 0;
    assert(`AC-F3 AC-F4 P-U1 ${f}: renders, check: ok, no warnings`,
      r.status === 0 && r.stdout.includes('check: ok') && !/warning|Glyph/i.test(r.stderr) && size > 5000,
      `exit ${r.status} size ${size}\n${r.stdout}${r.stderr}`);
  });
  assert('AC-F3 P-U2 an ADO-90-format spec still renders and passes --check',
    ado90.status === 0 && ado90.stdout.includes('check: ok') && !/warning/i.test(ado90.stderr), `${ado90.status} ${ado90.stdout}${ado90.stderr}`);
  assert('AC-F3 P-U3 all 12 new presets are known types',
    presetRun.status === 0 && !/unknown type/.test(presetRun.stderr), presetRun.stderr);
  let todoLegend = [];
  let plainLegend = [];
  try {
    todoLegend = JSON.parse(legendTodo.stdout);
    plainLegend = JSON.parse(legendPlain.stdout);
  } catch (err) {
    process.stdout.write(`      legend output not JSON: ${legendTodo.stderr}${legendPlain.stderr}\n`);
  }
  assert('AC-F14 P-U4 todo: true adds "Unverified (⚠ TODO)" to the legend', todoLegend.includes('Unverified (⚠ TODO)'), JSON.stringify(todoLegend));
  assert('AC-F14 P-U5 no todo items: no "Unverified" legend entry',
    plainLegend.length > 0 && !plainLegend.some(t => t.startsWith('Unverified')), JSON.stringify(plainLegend));
  assert('AC-F4 N-U1 --check exits 1 and lists problems when an arrow has no clear path',
    fallback.status === 1 && fallback.stdout.includes('check: no clear path for flow') && /check: \d+ problems/.test(fallback.stdout),
    `${fallback.status} ${fallback.stdout}`);
  let problems = [];
  try {
    problems = JSON.parse(broken.stdout.trim().split('\n').pop());
  } catch (err) {
    process.stdout.write(`      check() output not JSON: ${broken.stderr}\n`);
  }
  const expectProblems = ['overlap', 'not inside', 'diagonal segment', 'crosses users', 'crosses the text of',
    'does not start/end on box edges', 'overlap'];
  assert('AC-F4 check() reports overlapping number badges', problems.some(x => /^badges \S+ and \S+ overlap$/.test(x)),
    JSON.stringify(problems));
  for (const p of expectProblems) {
    assert(`AC-F4 N-U1 check() reports "${p}"`, problems.some(x => x.includes(p)), JSON.stringify(problems));
  }
  assert('AC-F14 N-U2 todo must be true or false: one-line spec error, no PNG',
    todoRun.status === 1 && todoRun.stderr.trim() === 'spec error: todo must be true or false (component a)' && !fs.existsSync(png('bad-todo')),
    `${todoRun.status} ${todoRun.stderr}`);
  assert('AC-F3 N-U3 unknown flow endpoint: one-line spec error, no traceback',
    flowRun.status === 1 && flowRun.stderr.startsWith('spec error:') && !flowRun.stderr.includes('Traceback'), flowRun.stderr);
  assert('AC-F3 N-U4 unknown type: warning, plain box, exit 0',
    unknownRun.status === 0 && unknownRun.stderr.includes("unknown type 'mainframe'"), `${unknownRun.status} ${unknownRun.stderr}`);

  fs.rmSync(tmp, { recursive: true, force: true });
}

async function main() {
  allowListCase();
  noPythonCase();
  const py = resolvePython();
  if (py) {
    await rendererCases(py);
  } else {
    process.stdout.write('architecture-diagram: skipped — python/matplotlib not found\n');
  }
  process.stdout.write(`\n${passed} passed · ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  process.stdout.write(`  ✗ unexpected error: ${err.stack}\n`);
  process.exit(1);
});
