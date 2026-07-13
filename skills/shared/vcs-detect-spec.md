# VCS Detection Spec
_Spec version: 1.0 · Created: 2026-06-12_
_Used by: gitignore-sync, setup-init, setup-status_

---

## Why this exists

The plugin protects generated files and the credential file (the plugin
project-settings file that may hold `AZURE_DEVOPS_PAT`) by writing ignore entries. Until now every skill
assumed Git and wrote `.gitignore`. But some applications live in **TFVC** (the
centralised version control in TFS / Azure DevOps Server), which does not read
`.gitignore` at all — it uses `.tfignore`. On those repos the plugin's protection
was silently inert: generated files got committed and, worst case, a PAT could be
checked in.

This spec defines a single detection step so that **the same managed entries are
written to the file the repo's VCS actually honours** — `.gitignore` for Git,
`.tfignore` for TFVC. Every skill that reads or writes the ignore file must call
this detection first and branch on the result, so the three skills never disagree
about which file is authoritative.

---

## The detection contract

Detection returns exactly one token: `git`, `tfvc`, or `none`.

```bash
detect_vcs() {
  # 1. Git wins if a working tree is present. This is the most reliable signal
  #    and also the right tie-breaker: if a Git repo happens to sit inside a TFVC
  #    workspace mapping, Git is the active local VCS and .tfignore won't fire on
  #    Git operations anyway.
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "git"; return
  fi

  # 2. TFVC: a server-workspace check is the strongest signal. Fall back to
  #    on-disk metadata so detection still works offline or without a configured
  #    `tf` client. `$tf` / `.tf` folders and an existing `.tfignore` are the
  #    durable markers TFVC leaves in a mapped folder.
  if command -v tf >/dev/null 2>&1 && tf vc status . >/dev/null 2>&1; then
    echo "tfvc"; return
  fi
  if [ -d "$tf" ] || [ -d ".tf" ] || [ -f ".tfignore" ]; then
    echo "tfvc"; return
  fi

  # 3. Neither detected.
  echo "none"
}
```

Notes for the skill author running this:
- `tf vc status` is the modern Team Explorer / `tf.exe` form; older clients use
  `tf status`. If the first errors with "unknown command", retry with `tf status`.
- On Windows the metadata folder is `$tf` (hidden); the `.tf` form appears on some
  cross-platform clients. Checking both keeps detection portable.
- Detection runs at the **workspace root** the skill is operating on. A `.tfignore`
  governs its own folder and everything below it, so root is the correct anchor.

---

## What each token means for the calling skill

| Token | Ignore file | Path syntax | Notes |
|---|---|---|---|
| `git` | `.gitignore` | `/` separators, trailing `/` marks a dir | Current behaviour, unchanged |
| `tfvc` | `.tfignore` | `\` separators, bare folder name matches a dir, `!` re-includes, `#` comments | See translation rules below |
| `none` | `.gitignore` (fallback) | as Git | Write `.gitignore` **and** surface a note that VCS could not be detected, so the developer can correct it |

---

## Managed entries (single source of truth)

Both files carry the **same set of paths** — only the filename and the per-line
syntax differ. The canonical managed-entry list lives with its consumer, in
`setup-status` SKILL.md section 1i (the `for entry in …` array), which enumerates
all 13 protected paths; the writer skills (`gitignore-sync`, `setup-init`) emit
exactly that set. Keeping the list in one consuming skill rather than duplicating
it here keeps this spec tool-agnostic and avoids three copies drifting apart.

The managed block is delimited with markers so re-runs never touch the developer's
own lines:

```
# >>> ai-assisted-development (managed) >>>
{the 13 entries, one per line, in the syntax for this VCS}
# <<< ai-assisted-development (managed) <<<
```

### Per-VCS line syntax

For **Git**, write each entry verbatim (forward slashes; a trailing `/` marks a
directory).

For **TFVC**, transform each non-comment, non-blank managed line:

1. Replace `/` with `\`.
2. Drop a trailing `\` from a folder entry — TFVC matches a bare folder name and
   everything under it (e.g. a `CodeReviews/` entry becomes `CodeReviews`, and a
   `<dir>/sub/` entry becomes `<dir>\sub`).
3. Leave the `#`-delimited managed markers as-is; `#` is a valid `.tfignore` comment.
4. After writing, verify patterns took effect with `tf vc status` (or `tf status`)
   and confirm none of the managed paths show as pending adds.

---

## The already-tracked credential file (TFVC only)

`.tfignore` only blocks **new** adds. If the credential file
(`.claude/settings.local.json` — where secrets and machine-specific permissions live;
`.claude/settings.json` is intentionally committed and secret-free) is already under
source control, adding it to `.tfignore`
does nothing — it stays tracked and the PAT stays exposed. So on TFVC, after writing
the managed block, the consuming skill must check whether that file is already
tracked (`tf vc status <credential-file>` returns non-empty) and, if so, instruct
removal rather than claiming protection. The concrete file path and the
`SETTINGS_TRACKED` signal live in `setup-status` section 1i, where the rest of the
tool-specific wiring sits.

Remediation when the credential file is tracked: `tf vc delete --keep-local <file>`
(removes from source control, keeps the working copy), then check in the deletion;
or cloak the path in the workspace mapping. Either way, **Option A (store the PAT in
a Windows User Environment Variable) is the strongly preferred path on TFVC**, since
it sidesteps the tracked-file problem entirely.

---

## Findings-gate / pre-commit hook on TFVC

The Git pre-commit hook that enforces the findings-gate has **no TFVC equivalent on
the client side** — TFVC has no client-side commit hooks. On TFVC the equivalent is
a server-side check-in policy, which the plugin does not install. Skills that check
for the hook must therefore report **n/a** on TFVC rather than "not installed", so a
correctly-configured TFVC repo doesn't show a false warning.
