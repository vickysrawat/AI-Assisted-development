#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/arch-spec-scan.cjs: the secret scan (YAML key: value and
//                      key=value forms, placeholders ignored, values never printed), the
//                      hostname / IP extraction (code identifiers and file names ignored,
//                      Markdown code skipped except YAML fences) and the documentation-host
//                      allow-list (Story 1), and the --sources line check: every item needs a
//                      source or a ⚠ TODO, cited files and lines must exist, and the example in
//                      skills/arch-diagram/references/spec-format.md must cite the Docker fixture
//                      correctly (Story 2), and that refresh keeps every "# manual" item byte for
//                      byte (--manual-kept, Story 3). Also runs the CLI through stdin. ADO-8001.
//                      Exits 0 if all pass, 1 if any fail.
// What it touches:     Reads scripts/arch-spec-scan.cjs, skills/arch-diagram/references/spec-format.md
//                      and tests/fixtures/arch-diagram/docker-compose-app/. Spawns
//                      `node scripts/arch-spec-scan.cjs` with input on stdin. Writes nothing.
// What it does NOT do: No network calls, no git operations, no file writes.
// APIs / commands:     Node stdlib: child_process.spawnSync, fs, path. require('../scripts/arch-spec-scan.cjs').
// How to verify:       node tests/arch-spec-scan.test.cjs -> "N passed · 0 failed", exit 0.

'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { scanSecrets, extractHosts, isDocHost, checkSources, extractKeys, manualBlocks, checkManualKept } = require('../scripts/arch-spec-scan.cjs');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'arch-spec-scan.cjs');
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

// Secret-looking test values are built at runtime so this file never matches a secret pattern.
const PW_KEY = 'pass' + 'word';
const FAKE_PW = 'Hx7' + 'qLm2' + 'Rt9v';
const FAKE_SECRET = 'Zq4' + 'Wm8Lp2Xv6Tn';
const values = list => list.map(h => h.value);

// ---- scanSecrets --------------------------------------------------------------------------
process.stdout.write('scanSecrets\n');
{
  const text = ['components:', '  - id: db', `    ${PW_KEY}: ${FAKE_PW}`].join('\n');
  const found = scanSecrets(text);
  assert('AC-F7 N-U6 YAML key: value password is found on the right line',
    found.length === 1 && found[0].line === 3 && found[0].label === 'password', JSON.stringify(found));
}
{
  const text = [`client_secret: ${FAKE_SECRET}`, `Server=db01;User Id=app;${PW_KEY}=${FAKE_PW};`].join('\n');
  const labels = scanSecrets(text).map(f => f.label);
  assert('AC-F7 N-U7 client_secret and connection-string password are both found',
    labels.includes('secret/token/key') && labels.includes('connection string password'), JSON.stringify(labels));
}
{
  const found = scanSecrets(`SESSION_SIGNING_SECRET=${FAKE_SECRET}`);
  assert('AC-F7 N-U11 prefixed key name (…_SECRET=) is found', found.length === 1, JSON.stringify(found));
}
{
  const text = [
    'details: ["DB_PASSWORD (Key Vault)", "Secret: orders-db-credentials"]',
    `${PW_KEY}: stored in Key Vault`,
    `${PW_KEY}: \${DB_PASSWORD}`,
    `${PW_KEY}: changeme`,
    'token: validation',
  ].join('\n');
  const found = scanSecrets(text);
  assert('AC-F7 P-U10 key names, prose, placeholders and env references are not secrets',
    found.length === 0, JSON.stringify(found));
}
{
  const found = scanSecrets(`${PW_KEY}: ${FAKE_PW}`);
  assert('AC-F7 scanSecrets never returns the value itself', !JSON.stringify(found).includes(FAKE_PW));
}
{
  const letters = 'abcdefgh' + 'ijklmnopqrstuvwx';
  const text = [`${PW_KEY}: "correct horse ${'batt' + 'ery'}"`, `${PW_KEY}: |`, `api_key: ${letters}`].join('\n');
  const lines = scanSecrets(text).map(f => f.line);
  assert('AC-F7 quoted multi-word, block-scalar and letters-only API key values are found',
    lines.includes(1) && lines.includes(2) && lines.includes(3), JSON.stringify(scanSecrets(text)));
}

