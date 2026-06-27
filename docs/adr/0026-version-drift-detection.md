# 0026 — Version drift detection and re-provisioning on upgrade
Status: Accepted · Date: 2026-06-12

## Problem
`dream-init` provisions a project and stamps the version that did so
(`dream_init_plugin_version` in `.claude/dream-init-state.json`, mirrored in the
`CLAUDE.md` header). On a single-install setup the plugin files on disk are
replaced on upgrade, but nothing re-stamps or re-provisions the project — the
stamp stays at the old version and an upgraded install assumes the older setup is
still correct. The routine health check (`dream-status`) and the per-session
warm-up (`session-start`) only ever read the project's self-reported state, so
drift is silent: new hooks, new shared specs, and new managed ignore-block entries
(e.g. the v1.27.0 `.tfignore` work) never reach a project provisioned by an older
version, yet status reports green. Only `plugin-readiness` — a heavyweight,
deliberately-run skill — compared the two versions.

## Decision
Detect drift where it will actually be seen, and give it a remediation path:
- **`dream-status` check 1r** compares installed (`.claude-plugin/plugin.json`)
  against provisioned (`dream_init_plugin_version`) with a semantic X.Y.Z compare
  (not lexical). Equal → Green; installed newer → Amber "UPGRADE PENDING — run
  `/dream-sync`"; installed older → Blue (downgrade, not corruption); no
  state/field → Amber (run `/dream-init`); `plugin.json` unreadable → Red.
- **`session-start`** runs the same comparison as a one-line notice, so an upgrade
  is announced on the first interaction rather than waiting for a status run.
- **`/dream-sync`** (alias `dream-init --upgrade`) is the idempotent re-provision
  path: re-copy hooks + refresh `.hashes`, re-run the VCS-aware ignore writer,
  seed/migrate new state files, deploy missing rule files, then re-stamp the
  version. It applies only what changed, driven by `docs/migrations/`.
- **`docs/migrations/`** records, per release, the version-sensitive changes a sync
  must apply. Releases that only touch prose/docs need no entry. This keeps sync
  targeted rather than a blind full re-run, and gives 1r the content for its
  "changes since {old}" line.

The provisioned-version stays a single source of truth in `dream-init-state.json`;
the `CLAUDE.md` line is a human-readable mirror, no longer load-bearing.

## Rationale
The failure mode is the dangerous kind — the system reports safety it cannot
verify. The same principle as ADR 0010's honesty clause applies: surface the gap
and make it actionable rather than assume-and-hope. Putting the check in the two
always-run entry points (status, session-start) rather than only in
`plugin-readiness` is what converts a silent assumption into a visible prompt.
The migration manifest follows ADR 0003: the *what-changed* knowledge lives in one
declared place, not re-derived by each sync run.

## Revisit when
Multiple plugin versions can coexist on one machine (the installed-version anchor
in `plugin.json` would no longer be unambiguous — resolve install path first), or
Claude Code gains a native plugin-upgrade hook that could trigger `/dream-sync`
automatically instead of relying on the developer to act on the notice.
