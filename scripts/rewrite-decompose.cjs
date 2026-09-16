#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Rewrite-skill intake helper (AC-F4). Two pure subcommands. `posture` resolves
//                      the migration posture from stack distance: `port` ONLY when source and target
//                      share language AND framework; any language/framework change forces
//                      `re-architecture` (with keep-vs-redesign questions); no runnable oracle (or
//                      an explicit flag) yields `rewrite-from-spec`. `decompose` is a GENERIC topo-sorter:
//                      it turns WHATEVER module graph it is handed into clusters + an acyclic dependency
//                      DAG + a worktree schedule (parallelizable waves via Kahn topological sort), and
//                      reports cycles rather than silently emitting a non-DAG. "Target-space" is a
//                      property of the INPUT, not this script — the skill authors a per-option
//                      target-space projection of the source graph (port ≈ source seams; re-architecture
//                      restructures) and feeds it in; `--space=source|target` records which space the
//                      emitted DAG represents.
// What it touches:     Reads --graph=<graph.json> when given (nodes[].id + edges[].{from,to}); else
//                      reads inline --modules/--edges. Reads process.argv. Writes NOTHING.
// What it does NOT do: No code generation, no git/worktree creation (it PLANS the schedule; the skill
//                      creates worktrees behind the Write Gate), no target knowledge (it sorts whatever
//                      graph it is given — there is NO --option flag), no network, no LLM, no mutation.
// APIs / commands:     Node stdlib: fs, path. Exit codes: posture 0; decompose 0=acyclic ·
//                      11=cycle detected; 1=usage/error.
// How to verify:       node scripts/rewrite-decompose.cjs posture --source-lang=java --source-fw=spring --target-lang=csharp --target-fw=aspnet --json
//                      node scripts/rewrite-decompose.cjs decompose --modules=a,b,c --edges=a>b,b>c --json
//                      node tests/rewrite-decompose.test.cjs  -> "N passed · 0 failed".

'use strict';
const fs = require('fs');

const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const norm = (s) => (s || '').trim().toLowerCase();
// Provenance only: which space the fed graph represents. Defaults to `source` (back-compat); the skill
// passes `--space=target` when it feeds a per-option target-space projection. Does NOT change the sort.
const SPACE = norm(arg('space')) === 'target' ? 'target' : 'source';

// ── posture ───────────────────────────────────────────────────────────────────
// DECISION: how the migration posture is chosen (it gates the whole rewrite)
// Options considered:
//   A) let the developer pick posture freely — rejected: `port` on a language change is unsafe and
//      invites a false "same-shape" assumption; posture must follow real stack distance
//   B) infer purely from language — rejected: same language but a framework swap (e.g. Express→Nest)
//      is still a re-architecture, not a straight port
//   C) stack-distance rule: port ONLY for same-lang+same-fw; any lang/fw change → re-architecture;
//      no runnable oracle → rewrite-from-spec — chosen: matches rewrite.md T1 + is falsifiable
function opPosture() {
  const sl = norm(arg('source-lang')), sf = norm(arg('source-fw'));
  const tl = norm(arg('target-lang')), tf = norm(arg('target-fw'));
  const oracle = norm(arg('oracle'));           // 'none' → no runnable source
  const forced = norm(arg('posture'));

  if (forced === 'rewrite-from-spec' || oracle === 'none') {
    return { op: 'posture', posture: 'rewrite-from-spec', port_offered: false,
             reason: oracle === 'none' ? 'no runnable source oracle — intent must come from the inventory/spec' : 'explicitly requested',
             questions: ['Confirm the authoritative intent source (inventory / spec / BYO design).'] };
  }
  if (!sl || !tl) return { op: 'posture', posture: 'unknown', port_offered: false, reason: 'source-lang and target-lang are required' };

  if (sl === tl && sf === tf) {
    return { op: 'posture', posture: 'port', port_offered: true,
             reason: `same language (${sl}) and framework (${sf || 'n/a'}) — a straight port is viable`, questions: [] };
  }
  const changed = sl !== tl ? `language ${sl}→${tl}` : `framework ${sf || 'n/a'}→${tf || 'n/a'}`;
  return { op: 'posture', posture: 're-architecture', port_offered: false,
           reason: `${changed} crosses a stack boundary — port refused; re-architecture required`,
           questions: [
             'Keep the existing architecture (structure-preserving) or redesign it for the target platform?',
             'Keep the current platform/topology or adopt target-native services?',
           ] };
}

// ── decompose ─────────────────────────────────────────────────────────────────
function readGraph() {
  const gp = arg('graph');
  if (gp) {
    const g = JSON.parse(fs.readFileSync(gp, 'utf8'));
    const nodes = (g.nodes || g.modules || []).map(n => ({ id: n.id || n.module || n.name, domain: n.domain }));
    const edges = (g.edges || []).map(e => ({ from: e.from, to: e.to }));
    return { nodes, edges };
  }
  const nodes = (arg('modules') || '').split(',').map(s => s.trim()).filter(Boolean).map(id => ({ id, domain: undefined }));
  const edges = (arg('edges') || '').split(',').map(s => s.trim()).filter(Boolean)
    .map(pair => { const [from, to] = pair.split('>').map(x => x.trim()); return { from, to }; })
    .filter(e => e.from && e.to);
  return { nodes, edges };
}

