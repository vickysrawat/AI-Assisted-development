#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Reads target-design-spec.md, extracts structured ### Dependencies blocks
//                      from each document template, builds the document dependency graph,
//                      validates acyclicity, and outputs JSON for the orchestrator.
// What it touches:     READ-ONLY. Reads the spec file only. Writes nothing.
// What it does NOT do: No LLM, no network, no git, no inference.
// APIs / commands:     Node fs, path. Run: node scripts/graph-derive-documents.cjs --json
// How to verify:       Exit 0 + valid JSON on success; exit 1 on cycle; exit 2 on parse error.

'use strict';
const fs   = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { json: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--json') a.json = true;
    else if (t.startsWith('--spec=')) a.spec = t.slice('--spec='.length);
  }
  return a;
}

// Extract document name from a "## Document N — `name.md`" heading
function extractDocName(heading) {
  const m = heading.match(/##\s+Document\s+\d+\s+[—–-]+\s+`?([a-z-]+(?:\.md)?)`?/i);
  if (!m) return null;
  return m[1].replace(/\.md$/, '');
}

// Parse depends_on: [...] from a ### Dependencies block
function parseDependsOn(block) {
  const m = block.match(/depends_on\s*:\s*\[([^\]]*)\]/s);
  if (!m) return [];
  return m[1]
    .split(',')
    .map(s => s.trim().replace(/^["']|["']$/g, '').replace(/\.md$/, ''))
    .filter(Boolean);
}

// Build graph: { docName: [depName, ...] }
function buildGraph(content) {
  // Split into document sections on "## Document N"
  const sections = content.split(/(?=^##\s+Document\s+\d+)/m).filter(s => s.trim());
  const graph = {};

  for (const section of sections) {
    const firstLine = section.split('\n')[0];
    const docName = extractDocName(firstLine);
    if (!docName) continue;

    // Find ### Dependencies block
    const depsMatch = section.match(/###\s+Dependencies\s*\n```[^\n]*\n([\s\S]*?)```/);
    if (!depsMatch) {
      console.error(`Parse error: no ### Dependencies block found for document "${docName}"`);
      process.exit(2);
    }

    graph[docName] = parseDependsOn(depsMatch[1]);
  }

  if (Object.keys(graph).length === 0) {
    console.error('Parse error: no document templates found in spec');
    process.exit(2);
  }

  return graph;
}

// Validate that all declared dependencies actually exist in the graph
function validateEdges(graph) {
  const docs = new Set(Object.keys(graph));
  const errors = [];
  for (const [doc, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (!docs.has(dep)) {
        errors.push(`"${doc}" depends on "${dep}" which is not a known document`);
      }
    }
  }
  return errors;
}

// Detect cycles using DFS with in-stack tracking
// Returns the cycle as an array of nodes, or null if acyclic
function detectCycle(graph) {
  const visited   = new Set();
  const inStack   = new Set();
  const stackPath = [];

  function dfs(node) {
    visited.add(node);
    inStack.add(node);
    stackPath.push(node);

    for (const dep of (graph[node] || [])) {
      if (!visited.has(dep)) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      } else if (inStack.has(dep)) {
        // Found a cycle — extract the cycle portion of the stack
        const cycleStart = stackPath.indexOf(dep);
        return stackPath.slice(cycleStart).concat(dep);
      }
    }

    inStack.delete(node);
    stackPath.pop();
    return null;
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

// Compute wave schedule (topological sort into parallel waves)
function computeWaves(graph) {
  const inDegree = {};
  for (const doc of Object.keys(graph)) inDegree[doc] = 0;
  for (const deps of Object.values(graph)) {
    for (const dep of deps) {
      // dep → doc means doc has inDegree from dep
    }
  }
  // Build reverse: for each doc, which docs does it block?
  const blocks = {};
  for (const [doc, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (!blocks[dep]) blocks[dep] = [];
      blocks[dep].push(doc);
    }
  }
  // Re-compute inDegree from the depends_on perspective
  const deg = {};
  for (const doc of Object.keys(graph)) deg[doc] = graph[doc].length;

  const waves = [];
  const remaining = new Set(Object.keys(graph));

  while (remaining.size > 0) {
    const wave = [...remaining].filter(d => deg[d] === 0);
    if (wave.length === 0) break; // cycle — should have been caught earlier
    waves.push(wave);
    for (const done of wave) {
      remaining.delete(done);
      for (const blocked of (blocks[done] || [])) {
        deg[blocked]--;
      }
    }
  }
  return waves;
}

function main() {
  const args = parseArgs(process.argv);
  const specPath = args.spec || path.join(__dirname, '..', 'skills', 'shared',
    'migration-knowledge', 'refs', 'specs', 'target-design-spec.md');

  if (!fs.existsSync(specPath)) {
    console.error(`Parse error: spec not found at ${specPath}`);
    process.exit(2);
  }

  const content = fs.readFileSync(specPath, 'utf8');
  const graph   = buildGraph(content);

  // Validate edge references
  const edgeErrors = validateEdges(graph);
  if (edgeErrors.length > 0) {
    console.error('Validation errors:\n' + edgeErrors.map(e => '  ' + e).join('\n'));
    process.exit(2);
  }

  // Detect cycles
  const cycle = detectCycle(graph);
  if (cycle) {
    const result = { error: 'cycle_detected', cycle, message: `Cycle: ${cycle.join(' → ')}` };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else console.error(`Cycle detected: ${cycle.join(' → ')}`);
    process.exit(1);
  }

  const waves  = computeWaves(graph);
  const result = { dependency_graph: graph, waves };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n  Document dependency graph\n  ' + '─'.repeat(48));
    for (const [doc, deps] of Object.entries(graph)) {
      const label = deps.length === 0 ? '(no dependencies)' : deps.join(', ');
      console.log(`  ${doc}`);
      console.log(`    depends_on: ${label}`);
    }
    console.log('\n  Wave schedule\n  ' + '─'.repeat(48));
    waves.forEach((wave, i) => {
      console.log(`  Wave ${i + 1}: ${wave.join(', ')}`);
    });
    console.log(`\n  ✓ Acyclic — ${Object.keys(graph).length} documents, ${waves.length} waves\n`);
  }

  process.exit(0);
}

main();
