#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Scans /arch-diagram spec files (or text on stdin) before they are saved:
//                      secret values (--secrets), hostnames / IP addresses (--hosts), and
//                      zones / components / flows with no "# source:" or "⚠ TODO" (--sources;
//                      with --root=<dir> it also checks each cited file and line exists), and
//                      the key names (never values) of settings templates (--keys), and that
//                      every "# manual" item of a saved spec is kept unchanged (--manual-kept=).
//                      Reports line numbers and pattern names only — never the secret value
//                      itself. Exits 1 when --secrets or --sources finds a problem, else 0.
// What it touches:     Reads the files named on the command line, or standard input with
//                      --stdin; with --root it checks that cited files exist and counts their
//                      lines. Nothing else.
// What it does NOT do: Writes no files, makes no network calls, runs no git commands, never
//                      prints a matched secret value.
// APIs / commands:     Node stdlib: fs.readFileSync, path. module.exports for tests.
// How to verify:       node scripts/arch-spec-scan.cjs --secrets --hosts --sources <spec.yaml>
//                      -> "secrets: none" and a host list; exit 0.
//                      node tests/arch-spec-scan.test.cjs -> "N passed · 0 failed", exit 0.
// ADO-8001 (Story 1). --secrets / --hosts: AC-F7 (wired into the skill in Story 2).
// extractHosts + isDocHost: AC-F13 allow-list test. --sources / checkSources: AC-F6 (Story 2).
// --manual-kept / checkManualKept: AC-F10 (Story 3).

'use strict';
const fs = require('fs');
const path = require('path');