// ---- extractHosts / isDocHost -------------------------------------------------------------
process.stdout.write('extractHosts / isDocHost\n');
assert('AC-F13 P-U6 documentation hosts and IPs are allowed',
  ['api.contoso.example.com', 'db.test', '192.0.2.10', '198.51.100.7', 'localhost', 'x.invalid']
    .every(isDocHost));
assert('AC-F13 N-U5 real-looking hosts and private IPs are not allowed',
  ['db.contoso.local', '10.' + '1.2.3', 'app.example.net', 'example.com.evil.test.co'].every(v => !isDocHost(v)));
{
  const text = ['server: sqlsrv-contoso01', 'url: https://a.b.example.org/x', 'Data Source=sql02,1433;'].join('\n');
  const found = extractHosts(text);
  assert('AC-F13 P-U7 dotless key value, URL host and Data Source are reported with line numbers',
    found.some(h => h.value === 'sqlsrv-contoso01' && h.kind === 'name' && h.line === 1) &&
    found.some(h => h.value === 'a.b.example.org' && h.line === 2) &&
    found.some(h => h.value === 'sql02' && h.line === 3), JSON.stringify(found));
}
{
  const text = 'See config.yaml, package.json and ecosystem.config.js for details.';
  assert('AC-F13 N-U8 file names are not hosts', extractHosts(text, { strict: true }).length === 0,
    JSON.stringify(extractHosts(text, { strict: true })));
}
{
  const text = 'Use e.g. process.env.PORT or module.exports, yaml.safe_load, !GetAtt Db.Endpoint.Address, i.e. code.';
  const found = extractHosts(text, { strict: true });
  assert('AC-F13 N-U10 code identifiers and abbreviations are not hosts', found.length === 0, JSON.stringify(found));
}
{
  const found = extractHosts('details: ["ASP.NET 4.8", "ADO.NET", "Socket.IO", "Node.js 20"]', { strict: true });
  assert('Product names that end like a domain (ASP.NET, Socket.IO) are not hosts', found.length === 0, JSON.stringify(found));
}
{
  const found = extractHosts(['After=network.target', 'WantedBy=multi-user.target', 'Requires=pm2.socket'].join('\n'),
    { strict: true });
  assert('systemd unit names (network.target, pm2.socket) are not hosts', found.length === 0, JSON.stringify(found));
}
{
  const md = ['Run `curl https://internal.contoso.local/x` first.', '```bash', 'ping 10.0.0.1', '```',
    '```yaml', 'host: orders.contoso.co.uk', '```'].join('\n');
  const found = extractHosts(md, { markdown: true, strict: true });
  assert('AC-F13 N-U14 YAML fences in Markdown are scanned (ccTLD host found in strict mode)',
    values(found).includes('orders.contoso.co.uk') && !isDocHost('orders.contoso.co.uk'), JSON.stringify(found));
  assert('Inline code and non-YAML fences in Markdown are skipped',
    !values(found).includes('internal.contoso.local') && !values(found).includes('10.0.0.1'), JSON.stringify(found));
}
{
  const found = extractHosts('server_name app.contoso.example.com;\nproxy_pass http://127.0.0.1:3000;');
  assert('nginx server_name and proxy_pass hosts are reported',
    values(found).includes('app.contoso.example.com') && values(found).includes('127.0.0.1'), JSON.stringify(found));
}

