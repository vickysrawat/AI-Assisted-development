# PR Spec Review — Usage Guide

## Invocation in Claude Code (VS Code)

Place `SKILL.md` (and its `references/` folder) in your repo's skills directory
or your global Claude Code skills path. Claude Code loads it automatically.

### Command syntax

```
/review-pr spec=<spec-path>
/review-pr spec=<spec-path> pr=<pr-number>
/review-pr spec=<spec-path> diff=<diff-file>
```

### Argument reference

| Argument | Required | Description |
|----------|----------|-------------|
| `spec=`  | Yes | Path to spec file, or path to a folder containing spec files |
| `pr=`    | No | GitHub PR number — Claude runs `gh pr diff <N>` |
| `diff=`  | No | Path to a saved `.diff` file |

If neither `pr=` nor `diff=` is given, Claude runs:
```bash
git diff $(git merge-base HEAD main)...HEAD
```

### Prerequisite for `pr=`

The `gh` CLI must be installed and authenticated:
```bash
gh auth login
```

---

## Common Patterns

### Review current branch against a spec file
```
/review-pr spec=docs/specs/feature-login.md
```

### Review a GitHub PR by number
```
/review-pr spec=docs/specs/feature-login.md pr=42
```

### Review from a saved diff file
```
/review-pr spec=docs/specs/feature-login.md diff=pr-123.diff

# To save a diff manually:
gh pr diff 123 > pr-123.diff
# or
git diff main...my-branch > my-branch.diff
```

### Spec is a folder (multiple spec files)
```
/review-pr spec=docs/specs/
```
Claude reads all `.md`, `.txt`, and `.pdf` files in the folder and merges
them into a single requirement list before reviewing.

### Large PR — review by area
Break it into focused reviews:
```
/review-pr spec=docs/specs/auth.md       # auth files only
/review-pr spec=docs/specs/billing.md    # billing files only
```

### No spec yet
```
/review-pr spec=none
```
Claude reviews the PR for internal consistency, naming conventions, and
obvious logic issues only. No traceability matrix is produced.

---

## Tips

- **Be specific with your spec path.** If the spec folder has many files and
  only some are relevant, point to the file directly.
- **Staging environment specs** often live in a different branch. Check out
  the spec version that matches the base branch of the PR before reviewing.
- **ICEA documents** work the same as any spec — just pass the file path.
  Claude handles `.md`, `.txt`, and `.pdf` formats.
- **Incremental PRs**: if a PR is intentionally partial (implementing only
  some requirements), tell Claude: "This PR covers REQ-001 through REQ-005
  only." Claude will mark the rest as out-of-scope rather than ❌ Missing.