// Secret patterns, checked one line at a time. A value only counts when it is a single
// token (no spaces), so prose such as "Password: stored in Key Vault" is not reported.
// Key names are matched with (?<![A-Za-z]) instead of \b so DB_PASSWORD or
// SESSION_SIGNING_SECRET are caught. Placeholders (${X}, {{x}}, <x>, ***, your-…, changeme)
// are skipped.
const PLACEHOLDER = String.raw`(?!["']?\s*(?:\$\{|\{\{|<|\*{3,}|your[-_]|xxx|placeholder|changeme))`;
const VALUE_END = String.raw`["']?\s*(?:[,}\]#]|$)`;
const PATTERNS = [
  {
    label: 'password',
    re: new RegExp(String.raw`(?<![A-Za-z])(?:password|passwd|pwd)(?![A-Za-z])["']?\s*[:=]\s*` + PLACEHOLDER + String.raw`["']?[^\s"',}\]#]{4,}` + VALUE_END, 'i'),
  },
  {
    // a quoted value may contain spaces: password: "correct horse battery"
    label: 'password',
    re: new RegExp(String.raw`(?<![A-Za-z])(?:password|passwd|pwd)(?![A-Za-z])["']?\s*[:=]\s*(["'])` + PLACEHOLDER + String.raw`[^"']{4,}\1`, 'i'),
  },
  {
    // YAML block scalar: the value is on the next lines (password: | or >)
    label: 'password (block value)',
    re: /(?<![A-Za-z])(?:password|passwd|pwd)(?![A-Za-z])["']?\s*:\s*[|>][+-]?\s*$/i,
  },
  {
    // generic secret / token names: the value must look generated (10+ chars, a letter and a digit)
    label: 'secret/token/key',
    re: new RegExp(String.raw`(?<![A-Za-z])(?:secret|token)(?![A-Za-z])["']?\s*[:=]\s*` + PLACEHOLDER + String.raw`["']?(?=[^\s"',}\]#]*[0-9])(?=[^\s"',}\]#]*[A-Za-z])[A-Za-z0-9_\-+/=.]{10,}` + VALUE_END, 'i'),
  },
  {
    // specific key names: any 16+ character token counts, letters only included
    label: 'secret/token/key',
    re: new RegExp(String.raw`(?<![A-Za-z])(?:client[_-]?secret|api[_-]?key|access[_-]?key|secret[_-]?key)(?![A-Za-z])["']?\s*[:=]\s*` + PLACEHOLDER + String.raw`["']?[A-Za-z0-9_\-+/=.]{16,}` + VALUE_END, 'i'),
  },
  { label: 'connection string password', re: /(?:^|;)\s*(?:password|pwd)\s*=\s*(?!\{|\$)[^;'"\s]{4,}/i },
  { label: 'SAS signature', re: /[?&]sig=[A-Za-z0-9%+/=]{20,}/ },
  { label: 'AWS access key ID', re: /AKIA[0-9A-Z]{16}/ },
  { label: 'OpenAI/Anthropic key', re: /sk-[A-Za-z0-9_-]{32,}/ },
  { label: 'URL with credentials', re: /[a-z][a-z0-9+.-]*:\/\/[^:@\s/]{1,64}:[^@\s/]{1,64}@/i },
  { label: 'Azure storage key', re: /AccountKey=[A-Za-z0-9+/=]{40,}/ },
  { label: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

/**
 * Finds secret-looking values in a text.
 * Returns one entry per line and pattern: { line (1-based), label } — never the value.
 *
 * @param {string} text
 * @returns {{line: number, label: string}[]}
 */
function scanSecrets(text) {
  const findings = [];
  text.split(/\r?\n/).forEach((content, i) => {
    for (const { label, re } of PATTERNS) {
      const dup = findings.some(f => f.line === i + 1 && f.label === label);
      if (!dup && re.test(content)) findings.push({ line: i + 1, label });
    }
  });
  return findings;
}

// File extensions and well-known code identifiers that look like dotted names but are not hosts.
const FILE_EXTS = new Set(('yaml yml json js cjs mjs ts tsx jsx md py png svg jpg xml config conf ' +
  'csproj sln toml mod txt sh ps1 cs java html css lock ini env service cfg log pdf docx ' +
  'target socket timer mount').split(' '));
const IDENTIFIERS = new Set(['process.env', 'module.exports', 'console.log', 'matplotlib.pyplot',
  'yaml.safe_load', 'json.load', 'sys.exit', 'os.path', 'path.join',
  // product names that end like a domain
  'asp.net', 'ado.net', 'vb.net', 'node.js', 'next.js', 'vue.js', 'socket.io']);
// Top-level names that mark a dotted word as a host in free text (normal mode).
const TLD_TEXT = /(?<![A-Za-z0-9._-])((?:[a-z0-9-]+\.)+(?:com|net|org|io|local|internal|corp|lan|intra|cloud|dev|app|test|invalid))(?![A-Za-z0-9_-])/gi;
// Strict mode: any lower-case dotted name whose last part is 2+ letters (catches .co.uk, .de …).
const STRICT_TEXT = /(?<![A-Za-z0-9._-])((?:[a-z0-9-]+\.)+[a-z]{2,})(?![A-Za-z0-9_-])/g;
const URL_HOST = /[a-z][a-z0-9+.-]*:\/\/(?:[^@\s/]*@)?(\[[^\]]+\]|[^\s/:'"`)\]>?#,]+)/gi;
const HOST_KEY = /(?<![A-Za-z])(?:host|hostname|server|server_name|endpoint|url|fqdn|domain|data source)["']?\s*[:=]\s*["']?(?:tcp:)?([^\s"',;}#)]+)/gi;
// nginx writes "server_name a.example.com b.example.com;" with spaces, not a colon.
const NGINX_SERVER_NAME = /(?<![A-Za-z_])server_name\s+([^;]+);/g;
// nginx upstream "server appsrv01:8080;" and "Data Source sql01;" are space-separated too.
const SPACE_HOST = /(?<![A-Za-z_])(?:server|data source)\s+([^\s;{]+);/gi;
const IPV4 = /(?<![0-9.])((?:\d{1,3}\.){3}\d{1,3})(?![0-9.])/g;
// Server names without a domain, written in free text: three or more parts joined by "-",
// the last part mixing letters and digits (for example ab-sql-prd-p01, AB-APP-ELK-T02).
// DECISION: what counts as a dotless server name
//   A) last part contains a digit — rejected: also matches ADO-8001-Story-1, iso-8859-1,
//      windows-server-2022, python-3-11, claude-opus-5-5 (work items, encodings, versions)
//   B) last part mixes letters and digits — chosen: keeps the usual server pattern (p01, t02,
//      vm03); misses names that end in digits only (sql-prod-01), an accepted trade-off
const DOTLESS_SERVER = /(?<![A-Za-z0-9_.\/-])([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+){2,})(?![A-Za-z0-9_\/-]|\.[A-Za-z0-9])/g;

// Strips brackets, a trailing port and a trailing dot; keeps the case as written, so the host
// list shows names exactly as they will appear in the diagram.
function cleanHost(value) {
  return value.replace(/^\[|\]$/g, '').replace(/[:,]\d+$/, '').replace(/\.$/, '');
}

function isIp(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/**
 * Lists hostnames and IPv4 addresses found in a text.
 * kind: 'host' (dotted name), 'name' (a host-like key value without dots, e.g. a server name),
 * 'ip'. In Markdown, inline code and fenced blocks are skipped except ```yaml / ```yml fences.
 *
 * @param {string} text
 * @param {{markdown?: boolean, strict?: boolean}} [opts]
 * @returns {{line: number, value: string, kind: string}[]}
 */
function extractHosts(text, opts = {}) {
  const found = [];
  const seen = new Set();
  const add = (line, raw, forcedKind) => {
    const value = cleanHost(raw);
    const lower = value.toLowerCase(); // comparisons ignore case; the reported value keeps it
    if (!value || /^[$<{/*]/.test(value) || /^\d+$/.test(value)) return;
    if (['true', 'false', 'null', 'none'].includes(lower)) return;
    let kind = forcedKind;
    if (!kind) kind = isIp(value) ? 'ip' : value.includes('.') ? 'host' : 'name';
    if (kind === 'host' && (IDENTIFIERS.has(lower) || FILE_EXTS.has(lower.split('.').pop()))) return;
    const key = `${line}|${lower}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ line, value, kind });
  };

  let fence = null; // null = outside a fence; otherwise the fence language
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    let content = raw;
    if (opts.markdown) {
      const m = /^\s*(```+|~~~+)\s*([A-Za-z]*)/.exec(content);
      if (m) {
        fence = fence === null ? m[2].toLowerCase() : null;
        return;
      }
      if (fence !== null && fence !== 'yaml' && fence !== 'yml') return;
      if (fence === null) content = content.replace(/`[^`]*`/g, ' ');
    }
    for (const m of content.matchAll(URL_HOST)) add(line, m[1]);
    for (const m of content.matchAll(NGINX_SERVER_NAME)) {
      for (const name of m[1].trim().split(/\s+/)) add(line, name);
    }
    for (const m of content.matchAll(SPACE_HOST)) add(line, m[1]);
    for (const m of content.matchAll(HOST_KEY)) {
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(m[1])) add(line, m[1]);
    }
    for (const m of content.matchAll(IPV4)) if (isIp(m[1])) add(line, m[1], 'ip');
    for (const m of content.matchAll(DOTLESS_SERVER)) {
      const parts = m[1].split('-');
      const last = parts[parts.length - 1];
      const versionLike = parts.slice(1, -1).some(x => /^\d+$/.test(x)); // node-20-alpine3, windows-2022-x64
      if (/\d/.test(last) && /[A-Za-z]/.test(last) && !versionLike) add(line, m[1], 'name');
    }
    for (const m of content.matchAll(TLD_TEXT)) add(line, m[1]);
    if (opts.strict) for (const m of content.matchAll(STRICT_TEXT)) add(line, m[1]);
  });
  return found;
}

/**
 * True when a hostname or IP is a documentation-only value that discloses nothing:
 * hosts under example.com / example.org / .test / .invalid (RFC 2606), IPs in
 * 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (RFC 5737), plus localhost, 127.0.0.1, 0.0.0.0.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isDocHost(value) {
  const v = cleanHost(String(value)).toLowerCase();
  if (isIp(v)) {
    return /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/.test(v) || v === '127.0.0.1' || v === '0.0.0.0';
  }
  if (v === 'localhost') return true;
  return ['example.com', 'example.org'].some(d => v === d || v.endsWith(`.${d}`)) ||
    v.endsWith('.test') || v.endsWith('.invalid');
}

// Keys whose lists hold diagram items: zones, components, children, flows.
const LIST_KEY = /^(\s*)(?:-\s+)?(zones|components|children|flows):\s*(.*)$/;
// A list written inline, anywhere on a line: components: [{...}]
const INLINE_LIST = /\b(?:zones|components|children|flows):\s*\[\s*\{/;
const MAPPING_ITEM = /^\s*-\s+(?:\{|["']?[A-Za-z_][\w-]*["']?\s*:)/;
const ABSOLUTE = /^(?:[A-Za-z]:)?[\\/]/;
// .env and .env.local / .env.production … hold real values; templates are fine to cite.
const ENV_FILE = /^\.env(?:\.(?!example$|template$|sample$)[^.\\/]+)?$/i;

/**
 * Finds every item of the zones / components / children / flows lists, whatever key it starts
 * with. Returns { starts: [{ index, indent }], gaps } where gaps are list entries that are not
 * mappings or lists written inline.
 */
function listItems(lines) {
  const starts = [];
  const gaps = [];
  const lists = []; // open lists: { keyIndent, dashIndent }
  lines.forEach((raw, i) => {
    if (INLINE_LIST.test(raw)) gaps.push({ line: i + 1, reason: 'inline item list — put each item on its own line' });
    if (!raw.trim() || /^\s*#/.test(raw)) return;
    const indent = raw.search(/\S/);
    const isDash = /^\s*-(?:\s|$)/.test(raw);
    // Close the lists this line is no longer inside.
    while (lists.length) {
      const top = lists[lists.length - 1];
      if (isDash && top.dashIndent === null && indent >= top.keyIndent) break;
      if (isDash && indent === top.dashIndent) break;
      if (indent > (top.dashIndent === null ? top.keyIndent : top.dashIndent)) break;
      lists.pop();
    }
    const top = lists[lists.length - 1];
    if (top && isDash && (top.dashIndent === null || indent === top.dashIndent)) {
      top.dashIndent = indent;
      if (MAPPING_ITEM.test(raw)) starts.push({ index: i, indent, list: top.key });
      else gaps.push({ line: i + 1, reason: 'list entry is not a zone / component / flow mapping' });
    }
    const key = LIST_KEY.exec(raw);
    if (key) {
      const rest = key[3].trim();
      if (!rest || rest.startsWith('#')) lists.push({ keyIndent: raw.indexOf(key[2]), dashIndent: null, key: key[2] });
    }
  });
  return { starts, gaps };
}

// "# manual" as the trailing comment of an item's first line (not text inside a label).
const MANUAL = /(?:^|\s)#\s*manual\s*$/;

/**
 * The id (else name, else "from→to") of an item, read from its own lines only, never from
 * the items nested inside it.
 */
function itemKey(own, index) {
  const text = own.join('\n');
  const id = /\bid:\s*["']?([^"',}\s#]+)/.exec(text);
  const name = /\bname:\s*["']?([^"',}#]+?)["']?\s*(?:[,}#]|$)/m.exec(text);
  const flow = /\bfrom:\s*["']?([^"',}\s#]+)[\s\S]*?\bto:\s*["']?([^"',}\s#]+)/.exec(text);
  return id ? id[1] : name ? name[1].trim() : flow ? `${flow[1]}→${flow[2]}` : `line ${index + 1}`;
}

/**
 * Every item of the spec's lists as a tree: its range of lines (children included), its own
 * lines (children excluded), its parent, its key, the zone it sits in, whether it is marked
 * "# manual" and whether it sits inside a "# manual" item.
 */
function itemTree(lines) {
  const { starts, gaps } = listItems(lines);
  const items = starts.map(({ index, indent, list }) => {
    let end = index + 1;
    while (end < lines.length && !(lines[end].trim() && lines[end].search(/\S/) <= indent)) end++;
    while (end > index + 1 && !lines[end - 1].trim()) end--; // trailing blank lines are not part of it
    return { index, indent, list, end };
  });
  for (const item of items) {
    const around = items.filter(o => o.index < item.index && item.index < o.end);
    item.parent = around.length ? around[around.length - 1] : null;
    const nested = items.filter(r => r.index > item.index && r.index < item.end);
    item.own = [];
    for (let i = item.index; i < item.end; i++) {
      if (!nested.some(r => i >= r.index && i < r.end)) item.own.push(lines[i]);
    }
    item.key = itemKey(item.own, item.index);
    item.manual = MANUAL.test(lines[item.index]);
  }
  for (const item of items) {
    let p = item.parent;
    item.inManual = false;
    while (p) {
      if (p.manual) item.inManual = true;
      p = p.parent;
    }
    let z = item;
    while (z && z.list !== 'zones') z = z.parent;
    item.zone = z ? z.key : null;
  }
  return { items, gaps };
}

/**
 * AC-F6 line check: every zone, component and flow must say where it came from.
 * An item passes when its first line carries "# source: path[:line]" or "# manual", or when
 * its own lines (not its children's) hold both "todo: true" and a "⚠ TODO" detail. An item
 * with "⚠ TODO" but no "todo: true" is also reported, so unverified items always show on the
 * picture (AC-F14). Items are found by their place in the lists, not by which key comes first.
 * Lists written inline are reported, because their items cannot be checked one by one.
 * A source must be a path inside the repository with a line of 1 or more, and never .env;
 * with root, the file must exist and the line must be in range. Type "stack" wrappers are
 * layout only and need no source. A "# manual" item and everything inside it belong to the
 * developer and are not checked.
 *
 * @param {string} text
 * @param {{root?: string}} [opts]
 * @returns {{line: number, reason: string}[]}
 */
function checkSources(text, opts = {}) {
  const lines = text.split(/\r?\n/);
  const { items, gaps } = itemTree(lines);
  const lineCounts = new Map();
  const countLines = file => {
    if (!lineCounts.has(file)) {
      let n = -1;
      try {
        n = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
      } catch (err) {
        n = -1; // missing or unreadable: reported below
      }
      lineCounts.set(file, n);
    }
    return lineCounts.get(file);
  };
  for (const item of items) {
    if (item.manual || item.inManual) continue;
    const own = item.own;
    const block = own.join('\n');
    // A layout-only wrapper: a "type" key (not text inside a label) whose whole value is stack.
    if (own.some(l => /(?:^\s*-?\s*|[{,]\s*)type:\s*["']?stack["']?\s*(?:[,}#]|$)/.test(l))) continue;
    const first = lines[item.index];
    const at = item.index + 1;
    const hasTodoFlag = /\btodo:\s*true\b/.test(block);
    const hasTodoText = block.includes('⚠ TODO');
    const source = /#\s*source:\s*(.+)$/.exec(first);
    if (hasTodoText && !hasTodoFlag) gaps.push({ line: at, reason: '⚠ TODO without todo: true' });
    if (!source && !(hasTodoFlag && hasTodoText)) {
      gaps.push({ line: at, reason: 'no # source: and no ⚠ TODO' });
    }
    if (!source) continue;
    for (const ref of source[1].split(',').map(r => r.trim()).filter(Boolean)) {
      const m = /^(.+?)(?::(\d+))?$/.exec(ref);
      const rel = m[1];
      if (ABSOLUTE.test(rel) || path.normalize(rel).split(/[\\/]/)[0] === '..') {
        gaps.push({ line: at, reason: `source must be a path inside the repository: ${rel}` });
        continue;
      }
      if (ENV_FILE.test(path.basename(rel))) {
        gaps.push({ line: at, reason: `never cite ${path.basename(rel)} — cite the template (key names only)` });
        continue;
      }
      if (m[2] !== undefined && Number(m[2]) < 1) {
        gaps.push({ line: at, reason: `source line must be 1 or more: ${ref}` });
        continue;
      }
      if (!opts.root) continue;
      const count = countLines(path.resolve(opts.root, rel));
      if (count < 0) gaps.push({ line: at, reason: `source file not found: ${rel}` });
      else if (m[2] && Number(m[2]) > count) gaps.push({ line: at, reason: `source line ${m[2]} is past the end of ${rel}` });
    }
  }
  return gaps.sort((a, b) => a.line - b.line);
}

/**
 * Items the developer owns: every zone, component or flow whose first line ends with
 * "# manual" (outermost only), with the whole block, children included, exactly as written.
 *
 * @param {string} text
 * @returns {{line: number, key: string, zone: string|null, text: string}[]}
 */
function manualBlocks(text) {
  const lines = text.split(/\r?\n/);
  return itemTree(lines).items
    .filter(item => item.manual && !item.inManual)
    .map(item => ({ line: item.index + 1, key: item.key, zone: item.zone, text: lines.slice(item.index, item.end).join('\n') }));
}

/**
 * AC-F10: every "# manual" block of the saved spec must come back in the refreshed draft as
 * a list item with the same key, the same text byte for byte (indentation and children
 * included) and in the same zone. Returns the blocks that are missing, changed or moved, and
 * any "# manual" item in the draft that the saved spec does not have.
 *
 * @param {string} savedText
 * @param {string} draftText
 * @returns {{line: number, key: string, reason: string}[]}
 */
function checkManualKept(savedText, draftText) {
  const draft = manualBlocks(draftText);
  const problems = [];
  for (const block of manualBlocks(savedText)) {
    const same = draft.filter(d => d.key === block.key);
    if (same.length === 0) problems.push({ line: block.line, key: block.key, reason: 'missing' });
    else if (!same.some(d => d.text === block.text)) problems.push({ line: block.line, key: block.key, reason: 'changed' });
    else if (!same.some(d => d.text === block.text && d.zone === block.zone)) {
      problems.push({ line: block.line, key: block.key, reason: `moved out of zone ${block.zone}` });
    }
  }
  // Generated items never carry "# manual": a manual item the saved spec does not have would
  // escape the --sources check.
  const savedKeys = new Set(manualBlocks(savedText).map(b => b.key));
  for (const d of draft) {
    if (!savedKeys.has(d.key)) problems.push({ line: d.line, key: d.key, reason: 'new # manual not in saved spec (draft line)' });
  }
  return problems;
}

// Formats --keys understands. Anything else is refused, so an empty result always means "no keys".
const KEY_FORMATS = {
  json: ['.json'],
  xml: ['.config', '.xml'],
  text: ['.yaml', '.yml', '.env', '.properties', '.ini', '.toml', '.example', '.template', '.sample'],
};

/**
 * Which --keys format a file is: json, xml, text (.env / YAML / properties), or null if unsupported.
 * Files named .env.example / .env.template / .env.sample count as text.
 */
function keyFormat(file) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file).toLowerCase();
  if (/^\.env(\.|$)/.test(base)) return 'text';
  for (const [format, exts] of Object.entries(KEY_FORMATS)) if (exts.includes(ext)) return format;
  return null;
}

/**
 * Key names (never values) in a settings template, with line numbers: KEY=… (.env style),
 * key: … (YAML), "key": … (JSON), and in XML config (Web.config, *.SetParameters.xml, app.config)
 * the key= / name= attribute of each element. Lets the skill learn which settings exist
 * without opening the file, so values never enter the conversation (AC-F7).
 *
 * @param {string} text
 * @param {string} file
 * @returns {{line: number, key: string}[]}
 */
function extractKeys(text, file) {
  const keys = [];
  const format = keyFormat(file) || 'text';
  if (format === 'xml') {
    // Comments are blanked (newlines kept, so line numbers stay right); each element is read
    // whole, even when it spans several lines; its attributes are split properly, so text such
    // as name="…" inside another attribute's value is never taken for a key.
    const clean = text.replace(/<!--[\s\S]*?-->/g, c => c.replace(/[^\n]/g, ' '));
    let at = 0;
    let line = 1; // counted forward from the previous element, so large files stay linear
    for (const el of clean.matchAll(/<([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g)) {
      for (; at < el.index; at++) if (clean.charCodeAt(at) === 10) line++;
      for (const a of el[2].matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
        if (/^(?:key|name)$/i.test(a[1])) keys.push({ line, key: `${el[1]}:${a[3] !== undefined ? a[3] : a[4]}` });
      }
    }
    return keys;
  }
  const json = format === 'json';
  let blockIndent = -1; // inside a YAML block value (key: | or >): lines deeper than the key
  text.split(/\r?\n/).forEach((raw, i) => {
    if (blockIndent >= 0) {
      if (!raw.trim() || raw.search(/\S/) > blockIndent) return;
      blockIndent = -1;
    }
    if (/^\s*(?:#|\/\/|;)/.test(raw)) return;
    if (!json && /:\s*[|>][+-]?\d*\s*(?:#.*)?$/.test(raw)) blockIndent = raw.search(/\S/);
    if (json) {
      for (const m of raw.matchAll(/"([^"\\]+)"\s*:/g)) keys.push({ line: i + 1, key: m[1] });
      return;
    }
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=/.exec(raw) ||
      /^\s*-?\s*["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*:(?:\s|$)/.exec(raw);
    if (m) keys.push({ line: i + 1, key: m[1] });
  });
  return keys;
}

/**
 * Command-line entry point. Reads the files (or stdin), prints the report, sets the exit code.
 */
function main(argv) {
  const flags = new Set(argv.filter(a => a.startsWith('--')).map(a => a.split('=')[0]));
  const files = argv.filter(a => !a.startsWith('--'));
  const rootArg = argv.find(a => a.startsWith('--root='));
  const root = rootArg ? rootArg.slice('--root='.length) : undefined;
  const manualArg = argv.find(a => a.startsWith('--manual-kept='));
  let saved = null;
  if (manualArg) {
    const savedPath = manualArg.slice('--manual-kept='.length);
    try {
      saved = fs.readFileSync(savedPath, 'utf8');
    } catch (err) {
      process.stderr.write(`arch-spec-scan: cannot read ${savedPath} (${err.code || err.message})\n`);
      return 2;
    }
  }
  const wantHosts = flags.has('--hosts');
  const wantSources = flags.has('--sources');
  const wantKeys = flags.has('--keys');
  const wantManual = saved !== null;
  const wantSecrets = flags.has('--secrets') || (!wantHosts && !wantSources && !wantKeys && !wantManual);
  const inputs = [];
  if (flags.has('--stdin')) {
    inputs.push({ file: '<stdin>', text: fs.readFileSync(0, 'utf8') });
  }
  for (const file of files) {
    try {
      inputs.push({ file, text: fs.readFileSync(file, 'utf8') });
    } catch (err) {
      process.stderr.write(`arch-spec-scan: cannot read ${file} (${err.code || err.message})\n`);
      return 2;
    }
  }
  if (wantKeys) {
    const unsupported = inputs.filter(({ file }) => file !== '<stdin>' && keyFormat(file) === null).map(i => i.file);
    if (unsupported.length) {
      process.stderr.write(`arch-spec-scan: --keys cannot read ${unsupported.join(', ')} (supported: ${Object.values(KEY_FORMATS).flat().join(' ')} and .env.*)\n`);
      return 2;
    }
  }
  if (inputs.length === 0) {
    process.stderr.write('usage: arch-spec-scan.cjs [--secrets] [--hosts] [--sources [--root=<dir>]] [--keys] [--manual-kept=<saved spec>] [--json] [--stdin] [file ...]\n');
    return 2;
  }

  const report = inputs.map(({ file, text }) => ({
    file,
    secrets: wantSecrets ? scanSecrets(text) : [],
    hosts: wantHosts ? extractHosts(text, { markdown: path.extname(file).toLowerCase() === '.md' }) : [],
    sources: wantSources ? checkSources(text, { root }) : [],
    keys: wantKeys ? extractKeys(text, file) : [],
    manual: wantManual ? checkManualKept(saved, text) : [],
  }));

  if (flags.has('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const r of report) {
      if (wantSecrets) {
        if (r.secrets.length === 0) process.stdout.write(`${r.file}: secrets: none\n`);
        for (const s of r.secrets) process.stdout.write(`${r.file}: secret pattern (${s.label}) at line ${s.line}\n`);
      }
      for (const h of r.hosts) process.stdout.write(`${r.file}: ${h.kind} ${h.value} at line ${h.line}\n`);
      for (const k of r.keys) process.stdout.write(`${r.file}: line ${k.line}: ${k.key}\n`);
      if (wantManual) {
        if (r.manual.length === 0) process.stdout.write(`${r.file}: manual: every # manual item kept unchanged\n`);
        for (const m of r.manual) process.stdout.write(`${r.file}: # manual item ${m.key} (saved spec line ${m.line}) ${m.reason}\n`);
      }
      if (wantSources) {
        if (r.sources.length === 0) process.stdout.write(`${r.file}: sources: every item has a source or a TODO\n`);
        for (const g of r.sources) process.stdout.write(`${r.file}: line ${g.line}: ${g.reason}\n`);
      }
    }
  }
  return report.some(r => r.secrets.length > 0 || r.sources.length > 0 || r.manual.length > 0) ? 1 : 0;
}

module.exports = { scanSecrets, extractHosts, isDocHost, checkSources, extractKeys, keyFormat, manualBlocks, checkManualKept, PATTERNS };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
