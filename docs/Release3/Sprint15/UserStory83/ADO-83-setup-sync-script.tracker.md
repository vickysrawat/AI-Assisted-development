# Tracker — setup-sync-script [LIGHTWEIGHT]
ADO #83 · governance: lightweight · plan: `ADO-83-setup-sync-script.plan.md`

| AC | Must Have item | Story | Status |
|---|---|---|---|
| AC-F1 | `scripts/setup-sync.cjs` — one-command deterministic sync (stamp, bootstrap, detect, rules, placeholders, external stacks, summary, exit codes) | 1 | ✅ Done |
| AC-F2 | Migration notes ship with the install (`docs/migrations/` in all three installers); script selects in-range notes | 1 | ✅ Done |
| AC-F3 | `/setup-sync` calls the script and keeps only the judgement steps | 1 | ✅ Done |
| AC-F4 | Tests in `tests/setup-sync.test.cjs` | 1 | ✅ Done |
| AC-F5 | Docs (README, DEVELOPER-GUIDE), CHANGELOG, migration note 034, version 3.29.0 | 1 | ✅ Done |

## Story 1 — One-command sync
**Status:** 🔄 In Progress (2026-11-19)

- 2026-11-19 — Built and tested in a scratch copy (`C:\tmp\ado83`) against a throwaway project and HOME. Code critic: PASS WITH NOTES (Jest wrapper change is outside the plan's file list, needed for AC-F4). Written after `APPROVE ADO-83`; version bumped to 3.29.0. `npm test` 45/45; `tests/setup-sync.test.cjs` 23/23 (84 s).

### Delivered
- `script`: `scripts/setup-sync.cjs` — stamp → bootstrap `--mode sync` → `repo-detect --force` → post-detect rules → CLAUDE.md `⚠ NOT DETECTED` retry → external stacks (when already set up) → run record; summary with in-range migration notes and a Needs Claude list; `--root`, `--dry-run`, `--verbose`; exit 0/1/2
- `installers`: `copyMigrationNotes` / `copy_migration_notes` / `Copy-MigrationNotes` after both plugin copies in `install.cjs`, `install.sh`, `install.ps1`; `install.cjs` main guarded by `require.main` and exports the copy helpers
- `skill`: `skills/setup-sync/SKILL.md` v2.0 — Step 1 runs the script; Steps 2–6 are the judgement steps (migration notes, external repos, business context, confirm, onboarding); 582 → 344 lines
- `docs`: README "Keeping the plugin up to date" + table rows; DEVELOPER-GUIDE "Updating a project after a plugin upgrade"; `docs/migrations/034-3.29.0.md`; CHANGELOG 3.29.0

### Tests added
- `tests/setup-sync.test.cjs` — 23 cases: functions (version compare, note range, args, warnings); installers (only `docs/migrations/` copied; all three call the copy twice); end to end (never provisioned / bad arg → 2; full sync with `--root`; deleted hook and stub restored; `governance_mode` kept, `output_mode` backfilled; note 033 listed, 032 not; registry version mismatch warning; same end state as the manual steps; second run changes nothing; unrecognisable project warns and refreshes external stacks; failing step → 1 with later steps run; `--dry-run` writes nothing)
- `tests/jest.suite.test.cjs` — per-file timeout map (`setup-sync.test.cjs`: 300 s)

### Design decisions
- **A failing step:** run every step, mark it ✗, exit 1 — later steps don't depend on it and are safe to re-run. Rejected: stop at the first failure.
- **Idempotence check:** ignores `_bootstrap-manifest.json`, the bootstrap's log of its last run, not project configuration.
- **Migration notes in installs:** a second copy of `docs/migrations/` after the plugin copy. Rejected: changing the `docs` exclusion inside `safeCopy`, which applies at every folder level.

### Known gaps
- `--json` (Could Have) not done.
- `tests/validate.py` reports 73 errors on the repo before this change (stub lists in `setup-status` / bootstrap `STUB_FILES` out of step with deployed commands) — separate ADO.
- Release reminders from `bump-version.js`: README version paragraph says 3.27.0; both guides document 3.26.0.
- `npm test` rewrites the tracked `test-results/junit.xml`.

### Lessons learned
_(Clean delivery — no recurring patterns identified in this story)_
