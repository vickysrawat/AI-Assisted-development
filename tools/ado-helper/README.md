# ADO Helper

Safe, reusable shell helper for Azure DevOps API calls.

## First-time setup

```bash
cd ado-helper
cp .env.template .env
# Edit .env and paste your PAT — file stays local, never committed
```

## Daily use

```bash
# Load the helper into your current shell session
source ado.sh

# Fetch and pretty-print any work item
ado_get_item 81469

# Fetch with relations (linked items, attachments)
ado_get_item 81469 relations

# Get raw JSON (pipe to node/jq for custom parsing)
ado_raw 81469 | node -e "..."
```

## What it solves

| Problem from original session | Fix |
|---|---|
| PAT visible in bash history and transcripts | PAT loaded once from `.env`, immediately unset from memory |
| `CRYPT_E_NO_REVOCATION_CHECK` SSL error | `--ssl-no-revoke` baked into every curl call |
| IPv6 "Network unreachable" on corporate proxy | `-4` forces IPv4 on every call |
| Repeated boilerplate auth setup | `source ado.sh` sets everything once per session |

## PAT rotation reminder

PATs should be scoped to **Work Items (Read)** only for read operations.
Rotate immediately if a PAT appears in any log or transcript.
Revoke at: https://dev.azure.com/<your-org>/_usersSettings/tokens  (your org is in CLAUDE.md §2 / .claude-plugin/config.json)