// Kahn topological sort → ordered nodes + parallelizable waves. An edge {from, to} means
// "from DEPENDS ON to", so `to` (the prerequisite) must be built BEFORE `from` (the dependent):
// in-degree counts a node's dependencies, and finishing a prerequisite unblocks its dependents.
// Remaining nodes after the queue drains are a cycle (a DAG must be acyclic — we surface it, never
// emit a bad order silently).
function topoWaves(ids, edges) {
  const indeg = new Map(ids.map(i => [i, 0]));
  const adj = new Map(ids.map(i => [i, []]));
  for (const { from, to } of edges) {
    if (from === to || !indeg.has(from) || !indeg.has(to)) continue;   // drop self-loops / dangling
    adj.get(to).push(from);              // prerequisite `to` done → dependent `from` unblocks
    indeg.set(from, indeg.get(from) + 1); // `from` has one more dependency to satisfy
  }
  const order = [], waves = [];
  let frontier = ids.filter(i => indeg.get(i) === 0);
  const seen = new Set();
  while (frontier.length) {
    waves.push([...frontier].sort());
    const next = [];
    for (const u of frontier) {
      seen.add(u); order.push(u);
      for (const v of adj.get(u)) { indeg.set(v, indeg.get(v) - 1); if (indeg.get(v) === 0) next.push(v); }
    }
    frontier = next;
  }
  const cycle = ids.filter(i => !seen.has(i));
  return { order, waves, cycle };
}

function opDecompose() {
  const { nodes, edges } = readGraph();
  if (!nodes.length) throw new Error('decompose requires --graph=<file> or --modules=<a,b,c>');

  // DECISION: target-space cluster granularity
  // Options considered:
  //   A) one giant cluster — rejected: defeats parallel worktrees + per-cluster BAL (Inc C)
  //   B) 1 cluster per source module — chosen default: simplest, preserves the source seam, and the
  //      dependency DAG falls straight out of the module graph
  //   C) group by domain — offered via --group-by-domain when the graph carries domains (fewer,
  //      coarser clusters); still a DAG over the grouped units
  const groupByDomain = process.argv.includes('--group-by-domain') && nodes.some(n => n.domain);
  const clusterOf = new Map();
  const clusters = new Map();
  for (const n of nodes) {
    const key = groupByDomain ? (n.domain || n.id) : n.id;
    clusterOf.set(n.id, key);
    if (!clusters.has(key)) clusters.set(key, { name: key, modules: [], domain: groupByDomain ? key : n.domain });
    clusters.get(key).modules.push(n.id);
  }

  // Lift module edges to cluster edges (dedup, drop intra-cluster).
  const clusterEdges = [];
  const seenEdge = new Set();
  for (const { from, to } of edges) {
    const cf = clusterOf.get(from), ct = clusterOf.get(to);
    if (!cf || !ct || cf === ct) continue;
    const k = `${cf}>${ct}`;
    if (!seenEdge.has(k)) { seenEdge.add(k); clusterEdges.push({ from: cf, to: ct }); }
  }

  const ids = [...clusters.keys()];
  const { order, waves, cycle } = topoWaves(ids, clusterEdges);
  const acyclic = cycle.length === 0;
  return {
    op: 'decompose', space: SPACE, acyclic,
    clusters: [...clusters.values()],
    dag: clusterEdges,
    order, waves,
    worktree_plan: waves.map((w, i) => ({ wave: i + 1, clusters: w })),
    cycles: cycle,
    note: acyclic ? 'Each wave is a batch of clusters generatable in parallel worktrees (deps satisfied).'
                  : `Cyclic dependency among [${cycle.join(', ')}] — break the cycle before scheduling worktrees.`,
  };
}

module.exports = { opPosture, opDecompose, topoWaves };

if (require.main === module) {
  try {
    let result, exit = 0;
    if (OP === 'posture') result = opPosture();
    else if (OP === 'decompose') { result = opDecompose(); exit = result.acyclic ? 0 : 11; }
    else { process.stderr.write('usage: rewrite-decompose.cjs <posture|decompose> [--source-lang --source-fw --target-lang --target-fw --oracle] [--graph | --modules --edges] [--group-by-domain] [--space=source|target] [--json]\n'); process.exit(1); }

    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else if (result.op === 'posture') {
      const lines = [`posture: ${result.posture}`, `port offered: ${result.port_offered}`, `reason: ${result.reason}`];
      (result.questions || []).forEach(q => lines.push(`  ? ${q}`));
      process.stdout.write(lines.join('\n') + '\n');
    } else {
      const lines = [`space: ${result.space}`, `clusters: ${result.clusters.length}`, `acyclic: ${result.acyclic}`, `order: ${result.order.join(' → ')}`, 'worktree waves:'];
      result.worktree_plan.forEach(w => lines.push(`  wave ${w.wave}: ${w.clusters.join(', ')}`));
      if (result.cycles.length) lines.push(`CYCLE: ${result.cycles.join(', ')}`);
      process.stdout.write(lines.join('\n') + '\n');
    }
    process.exit(exit);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
