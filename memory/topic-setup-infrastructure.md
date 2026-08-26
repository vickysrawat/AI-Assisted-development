# Setup & Install Infrastructure

> Consolidated from MEMORY.md auto-capture entries (2026-07-20 to 2026-07-31).
> Dream run: 2026-08-25. Confidence: 0.85 (avg).

---

## Three-Path Hook Architecture

Hooks use a detect-once-at-setup-time pattern (NOT runtime dispatch). `detectShell()` runs in `setup-init-bootstrap.cjs` at provisioning time, stores `shell_type` in dream-init-state.json, and wires direct hook commands (bash->.sh, powershell->.ps1, node->.cjs).

Five standalone .cjs hook files: icea-floor.cjs, memory-capture.cjs, memory-log.cjs, findings-gate-precommit.cjs, graph-stale-detect.cjs (in both .claude/hooks/ and _project-deploy/hooks/).

**detectShell() checks Claude Code settings first:** if 'Bash' or 'Bash(*)' is in permissions.deny, returns 'node' immediately. Pattern-specific denials (e.g. "Bash(rm -rf *)") are NOT treated as full Bash denial.

## Bootstrap Phases

- **Phase 1 (standard):** setup-init-bootstrap.cjs creates dirs, deploys stubs, wires settings, seeds state files
- **Phase 2 (`--mode post-detect --repo-type TYPE`):** triggered by architect skill after repo detection. Pre-copies architecture template files (marker-strip), deploys matching rules via 4-layer frontmatter selection

## stepWireLocalSettings — Scoped Permissions

Writes `permissions.allow` to `settings.local.json` (NOT settings.json — machine-specific, gitignored). Permissions scoped to `{PLUGIN_DIR}/scripts/*.cjs` only — NOT a blanket `node *` wildcard (prompt-injection risk).

**Never broadly auto-allow Write/Edit under .claude/:** `Write(.claude/**)` would un-gate enforcement hooks (icea-floor, secrets guard, script-review) — security regression.

## Hooks Run Via Hook Runner (NOT Bash Tool)

Hook commands execute via Claude Code's hook subsystem, NOT the Bash tool. A hook command like `node .claude/hooks/icea-floor.cjs` NEVER triggers a Bash permission prompt. Do NOT add `Bash(node .claude/hooks/*.cjs)` to settings.local.json — it's inert.

## repo-detect.cjs

Deterministic 12-type detection ladder (exit 0=detected, 1=already-set, 2=AMBIGUOUS, 3=UNKNOWN). Wired as setup-init Step 0.5. Stacks MERGE not overwrite on re-run. LLM fallback on exit 2 (AMBIGUOUS), hard-fail on exit 3.

## Graph Pipeline Decoupling (ADR 0056)

Module derivation extracted to `scripts/module-derive.cjs` (shared skeleton, writes `.module-skeleton.json`). `skills/graph-create/SKILL.md` extracted from architect Step 7 — reads skeleton, LLM classifies type, bash-helper fingerprints, graph-extract-edges.js. Setup-init orchestrates: detection -> module-derive -> architect -> graph-create -> graph-sync (all SEQUENTIAL, single-writer preserved).

## Install Dispatchers

- `install.sh` — dispatcher deferred (mintty hang may just relocate)
- `install.cmd` — for CMD users (Git Bash -> Node -> PowerShell cascade)
- PowerShell flag translation needed: ps1 uses `-Update/-Yes` switches, sh/cjs use `--update/--yes`

**Gotcha:** `where bash` on Windows can resolve to WSL's System32\bash.exe (false positive) — probe `%ProgramFiles%\Git\bin\bash.exe` explicitly.

## Parallel Sub-Agents — ABANDONED

Do NOT retry parallel sub-agents for setup-init without net-new locking+merge infrastructure. Fatal reasons: (1) graph-extract-edges.js requires graph.json nodes (downstream of architect LLM); (2) plugin is single-writer/sequential with no file locking, no atomic manifest, no merge semantics.

## Key Conventions

- `isDone` guards are only for non-idempotent one-shot operations; never guard idempotent settings steps with isDone
- State file is `.claude/dream-init-state.json` — keys `dream_init_plugin_version` / `dream_init_last_run` intentionally NOT renamed (cross-project contract)
- `--shell-type=bash|powershell|node` override flag for AppLocker contexts
- setup-sync reads INSTALLED_VERSION from installed_plugins.json (registry, authoritative) while self-healing plugin-path.txt
