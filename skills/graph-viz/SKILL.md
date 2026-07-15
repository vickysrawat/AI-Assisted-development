---
name: graph-viz
description: >
  Render the codebase knowledge graph as a self-contained, offline HTML visualization
  at .claude/graph/graph.html. Reads .claude/graph/graph.json only (never source) and
  draws a 2D SVG dependency graph — nodes grouped/coloured by type, edges styled by type
  and confidence, hub (god) nodes and stale modules flagged, hover shows dependencies and
  dependents. Opt-in 3D mode via a locally vendored WebGL library.
  Triggered by /ai-assisted-development:graph-viz.
  Also triggers on: "visualize the graph", "show the knowledge graph", "graph diagram",
  "render the dependency graph", "graph visualization".
---

# Graph Viz Skill

_Skill version: 1.0 · Last changed: 2026-07-03 · Plugin compatibility: ≥3.3.0 · Consent: C_

Effort tier: **low** (deterministic transform of `graph.json` to HTML).

**Consent (Category C):** reads `.claude/graph/graph.json` (and the `.stale` flag) only —
never application source. No source-file gate applies. See
`skills/shared/source-file-consent.md`; this skill has no B1–B7 business sensitivity
(`skills/shared/business-context-severity.md`).

**Write-silent rule:** write `graph.html` directly to disk; confirm with a one-line
`✓ Written` message. Never echo HTML content to chat.

**Offline constraint:** the output must be fully self-contained and open over `file://`
with **no network calls** — no CDN, no remote fonts/scripts (client-internal deployment).

This is a **read-only consumer** of the graph. It never writes `graph.json`, the index,
or detail files; the visualization (`graph.html`) is **gitignored**, like `memory/health.html` —
regenerate it on demand with `/graph-viz` (a cheap, deterministic template fill from `graph.json`, no re-analysis), rather than committing it.

---

## Persona
Acts with a **[DPE] DevOps/Platform Engineer** lens — deterministic, self-contained, offline-safe
output; always asks "is this reproducible and dependency-free?" Lens only; never assume, never
attribute in output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Step 1 — Guard

```bash
test -f .claude/graph/graph.json && echo OK || echo "NO_GRAPH"
```
If `NO_GRAPH`:
```
⚠ No graph.json found. Run /setup-init to create the graph, or /graph-sync to refresh it.
```
Stop.

---

## Step 2 — Read inputs

- Parse `.claude/graph/graph.json` → `meta`, `nodes[]`, `edges[]`.
- Read `.claude/graph/.stale` if present; parse the `modules:` line into a list of stale
  module ids (empty if no flag).

---

## Step 3 — Mode

- Default: **2D** (Step 4).
- `--3d`: use 3D **only if** a vendored WebGL library exists at
  `.claude/graph/vendor/3d-force-graph.min.js` (MIT, committed locally by the developer —
  never fetched). If it is absent:
  ```
  ⚠ 3D mode needs a vendored library at .claude/graph/vendor/3d-force-graph.min.js
    (no external download is permitted). Falling back to 2D.
  ```
  and render 2D. When present, inline its contents into the template in place of the 2D
  renderer script and pass the same `DATA`/`STALE` payload.

---

## Step 4 — Write `graph.html` (2D)

Write `.claude/graph/graph.html` using the template below **verbatim**, replacing exactly
two placeholders:
- `/*__GRAPH_JSON__*/` → the full contents of `graph.json` (a JSON object literal)
- `/*__STALE__*/` → a JSON array of stale module id strings (e.g. `["orders","auth"]`, or `[]`)

