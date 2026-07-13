---
description: "Write/refresh the repo's ignore file with plugin-required entries (managed block). Detects the VCS first — writes .gitignore on Git, .tfignore on TFVC (TFS) — so protection actually takes effect on both. Creates the file if missing, never touches your own lines. On TFVC, also flags an already-tracked .claude/settings.json for removal. Args: --with-artifacts to also offer detected build/env files. See skills/shared/vcs-detect-spec.md."
argument-hint: "[--with-artifacts]"
---
<command>gitignore-sync</command>
