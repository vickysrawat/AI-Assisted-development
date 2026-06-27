# ADO REST API — Pull Request Creation Reference

## Endpoint

```
POST https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/pullrequests?api-version=7.1
```

| Placeholder | Example | Where to find it |
|---|---|---|
| `{org}` | `kirklandandellis` | ADO URL or git remote |
| `{project}` | `KE` | ADO URL or git remote |
| `{repo}` | `client-portal-api` | Git remote `_git/{repo}` segment |

**Kirkland endpoint:**
```
https://dev.azure.com/kirklandandellis/KE/_apis/git/repositories/{repo}/pullrequests?api-version=7.1
```

---

## Authentication

Use HTTP Basic auth with an empty username and the PAT as the password:

```
Authorization: Basic base64(:<PAT>)
```

On bash/Git Bash (Windows):
```bash
printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0
```

---

## Required PAT Scopes

When generating the PAT in ADO (User Settings → Personal Access Tokens → New Token):

| Scope | Permission needed |
|---|---|
| Code | Read & Write |

Read-only scope is not sufficient — the API requires write access to create a PR.

---

## Request Body

```json
{
  "title": "ADO-1234 My Feature — short summary",
  "description": "Full markdown PR description here",
  "sourceRefName": "refs/heads/feature/ADO-1234-my-feature",
  "targetRefName": "refs/heads/dev",
  "workItemRefs": [
    { "id": "1234" }
  ],
  "isDraft": false
}
```

- `isDraft`: set to `true` to open the PR as a draft (not ready for review)
- `workItemRefs`: array; include all linked ADO work item IDs
- `description`: supports full markdown; the output from `pr-describe` pastes directly

---

## Success Response (HTTP 201)

```json
{
  "pullRequestId": 42,
  "title": "...",
  "status": "active",
  "repository": {
    "remoteUrl": "https://dev.azure.com/org/project/_git/repo"
  },
  "url": "https://dev.azure.com/org/project/_git/repo/pullrequest/42"
}
```

PR URL to present to the developer: `{repository.remoteUrl}/pullrequest/{pullRequestId}`

---

## Common Error Codes

| HTTP | ADO `message` | Cause | Fix |
|---|---|---|---|
| 400 | `The source branch does not exist` | Branch not pushed to remote | Run `git push origin <branch>` first |
| 400 | `Target branch does not exist` | `dev` branch missing | Specify correct target branch |
| 401 | `TF400813: The user...` | PAT invalid or expired | Generate a new PAT with Code → Read & Write |
| 403 | `Access denied` | PAT has insufficient scopes | Regenerate PAT with Code → Read & Write |
| 409 | `A pull request already exists` | PR open for this branch | Use the existing PR URL from the message |

---

## Generating a PAT

1. Open `https://dev.azure.com/kirklandandellis/_usersSettings/tokens` in a browser
2. Click **+ New Token**
3. Name: `claude-code-pr-create` (or any label)
4. Organization: `kirklandandellis`
5. Expiration: 30–90 days recommended
6. Scopes: select **Custom defined** → **Code → Read & Write**
7. Click **Create** and copy the token immediately — it is not shown again

Store the token using one of these options:

**Option A — Claude Code project settings (recommended)**
Add to `.claude/settings.json` in your repo root (ensure this file is gitignored):
```json
{
  "env": {
    "AZURE_DEVOPS_PAT": "your_token_here"
  }
}
```

**Option B — Windows User Environment Variables**
Win + S → "environment variables" → Environment Variables → User variables → New:
- Variable name: `AZURE_DEVOPS_PAT`
- Variable value: your token

Restart terminals after setting.
