# Feature Plan — One-command project sync after a plugin upgrade (`scripts/setup-sync.cjs`)
ADO #83 · Release R3 · Sprint S15
Status: ✅ Approved — critic PASS WITH NOTES, lightweight governance (2026-11-19)
Branch: `feature/ADO-82-arch-diagram-icons` (stacked on ADO-82, developer choice 2026-11-19)
Governance: lightweight (developer choice, 2026-11-19)

---

## Problem Statement

Updating a target project after a plugin upgrade means opening Claude Code in that repo and
running `/setup-sync`, a 580-line skill that Claude walks step by step. Most of those steps are
already plain Node scripts (`setup-init-bootstrap.cjs --mode sync`, `repo-detect.cjs`,
`setup-init-bootstrap.cjs --mode post-detect`, `external-stack-detection.cjs`), but nothing runs
them without Claude, and the version stamp is an inline snippet Claude edits by hand. A tech
lead with several repos needs one Claude session per repo.

There is also a hidden gap: Step 4 shows migration notes from `$PLUGIN_DIR/docs/migrations/`, but
all three installers exclude `docs` (`install.cjs`, `install.sh:86`, `install.ps1:98`). Checked
on 3.28.0: the installed copy has no `docs/` folder, so `/setup-sync` has never shown a migration
note in a target project.

**Success:**
- `node "<plugin>/scripts/setup-sync.cjs"` run from a target repo gives the same end state as the
  mechanical part of `/setup-sync`, with no Claude session, and a second run changes nothing.
- `/setup-sync` gives the same result as today, by calling that script and doing only the steps
  that need judgement.
- In-range migration notes reach target projects.

## Story

As a developer or tech lead who has just upgraded the plugin, I want to update a target project
with one command, so that I can bring every repo up to date in seconds without walking each one
through a Claude session.

## Personas

- **Developer:**
  - Upgrades the plugin and needs their project to match.
  - Frustration: a long Claude walkthrough for what is mostly file copying.
  - Success: one command and a short summary.
- **Tech lead:**
  - Maintains several repos.
  - Frustration: N sessions for N repos, and nothing to script.
  - Success: a shell loop over the repos, with exit codes to check.

## Feature Priority (MoSCoW)

