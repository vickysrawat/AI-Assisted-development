# MEMORY.md — manual override inbox

> Sessions are now the primary memory source.
> /dream reads your Claude Code conversations directly via conversation_search.
> You do not need to write here manually.
>
> This file is for EXCEPTIONS ONLY:
> - Things Claude should remember that didn't arise naturally in a session
> - Explicit corrections you want to force into memory immediately
> - Context that exists outside Claude Code (e.g. from a document or meeting)
>
> Auto-capture writes here automatically at trigger points (see CLAUDE.md).
> /dream will process and clear entries after each run.

---

## When to write here manually

Only write here if:
1. You have knowledge that Claude Code sessions won't contain
2. You want to guarantee something is captured before the next /dream run
3. You need to correct something that is already in topic-*.md files

For everything else — just work normally. /dream will find it in sessions.

---

## Format for manual entries

```
### [manual] YYYY-MM-DD — <topic>
<what Claude should know>
Source: <where this came from>
Priority: normal | high | urgent
```

For urgent corrections (do not retry / critical failures):
Use `Priority: urgent` — these get fast-tracked to CLAUDE.md
without waiting for the normal Tier 3 review.

---

## Auto-capture entries

Claude writes below automatically at trigger points.
These are processed and removed by /dream each run.

<!-- Auto-capture entries appear below this line -->

### [manual] 2026-06-09 — ADO curl flags required on the corporate network
All ADO REST API calls must use `--ssl-no-revoke -4` on every curl invocation.
`--ssl-no-revoke` is required because the corporate proxy blocks certificate
revocation checks (CRYPT_E_NO_REVOCATION_CHECK), causing curl to exit with
code 35 and an empty response body. `-4` is required because IPv6 is
unreachable through the proxy — curl attempts IPv6 first, fails silently, and
wastes time before falling back. Omitting either flag causes silent failures
that are hard to diagnose. This was discovered during ADO-81469 implementation
when multiple connection attempts failed before the root cause was identified.
The fix is now baked into all plugin skills and the ado.sh helper.
Additionally: always use `Authorization: Basic $AUTH` header (PAT pre-encoded
via `printf ':%s' "$PAT" | base64 -w 0` then immediately unset) — never
`-u ":$AZURE_DEVOPS_PAT"` which exposes the raw PAT in shell history. Always
use Node.js for JSON parsing, not python3 — Python may launch the Microsoft
Store on Windows instead of running.
Source: Live failure during ADO-81469 session, 2026-06-09
Priority: high

### [manual] 2026-06-09 — Azure CLI auth not viable; PAT is the correct approach
Azure CLI background calls (`az account get-access-token`) are blocked on the
corporate network/environment. This means the preferred Entra ID token flow
cannot be used as a replacement for PAT-based ADO authentication in Claude Code
skills. PAT stored in AZURE_DEVOPS_PAT environment variable (Windows User
Environment Variable, Option A) remains the correct and only supported auth
method for all ADO REST API calls in this plugin. Do not suggest Azure CLI
auth or Bearer token flows as an improvement — they will not work. If this
restriction is ever lifted, revisit by checking whether `az account show`
succeeds in a Claude Code bash tool call.
Source: Developer confirmation, 2026-06-09
Priority: high
