---
name: gitignore-sync
description: >
  Write/refresh the repo's ignore file with the plugin-required entries (managed block)
  and optionally detected build artifacts. Detects the VCS first — .gitignore on Git,
  .tfignore on TFVC. Invoked by the /gitignore-sync command (and re-usable by setup).
---

# Gitignore-Sync Skill — Ensure the repo's ignore file is correct

_Skill version: 1.0 · Last changed: 2026-08-30 · Plugin compatibility: ≥1.14.0 · Consent: C_

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

> **Related specs:** Consent Category C — ignore-file + VCS management only, never reads application source (`skills/shared/source-file-consent.md`). Severity vocabulary per `skills/shared/business-context-severity.md`.

A single-purpose command that guarantees the repo's **ignore file exists and
contains the plugin-required entries** — `.gitignore` on Git, `.tfignore` on TFVC
(TFS). This is the same logic `setup-init` runs, extracted so it can be invoked
directly and cannot be skipped inside a longer setup flow.

It is safe to run any time: it **creates the ignore file if missing**, writes plugin
entries inside a **managed block**, and **never removes or reorders your own lines**.

## Two-pass model

The ignore file is built in two distinct passes with different ownership:

| Pass | Content | Source | Managed by |
|---|---|---|---|
| 1 — Plugin block | Plugin-generated dirs only (temp/, CodeReviews/, security/, etc.) | `$PLUGIN_DIR/_project-deploy/.gitignore` managed block | `gitignore-sync` — safe to re-run any time; overwrites only the managed block |
| 2 — Stack entries | Build artifacts, IDE files, dependencies per detected stack | Official tooling (see below) — bundled templates are offline fallback only | `setup-init` / `setup-sync` — written **once**, never overwritten; developer owns after that |

**`/gitignore-sync` only runs Pass 1.** Stack entries (Pass 2) are added by `setup-init`
at project initialisation time and are not touched again — they belong to the developer.
Re-running `/gitignore-sync` never disturbs the stack section.

**Pass 2 source priority** (same tooling Visual Studio and VS Code use):

| Stack | Primary source | Fallback |
|---|---|---|
| dotnet / dotnet_framework | `dotnet new gitignore` (CLI — always current with SDK) | `stacks/dotnet.gitignore` |
| angular | GitHub `Node.gitignore` + Angular additions (`.angular/cache/`, `dist/`) | `stacks/angular.gitignore` |
| nodejs | GitHub `Node.gitignore` | `stacks/nodejs.gitignore` |
| java | GitHub `Java.gitignore` | `stacks/java.gitignore` |
| python | GitHub `Python.gitignore` | `stacks/python.gitignore` |

GitHub template base URL: `https://raw.githubusercontent.com/github/gitignore/main/{Name}.gitignore`

Bundled fallback templates live at `$PLUGIN_DIR/skills/gitignore-sync/stacks/` and are
used only when the dotnet CLI is absent or network is unavailable. The confirmation output
notes which source was used.

> **Why this detects the VCS first.** `.gitignore` is completely inert on TFVC —
> TFS ignores it, so writing one gives zero protection and generated files
> (`memory/health.html`, `security/`, the credential file) can still be checked in.
> The fix is to write the file the repo's VCS actually honours. See
> `$PLUGIN_DIR/skills/shared/vcs-detect-spec.md`.

---

## Step 0 — Detect the version-control system (always)

**Execute this now — do not describe it.** It resolves which ignore file is
authoritative for this repo.

Write the script below to `.claude/_gi-vcs.cjs`, run `node .claude/_gi-vcs.cjs`,
capture the `VCS=` and `IGNORE_FILE=` lines, then delete `.claude/_gi-vcs.cjs`.

