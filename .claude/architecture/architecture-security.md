# Architecture — Security

> Load this file when adding a hook, permission rule, or secret-handling path,
> or when running a security review of the plugin itself.

## Trust Boundaries / Zones

| Boundary | What crosses it | Validated at |
|---|---|---|
| Skill → Script | Bash tool call with node script path | Claude Code permission system (settings.json `permissions.allow`) |
| Script → Filesystem | Read/write to `.claude/`, `memory/`, `docs/`, project source | Plugin has no sandboxing beyond OS permissions |
| Script → Network | ADO REST API calls (via Claude, not scripts), marketplace fetch (install.cjs only) | PAT env var; no plugin-level credential validation |
| Script → Git | Pre-commit hook runs plugin validation scripts | Hook is installed but can be bypassed with `--no-verify` (flagged in onboarding) |
| Developer → Claude Code | All prompts and APPROVE responses | ICEA floor hook (`icea-floor.sh`) enforces feature gate; secret-guard hook scans for secrets |

## Authorization Model

This plugin is a local developer tool — there are no users, roles, or API authorization. The "authorization model" is the **enforcement hooks**:

| Hook | File | Enforced-at | Purpose |
|---|---|---|---|
| ICEA floor | `.claude/hooks/icea-floor.sh` | Every file write (PreToolUse) | Blocks writes to source/config files without an approved ICEA |
| Secret guard | `.claude/hooks/secret-guard.sh` | Every file write (PreToolUse) | Scans for secrets (PATs, keys, connection strings) in `.claude/settings.json` |
| Script review gate | `.claude/hooks/script-review-gate.sh` | Every Bash call (PreToolUse) | Blocks plugin scripts that are not on the allow-list |
| Context budget (tech write) | `.claude/hooks/context-budget-tech-write.sh` | Tech Spec writes | Enforces CLAUDE.md context budget limits |
| Memory capture | `.claude/hooks/memory-capture.sh` | Every session turn (UserPromptSubmit) | Prompts Claude to write memory at trigger points |
| Audit prompt | `.claude/hooks/audit-prompt.sh` | Every session turn (UserPromptSubmit) | Ensures ICEA-gated actions are audited |
| Memory log | `.claude/hooks/memory-log.sh` | Post-tool-use (PostToolUse) | Logs memory writes |

## Secrets Handling

- **`AZURE_DEVOPS_PAT`**: stored in developer's shell environment or `.claude/settings.local.json` (gitignored). The secret-guard hook blocks any write of a PAT into `.claude/settings.json` (committed/shared).
- **No secrets in plugin source**: all plugin scripts use environment variables; no credentials are hardcoded.
- **`npm audit`** runs in CI on every push — fails on high/critical CVEs in dependencies.

## Sensitive Data Handling

This plugin processes **developer codebase excerpts** (Category B, per `skills/shared/source-file-consent.md`). Claude reads source files only after announcing the files and obtaining consent. No codebase content is written to plugin state files — only metadata (fingerprints, module names, graph edges).

> ⚠ The plugin does not enforce data residency for the Claude API path — codebase excerpts sent to the model are subject to Anthropic's data handling policies.
