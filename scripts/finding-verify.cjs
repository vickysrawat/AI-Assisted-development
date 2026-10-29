#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Grounding gate for scan findings (code-review / security) BEFORE they are written
//                      to a ledger. For each finding it checks, deterministically:
//                        1. the "Vulnerable code" snippet exists VERBATIM and UNIQUELY in the cited file
//                           (reports the real line, or the exact file text when only indentation differs);
//                           for SCA dependency findings (kind: "dependency") it checks instead that the
//                           vulnerable package@version is really declared in the cited manifest;
//                        2. the "Fix" is paste-able: no placeholders ("..."), not comment-only, every
//                           identifier it uses exists in the repo / the vulnerable snippet / is declared by
//                           the fix itself / is declared external, Python keyword arguments match the
//                           real signature of repo functions (catches invented `conn=` params), and the
//                           file still parses with the fix applied (Python, CommonJS);
//                        3. computes the FP-xxxxxxxx fingerprint per fingerprint-spec.md (with collision
//                           suffixing against an existing ledger) so IDs are never hand-typed;
//                      and returns a verdict per finding: fingerprint | needs-confirmation |
//                      manual-fix-required | requote | invalid.
//                      The `audit-ledger` mode runs checks 1–2 over the Open / Needs-Confirmation blocks
//                      of an existing ledger, reports which entries may be marked Fixed, flags FP IDs that
//                      look hand-assigned (e.g. FP-a1b2c3d4), and lists legacy security table rows.
// What it touches:     READS the repo source tree (skipping build/vendor/report folders), the findings
//                      JSON, and the ledger. Writes only throwaway copies of patched Python files to an
//                      OS temp dir for the syntax probe (removed afterwards). Results go to stdout.
// What it does NOT do: Does not modify the ledger or any repo file; never executes repo code; no network
//                      calls; no git.
// APIs / commands:     Node stdlib: fs, path, os, crypto (SHA-1), vm (compile-only, never run), child_process.spawnSync
//                      for ONE batched `python -I -c "ast.parse(...)"` syntax probe (parsed, never executed).
// How to verify:       node tests/finding-verify.test.cjs  -> "N passed · 0 failed".
//
// Usage:
//   node scripts/finding-verify.cjs check        --root=<repo> --findings=<json> [--ledger=<md>]
//   node scripts/finding-verify.cjs audit-ledger --root=<repo> --ledger=<md>
// Findings JSON: [{ checker, file, category, short_description, line?, vulnerable_code, fix?,
//                   external_symbols?: [names], needs_confirmation?: "question for the developer",
//                   kind?: "dependency", package?, version?, evidence? }]
// Exit codes: 0 = ran (read the verdicts) · 1 = usage / input error.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const vm = require('vm');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
const [mode, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => {
  const i = a.indexOf('=');
  return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));

function fail(msg) { process.stderr.write(msg + '\n'); process.exit(1); }

// ---------------------------------------------------------------------------
// Repo corpus — every identifier that exists somewhere in the project source
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'bin', 'obj', 'target', 'coverage',
  '.venv', 'venv', '__pycache__', '.next', '.angular', 'CodeReviews', 'security', 'dynamic-scan', '.claude',
  'memory', 'temp', 'test-results']);
const SRC_EXT = new Set(['.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.cs', '.java', '.kt', '.go', '.sql',
  '.html', '.vue', '.json', '.yml', '.yaml', '.sh', '.ps1', '.toml', '.cfg', '.ini', '.xml', '.config']);
// Files whose "fix" is config/shell/DDL — identifier resolution is meaningless there
const NO_SYMBOL_CHECK = /(^|[\\/])(Dockerfile[^\\/]*|\.dockerignore|\.gitignore|\.env[^\\/]*)$|\.(ya?ml|sh|ps1|sql|json|toml|ini|cfg|xml|config|md)$/i;

function buildCorpus(root) {
  const ids = new Set();
  const pyDefs = new Map(); // python function name -> [param-list text]
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const ext = path.extname(e.name);
      if (!SRC_EXT.has(ext) && !/^Dockerfile/.test(e.name)) continue;
      let text;
      try { if (fs.statSync(p).size > 2e6) continue; text = fs.readFileSync(p, 'utf8'); } catch (_) { continue; }
      for (const id of text.match(/[A-Za-z_$][\w$]*/g) || []) ids.add(id);
      if (ext === '.py') collectPyDefs(text, pyDefs);
    }
  })(root);
  return { ids, pyDefs };
}

