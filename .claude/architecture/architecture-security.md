# Architecture — Security

_Generated: 2026-07-13_

## Trust Boundaries / Zones

This plugin runs entirely on the developer's local machine within the Claude Code process.
There is no server, no public endpoint, and no network-accessible surface.

| Zone | Trust level | Notes |
|---|---|---|
| Local machine (Claude Code process) | Trusted | Plugin code runs here; has filesystem access to the project |
| Azure DevOps API | External — trusted with credentials | Accessed via PAT; corporate proxy enforces SSL inspection |
| OWASP ZAP (Docker) | Local — trusted | Runs in a local Docker container; no external exposure |
| Developer's filesystem | Trusted | Plugin reads/writes `.claude/`, `memory/`, project source files |

## Authorization Model

The plugin enforces two authorization layers:

| Gate | Mechanism | Enforced at | What it blocks |
|---|---|---|---|
| ICEA feature gate | `icea-floor.sh` PreToolUse hook | Write-time (every file write) | Source/config file writes until `APPROVE ADO-{ID}` received |
| Secret guard | `check-settings-secrets.cjs` PreToolUse hook | Write-time + commit-time (pre-commit) | Secrets reaching the committed `settings.json` |
| Findings gate | `findings-gate-precommit.sh` | Commit-time (pre-commit hook) | Commits with open Critical/High findings in any ledger |
| Ledger dismiss workflow | `/dismiss FP-xxxxxxxx` | Skill invocation | Re-surfaces dismissed findings if code at that location changes |

## Secrets Handling

| Secret | Storage | How accessed | Risk |
|---|---|---|---|
| `AZURE_DEVOPS_PAT` | Windows User Environment Variable (preferred) or `settings.local.json` (gitignored) | Read at skill runtime via `$AZURE_DEVOPS_PAT` | High if committed — `check-settings-secrets.cjs` blocks it at write-time and commit-time |

**Never stored:**
- In `.claude/settings.json` (committed, team-shared — guard blocks it)
- In skill/command files
- In `CLAUDE.md` or any committed file

**PAT handling pattern:**
```bash
AUTH=$(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)
# use AUTH in Authorization header
unset AUTH  # immediately clear from memory
```

## Business Rules Gating Actions

| Action | Gate | Enforced at |
|---|---|---|
| Write source/config files for a new feature | `icea-floor.sh` — checks for approved ICEA | Every file write (PreToolUse hook) |
| Commit with open security findings | `findings-gate-precommit.sh` | git commit |
| Commit a PAT or secret to `settings.json` | `check-settings-secrets.cjs` | Write-time + git commit |
| Generate implementation code | ICEA Feature Gate in CLAUDE.md | Model instruction (LLM-enforced) |

## Sensitive Data Handling

| Data | Where rendered | Protection |
|---|---|---|
| Source code excerpts | In Claude context (never written to external service by plugin) | Subject to Anthropic API data handling; no plugin-side logging |
| ADO PAT | Environment variable only | `check-settings-secrets.cjs` blocks any write to committed files |
| DAST scan credentials | `dynamic-scan/*.session`/`*.context` files (local) | Gitignored by managed block — never committed |
| Work item / PR data from ADO | In Claude context during skill execution | Not persisted by the plugin beyond the session |

## Known Security Notes

- `icea-floor.sh` has **two copies**: `.claude/hooks/icea-floor.sh` (active) and
  `_project-deploy/hooks/icea-floor.sh` (deploy-source). Both must be kept identical.
  `.claude/hooks/.hashes` tracks SHA256 of the deploy-source. Drift between copies = latent
  regression on next `/setup-sync` (which overwrites the active copy from the source).
- The plugin does not implement rate limiting, audit logging, or access control beyond the
  developer's local machine permissions — it is a local development tool, not a production service.
