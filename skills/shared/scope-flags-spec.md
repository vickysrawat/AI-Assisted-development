# Scope Flags Specification
_Spec version: 1.4 · Last changed: 2026-06-03 · Compatible skill versions: code-review ≥1.2.0, security ≥1.2.0_


Shared by: `code-review`, `security`

Defines the canonical scope flags that control which files a skill scans.
Both skills must implement these flags identically.

---

## Flags

| Flag | Meaning | Git command |
|---|---|---|
| `--changed` | Only git-staged and unstaged modified files | `git diff --name-only && git diff --name-only --cached` |
| `--pr` | Only files changed in this branch vs base branch | `git diff --name-only origin/HEAD...HEAD` |
| `--full` | Full codebase scan — ignore file-cache entirely | (no git filter; process all files) |
| `--ci` | CI mode: alias for `--full` with cache-presence warning (see below) | (no git filter; process all files) |
| `--area backend` | Only `*.cs` files | (no git filter; file-type filter only) |
| `--area frontend` | Only `*.ts` and `*.html` files | (no git filter; file-type filter only) |
| `--area config` | Only `*.json`, `*.yml`, `*.yaml`, `*.env`, `Dockerfile`, `*.tf` | (no git filter; file-type filter only) |
| `--area <Name>` | Entry-point + key files for knowledge-graph module `<Name>` | (read `.claude/graph/graph-index.md`, then `.claude/graph/<module>.md`) |
| `--continue` | Resume pending files from checkpoint | (read `.claude/{skill}-checkpoint.json`) |
| (none) | Default: cache-aware full-project scan (no file cap) | (all matching files, skipping cache-hits) |

### `--ci` flag behaviour

`--ci` is identical to `--full` with one addition: if a cache file is found on disk,
the skill emits a warning before scanning:

```
⚠ CI mode: cache file found at .claude/file-cache.json — ignoring.
  If this file was restored from a cache artifact or accidentally committed,
  remove it from your pipeline to keep scans accurate.
  Running full scan.
```

This makes misconfigured pipelines visible without failing the build.
Use `--ci` in all CI/CD pipeline invocations instead of `--full`.

---

## Precedence

1. If the user passes `--ci` → full scan + warn on cache presence
2. If the user passes `--full` → ignore file-cache, scan everything (no warning)
3. If the user passes `--changed` or `--pr` → apply git filter first, then skip cache-hits within that set
4. If no flag → cache-aware full scan (default)
5. `--changed` and `--pr` are mutually exclusive — if both appear, `--pr` wins

---

## Canonical file enumeration (default and --full scans)

When no git-based scope flag is in use, skills must enumerate files from the
**project root** using this command. Never restrict to `src/` or any subdirectory:

```bash
find . \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./.angular/*" \
  -not -path "./dist/*" \
  -not -path "./out/*" \
  -not -path "./build/*" \
  -not -path "./.cache/*" \
  -not -path "./coverage/*" \
  -not -path "./bin/*" \
  -not -path "./obj/*" \
  -not -path "./tmp/*" \
  -type f \
  \( \
    -name "*.ts" -o -name "*.js" -o -name "*.cs" -o -name "*.py" \
    -o -name "*.java" -o -name "*.go" -o -name "*.rb" -o -name "*.php" \
    -o -name "*.html" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" \
    -o -name "*.tf" -o -name "*.sh" -o -name "*.ps1" \
    -o -name "*.config" -o -name "web.config" -o -name "Dockerfile" \
    -o -name "appsettings*.json" -o -name "*.pem" -o -name "*.key" \
  \) \
  | sort
```

This is the single source of truth for file enumeration. Skills must reference this
spec rather than writing their own `find` invocations.

**Why root-level files matter:**
- `angular.json` — build target overrides, asset includes, environment file mapping
- `environments/*.ts` — API base URLs, feature flags, credential fragments
- `.github/workflows/*.yml` / `azure-pipelines.yml` — secrets usage, deployment logic
- `Dockerfile`, `docker-compose.yml` — exposed ports, hardcoded credentials, image provenance
- `*.tf`, `*.tfvars` — IaC security posture
- `appsettings*.json` — connection strings, auth config outside `src/`
- `.env`, `.env.production` — environment-specific secrets
- `proxy.conf.json`, `nginx.conf` — CORS policy, header security

---

