# ADO & Corporate Environment

> Consolidated from MEMORY.md manual entries (2026-06-09).
> Dream run: 2026-08-25. Confidence: 0.90 (high priority, manually entered).

---

## ADO REST API — Required Curl Flags

All ADO REST API calls MUST use `--ssl-no-revoke -4` on every curl invocation:

- `--ssl-no-revoke` — corporate proxy blocks certificate revocation checks (CRYPT_E_NO_REVOCATION_CHECK), causing curl exit code 35 + empty response body
- `-4` — IPv6 unreachable through proxy; curl attempts IPv6 first, fails silently, wastes time

Omitting either flag causes silent failures that are hard to diagnose.

## Authentication — PAT Only

Azure CLI background calls (`az account get-access-token`) are BLOCKED on the corporate network. PAT stored in `AZURE_DEVOPS_PAT` environment variable (Windows User Environment Variable) is the ONLY supported auth method. Do NOT suggest Azure CLI auth or Bearer token flows.

## Authorization Header Pattern

Always use `Authorization: Basic $AUTH` header with PAT pre-encoded:
```bash
printf ':%s' "$PAT" | base64 -w 0
```
Then immediately unset. Never use `-u ":$AZURE_DEVOPS_PAT"` (exposes raw PAT in shell history).

## JSON Parsing

Always use Node.js for JSON parsing, NOT python3. Python may launch the Microsoft Store on Windows instead of running.