```javascript
// Written to .claude/_gi-vcs.cjs and executed as: node .claude/_gi-vcs.cjs
const { execSync } = require('child_process');
const fs = require('fs');
function gitTree(){ try { execSync('git rev-parse --is-inside-work-tree', {stdio:'ignore'}); return true; } catch { return false; } }
function tfvc(){
  try { execSync('tf vc status .', {stdio:'ignore'}); return true; } catch {}
  if (fs.existsSync('$tf') || fs.existsSync('.tf') || fs.existsSync('.tfignore')) return true;
  return false;
}
let vcs = gitTree() ? 'git' : (tfvc() ? 'tfvc' : 'none');
console.log('VCS=' + vcs);
console.log('IGNORE_FILE=' + (vcs === 'tfvc' ? '.tfignore' : '.gitignore'));
```

Carry the `VCS` and `IGNORE_FILE` values into Step 1. `none` falls back to
`.gitignore` and you should note that detection failed so the developer can confirm
the repo's VCS.

---

## Step 1 — Write the plugin entries (always)

Write the script below to `.claude/_gi-write.cjs`, then run
`node .claude/_gi-write.cjs git "$PLUGIN_DIR"` (substitute the actual VCS value from
Step 0 — `git` or `tfvc` — and `$PLUGIN_DIR` from `.claude/plugin-path.txt`).
The script reads the managed-block entries from `$PLUGIN_DIR/_project-deploy/.gitignore`
(single source of truth) with a hardcoded fallback if the template is unavailable.
Capture the output, then delete `.claude/_gi-write.cjs`.

