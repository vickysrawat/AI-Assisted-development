---
description: Per-project setup — creates memory/, detects the project stack and deploys only matching .claude/rules/ files (project-rules.md always; dotnet/angular/nodejs/java/python rules only when their stack is detected), and ensures CLAUDE.md has the Dream infrastructure sections. Runs /init to generate CLAUDE.md if it does not exist. Safe to re-run — never overwrites existing content.
argument-hint: (no arguments needed)
---
# /dream-init — Initialise Dream memory structure for this project

Run this once in a new project to set up the Dream memory system.
Safe to re-run — all steps are idempotent and will skip anything already present.

---

## What this command does

```
your-project/
├── memory/
│   ├── MEMORY.md       ← manual override inbox + auto-capture bookmarks
│   └── dream-log.md    ← append-only audit trail (starts empty)
├── .claude/
│   ├── commands/       ← global command stubs (makes plugin commands visible in VS Code)
│   │   ├── dream.md
│   │   ├── dream-health.md
│   │   ├── security-review.md
│   │   ├── code-review.md
│   │   └── token-analysis.md
│   ├── rules/          ← scoped rules deployed here (not committed to repo rules/)
│   │   ├── project-rules.md        ← universal guardrails (always deployed)
│   │   ├── dotnet-rules.md         ← deployed only if .csproj / .sln detected
│   │   ├── angular-rules.md        ← deployed only if angular.json detected
│   │   ├── nodejs-rules.md         ← deployed only if package.json (non-Angular) detected
│   │   ├── java-rules.md           ← deployed only if pom.xml / build.gradle detected
│   │   └── python-rules.md         ← deployed only if .py / requirements.txt detected
│   └── architecture/   ← populated architecture docs (repo-type specific)
│       ├── architecture.md
│       ├── architecture-[flows|callchains|api].md
│       └── architecture-reference.md
├── token-analysis/
│   └── token-graph.json    ← empty graph seeded by dream-init, populated on first run
├── .claude/
│   └── file-cache.json     ← empty cache seeded by dream-init, populated by code-review & security skills
└── CLAUDE.md           ← created if missing, or Dream sections appended if present
```

---

## Steps

### Step 1 — Check what already exists

```
!ls -la memory/ 2>/dev/null && echo "memory/ exists" || echo "memory/ not found"
[ -f "./CLAUDE.md" ] && echo "CLAUDE.md exists" || echo "CLAUDE.md not found"
!ls .claude/rules/ 2>/dev/null && echo ".claude/rules/ exists" || echo ".claude/rules/ not found"
```

Report what was found and what will be created.

---

### Step 2a — Detect Git and Bash paths (Windows)

Path detection and placeholder substitution happens in **Step 5 Phase 3**,
after the `## 0b. Shell & Git Configuration` section has been appended to
`./CLAUDE.md`. Do not resolve paths here — the `## 0b` section does not
exist in the project CLAUDE.md yet at this point in the sequence.

Proceed directly to Step 2.

---

### Step 2 — Create memory/ folder and starter files

Only create files that do not already exist. Never overwrite.

```
!mkdir -p memory
```

Write `memory/MEMORY.md` if missing:

```markdown
# MEMORY.md — manual override inbox

> Sessions are the primary memory source.
> /dream reads your Claude Code conversations directly via conversation_search.
> You do not need to write here manually.
>
> This file is for EXCEPTIONS ONLY:
> - Things Claude should remember that didn't arise naturally in a session
> - Explicit corrections you want to force into memory immediately
> - Context that exists outside Claude Code (e.g. from a document or meeting)
>
> Auto-capture writes here automatically at trigger points (see CLAUDE.md).
> /dream will process and clear entries after each run.

---

## Format for manual entries

### [manual] YYYY-MM-DD — <topic>
<what Claude should know>
Source: <where this came from>
Priority: normal | high | urgent

---

## Auto-capture entries

<!-- Auto-capture entries appear below this line -->
```

Write `memory/dream-log.md` if missing:

```markdown
# dream-log.md — audit trail

> This file is append-only. Never edit previous entries.
> Each entry records a complete dream run.

---

<!-- Dream run entries will be appended below -->
```

---

### Step 3 — Deploy global command stubs to .claude/commands/

Claude Code (VS Code) only shows slash commands found in the project's
`.claude/commands/` folder. Global plugin commands are invisible there unless
a stub is deployed. These stubs are thin — they contain only the frontmatter
and a skill reference. All logic stays in the plugin.

```
!mkdir -p .claude/commands
```

For each stub file below, check if `.claude/commands/{filename}` already exists.
If it does, skip it. If it does not, copy it from
`skills/command-stubs/{filename}`:

| Stub file | Command it exposes |
|---|---|
| `dream.md` | `/ai-assisted-development:dream` |
| `dream-audit.md` | `/ai-assisted-development:dream-audit` |
| `dream-health.md` | `/ai-assisted-development:dream-health` |
| `dream-init.md` | `/ai-assisted-development:dream-init` |
| `dream-rollback.md` | `/ai-assisted-development:dream-rollback` |
| `dream-status.md` | `/ai-assisted-development:dream-status` |
| `dream-sync.md` | `/ai-assisted-development:dream-sync` |
| `security-review.md` | `/ai-assisted-development:security-review` |
| `code-review.md` | `/ai-assisted-development:code-review` |
| `token-analysis.md` | `/ai-assisted-development:token-analysis` |
| `product-docs.md` | `/ai-assisted-development:product-docs` |
| `sprint-metrics.md` | `/ai-assisted-development:sprint-metrics` |
| `session-start.md` | `/ai-assisted-development:session-start` |
| `bug.md` | `/ai-assisted-development:bug` |
| `checkin.md` | `/ai-assisted-development:checkin` |
| `update-arch.md` | `/ai-assisted-development:update-arch` |
| `explain.md` | `/ai-assisted-development:explain` |
| `fix.md` | `/ai-assisted-development:fix` |
| `app-readiness.md` | `/ai-assisted-development:app-readiness` |
| `plugin-readiness.md` | `/ai-assisted-development:plugin-readiness` |
| `dynamic-scan.md` | `/ai-assisted-development:dynamic-scan` |
| `ado-tasks.md` | `/ai-assisted-development:ado-tasks` |
| `icea-feature.md` | `/ai-assisted-development:icea-feature` |
| `icea-approve.md` | `/ai-assisted-development:icea-approve` |
| `icea-implement.md` | `/ai-assisted-development:icea-implement` |
| `icea-revise.md` | `/ai-assisted-development:icea-revise` |
| `icea-status.md` | `/ai-assisted-development:icea-status` |
| `icea-review.md` | `/ai-assisted-development:icea-review` |
| `pr-create.md` | `/ai-assisted-development:pr-create` |
| `pr-describe.md` | `/ai-assisted-development:pr-describe` |
| `pr-spec-review.md` | `/ai-assisted-development:pr-spec-review` |
| `critic.md` | `/ai-assisted-development:critic` |
| `gitignore-sync.md` | `/ai-assisted-development:gitignore-sync` |
| `dismiss.md` | `/ai-assisted-development:dismiss` |
| `sync-dirs.md` | `/ai-assisted-development:sync-dirs` |

```bash
for stub in dream.md dream-audit.md dream-health.md dream-init.md dream-rollback.md dream-status.md dream-sync.md security-review.md code-review.md token-analysis.md product-docs.md sprint-metrics.md session-start.md bug.md checkin.md update-arch.md explain.md fix.md app-readiness.md plugin-readiness.md dynamic-scan.md ado-tasks.md icea-feature.md icea-approve.md icea-implement.md icea-revise.md icea-status.md icea-review.md pr-create.md pr-describe.md pr-spec-review.md critic.md gitignore-sync.md dismiss.md sync-dirs.md; do
  if [ ! -f ".claude/commands/$stub" ]; then
    cp "$(dirname $0)/../skills/command-stubs/$stub" ".claude/commands/$stub"
    echo "  ✓ deployed $stub"
  else
    echo "  — $stub already present, skipping"
  fi
done
```

---

### Step 4 — Detect stack, then deploy only matching .claude/rules/

```bash
mkdir -p .claude/rules
```

#### Step 4a — Detect the project stack

Run these probes to determine which technology layers are present.
Collect every signal that fires — a project can have more than one (e.g. a
.NET API back-end **and** an Angular front-end).

```bash
# --- .NET / C# (Core / 5+) ---
find . -name "*.csproj" -maxdepth 4 2>/dev/null | head -1 | grep -q "." && echo "HAS_DOTNET"
find . -name "*.sln" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && echo "HAS_DOTNET"

# --- .NET Framework (4.x / ASP.NET MVC 5 / Web API 2) ---
# Fires when a .csproj targets net4x or references System.Web (classic ASP.NET)
node -e "
  const { execSync } = require('child_process');
  const { readdirSync, readFileSync } = require('fs');
  const path = require('path');
  function findCsproj(dir, depth) {
    if (depth < 0) return [];
    let results = [];
    try {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isFile() && e.name.endsWith('.csproj')) results.push(full);
        else if (e.isDirectory() && !e.name.startsWith('.') && depth > 0)
          results = results.concat(findCsproj(full, depth - 1));
      }
    } catch(e) {}
    return results;
  }
  const projs = findCsproj(process.cwd(), 4);
  for (const p of projs) {
    const c = readFileSync(p, 'utf8');
    if (/net4[0-9]|<TargetFrameworkVersion>/i.test(c) || c.includes('System.Web')) {
      console.log('HAS_DOTNET_FRAMEWORK');
      break;
    }
  }
" 2>/dev/null

# --- Angular ---
ls angular.json 2>/dev/null && echo "HAS_ANGULAR"
find . -name "angular.json" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && echo "HAS_ANGULAR"

# --- Node.js / TypeScript (non-Angular) ---
# Fires only when package.json exists but Angular is NOT the framework
node -e "
  try {
    const p = require('./package.json');
    const d = Object.assign({}, p.dependencies, p.devDependencies);
    if (!d['@angular/core']) console.log('HAS_NODEJS');
  } catch(e) {}
" 2>/dev/null

# --- JavaScript (vanilla JS / ES2015+ — non-TypeScript, non-Angular, non-Node service) ---
# Fires when .js files exist but no tsconfig.json (TypeScript) is present
node -e "
  const fs = require('fs');
  const path = require('path');
  const hasTsConfig = fs.existsSync('tsconfig.json');
  if (!hasTsConfig) {
    // Look for .js source files (excluding config files and node_modules)
    function hasJs(dir, depth) {
      if (depth < 0) return false;
      try {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
          const full = path.join(dir, e.name);
          if (e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.config.js')) return true;
          if (e.isDirectory() && hasJs(full, depth - 1)) return true;
        }
      } catch(e) {}
      return false;
    }
    if (hasJs(process.cwd(), 3)) console.log('HAS_JAVASCRIPT');
  }
" 2>/dev/null

# --- Java / Spring Boot ---
{ find . -name "pom.xml" -maxdepth 3 2>/dev/null | xargs grep -l "spring-boot" 2>/dev/null; \
  find . -name "build.gradle*" -maxdepth 3 2>/dev/null | xargs grep -l "org.springframework.boot" 2>/dev/null; } \
  | head -1 | grep -q "." && echo "HAS_JAVA"

# --- Python ---
find . -name "*.py" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && echo "HAS_PYTHON"
find . -name "requirements.txt" -o -name "pyproject.toml" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && echo "HAS_PYTHON"
```

Collect the output into a `DETECTED_STACKS` set. Example results:

| Signals fired | DETECTED_STACKS |
|---|---|
| HAS_DOTNET + HAS_ANGULAR | `dotnet angular` |
| HAS_DOTNET_FRAMEWORK only | `dotnet-framework` |
| HAS_DOTNET only | `dotnet` |
| HAS_ANGULAR + HAS_NODEJS | `angular nodejs` |
| HAS_JAVASCRIPT | `javascript` |
| HAS_JAVA | `java` |
| HAS_PYTHON | `python` |
| nothing | → see fallback below |

> **Note — .NET Core vs .NET Framework:** Both `HAS_DOTNET` and `HAS_DOTNET_FRAMEWORK`
> can fire for the same solution if it contains a mix of Core and Framework projects.
> In that case deploy both `dotnet-rules.md` and `dotnet-framework-rules.md`.

**If nothing fires** (completely unrecognised project), ask:
```
⚠ Could not detect the project stack automatically.
  Which rules files should be deployed? (select all that apply)
  1. dotnet-rules.md            (.NET / C# / ASP.NET Core)
  2. dotnet-framework-rules.md  (ASP.NET Framework 4.x / MVC 5 / Web API 2)
  3. angular-rules.md           (Angular / TypeScript)
  4. nodejs-rules.md            (Node.js / TypeScript services)
  5. javascript-rules.md        (Vanilla JS / ES2015+)
  6. java-rules.md              (Java / Spring Boot)
  7. python-rules.md            (Python / Django / FastAPI / Flask)
  Enter numbers separated by spaces, or "all" for everything:
```
Wait for the developer's answer and use it to build DETECTED_STACKS.

Announce what was detected before deploying:
```
📦 Stack detected: {DETECTED_STACKS}
   Will deploy: project-rules.md + {matching stack rule files}
   Skipping   : {rule files not relevant to this stack}
```

Then immediately persist the detected stacks to `.claude/dream-init-state.json`
so `session-start` can check for missing rule files on future sessions:

```javascript
const fs = require('fs');
const statePath = '.claude/dream-init-state.json';
let state = {};
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {}

// Convert DETECTED_STACKS flags to the canonical key array
// e.g. HAS_DOTNET=1, HAS_ANGULAR=1 → ['dotnet', 'angular']
const stackMap = {
  HAS_DOTNET:           'dotnet',
  HAS_DOTNET_FRAMEWORK: 'dotnet_framework',
  HAS_ANGULAR:          'angular',
  HAS_NODEJS:           'nodejs',
  HAS_JAVASCRIPT:       'javascript',
  HAS_JAVA:             'java',
  HAS_PYTHON:           'python',
};
// detectedFlags is the set collected from Step 4a bash output
state.detected_stacks = Object.entries(stackMap)
  .filter(([flag]) => detectedFlags.has(flag))
  .map(([, key]) => key);

// Read installed version from the plugin install directory — NOT from project root
// .claude-plugin/plugin.json relative to project root does not exist
try {
  const pluginJsonPath = process.env.HOME +
    '/.claude/plugins/ke-marketplace/plugins/ai-assisted-development/.claude-plugin/plugin.json';
  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  state.dream_init_plugin_version = pluginJson.version;
} catch(e) {
  state.dream_init_plugin_version = 'unknown';
  console.warn('  ⚠ Could not read plugin version from install dir:', e.message);
}

state.dream_init_last_run = new Date().toISOString().slice(0, 10);

fs.mkdirSync('.claude', { recursive: true });
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
```

---

#### Step 4b — Deploy project-rules.md (always)

`project-rules.md` is the universal guardrail that applies to every file in every
project. Always deploy it regardless of stack.

```bash
if [ ! -f ".claude/rules/project-rules.md" ]; then
  cp "$(dirname $0)/../rules/project-rules.md" ".claude/rules/project-rules.md"
  echo "  ✓ deployed project-rules.md"
else
  echo "  — project-rules.md already present, skipping"
fi
```

---

#### Step 4c — Deploy stack-specific rules (only for detected stacks)

For each rule file below, deploy it if the corresponding stack was detected in
Step 4a AND the file does not already exist in `.claude/rules/`.

**This step always runs the full deploy loop — even on a re-run of `dream-init`.**
A file being absent from `.claude/rules/` while its stack is detected means the
plugin has been updated since `dream-init` last ran and a new rule file was added.
The `deploy_rule` function is safe: it only copies when the destination is absent,
so existing customised rules are never overwritten.

| Rule file | Deploy when |
|---|---|
| `dotnet-rules.md` | `HAS_DOTNET` |
| `dotnet-framework-rules.md` | `HAS_DOTNET_FRAMEWORK` |
| `angular-rules.md` | `HAS_ANGULAR` |
| `nodejs-rules.md` | `HAS_NODEJS` (and NOT Angular-only — Node.js rules apply to back-end services and standalone TS projects) |
| `javascript-rules.md` | `HAS_JAVASCRIPT` |
| `java-rules.md` | `HAS_JAVA` |
| `python-rules.md` | `HAS_PYTHON` |

```bash
PLUGIN_RULES="$(dirname $0)/../rules"

deploy_rule() {
  local file="$1"
  local label="$2"
  if [ ! -f ".claude/rules/$file" ]; then
    cp "$PLUGIN_RULES/$file" ".claude/rules/$file"
    echo "  ✓ deployed $file  ($label)"
  else
    echo "  — $file already present, skipping"
  fi
}

# Deploy only for detected stacks — each block runs only if the flag is set
[ "$HAS_DOTNET"            = "1" ] && deploy_rule "dotnet-rules.md"            ".NET / C# (Core)"
[ "$HAS_DOTNET_FRAMEWORK"  = "1" ] && deploy_rule "dotnet-framework-rules.md"  "ASP.NET Framework 4.x"
[ "$HAS_ANGULAR"           = "1" ] && deploy_rule "angular-rules.md"           "Angular / TypeScript"
[ "$HAS_NODEJS"            = "1" ] && deploy_rule "nodejs-rules.md"            "Node.js / TypeScript"
[ "$HAS_JAVASCRIPT"        = "1" ] && deploy_rule "javascript-rules.md"        "Vanilla JavaScript"
[ "$HAS_JAVA"              = "1" ] && deploy_rule "java-rules.md"              "Java / Spring Boot"
[ "$HAS_PYTHON"            = "1" ] && deploy_rule "python-rules.md"            "Python"
```

