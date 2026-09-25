#!/usr/bin/env node
// hooks/graph-stale-detect.cjs — git post-merge/post-checkout hook (pure Node.js)
//
// Installed as .git/hooks/post-merge and .git/hooks/post-checkout by setup-init-bootstrap.cjs
// when shell_type != "bash". Git for Windows resolves #!/usr/bin/env node via PATH.
// Identical fingerprinting logic to graph-stale-detect.sh — uses crypto instead of sha1sum.

'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const graphPath = path.join('.claude', 'graph', 'graph.json');
if (!fs.existsSync(graphPath)) process.exit(0);

let graph;
try { graph = JSON.parse(fs.readFileSync(graphPath, 'utf8')); } catch(e) { process.exit(0); }

const EXCLUDE = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', '.angular', 'migrations', '__pycache__']);

function fingerprint(roots) {
  const hash = crypto.createHash('sha1');
  const collect = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
                  .sort((a, b) => a.name.localeCompare(b.name));
    } catch(e) { return; }
    for (const e of entries) {
      if (EXCLUDE.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { collect(full); continue; }
      hash.update(e.name);
      try { hash.update(fs.readFileSync(full)); } catch(e2) {}
    }
  };
  for (const r of roots) { if (fs.existsSync(r)) collect(r); }
  return hash.digest('hex');
}

const stale = [];
for (const [id, mod] of Object.entries(graph.modules || {})) {
  const roots = (mod.paths || []).filter(p => fs.existsSync(p));
  if (!roots.length) continue;
  const current = fingerprint(roots);
  if (current !== mod.fingerprint) stale.push(id);
}

const stalePath = path.join('.claude', 'graph', '.stale');
if (stale.length > 0) {
  fs.writeFileSync(stalePath, stale.join('\n') + '\n');
  console.log('⚠ Knowledge graph stale — run /graph-sync (' + stale.length + ' module(s) changed)');
} else if (fs.existsSync(stalePath)) {
  fs.unlinkSync(stalePath);
}
process.exit(0);