// ---- checkSources (AC-F6, Story 2) ------------------------------------------------------------
process.stdout.write('checkSources\n');
const FIXTURE = path.join(__dirname, 'fixtures', 'arch-diagram', 'docker-compose-app');
{
  const spec = [
    'zones:',
    '  - name: "Primary server"   # source: docker-compose.yml:1',
    '    components:',
    '      - {id: api, name: api, type: compose-service}   # source: docker-compose.yml:13',
    '      - type: stack',
    '        children:',
    '          - {id: db, name: contoso-db, type: database}   # source: docker-compose.yml:39',
    'flows:',
    '  - {from: api, to: db, label: "TCP 5432"}   # source: docker-compose.yml:18',
  ].join('\n');
  const gaps = checkSources(spec, { root: FIXTURE });
  assert('AC-F6 P-U1 every item has a source that exists (stack wrapper needs none)', gaps.length === 0, JSON.stringify(gaps));
}
{
  const spec = [
    'zones:',
    '  - name: "Failover site"',
    '    todo: true',
    '    details: ["⚠ TODO: no failover site found in code or documents"]',
  ].join('\n');
  assert('AC-F6 P-U2 todo: true with a ⚠ TODO detail passes without a source', checkSources(spec).length === 0,
    JSON.stringify(checkSources(spec)));
}
{
  const spec = 'zones:\n  - name: "Firewall"   # manual\n';
  assert('AC-F6 P-U3 an item marked # manual passes', checkSources(spec).length === 0, JSON.stringify(checkSources(spec)));
}
{
  const spec = ['zones:', '  - name: "Site"   # source: docker-compose.yml', '    components:',
    '      - {id: x, name: X, type: server}'].join('\n');
  const gaps = checkSources(spec);
  assert('AC-F6 N-U1 a component with no source and no todo is reported with its line',
    gaps.length === 1 && gaps[0].line === 4 && gaps[0].reason.startsWith('no # source'), JSON.stringify(gaps));
}
{
  const spec = ['zones:', '  - name: "Site"   # source: a.yml', '    details: ["⚠ TODO: backups unknown"]'].join('\n');
  const gaps = checkSources(spec);
  assert('AC-F6 AC-F14 N-U2 ⚠ TODO without todo: true is reported',
    gaps.some(g => g.reason === '⚠ TODO without todo: true'), JSON.stringify(gaps));
}
{
  const spec = ['zones:', '  - name: "Site"   # source: no-such-file.yml:3', '    components:',
    '      - {id: x, name: X}   # source: docker-compose.yml:9999'].join('\n');
  const reasons = checkSources(spec, { root: FIXTURE }).map(g => g.reason);
  assert('AC-F6 cited file that does not exist, and a line past the end, are reported',
    reasons.some(r => r.startsWith('source file not found')) && reasons.some(r => r.includes('past the end')), JSON.stringify(reasons));
}
{
  const spec = 'zones:\n  - name: "Site"   # source: a.yml\n    components: [{id: a, name: A}]\n';
  assert('AC-F6 inline item lists are reported', checkSources(spec).some(g => g.reason.startsWith('inline item list')),
    JSON.stringify(checkSources(spec)));
}

