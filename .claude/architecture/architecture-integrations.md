# Architecture — Integrations & External Dependencies

> Load this file when adding or changing a call to an external system, or when
> reasoning about failure behavior, timeouts, and resilience.

## External Dependencies

| Name | Kind | Where called from | Auth | Notes |
|---|---|---|---|---|
| Azure DevOps REST API | REST | `pr-create`, `sprint-metrics`, `ado-tasks` skills | PAT via `AZURE_DEVOPS_PAT` env var | Optional — skills degrade gracefully when PAT absent |
| Claude API (Anthropic) | SDK / REST | Claude Code harness (not called by plugin scripts directly) | Managed by Claude Code | Plugin skills are instructions; Claude Code routes to the model |
| Local marketplace | HTTPS (read) | `install.cjs` | None (public) | Fetches `plugin-manifest.json` + versioned plugin zip |
| `~/.claude/plugins/installed_plugins.json` | Local file | `scripts/plugin-state.cjs`, §1a resolver | None | Registry of installed plugins — read by every skill at startup |
| GitHub gitignore templates | HTTPS (read) | `setup-init-bootstrap.cjs` (Pass 2) | None (public) | `raw.githubusercontent.com/github/gitignore/main/*.gitignore` |
| OWASP ZAP | Docker (local) | `dynamic-scan` skill | None | Requires Docker Desktop running locally |
| `dotnet new gitignore` CLI | Local process | `setup-init-bootstrap.cjs` | None | Used for .NET stack gitignore generation |

## Resilience & Failure Behaviour

| Dependency | On failure — what happens |
|---|---|
| Azure DevOps REST API | Skills print a warning and continue; no writes to ADO state from the plugin side fail silently — the developer is told to provide the PAT or submit the PR manually |
| Marketplace HTTPS fetch | `install.cjs` fails with a clear error message; no partial state written |
| GitHub gitignore fetch | `setup-init-bootstrap.cjs` falls back to offline templates in `$PLUGIN_DIR/skills/gitignore-sync/stacks/{stack}.gitignore` |
| OWASP ZAP / Docker | `dynamic-scan` skill detects Docker unavailability and exits with instructions |
| `installed_plugins.json` | `plugin-state.cjs` returns `INSTALLED_UNKNOWN` drift status; skills that depend on version checking warn but continue |

> ⚠ Timeout values for ADO REST calls are not configured in plugin source — they depend on the http client defaults used within Claude Code's internals (skills call ADO via Claude, not via a plugin-owned http client).

## Data Crossing Boundaries

| Boundary | Data sent outbound |
|---|---|
| Azure DevOps REST API | PR description, work item IDs, test results — developer-controlled |
| Claude API | Skill prompts + codebase excerpts (per consent model in `skills/shared/source-file-consent.md`) |
| OWASP ZAP | HTTP requests replayed against the running local/staging app URL |
| Marketplace | None (read-only download) |
