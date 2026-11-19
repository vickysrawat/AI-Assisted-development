<!-- test-plan-state
source: plan
plan: ADO-83-setup-sync-script.plan.md
stories:
  - id: Story-1
    suite: "Suite 1"
    tech-spec: null
    status: generated
cross-cutting-suites-status: stub
-->
# Test Plan — One-command project sync after a plugin upgrade (`scripts/setup-sync.cjs`)
ADO #83 · Release R3 · Sprint S15
Document type: QA Test Plan (lightweight — generated from the approved plan's Must Have items)
Prepared: 2026-11-19

---

## Overview
Checks that `scripts/setup-sync.cjs` brings a provisioned target project to the installed plugin
version in one command, that migration notes now reach installed copies, and that `/setup-sync`
gives the same result by calling the script. Run against a **throwaway copy** of a provisioned
project — never a real one on its first pass.

## Environment Requirements
| Item | Requirement |
|---|---|
| Node.js | The plugin's supported version |
| Plugin | Installed at 3.29.0 via `node install.cjs --update` (path from `~/.claude/plugins/installed_plugins.json`) |
| Target project | A copy of a project provisioned by an older plugin (e.g. 3.26.0): has `.claude/dream-init-state.json`, `.claude/hooks/`, `.claude/commands/`, `CLAUDE.md` |
| Second target | A folder with no `.claude/` (not provisioned) |
| Shell | Git Bash on Windows, bash elsewhere |

Below, `P` is the installed plugin folder and `T` the target copy.

## Test Suites
| Suite | Title | When to run | Effort |
|---|---|---|---|
| Suite 1 | Plan Verification | Every change to `setup-sync.cjs`, the installers or `/setup-sync` | 50 min |
| Suite 2 | Regression | Before release | ⚠ stub |
| Suite 3 | Security | Before release | ⚠ stub |
| Suite 4 | Non-Functional | Before release | ⚠ stub |

**Estimated total effort: ~1 hour for Suite 1.**

---

## Suite 1 — Plan Verification
> One positive and one negative TC per Must Have item. Automated equivalents live in
> `tests/setup-sync.test.cjs`.

### TC-P1-01 — One command syncs a provisioned project
**Priority:** Critical
**Type:** CLI
**AC:** AC-F1

**Steps:**
1. Note `dream_init_plugin_version` in `T/.claude/dream-init-state.json` (e.g. 3.26.0).
2. `cd T && node "$P/scripts/setup-sync.cjs"; echo "exit $?"`
3. Re-read the state file; list `T/.claude/hooks/` and `T/.claude/commands/`; read `T/.claude/plugin-path.txt`.

**Expected:** exit 0. Summary shows `v3.26.0 → v3.29.0`, a ✓ line for bootstrap, detection, rule
deploy, placeholders, external stacks and the final stamp, then the in-range migration notes and
a Needs Claude list (or "nothing needs Claude"). State has `dream_init_plugin_version: "3.29.0"`
and today's `dream_sync_last_run`; hooks and stubs match the plugin's `_project-deploy/`;
`plugin-path.txt` points at `P`.

### TC-P1-02 — Same end state as running the steps by hand
**Priority:** Critical
**Type:** CLI
**AC:** AC-F1

**Steps:**
1. Make two copies of the old target: `T1`, `T2`.
2. In `T1` run by hand: `setup-init-bootstrap.cjs --mode sync`; `repo-detect.cjs --force --root=.`; `setup-init-bootstrap.cjs --mode post-detect --repo-type <repo_type>`; then stamp the version.
3. In `T2` run `node "$P/scripts/setup-sync.cjs"`.
4. `diff -r T1/.claude T2/.claude`, ignoring date and timestamp fields.

**Expected:** no differences apart from dates/timestamps (and `dream_sync_last_run`, which only the script writes).

### TC-P1-03 — Second run changes nothing
**Priority:** High
**Type:** CLI
**AC:** AC-F1

**Steps:**
1. After TC-P1-01, snapshot `T/.claude` and `T/CLAUDE.md`.
2. Run the script again; diff against the snapshot.

**Expected:** exit 0; only `dream_sync_last_run` may change. No duplicated CLAUDE.md sections, no extra ignore-file lines.

### TC-P1-04 — Not provisioned, empty repo_type, and a failing step
**Priority:** Critical
**Type:** CLI (negative)
**AC:** AC-F1

**Steps:**
1. In the folder with no `.claude/`, run the script.
2. In a fresh target copy, set `repo_type` to `""` in the state file; run the script.
3. In another copy, make `T/.claude/commands` read-only (or a file instead of a folder) so the bootstrap fails; run the script.
4. In a copy where `governance_mode` is `"lightweight"`, run the script.

**Expected:** (1) exit 2, one line telling you to run `/setup-init`, nothing written. (2) exit 0,
a ⚠ line that rule deploy was skipped because `repo_type` is empty; other steps ✓. (3) exit 1, a ✗
line for the bootstrap, later steps still run, version still stamped, and a re-run hint.
(4) `governance_mode` stays `"lightweight"`.

### TC-P2-01 — Migration notes are in the installed copy and shown in range
**Priority:** Critical
**Type:** CLI
**AC:** AC-F2

**Steps:**
1. From the plugin source: `node install.cjs --update`.
2. `ls "$P/docs/migrations"` and `ls "$P/docs"`.
3. Sync a target provisioned at 3.24.0.

**Expected:** `P/docs/` contains only `migrations/`; it has `033-3.25.0.md` … `034-3.29.0.md`. The
summary shows notes 033 and 034 (above 3.24.0, up to 3.29.0) and no others.

### TC-P2-02 — No notes in range; other docs still excluded
**Priority:** High
**Type:** CLI (negative)
**AC:** AC-F2

**Steps:**
1. Sync a target already at 3.29.0.
2. Check that `P/docs/Release*` and `P/docs/migrations/README.md` handling match the plan.

**Expected:** summary says no migration notes between v3.29.0 and v3.29.0; no `Release*` folders
under `P/docs/`; `README.md` and `2026-09-migration-skill-family.md` are never listed as in-range notes.

### TC-P3-01 — `/setup-sync` gives the same result through the script
**Priority:** Critical
**Type:** Manual skill run
**AC:** AC-F3

**Steps:**
1. On a fresh copy of the old target, open Claude Code and run `/setup-sync`.
2. Compare `.claude/` with the TC-P1-01 result.

**Expected:** the skill runs `setup-sync.cjs` once, shows its output, then only: the migration
notes, the external-repos question if it applies, the business-context offer if missing, the
onboarding-guide offer, and the confirm box. End state matches TC-P1-01.

### TC-P3-02 — `--commands` and `--reinstall` unchanged
**Priority:** High
**Type:** Manual skill run (negative)
**AC:** AC-F3

**Steps:**
1. In a target, run `/setup-sync --commands`.
2. In the plugin source, run `/setup-sync --reinstall`.

**Expected:** both behave as in 3.28.0 (deploy-commands output; `install.cjs --update` output), and neither calls `setup-sync.cjs`.

### TC-P4-01 — Automated suite passes
**Priority:** Critical
**Type:** Script
**AC:** AC-F4

**Steps:**
1. `node tests/setup-sync.test.cjs`
2. `npm test`

**Expected:** all cases pass — stamp, copy, idempotence, exit 2, empty `repo_type`, migration range,
failing step, override kept, installer copies only `docs/migrations/`, same-end-state comparison.
`npm test` passes.

### TC-P4-02 — The tests leave no files behind
**Priority:** Medium
**Type:** Script (negative)
**AC:** AC-F4

**Steps:**
1. `git status --short` before and after `node tests/setup-sync.test.cjs`.

**Expected:** no new or changed files in the repo; temp folders under `os.tmpdir()` removed.

### TC-P5-01 — Docs, CHANGELOG, migration note and version
**Priority:** High
**Type:** Manual review
**AC:** AC-F5

**Steps:**
1. Read README and DEVELOPER-GUIDE "Updating a project after a plugin upgrade".
2. Read the top of `CHANGELOG.md` and `docs/migrations/034-3.29.0.md`.
3. `node -p "require('./.claude-plugin/plugin.json').version"`

**Expected:** both guides show the one command and a multi-repo loop example; CHANGELOG has a
`[3.29.0]` ADO-83 entry; migration note 034 says what changed and that no manual step is needed
(or lists it); version is `3.29.0`.

### TC-P5-02 — The documented loop works as written
**Priority:** Medium
**Type:** CLI (negative)
**AC:** AC-F5

**Steps:**
1. Copy the loop example from the README; run it over two target copies, one of them not provisioned.

**Expected:** the provisioned one syncs (exit 0); the unprovisioned one reports exit 2; the loop
reports both outcomes and does not stop at the first.

---

## Suite 2 — Regression  ⚠ Stub
⚠ [lightweight — expand manually]

### TC-REG-01 — `/setup-init` on a fresh project unchanged
**Priority:** High | **AC:** AC-F3 | **Type:** Manual skill run
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

### TC-REG-02 — `/setup-status` all green after a script-only sync
**Priority:** High | **AC:** AC-F1 | **Type:** Manual skill run
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

---

## Suite 3 — Security  ⚠ Stub
⚠ [lightweight — expand manually]

### TC-SEC-01 — Developer-edited hooks, rules and skills stay protected by `.hashes`
**Priority:** Critical | **AC:** AC-F1 | **Type:** CLI
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

### TC-SEC-02 — No secrets written to committed files (`settings.json`)
**Priority:** High | **AC:** AC-F1 | **Type:** Code review
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

---

## Suite 4 — Non-Functional  ⚠ Stub
⚠ [lightweight — expand manually]

### TC-NFR-01 — Sync of a typical project finishes in under 30 s
**Priority:** Medium | **AC:** AC-F1 | **Type:** Performance
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

### TC-NFR-02 — Works on Windows (Git Bash, PowerShell) and Linux/macOS
**Priority:** High | **AC:** AC-F1 | **Type:** Manual
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

---

## Test Execution Tracker
| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-P1-01 | Suite 1 | Critical | | | ⬜ | |
| TC-P1-02 | Suite 1 | Critical | | | ⬜ | |
| TC-P1-03 | Suite 1 | High | | | ⬜ | |
| TC-P1-04 | Suite 1 | Critical | | | ⬜ | |
| TC-P2-01 | Suite 1 | Critical | | | ⬜ | |
| TC-P2-02 | Suite 1 | High | | | ⬜ | |
| TC-P3-01 | Suite 1 | Critical | | | ⬜ | |
| TC-P3-02 | Suite 1 | High | | | ⬜ | |
| TC-P4-01 | Suite 1 | Critical | | | ⬜ | |
| TC-P4-02 | Suite 1 | Medium | | | ⬜ | |
| TC-P5-01 | Suite 1 | High | | | ⬜ | |
| TC-P5-02 | Suite 1 | Medium | | | ⬜ | |
| TC-REG-01 | Suite 2 | High | | | ⬜ | Stub |
| TC-REG-02 | Suite 2 | High | | | ⬜ | Stub |
| TC-SEC-01 | Suite 3 | Critical | | | ⬜ | Stub |
| TC-SEC-02 | Suite 3 | High | | | ⬜ | Stub |
| TC-NFR-01 | Suite 4 | Medium | | | ⬜ | Stub |
| TC-NFR-02 | Suite 4 | High | | | ⬜ | Stub |

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## Exit Criteria
### Minimum for story to close
- [ ] All Critical TCs in Suite 1 passed
- [ ] Zero open Critical defects
- [ ] TC-P1-02 (same end state as the manual steps) passed — hard gate before `/setup-sync` is switched to the script
- [ ] TC-SEC-01 expanded and passed (developer edits stay protected)
