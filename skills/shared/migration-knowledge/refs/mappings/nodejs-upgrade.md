# Parity Mapping: Node.js version upgrades

_Loaded when source = `nodejs` for in-place same-stack version upgrades._

> **Scope — same-stack only.** Covers Node.js 16 → 18 → 20 → 22 LTS upgrades.
> Does NOT apply to Node.js → Python migrations (`nodejs-python.md`) or
> Node.js → .NET migrations (`nodejs-dotnet.md`).

---

## Overview

Node.js follows an LTS release schedule (even-numbered versions are LTS). Upgrades are
generally low-disruption; the main work is:
1. Runtime API deprecations/removals
2. V8 engine updates (rare JS behavioral changes)
3. Native module (`.node`) recompilation
4. `package.json` `engines` field update

---

## Pre-hop blockers — check BEFORE switching Node.js version

### Native addon (node-gyp) compatibility

Packages that compile C/C++ code via `node-gyp` are tied to a specific Node.js ABI version.
A module compiled for Node 18 (ABI 108) will not load on Node 20 (ABI 115) — the runtime
error is: `"The module was compiled against NODE_MODULE_VERSION 108; this version requires 115"`.
[VERIFIED — electron.js native modules docs, zylos.ai/research 2026-06-17]

Before upgrading, inventory native addons:
```bash
# Find packages with a node-gyp install script (these compile native code)
grep -r '"install".*node-gyp' node_modules/*/package.json 2>/dev/null | awk -F/ '{print $2}' | sort -u

# Check process.versions.modules for the current ABI number
node -e "console.log(process.versions.modules)"
```

Common native addon packages: `bcrypt`, `better-sqlite3`, `sharp`, `canvas`, `node-sass`,
`fsevents`, `cpu-features`, `kerberos`.