{
  // Items are found by their place in the list, whatever key they start with.
  const spec = ['zones:', '- style: plain', '  name: Users', '  row: 1', '- row: 2   # source: a.yml',
    '  name: Site', '  components:', '  - details: ["x"]', '    name: Box', '  - "just a string"'].join('\n');
  const gaps = checkSources(spec);
  const at = n => gaps.filter(g => g.line === n).map(g => g.reason).join('; ');
  assert('AC-F6 items starting with any key (style:, details:) are checked; dashes level with the key work',
    at(2).startsWith('no # source') && at(5) === '' && at(8).startsWith('no # source'), JSON.stringify(gaps));
  assert('AC-F6 a list entry that is not a mapping is reported', at(10).startsWith('list entry is not'), JSON.stringify(gaps));
}
{
  const spec = ['zones:', '  - name: Site', '    components:', '      - {id: a, name: A, todo: true, details: ["⚠ TODO: x"]}',
    '    todo: true', '    details: ["⚠ TODO: site not confirmed"]',
    '  - name: Other   # source: a.yml', '    components:', '      - {id: b, name: B, todo: true, details: ["⚠ TODO: y"]}'].join('\n');
  const gaps = checkSources(spec);
  assert('AC-F6 a parent\'s todo after its children counts; a child\'s todo does not count for the parent',
    gaps.length === 0, JSON.stringify(gaps));
}
{
  const spec = ['flows:', '  - {from: a, to: b}   # source: ../../outside.yml:1', '  - {from: a, to: c}   # source: C:/Windows/win.ini:1',
    '  - {from: a, to: d}   # source: .env:3', '  - {from: a, to: e}   # source: docker-compose.yml:0',
    '  - {from: a, to: f}   # source: .env.example:2'].join('\n');
  const reasons = checkSources(spec, { root: FIXTURE }).map(g => `${g.line} ${g.reason}`);
  assert('AC-F6 sources outside the repository, .env, and line 0 are rejected; a template is allowed (if it exists)',
    reasons.some(r => r.startsWith('2 source must be a path inside')) && reasons.some(r => r.startsWith('3 source must be a path inside')) &&
    reasons.some(r => r.startsWith('4 never cite .env')) && reasons.some(r => r.startsWith('5 source line must be 1')) &&
    reasons.some(r => r.startsWith('6 source file not found')), JSON.stringify(reasons));
}
{
  const found = extractHosts('upstream app {\n    server appsrv01:8080;\n}\nData Source sqlsrv02;');
  assert('AC-F7 nginx upstream "server host:port;" and "Data Source host;" are reported',
    found.some(h => h.value === 'appsrv01') && found.some(h => h.value === 'sqlsrv02') && !found.some(h => h.value === '{'),
    JSON.stringify(found));
}
{
  const text = ['details: ["Primary: AB-SQL-XYZ-T01", "Replica ab-sql-xyz-p02,1433"]', 'logs go to ab-app-elk-p01 and AB-APP-ELK-P02.',
    'see docker-compose-app, check-version-consistency, ADO-8001-arch-diagram, node-20, x-y'].join('\n');
  const names = extractHosts(text).filter(h => h.kind === 'name').map(h => h.value);
  assert('dotless server names in free text are listed as written (3+ parts, last part mixes letters and digits)',
    ['AB-SQL-XYZ-T01', 'ab-sql-xyz-p02', 'ab-app-elk-p01', 'AB-APP-ELK-P02'].every(n => names.includes(n)) && names.length === 4,
    JSON.stringify(names));
}
{
  const conn = 'Server=x;' + PW_KEY + '=' + FAKE_PW;
  const xml = ['<configuration>', '  <connectionStrings>', `    <add name="OrdersDb" connectionString="${conn}" />`,
    '  </connectionStrings>', '  <appSettings>', `    <add key="ApiUrl" value="https://api.contoso.example.com" />`,
    '  </appSettings>', '  <parameter name="IIS Web Application Name" defaultValue="Default Web Site/orders" />', '</configuration>'].join('\n');
  const keys = extractKeys(xml, 'Web.config').map(k => `${k.line}:${k.key}`);
  assert('AC-F7 --keys reads XML config: element:key / element:name only, never values',
    keys.join(',') === '3:add:OrdersDb,6:add:ApiUrl,8:parameter:IIS Web Application Name' && !JSON.stringify(keys).includes(FAKE_PW),
    JSON.stringify(keys));
}
{
  const inValue = 'Server=a; ' + 'name' + '="' + FAKE_PW + '"';
  const xml = [`<add key='K' value='${inValue}' />`, '<!-- <add key="Hidden" /> -->', '<add', '   key="Multi"', '   value="x" />'].join('\n');
  const keys = extractKeys(xml, 'Web.Release.config').map(k => `${k.line}:${k.key}`);
  assert('AC-F7 XML --keys: name= inside another value is never read; comments skipped; single quotes and multi-line elements read',
    keys.join(',') === '1:add:K,3:add:Multi' && !JSON.stringify(keys).includes(FAKE_PW), JSON.stringify(keys));
}
{
  const ids = 'ADO-8001-Story-1 TC-3-1 Release-3-Sprint-14 iso-8859-1 ubuntu-22-04 windows-server-2022 sql-server-2019 ' +
    'python-3-11 v1-2-3 api-v2-2024 model-opus-5-5 x-ms-version-2 node-20-alpine3 windows-2022-x64 ubuntu-22-arm64';
  const names = extractHosts(ids).filter(h => h.kind === 'name').map(h => h.value);
  assert('work items, encodings, OS / product versions are not server names', names.length === 0, JSON.stringify(names));
}
{
  const r = spawnSync('node', [SCRIPT, '--keys', path.join(__dirname, '..', 'skills', 'arch-diagram', 'SKILL.md')], { encoding: 'utf8' });
  assert('AC-F7 --keys refuses an unsupported file type loudly (exit 2) instead of printing nothing',
    r.status === 2 && r.stderr.includes('--keys cannot read'), `${r.status} ${r.stderr}`);
}
{
  const env = ['# comment', 'DB_HOST=db', `DB_${PW_KEY.toUpperCase()}=${FAKE_PW}`, 'export API_URL=https://x.example.com'].join('\n');
  const yml = ['orders:', `  ${PW_KEY}: ${FAKE_PW}`, '  - item: x'].join('\n');
  const json = `{\n  "ConnectionStrings": {\n    "Orders": "Server=x;${PW_KEY}=${FAKE_PW}"\n  }\n}`;
  const keysEnv = extractKeys(env, '.env.example').map(k => `${k.line}:${k.key}`);
  const keysYml = extractKeys(yml, 'values.yaml').map(k => `${k.line}:${k.key}`);
  const keysJson = extractKeys(json, 'appsettings.json').map(k => `${k.line}:${k.key}`);
  assert('AC-F7 extractKeys returns key names and lines for .env, YAML and JSON — never values',
    keysEnv.join(',') === '2:DB_HOST,3:DB_PASSWORD,4:API_URL' && keysYml.join(',') === `1:orders,2:${PW_KEY},3:item` &&
    keysJson.join(',') === '2:ConnectionStrings,3:Orders' &&
    !JSON.stringify([keysEnv, keysYml, keysJson]).includes(FAKE_PW), JSON.stringify([keysEnv, keysYml, keysJson]));
}
{
  const spec = ['zones:', '  - name: Site   # source: a.yml', '    components:',
    '      - {id: a, name: A, label: "type: stack"}', '      - {id: b, name: B, type: stack-db}', '      - type: stack',
    '        children:', '          - {id: c, name: C}   # source: a.yml'].join('\n');
  const lines = checkSources(spec).map(g => g.line);
  assert('AC-F6 only a real "type: stack" key skips the source check (not a label, not stack-db)',
    lines.includes(4) && lines.includes(5) && !lines.includes(6), JSON.stringify(checkSources(spec)));
}
{
  const yml = ['db:', `  ${PW_KEY}: |`, `    ${FAKE_PW}x: y`, '    more: z', '  host: contoso-db'].join('\n');
  const keys = extractKeys(yml, 'values.yaml').map(k => k.key);
  assert('AC-F7 extractKeys skips the lines of a YAML block value (no part of a value printed)',
    keys.join(',') === `db,${PW_KEY},host` && !JSON.stringify(keys).includes(FAKE_PW), JSON.stringify(keys));
}
{
  // The generated-spec example in spec-format.md must cite real lines of the Docker fixture.
  const md = fs.readFileSync(path.join(__dirname, '..', 'skills', 'arch-diagram', 'references', 'spec-format.md'), 'utf8');
  const example = /## Example: generated[\s\S]*?```yaml\r?\n([\s\S]*?)```/.exec(md);
  const gaps = example ? checkSources(example[1], { root: FIXTURE }) : [{ line: 0, reason: 'no yaml example found' }];
  assert('AC-F6 the spec-format.md example has a real source (or TODO) on every item', gaps.length === 0, JSON.stringify(gaps));
}

