# GitHub REST API — Pull Request Creation Reference

Companion to `ado-api-guide.md`. Used when `detect_git_provider` (see
`$PLUGIN_DIR/skills/shared/git-remote-provider-spec.md`) returns `github`.

## Endpoint

```
POST https://api.github.com/repos/{owner}/{repo}/pulls
```

| Placeholder | Example | Where to find it |
|---|---|---|
| `{owner}` | `vickysrawat` | Git remote — segment after `github.com/` (or `github.com:` for SSH) |
| `{repo}` | `AI-Assisted-development` | Git remote — next segment, trailing `.git` stripped |

---

## Authentication

Use a token in the `Authorization` header:

```
Authorization: Bearer <GITHUB_TOKEN>
```

- **Public repos**: reading is possible unauthenticated, but *creating* a PR always
  requires a token.
- **Private repos**: a token is required for every call.
- The token is read from the `GITHUB_TOKEN` environment variable. Never echo, store, or
  log its value.

---

## Required token scopes

**Classic PAT:** `repo` (full) — needed to create the PR.

**Fine-grained PAT:** repository access to the target repo, with:

| Permission | Level |
|---|---|
| Pull requests | Read & Write |
| Contents | Read-only |

---

## Request

```bash
curl -s --ssl-no-revoke -4 -w "\n%{http_code}" -X POST \
  "https://api.github.com/repos/{owner}/{repo}/pulls" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -d '{
    "title": "[ADO-1234] My Feature — short summary",
    "body": "Full markdown PR description here",
    "head": "feature/ADO-1234-my-feature",
    "base": "main",
    "draft": false
  }'
```

- `--ssl-no-revoke -4` matches the ADO call — required behind the corporate TLS proxy on
  Windows; `-4` avoids IPv6 stalls.
- `head`: the source branch name (same-repo). For a cross-fork PR use `{owner}:{branch}`.
- `base`: the target branch — resolved via the provider spec (this repo's default is `main`).
- `draft`: set `true` to open as a draft PR.
- **No work-item linkage**: GitHub has no equivalent of ADO `workItemRefs`. Keep the
  `ADO-{ID}` in the title/body as a textual reference; optionally add `Refs ADO-{ID}` to
  the body. (If a GitHub *issue* number is relevant, `Closes #N` in the body links it —
  but that is an issue, not the ADO story.)

---

## Success response (HTTP 201)

```json
{
  "number": 42,
  "html_url": "https://github.com/{owner}/{repo}/pull/42",
  "state": "open",
  "title": "..."
}
```

PR URL to present to the developer: `.html_url`. PR number: `.number`.

---

## Common error codes

| HTTP | GitHub `message` | Cause | Fix |
|---|---|---|---|
| 401 | `Bad credentials` | Token invalid/expired | Regenerate `GITHUB_TOKEN` |
| 403 | `Resource not accessible by integration` | Token missing PR write scope | Add Pull requests: Read & Write (or classic `repo`) |
| 404 | `Not Found` | Wrong owner/repo, or token can't see a private repo | Verify `{owner}/{repo}`; ensure token has repo access |
| 422 | `No commits between {base} and {head}` | Source branch not pushed, or no diff vs base | `git push -u origin {head}`; confirm the branch has commits |
| 422 | `A pull request already exists for {owner}:{head}` | PR already open for this branch | Use the existing PR — do not create another |

Treat 422-already-exists the same way the ADO path treats 409: print the existing PR and
stop.

---

## `gh` CLI alternative (optional fast-path)

If `gh` is installed **and** `gh auth status` succeeds, it handles auth for you:

```bash
gh pr create --base {base} --head {source} --title "[ADO-1234] ..." --body-file -   # body on stdin
```

`gh` is **not** required — the `curl` path above is the default. `gh` is GitHub-only.

---

## Storing the token

**Option A — Windows User Environment Variable (recommended)**
Win + S → "environment variables" → User variables → New:
- Name: `GITHUB_TOKEN`
- Value: your token

Restart terminals after setting.

**Option B — Claude Code local settings**
Add to `.claude/settings.local.json` (gitignored — never `settings.json`, which is committed):
```json
{ "env": { "GITHUB_TOKEN": "your_token_here" } }
```

**Generate a token:** GitHub → Settings → Developer settings → Personal access tokens →
generate with the scopes above; copy it immediately (shown once).
