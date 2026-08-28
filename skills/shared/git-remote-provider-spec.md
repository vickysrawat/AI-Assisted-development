# Git Remote Provider Spec
_Spec version: 1.0 · Created: 2026-08-27_
_Used by: pr-create, pr-describe, pr-spec-review_

---

## Why this exists

The PR skills (`pr-create`, `pr-describe`, `pr-spec-review`) were written for Azure
DevOps only — a hardcoded `dev` target branch, `dev.azure.com` REST calls, and
`AZURE_DEVOPS_PAT` auth. But a repo's remote may be **GitHub** instead, where the API,
auth, default branch, and PR URLs are all different. This spec defines a **single
detection step** so those skills branch the *transport* (endpoint / auth / base branch /
URLs) on the actual remote, while leaving everything else — the ADO work-item ID, the
ICEA gate, the findings gate — untouched.

**Scope boundary.** This is the *remote provider* axis (GitHub vs Azure DevOps). It is a
different concern from `vcs-detect-spec.md`, which detects the *ignore-file* VCS (Git vs
TFVC). Keep them separate: a Git working tree can push to either GitHub or ADO.

**Work identity is provider-independent.** The `ADO-{ID}` story number identifies the
work and keys the ICEA file regardless of git host. It is *not* derived from the provider
and is *not* replaced by a GitHub issue number. Branch-name extraction of `ADO-[0-9]+`
stays a convenience with an ask-for-ID fallback — this spec never changes that.

---

## Substitution model (read before running any helper)

Each `!`/bash line a skill runs is a **fresh shell** — shell variables do **not** persist
across lines. So every helper below prints exactly one value; the skill **captures that
value and substitutes it as a literal placeholder** (`{provider}`, `{base-branch}`,
`{owner}`, `{repo}`, …) into later commands, exactly like the existing `{org}`/`{project}`
placeholders in `pr-create`. Do **not** write `PROVIDER=$(...)` on one line and reference
`$PROVIDER` on another — it will be empty.

---

## Helper 1 — `detect_git_provider` → `ado | github | other`

```bash
url=$(git remote get-url origin 2>/dev/null)
case "$url" in
  *dev.azure.com*|*visualstudio.com*) echo "ado" ;;
  *github.com*)                       echo "github" ;;
  *)                                  echo "other" ;;
esac
```

- `ado` — Azure DevOps (modern `dev.azure.com` or legacy `*.visualstudio.com`).
- `github` — GitHub (`github.com`, HTTPS or SSH).
- `other` — anything else (GitLab, Bitbucket, self-hosted). Skills treat `other` as
  **draft-only** for PR creation — never attempt an API submit against an unknown host.

If `git remote get-url origin` is empty (no `origin` remote), the skill asks the developer
for the remote URL rather than guessing.

---

## Helper 2 — `resolve_remote_default_branch` → e.g. `main`

```bash
# Primary: the remote HEAD symbolic ref recorded at clone time (offline, no network).
b=$(git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null | sed 's#^refs/remotes/origin/##')
# Fallback: ask the remote (needs network).
if [ -z "$b" ]; then
  b=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
fi
echo "$b"
```

If both are empty (e.g. offline and `origin/HEAD` unset), the skill **asks** the developer
for the target branch. Never silently assume `main` or `master`.

---

## Helper 3 — base/target branch policy

The PR base (target) branch depends on provider so that ADO behaviour is preserved exactly
while GitHub does the right thing:

| Provider | Base branch | Rule |
|---|---|---|
| `ado` | `dev` | Use `dev` **iff** it exists on the remote (`git ls-remote --heads origin dev` non-empty). **Else ask.** This is the pre-existing ADO behaviour — no silent fallback. |
| `github` / `other` | remote default (Helper 2) | Use the remote default branch **iff** it exists. **Else ask.** |

Existence check for any candidate branch:

```bash
git ls-remote --heads origin "{candidate}"   # non-empty output => exists
```

The resolved value is substituted as `{base-branch}` in later commands.

---

## Remote URL → identifiers

