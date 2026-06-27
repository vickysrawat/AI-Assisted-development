---
description: >
  Use when the user asks for a code review, static analysis, code defect review, data flow
  analysis, control flow analysis, null pointer analysis, resource leak detection, concurrency
  review, or any request mentioning "Coverity", "SAST", "static analysis", "defect density",
  "CID", "tainted data", or "review my code". Performs deep inter-procedural analysis across
  function boundaries for .NET/C#, ASP.NET, WCF, Entity Framework, Angular/TypeScript, and Node.js.
  Every finding includes a concrete fix with a corrected code snippet.
---

# Claude Code Review Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: A_
A Coverity-equivalent static analysis assistant. Performs inter-procedural data flow,
control flow, memory safety, concurrency, and code quality analysis. Scoped to
.NET/C#, ASP.NET, WCF, Entity Framework, Angular/TypeScript, and Node.js.

Every finding is assigned a **CID** (Code Issue Defect), a **checker name**,
an **event path**, an **impact rating**, and a **concrete fix with a corrected
code snippet** — matching Coverity's output format.

---


---


> **Single-writer assumption**: This skill writes to a persistent cache file. See `../shared/single-writer-assumption.md` for concurrency constraints and CI guidance.


## Model routing

This skill is in the **review tier** — it uses `REVIEW_MODEL` (default: `claude-sonnet-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "REVIEW_MODEL": "claude-sonnet-4-6" } }
```

See `../shared/model-routing-spec.md` for full routing documentation.

## 0. Cache-Aware File Selection (run before analysis)

The code-review skill uses `.claude/file-cache.json` to skip files unchanged
since the last review. This reduces token cost by 80–95% on subsequent runs.

### Step 0a — Determine scope

Check for explicit scope flags in the user's request:

| Flag | Behaviour |
|---|---|
| `--changed` | Review only git-staged and unstaged modified files |
| `--pr` | Review only files changed in this branch vs the base branch |
| `--full` | Force a full scan — ignore the cache |
| `--ci` | CI mode: same as `--full`, warns if cache file found on disk |
| `--area backend` | Backend source files (`*.cs`, `*.java`, `*.py`) |
| `--area frontend` | Only `*.ts` and `*.html` files |
| `--area config` | Only `*.json`, `*.yml`, `*.yaml`, `*.env`, `Dockerfile` |
| `--area <AreaName>` | Entry-point file + key files for that domain-map area |
| `--continue` | Resume from checkpoint |
| (none) | Default: cache-aware full-project scan with budget cap |

For `--changed`:
```bash
git diff --name-only          # unstaged
git diff --name-only --cached # staged
```

For `--pr`:
```bash
git diff --name-only origin/HEAD...HEAD
```

### Step 0b — Build the candidate file list (ALL files from project root)

**Always enumerate from the project root — never assume source files live only
under `src/`. Configuration files, build scripts, and environment files outside
`src/` are equally valid code-review targets.**

For a default or `--full` or `--ci` scan, build the candidate list:

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
  -type f \( \
    -name "*.ts" -o -name "*.js" -o -name "*.cs" -o -name "*.py" \
    -o -name "*.java" -o -name "*.go" -o -name "*.rb" -o -name "*.php" \
    -o -name "*.html" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" \
    -o -name "*.tf" -o -name "*.sh" -o -name "*.ps1" \
    -o -name "*.config" -o -name "web.config" -o -name "Dockerfile" \
    -o -name "appsettings*.json" \
  \) | sort
```

For `--changed` and `--pr`, the git commands produce a root-relative list — use those
directly. Do not filter by subdirectory.

For `--area backend`: `find . \( -name "*.cs" -o -name "*.java" -o -name "*.py" \) -not -path "./bin/*" -not -path "./obj/*" -not -path "./target/*" -not -path "*/__pycache__/*" -not -path "*/.venv/*"`
For `--area frontend`: `find . \( -name "*.ts" -o -name "*.html" \) -not -path "./node_modules/*" -not -path "./dist/*"`
For `--area config`: `find . \( -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "Dockerfile" \) -not -path "./node_modules/*" -not -path "./dist/*"`
For `--area <AreaName>`: read `domain-map.md` and extract entry-point + key files for the named area.
For `--continue`: read pending files from `.claude/code-review-checkpoint.json`.

### Step 0a2 — Apply file budget cap

**FILE_BUDGET = 40 files per session.**

Count candidate files after resolving scope. If count > 40 and no `--area` or `--continue` flag:

```
⚠ Large project: {N} files — exceeds 40-file session budget.

  Scanning this session: 40 files (priority-ordered)
  Remaining: {N-40} files

  After this scan, run sub-scans for full coverage:
    /code-review --area backend     → .NET / C# files
    /code-review --area frontend    → Angular / TypeScript files
    /code-review --area config      → Config / build files
  Or: /code-review --continue
```

Write the checkpoint with all files, then scan the first 40 in priority order.

### Step 0a3 — Sort candidate files by priority

1. Auth / authorisation files: `*auth*`, `*login*`, `*policy*`, `*middleware*`
2. Controllers / routers: `*controller*`, `*router*`, `routes/*`
3. Data access: `*repository*`, `*context*`, `*service*`
4. Configuration / environment: `appsettings*`, `.env*`, `*config*`, `Dockerfile`
5. Angular components: `*.component.ts`, `*.component.html`
6. Tests / utilities: `*.spec.ts`, `*test*`, `*helper*` (lowest priority)

### Step 0c — Load cache (only for default scan)

First, determine which mode applies:

---

**IF `--full` or `--ci` flag was given:**

```
SKIP THE CACHE ENTIRELY.
Every file in the candidate list is CHANGED → scan all of them.
Do not read file-cache.json.
Do not compare character counts.
Do not skip any file.
Jump directly to Step 0e.
```

---

**IF `--changed` or `--pr` flag was given:**

The candidate list came from git — those files are CHANGED by definition.
Do not consult the cache. Scan all files in the list.
Jump directly to Step 0e.

---

**IF no flag was given (default cache-aware scan):**

```bash
cat .claude/file-cache.json 2>/dev/null || echo "NO_CACHE"
```

If `NO_CACHE` → treat every file in the candidate list as CHANGED, scan all.

### Step 0d — Identify changed files (default scan only)

For each file in the candidate list:
1. Get current char count: `wc -c <file>`
2. Compare to `files[path].charCount` in the cache
3. If missing from cache OR counts differ → **CHANGED** → include in scan
4. If counts match → **UNCHANGED** → skip

---

**Hard rule: `--full` means scan everything. No file is ever skipped when `--full` is set.**

### Step 0e — Load analysis references, then report scope

Load before scanning:
```
Read skills/code-review/references/checkers.md
Read skills/code-review/references/output-format.md
Read skills/code-review/references/analysis-rules.md
Read skills/shared/business-context-severity.md
Read skills/shared/source-file-consent.md
```

**Then load the language-specific checker(s) for the files in scope.** `checkers.md`
holds the universal categories; each language file specializes them. Inspect the
file extensions in the scoped set and load every matching reference (a polyglot
repo loads more than one). If `architecture.md` declares the active layers, use it
to confirm which languages are in play.

| Extensions in scope | Also load |
|---|---|
| `*.cs` | `references/checkers-dotnet.md` |
| `*.ts` `*.js` `*.html` | `references/checkers-typescript.md` |
| `*.java` | `references/checkers-java.md` |
| `*.py` | `references/checkers-python.md` |

If a scoped file's language has no specific checker file, fall back to the
universal categories in `checkers.md` alone.

```
📂 Code Review Scope
  Mode    : cache-aware | --changed | --pr | --full | --ci | --area {name} | --continue
  Area    : {all | backend | frontend | config | <AreaName>}
  Scan root: project root (all directories)
  Files to scan: N  (session budget: 40 max)
  Unchanged files skipped: M (cache hit)
  Queued for next session: {K or "none"}
  First run (no cache): true | false
```

If 0 files changed, respond:
```
✅ No changed files detected since last review.
Run with --full to force a complete rescan.
```
And stop.

### Step 0f — Update the cache after scanning

After completing analysis, update `.claude/file-cache.json`:
- For every file scanned: update `charCount`, `lastScanned` (today), add `"code-review"` to `scannedBy`
- Merge with existing entries — do not overwrite other skills' data
- Update `_lastUpdated` to today's date

See `../shared/file-cache-schema.md` for full schema and merge rules.

---


---

## Step 0f — Checkpoint file (resume on connection drop)

Before scanning any files, write a checkpoint so the skill can resume if the
connection drops mid-scan.

```bash
mkdir -p .claude
CHECKPOINT=".claude/code-review-checkpoint.json"
```

**On start:** write the checkpoint with the full file list:
```json
{
  "started": "YYYY-MM-DDTHH:MM:SSZ",
  "scope": "--changed | --pr | --full | default",
  "files": [
    { "path": "src/Controllers/UserController.cs", "status": "pending" },
    { "path": "src/Services/AuthService.cs",       "status": "pending" }
  ],
  "findings": []
}
```

**After each file is scanned:** update its status to `"done"` and append findings.
Write the checkpoint after every file.

**On next run — detect and offer resume:**

```bash
cat .claude/code-review-checkpoint.json 2>/dev/null || echo "NO_CHECKPOINT"
```

If checkpoint exists with `"pending"` files:
```
⚠ Found an incomplete code review from {started}.
  Scanned  : {done_count} files
  Remaining: {pending_count} files
  Findings so far: {finding_count}

Resume from where it stopped? (yes / no — 'no' starts a fresh scan)
```

- `yes`: skip `"done"` files, continue from first `"pending"`, merge findings, generate report.
- `no`: delete checkpoint and start fresh.

**On successful completion:** delete `.claude/code-review-checkpoint.json`.

> Add `.claude/code-review-checkpoint.json` to `.gitignore`.

---

## 1. Analysis Approach

Before scanning, internally answer:

1. **Language** — C# / ASP.NET? TypeScript / Angular? Node.js?
2. **Analysis depth** — full codebase, single file, or diff?
3. **Priority** — defect density report, data flow only, or full spectrum?

Then apply all applicable checker categories from §2.

---

## 2. Checker Categories

Load `references/checkers.md` now — required for analysis.

---

## 3. Output Format

Load `references/output-format.md` now — required for report generation.

---

## 4. Analysis Rules

Load `references/analysis-rules.md` now.

---


## 5. Reference Files

| File | When to load |
|------|-------------|
| `references/checkers-dotnet.md` | C# / ASP.NET / WCF / EF / Dapper analysis |
| `references/checkers-typescript.md` | Angular / TypeScript / Node.js analysis |
| `references/checkers-java.md` | Java / Spring Boot / JPA analysis |
| `references/checkers-python.md` | Python / FastAPI / Django / Flask analysis |
| `../shared/file-cache-schema.md` (spec v1.0) | file-cache.json schema and merge rules (shared across skills) |
| `../shared/scope-flags-spec.md` (spec v1.4) | Canonical scope flag definitions and file enumeration command (`--changed`, `--pr`, `--full`, `--ci`) |
| `../shared/domain-map-spec.md` (spec v1.1) | domain-map.md schema, staleness rules, and fingerprint contract |
| `../shared/dismissed-findings-reconciliation.md` (spec v1.0) | Canonical Rule 5 — dismissed finding reconciliation on re-scan (keep dismissed if file unchanged; re-open with verify flag if file changed since dismissal date) |
