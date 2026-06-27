---
description: "Write/refresh the repo's ignore file with the plugin-required entries (managed block) and optionally detected build artifacts. Detects the VCS first — .gitignore on Git, .tfignore on TFVC — so protection actually takes effect (a .gitignore is inert on TFVC). Creates the file if missing, never touches your own lines; on TFVC also flags an already-tracked credential file. Use when the ignore file is missing or out of date. Args: none, or --with-artifacts to also scan for build/env files."
argument-hint: "[--with-artifacts]  —  omit for plugin entries only; --with-artifacts also offers detected bin/obj/dist/.env etc."
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`). See `skills/shared/model-routing-spec.md`.

---

# /gitignore-sync — Ensure the repo's ignore file is correct

A single-purpose command that guarantees the repo's **ignore file exists and
contains the plugin-required entries** — `.gitignore` on Git, `.tfignore` on TFVC
(TFS). This is the same logic `dream-init` runs, extracted so it can be invoked
directly and cannot be skipped inside a longer setup flow.

It is safe to run any time: it **creates the ignore file if missing**, writes plugin
entries inside a **managed block**, and **never removes or reorders your own lines**.

> **Why this detects the VCS first.** `.gitignore` is completely inert on TFVC —
> TFS ignores it, so writing one gives zero protection and generated files
> (`memory/health.html`, `security/`, the credential file) can still be checked in.
> The fix is to write the file the repo's VCS actually honours. See
> `skills/shared/vcs-detect-spec.md`.

---

## Step 0 — Detect the version-control system (always)

**Execute this now — do not describe it.** It resolves which ignore file is
authoritative for this repo.

```
!node -e "
const { execSync } = require('child_process');
const fs = require('fs');
function gitTree(){ try { execSync('git rev-parse --is-inside-work-tree', {stdio:'ignore'}); return true; } catch { return false; } }
function tfvc(){
  try { execSync('tf vc status .', {stdio:'ignore'}); return true; } catch {}
  if (fs.existsSync('\$tf') || fs.existsSync('.tf') || fs.existsSync('.tfignore')) return true;
  return false;
}
let vcs = gitTree() ? 'git' : (tfvc() ? 'tfvc' : 'none');
console.log('VCS=' + vcs);
console.log('IGNORE_FILE=' + (vcs === 'tfvc' ? '.tfignore' : '.gitignore'));
"
```

Carry the `VCS` and `IGNORE_FILE` values into Step 1. `none` falls back to
`.gitignore` and you should note that detection failed so the developer can confirm
the repo's VCS.

---

## Step 1 — Write the plugin entries (always)

**Execute this command now — do not describe it.** It creates the ignore file if
missing and idempotently (re)writes the managed block, in the syntax the detected
VCS requires (Git: forward slashes, trailing slash on dirs; TFVC: backslashes, no
trailing slash). Matching is whole-line exact (trimmed), never substring, so an
existing `.claude/` line never masks `.claude/settings.json`.

Pass the detected VCS as an argument — substitute the `VCS=` value from Step 0:

```
!node -e "
const fs = require('fs');
const VCS = process.argv[1] || 'git';                 // <- pass Step 0 VCS here
const F = VCS === 'tfvc' ? '.tfignore' : '.gitignore';
const BASE = ['.claude/settings.json','.claude/settings.local.json','.claude/security-checkpoint.json','.claude/code-review-checkpoint.json','.claude/file-cache.json','.claude/dream-init-state.json','.claude/architecture/','memory/health.html','CodeReviews/','security/','dynamic-scan/','token-analysis/','prod-readiness/','temp/']; 
// TFVC syntax: backslash separators, no trailing slash on directories.
const ENTRIES = VCS === 'tfvc' ? BASE.map(e => e.replace(/\//g,'\\\\').replace(/\\\\\$/,'')) : BASE;
const BEGIN = '# === ai-assisted-development (managed) ===';
const END   = '# === end ai-assisted-development ===';
let txt = fs.existsSync(F) ? fs.readFileSync(F,'utf8') : '';
const created = !fs.existsSync(F);
const reBlock = new RegExp('\\n?' + BEGIN.replace(/[.*+?^&{}()|[\\]\\\\]/g,'\\\\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^&{}()|[\\]\\\\]/g,'\\\\\$&') + '\\n?', 'g');
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
" "{VCS from Step 0}"
```

### Step 1b — TFVC only: check for an already-tracked credential file

`.tfignore` only blocks **new** adds. If the credential file is already under TFVC
control, the ignore entry does nothing — it stays tracked and the PAT stays exposed.
When `VCS=tfvc`, run:

```
!node -e "
const { execSync } = require('child_process');
const fs = require('fs');
if (!fs.existsSync('.claude/settings.json')) { console.log('NO_CREDENTIAL_FILE'); process.exit(0); }
let out = '';
try { out = execSync('tf vc status .claude/settings.json', {encoding:'utf8'}); } catch {}
if (out.trim()) console.log('SETTINGS_TRACKED — run: tf vc delete --keep-local .claude/settings.json  then check in the deletion');
else console.log('SETTINGS_NOT_TRACKED — ignore entry is sufficient');
"
```

If `SETTINGS_TRACKED`, tell the developer plainly: the entry alone will not protect
it — they must `tf vc delete --keep-local .claude/settings.json` and check in the
deletion, and ideally move the PAT to a Windows User Environment Variable (Option A).

---

## Step 2 — Optional: detected build artifacts (`--with-artifacts` only)

If the user passed `--with-artifacts`, also detect and offer common build/env
artifacts. Otherwise skip to Step 3.

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

```
!node -e "
const fs=require('fs');
const VCS = process.argv[1] || 'git';
const F = VCS === 'tfvc' ? '.tfignore' : '.gitignore';
const BASE=['.claude/settings.json','.claude/settings.local.json','.claude/security-checkpoint.json','.claude/code-review-checkpoint.json','.claude/file-cache.json','.claude/dream-init-state.json','.claude/architecture/','memory/health.html','CodeReviews/','security/','dynamic-scan/','token-analysis/','prod-readiness/','temp/']; 
const ENTRIES = VCS === 'tfvc' ? BASE.map(e => e.replace(/\//g,'\\\\').replace(/\\\\\$/,'')) : BASE;
if(!fs.existsSync(F)){ console.log('VERIFY_FAIL: ' + F + ' does not exist'); process.exit(1); }
const lines=new Set(fs.readFileSync(F,'utf8').split(/\r?\n/).map(l=>l.trim()));
const missing=ENTRIES.filter(e=>!lines.has(e));
if(missing.length){ console.log('VERIFY_FAIL missing='+JSON.stringify(missing)); process.exit(1); }
console.log('VERIFY_OK: all '+ENTRIES.length+' plugin entries present in ' + F);
" "{VCS from Step 0}"
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
- ALWAYS execute the Step 1 command — never describe the write declaratively.
- NEVER remove or reorder existing ignore-file lines — the plugin set lives only
  inside the managed block; everything else is the developer's.
- On TFVC, ALWAYS run Step 1b — an ignore entry does not protect an already-tracked
  credential file; the developer must `tf vc delete --keep-local` it.
- Matching is whole-line exact, NEVER substring.
- NEVER add `.env*` without explicit developer selection (`--with-artifacts` flow).
- ALWAYS run Step 3; only report success on `VERIFY_OK`.
