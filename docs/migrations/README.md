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
