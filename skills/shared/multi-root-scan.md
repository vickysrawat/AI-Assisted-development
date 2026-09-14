# Shared spec: multi-root scan resolution

_Spec version: 1.0 · Last changed: 2026-09-14 · Used by: graph-create, graph-sync, module-derive.cjs, graph-extract-edges.js, security, code-review, app-readiness_

Single source of truth for **"which roots do I scan?"** A scan root is the repo root plus, when
the caller opts in, the locally-cloned dependency repos the developer wired into
`.claude/settings.local.json → additionalDirectories` (see `skills/external-dir-map/SKILL.md`).

Every skill or script that enumerates source files MUST derive its roots from one of the snippets
below — do **not** hard-code `find .` / `grep -r … .` / `process.cwd()` as the sole root. Those
improvisations are exactly what made dependency repos silently invisible to scanners.

## Policy — read-default, write-confirm

`additionalDirectories` entries are **curated** (only manifest-referenced local dependency repos, or
paths the developer explicitly confirmed in `setup-init`). Treat them as in-scope; there is no trust
classification. The only policy axis is read vs. write:

| Caller kind | Include dependencies? |
|---|---|
| Read-only orientation (graph build/sync, `explain`, `icea-feature`, `update-arch`) | **Yes, by default** |
| Ledger-writing scanners (`security`, `code-review`, `app-readiness`) | **Only on `--with-deps`** — they persist FP-fingerprinted findings and gate `checkin` Check D |
| Any **write** into a resolved root outside the repo root | Always confirm per the Write Gate — `APPROVE ALL` does not blanket a repo-boundary crossing |

Callers pass an include-deps flag. When false the resolver returns the repo root only.

## Announce convention

Before scanning, print each non-repo root once:
```
📁 also scanning dependency: {absolute/path}
```
Never scan a dependency root silently.

---

## 1. Bash flavour — for shell blocks that loop over roots

Single-quoted `node -e '…'`, double-quoted JS strings, normalises `\` → `/` so git-bash tools accept
Windows paths. Emits one absolute root per line: the repo root first, then each existing, non-nested,
de-duplicated dependency dir (only when include-deps is `1`).

```bash
# Usage:
#   INCLUDE_DEPS=1   # 1 = repo + additionalDirectories ; 0 = repo only
#   while IFS= read -r ROOT; do
#     [ "$ROOT" = "$PWD" ] || echo "📁 also scanning dependency: $ROOT"
#     find "$ROOT" -name '*.cs' ...
#   done < <(multi_root_scan_roots "$INCLUDE_DEPS")
multi_root_scan_roots() {
  node -e '
const fs=require("fs"), path=require("path");
const includeDeps = process.argv[1] === "1";
const norm = p => p ? path.resolve(p).split(String.fromCharCode(92)).join("/").replace(/\/+$/,"") : "";
const repo = norm(process.cwd());
const roots = [repo];
if (includeDeps) {
  let dirs = [];
  try {
    const s = JSON.parse(fs.readFileSync(".claude/settings.local.json","utf8"));
    dirs = Array.isArray(s.additionalDirectories) ? s.additionalDirectories : [];
  } catch(e) {}
  for (const d of dirs) {
    const nd = norm(d);
    if (!nd) continue;                                      // empty
    if (!fs.existsSync(nd)) continue;                       // skip-missing
    if (roots.some(r => nd === r || nd.startsWith(r + "/"))) continue; // dup / nested-in-existing
    roots.push(nd);
  }
}
process.stdout.write([...new Set(roots)].join("\n"));
' "${1:-0}"
}
```

---

## 2. Node flavour — for use *inside* an existing `.cjs`/`.js` script

Drop this function in (assumes `fs` and `path` are already required, as `module-derive.cjs` and
`graph-extract-edges.js` do). Returns an array of absolute roots. No `\`→`/` normalisation needed —
Node accepts mixed separators on Windows, but paths are resolved absolute and trailing-slash-trimmed
so a `sourceRoot` written to `graph.json` is stable.

```javascript
function scanRoots(includeDeps) {
  const norm = p => p ? path.resolve(p).replace(/[\\/]+$/,'') : '';
  const repo = norm(process.cwd());
  const roots = [repo];
  if (includeDeps) {
    let dirs = [];
    try {
      const s = JSON.parse(fs.readFileSync('.claude/settings.local.json','utf8'));
      dirs = Array.isArray(s.additionalDirectories) ? s.additionalDirectories : [];
    } catch(e) {}
    for (const d of dirs) {
      const nd = norm(d);
      if (!nd || !fs.existsSync(nd)) continue;
      if (roots.some(r => nd === r || nd.startsWith(r + require('path').sep) || nd.startsWith(r + '/'))) continue;
      roots.push(nd);
    }
  }
  return [...new Set(roots)];
}
```

The first root is always the repo (its modules carry no `sourceRoot` — absent ⇒ repo root). Every
subsequent root is a dependency; modules derived from it are tagged with `sourceRoot: <absolute path>`
(see `skills/shared/graph-json-schema.md`).

---

## Hard rules

- The repo root is ALWAYS included and ALWAYS first.
- NEVER include a dependency root that does not exist on disk (skip-missing, never error).
- NEVER include a root nested inside an already-included root (avoids double-scanning).
- NEVER change the shape of `additionalDirectories` in `settings.local.json` — it is a flat string
  array Claude Code reads directly for file access.
- Ledger-writing scanners default to repo-only; dependencies require an explicit `--with-deps`.