function collectPyDefs(text, pyDefs) {
  const re = /\bdef\s+([A-Za-z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 1, i = re.lastIndex;
    while (i < text.length && depth > 0) { if (text[i] === '(') depth++; else if (text[i] === ')') depth--; i++; }
    const params = text.slice(re.lastIndex, i - 1);
    if (!pyDefs.has(m[1])) pyDefs.set(m[1], []);
    pyDefs.get(m[1]).push(params);
  }
}

// ---------------------------------------------------------------------------
// Language noise that is never a "repo symbol"
// ---------------------------------------------------------------------------
const BUILTINS = new Set((
  // Python
  'if else elif for while return def class import from as with try except finally raise pass break continue lambda ' +
  'yield async await not and or in is None True False self cls global nonlocal del assert print len range int float str ' +
  'bool list dict set tuple bytes object type isinstance issubclass round abs min max sum any all sorted reversed ' +
  'enumerate zip map filter open super getattr setattr hasattr iter next repr format Exception ValueError TypeError ' +
  'KeyError IndexError RuntimeError AttributeError NotImplementedError StopIteration OSError ' +
  // JS / TS
  'const let var function new this typeof instanceof null undefined true false catch throw switch case default export ' +
  'extends implements interface delete void of do static get set NaN Infinity Math Number String Array Object Promise ' +
  'JSON Date Error RegExp Map Set WeakMap Symbol Boolean BigInt console window document globalThis isNaN isFinite ' +
  'parseInt parseFloat encodeURIComponent decodeURIComponent setTimeout clearTimeout fetch localStorage ' +
  'sessionStorage then finally resolve reject allSettled length push pop shift slice splice map filter reduce forEach ' +
  'includes indexOf join split trim startsWith endsWith toString keys values entries has add get set ' +
  'useState useEffect useCallback useRef useMemo useContext useReducer current ' +
  // C# / Java
  'public private protected internal readonly sealed abstract virtual override using namespace void string decimal ' +
  'double long short byte char object var Task await async lock out ref params nameof is as base throws final ' +
  'package boolean Integer Long Double List ArrayList HashMap Optional'
).split(' '));
const SQL_KEYWORDS = new Set(('SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE MERGE WITH NOLOCK UPDLOCK ' +
  'HOLDLOCK ROWLOCK SERIALIZABLE OUTPUT INSERTED DELETED JOIN LEFT RIGHT INNER OUTER ON AND OR NOT NULL IS IN AS ' +
  'ORDER BY GROUP HAVING TOP DISTINCT BEGIN END TRAN TRANSACTION COMMIT ROLLBACK EXISTS CASE WHEN THEN ELSE').split(' '));

// Remove string literals and comments so their contents are not treated as symbols
function stripStringsComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\w])\/\/[^\n]*/g, '$1')
    .replace(/(^|\s)#[^\n]*/g, '$1')
    .replace(/[rbfu]{0,2}"""[\s\S]*?"""/gi, '""')
    .replace(/[rbfu]{0,2}'''[\s\S]*?'''/gi, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/[rbfu]{0,2}"(?:\\.|[^"\\\n])*"/gi, '""')
    .replace(/[rbfu]{0,2}'(?:\\.|[^'\\\n])*'/gi, "''");
}