```javascript
// Written to .claude/_gi-write.cjs and executed as: node .claude/_gi-write.cjs <vcs>
const fs = require('fs');
const path = require('path');
const VCS = process.argv[2] || 'git';
const PLUGIN_DIR = process.argv[3] || '';
const F = VCS === 'tfvc' ? '.tfignore' : '.gitignore';
// Single source of truth: $PLUGIN_DIR/_project-deploy/.gitignore
// Extract the managed block entries from that template rather than duplicating them here.
// settings.json is NOT ignored (committed/shared, secret-free). Each `dir/*` entry MUST
// precede its `!dir/<ledger>` re-include — git cannot re-include a file under an ignored dir.
function loadBaseFromTemplate(pluginDir) {
  const tmpl = path.join(pluginDir, '_project-deploy', '.gitignore');
  if (!pluginDir || !fs.existsSync(tmpl)) {
    // Fallback hardcoded list — kept in sync with _project-deploy/.gitignore
    return ['.claude/settings.local.json','.claude/security-checkpoint.json','.claude/code-review-checkpoint.json','.claude/file-cache.json','.claude/dream-init-state.json','memory/health.html','CodeReviews/*','!CodeReviews/code-review-ledger.md','security/*','!security/security-ledger.md','dynamic-scan/*','!dynamic-scan/dynamic-scan-ledger.md','token-analysis/','prod-readiness/','temp/','.claude/plugin-path.txt','.claude/session-context.json'];
  }
  const lines = fs.readFileSync(tmpl, 'utf8').split(/\r?\n/);
  const BEGIN = '# === ai-assisted-development (managed) ===';
  const END   = '# === end ai-assisted-development ===';
  let inside = false;
  const entries = [];
  for (const l of lines) {
    if (l.trim() === BEGIN) { inside = true; continue; }
    if (l.trim() === END)   { inside = false; break; }
    if (inside && l.trim() && !l.startsWith('#')) entries.push(l.trim());
  }
  return entries.length ? entries :
    ['.claude/settings.local.json','.claude/security-checkpoint.json','.claude/code-review-checkpoint.json','.claude/file-cache.json','.claude/dream-init-state.json','memory/health.html','CodeReviews/*','!CodeReviews/code-review-ledger.md','security/*','!security/security-ledger.md','dynamic-scan/*','!dynamic-scan/dynamic-scan-ledger.md','token-analysis/','prod-readiness/','temp/','.claude/plugin-path.txt','.claude/session-context.json'];
}
const BASE = loadBaseFromTemplate(PLUGIN_DIR);
// TFVC syntax: backslash separators, no trailing slash on directories.
const ENTRIES = VCS === 'tfvc' ? BASE.map(e => e.replace(/\//g,'\\').replace(/\\$/,'')) : BASE;
const BEGIN = '# === ai-assisted-development (managed) ===';
const END   = '# === end ai-assisted-development ===';
let txt = fs.existsSync(F) ? fs.readFileSync(F,'utf8') : '';
const created = !fs.existsSync(F);
const reBlock = new RegExp('\\n?' + BEGIN.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\n?', 'g');
txt = txt.replace(reBlock, '\n');
const outside = new Set(txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean));
const blockEntries = ENTRIES.filter(e => !outside.has(e));
let wrote = [];
if (blockEntries.length) {
  if (txt.length && !txt.endsWith('\n')) txt += '\n';
  if (txt.trim().length) txt += '\n';
  txt += BEGIN + '\n' + blockEntries.join('\n') + '\n' + END + '\n';
  wrote = blockEntries;
}
fs.writeFileSync(F, txt);
console.log((created ? 'CREATED ' : 'UPDATED ') + F + ' (VCS=' + VCS + ')');
console.log('WROTE=' + JSON.stringify(wrote));
console.log('ALREADY_PRESENT=' + JSON.stringify(ENTRIES.filter(e=>!wrote.includes(e))));
```

### Step 1b — TFVC only: check for an already-tracked credential file

`.tfignore` only blocks **new** adds. If the credential file is already under TFVC
control, the ignore entry does nothing — it stays tracked and the PAT stays exposed.
The credential file is `.claude/settings.local.json` (secrets/permissions live there;
`.claude/settings.json` is intentionally committed and secret-free). When `VCS=tfvc`, run:

Write the script below to `.claude/_gi-tfvc.cjs`, run `node .claude/_gi-tfvc.cjs`,
capture the output, then delete `.claude/_gi-tfvc.cjs`.

```javascript
// Written to .claude/_gi-tfvc.cjs and executed as: node .claude/_gi-tfvc.cjs
const { execSync } = require('child_process');
const fs = require('fs');
if (!fs.existsSync('.claude/settings.local.json')) { console.log('NO_CREDENTIAL_FILE'); process.exit(0); }
let out = '';
try { out = execSync('tf vc status .claude/settings.local.json', {encoding:'utf8'}); } catch {}
if (out.trim()) console.log('SETTINGS_TRACKED — run: tf vc delete --keep-local .claude/settings.local.json  then check in the deletion');
else console.log('SETTINGS_NOT_TRACKED — ignore entry is sufficient');
```

If `SETTINGS_TRACKED`, tell the developer plainly: the entry alone will not protect
it — they must `tf vc delete --keep-local .claude/settings.local.json` and check in the
deletion, and ideally move the PAT to a Windows User Environment Variable (Option A).

---

## Step 2 — Optional: detected build artifacts (`--with-artifacts` only)

**No-flag prompt** (per `$PLUGIN_DIR/skills/shared/flag-prompt-spec.md`): the plugin entries in
Step 1 always run. If neither `--with-artifacts` nor its absence was explicitly chosen — i.e. the
skill was invoked with no flag **in an interactive session** — ask via `AskUserQuestion` whether to
also scan for build/env artifacts: **plugin entries only** (recommended) or **also detect
artifacts**. In CI / headless / gate-invoked runs (e.g. `setup-*`), skip the prompt and do
**plugin entries only** (skip to Step 3).

If the user passed `--with-artifacts` (or chose it at the prompt), also detect and offer common
build/env artifacts. Otherwise skip to Step 3.

```bash
find . -not -path "./.git/*" -not -path "./node_modules/*" -type d \
  \( -name bin -o -name obj -o -name dist -o -name out -o -name build \
     -o -name coverage -o -name .angular -o -name .next -o -name __pycache__ -o -name target \) 2>/dev/null
find . -not -path "./.git/*" -not -path "./node_modules/*" -type f \
  \( -name "*.log" -o -name ".env" -o -name "*.env" \) 2>/dev/null
```

Consolidate to minimal patterns (e.g. many `bin/` → one `/bin/`), drop any already
present (whole-line match), and present the candidates for selection. **Never add
`.env*` without the developer explicitly selecting it.** Append selected items with
the same whole-line-dedup approach as Step 1 (outside the managed block, since they
are project-specific, not plugin-managed).

---

## Step 3 — Verify (mandatory)

Confirm the result from disk — never report success from intent. Pass the same
`VCS` value from Step 0 so it verifies the right file in the right syntax.

Write the script below to `.claude/_gi-verify.cjs`, run
`node .claude/_gi-verify.cjs git` (substitute the actual VCS value from Step 0),
capture the output, then delete `.claude/_gi-verify.cjs`.

```javascript
// Written to .claude/_gi-verify.cjs and executed as: node .claude/_gi-verify.cjs <vcs>
const fs = require('fs');
const VCS = process.argv[2] || 'git';
const F = VCS === 'tfvc' ? '.tfignore' : '.gitignore';
const BASE = ['.claude/settings.local.json','.claude/security-checkpoint.json','.claude/code-review-checkpoint.json','.claude/file-cache.json','.claude/dream-init-state.json','memory/health.html','CodeReviews/*','!CodeReviews/code-review-ledger.md','security/*','!security/security-ledger.md','dynamic-scan/*','!dynamic-scan/dynamic-scan-ledger.md','token-analysis/','prod-readiness/','temp/','.claude/plugin-path.txt','.claude/session-context.json'];
const ENTRIES = VCS === 'tfvc' ? BASE.map(e => e.replace(/\//g,'\\').replace(/\\$/,'')) : BASE;
if (!fs.existsSync(F)) { console.log('VERIFY_FAIL: ' + F + ' does not exist'); process.exit(1); }
const lines = new Set(fs.readFileSync(F,'utf8').split(/\r?\n/).map(l=>l.trim()));
const missing = ENTRIES.filter(e=>!lines.has(e));
if (missing.length) { console.log('VERIFY_FAIL missing='+JSON.stringify(missing)); process.exit(1); }
console.log('VERIFY_OK: all '+ENTRIES.length+' plugin entries present in ' + F);
```

On `VERIFY_OK`, confirm:
```
✅ {.gitignore | .tfignore} — [created | updated]   (VCS: {git | tfvc})
   Plugin entries: {N} added, {M} already present
   {if TFVC and SETTINGS_TRACKED: ⚠ .claude/settings.json is already tracked — tf vc delete --keep-local it and check in}
   {if --with-artifacts: Artifacts: {list added}}
```
On `VERIFY_FAIL`, do not claim success — re-run Step 1 and verify again.

---

## Hard Rules

- ALWAYS run Step 0 first and branch on the detected VCS — writing `.gitignore` on
  a TFVC repo is the silent-failure this command exists to prevent.
- ALWAYS write each script to a `.cjs` file and run it — NEVER use `node -e "..."`.
  Shell double-quote processing mangles backslash sequences in regexes, causing
  `SyntaxError: Invalid regular expression` and `Unterminated group` failures.
- ALWAYS execute the Step 1 script — never describe the write declaratively.
- NEVER remove or reorder existing ignore-file lines — the plugin set lives only
  inside the managed block; everything else is the developer's.
- On TFVC, ALWAYS run Step 1b — an ignore entry does not protect an already-tracked
  credential file; the developer must `tf vc delete --keep-local` it.
- Matching is whole-line exact, NEVER substring.
- NEVER add `.env*` without explicit developer selection (`--with-artifacts` flow).
- ALWAYS run Step 3; only report success on `VERIFY_OK`.
