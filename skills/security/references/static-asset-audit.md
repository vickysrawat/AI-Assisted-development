# Security Skill — Static Asset Directory Audit
_Runs as a pre-scan check before Pass 1. Scope-independent — always enumerates fully._

---

## Purpose

Static asset directories (`public/`, `wwwroot/`, `assets/`, `static/`) are
served by the web server without authentication. Every file inside them is
reachable by URL — no login, no token, no session required. A single data file
committed here bypasses every security control in the stack.

This check runs BEFORE any Pass 1 analysis. It takes under 10 seconds and
catches the class of finding most likely to cause an immediate data breach.

---

## Scope-independence

This audit's directory enumeration is ALWAYS a full `find` regardless of scope
flag. For `--pr` and `--changed` scans, the SAST passes are limited to changed
files, but this check enumerates static directories completely — a data file
committed to `public/` three sprints ago is a live exposure now regardless of
what changed in the current diff.

---

## Step 1 — Discover static-serving directories

Prefer the graph catalog for speed; fall back to filesystem scan.

### Attempt catalog lookup

```bash
cat .claude/graph/graph.json 2>/dev/null || echo "NO_GRAPH"
test -f .claude/graph/.stale && echo "STALE"
```

Trust `directoryCatalog.staticServing` ONLY when ALL three conditions hold:
1. `graph.json` read successfully (not `NO_GRAPH`)
2. `.stale` flag absent (not `STALE`)
3. Every path in `directoryCatalog.staticServing` exists on disk:
   ```bash
   for dir in {catalog_paths}; do test -d "$dir" || echo "MISSING: $dir"; done
   ```
   If any path is MISSING, fall back to filesystem scan.

### Filesystem fallback

Run name-based discovery AND config-based scanning:

```bash
# Name-based
STATIC_DIRS_NAMED=$(find . \
  -not -path "./.git/*" -not -path "./node_modules/*" \
  -not -path "./dist/*" -not -path "./bin/*" -not -path "./obj/*" \
  -type d \( -name "public" -o -name "wwwroot" -o -name "assets" \
    -o -name "static" -o -name "StaticFiles" -o -name "Content" \) \
  | sed 's|^\./||' | sort)

# .NET: UseStaticFiles with PhysicalFileProvider
DOTNET_STATIC=$(grep -rn --include="*.cs" "UseStaticFiles" . 2>/dev/null \
  | grep -v "node_modules\|\.git\|bin\|obj" \
  | grep -oP '(?<=PhysicalFileProvider\()[^)]+' \
  | grep -oP '"[^"]*"' | tr -d '"' | sort -u)

# Express: express.static('path')
NODE_STATIC=$(grep -rn --include="*.js" --include="*.ts" --include="*.mjs" \
  'express\.static(' . 2>/dev/null \
  | grep -v "node_modules\|\.git\|dist" \
  | grep -oP "express\.static\(\s*['\"]([^'\"]+)['\"]" \
  | grep -oP "['\"][^'\"]+['\"]" | tr -d "'\"" | sort -u)

# Nginx: root directive (relative paths only)
NGINX_STATIC=$(find . \( -name "*.conf" -o -name "*.nginx" \) 2>/dev/null \
  | grep -v "\.git\|node_modules" \
  | xargs grep -h "^\s*root " 2>/dev/null \
  | grep -oP "root\s+\K[^;]+" | grep -v '^/' | sort -u)

STATIC_DIRS=$(printf '%s\n' $STATIC_DIRS_NAMED $DOTNET_STATIC $NODE_STATIC \
  $NGINX_STATIC | grep -v '^$' | sort -u)
```

---

## Step 2 — Developer validation

Skip if `directoryCatalog.reviewed === true` in graph.json.

Otherwise present the discovered list:

```
Static-serving directories found ({N}):
   {list each path}

   The above were found by directory name and common config patterns
   (.NET UseStaticFiles, Express express.static, Nginx root).
   Runtime-computed or env-var-driven paths cannot be detected automatically.

   Are there any additional static-serving directories?
   Reply with paths (one per line), or "none" to continue.
```

