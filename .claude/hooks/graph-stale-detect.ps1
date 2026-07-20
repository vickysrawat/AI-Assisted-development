#!/usr/bin/env pwsh
# hooks/graph-stale-detect.ps1 — knowledge-graph staleness detector (PowerShell port of graph-stale-detect.sh)
#
# Fallback when bash is unavailable. Git post-merge/post-checkout hook.
# Pure PowerShell + Node.js for SHA1 — no bash required.
#
# Install:  cp .claude/hooks/graph-stale-detect.ps1 to be called from your git hook shim.
# Exit code is always 0 — a hook must never block a merge/checkout.
#
# Fingerprinting matches bash graph_module_fingerprint(): SHA1 of sorted
# "sha1(fileN)  relpath\n" lines, giving a stable module-wide hash.

$graphDir  = '.claude/graph'
$graphJson = "$graphDir/graph.json"
$staleFlag = "$graphDir/.stale"

if (-not (Test-Path $graphJson)) { exit 0 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { exit 0 }

# Read module id + stored fingerprint + path roots from graph.json (same inline JS as .sh)
$readModulesJs = @'
const fs = require("fs");
try {
    const g = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const n of (g.nodes || [])) {
        const roots = (n.paths || []).map(p => p.replace(/\/\*\*.*$/, "").replace(/\/\*$/, ""));
        process.stdout.write(`${n.id}\t${n.fingerprint || ""}\t${roots.join(" ")}\n`);
    }
} catch (e) { process.exit(0); }
'@

$nodes = (& node -e $readModulesJs $graphJson 2>$null) -join "`n"
if (-not $nodes.Trim()) { exit 0 }

# Fingerprint script: mirrors bash graph_module_fingerprint().
# Walks each root, sorts all file paths, hashes each file's contents, then
# SHA1s the concatenated "hash  relpath\n" lines — same algorithm as sha1sum pipeline.
$fingerprintJs = @'
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const excluded = new Set([".git","node_modules","bin","obj","dist",".angular","migrations","__pycache__"]);
const roots    = process.argv.slice(1);  // argv[1..] = roots passed as extra args

function walk(dir, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!excluded.has(e.name)) walk(full, out);
        } else if (e.isFile()) {
            out.push(full);
        }
    }
}

const files = [];
for (const r of roots) { if (fs.existsSync(r)) walk(r, files); }
files.sort();  // deterministic order — mirrors sort -z

const lines = files.map(f => {
    try {
        const hash = crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
        const rel  = path.relative(process.cwd(), f).replace(/\\/g, "/");
        return `${hash}  ${rel}`;  // matches sha1sum output format
    } catch { return null; }
}).filter(Boolean);

const combined = lines.join("\n") + (lines.length ? "\n" : "");
process.stdout.write(crypto.createHash("sha1").update(combined).digest("hex") + "\n");
'@

$staleModules = @()
foreach ($line in ($nodes -split '\n')) {
    $line = $line.Trim()
    if (-not $line) { continue }

    $parts = $line -split '\t', 3
    if ($parts.Count -lt 2) { continue }

    $id      = $parts[0].Trim()
    $stored  = $parts[1].Trim()
    $rootArr = if ($parts.Count -ge 3) {
                   @($parts[2].Trim() -split '\s+' | Where-Object { $_ })
               } else { @() }

    if (-not $rootArr.Count) { continue }

    $current = (& node -e $fingerprintJs @rootArr 2>$null | Select-Object -First 1).Trim()
    if ($current -ne $stored) {
        $staleModules += $id
    }
}

if ($staleModules) {
    $timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')
    "# Knowledge graph is stale — run /graph-sync`n# Detected: $timestamp`nmodules: $($staleModules -join ' ')" |
        Set-Content -Path $staleFlag -Encoding UTF8
}

exit 0