// Names the fix legitimately introduces itself (locals, params, loop vars, new functions/classes)
function declaredIn(code) {
  const names = new Set();
  const patterns = [
    /\b(?:def|class|function|const|let|var|interface|enum|type)\s+([A-Za-z_$][\w$]*)/g,
    /^\s*([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=(?![=>])/gm,                 // x = ... / x: T = ...
    /\bfor\s*\(?\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)/g,
    /\b(?:as|except\s+\w+\s+as)\s+([A-Za-z_]\w*)/g,
    /\blambda\s+([^:]*):/g,
    /\bdef\s+\w+\s*\(([^)]*)\)/g,
    /\bfunction\s*\w*\s*\(([^)]*)\)/g,
    /\(([^()]*)\)\s*=>/g,
    /\b([A-Za-z_$][\w$]*)\s*=>/g,
    /\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g,                           // destructuring
    /\b[A-Z]\w*(?:<[^>\n]*>)?\??\s+([a-z_]\w*)\s*[=;]/g,                   // C#/Java: Type name =
    /^\s*([A-Z_][A-Z0-9_]*)\s*=/gm,                                         // CONSTANT = (python/js module level)
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code))) for (const n of (m[1].match(/[A-Za-z_$][\w$]*/g) || [])) names.add(n);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Check 1 — vulnerable snippet is verbatim and unique in the file
// ---------------------------------------------------------------------------
function checkSnippet(root, file, snippet, claimedLine) {
  if (!file) return { status: 'FILE_MISSING' };
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { status: 'FILE_MISSING' };
  if (!snippet || !snippet.trim()) return { status: 'NOT_FOUND' };
  const src = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  const want = snippet.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
  const lineOf = idx => src.slice(0, idx).split('\n').length;

  const hits = [];
  for (let i = src.indexOf(want); i >= 0; i = src.indexOf(want, i + 1)) hits.push(lineOf(i));
  if (hits.length === 1) {
    const out = { status: 'EXACT', found_line: hits[0] };
    if (claimedLine && Math.abs(claimedLine - hits[0]) > 3) out.line_mismatch = { claimed: claimedLine, actual: hits[0] };
    return out;
  }
  if (hits.length > 1) return { status: 'AMBIGUOUS', occurrences: hits };

  // Same lines, different indentation — /fix str_replace would still miss, so hand back the exact text
  const wantLines = want.split('\n').map(l => l.trim()).filter(Boolean);
  const srcLines = src.split('\n');
  const trimmed = srcLines.map(l => l.trim());
  for (let i = 0; i + wantLines.length <= trimmed.length; i++) {
    let ok = true;
    for (let k = 0; k < wantLines.length && ok; k++) ok = trimmed[i + k] === wantLines[k];
    if (ok) return { status: 'INDENT_ONLY', found_line: i + 1, exact_text: srcLines.slice(i, i + wantLines.length).join('\n') };
  }
  const matched = wantLines.filter(l => trimmed.includes(l)).length;
  return { status: 'NOT_FOUND', lines_matched: `${matched}/${wantLines.length}` };
}

// ---------------------------------------------------------------------------
// Check 1b — (SCA) the vulnerable package@version is actually declared in the manifest
// ---------------------------------------------------------------------------
// package/version come from the finding, or are parsed from evidence "pkg@1.2.3 — description"
function dependencyOf(f) {
  if (f.package && f.version) return { name: String(f.package), version: String(f.version) };
  const m = String(f.evidence || '').match(/^\s*(@?[^@\s]+)@([^\s,;]+)/);
  return m ? { name: m[1], version: m[2] } : null;
}

function checkDependency(root, file, name, version, claimedLine) {
  if (!file) return { status: 'FILE_MISSING' };
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { status: 'FILE_MISSING' };
  const lines = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Package names are case-insensitive in pip/NuGet; bound them so "react" does not match "react-dom"
  const nameRe = new RegExp(`(^|[\\s"'=:<>\\[,/])${esc(name)}($|[\\s"'=:<>@\\],;/])`, 'i');
  const ver = version.replace(/^[\^~>=<v\s]+/, '');
  const verRe = new RegExp(`(^|[^\\w.])[\\^~>=<v]*${esc(ver)}($|[^\\w.])`);
  for (let i = 0; i < lines.length; i++) {
    if (!nameRe.test(lines[i])) continue;
    // Same line (package.json, requirements.txt, .csproj) or the next few (package-lock "version": …)
    for (let k = i; k <= Math.min(lines.length - 1, i + 3); k++) {
      if (verRe.test(lines[k])) {
        const out = { status: 'DECLARED', found_line: k + 1, exact_text: lines[k] };
        if (claimedLine && claimedLine > 1 && Math.abs(claimedLine - (k + 1)) > 3) out.line_mismatch = { claimed: claimedLine, actual: k + 1 };
        return out;
      }
    }
  }
  return { status: 'NOT_DECLARED' };
}

