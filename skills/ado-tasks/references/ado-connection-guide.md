# ADO Connection Guide — ado-tasks skill

## Required curl flags on the Kirkland network

**Always use both flags. Omitting either causes a silent failure.**

```bash
curl -s --ssl-no-revoke -4 \
  -H "Authorization: Basic $AUTH" \
  "https://dev.azure.com/..."
```

| Flag | Why it's required |
|------|-------------------|
| `--ssl-no-revoke` | The corporate proxy blocks certificate revocation checks (`CRYPT_E_NO_REVOCATION_CHECK`). Without this flag, curl exits with code 35 and an empty response body — no error is shown unless you run with `-v`. |
| `-4` | IPv6 is unreachable through the proxy (`Network unreachable` on `[2603:...]`). curl tries IPv6 first, fails, and only falls back to IPv4 after a timeout. This flag skips IPv6 entirely. |

### Diagnosing a failed connection

If the response is empty (exit code 0, length 0) or curl exits non-zero:

```bash
# Add -v to see the full handshake
curl -v --ssl-no-revoke -4 \
  -H "Authorization: Basic $AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/wit/workitems/{id}?api-version=7.1"
```

Common failure signatures and fixes:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `CRYPT_E_NO_REVOCATION_CHECK` | Missing `--ssl-no-revoke` | Add the flag |
| `Network unreachable` on `[IPv6]` | Missing `-4` | Add the flag |
| Exit 0, empty body | Both of the above | Add both flags |
| HTTP 401 | PAT expired or wrong scopes | Rotate PAT (see below) |
| HTTP 403 | PAT has insufficient scopes | Regenerate with correct scopes |
| `python was not found` | Python not installed / aliased to Store | Use Node.js for JSON parsing (see below) |

---

## PAT storage — safest to least safe

| Option | How | Notes |
|--------|-----|-------|
| **A — Windows User Environment Variable** | Win+S → "environment variables" → User variables → New → `AZURE_DEVOPS_PAT` | Survives restarts, never touches the repo. **Recommended for all developers.** |
| **B — `.claude/settings.json`** | `{ "env": { "AZURE_DEVOPS_PAT": "..." } }` | Only if this file is in `.gitignore`. Run `dream-status` to verify. |
| **C — Paste at prompt** | Entered when the skill asks | Emergency use only. PAT exists only for the current tool call. |

**Never** put the raw PAT in a bash command that appears in a transcript or history.
Build the auth header once:

```bash
AUTH=$(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)
unset AZURE_DEVOPS_PAT   # scrub from environment immediately
```

Then reference `$AUTH` in all subsequent curl calls.

### If a PAT was exposed

Rotate it immediately:
1. Open `https://dev.azure.com/kirklandandellis/_usersSettings/tokens`
2. Find the token → Revoke
3. Create a new token with the minimum required scopes
4. Update your environment variable / settings.json

---

## Required PAT scopes

| Operation | Scope needed |
|-----------|-------------|
| Read work items (fetch, query) | Work Items → Read |
| Create tasks in ADO | Work Items → Read & Write |
| Read PRs | Code → Read |
| Create PRs | Code → Read & Write |

Generate a PAT at: `https://dev.azure.com/kirklandandellis/_usersSettings/tokens`
Select **Custom defined** → choose only the scopes you need.

---

## JSON parsing — use Node.js, not Python

Python may not be available on Windows developer machines (the `python` command
may launch the Microsoft Store instead of running). Always parse ADO API responses
with Node.js:

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/wit/workitems/{id}?api-version=7.1" \
| node -e "
const chunks=[]; process.stdin.on('data',c=>chunks.push(c)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(chunks));
  const f=d.fields;
  const strip=s=>(s||'').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&quot;/g,'\"')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
    .replace(/\s+/g,' ').trim();
  console.log('Title :', f['System.Title']);
  console.log('State :', f['System.State']);
  console.log('');
  console.log('Description:');
  console.log(strip(f['System.Description']));
  console.log('');
  console.log('Acceptance Criteria:');
  console.log(strip(f['Microsoft.VSTS.Common.AcceptanceCriteria']));
});"
```

---

## Persistent helper script (optional)

For teams running `ado-tasks` frequently, deploy the `ado.sh` helper:

```bash
# One-time setup
cp tools/ado-helper/.env.template tools/ado-helper/.env
# Edit .env: set ADO_ORG, ADO_PROJECT, ADO_PAT

# Each session
source tools/ado-helper/ado.sh

# Then use
ado_get_item 81469
ado_raw 81469 | node -e "..."
```

The helper bakes in `--ssl-no-revoke -4`, scrubs the PAT immediately after
building the auth header, and exposes typed functions instead of raw curl calls.
See `tools/ado-helper/README.md` for full documentation.
