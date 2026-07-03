# Upgrade migrations

When the plugin is upgraded, the files on disk change but a project that was
already provisioned by an older version does **not** update itself — the version
stamp in `.claude/dream-init-state.json` (`dream_init_plugin_version`) stays at
whatever version ran `dream-init`, and an upgraded install otherwise assumes the
older setup is still correct. `dream-status` check 1r detects this drift; this
directory tells `/dream-sync` (and the status output) **what** changed between two
versions, so a sync applies only the version-sensitive pieces instead of blindly
re-running everything.

## When you need an entry here

Add a migration entry for a release **only if** it changed something a project
carries on disk — i.e. something a re-provision would need to bring current:

- new or changed hooks (`hooks/`) — picked up by the 1p hash check, re-synced here
- new shared specs (`skills/shared/*.md`) the project should be aware of
- new managed entries in the ignore-file block (1i)
- new generated/state files a release introduced, or schema changes to existing
  state files that need migrating
- new `.claude/rules/` files for a stack

Releases that only change skill prose, docs, or guides need **no** entry — nothing
on the project side goes stale.

## Format

One file per version: `NNN-X.Y.Z.md` (e.g. `001-1.27.0.md`). Keep it short and
machine-skimmable; `/dream-sync` reads the `Sync actions` list and `dream-status`
1r shows the `Summary` line for each version in the provisioned→installed range.

```
# Migration to X.Y.Z
Summary: {one line — what a sync brings current}

## Sync actions (idempotent — never overwrite developer content)
- {action 1}
- {action 2}

## Notes
{anything a maintainer running the sync should know}
```

## Index

| Version | Summary |
|---|---|
| 1.27.0 | VCS-aware ignore file: add `.tfignore` for TFVC repos; refresh the managed ignore block |
| 1.31.0 | Write Gate, hierarchical ICEA folder structure, Tech Spec companion doc |
| 2.0.0 | Session-independent workflow, keyword handlers, Epic support |
| 2.1.0 | Single-responsibility skill boundaries, interactive draft-then-save flow |
| 2.1.1 | `install.ps1` rewrite — dynamic version, local-folder update |
| 2.2.0 | Plan phase integrated into `icea-feature`; extended ICEA template |
| 2.2.0 (shell config) | Shell & Git Configuration section added to CLAUDE.md |
| 2.3.0 | Fixed `dream-init` path resolution and section detection |
| 2.3.1 | Fixed `where.exe`-only path detection in `dream-init` and `dream-sync` |
| 2.4.1 | ICEA and Tech Spec drafts written to `temp/` for VS Code preview |
| 2.6.0 | Codebase knowledge graph (`.claude/graph/`) — index+detail files with git-hook staleness detection; `/graph-sync` refresh |
| 3.0.0 | Knowledge graph is the single orientation layer; `domain-map.md` retired; graph now committed (not gitignored) |
