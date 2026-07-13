# 0048 — Node-only runtime; canonical plugin-state.cjs for version resolution
Status: Accepted · Date: 2026-07-07
Governs: `scripts/plugin-state.cjs`, `skills/shared/plugin-path-resolution.md §3`,
`skills/dream-status/SKILL.md`, `skills/plugin-readiness/SKILL.md`,
`commands/session-start.md`, `skills/dream-sync/SKILL.md`, `skills/token-analysis/SKILL.md`

## Problem

Two related failures, both stemming from unreliable runtime dependencies:

**1. Runtime `python3` on a Python-less developer machine.** `dream-status` and
`plugin-readiness` used `python3 -c …` for ~12 runtime status/version reads (file-cache count,
token-graph session count, model freshness, installed version, settings overrides, token
analysis). On Windows developer machines without Python installed, every call silently returned
`UNKNOWN` or `EMPTY_OR_INVALID`. The "Installed: unknown" output from `dream-status` then
caused downstream tools to construct a plugin path from the *state's version* (3.4.0) pointing
at a cache directory that no longer existed, triggering a 3+ minute recursive `find` of
`~/.claude/plugins`.

**2. Relative `.claude-plugin/plugin.json` reads.** Several skills attempted to read the
installed plugin's `plugin.json` as a *relative path* from the current working directory. At
runtime, CWD is the **target project**, which has no `.claude-plugin/plugin.json`. Every such
read returned "unknown" even on machines that do have Python, producing false "no drift" verdicts
that silently skipped upgrades.

## Decision

### Eliminate runtime `python3` from all commands and skills
All runtime `python3 -c` reads in `commands/` and non-hook `skills/` are converted to Node.js.
Conversion discipline:
- One-liner reads → **single-quoted** `node -e '…'` (no backslash/regex → no shell-escaping
  issues from double-quote processing).
- Multi-line / logic-heavy blocks → **quoted heredoc** `node <<'JSEOF' … JSEOF` (zero shell
  interpolation; eliminates the class of regex-mangling bugs that affected gitignore-sync and
  external-dir-map in earlier work).

`hooks/*.py` files (`validate-ledgers.py`, `validate-pr-compliance.py`) **stay Python** — they
are CI gates that run on build agents which have Python, and they are not executed on developer
machines during normal plugin use.

### `scripts/plugin-state.cjs` — single canonical resolver
A node-only, self-locating tool that is the **only** permitted way to determine the installed
plugin version and project drift:

- Resolves installed version + `installPath` from `~/.claude/plugins/installed_plugins.json`
  (the registry, `scope==="user"` preferred). Falls back to a shallow `readdir` of
  `~/.claude/plugins/*/plugins/ai-assisted-development` — **never a recursive `find`**.
- Reads provisioned version from `./.claude/dream-init-state.json` (CWD = target project).
- Computes drift with semantic version comparison (X.Y.Z so `1.10.0 > 1.9.0`):
  `UP_TO_DATE | UPGRADE_PENDING | DOWNGRADE | NO_STATE | INSTALLED_UNKNOWN`.
- Default output: shell-eval-friendly `KEY=value` lines so bash consumers need no JSON parser:
  `INSTALLED_VERSION`, `INSTALL_PATH`, `PROVISIONED_VERSION`, `DRIFT`.
  `--json` and `--field <KEY>` variants also supported. Exit 0 always.
- Uses `os.homedir()`/`path.join` — never a bash-passed `/c/…` MSYS path (Node on Windows
  rejects those).

### Hard rules (codified in `plugin-path-resolution.md §3`)
- **Never** read a *relative* `.claude-plugin/plugin.json` to determine the installed version.
- **Never** build a plugin path from a version string (e.g. `cache/<marketplace>/<plugin>/<ver>`).
- **Never** derive the installed version from `CLAUDE.md`'s version line (that is the version
  when the project was *provisioned*, not what is *installed*).
- **Never** `find` or crawl `~/.claude/plugins`. Use the registry.
- Use `plugin-state.cjs`; do not improvise an inline version lookup.

`dream-sync` Step 1 retains its inline registry resolver (it was already correct) but gains an
**early version stamp**: immediately after resolving `INSTALLED_VERSION` from the registry, it
writes that value to `dream-init-state.json` *before* any deployment steps. This prevents a
partial-run or interrupted sync from leaving the state at a stale version.

## Rationale

- **No hidden Python dependency:** Node.js is already required by the plugin (bootstrap script,
  external-dir-map, gitignore-sync, graph-extract-edges). Adding `python3` as a second runtime
  dependency is unnecessary and silently breaks a large class of machines.
- **Single source of truth for version:** `installed_plugins.json` is written by the Claude Code
  CLI and is always authoritative. Reading it once in a dedicated tool eliminates three different
  ad-hoc inline lookups and the bugs they caused.
- **Recursive `find` performance:** `find ~/.claude/plugins …` walks the entire cache including
  all historical versioned dirs. On machines with many installs this took 3+ minutes. O(1)
  registry read replaces it.

## Consequences

- New `scripts/plugin-state.cjs` (~80 lines, Node stdlib only).
- `skills/dream-status/SKILL.md` §1r, §1g, §1h, §1k, §1l, §1m converted to node.
  `plugin-readiness/SKILL.md` plugin-version, model-overrides, and token-analysis reads converted.
- `commands/session-start.md` drift check uses the tool; emits `PLUGIN_DRIFT:` advisory.
- `skills/token-analysis/SKILL.md` §2d scan scoped to resolved `PLUGIN_DIR` instead of all
  of `~/.claude/plugins`.
- `dream-sync` Step 1 gains the early-stamp resilience guard.
- `tests/validate.py` is unaffected (the tool is in `scripts/`, not in `components`).

## Revisit when

The Claude Code CLI exposes a first-class `claude plugin state` command that returns version and
drift information — then `plugin-state.cjs` becomes a thin wrapper or is retired entirely.