After the developer replies, persist confirmation to graph.json if available:
```bash
node -e "
const fs = require('fs');
const p = '.claude/graph/graph.json';
if (!fs.existsSync(p)) process.exit(0);
const g = JSON.parse(fs.readFileSync(p, 'utf8'));
if (!g.directoryCatalog) process.exit(0);
const devPaths = [/* developer-added paths */];
if (devPaths.length > 0) {
  g.directoryCatalog.staticServing =
    [...new Set([...g.directoryCatalog.staticServing, ...devPaths])];
}
g.directoryCatalog.reviewed = true;
fs.writeFileSync(p, JSON.stringify(g, null, 2) + '\n');
" 2>/dev/null
```

---

## Step 3 — Enumerate files in each directory

```bash
find {directory} -type f | sort
```

---

## Step 4 — Classify every file

| File type | Expected? | Action |
|---|---|---|
| `*.html`, `*.css`, `*.js`, `*.woff*`, `*.ttf`, `*.svg`, `*.png`, `*.jpg`, `*.ico` | Normal assets | Skip |
| `*.json` with only UI config (theme, i18n, column defs, feature flags) | Review content | Read file |
| `*.json` containing real entity data (names, IDs, case details) | CRITICAL | Immediate finding |
| `*.json` containing credentials, API keys, connection strings | CRITICAL | Immediate finding |
| `*.csv`, `*.xlsx`, `*.xml`, `*.sql` | CRITICAL (unless empty template) | Immediate finding |
| `*.env`, `*.config`, `*.pem`, `*.key`, `*.pfx` | CRITICAL | Immediate finding |
| `*.bak`, `*.old`, `*.orig`, `*.backup` | CRITICAL | Immediate finding |
| Any non-standard static asset | Flag | Medium unless content is sensitive |

---

## Step 5 — Read JSON files to determine content type

For every `.json` file in a static-serving directory, read and classify:

**Signals of real entity data (CRITICAL regardless of quantity):**
- Personal names (firstName, lastName, fullName)
- Government-issued IDs (A-Numbers, passport numbers, SSNs, visa numbers)
- Case/matter identifiers tied to real individuals
- Attorney-client communications or matter descriptions
- Medical, financial, immigration, or legal records
- Email addresses, phone numbers, physical addresses
- Any field whose value looks like a real person's data

**Signals of safe UI config (do not flag):**
- Column definitions, filter configs, theme tokens
- i18n string maps (key to translated string)
- No fields with values that are names, IDs, or case data

---

## Step 6 — Raise CRITICAL finding immediately

Do not wait until the end of the scan. Report immediately:

```
CRITICAL — {plain English title}

Severity  : CRITICAL
CVSS v3.1 : {score} ({vector})
Business sev.: Critical (override: privileged/PII data + B1-B7 triggers)
File      : {path}  — publicly accessible at http://[server]/{filename}
OWASP     : A02 Cryptographic Failures / A01 Broken Access Control
CWE       : CWE-312 Cleartext Storage of Sensitive Information

What is happening:
  {file} is inside a static asset directory served without authentication.
  This file contains: {describe actual data found}.

Impact:
  Anyone who can reach the web server can download the file at
  http://[server]/{filename}. No authentication required.

Remediation — IMMEDIATE:
  1. Delete: git rm {file} && git commit -m "Remove exposed data file"
  2. Purge git history: git filter-repo --path {file} --invert-paths
  3. Check access logs for requests to /{filename}
  4. Never put real data in static-serving directories
  5. Add CI check to block data files in static directories
```

---

## Hard rules

- **NEVER skip this check** regardless of scope flag.
- **NEVER downgrade from CRITICAL** because the app is "internal" or "behind a VPN".
- **ALWAYS raise before Pass 1** — do not bury in a list of Medium findings.
- **ALWAYS include the git history purge step.**
- For this project: any data involving client names, matter numbers, A-Numbers,
  or attorney-client content is attorney-client privileged. Severity does not
  decrease because the data set is small.