// ---- manual blocks (AC-F10, Story 3) ----------------------------------------------------------
process.stdout.write('manual blocks\n');
const SAVED = [
  'zones:',
  '  - name: "Primary"   # source: docker-compose.yml:1',
  '    components:',
  '      - id: fw   # manual',
  '        name: "Company firewall"',
  '        type: firewall',
  '        details: ["Owned by network team"]',
  '      - {id: api, name: api, type: compose-service}   # source: docker-compose.yml:13',
  'flows:',
  '  - {from: fw, to: api, label: "HTTPS"}   # manual',
].join('\n');
{
  const blocks = manualBlocks(SAVED);
  assert('AC-F10 manualBlocks finds every # manual item with its whole block',
    blocks.length === 2 && blocks[0].key === 'fw' && blocks[0].text.split('\n').length === 4 && blocks[1].key === 'fw→api',
    JSON.stringify(blocks));
}
{
  const refreshed = SAVED.replace('compose-service}', 'compose-service, details: ["Port 8000"]}') +
    '\n  - {from: api, to: db}   # source: docker-compose.yml:18';
  assert('AC-F10 P-U1 refreshed draft that keeps both # manual blocks byte for byte passes',
    checkManualKept(SAVED, refreshed).length === 0, JSON.stringify(checkManualKept(SAVED, refreshed)));
}
{
  const changed = SAVED.replace('Owned by network team', 'Owned by the platform team');
  const dropped = SAVED.split('\n').slice(0, 9).join('\n');
  assert('AC-F10 a changed or dropped # manual block is reported',
    checkManualKept(SAVED, changed).map(m => m.key).join() === 'fw' &&
    checkManualKept(SAVED, dropped).map(m => m.key).join() === 'fw→api',
    JSON.stringify([checkManualKept(SAVED, changed), checkManualKept(SAVED, dropped)]));
}
{
  const manualZone = ['zones:', '  - name: "DR site"   # manual', '    style: failover', '    components:',
    '      - {id: drdb, name: "DR database", type: sql-server}', '  - name: "Primary"   # source: docker-compose.yml:1'].join('\n');
  const blocks = manualBlocks(manualZone);
  assert('AC-F10 a # manual zone: its children need no source, and the block is keyed by the zone itself',
    checkSources(manualZone).length === 0 && blocks.length === 1 && blocks[0].key === 'DR site' && blocks[0].text.split('\n').length === 4,
    JSON.stringify([checkSources(manualZone), blocks]));
}
{
  const appended = SAVED.replace('        details: ["Owned by network team"]',
    '        details: ["Owned by network team"]\n        tag: "Edge"');
  const inComment = SAVED.split('\n').slice(0, 9).join('\n') + '\n  # - {from: fw, to: api, label: "HTTPS"}   # manual';
  const moved = SAVED.replace('flows:', '  - name: "Other"   # source: a.yml\n    components:\n' +
    '      - id: fw   # manual\n        name: "Company firewall"\n        type: firewall\n        details: ["Owned by network team"]\nflows:')
    .replace('      - id: fw   # manual\n        name: "Company firewall"\n        type: firewall\n        details: ["Owned by network team"]\n      - {id: api',
      '      - {id: api');
  const reasons = t => checkManualKept(SAVED, t).map(m => `${m.key}:${m.reason}`).join();
  assert('AC-F10 an extra line appended to a # manual block is "changed"', reasons(appended) === 'fw:changed', reasons(appended));
  assert('AC-F10 a # manual flow surviving only in a comment is "missing"', reasons(inComment) === 'fw→api:missing', reasons(inComment));
  assert('AC-F10 a # manual block moved to another zone is "moved"', reasons(moved).startsWith('fw:moved out of zone'), reasons(moved));
  const added = SAVED.replace('flows:', ['  - name: "New"   # manual', 'flows:'].join('\n'));
  assert('AC-F10 a # manual item the saved spec does not have is reported', reasons(added) === 'New:new # manual not in saved spec (draft line)',
    reasons(added));
}
{
  const spec = 'zones:\n  - name: "Site"   # source: a.yml\n    components:\n      - {id: x, name: X, label: "see #manual"}\n';
  assert('AC-F10 "#manual" inside a label is not a manual marker', manualBlocks(spec).length === 0 && checkSources(spec).length === 1,
    JSON.stringify([manualBlocks(spec), checkSources(spec)]));
}
{
  const os = require('os');
  const savedPath = path.join(os.tmpdir(), `arch-saved-${process.pid}.yaml`);
  fs.writeFileSync(savedPath, SAVED);
  const ok = spawnSync('node', [SCRIPT, '--stdin', `--manual-kept=${savedPath}`], { input: SAVED, encoding: 'utf8' });
  const bad = spawnSync('node', [SCRIPT, '--stdin', `--manual-kept=${savedPath}`, '--json'],
    { input: SAVED.replace('type: firewall', 'type: load-balancer'), encoding: 'utf8' });
  fs.rmSync(savedPath, { force: true });
  let report = [];
  try { report = JSON.parse(bad.stdout); } catch (err) { report = []; }
  assert('AC-F10 --manual-kept CLI: exit 0 when kept, exit 1 with the item when changed',
    ok.status === 0 && bad.status === 1 && report[0] && report[0].manual.length === 1 && report[0].manual[0].key === 'fw',
    `${ok.status} ${bad.status} ${bad.stdout}${bad.stderr}`);
}