### GitHub (`{owner}` / `{repo}`)

| URL form | Example | Parse |
|---|---|---|
| HTTPS | `https://github.com/{owner}/{repo}.git` | segment after `github.com/`, strip trailing `.git` |
| HTTPS (no `.git`) | `https://github.com/{owner}/{repo}` | as above |
| SSH | `git@github.com:{owner}/{repo}.git` | segment after `github.com:`, strip trailing `.git` |

If parsing fails, ask for `{owner}` and `{repo}` individually.

### Azure DevOps (`{org}` / `{project}` / `{repo}`)

Parsed the same way `pr-create` already documents (`dev.azure.com/{org}/{project}/_git/{repo}`
and the legacy / username-prefixed forms). This spec does not restate that table — see
`pr-create` Step 6.

---

## What each provider means for the caller

| Concern | `ado` | `github` |
|---|---|---|
| Auth credential | `AZURE_DEVOPS_PAT` (Basic `:{PAT}`) | `GITHUB_TOKEN` (Bearer); optional for public repos, required for private |
| PR API base | `https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}` | `https://api.github.com/repos/{owner}/{repo}` |
| Create PR | `POST .../pullrequests?api-version=7.1` | `POST .../pulls` |
| Create body | `{title, description, sourceRefName, targetRefName, workItemRefs}` | `{title, body, head, base}` |
| PR-already-exists | HTTP 409 | HTTP 422 |
| Work-item linkage | native `workItemRefs` links the ADO story | **none** — GitHub can't link an ADO story; the `ADO-{ID}` appears as text in the title/body only |
| CLI fast-path | `az repos pr` (if installed) | `gh` (if installed **and** `gh auth status` OK) |

**curl flags (both providers, this environment):** always include `--ssl-no-revoke -4`
(the corporate TLS proxy on Windows fails revocation checks otherwise) and
`-w "\n%{http_code}"` to capture the status code. Never echo or log the credential value.

---

## Helper 4 — `resolve_pr_refs {N}` (existing PR by number → base/head refs)

Used by `pr-spec-review` for the `pr=<N>` path. One metadata call returns the PR's base and
head refs; the caller then diffs locally (`git fetch origin` + `git diff {base}...{head}`),
so no provider-specific diff parsing is needed.

**GitHub:**
```bash
curl -s --ssl-no-revoke -4 \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{N}"
```
Read from the JSON response:
- `.base.ref` → `{base-ref}`
- `.head.ref` → `{head-ref}`
- `.head.repo.full_name` → if it ≠ `{owner}/{repo}`, the PR is **cross-fork** (see guard below)
- `.title`, `.body` → context for the review

**Azure DevOps:**
```bash
curl -s --ssl-no-revoke -4 \
  -H "Authorization: Basic $(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)" \
  "https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{N}?api-version=7.1"
```
Read `.sourceRefName` (→ `{head-ref}`) and `.targetRefName` (→ `{base-ref}`), each stripped
of the `refs/heads/` prefix. `.title`/`.description` give context.

**CLI fast-path (optional):** if `gh` is installed, `gh pr view {N} --json baseRefName,headRefName,title,body`
substitutes for the GitHub curl; `az repos pr show --id {N}` for ADO.

**Cross-fork guard:** after `git fetch origin`, if `{head-ref}` is not present on `origin`
(GitHub `.head.repo.full_name` ≠ `{owner}/{repo}`), the caller stops with:
> Head ref `{head-ref}` lives in a fork. Add it and re-run:
> `git remote add fork <fork-url> && git fetch fork` — or pass `diff=<file>`.

---

## Contract summary for skill authors

1. Run `detect_git_provider` first; substitute `{provider}`.
2. Resolve `{base-branch}` via Helper 3 (asks the developer if it can't determine one).
3. Parse `{owner}`/`{repo}` (GitHub) or `{org}`/`{project}`/`{repo}` (ADO) from the remote.
4. Branch only the transport on `{provider}`. `other` ⇒ draft/manual only.
5. Never touch the ADO-{ID}, ICEA, or findings logic — those are provider-independent.
