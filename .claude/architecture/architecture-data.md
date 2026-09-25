# Architecture — Data Model

> Load this file when adding or changing a state file, JSON schema, or data structure,
> or when reasoning about data ownership between plugin components.

## Persistent State (file-based — no database)

This plugin has no database. All state is stored as JSON files in the target project's `.claude/` directory or the plugin's `~/.claude/plugins/` cache directory.

## Key State Files & Schemas

### `.claude/dream-init-state.json` — Provisioning State

Owner: `setup-init-bootstrap.cjs` (writes), `repo-detect.cjs` (merges `repo_type` + `detected_stacks`)

| Field | Type | Purpose |
|---|---|---|
| `repo_type` | string | Detected repo classification (e.g. `PYTHON_FASTAPI`, `DOTNET_API`) |
| `detected_stacks` | string[] | Stack keys detected (e.g. `["dotnet", "angular"]`) |
| `shell_type` | string | `"bash"` or `"node"` — available shell for Bash tool |
| `dream_init_plugin_version` | string | Plugin version that provisioned this project |
| `external_stacks_prompted` | boolean | Guard against re-prompting external repo discovery |
| `domain` | string | Business domain (set by `SET DOMAIN`) |
| `generations` | object | Per-language runtime generation info (confidence, version, evidence) |

### `.claude/graph/graph.json` — Knowledge Graph

Owner: `graph-create` skill (initial), `graph-sync` skill (refinement)

| Field | Type | Purpose |
|---|---|---|
| `nodes` | Node[] | Modules with `id`, `type`, `domain`, `path`, `fingerprint` |
| `edges` | Edge[] | Typed edges with `from`, `to`, `type` (`EXTRACTED`/`INFERRED`/`MANUAL`), `confidence` |
| `meta.generated` | string | ISO timestamp of last generation |
| `meta.structure` | string | `"flat"` or `"domain"` |

### `.claude/file-cache.json` — Scanner Cache

Owner: `code-review`, `security-review` skills

| Field | Type | Purpose |
|---|---|---|
| `files` | Record<path, hash> | SHA fingerprint per file — skip-unchanged-files optimisation |
| `lastRun` | string | ISO timestamp of last scan |

### `plugin-manifest.json` — Marketplace Manifest

Owner: `scripts/release.cjs`

| Field | Type | Purpose |
|---|---|---|
| `latest` | string | Current latest version |
| `versions` | Record<version, VersionEntry> | Per-version install URLs and checksums |

### `.claude-plugin/plugin.json` — Plugin Identity

Owner: `scripts/release.cjs` (version bump), `scripts/setup-init-bootstrap.cjs` (reads)

| Field | Type | Purpose |
|---|---|---|
| `name` | string | `"ai-assisted-development"` |
| `version` | string | Single-source version (must match tag + plugin-manifest.json) |
| `recommended_models` | object | generation / review / infrastructure model IDs |
| `components` | object | Command and skill lists for marketplace registration |

## Data Access Patterns

All state reads/writes use `fs.readFileSync` / `fs.writeFileSync` (synchronous, Node.js stdlib). Writes are atomic where possible: write to `.tmp` file, then `fs.rename()` to final path.

> ⚠ `fs.rename()` fails across filesystem boundaries on Windows/OneDrive — the workaround is to `fs.writeFileSync()` and then `fs.unlinkSync()` the `.tmp` manually when rename throws EPERM.

## Data Ownership

| Data | Owner (system of record) | Consumers |
|---|---|---|
| `repo_type`, `detected_stacks` | `repo-detect.cjs` | All skills that route by stack |
| `graph.json` | `graph-create` / `graph-sync` | `explain`, `icea-feature`, `update-arch`, `code-review` |
| `file-cache.json` | `code-review`, `security` | Same skills (cache reader + writer) |
| `dream-init-state.json` | `setup-init-bootstrap.cjs` | All setup and provisioning skills |
| `plugin-manifest.json` | `release.cjs` | `install.cjs`, marketplace |
| ICEA docs (`docs/`) | `icea-feature` skill | `icea-approve`, `icea-implement`, `icea-review` |
| Memory (`memory/MEMORY.md`) | Dream skill | All skills (append-only during sessions) |
| Audit trail (`.claude/audit/`) | `audit-write.cjs` | `governance-report.cjs` |