**Must Have:**
1. **`scripts/setup-sync.cjs`**, run from the target repo root. It finds the plugin folder and
   version from its own location (`../.claude-plugin/plugin.json`). Steps, in order:
   - No `.claude/dream-init-state.json` → exit 2 with "run /setup-init first".
   - Stamp the installed version early, so an interrupted run never leaves the state stale (today's Step 1).
   - `setup-init-bootstrap.cjs --mode sync`.
   - `repo-detect.cjs --force --root=.`, then `setup-init-bootstrap.cjs --mode post-detect --repo-type <state.repo_type>`; an empty `repo_type` warns and skips the rule deploy (today's Step 1c).
   - Resolve the CLAUDE.md `{GIT_PATH}` / `{BASH_PATH}` placeholders (today's Step 4b).
   - Refresh external-stack detection when the developer was already asked or `additionalDirectories` is set (today's Step 5b cases 1–2).
   - Record `dream_sync_last_run`; backfill `governance_mode` / `output_mode` only when absent (today's Step 6).
   - Print a summary: versions from → to, one ✓ / ⚠ / ✗ line per step, the in-range migration notes, and a **Needs Claude** list (missing business context, external repos never asked about, onboarding guide, graph-sync reminder) — or "nothing needs Claude".
   - Exit codes: 0 all steps ok · 1 a step failed (the remaining steps still run, since each is safe to re-run; the summary gives a re-run hint) · 2 usage error or project not provisioned.
2. **Migration notes ship with the install.** `install.cjs`, `install.sh` and `install.ps1` copy
   `docs/migrations/` and still skip the rest of `docs/`. The script picks notes by the version in
   the filename (`NNN-x.y.z.md`, above the provisioned version and up to the installed version).
3. **`/setup-sync` uses the script.** Steps 1, 2, 3, 4b, 5b (cases 1–2) and 6 become one
   `node "$PLUGIN_DIR/scripts/setup-sync.cjs"` call. The skill keeps only the judgement steps:
   showing migration notes, the external-repos question (5b case 3), the business-context offer
   (6b), the onboarding-guide offer (7b) and the confirm box. `--commands` and `--reinstall` are
   unchanged.
4. **Tests** in `tests/setup-sync.test.cjs`, against a temporary target project and the plugin source:
   - version and last-run stamped; hooks and stubs copied
   - a second run changes nothing
   - no state file → exit 2
   - empty `repo_type` → warning, exit 0
   - migration-range selection, including none in range
   - a failing step → exit 1, version still stamped, later steps still run
   - developer overrides (`governance_mode: lightweight`) left alone
   - installer copies `docs/migrations/` and nothing else from `docs/`
5. **Docs and release:**
   - "Updating a project after a plugin upgrade" in README and DEVELOPER-GUIDE (one command, plus a loop example).
   - CHANGELOG entry and migration note `docs/migrations/034-3.29.0.md`.
   - Version 3.29.0 with `scripts/bump-version.sh`.

**Should Have:**
- `--root=<path>` to sync a repo without `cd`, so the multi-repo loop is a one-liner.
- `--dry-run`: print what each step would do and write nothing.

**Could Have:**
- `--json`: machine-readable summary for CI.

**Won't Have:**
- No automatic sync from a session-start hook — re-provisioning stays an explicit choice.
- No deletion of rules that are no longer detected — that stays with `/setup-teardown --rules`.
- No changes to `setup-init`, to the bootstrap or detect scripts' behaviour, or to `/setup-sync --commands` / `--reinstall`.
- No built-in repo list; a shell loop with `--root` covers it.

## Release Plan

- **MVP (single story):** Must Have 1–5 — one command per repo, migration notes in targets, the skill on the shared script.
- **Deferred:** `--json`; a `--repos <file>` batch mode if loops prove awkward.

## Assumptions

1. The bootstrap writes into the working directory (`PROJECT_ROOT = process.cwd()`) and finds the plugin from its own location — verified (`setup-init-bootstrap.cjs:120`, `:286`).
2. Running the steps as child processes with the same `node` gives the same result as Claude running them one by one — unverified; the tests prove it.
3. `.gitignore` / `.tfignore` upkeep is already in the bootstrap's sync mode (`gitignoreSync`), so the skill's separate Step 5 `/gitignore-sync` call is redundant — verified (`setup-init-bootstrap.cjs:1386`); confirm during build.
4. Migration notes are named `NNN-x.y.z.md` — verified for 028–033; `2026-09-migration-skill-family.md` and `README.md` are skipped.

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Script and skill drift apart again | M | M | The skill calls the script; no step is described in both |
| A developer runs the old cached plugin's script after upgrading | M | L | The script prints its own version and the `installed_plugins.json` version, and warns when they differ |
| Copying `docs/migrations` into the install changes installer behaviour | L | L | Narrow exception; installer test |
| Continuing after a failed step hides the failure | L | M | Exit 1, a ✗ line per failed step, re-run hint in the summary |

## Pre-mortem

"It shipped and people still opened Claude for every sync." Likely causes: a summary nobody
trusted, or a Needs Claude list that always looked alarming. Mitigation: the summary says
"nothing needs Claude" when that is true, and lists only items that apply to this project.

## Dependencies

- Stacked on ADO-82 (3.28.0, uncommitted on `feature/ADO-82-arch-diagram-icons`). ADO-83 ships after ADO-82 in the same branch; the release bumps 3.28.0 → 3.29.0.
- Existing scripts called unchanged: `setup-init-bootstrap.cjs`, `repo-detect.cjs`, `external-stack-detection.cjs`.

## Open Questions

None — all resolved at SAVE PLAN (2026-11-19): lightweight governance · R3/S15 · continue after a
failed step and exit 1 · stack on the ADO-82 branch.

---
### Revision Log
2026-11-19 — Plan drafted and saved (SAVE PLAN ADO-83), lightweight governance. Origin: the developer asked for an easier way than `/setup-sync` to update target projects after `install.cjs --update`.
2026-11-19 — Critic (plan, lightweight): PASS WITH NOTES. (1) Must Have 4: the "same end state" test compares the `.claude/` tree from running the four scripts by hand against `setup-sync.cjs` on a second copy of the fixture, ignoring timestamps. (2) Must Have 3: confirm assumption 3 (bootstrap sync covers the ignore file) in code before removing the skill's `/gitignore-sync` step. Stamped ✅ Approved.