**N-API vs node-gyp:** Modules built with N-API (Node's stable C ABI) are forward-compatible across
Node major versions and do not need recompilation. Check the package's README for N-API support —
if it uses N-API, no `npm rebuild` is needed after a Node version upgrade.

After upgrading the Node.js version, always run:
```bash
npm rebuild   # recompiles all native addons against the new ABI
```

### Built-in vs polyfill conflict

Node.js has progressively promoted browser APIs to built-ins. Packages that polyfill these
built-ins can shadow or conflict with the native implementation: [VERIFIED — nodejs.org v22 release]

| Built-in | Stable since | Polyfill to remove |
|---|---|---|
| `fetch` (global) | Node 21 | `node-fetch`, `cross-fetch`, `whatwg-fetch` |
| `WebSocket` (global) | Node 22 (enabled by default) | `ws` (as a global shim), `websocket` |
| `AbortController` / `AbortSignal` | Node 15+ | any AbortController polyfill |

Removing a polyfill is optional but avoids shadowing bugs. Verify behaviour under the built-in
before removing the package, especially if you use library-specific extensions (e.g. `ws` server
mode — the built-in WebSocket client does not replace a WebSocket server).

---

## GREEN — Migrates Cleanly

| Component | Notes |
|---|---|
| `async`/`await`, `Promise` | No changes |
| `fs`, `path`, `os`, `crypto` built-ins | Stable; only deprecated sub-APIs change |
| Express 4.x routing | No changes tied to Node version |
| `http` / `https` modules | No breaking changes |
| Jest / Mocha tests | Independent versioning; update separately |
| `dotenv` config loading | No changes |
| `winston` / `pino` logging | No changes tied to Node version |

---

## YELLOW — Needs Rework (version-specific)

### Migrating FROM Node 16

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `fetch` (global) | Node 18 added built-in `fetch` (experimental; stable in 21). If source uses `node-fetch` polyfill, the built-in may conflict. | S | LOW — `node-fetch` still works |
| `AbortController` / `AbortSignal` | Built-in from Node 15+. If source polyfills these, remove the polyfill. | S | LOW |
| `util.isX()` deprecated APIs | `util.isArray`, `util.isBoolean`, etc. — deprecated, removed in Node 22. | S | MEDIUM |
| OpenSSL 3 (Node 18) | Node 18 ships with OpenSSL 3. Some older TLS/cipher configurations rejected. | S | HIGH if using legacy TLS ciphers |

### Migrating FROM Node 18

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `fetch` stable | Stable from Node 21. If using `node-fetch`, `undici`, or `axios` as a `fetch` shim, review whether to switch to built-in. | S | LOW |
| Native modules | Binaries compiled for Node 18 N-API may need recompilation for Node 20+ N-API changes. Run `npm rebuild`. | S | MEDIUM if using native `.node` add-ons |
| `import.meta.resolve` | Sync in Node 20.6+. No migration needed. | — | LOW |

### Migrating FROM Node 20

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `require(ESM)` | Node 22 supports `require()` of ESM modules (experimental). No breaking change for CommonJS apps. | — | LOW |
| `fs.glob` | Added Node 22. Voluntary adoption. | — | LOW |

---

## RED — Will Break

### Removed APIs

| Removed | Version | Replacement |
|---|---|---|
| `util.isArray`, `util.isBoolean`, etc. | Node 22 | Use `Array.isArray()`, `typeof`, etc. |
| `url.parse()` | Deprecated since Node 11; avoid reliance | Use `new URL()` |
| `assert.equal` (non-strict) | Ongoing — produces warnings | Use `assert.strictEqual` |
| Legacy crypto `createCipher` | Removed Node 22 | Use `createCipheriv` with explicit IV |

### Native module recompilation

If the project uses native addons (`.node` files), they must be recompiled against the new
Node.js version:
```bash
npm rebuild
# or if using node-pre-gyp
npx node-pre-gyp rebuild
```

### Stale exact version pins — peer dependency conflicts

Exact version pins in `package.json` (e.g. `"axios": "0.27.2"`) become stale when other packages
update and declare peer dependencies on a newer range. This is the Node.js equivalent of NU1605
in .NET. [VERIFIED — npmjs.com/package/check-peer-dependencies]

Detect after upgrading:
```bash
npx check-peer-dependencies   # comprehensive peer dep conflict detection
npm ls <package-name>          # inspect dependency tree for a specific package
npm explain <package-name>     # trace why a version was resolved
```

Fix: upgrade the stale-pinned package to a version whose peer dependency range satisfies all
consumers. Do NOT use `--legacy-peer-deps` as a permanent fix.

### OpenSSL 3 cipher restrictions (Node 18+)

Node 18 ships OpenSSL 3, which rejects legacy ciphers (MD4, RC4, some DES configurations).
If the app connects to services using legacy TLS:
- Update TLS config to use modern cipher suites
- Or set `--openssl-legacy-provider` (temporary workaround only)

---

## replacement_mappings

| Old | New | Scope |
|---|---|---|
| `util.isArray(x)` | `Array.isArray(x)` | Any `.js`/`.cjs`/`.mjs` file |
| `url.parse(str)` | `new URL(str)` | HTTP routing, URL construction |
| `assert.equal` | `assert.strictEqual` | Test files |
| `crypto.createCipher` | `crypto.createCipheriv` | Crypto utility modules |
| `node-fetch` (v2) | `node-fetch` v3 or built-in `fetch` | HTTP client modules |

---

## behavioral_changes

Patterns for **Pass 3** codebase scan — grep each; flag files where found.

| Pattern | Changed In | Description | Required Action |
|---|---|---|---|
| `util.isArray` | Node 22 removed | Utility removed | Replace with `Array.isArray()` |
| `util.isBoolean` | Node 22 removed | Utility removed | Replace with `typeof x === 'boolean'` |
| `url.parse` | Deprecated Node 11+ | Legacy URL parsing | Replace with `new URL()` |
| `assert.equal` | Ongoing | Non-strict equality | Replace with `assert.strictEqual` |
| `createCipher` | Node 22 removed | Legacy cipher without IV | Replace with `createCipheriv` |
| `--openssl-legacy-provider` | Node 18 OpenSSL 3 | Workaround flag — may mask real issue | Remove and fix underlying cipher usage |
| `node-fetch` | Node 18+ | Built-in `fetch` available | Evaluate switch to global `fetch`; remove if using v2 (ESM-only in v3) |
| `process.binding` | Node 12+ | Internal API removed | Avoid — use official Node APIs |

---

## Migration Procedure

### Step 1 — Update `.nvmrc` / `.node-version` / `package.json` engines
```json
{
  "engines": { "node": ">=20.0.0" }
}
```

### Step 2 — Install new Node version (via nvm)
```bash
nvm install 20
nvm use 20
node --version
```

### Step 3 — Rebuild native modules
```bash
npm rebuild
```

### Step 4 — Audit deprecated API usage
```bash
node --pending-deprecation app.js  # prints deprecation warnings at startup
```

### Step 5 — Run tests
```bash
# If using TypeScript: type-check FIRST without emitting output
npx tsc --noEmit   # surfaces type errors without a full build

# Then full build and tests
npm run build
npm test
```

> **Build order tip:** `tsc --noEmit` isolates TypeScript type errors from bundler/runtime
> errors. Fix type errors first, then run the full build to surface bundler configuration issues,
> then run tests for behavioral regressions.

---

## Recommended Slice Plan

| Slice | Name | Content |
|---|---|---|
| U1 | Runtime version switch | Update `.nvmrc`, `package.json` engines, CI image |
| U2 | Native module recompile | `npm rebuild`; verify add-ons |
| U3 | Removed API fixes | `util.isX`, `url.parse`, `createCipher` |
| U4 | OpenSSL 3 TLS audit | Fix legacy cipher configs |
| U5 | Test suite verification | Fix any behavioral regressions |

---

## Post-hop audit checklist

Run after upgrading to a new Node.js LTS version:

```
[ ] npm rebuild → recompile all native (node-gyp) addons against the new ABI
[ ] npx check-peer-dependencies → detect peer dep conflicts from stale exact version pins
[ ] Inventory packages with node-gyp scripts:
      grep -r '"install".*node-gyp' node_modules/*/package.json | awk -F/ '{print $2}' | sort -u
      → For each: verify pre-built binary exists for the new Node.js ABI on the package's releases page
      → N-API packages do NOT need rebuilding — check README for N-API support
[ ] Review polyfill packages that duplicate Node.js built-ins:
      [ ] node-fetch / cross-fetch → evaluate switching to global fetch (stable Node 21+)
      [ ] ws used as a global shim → evaluate built-in WebSocket (stable Node 22+, client only)
      [ ] AbortController polyfills → remove (built-in since Node 15)
[ ] npx tsc --noEmit (if TypeScript) → fix type errors before running full build
[ ] node --pending-deprecation app.js → print deprecation warnings at startup
[ ] npm outdated → identify packages with newer versions to assess compatibility
[ ] Update .nvmrc / .node-version / package.json engines field / CI pipeline Node image
```
