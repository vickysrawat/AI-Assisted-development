# Architecture — Integrations & External Dependencies

_Generated: 2026-07-13_

## External Dependencies

| Name | Kind | Contract / Endpoint | Called from | Auth |
|---|---|---|---|---|
| Azure DevOps REST API | REST | `https://dev.azure.com/{org}/{project}/_apis/...` | `sprint-metrics`, `pr-create`, `icea-status`, `ado-tasks` skills | Basic auth — PAT pre-encoded via `printf ':%s' "$PAT" | base64 -w 0`; stored in `AZURE_DEVOPS_PAT` env var |
| OWASP ZAP | Docker SDK | `localhost` Docker socket | `dynamic-scan` skill | None (local Docker) |
| Claude AI API (Anthropic) | SDK | Anthropic API endpoint | All skills (via Claude Code runtime) | Claude Code session credentials |

## ADO REST API

**curl flags required** (corporate network constraint, see `memory/MEMORY.md`):
- `--ssl-no-revoke` — corporate proxy blocks certificate revocation checks (CRYPT_E_NO_REVOCATION_CHECK)
- `-4` — IPv6 is unreachable through the proxy; forces IPv4

**Auth pattern:**
```bash
AUTH=$(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)
curl --ssl-no-revoke -4 -H "Authorization: Basic $AUTH" ...
unset AUTH
```
Never use `-u ":$AZURE_DEVOPS_PAT"` — exposes PAT in shell history.

**JSON parsing:** always Node.js (`node -e "..."`) — never `python3` (may launch Microsoft Store on Windows).

## Resilience & Failure Behavior

| Dependency | Timeout | Retry | On failure — what the developer sees |
|---|---|---|---|
| Azure DevOps REST API | > ⚠ Could not determine — needs manual input | None (single attempt per skill invocation) | curl exits non-zero; skill reports error and stops |
| OWASP ZAP Docker | > ⚠ Could not determine — needs manual input | None | `dynamic-scan` skill reports Docker not available |
| Claude AI API | Managed by Claude Code runtime | Managed by Claude Code runtime | Claude Code surfaces timeout/error to developer |

## Data Exchanged

| Integration | Data sent | Data received | Sensitivity |
|---|---|---|---|
| ADO REST API | Work item IDs, PR details, sprint dates | Work item fields, PR status, task lists | Low — no PII; work item titles may contain internal project names |
| OWASP ZAP | Target URL, scan scope, auth config | Vulnerability report (DAST findings) | Medium — auth credentials in scan config; never commit `.session`/`.context` files |
| Claude AI API | Skill prompts + source file excerpts | Generated text (ICEA, code, reviews) | Medium — source code and architecture details; subject to Anthropic's data handling policies |

## SLA / Ownership

> ⚠ Could not determine — needs manual input

No SLA defined (local developer tool, not a production service).
