# 0025 — VCS-aware ignore-file selection (.gitignore for Git, .tfignore for TFVC)
Status: Accepted · Date: 2026-06-12

## Problem
The plugin protects generated files and the credential file (`.claude/settings.json`,
which may hold `AZURE_DEVOPS_PAT`) by writing ignore entries, and `dream-status`
flags a missing protection as ❌ Red. Every skill assumed Git and wrote
`.gitignore`. But some applications in this org live in **TFVC** (the centralised
version control in TFS / Azure DevOps Server), which does not read `.gitignore` —
it reads `.tfignore`. On those repos the protection was silently inert: generated
files would be committed, and worst case a PAT could be checked in, while
`dream-status` still reported green against a file TFVC ignores.

## Decision
A single shared detection step (`skills/shared/vcs-detect-spec.md`) resolves the
VCS once and the ignore-writing and ignore-checking skills branch on it. The same
13-entry managed block is written to whichever file the repo's VCS honours —
`.gitignore` (Git) or `.tfignore` (TFVC) — with the entries translated to TFVC
syntax (backslash separators, no trailing slash, `#` comments). Detection returns
`git` / `tfvc` / `none`; Git wins any tie (a Git tree inside a TFVC mapping is
governed by Git locally and `.tfignore` won't fire on Git operations); `none`
falls back to `.gitignore` and surfaces a detection-failure note.

Callers updated: `gitignore-sync` and `dream-init` (write the correct file),
`dream-status` (check 1i reads the authoritative file; PAT check, skipped-entry
remediation, and the report line are VCS-aware).

Two TFVC-specific consequences are designed in, not papered over:
- `.tfignore` only blocks *new* adds. An already-tracked `.claude/settings.json`
  stays exposed regardless of the ignore entry, so the PAT check additionally
  tests tracked state (`SETTINGS_TRACKED`) and the remediation is
  `tf vc delete --keep-local` (or cloak), with the Windows-env-var PAT path
  (Option A) strongly preferred on TFVC.
- TFVC has no client-side commit hook, so the findings-gate pre-commit check
  reports **n/a** on TFVC rather than a false "not installed"; the equivalent is
  a server-side check-in policy the plugin does not install.

## Rationale
This is the same principle as ADR 0003 (one shared spec as the single source of
truth) applied to a second VCS: the *what* to protect is identical, only the file
and syntax differ, so the decision belongs in one place rather than re-derived in
three skills. Leaving it Git-only was a silent correctness hole — the most
dangerous kind, because `dream-status` actively reported safety while the credential
file sat unprotected. Honesty about the TFVC bypass surface (tracked files, no
client hook) follows the same posture as ADR 0010's honesty clause: make the gap
visible and remediable rather than claim protection that isn't there.

## Revisit when
The TFVC apps migrate to Git (the branch becomes dead code, removable), or the org
adopts server-side TFVC check-in policies the plugin could detect and report as the
findings-gate equivalent (replace the n/a with a real check).
