# file-cache.json — Shared Change Detection Schema
_Spec version: 1.0 · Last changed: 2026-05-30 · Compatible skill versions: code-review ≥1.2.0, security ≥1.2.0_


This file lives at `.claude/file-cache.json` in the project root.
It is seeded by `setup-init` and read/written by `code-review` and `security`
skills to skip files unchanged since the last run.

---

## Schema (version 1.0)

```json
{
  "_schema": "1.0",
  "_description": "Character-count cache for diff-based skill scanning. Maintained by code-review and security skills. Do not edit manually.",
  "_seeded": "YYYY-MM-DD",
  "_lastUpdated": "YYYY-MM-DD",
  "files": {
    "src/Services/UserService.cs": {
      "charCount": 4821,
      "lastScanned": "2026-05-30",
      "scannedBy": ["code-review", "security"]
    },
    "src/Controllers/UserController.cs": {
      "charCount": 2103,
      "lastScanned": "2026-05-29",
      "scannedBy": ["code-review"]
    },
    "angular.json": {
      "charCount": 5430,
      "lastScanned": "2026-05-30",
      "scannedBy": ["security"]
    },
    "environments/environment.prod.ts": {
      "charCount": 312,
      "lastScanned": "2026-05-30",
      "scannedBy": ["security"]
    },
    ".github/workflows/deploy.yml": {
      "charCount": 1876,
      "lastScanned": "2026-05-30",
      "scannedBy": ["security"]
    }
  }
}
```

---

## Field Definitions

| Field | Type | Description |
|---|---|---|
| `_schema` | string | Schema version — always `"1.0"` |
| `_description` | string | Human-readable note — do not modify |
| `_seeded` | date | ISO date when setup-init first created this file |
| `_lastUpdated` | date | ISO date of the most recent write by any skill |
| `files` | object | Map of relative file path → entry |
| `files[path].charCount` | number | Character count at last scan time |
| `files[path].lastScanned` | date | ISO date of last scan |
| `files[path].scannedBy` | array | Which skills have scanned this file |

---

## How Skills Use This File

### Reading (change detection)

```
1. Enumerate all candidate files from the project root (see scope-flags-spec.md for
   the canonical find command — never restrict to src/ or any subdirectory)
2. Read .claude/file-cache.json
3. For each candidate file:
   a. Get current charCount: wc -c <file> (or equivalent)
   b. Look up cache entry for that path
   c. If entry missing OR charCount differs → file is CHANGED → scan it
   d. If charCount matches → file is UNCHANGED → skip it
4. After scanning, update entries for all scanned files
5. Write updated cache back to .claude/file-cache.json
```

### Writing (after scan)

After processing a file, update its entry:
```json
{
  "charCount": <current char count>,
  "lastScanned": "<today ISO date>",
  "scannedBy": ["<skill-name>"]
}
```

Merge `scannedBy` — do not overwrite other skills' entries.

---

## Rules

- NEVER delete existing entries — skills may scan on different schedules
- ALWAYS merge `scannedBy` arrays rather than replacing them
- If the file does not exist at the cached path, remove the stale entry
- If `.claude/file-cache.json` is missing, treat all files as CHANGED (first run)
- Skills must handle a missing or malformed cache file gracefully (first-run case)
- Do NOT commit this file — add `.claude/file-cache.json` to `.gitignore`

---

## .gitignore Entry

```
# Claude skill cache — generated, do not commit
.claude/file-cache.json
```