// ---- CLI ---------------------------------------------------------------------------------
process.stdout.write('CLI\n');
{
  const clean = 'zones:\n  - name: "Site"\n    details: ["orders.contoso.example.com"]\n';
  const r = spawnSync('node', [SCRIPT, '--stdin', '--secrets', '--hosts'], { input: clean, encoding: 'utf8' });
  assert('AC-F7 P-U12 clean spec on stdin: exit 0, host listed', r.status === 0 && r.stdout.includes('orders.contoso.example.com'),
    `${r.status} ${r.stdout}${r.stderr}`);
}
{
  const dirty = `${PW_KEY}: ${FAKE_PW}\n`;
  const r = spawnSync('node', [SCRIPT, '--stdin', '--secrets'], { input: dirty, encoding: 'utf8' });
  assert('Secret on stdin: exit 1, line reported, value not printed',
    r.status === 1 && r.stdout.includes('at line 1') && !r.stdout.includes(FAKE_PW), `${r.status} ${r.stdout}`);
}
{
  const spec = 'zones:\n  - name: "Site"\n';
  const r = spawnSync('node', [SCRIPT, '--stdin', '--sources', `--root=${FIXTURE}`, '--json'], { input: spec, encoding: 'utf8' });
  let report = [];
  try { report = JSON.parse(r.stdout); } catch (err) { report = []; }
  assert('AC-F6 --sources on stdin: exit 1 and the gap in the JSON report',
    r.status === 1 && report[0] && report[0].sources.length === 1 && report[0].sources[0].line === 2, `${r.status} ${r.stdout}${r.stderr}`);
}
{
  const settings = path.join(FIXTURE, 'config', 'app.yaml');
  const r = spawnSync('node', [SCRIPT, '--keys', settings], { encoding: 'utf8' });
  const text = require('fs').readFileSync(settings, 'utf8');
  const values = text.split(/\r?\n/).map(l => /:\s*(\S.*)$/.exec(l)).filter(Boolean).map(m => m[1].replace(/^["']|["']$/g, ''));
  assert('AC-F7 --keys on the fixture settings template prints key names, no value',
    r.status === 0 && r.stdout.includes('ORDERS_DB_PASSWORD') && values.length > 0 && values.every(v => !r.stdout.includes(v)),
    `${r.status} ${r.stdout}${r.stderr}`);
}
{
  const r = spawnSync('node', [SCRIPT, '--secrets', path.join(__dirname, 'no-such-file.yaml')], { encoding: 'utf8' });
  assert('Unreadable file: exit 2 with a message', r.status === 2 && r.stderr.includes('cannot read'), `${r.status} ${r.stderr}`);
}

process.stdout.write(`\n${passed} passed · ${failed} failed\n`);
process.exit(failed ? 1 : 0);