Do not alter anything else. Then confirm:
```
✓ Written: .claude/graph/graph.html (open it in a browser — offline, no network)
```

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge Graph</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0f1115; color:#e6e6e6; }
  header { padding:10px 16px; border-bottom:1px solid #2a2f3a; display:flex;
           gap:16px; align-items:baseline; flex-wrap:wrap; }
  header h1 { font-size:15px; margin:0; font-weight:600; }
  header .meta { color:#9aa4b2; }
  #legend { padding:8px 16px; border-bottom:1px solid #2a2f3a; display:flex;
            gap:14px; flex-wrap:wrap; color:#9aa4b2; }
  #legend span.k { display:inline-flex; align-items:center; gap:5px; }
  #legend i { width:11px; height:11px; border-radius:3px; display:inline-block; }
  svg { width:100vw; height:calc(100vh - 92px); display:block; }
  .edge { stroke:#5b6472; stroke-width:1; fill:none; opacity:.5; }
  .edge.inferred { stroke-dasharray:4 3; }
  .edge.ambiguous { stroke-dasharray:1 4; }
  .node circle { stroke:#0f1115; stroke-width:1.5; cursor:pointer; }
  .node.hub circle { stroke:#ffd15c; stroke-width:2.5; }
  .node.stale circle { stroke:#ff5c5c; stroke-width:2.5; }
  .node text { fill:#cdd3dc; font-size:10px; pointer-events:none; }
  .dim { opacity:.08; }
  .hi  { opacity:1 !important; }
  #tip { position:fixed; pointer-events:none; background:#1b2029; border:1px solid #333b48;
         border-radius:6px; padding:8px 10px; max-width:280px; display:none; z-index:9; }
  #tip b { color:#fff; } #tip .r { color:#9aa4b2; }
</style>
</head>
<body>
<header>
  <h1>Knowledge Graph</h1>
  <span class="meta" id="hmeta"></span>
</header>
<div id="legend"></div>
<svg id="g"><g id="edges"></g><g id="nodes"></g></svg>
<div id="tip"></div>
<script>
const DATA = /*__GRAPH_JSON__*/;
const STALE = /*__STALE__*/;
const TYPE_COLOR = { service:"#5b9dff", repository:"#3ecf8e", ui:"#c792ea",
  datastore:"#f0a35e", "external-api":"#ff6b8a", "shared-lib":"#7fd1de", domain:"#b0b8c4" };
const nodes = DATA.nodes || [], edges = DATA.edges || [];
const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
const staleSet = new Set(STALE || []);
// degree + dependents/dependencies
const deg = {}, outs = {}, ins = {};
nodes.forEach(n => { deg[n.id]=0; outs[n.id]=[]; ins[n.id]=[]; });
edges.forEach(e => { if(byId[e.from]&&byId[e.to]){ deg[e.from]++; deg[e.to]++;
  outs[e.from].push(e); ins[e.to].push(e); } });
// layout: cluster by type around a circle, nodes on a sub-circle per cluster
const types = [...new Set(nodes.map(n => n.type || "domain"))];
const W = Math.max(900, innerWidth), H = Math.max(600, innerHeight-92);
const cx=W/2, cy=H/2, R=Math.min(W,H)*0.34;
const pos = {};
types.forEach((t,ti) => {
  const members = nodes.filter(n => (n.type||"domain")===t);
  const ang = (ti/types.length)*2*Math.PI;
  const ccx = cx + R*Math.cos(ang), ccy = cy + R*Math.sin(ang);
  const r = 24 + members.length*10;
  members.forEach((n,i) => { const a=(i/Math.max(1,members.length))*2*Math.PI;
    pos[n.id] = { x: ccx + r*Math.cos(a), y: ccy + r*Math.sin(a) }; });
});
const svg=document.getElementById("g"), gE=document.getElementById("edges"), gN=document.getElementById("nodes");
svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
const NS="http://www.w3.org/2000/svg";
edges.forEach(e => { const a=pos[e.from], b=pos[e.to]; if(!a||!b) return;
  const p=document.createElementNS(NS,"line");
  p.setAttribute("x1",a.x);p.setAttribute("y1",a.y);p.setAttribute("x2",b.x);p.setAttribute("y2",b.y);
  const c=(e.confidence||"EXTRACTED").toLowerCase();
  p.setAttribute("class","edge"+(c==="inferred"?" inferred":c==="ambiguous"?" ambiguous":""));
  p.dataset.from=e.from; p.dataset.to=e.to; gE.appendChild(p); });
nodes.forEach(n => { const p=pos[n.id]; const g=document.createElementNS(NS,"g");
  let cls="node"+(n.hub?" hub":"")+(staleSet.has(n.id)?" stale":"");
  g.setAttribute("class",cls); g.dataset.id=n.id;
  const c=document.createElementNS(NS,"circle");
  c.setAttribute("cx",p.x);c.setAttribute("cy",p.y);
  c.setAttribute("r",6+Math.min(14,deg[n.id]*1.6));
  c.setAttribute("fill",TYPE_COLOR[n.type]||TYPE_COLOR.domain);
  const t=document.createElementNS(NS,"text");
  t.setAttribute("x",p.x+8);t.setAttribute("y",p.y+3);t.textContent=n.module||n.id;
  g.appendChild(c);g.appendChild(t);gN.appendChild(g);
  g.addEventListener("mouseenter",ev=>focus(n.id,ev));
  g.addEventListener("mousemove",ev=>{const tip=document.getElementById("tip");
    tip.style.left=(ev.clientX+14)+"px";tip.style.top=(ev.clientY+14)+"px";});
  g.addEventListener("mouseleave",unfocus);
});
function focus(id,ev){ const near=new Set([id]);
  outs[id].forEach(e=>near.add(e.to)); ins[id].forEach(e=>near.add(e.from));
  gN.querySelectorAll(".node").forEach(g=>g.classList.toggle("dim",!near.has(g.dataset.id)));
  gE.querySelectorAll(".edge").forEach(e=>{const on=e.dataset.from===id||e.dataset.to===id;
    e.classList.toggle("hi",on); e.classList.toggle("dim",!on);});
  const tip=document.getElementById("tip"); const n=byId[id];
  tip.innerHTML=`<b>${n.module||n.id}</b> <span class="r">(${n.type||"?"})</span><br>`
    +`<span class="r">depends on:</span> ${outs[id].map(e=>e.to).join(", ")||"—"}<br>`
    +`<span class="r">depended on by:</span> ${ins[id].map(e=>e.from).join(", ")||"—"}`;
  tip.style.display="block";
  if(ev){tip.style.left=(ev.clientX+14)+"px";tip.style.top=(ev.clientY+14)+"px";}
}
function unfocus(){ gN.querySelectorAll(".node").forEach(g=>g.classList.remove("dim"));
  gE.querySelectorAll(".edge").forEach(e=>e.classList.remove("hi","dim"));
  document.getElementById("tip").style.display="none"; }
document.getElementById("hmeta").textContent =
  `${nodes.length} modules · ${edges.length} edges · ${STALE.length} stale · `
  +`${nodes.filter(n=>n.hub).map(n=>n.module||n.id).join(", ")||"no"} hub(s) · generated ${(DATA.meta||{}).generatedAt||"?"}`;
const leg=document.getElementById("legend");
types.forEach(t=>{leg.insertAdjacentHTML("beforeend",
  `<span class="k"><i style="background:${TYPE_COLOR[t]||TYPE_COLOR.domain}"></i>${t}</span>`);});
leg.insertAdjacentHTML("beforeend",
  `<span class="k" style="color:#ffd15c">◯ hub</span>`
  +`<span class="k" style="color:#ff5c5c">◯ stale</span>`
  +`<span class="k">— extracted · – – inferred · ··· ambiguous</span>`);
</script>
</body>
</html>
````

---

## Step 5 — Report

```
✅ graph-viz complete
  {N} modules · {N} edges · {N} stale · hubs: {names or none}
  → .claude/graph/graph.html  (open in a browser; offline, no network)
```

---

## Hard rules

- Read `graph.json` (+ `.stale`) only — never application source (Category C)
- NEVER echo HTML content to chat — write-silent rule
- Output must be fully offline — no CDN, no remote assets
- Never write `graph.json` / index / detail files — this skill is read-only over the graph
- 3D requires a locally vendored library; never download it — fall back to 2D if absent