## No file budget cap

Scans are **not** capped at a fixed file count. A default scan processes all candidate files
that are not cache-hits; `--full`/`--ci` process all files ignoring the cache. Cache-awareness
(skipping unchanged files) and the `--area` / `--changed` / `--pr` scoping flags are the
mechanisms for keeping a scan tractable — not a hard per-session file limit. `--continue`
remains available to resume a scan interrupted by a connection drop.

## Scope report format

Every skill must report scope before scanning:

```
📂 <Skill Name> Scope
  Mode     : cache-aware | --changed | --pr | --full
  Files    : N to scan, M skipped (cache hit)
  First run: true | false
```

If 0 files to scan after applying scope + cache:
```
✅ No changed files detected since last run.
   Use --full to force a complete rescan.
```
And stop — do not continue to analysis.

---

## Passing flags from commands to skills

When a slash command wraps a skill (e.g. `security-review` wrapping `security`),
the command is responsible for:

1. Extracting the flag from the user's invocation arguments
2. Including it explicitly in the task description passed to the skill

Example in command:
```
User invoked: /security-review --pr
→ Tell security skill Step 0b: scope mode is --pr
```

---

## Implementation notes

- Flags are positional — detect by checking if `--changed`, `--pr`, or `--full`
  appears anywhere in the user's message or command arguments
- File paths from `--changed` and `--pr` are relative to the project root
- A file returned by the git filter but not in `file-cache.json` is CHANGED (first scan)
- A file returned by the git filter whose cache charCount matches is still CHANGED
  for scope purposes — the git filter already determined it changed; the cache only
  skips files in full-scan mode

---

## `--area <Name>` error handling

When the developer passes `--area <Name>` (where `<Name>` is a knowledge-graph
module, not `backend`, `frontend`, or `config`), skills must handle two failure
cases before attempting to enumerate files:

### Case 1 — the knowledge graph is missing

```bash
ls .claude/graph/graph-index.md 2>/dev/null || echo "MISSING"
```

If MISSING, emit and fall back to full scan:

```
⚠ --area requires the knowledge graph (.claude/graph/graph-index.md).
  Run /setup-init (or /graph-sync) to generate it.
  Falling back to full scan.
```

Then continue with the full-scan file enumeration. Do not abort.

### Case 2 — named module not found in the graph index

After reading `graph-index.md`, check whether `<Name>` appears in the Module column.
If not found, emit and prompt the developer to choose:

```
⚠ Module "{Name}" not found in graph-index.md.

Available modules:
  {list each Module from the index table, one per line}

Re-run with one of the names above, or omit --area for a full scan.
```

Then stop — do not fall back to full scan in this case, as the developer's intent
was a targeted scan and a full scan may be undesirable.

### Case 3 — module found, extract files

```bash
# Find the module's detail file from the index, then read its Key files
DETAIL=$(grep -E "^\| *{Name} *\|" .claude/graph/graph-index.md 2>/dev/null | awk -F'|' '{print $4}' | tr -d ' ')
sed -n '/\*\*Key files\*\*/,/^\*\*/p' ".claude/$DETAIL" 2>/dev/null
```

Use these files as the candidate list — a `--area` scan is already scoped to the
module's key files.

---

## Skill-local flag extensions

Skills that require flags outside the standard set (`--changed`, `--pr`, `--full`,
`--ci`, `--area`, `--continue`) must:

1. Declare the flag and its semantics in their own SKILL.md
2. Register it in this table
3. Cite this spec in their references section

| Flag | Skill | Semantics | Notes |
|---|---|---|---|
| `--quick` | `app-readiness` | Phases 1–2 only — infrastructure + architecture checks, no source reads | Faster than default; recommended for routine health checks |
| `--full` (app-readiness variant) | `app-readiness` | All 8 phases including targeted source reads for Red domains | Distinct from the standard `--full` (which means "scan all files ignoring cache") — semantics differ because app-readiness is not a file scanner |
| `--deployment` | `update-arch` | Skip Steps 1–7; run only architect Step 0.5 deployment questionnaire | Re-captures hosting/auth context to `architecture-deployment.md` |

> Standard `--full` (file scanner semantics) and app-readiness `--full` (phase selector
> semantics) share a name but differ in behaviour. The distinction is local to each skill.
> Skills must not assume `--full` always means "scan all files".