// ---------------------------------------------------------------------------
// Check 2 — the fix is real, paste-able code
// ---------------------------------------------------------------------------
function checkFix(fix, finding, corpus) {
  if (!fix || !fix.trim()) return { status: 'none' };
  const clean = stripStringsComments(fix);
  if (!clean.trim()) return { status: 'comment-only' };

  // "..." / "…" used as an elision — JS spread (...items) and Python Ellipsis-as-value are excluded
  const placeholders = (clean.match(/…|\.\.\.(?![\w$({\[])/g) || []).length;
  if (placeholders) return { status: 'placeholder', placeholders };

  const out = { status: 'ok', unresolved: [], bad_kwargs: [] };
  if (NO_SYMBOL_CHECK.test(finding.file || '')) { out.symbol_check = 'skipped (config/shell/DDL file)'; return out; }

  const vulnIds = new Set((stripStringsComments(finding.vulnerable_code || '').match(/[A-Za-z_$][\w$]*/g)) || []);
  const declared = declaredIn(clean);
  const external = new Set(finding.external_symbols || []);
  for (const id of new Set(clean.match(/[A-Za-z_$][\w$]*/g) || [])) {
    if (id.length < 3 || BUILTINS.has(id) || SQL_KEYWORDS.has(id.toUpperCase())) continue;
    if (vulnIds.has(id) || declared.has(id) || external.has(id) || corpus.ids.has(id)) continue;
    out.unresolved.push(id);
  }

  // Python keyword arguments passed to repo functions whose signature has no such parameter
  if (/\.py$/.test(finding.file || '')) {
    const fixDefs = new Map();
    collectPyDefs(clean, fixDefs);                                  // a function the fix (re)defines wins
    const callRe = /\b([A-Za-z_]\w*)\s*\(([^()]*)\)/g;
    let m;
    while ((m = callRe.exec(clean))) {
      if (/\bdef\s+$/.test(clean.slice(0, m.index))) continue;     // the def line itself is not a call
      const defs = fixDefs.get(m[1]) || corpus.pyDefs.get(m[1]);
      if (!defs) continue;
      for (const kw of [...m[2].matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*=(?!=)/g)].map(x => x[1])) {
        const accepted = defs.some(p => p.includes('**') || new RegExp(`(^|[,(\\s*])${kw}\\s*[:=,)]|(^|[,\\s])${kw}\\s*$`).test(p));
        if (!accepted) out.bad_kwargs.push(`${m[1]}(${kw}=)`);
      }
    }
  }
  if (out.unresolved.length || out.bad_kwargs.length) out.status = 'unresolved';
  if (external.size) out.declared_external = [...external];
  return out;
}

// ---------------------------------------------------------------------------
// Check 3 — applying the fix to a temp copy of the file still parses
// (CommonJS JS: compiled in-process with vm.Script, never run · Python: ONE batched ast.parse run
//  over every file, never executed · ES modules, JSX/TS and other languages are skipped)
// ---------------------------------------------------------------------------
function jsCompiles(code) {
  try { new vm.Script(code); return 'ok'; } catch (e) { return e instanceof SyntaxError ? 'error' : 'unknown'; }
}

// Parse many Python sources with a single interpreter start; returns 'ok' | 'error' | 'unknown' per source
function pyParseAll(sources) {
  if (!sources.length) return [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finding-verify-'));
  try {
    const files = sources.map((src, i) => { const p = path.join(dir, `f${i}.py`); fs.writeFileSync(p, src); return p; });
    const probe = 'import ast,sys,json\nout=[]\nfor p in sys.argv[1:]:\n  try:\n    ast.parse(open(p,encoding="utf-8").read()); out.append("ok")\n  except SyntaxError:\n    out.append("error")\nprint(json.dumps(out))';
    for (const exe of ['python', 'python3', 'py']) {
      const r = spawnSync(exe, ['-I', '-c', probe, ...files], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
      if (r.error || r.status !== 0) continue;
      try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch (_) { continue; }
    }
    return sources.map(() => 'unknown');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// jobs: [{ root, file, snippet, fix, target }] — sets target.apply = { status: parses | syntax-error | skipped }
function applyAndParseAll(jobs) {
  const py = [];
  for (const j of jobs) {
    const ext = path.extname(j.file).toLowerCase();
    const src = fs.readFileSync(path.join(j.root, j.file), 'utf8').replace(/\r\n/g, '\n');
    const want = j.snippet.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
    const patched = src.replace(want, () => j.fix.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, ''));
    const isModule = ext === '.mjs' || (ext === '.js' && /^\s*(import|export)\b/m.test(src));
    if (ext === '.py') { py.push({ j, src, patched }); continue; }
    if (!['.js', '.cjs'].includes(ext) || isModule) {
      j.target.apply = { status: 'skipped', why: isModule ? 'ES module — not compiled' : `no parser for ${ext || 'this file type'}` };
      continue;
    }
    if (jsCompiles(src) !== 'ok') { j.target.apply = { status: 'skipped', why: 'original file does not compile' }; continue; }
    j.target.apply = jsCompiles(patched) === 'ok' ? { status: 'parses' } : { status: 'syntax-error' };
  }
  const verdicts = pyParseAll(py.flatMap(x => [x.src, x.patched]));
  py.forEach((x, i) => {
    const before = verdicts[2 * i], after = verdicts[2 * i + 1];
    x.j.target.apply = before !== 'ok' ? { status: 'skipped', why: before === 'unknown' ? 'python unavailable' : 'original file does not parse' }
      : after === 'ok' ? { status: 'parses' } : { status: 'syntax-error' };
  });
}

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------
function fingerprint(f) {
  const input = `${f.checker}|${f.file}|${f.category}|${f.short_description}`;
  return 'FP-' + crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
}

// True for IDs a human or model typed instead of hashing: FP-a1b2c3d4, FP-e9f0a1b2, FP-00000000, FP-01234567
function looksHandAssigned(fp) {
  const h = (fp || '').replace(/^FP-/, '').slice(0, 8).toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(h)) return false;
  if (/^(.)\1{7}$/.test(h)) return true;
  const HEX = '0123456789abcdef';
  if (HEX.includes(h) || 'fedcba9876543210'.includes(h)) return true;
  const LET = 'abcdef', DIG = '0123456789';
  let pairs = true;
  for (let i = 0; i < 8 && pairs; i++) {
    const set = i % 2 === 0 ? LET : DIG;
    if (!set.includes(h[i])) { pairs = false; break; }
    if (i >= 2 && h[i] !== set[(set.indexOf(h[i - 2]) + 1) % set.length]) pairs = false;
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Ledger parsing (structure per ledger-schema.md)
// ---------------------------------------------------------------------------
function parseLedger(text) {
  const blocks = [];
  let section = '', cur = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^## /.test(line)) { if (cur) blocks.push(cur); cur = null; section = line.slice(3).trim(); continue; }
    if (/^### /.test(line)) { if (cur) blocks.push(cur); cur = { section, head: line, body: [] }; continue; }
    if (cur) cur.body.push(line);
  }
  if (cur) blocks.push(cur);
  return blocks.map(b => {
    const field = name => {
      const re = new RegExp(`^- \\*\\*${name}\\*\\*: ?(.*)$`);
      for (const l of b.body) { const m = l.match(re); if (m) return m[1].trim(); }
      return null;
    };
    const fence = name => {
      const i = b.body.findIndex(l => l.startsWith(`- **${name}**`));
      if (i < 0) return null;
      let j = i + 1;
      while (j < b.body.length && !/^\s*```/.test(b.body[j])) { if (/^- \*\*/.test(b.body[j])) return null; j++; }
      if (j >= b.body.length) return null;
      const indent = b.body[j].match(/^\s*/)[0].length;
      const lines = [];
      for (j++; j < b.body.length && !/^\s*```\s*$/.test(b.body[j]); j++) {
        lines.push(b.body[j].slice(Math.min(indent, b.body[j].match(/^\s*/)[0].length)));
      }
      return lines.join('\n');
    };
    const idm = b.head.match(/\[(FP-[0-9a-f]+)\]/);
    const loc = field('Location') || '';
    const lm = loc.match(/\bline[s]?\s+(\d+)/i);
    return {
      fp: idm ? idm[1] : null, section: b.section, status: field('Status'),
      file: field('File'), line: lm ? Number(lm[1]) : null, verified: Boolean(field('Verified')),
      vulnerable_code: fence('Vulnerable code'), fix: fence('Fix'),
      kind: /dependency-upgrade/i.test(field('Fix kind') || '') ? 'dependency' : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Verdict — the single place that decides what may enter the ledger with an FP ID
// ---------------------------------------------------------------------------
function verdictFor(snippet, fixRes, finding) {
  const reasons = [];
  if (snippet.status !== 'EXACT' && snippet.status !== 'DECLARED') {
    reasons.push({
      FILE_MISSING: 'cited file does not exist',
      NOT_FOUND: 'vulnerable code is not in the file verbatim — re-quote it from the file or drop the finding',
      INDENT_ONLY: 'vulnerable code differs from the file in indentation — re-quote exact_text',
      AMBIGUOUS: 'vulnerable code occurs more than once — extend it until it is unique',
      NOT_DECLARED: 'package@version is not declared in this manifest — cite the file that pins it (the lockfile, for a transitive dependency) or drop the finding',
      NO_PACKAGE: 'dependency finding has no package@version — supply package and version (or evidence "pkg@ver — …")',
    }[snippet.status]);
    return { verdict: 'requote', reasons };
  }
  if (snippet.line_mismatch) reasons.push(`cited line ${snippet.line_mismatch.claimed} is wrong — use ${snippet.line_mismatch.actual}`);
  if (fixRes.status === 'advisory-upgrade') return { verdict: 'fingerprint', reasons };   // dependency: the fix is a version bump
  if (fixRes.status !== 'ok') {
    reasons.push({
      none: 'no fix supplied',
      'comment-only': 'fix is a comment/instruction, not code',
      placeholder: 'fix contains "..." placeholders — not paste-able',
      unresolved: `fix uses names that do not exist: ${[...(fixRes.unresolved || []), ...(fixRes.bad_kwargs || [])].join(', ')}`,
    }[fixRes.status]);
    return { verdict: 'manual-fix-required', reasons };
  }
  if (fixRes.apply && fixRes.apply.status === 'syntax-error') {
    reasons.push('applying the fix in place of the vulnerable code leaves the file with a syntax error');
    return { verdict: 'manual-fix-required', reasons };
  }
  if (finding.needs_confirmation) return { verdict: 'needs-confirmation', reasons };
  if (/\[Needs Verification\]/i.test(finding.short_description || '')) {
    reasons.push('tagged [Needs Verification] without a needs_confirmation question — add the question or prove the path');
    return { verdict: 'needs-confirmation', reasons };
  }
  return { verdict: 'fingerprint', reasons };
}

// ---------------------------------------------------------------------------
// Evaluate — snippet + fix checks, one batched parse pass, then verdicts
// ---------------------------------------------------------------------------
function evaluate(root, items, corpus) {
  const jobs = [];
  for (const it of items) {
    const f = it.finding;
    if (f.kind === 'dependency') {
      // SCA: prove the vulnerable package@version is really declared; the fix is a version bump, not a paste
      const pkg = dependencyOf(f);
      it.snippet = pkg ? checkDependency(root, f.file, pkg.name, pkg.version, f.line)
        : (f.vulnerable_code ? checkSnippet(root, f.file, f.vulnerable_code, f.line) : { status: 'NO_PACKAGE' });
      it.fix = { status: 'advisory-upgrade' };
      continue;
    }
    it.snippet = checkSnippet(root, f.file, f.vulnerable_code, f.line);
    it.fix = checkFix(f.fix, f, corpus);
    if (it.snippet.status === 'EXACT' && it.fix.status === 'ok') {
      jobs.push({ root, file: it.finding.file, snippet: it.finding.vulnerable_code, fix: it.finding.fix, target: it.fix });
    }
  }
  applyAndParseAll(jobs);
  for (const it of items) Object.assign(it, verdictFor(it.snippet, it.fix, it.finding));
  return items;
}

const tallyOf = rs => rs.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + 1, a), {});

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
function runCheck() {
  if (!args.root || !args.findings) fail('Usage: finding-verify.cjs check --root=<repo> --findings=<json> [--ledger=<md>]');
  let findings;
  try { findings = JSON.parse(fs.readFileSync(args.findings, 'utf8')); } catch (e) { fail(`Cannot read findings JSON: ${e.message}`); }
  if (!Array.isArray(findings)) fail('Findings JSON must be an array');

  // Existing ledger IDs -> file, for the collision rule in fingerprint-spec.md
  const taken = new Map();
  if (args.ledger && fs.existsSync(args.ledger)) {
    for (const b of parseLedger(fs.readFileSync(args.ledger, 'utf8'))) if (b.fp) taken.set(b.fp, b.file);
  }
  const invalid = [], items = [];
  findings.forEach((f, index) => {
    const missing = ['checker', 'file', 'category', 'short_description'].filter(k => !f[k]);
    if (missing.length) { invalid.push({ index, verdict: 'invalid', reasons: missing.map(k => `missing field: ${k}`) }); return; }
    const base = fingerprint(f);
    let fp = base;
    for (let s = 98; taken.has(fp) && taken.get(fp) !== f.file; s++) fp = base + String.fromCharCode(s); // b, c, ...
    taken.set(fp, f.file);
    items.push({ index, fp, finding: f });
  });
  evaluate(args.root, items, buildCorpus(args.root));
  const results = [...invalid, ...items.map(it => {
    const r = { index: it.index, fp: it.fp, verdict: it.verdict, reasons: it.reasons, snippet: it.snippet, fix: it.fix };
    if (it.finding.fp && it.finding.fp !== it.fp) r.fp_supplied_mismatch = it.finding.fp;
    return r;
  })].sort((a, b) => a.index - b.index);
  process.stdout.write(JSON.stringify({ mode: 'check', summary: tallyOf(results), results }, null, 2) + '\n');
}

function runAudit() {
  if (!args.root || !args.ledger) fail('Usage: finding-verify.cjs audit-ledger --root=<repo> --ledger=<md>');
  if (!fs.existsSync(args.ledger)) fail(`Ledger not found: ${args.ledger}`);
  const ledgerText = fs.readFileSync(args.ledger, 'utf8');
  const blocks = parseLedger(ledgerText).filter(b => b.fp);
  // Pre-1.1 security IaC/SCA output was appended as table rows — `| FP-… | SEC-… | Open | … |` —
  // which the commit gate (it reads "### [FP-" blocks) never saw. Report them for conversion.
  const legacyRows = [];
  ledgerText.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const m = l.match(/^\|\s*(FP-[0-9a-f]+)\s*\|\s*(SEC-[A-Z-]+)\s*\|\s*([\w-]+)\s*\|/);
    if (m) legacyRows.push({ fp: m[1], id: m[2], status: m[3], line: i + 1 });
  });
  const items = blocks.filter(b => /^(Open|needs-confirmation)$/i.test(b.status || '')).map(b => ({ finding: b }));
  evaluate(args.root, items, buildCorpus(args.root));
  const byFp = new Map(items.map(it => [it.finding.fp, it]));
  const results = blocks.map(b => {
    const r = { fp: b.fp, section: b.section, status: b.status, file: b.file };
    if (looksHandAssigned(b.fp)) r.provenance = 'suspect-hand-assigned';
    const it = byFp.get(b.fp);
    if (it) {
      Object.assign(r, { verdict: it.verdict, reasons: it.reasons, snippet: it.snippet, fix: it.fix, verified: b.verified });
      // Absence proves a fix only when the snippet was proven verbatim when it was recorded
      const gone = ['NOT_FOUND', 'FILE_MISSING'].includes(it.snippet.status);
      r.fixed_candidate = gone && b.verified;
      if (gone && !b.verified) r.provenance = [r.provenance, 'snippet-unverified'].filter(Boolean).join(', ');
    }
    return r;
  });
  const audited = results.filter(r => r.verdict);
  const summary = {
    audited: audited.length,
    verdicts: tallyOf(audited),
    suspect_hand_assigned_ids: results.filter(r => looksHandAssigned(r.fp)).map(r => r.fp),
    fixed_candidates: results.filter(r => r.fixed_candidate).map(r => r.fp),
    unverified_snippets: results.filter(r => /snippet-unverified/.test(r.provenance || '')).map(r => r.fp),
    legacy_table_rows: legacyRows,
  };
  process.stdout.write(JSON.stringify({ mode: 'audit-ledger', summary, results }, null, 2) + '\n');
}

if (require.main === module) {
  if (mode === 'check') runCheck();
  else if (mode === 'audit-ledger') runAudit();
  else fail('Usage: finding-verify.cjs <check|audit-ledger> --root=<repo> [--findings=<json>] [--ledger=<md>]');
}

module.exports = { checkSnippet, checkFix, fingerprint, looksHandAssigned, parseLedger, verdictFor, evaluate, buildCorpus };