> **Note — Angular + Node.js projects:** Angular workspaces sometimes include a
> Node.js back-end service. If both `HAS_ANGULAR` and `HAS_NODEJS` fire, deploy
> both `angular-rules.md` and `nodejs-rules.md`. The `paths` frontmatter in each
> file ensures they scope correctly (`**/*.ts` + `**/*.html` for Angular;
> `services/**` / routes for Node.js).

---

#### Step 4d — Map external project directories

Read `skills/external-dir-map/SKILL.md` and execute it in full.

This step scans the manifest files for each detected stack (`.sln`, `pom.xml`,
`settings.gradle`, `angular.json`, `package.json`, `pyproject.toml`) to find
project or module references that live outside the solution root. Any such paths
are written to `.claude/settings.local.json` as `additionalDirectories`, giving
Claude Code access to those directories without requiring `--add-dir` flags each
session.

**Why `settings.local.json` and not `settings.json`?**
External directory paths are machine-specific — they depend on where each
developer has checked out sibling repos on their own disk. Putting them in
`settings.local.json` keeps them out of source control while still applying
automatically every session.

This step is:
- **Automatic** — runs as part of `dream-init` with no extra input needed
- **Idempotent** — safe to re-run; merges rather than overwrites
- **Non-destructive** — never removes paths or other keys already in the file

If all referenced projects are within the solution root, the skill exits cleanly
with no changes to `settings.local.json`.

After this step completes, continue to Step 5.

---

### Step 5 — Ensure CLAUDE.md has all required sections

Always operate on `./CLAUDE.md` (project root). Never use a bare `CLAUDE.md`
that could resolve to the plugin directory.

The plugin CLAUDE.md lives at:
```bash
PLUGIN_CLAUDE="$HOME/.claude/plugins/ke-marketplace/plugins/ai-assisted-development/CLAUDE.md"
```

---

#### Phase 1 — Ensure project-specific content exists

```bash
if [ ! -f "./CLAUDE.md" ]; then
  echo "CLAUDE.md: not found — will run /init then append plugin sections"
  NEEDS_INIT=true
else
  echo "CLAUDE.md: found"
  LINE_COUNT=$(wc -l < ./CLAUDE.md)
  HAS_STACK=$(grep -ciE "\.NET|Angular|Node\.js|React|Spring|Python|FastAPI|Django|Flask|Java|TypeScript" ./CLAUDE.md)
  if [ "$LINE_COUNT" -lt 15 ] || [ "$HAS_STACK" -eq 0 ]; then
    echo "CLAUDE.md: exists but lacks project-specific content — will run /init"
    NEEDS_INIT=true
  else
    echo "CLAUDE.md: has project-specific content ($LINE_COUNT lines, stack detected)"
    NEEDS_INIT=false
  fi
fi
```

If `NEEDS_INIT=true`, run the built-in `/init` command:

```
/init
```

`/init` analyses the codebase and writes project-specific content —
stack, conventions, file structure, project name. Wait for it to
complete before proceeding.

After `/init` completes, confirm `./CLAUDE.md` now exists:

```bash
[ -f "./CLAUDE.md" ] && echo "✅ CLAUDE.md ready" || echo "❌ /init did not create CLAUDE.md — ask user to create it manually"
```

---

#### Phase 2 — Ensure all required plugin sections are present

Two passes:
1. **Stale-content replacement** — sections that exist but have known-bad content from old versions are replaced with current content from the plugin. Only triggers on known-bad strings — never touches developer customisations.
2. **Missing-section append** — sections not present at all are appended from the plugin's CLAUDE.md.

