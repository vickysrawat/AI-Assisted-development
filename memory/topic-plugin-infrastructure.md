# Plugin Infrastructure

> Consolidated from MEMORY.md auto-capture entries (2026-07-10 to 2026-08-25).
> Dream run: 2026-08-25. Confidence: 0.88 (avg).

---

## settings.json — Committed and Guarded (v3.12.0)

`settings.json` is now committed (hooks + customInstructions + non-secret env). Secrets and permissions go to gitignored `settings.local.json`. Claude Code merges local OVER project settings.

**Secret guard (3-tier):**
1. `check-settings-secrets.cjs` PreToolUse hook (`--hook` mode) — blocks at write-time
2. `findings-gate-precommit.sh` extended with `--staged` mode — blocks at commit-time
3. Detector modes: `--hook` (PreToolUse JSON stdin), `--staged` (git show), `--file` (direct)
4. Signals: secret-shaped KEY regex + secret-shaped VALUE patterns (ADO 52-char, ghp_, AKIA, JWT, PEM). Allows placeholders/`${...}`/`*_MODEL`.

**Gotcha:** gitignore negation form is mandatory — ignoring a whole dir blocks re-including a file. Use `dir/*` + `!dir/<ledger>.md`.

## autoMemoryEnabled Disabled (v3.11.0)

Claude Code's built-in auto-memory is ON by default and diverts captures to `~/.claude/projects/<slug>/memory/` (wrong target). Fix: `stepWireSettings()` sets `autoMemoryEnabled: false` in `.claude/settings.json`. Runs on both init and sync.

**Gotcha:** `isDone` guard on `stepWireSettings` caused the function to skip on resume — removed. Function is fully idempotent, safe to re-run every time.

## _project-deploy/CLAUDE.md — Deployment Template

Explicit separation: `_project-deploy/CLAUDE.md` = pure template for target projects; root `CLAUDE.md` = plugin dev session config. Bootstrap reads `_project-deploy/CLAUDE.md` first (falls back to root for older installs).

## Command File Convention

`<skill>` tags in `.claude/commands/*.md` must use fully-qualified names: `<skill>ai-assisted-development:skill-name</skill>`. Unqualified names silently fail in target project sessions ("Unknown skill"). The `<command>` tag is NOT recognized by Claude Code's command processor for skill dispatch.

## Version Bumping Convention

`node scripts/bump-version.js X.Y.Z` propagates ONLY to:
- `.claude-plugin/plugin.json` "version" (single source of truth)
- Root CLAUDE.md `# Plugin version:` label
- CHANGELOG.md stub

NOT auto-bumped (must hand-edit): `_project-deploy/CLAUDE.md` version line, README.md badge, HTML guide stamps, new `docs/migrations/NNN-X.Y.Z.md`. No migration doc needed for prose/doc-only releases.

## HTML Guide Update Gotchas

- icea-floor.sh guards `*.html` — root-level guides need explicit exemptions
- Hook has TWO copies + hash record: `.claude/hooks/` (active) vs `_project-deploy/hooks/` (deploy-source, canonical). When editing: update BOTH + re-stamp `.hashes` (sha256 of deploy-source)
- HTML guides have their own version contract (ADR 0022)

## ICEA Path Convention (2026-08-25)

Canonical ICEA location: `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-{feature}.icea.md`. Found via `find docs -name "ADO-${ID}-*.icea.md" 2>/dev/null | head -1`. The flat `docs/icea/ADO-{ID}-*.md` path is dead legacy.

Bug specs use extension `ADO-{ID}-bug.bugspec.md` (NOT `.icea.md`) to prevent ICEA finder mis-picks.

## Test Infrastructure

- `tests/validate.js` — offline structural gate (no API needed). The release gate.
- `tests/runner.js` — behavioral tests, requires `ANTHROPIC_API_KEY` + live API calls. YAML `contains:`/`not_contains:` MUST use block form (indented `- "x"` lines) — inline arrays are silently dropped.
- `node scripts/check-version-consistency.js` — drift guard

## dream-* to setup-* Rename (v3.8.0)

Lifecycle commands renamed: dream-init -> setup-init, dream-sync -> setup-sync, dream-teardown -> setup-teardown, dream-status -> setup-status. State file/keys intentionally kept as `dream-init-state.json` / `dream_init_*` (cross-project contract).
