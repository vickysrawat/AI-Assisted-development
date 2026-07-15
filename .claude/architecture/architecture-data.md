# Architecture — Data Model (Exported Types & State)

_Generated: 2026-07-13_

The plugin has no database. Persistent state is stored as flat files within two locations:
the **plugin installation dir** (plugin metadata, templates, scripts) and the **target project**
(state files written by bootstrap + runtime).

## Plugin-Side State Files

| File | Owner | Contents |
|---|---|---|
| `.claude-plugin/plugin.json` | Plugin repo | Authoritative metadata: version, commands[], skills[], rules[], recommended_models |
| `skills/<name>/SKILL.md` | Plugin repo | Full skill instruction sets (loaded at runtime by Claude Code) |
| `skills/architect/templates/<stack>/*.md` | Plugin repo | Architecture doc templates (8 per stack, composed from `_shared/` + stack-specific) |
| `skills/architect/prompts/<stack>.md` | Plugin repo | Per-stack prompts for Files 1–7 |

## Target-Project State Files (written by bootstrap)

| File | Written by | Contents |
|---|---|---|
| `.claude/dream-init-state.json` | `setup-init-bootstrap.cjs` | `dream_init_plugin_version`, `repo_type`, `deployed_rules[]`, `external_dir_snapshot` |
| `.claude/_bootstrap-manifest.json` | `setup-init-bootstrap.cjs` | Step completion state; `needsLLMPopulation[]` tracks pending LLM tasks |
| `.claude/file-cache.json` | `code-review` skill | SHA fingerprints for reviewed files (cache-aware re-scan) |
| `.claude/plugin-path.txt` | bootstrap `writePluginPath` | Absolute path to plugin installation dir (read by skills at runtime) |
| `.claude/settings.json` | bootstrap `wireSettings` | Hooks wiring, `customInstructions`, model-routing env, `autoMemoryEnabled: false` |
| `.claude/settings.local.json` | Developer (gitignored) | `AZURE_DEVOPS_PAT`, machine-specific `permissions` |
| `.claude/hooks/.hashes` | bootstrap `deployHooks` | SHA256 of each hook deploy-source (for drift detection on sync) |
| `memory/MEMORY.md` | Dream / memory-capture hook | Manual override inbox + auto-capture entries |
| `memory/dream-log.md` | `/dream` skill | Append-only audit trail of consolidation runs |
| `memory/topic-*.md` | `/dream` skill | Promoted topic files (per-topic memory) |
| `token-analysis/token-graph.json` | bootstrap | Persistent token consumption graph cache |

## Finding Ledgers (target project, committed)

| File | Written by | Contents |
|---|---|---|
| `CodeReviews/code-review-ledger.md` | `/code-review` | FP-fingerprinted findings; fixed/dismissed/open status |
| `security/security-ledger.md` | `/security-review` | OWASP/CWE findings with fingerprints |
| `dynamic-scan/dynamic-scan-ledger.md` | `/dynamic-scan` | DAST findings with fingerprints |

Ledgers are **committed and PR-reviewed** (not gitignored) — they are the durable record of
security posture. Dated HTML/JSON reports in the same dirs are gitignored.

## Knowledge Graph (target project, committed)

| File | Schema | Contents |
|---|---|---|
| `.claude/graph/graph.json` | `skills/shared/graph-json-schema.md` | Typed nodes, typed edges (EXTRACTED/INFERRED/AMBIGUOUS), module-wide fingerprints, `directoryCatalog` |
| `.claude/graph/graph-index.md` | `skills/shared/graph-index-schema.md` | Always-loaded breadth index: module → entry point |
| `.claude/graph/<module>.md` | `skills/shared/graph-module-schema.md` | Per-module depth files (≤400 tokens, auto-loads via `paths:` frontmatter) |

## Key Data Shapes

**`dream-init-state.json`** keys:
- `dream_init_plugin_version` — version that provisioned this project (NOT renamed — cross-project contract)
- `dream_init_last_run` — timestamp of last bootstrap run
- `repo_type` — detected stack (e.g. `JS_LIBRARY`, `DOTNET_API`)
- `deployed_rules[]` — list of rule filenames deployed by Phase 2
- `detected_stacks[]` — stack tokens from the primary repo (e.g. `["angular","nodejs"]`). Tokens: `dotnet` (modern .NET Core/5+/10), `dotnet_framework` (legacy .NET Framework 4.x — System.Web or WCF), `angular`, `nodejs`, `java`, `python`. Used by rules deployment and icea-feature overlay selection.
- `external_detected_stacks[]` — stack tokens from `additionalDirectories` repos, written by `scripts/external-stack-detection.cjs`. Same token set as `detected_stacks`. `dotnet` and `dotnet_framework` are mutually exclusive. Default `[]`.
- `external_stacks_prompted` — boolean; set to `true` once the user has been shown the external-repo question in setup-init or setup-sync. Prevents re-prompting. Default `false`.

**`_bootstrap-manifest.json`** key structure:
- `status`: `complete` | `partial` | `failed`
- `needsLLMPopulation[]`: `{id, order, skill, status, description}` — resume checkpoint
- `operations`: per-step completion records
- `warnings[]`: non-fatal issues surfaced to the developer

**`graph.json`** key structure (per ADR 0041):
- `nodes[]`: `{id, module, domain, type, entryPoint, paths[], fingerprint, hub}`
- `edges[]`: `{from, to, type: EXTRACTED|INFERRED|AMBIGUOUS, confidence}`
- `directoryCatalog`: `{staticServing[], config[], test[], reviewed}`