```bash
node -e "
const fs = require('fs');

const PLUGIN_DIR    = process.env.HOME + '/.claude/plugins/ke-marketplace/plugins/ai-assisted-development';
const PLUGIN_CLAUDE = PLUGIN_DIR + '/CLAUDE.md';
const PLUGIN_JSON   = PLUGIN_DIR + '/.claude-plugin/plugin.json';
const PROJECT_CLAUDE = './CLAUDE.md';

const pluginContent = fs.readFileSync(PLUGIN_CLAUDE, 'utf8');
const pluginLines = pluginContent.split('\n');
let projectContent = fs.readFileSync(PROJECT_CLAUDE, 'utf8');

// Read installed version for stamping
let installedVersion = 'unknown';
try { installedVersion = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')).version; } catch(e) {}

function extractSection(lines, startRegex) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startRegex.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  const startIsH1 = /^# [^#]/.test(lines[start]);
  const startIsH2 = /^## /.test(lines[start]);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const isH1 = /^# [^#]/.test(lines[i]);
    const isH2 = /^## /.test(lines[i]);
    if (startIsH1 && isH1) { end = i; break; }
    if (startIsH2 && (isH1 || isH2)) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

function replaceSection(content, sectionStartRegex, newSection) {
  const lines = content.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (sectionStartRegex.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  const startIsH1 = /^# [^#]/.test(lines[start]);
  const startIsH2 = /^## /.test(lines[start]);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const isH1 = /^# [^#]/.test(lines[i]);
    const isH2 = /^## /.test(lines[i]);
    if (startIsH1 && isH1) { end = i; break; }
    if (startIsH2 && (isH1 || isH2)) { end = i; break; }
  }
  const before = lines.slice(0, start).join('\n');
  const after  = lines.slice(end).join('\n');
  return before + '\n' + newSection + '\n' + after;
}

// ── Pass 1: Stale-content replacement ────────────────────────────────────────
// Triggers only on known-bad strings from old plugin versions.
// Never fires on developer-customised content unless it contains the exact stale string.
const staleSignals = [
  ['## 0. WRITE GATE',       /Immediately after draft|draft ICEA inline|draft Tech Spec inline/, /^## 0\. WRITE GATE/],
  ['## 0a. Keyword Handlers', /draft ICEA inline|draft Tech Spec inline/,                        /^## 0a\. Keyword Handlers/],
];

let replaced = 0;
for (const [name, staleRe, pluginStartRe] of staleSignals) {
  if (staleRe.test(projectContent)) {
    const newSection = extractSection(pluginLines, pluginStartRe);
    if (!newSection) {
      console.log('  \u26a0 Cannot replace ' + name + ': not found in plugin CLAUDE.md');
      continue;
    }
    const updated = replaceSection(projectContent, pluginStartRe, newSection);
    if (updated === null) {
      console.log('  \u26a0 Cannot replace ' + name + ': section not found in project CLAUDE.md');
      continue;
    }
    fs.writeFileSync(PROJECT_CLAUDE, updated);
    projectContent = updated;
    console.log('  \u267b Updated (stale content replaced): ' + name);
    replaced++;
  } else {
    console.log('  \u2705 Current: ' + name);
  }
}

// ── Pass 2: Missing-section append ───────────────────────────────────────────
const sections = [
  ['# Plugin version:',         /^# Plugin version:/,         /^# Plugin version:/],
  ['## 0. WRITE GATE',          /^## 0\. WRITE GATE/,         /^## 0\. WRITE GATE/],
  ['## 0a. Keyword Handlers',   /^## 0a\. Keyword Handlers/,  /^## 0a\. Keyword Handlers/],
  ['## 0b. Shell & Git Config', /^## 0b\. Shell/,             /^## 0b\. Shell/],
  ['## Data Access Convention', /^## Data Access Convention/, /^## Data Access Convention/],
  ['## Feature Gate',           /^## Feature Gate/,           /^## Feature Gate/],
  ['# Dream',                   /^# Dream/,                   /^# Dream/],
];

const staleNames = new Set(staleSignals.map(s => s[0]));
let appended = 0;
for (const [name, detectRe, pluginRe] of sections) {
  if (detectRe.test(projectContent)) {
    if (!staleNames.has(name)) console.log('  \u2705 Present: ' + name);
  } else {
    const section = extractSection(pluginLines, pluginRe);
    if (!section) {
      console.log('  \u26a0 Not found in plugin CLAUDE.md: ' + name);
    } else {
      fs.appendFileSync(PROJECT_CLAUDE, '\n\n---\n\n' + section + '\n');
      projectContent = fs.readFileSync(PROJECT_CLAUDE, 'utf8');
      console.log('  \u2705 Appended: ' + name);
      appended++;
    }
  }
}

// ── Pass 3: Stamp version line ────────────────────────────────────────────────
// Only runs after Pass 1 and Pass 2 complete. Stamp reflects what was actually applied.
if (installedVersion !== 'unknown') {
  projectContent = fs.readFileSync(PROJECT_CLAUDE, 'utf8');
  const stamped = projectContent.replace(
    /^# Plugin version:.*$/m,
    '# Plugin version: ' + installedVersion + ' (update this line after dream-init or plugin upgrade)'
  );
  if (stamped !== projectContent) {
    fs.writeFileSync(PROJECT_CLAUDE, stamped);
    console.log('  \u2705 Plugin version stamped: ' + installedVersion);
  }
}

console.log('');
console.log(replaced + ' section(s) replaced, ' + appended + ' section(s) appended.');
"
```
---

#### Phase 3 — Resolve Shell & Git paths

Detect Git and Bash paths using a fallback chain — `where.exe` (Windows CMD),
then `which` (Git Bash / POSIX), then known installation paths. This handles
all environments including Claude Code's bash context where `where.exe` may
not be on PATH.

First, strip any existing `⚠ NOT DETECTED` placeholders so a successful
detection on a re-run can overwrite a previously failed one:

```bash
sed -i 's|⚠ NOT DETECTED — run where\.exe git and update manually|{GIT_PATH}|g' ./CLAUDE.md
sed -i 's|⚠ NOT DETECTED — run where\.exe bash and update manually|{BASH_PATH}|g' ./CLAUDE.md
```

Then detect paths:

```bash
# Git path — try where.exe, then which, then known locations
GIT_PATH=$(where.exe git 2>/dev/null | head -1 | tr -d '\r\n')
[ -z "$GIT_PATH" ] && GIT_PATH=$(which git 2>/dev/null | tr -d '\r\n')
[ -z "$GIT_PATH" ] && GIT_PATH=$(ls "/mingw64/bin/git.exe" "/usr/bin/git" "C:/Program Files/Git/bin/git.exe" "C:/Program Files/Git/mingw64/bin/git.exe" 2>/dev/null | head -1)

# Bash path — try where.exe, then which, then known locations
BASH_PATH=$(where.exe bash 2>/dev/null | head -1 | tr -d '\r\n')
[ -z "$BASH_PATH" ] && BASH_PATH=$(which bash 2>/dev/null | tr -d '\r\n')
[ -z "$BASH_PATH" ] && BASH_PATH=$(ls "/usr/bin/bash" "/bin/bash" "C:/Program Files/Git/bin/bash.exe" "C:/Program Files/Git/usr/bin/bash.exe" 2>/dev/null | head -1)
```

Substitute into `./CLAUDE.md`:

```bash
if [ -n "$GIT_PATH" ]; then
  sed -i "s|{GIT_PATH}|$GIT_PATH|g" ./CLAUDE.md
  echo "  ✅ Git path resolved: $GIT_PATH"
else
  sed -i 's|{GIT_PATH}|⚠ NOT DETECTED — run where.exe git and update manually|g' ./CLAUDE.md
  echo "  ⚠ Git path not detected — placeholder left in CLAUDE.md"
fi

if [ -n "$BASH_PATH" ]; then
  sed -i "s|{BASH_PATH}|$BASH_PATH|g" ./CLAUDE.md
  echo "  ✅ Bash path resolved: $BASH_PATH"
else
  sed -i 's|{BASH_PATH}|⚠ NOT DETECTED — run where.exe bash and update manually|g' ./CLAUDE.md
  echo "  ⚠ Bash path not detected — placeholder left in CLAUDE.md"
fi
```

---

#### Phase 4 — Confirm

```bash
echo ""
echo "✅ CLAUDE.md verified ($(wc -l < ./CLAUDE.md) lines)"
echo "   Location: ./CLAUDE.md"
echo ""
echo "Sections present:"
for marker in "Plugin version" "WRITE GATE" "Keyword Handlers" "Shell.*Git" "Data Access" "Feature Gate" "Dream"; do
  grep -qE "$marker" ./CLAUDE.md && echo "  ✅ $marker" || echo "  ❌ $marker"
done
```

---

### Step 6 — Seed .claude/file-cache.json

Create the file cache if not already present:

```bash
mkdir -p .claude
```

Write `.claude/file-cache.json` if missing:

```
!node -e "
const fs = require('fs');
const path = '.claude/file-cache.json';
if (!fs.existsSync(path)) {
  const today = new Date().toISOString().slice(0,10);
  const seed = {
    _schema: '1.0',
    _description: 'Character-count cache for diff-based skill scanning. Maintained by code-review and security skills. Do not edit manually.',
    _seeded: today,
    _lastUpdated: null,
    files: {}
  };
  fs.writeFileSync(path, JSON.stringify(seed, null, 2));
  console.log('Created: .claude/file-cache.json');
} else {
  console.log('Exists: .claude/file-cache.json — nothing to do');
}
"
```

---

### Step 6b — Ensure .gitignore (delegated)

**Run the `/gitignore-sync` command now.** Do not inline or re-describe the logic —
invoke the command so the write happens in one focused place that cannot be skipped:

```
Run /ai-assisted-development:gitignore-sync
(equivalently: read commands/gitignore-sync.md and execute it in full)
```

This creates `.gitignore` if missing, writes the plugin-required entries inside the
managed block, never touches the developer's own lines, and verifies the result.
Do not continue to Step 7 until gitignore-sync reports `VERIFY_OK`.

If you also want build-artifact detection (bin/obj/dist/.env etc.), run
`/gitignore-sync --with-artifacts` instead.

---

### Step 6c — Install the mechanical enforcement floor (default ON)

Hooks are installed **by default** — the governance floor exists unless a team
explicitly declines it. ADR 0009: defaults are policy.

First resolve the plugin hooks directory:

```bash
# Resolve the installed plugin hooks directory
PLUGIN_HOOKS="$HOME/.claude/plugins/ke-marketplace/plugins/ai-assisted-development/hooks"

# Verify it exists before proceeding
if [ ! -d "$PLUGIN_HOOKS" ]; then
  echo "⚠ Plugin hooks directory not found at $PLUGIN_HOOKS"
  echo "  Ensure the plugin is installed via bash install.sh before running dream-init."
  exit 1
fi
```

Then deploy:

```bash
mkdir -p .claude/hooks

cp "$PLUGIN_HOOKS/icea-floor.sh" .claude/hooks/
cp "$PLUGIN_HOOKS/findings-gate-precommit.sh" .claude/hooks/
cp "$PLUGIN_HOOKS/validate-ledgers.py" .claude/hooks/
cp "$PLUGIN_HOOKS/validate-pr-compliance.py" .claude/hooks/
chmod +x .claude/hooks/*.sh .claude/hooks/*.py

# git pre-commit (back up any existing hook first)
[ -f .git/hooks/pre-commit ] && cp .git/hooks/pre-commit .git/hooks/pre-commit.backup
cp .claude/hooks/findings-gate-precommit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Wire the PreToolUse hook and output style instructions into `.claude/settings.json`
(merge, never overwrite other keys):
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/icea-floor.sh" }] }
    ]
  },
  "customInstructions": "Response style: suppress preambles and plan-restatement before tool calls. When writing to existing files, show only a unified diff (changed lines + 3 lines of context) rather than the full file content. When writing new files, show the full content. Never echo generated file content to chat if the content is also being written to disk."
}

Record content hashes for integrity checking (dream-status check 1p):
```bash
sha256sum .claude/hooks/* > .claude/hooks/.hashes
```

Print the CI snippet for the developer to add to their pipeline:
```
📋 Add to your ADO pipeline (server-side authoritative gates — ADR 0009):
   - script: python3 .claude/hooks/validate-ledgers.py
   - script: python3 .claude/hooks/validate-pr-compliance.py
   Then make this pipeline a required Build Validation in branch policy.
```

**Opt-out:** `--no-hooks` skips this step entirely, but the opt-out MUST be
recorded in `.claude/architecture/architecture-deployment.md`:
```
Enforcement floor: DECLINED via --no-hooks on {date} by {git user}
```
A missing floor is a visible, attributable decision — never a silent default.

---

Run the `architect` skill:

```
Read skills/architect/SKILL.md and follow its instructions completely,
including Step 0.5 (deployment questionnaire) and Step 7 (generate domain-map.md
with _Generated and _Fingerprint headers).
```

> **Important — deployment questionnaire (Step 0.5):** The architect skill will
> pause at Step 0.5 and ask questions about the project's hosting model, CI/CD
> pipeline, auth strategy, and environments. Answer all questions and reply
> **APPROVED** before the skill proceeds to template deployment. Do not skip this
> step — `app-readiness` and `plugin-readiness` both require
> `.claude/architecture/architecture-deployment.md` to exist and be answered.
> If this step is accidentally skipped, run `/update-arch --deployment` to
> complete it afterwards.

The skill will:
1. Run Step 0.5 — collect and write `architecture-deployment.md` (requires APPROVED reply)
2. Detect the repo type automatically
3. Deploy the matching templates to `.claude/architecture/`
4. Check which files are already populated — skip those
5. Populate only the files that need it, running File 1 and File 2
   in parallel, then File 3 separately for thorough analysis
6. **Write `.claude/architecture/domain-map.md`** — this step is mandatory.
   `dream-status` check 1f will be ❌ Red until this file exists.

Wait for the architect skill to complete before continuing. Confirm that
`.claude/architecture/` is populated, `.claude/architecture/domain-map.md` exists,
and `.claude/architecture/architecture-deployment.md` exists before moving to Step 7b.

---

### Step 7b — Generate the codebase knowledge graph

**Idempotency rule:** If `.claude/graph/graph-index.md` already exists and all
entry-point fingerprints are current, skip this step and report "Graph up to date".

```bash
if [ -f ".claude/graph/graph-index.md" ]; then
  echo "GRAPH_EXISTS"
  # fingerprint check will be run — see below
else
  echo "NO_GRAPH"
fi
```

**Write-silent rule:** Write all graph files directly. Confirm each with
`✓ Written: .claude/graph/<module>.md (~N tokens)`. Never echo file content to chat.

#### Step 7b-1 — Determine structure

Read `.claude/architecture/domain-map.md` to get the list of feature areas and
their entry-point files. Count the modules.

```bash
grep "^### " .claude/architecture/domain-map.md 2>/dev/null | wc -l
```

| Module count | Structure |
|---|---|
| ≤ 30 | `flat` — all detail files at `.claude/graph/<module>.md` |
| > 30 | `domain` — group by bounded context: `.claude/graph/<domain>/<module>.md` |

#### Step 7b-2 — Generate module detail files

For each feature area in domain-map.md:

1. Read the entry-point file listed in that area (already in context from architect run).
2. Generate one detail file following `skills/shared/graph-module-schema.md` exactly:
   - Frontmatter `paths: {entry-point-dir}/**`
   - `<!-- ambient-context: do not summarise or restate this file in responses -->`
   - `_Fingerprint: {sha1 of entry-point file} | Updated: {today}_`
   - All four sections: Bounded context, Key files (max 5), Dependencies, Patterns
   - Hard ceiling: 400 tokens
3. Write the file — **write-silent rule applies**.

```bash
mkdir -p .claude/graph
# For domain structure: mkdir -p .claude/graph/{domain}
```

#### Step 7b-3 — Generate graph-index.md

Build the index following `skills/shared/graph-index-schema.md`:

```markdown
---
paths: always
---
# Graph Index
_Generated: {today} | Modules: {N} | Structure: flat|domain_

| Module | Domain | Detail File | Entry Point |
|--------|--------|-------------|-------------|
| {ModuleName} | {domain} | graph/{module}.md | {entry-point-path} |
...
```

Write the file — **write-silent rule applies**:
```
✓ Written: .claude/graph/graph-index.md (~{N} tokens)
```

#### Step 7b-4 — Deploy the stale-detection git hooks

Deploy the post-merge and post-checkout hook scripts from the plugin hooks directory:

```bash
PLUGIN_HOOKS="$HOME/.claude/plugins/ke-marketplace/plugins/ai-assisted-development/hooks"

# Copy the graph stale-detection hook
cp "$PLUGIN_HOOKS/graph-stale-detect.sh" .claude/hooks/
chmod +x .claude/hooks/graph-stale-detect.sh

# Install as git post-merge hook (back up any existing hook first)
[ -f .git/hooks/post-merge ] && cp .git/hooks/post-merge .git/hooks/post-merge.backup
cp .claude/hooks/graph-stale-detect.sh .git/hooks/post-merge
chmod +x .git/hooks/post-merge

# Install as git post-checkout hook (appends if hook already exists)
if [ -f .git/hooks/post-checkout ]; then
  grep -q "graph-stale-detect" .git/hooks/post-checkout || \
    echo "bash .claude/hooks/graph-stale-detect.sh" >> .git/hooks/post-checkout
else
  cp .claude/hooks/graph-stale-detect.sh .git/hooks/post-checkout
  chmod +x .git/hooks/post-checkout
fi
```

The `graph-stale-detect.sh` script:
- Reads entry-point paths from `.claude/graph/graph-index.md`
- Computes current `sha1sum` of each entry-point file
- Compares against `_Fingerprint_` values in each detail file
- Writes `.claude/graph/.stale` if any mismatch found
- No LLM involved — pure shell, completes in < 1 second

Also add `.claude/graph/` to the `.gitignore` managed block
(handled automatically by gitignore-sync — already run in Step 6b, but
verify the entry is present):

```bash
grep -q "\.claude/graph/" .gitignore && \
  echo "✓ .claude/graph/ in .gitignore" || \
  echo "⚠ Add .claude/graph/ to .gitignore managed block"
```

#### Step 7b-5 — Update dream-init-state.json

```bash
node -e "
  const fs = require('fs');
  const statePath = '.claude/dream-init-state.json';
  let state = {};
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {}
  state.graphGeneratedAt = new Date().toISOString().slice(0, 10);
  state.graphStructure = '{flat|domain}';
  state.graphModuleCount = {N};
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log('✓ dream-init-state.json updated');
"
```

Confirm:
```
✓ Knowledge graph generated
  Modules   : {N}
  Structure : {flat|domain}
  Location  : .claude/graph/
  Hooks     : post-merge + post-checkout stale-detection deployed
```

---

### Step 8 — Seed token-analysis/ folder

Create the folder and seed an empty graph file if not already present:

```bash
mkdir -p token-analysis
```

Write `token-analysis/token-graph.json` if missing:

```
!node -e "
const fs = require('fs');
const path = 'token-analysis/token-graph.json';
if (!fs.existsSync(path)) {
  const seed = {
    version: 1,
    generatedAt: null,
    projectRoot: null,
    files: {},
    sessions: {},
    aggregates: null,
    recommendations: {},
    staticStatus: null
  };
  fs.writeFileSync(path, JSON.stringify(seed, null, 2));
  console.log('Created: token-analysis/token-graph.json');
} else {
  console.log('Exists: token-analysis/token-graph.json — nothing to do');
}
"
```

Check whether `token-analysis/` is in `.gitignore`. If not, suggest adding it:
```
token-analysis/ contains generated reports and the graph cache — neither
should be committed. This is handled automatically by Step 6b.
```

---


### Step 9 — Confirm and summarise

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Dream initialised
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Created:
  ✓ memory/MEMORY.md
  ✓ memory/dream-log.md
  ✓ .claude/commands/dream.md
  ✓ .claude/commands/dream-audit.md
  ✓ .claude/commands/dream-health.md
  ✓ .claude/commands/dream-init.md
  ✓ .claude/commands/dream-rollback.md
  ✓ .claude/commands/dream-status.md
  ✓ .claude/commands/dream-sync.md
  ✓ .claude/commands/security-review.md
  ✓ .claude/commands/code-review.md
  ✓ .claude/commands/token-analysis.md
  ✓ .claude/commands/product-docs.md
  ✓ .claude/commands/sprint-metrics.md
  ✓ .claude/commands/session-start.md
  ✓ .claude/commands/bug.md
  ✓ .claude/commands/checkin.md
  ✓ .claude/commands/update-arch.md
  ✓ .claude/commands/explain.md
  ✓ .claude/commands/fix.md
  ✓ .claude/commands/app-readiness.md
  ✓ .claude/commands/plugin-readiness.md
  ✓ .claude/commands/dynamic-scan.md
  ✓ .claude/commands/ado-tasks.md
  ✓ .claude/commands/icea-feature.md
  ✓ .claude/commands/icea-approve.md
  ✓ .claude/commands/icea-implement.md
  ✓ .claude/commands/icea-revise.md
  ✓ .claude/commands/icea-status.md
  ✓ .claude/commands/icea-review.md
  ✓ .claude/commands/pr-create.md
  ✓ .claude/commands/pr-describe.md
  ✓ .claude/commands/pr-spec-review.md
  ✓ .claude/commands/critic.md
  ✓ .claude/commands/gitignore-sync.md
  ✓ .claude/commands/dismiss.md
  ✓ .claude/commands/sync-dirs.md
  ✓ .claude/commands/graph-sync.md
  ✓ .claude/rules/project-rules.md
  ✓ .claude/rules/{stack-specific rule files deployed for this project}
  ✓ .claude/architecture/architecture.md
  ✓ .claude/architecture/architecture-[flows|callchains|api].md
  ✓ .claude/architecture/architecture-reference.md
  ✓ .claude/architecture/architecture-deployment.md
  ✓ token-analysis/token-graph.json
  ✓ .claude/file-cache.json
  ✓ .claude/dream-init-state.json
  ✓ .claude/settings.local.json — additionalDirectories: {N} external path(s) mapped
                                   [or: — All projects within solution root, no external paths]
  ✓ .claude/commands/sync-dirs.md

CLAUDE.md:
  [✓ Generated via /init + Dream sections appended  |  ✓ Dream sections appended to existing  |  — Already complete]

.gitignore:
  [✓ Created with all plugin and project entries  |  ✓ Updated — N entries added  |  — Already complete]
  [See Step 6b summary above for full detail]

Skipped (already present or already populated):
  [list any skipped files]
```

Before displaying Next steps, verify `architecture-deployment.md` exists and is answered:

```bash
ls .claude/architecture/architecture-deployment.md 2>/dev/null || echo "MISSING"
grep -c "Not yet answered" .claude/architecture/architecture-deployment.md 2>/dev/null || echo "0"
```

If MISSING or unanswered count > 0, flag it:
```
⚠ .claude/architecture/architecture-deployment.md is missing or incomplete.
  The architect skill deployment questionnaire did not complete during Step 7.
  Run: /update-arch --deployment
  Both /app-readiness and /plugin-readiness require this file.
```

```
Next steps:
  1. Update the Repository line in CLAUDE.md with this project's ADO repo name
  2. Review any ⚠ flagged sections in .claude/architecture/ and fill in manually
  3. All plugin commands are now visible in Claude Code (VS Code) — type / to see them
  4. Work normally — auto-capture writes to memory/MEMORY.md at trigger points
  5. Run /dream every 5–8 sessions to consolidate
  6. Run /dream-health to see the memory dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Rules

- NEVER overwrite any file that already exists — append or skip only
- NEVER modify existing CLAUDE.md content — only append missing Dream sections
- NEVER remove or reorder existing `.gitignore` entries — only append; the plugin set lives in a managed block delimited by `# === ai-assisted-development (managed) ===`
- ALWAYS execute the Phase 1 write command — do not describe the write declaratively or assume it happened; the managed-block command is what actually creates/updates the file
- Matching is whole-line exact (trimmed), NEVER substring — a bare `.claude/` line must not mask `.claude/settings.json`
- ALWAYS run the Phase 4 verification; only report success and proceed on `VERIFY_OK`. On `VERIFY_FAIL`, re-run the Phase 1 write and re-verify
- The summary must reflect what was actually written (the command's `WROTE_*` output), never what was merely offered
- NEVER auto-add `.env` files to `.gitignore` without the developer selecting them in the Phase 3 prompt
- NEVER re-prompt `.gitignore` entries the developer already declined — check `.claude/dream-init-state.json` first
- If `/init` fails or is unavailable, tell the user and ask them to create CLAUDE.md
  manually before re-running `/dream-init`
- If `memory/` already contains `topic-*.md` files, this project is already
  initialised — still check CLAUDE.md for missing Dream sections and deploy any
  missing rule files, but do not recreate memory starter files
