# Migration Family — Setup Independence & Simplification Review

> Status: **IN REVIEW**: Point 1 decided (2026-11-10); Point 2 analysed, waiting for PO; Points 3–13 have evidence captured and are waiting for full analysis.
> Started: 2026-11-09 · Work item: ADO-001 (branch `feature/ADO-001-upgrade-intake-gate`)
> Plugin version reviewed: 3.26.0
> Parent: [OverEngineeringFix.md](OverEngineeringFix.md), Issue 2 ("Migration family built far ahead of demand").
> This document holds the detailed analysis for Issue 2. Defect IDs (A–D) and security IDs (S1–S15) refer to the parent.

## Scope

The migration family is **upgrade**, **rewrite** and **replatform**. This review covers their `references/`,
`skills/shared/migration-*.md`, `skills/shared/migration-knowledge/**`, the `migration-research-agent` and
`breaking-changes-agent` agents, the migration scripts under `scripts/`, the `approval-capture` and
`migration-gate` hooks, and the test-plan handoff.

It looks at the family from two angles:

1. **Setup dependency.** How much do the skills rely on plugin setup in the target project? A project may
   need migrating where the plugin is only installed on the machine and setup has never run.
2. **Design overkill.** How much more design is there than the job needs, and what can be simplified
   without losing safety?

## Binding constraint: PO decision of 2026-11-09

See [OverEngineeringFix.md § S1 for the migration family](OverEngineeringFix.md). Every option in this
document must be consistent with it:

- Migration skills run **without** plugin setup in the project. Setup is an **optional final step**.
- Hooks: **"if hooks are available, use them; if not, ignore them."** The rewrite preflight becomes an
  advisory check that records `hooks_active` in the ledger. It never blocks.
- No traces in the source repo. `migrationRoots` moves out of the source's `settings.local.json` and into
  the ledger.
- Accepted residual risk for migrations: without hooks, nothing proves an approval was typed by the user.
  It is accepted because the user is present at every gate.

## How to read this document

Each point uses the same nine headings as the parent: (1) issue, (2) what happens if not resolved,
(3) trade-offs, (4) options, (5) what to do, (6) can it remain after the fix, (7) how to verify,
(8) security risks, (9) design principles. Every point also lists all the artifacts it touches or depends
on. Nothing is assumed: anything unverified is labelled as such or listed under open questions.

**Evidence labels** (same as the parent)

- **[V]**: verified first-hand by reading a file or running a command during this review.
- **[R]**: reported by a read-only investigation sub-agent, with file:line evidence, and not yet
  re-checked first-hand. Re-verify before acting.

## Method

- Two read-only sub-agent investigations ran in parallel, one per angle, and reported with file:line
  citations.
- High-impact claims were re-checked first-hand ([V]). One of them was checked by running the deployed
  hook copies in a scratch folder (`C:\tmp\hookprobe`, deleted afterwards).
- Sizes at review time: upgrade/SKILL.md 1,076 lines, rewrite/SKILL.md 2,222 lines,
  replatform/SKILL.md 762 lines, migration-ledger-schema.md 323 lines, migration-research-spec.md 491 lines.
  migration-knowledge is about 8.3K lines across about 45 `.md` files. There are 13 migration scripts, and
  every one has a test.

---

## Ranked point list

| # | Point | Angle | Severity | Parent link | Status |
|---|---|---|---|---|---|
| 1 | Script and hook paths only work when run from the plugin repo, and the hooks fail open when they are wired | Setup | 🔴 Critical | Defect C, S1 | **Decided** |
| 2 | Upgrade and replatform gates rely on instructions only. Upgrade claims a hook that doesn't exist. The Write Gate and RESUME/STATUS routing live only in the project CLAUDE.md | Setup | 🔴 High | S1, Issue 3 | **Analysed** |
| 3 | The intake "full accounting" check passes with nothing checked when `graph.json` is absent. Rewrite reads the target's graph. Upgrade's intake-verify hard-fails without `migrationRoots` | Setup | 🔴 High | — | Evidence |
| 4 | Standalone-mode contract: rewrite's blocking hook preflight, finding `$PLUGIN_DIR` without setup, migrationRoots in the source repo | Setup | 🟠 Medium | Defect A, PO decision | Evidence (direction decided) |
| 5 | Git only, with no TFVC or non-git preflight. Ledger and worktree folders are not git-ignored, although the schema says they are | Setup | 🟠 Medium | — | Evidence |
| 6 | The B-series hard block defaults to **off** when `business-context.md` is absent | Both | 🟠 Medium | — | Evidence |
| 7 | The test-plan handoff doesn't match: wrong ledger path, an undefined flag, and an output path that can't be resolved | Both | 🟠 Medium | — | Evidence |
| 8 | Confirmed bugs: coupling keyword, phantom tracker, log filename, early `design_approved`, cluster branch name, Defect B | Overkill | 🟡 | Defect B | Evidence |
| 9 | The same setup sections are repeated across all three skills (≈350–450 lines) | Overkill | 🟡 | Issue 6 | Evidence |
| 10 | More gates than the skills claim (about 7 for upgrade and 9+ for rewrite, against claims of 3 and 5); about 17 reply keywords in rewrite | Overkill | 🟡 | Issue 3 | Evidence |
| 11 | Rewrite always produces 7 design docs, has a 5-file revision loop (943 lines), and needs ≈95–110K tokens per run | Overkill | 🟡 | Issue 6 | Evidence |
| 12 | Upgrade: 4 overlapping breaking-change sources, 3 caches, an adapter script, and a verify step that only accepts the result Claude reports | Overkill | 🟡 | Issue 2 | Evidence |
| 13 | Rarely needed features load by default: BYO, option-change, Well-Architected, TCO in rewrite, the orphan-doc recovery protocol | Overkill | 🟡 | Issue 2 | Evidence |

Point 1 goes first because nothing else can be tested end to end until the scripts actually run in a
real project.

---

## Point 1: Script and hook paths only work when run from the plugin repo

### 1.1 What the issue is

**Part A: relative script calls in the skills [V].**

| File | `node scripts/…` (relative) | `$PLUGIN_DIR/scripts/…` |
|---|---|---|
| `skills/upgrade/SKILL.md` | 30 | 19 |
| `skills/rewrite/SKILL.md` | 24 | 58 |
| `skills/replatform/SKILL.md` | 19 | 20 |
| `skills/shared/migration-ledger-schema.md` | 5 | 0 |

Relative paths are resolved from the current working directory. A target project has no `scripts/`
folder. Setup never copies it there and only allow-lists `{PLUGIN_DIR}/scripts/*.cjs`
(`scripts/setup-init-bootstrap.cjs:446-452`) [V].

Examples:
- `upgrade/SKILL.md:127` (the first ledger write) [V].
- `replatform/SKILL.md:116` (ledger `init`) [R].
- `rewrite/SKILL.md:1594` uses `$PLUGIN_DIR`, and the next lines `:1595-1596` use relative paths [V].

This breaks each skill's own rule (`upgrade:1065`, `rewrite:2204`, per parent Defect C).

**Part B: deployed hooks fail open [V].** `_project-deploy/hooks/migration-gate.cjs:34-37` and
`approval-capture.cjs:25-29` both do `require('../../scripts/ado-normalize.cjs')` and set
`PLUGIN_DIR = __dirname/../..`. That is only correct inside the plugin repo. Setup copies the hooks
unchanged (`setup-init-bootstrap.cjs:600`) [V].

The `require` runs at the top level of the file, before the `try { … } catch → block()` that would fail
closed (`migration-gate.cjs:60-71`) [V].

**Runtime check [V].** Both hooks were copied into `C:\tmp\hookprobe\.claude\hooks\` and run with a
Write payload. Both exited with **code 1** (`Cannot find module '../../scripts/ado-normalize.cjs'`).
Claude Code blocks a tool call only on exit code 2. Any other non-zero exit is reported and the call
goes ahead. So the gate **fails open**.

**Correction and reach.** Per parent Defect A [V], setup never registers these hooks. In target projects
today they are therefore **not running at all**; they are not failing open. The fail-open applies wherever
the hooks are wired in by hand.

Under the PO refinement ("if hooks are available, use them"), hooks are an optional layer that may be
present. When present, they must not fail open.

### 1.2 What happens if not resolved

- **Upgrade** fails at its first ledger write (`upgrade:127`).
- **Replatform** fails at `init` (`replatform:116`).
- **Rewrite** runs partway, then fails between two related writes. At `:1594-1596` the gate gets recorded
  but the payload does not. That leaves a half-written ledger that resume will misread.
- Claude may notice `MODULE_NOT_FOUND` and fix the path on its own. If so, runs work sometimes and fail
  sometimes, which hides the defect. This is unverified and possible; it is not proven.
- Where the hooks are wired, the gates fail open while the skill text still says they are enforced. That
  creates false assurance in the audit trail.
- The PO decision ("migrations run without setup") **cannot be delivered** while Part A remains.

### 1.3 Trade-offs

- **Copy `scripts/` into targets:** trivially compatible, but about 45 files go into every repo, plugin
  upgrades leave stale copies, the attack surface grows, and it contradicts "no traces in the source repo".
- **Resolve the plugin folder when the code runs:** one source of truth, but everything then depends on
  `$PLUGIN_DIR` resolving with no setup. Point 4 covers that.
- **Self-contained hooks (copy the roughly 10-line `normalizeAdo` into them):** no load-time dependency,
  at the cost of two copies that could drift apart.

### 1.4 Options

| Option | Description | Verdict |
|---|---|---|
| A | Replace every `node scripts/` with `node "$PLUGIN_DIR/scripts/` in the skills and the ledger schema | **Needed** |
| B | Copy `scripts/` into target projects at setup | ❌ Rejected: version drift, repo bloat, more attack surface, and it breaks the PO "no traces" rule |
| C | Hooks: move all `require`s inside the fail-closed `try`; copy `normalizeAdo` in; find the plugin folder at run time (user-profile `installed_plugins.json` first, then `plugin-path.txt`); if it can't be found, exit 2 | **Needed, scoped:** only while hooks stay as an optional layer (see open question Q3) |
| D | A static test that fails if `node scripts/` appears anywhere under `skills/**` | **Needed**: stops the problem coming back |

**Recommendation: A + D now. C depends on Q3.**

### 1.5 What we need to do

1. Replace the 78 relative calls (the 73 the sub-agent counted plus 5 in the ledger schema).
2. Check the **non-migration** skills for the same pattern. This has not been audited (Q1).
3. Depending on Q3: rewrite the hook preamble (option C), **or** delete the hooks and `deployHooks()` if
   they stop being deployable at all.
4. Add the static test (D). If C is done, also add a deployed-hook test that copies the hook into a temp
   folder and expects exit 2 when the plugin can't be found.
5. If the hooks are kept, make sure setup-sync redeploys them. Any hand-wired copies are broken.

### 1.6 Can the issue remain after the fix?

Yes:
- **`$PLUGIN_DIR` doesn't resolve** in a project with no setup. The skills' fallback needs `$PLUGIN_DIR`
  in order to find `$PLUGIN_DIR` (`upgrade:55-56`, `rewrite:78-79`, `replatform:57-58`) [V]. That is Point 4.
  **PO decision 2026-11-09:** if automatic resolution fails, the skill **stops and asks the developer for
  the plugin directory**. See Point 4.
- **A plugin upgrade changes the install path** and `plugin-path.txt` goes stale. With C, the hooks fail
  closed: safe, but they block work until re-sync.
- **Stale copies:** any hook copy wired in before the fix stays broken until it is redeployed.

### 1.7 How to verify

1. The static test passes, with zero relative calls under `skills/**`.
2. If C is done, the hook probe exits with code **2**, not 1, when the plugin can't be found.
3. End to end: in a scratch git repo with **no setup**, run `UPGRADE ADO-999` through Step 1.
   `.claude/migration/999.checkpoint.json` should exist, and Claude should not have patched any path
   itself (check the transcript).
4. If C is done, in a scratch project with the hooks wired, try writing `options_approved` through Bash
   before approving. It must be blocked.

### 1.8 Security issues and risks

> **PO review (2026-11-09):** risk 1 **ignored** · risk 2 **agreed** · risk 3 **ignored**. The PO gave
> no rationale for ignoring risks 1 and 3; none is assumed here. Ignored risks stay listed for the audit
> trail and are not tracked as work.

1. **[Ignored by PO]** 🔴 **Approval control fails open (CWE-636).** Where the hooks are wired, the gates
   can be bypassed while the audit trail claims enforcement.
2. **[Agreed by PO]** 🟠 **The plugin-folder lookup can be tampered with.** `.claude/plugin-path.txt` sits
   in the repo, where Claude or a commit can edit it. Pointing it at a folder of permissive scripts would
   subvert every gate script. The same applies to the ledger value `payload.plugin_dir` proposed in
   Point 4: it is also an in-repo file that Claude can write.
   **Mitigation (agreed):**
   - The user-profile `~/.claude/plugins/installed_plugins.json` is the **first** source. It is outside
     the repo.
   - In-repo sources are used only when the registry finds nothing.
   - Every path is validated, whatever its source.
   - When an in-repo source is used, the resolved path and its source are shown to the developer.
   - `plugin-path.txt` is included in the integrity check.
   - The resolution order in Point 4 is revised to match.
   **Limitation:** the integrity check (`.hashes`) is itself in-repo and currently drifted (parent
   Defect D, S4). It is only a full mitigation once S4 (hashes held outside the repo) is done.
3. **[Ignored by PO]** 🟡 **Copying `normalizeAdo` into the hooks** means two copies could drift apart,
   and one ADO's approval might then satisfy another ADO's gate.
- **Related, already in the parent:** S11, `migration-gate` Bash blocking is plain string matching.

### 1.9 Design principles

- **Do not assume:** the code assumed the working folder is the plugin repo.
- **Fail closed:** a control that crashes must deny.
- **Single source of truth:** path resolution should go through `skills/shared/plugin-path-resolution.md`.
- **Test what you ship:** the tests run the plugin's own copy, never a deployed one.
- **Defence in depth:** it only counts if every layer actually executes.

### 1.10 Artifacts touched or depended on

- **Skills and specs:** `skills/upgrade/SKILL.md`, `skills/rewrite/SKILL.md`, `skills/replatform/SKILL.md`,
  `skills/shared/migration-ledger-schema.md`, `skills/shared/plugin-path-resolution.md`.
- **Hooks:** `_project-deploy/hooks/migration-gate.cjs`, `_project-deploy/hooks/approval-capture.cjs`.
- **Scripts:** `scripts/ado-normalize.cjs`, `scripts/setup-init-bootstrap.cjs` (`HOOK_FILES`, `deployHooks`,
  `.hashes`).
- **Docs and tests:** the setup-sync migration notes under `docs/migrations/`, the existing hook and
  checkpoint tests under `tests/`, and the new static and deployed-hook tests.

### 1.11 Open questions (do not assume)

- ~~**Q1:** Do skills outside the migration family also use relative `node scripts/` calls?~~
  **Answered [V] 2026-11-09: no.** A grep across `skills/**/*.md` finds them only in upgrade (30),
  rewrite (24), replatform (19) and migration-ledger-schema (5). The one other hit,
  `skills/shared/README.md:15` (`node scripts/gen-shared-index.cjs --write`), is a maintainer command run
  inside the plugin repo. It is correct as is, and the static test (option D) must allow it.
- **Q2:** Does Claude Code expose the plugin root to skill Bash calls (for example `CLAUDE_PLUGIN_ROOT`)
  with no project setup? If so, Point 4's bootstrap problem disappears. Unverified against the docs.
- ~~**Q2:** Does Claude Code expose the plugin root to skill Bash calls?~~ **Answered 2026-11-09 (from the
  documentation; still needs a runtime check):**
  - **Bash environment: no.** The manifest reference says: "The variables aren't present in the
    environment of commands Claude runs through the Bash tool … In skill, command, and agent content,
    write the `${...}` reference in the Markdown body instead, and Claude Code substitutes the path inline
    when it loads the content." (code.claude.com/docs/en/plugins/manifest-reference.md)
  - **Text substitution: yes.** "`${CLAUDE_PLUGIN_ROOT}` | The plugin's installation directory.
    Substituted only in plugin skills." (code.claude.com/docs/en/skills.md). `${CLAUDE_SKILL_DIR}`,
    `${CLAUDE_PROJECT_DIR}` and `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/<id>/`, which survives
    plugin updates) are substituted the same way.
  - **Plugin-shipped hooks** (`hooks/hooks.json` inside the plugin) run "when plugin is enabled", with no
    project setup, and get `CLAUDE_PLUGIN_ROOT` in their environment (code.claude.com/docs/en/hooks.md).
  - **This repo today [V]:** zero uses of `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_SKILL_DIR}` under `skills/`.
    The plugin has no `hooks/hooks.json`.
  - **Effect on Point 4:** `${CLAUDE_PLUGIN_ROOT}`, substituted into each migration SKILL.md, becomes
    resolution **step 0**. It is the documented source and comes from outside the repo. The registry
    resolver, the in-repo fallbacks and the PO's "stop and ask" stay as fallbacks if substitution is
    absent.
  - **Caveat (inferred, not documented):** substitution applies to skill content loaded by Claude Code.
    Shared specs that a skill opens with the Read tool are probably **not** substituted. Those must use the
    `PLUGIN_DIR` value that the skill sets.
  - **Runtime check required:** install the plugin from the marketplace, open a project with no setup,
    invoke the skill, and confirm the substituted absolute path appears in the skill text the model sees.
- **Q3:** Under the PO refinement, are `approval-capture` and `migration-gate` still deployed to target
  projects (keep `deployHooks()` and fix it), or deleted (parent Defect A says `deployHooks()` "becomes dead
  code to delete")? Option C applies only if they are kept.
  **PO 2026-11-09:** assess this on fresh evidence and ignore the parent's recommendation. The risk
  analysis is below. **Decision pending.**

#### Q3 risk analysis: what deleting `approval-capture` and `migration-gate` would mean

**What they do [V].**

| Hook | Event | Job | Used by |
|---|---|---|---|
| `migration-gate.cjs` (286 LOC, 250 test LOC) | PreToolUse on Write, Edit and Bash | Blocks writing `{ADO}-options.md` before the intake and coupling gates pass; target design docs before `options_approved`; cluster worktree files before `cluster_N_approved`/`skipped`. Blocks Bash commands that touch `.approvals.json` or set a protected gate (`migration-gate.cjs:7-20`) | Rewrite only |
| `approval-capture.cjs` (435 LOC, 296 test LOC) | UserPromptSubmit | Reads the **developer's typed prompt** for `APPROVE OPTIONS / PROCEED / APPROVE DESIGN / APPROVE CLUSTERS / SKIP CLUSTER`. Checks preconditions (7 design docs, no PARTIAL rows, a branch-head SHA for each cluster), then writes `.claude/migration/{ADO}.approvals.json`, mirrors to the ledger and the log (`approval-capture.cjs:1-19`) | Rewrite only |

Upgrade and replatform do not reference either hook [V].

**Where they are wired today [V].**
- This plugin repo's own `.claude/settings.json:64,74` registers both, from `_project-deploy/hooks/`. They
  are live in plugin development sessions, where the `../../scripts` path happens to resolve.
- In target projects they only run if someone wires them in by hand (see 1.1).

**Risks of deleting:**

| # | Risk | Severity | Evidence | Mitigation if deleted |
|---|---|---|---|---|
| D1 | **Rewrite can never merge a cluster.** `cluster-merge merge` Gate 1 needs `cluster_N_approved` in `approvals.json`, and only `approval-capture` writes it | 🔴 Breaks the skill | [V] `cluster-merge.cjs:164-169`, `rewrite:1956` | Port APPROVE CLUSTERS / SKIP CLUSTER into a `cluster-merge.cjs approve/skip` subcommand that the skill runs after the developer replies |
| D2 | **Loss of proof that a person approved.** UserPromptSubmit is the only point that sees what the *developer typed*. Without it, every approval is recorded by Claude. Approval-like text in the **source code being migrated** or in web research results could be taken as approval (prompt injection). Rewrite reads an entire codebase that has not been vetted, so the exposure is large | 🟠 High | [V] hook header; design reasoning | Accept, because the developer is present at each gate; or keep only `approval-capture` (see option K2) |
| D3 | **Approval no longer tied to the reviewed code.** `approval-capture` records each cluster's branch-head SHA at APPROVE CLUSTERS, and `cluster-merge` Gate 2 checks it at merge. If the port loses this, code could change between review and merge | 🟠 High | [V] hook header; `cluster-merge.cjs:5-9` | The D1 port must record the SHA at approval time |
| D4 | **No checks at approval time.** "7 design docs exist" and "no PARTIAL rows" would rely on Claude following instructions, unless moved into scripts | 🟡 Medium | [V] hook header | Move the checks into the D1 script / `checkpoint-ledger` |
| D5 | **One layer of defence left.** Cluster worktree writes are no longer blocked as they happen, including subagent writes. Only the merge-time check remains | 🟡 Medium | [V] `migration-gate.cjs:13-16` | Accept: the merge gate still stops unapproved code reaching the target branch |
| D6 | **Noisy breakage in plugin dev sessions** if the files go but `.claude/settings.json:64,74` still registers them. Every Write, Edit, Bash call and prompt then reports a hook error (exit 1, which doesn't block) | 🟡 Low | [V] | Remove the registrations in the same change (config, so the Write Gate applies) |
| D7 | **False assurance in the skill text.** `rewrite:276-301` (preflight), `:1071`, `:1645` and `:1956` claim hook enforcement | 🟡 Medium | [V] | Rewrite those sections in the same change |
| D8 | **Orphaned pieces.** `HOOK_FILES` and `deployHooks()` in `setup-init-bootstrap.cjs`, `ado-normalize.cjs` (check for other callers), 4 test files, and ADO-9007 / ADO-9012 docs that describe the hooks as delivered | 🟢 Low | [V] reference grep | Remove the code; add a retirement note to the ADO-9007 tracker for the audit trail |

**Risks of keeping them as they are (for balance):**
- They don't run in target projects.
- When wired by hand they fail open (1.1).
- Their `require` path is broken outside the plugin repo.
- They cost 721 LOC plus 546 test LOC to maintain.

**New option, enabled by the Q2 answer:**

| Option | What | Pros | Cons |
|---|---|---|---|
| K1 | **Delete both.** Port D1, D3 and D4 into scripts; fix D6–D8 | Least code; matches "runs without setup" | Accepts D2 and D5 |
| K2 | **Ship them as plugin hooks** in a plugin `hooks/hooks.json` using `${CLAUDE_PLUGIN_ROOT}`. Fix the `require` path and move all loading inside the fail-closed block | Run with no project setup (documented). Keep proof that a person approved, SHA binding and write-time blocking. Fix the path bug for good | They then run in **every session of every project** where the plugin is enabled: two node launches per Write/Edit/Bash and per prompt, so they need a fast exit when no `docs/migrations/` or `.claude/migration/` exists. Managed `allowManagedHooksOnly` policy can switch them off. The enable scope is not documented in detail |
| K3 | **Hybrid.** Keep only `approval-capture` as a plugin hook (the proof-of-approval part) and delete `migration-gate` | Keeps D2 and D3 protection at about half the code; only one per-prompt launch, nothing on each tool call | Accepts D5; needs the fast exit |

**Advisor recommendation:** **K3**, provided rewrite is meant to be used with real assurance.
- D2 is the only risk that no script can fix. A script can check *that* an approval was recorded, never
  *who typed it*. Only a UserPromptSubmit hook sees what the developer actually typed.
- `migration-gate` protection (D5) is mostly duplicated by the merge-time gates.
- If rewrite is not a near-term priority, **K1** is acceptable, as long as D1, D3 and D4 are ported in the
  same change. Without D1, rewrite cannot finish.

#### PO decision (2026-11-10): K3, the hybrid

**Decision.**
- Keep `approval-capture` and ship it as a **plugin hook** (`hooks/hooks.json` in the plugin, command
  `node "${CLAUDE_PLUGIN_ROOT}/hooks/approval-capture.cjs"`).
- **Delete `migration-gate`.**
- Accepted residual risk: **D5**. Cluster worktree writes are no longer blocked as they happen; the
  merge-time gates in `cluster-merge.cjs` remain.

**What this means for the rest of the plan:**
- **Point 1 option C is replaced.** There is no project-deployed hook preamble to fix. The plugin hook
  resolves `scripts/` through `CLAUDE_PLUGIN_ROOT`, which the hook environment gets (documented). So the
  broken `require('../../scripts/…')` and the `normalizeAdo` copy are both gone. **1.8 risk 3 no longer
  applies.**
- **The PO rule "if hooks are available, use them; if not, ignore them" still holds.** A managed
  `allowManagedHooksOnly` policy, or a disabled plugin, can stop the hook running. Rewrite therefore:
  - records `hooks_active` in the ledger;
  - when the hook is inactive, falls back to a script path: a `cluster-merge.cjs approve` / `skip`
    subcommand, which also records the SHA (D3) and runs the approval-time checks (D4). The skill runs it
    only after the developer types the keyword;
  - in fallback mode, D2 is accepted and logged as a `[FINDING]`.
  So the D1 port is still needed, as the fallback.

**Design details (agreed by PO 2026-11-10):**
- **P1. On a crash, approval-capture does not fail closed.** It exits 0 with a warning. Reason: it now
  runs on **every prompt in every project**, and exit 2 on UserPromptSubmit blocks the prompt. A crash
  would lock the developer out of Claude everywhere. Safety is kept downstream: if no approval is
  recorded, `cluster-merge` Gate 1 and `check-gate` still deny. This is consistent with the PO ignoring
  1.8 risk 1.
- **P2. Fast exit.** Return immediately unless the prompt matches the approval grammar
  (`APPROVE OPTIONS|PROCEED|APPROVE DESIGN|APPROVE CLUSTERS|SKIP CLUSTER` followed by an ADO). The prompt
  check comes before any file I/O or `require` of other plugin scripts.
- **P3. Remove the plugin repo's own registrations** in `.claude/settings.json:64,74`. Otherwise the plugin
  hook and the project hook both run on the same prompt, and approvals get written to `approvals.json`
  twice. This is a config change, so the Write Gate applies.

**Work items (all under the Write Gate):**
1. Create a plugin `hooks/hooks.json` that registers `approval-capture` (UserPromptSubmit) via
   `${CLAUDE_PLUGIN_ROOT}`.
2. Move `approval-capture.cjs` out of `_project-deploy/hooks/` into the plugin `hooks/` folder. Fix the
   loading (`CLAUDE_PLUGIN_ROOT`), and add the fast exit (P2) and the soft-fail behaviour (P1).
3. Delete `migration-gate.cjs` and its test. Remove both hooks from `HOOK_FILES` / `deployHooks()` in
   `setup-init-bootstrap.cjs`, and update its test.
4. Add `cluster-merge.cjs approve` / `skip` (the fallback), with SHA capture and the approval-time checks,
   and tests.
5. Rewrite `rewrite/SKILL.md`:
   - change the Step 0 preflight (`:276-301`) to an advisory that records `hooks_active`;
   - correct the enforcement wording at `:1071`, `:1645` and `:1956`;
   - add the fallback branch.
6. Remove the registrations in `.claude/settings.json:64,74` (P3).
7. Add a retirement note to the ADO-9007 tracker (where `migration-gate` was delivered).
8. **Check first:** does `ado-normalize.cjs` have other callers? Does `coupling-resolution-validate.cjs` or
   `intake-verify.cjs check-gate` lose its only caller once `migration-gate` is gone?

**How to verify:**
- **Plugin hook works with no setup:** in a project with **no setup**, `APPROVE CLUSTERS ADO-999` with a
  prepared cluster writes `approvals.json` through the plugin hook.
- **Fallback works:** with the hook switched off, the fallback writes the same record including the SHA,
  and `[FINDING]` is logged.
- **Fast exit:** an ordinary prompt in an unrelated project produces no file I/O (check the timing, or
  trace with `strace` / Process Monitor).
- **Soft-fail (P1):** force a crash, for example with a corrupt `approvals.json`. The prompt is not
  blocked, a warning appears, and `cluster-merge merge` still refuses.
- **No double-write:** in this plugin repo, one approval produces exactly one entry.

---

## Point 2: gates and routing depend on the project CLAUDE.md (analysed 2026-11-10)

### 2.1 What the issue is

Upgrade, replatform and parts of rewrite define their approval rules **by referring to the project
CLAUDE.md**. A project with no setup has no such CLAUDE.md. Four problems follow:

1. **The Write Gate is undefined.**
   - `upgrade/SKILL.md:20` says "The Write Gate (CLAUDE.md §0)" [V].
   - "Write Gate" appears 12 / 13 / 8 times in upgrade / rewrite / replatform. **None** of the three skills
     contains the `WRITE PENDING` prompt or a link to `write-gate-spec.md` (0 / 0 / 0) [V].
   - Without CLAUDE.md, Claude improvises the gate: its format, what counts as approval, and whether it
     shows the diff at all.
2. **Enforcement claims that aren't true.**
   - `upgrade:507` says "The INTAKE CONFIRMED gate is hook-enforced (AC-F1)". No hook in
     `_project-deploy/hooks` or `.claude/hooks` contains `INTAKE CONFIRMED` [V].
   - `upgrade:534` and `replatform:348` say the `manifest-read-guard.cjs` hook "arms after this write" [V].
     That hook exists only if setup deployed it (`setup-init-bootstrap.cjs:197`). It is registered in this
     plugin repo's own `.claude/settings.json:46` [V]. Whether setup registers it in target projects has not
     been checked first-hand.
3. **No routing for later sessions.**
   - `UPGRADE / REWRITE / REPLATFORM RESUME | STATUS ADO-x` and `SAVE TEST` are routed by CLAUDE.md §0a.
   - Upgrade's description lists only "upgrade, bump version, .NET 6 to 8, …" as triggers (`upgrade:3-10`)
     [V]. Even so, the skill tells the developer to type `UPGRADE RESUME ADO-{ID}` in a new session
     (`upgrade:384,446,469`) [V].
   - In a project with no setup, whether that phrase reaches the skill depends on Claude matching the
     word "upgrade" to the description. That is likely, not guaranteed.
4. **NEW [V]: keyword collision.**
   - The Write Gate reply is `APPROVE ADO-{ID}`.
   - The `icea-approve` skill's own description says it is "triggered by the keyword APPROVE ADO-{ID}
     without a slash command".
   - During an upgrade's residual-fix step, a developer's `APPROVE ADO-123` can therefore start
     icea-approve instead of releasing the pending write. This happens in projects with setup too
     (CLAUDE.md §0a maps the same keyword to icea-approve).

### 2.2 What happens if not resolved

- **The PO's "migrations run without setup" can't be met safely.** Source code gets written under a gate
  Claude has made up, which may not show a diff, and which may accept "ok" or "go ahead".
- **The audit trail claims enforcement that never happened.** That false assurance is the same problem
  type as Point 1.
- **Resuming is unreliable.** In a new session, the developer may get a general chat answer instead of a
  resume from the ledger. The work then restarts, or carries on without the ledger's gate state.
- **The wrong skill runs.** If icea-approve finds an ICEA with the same ADO number in the repo, it could
  mark an **unrelated document Approved**. If not, it fails confusingly while the source write stays
  pending.

### 2.3 Trade-offs

- **Copy the Write Gate into each skill:** self-contained, but a second copy can drift from CLAUDE.md §0.
  Better: put it once in a plugin spec, reached through `${CLAUDE_PLUGIN_ROOT}` (Point 1).
- **Prove approvals with the K3 hook for upgrade/replatform too:** consistent protection against
  injection, but the approval wording grows, and the fallback path (hook inactive) grows with it.
- **New migration-specific approval keyword:** removes the collision, but developers face one more
  keyword (Point 10 already counts too many) and one more difference from the rest of the plugin.

### 2.4 Options

| Option | Description | Verdict |
|---|---|---|
| A | **Self-contained gate definition.** Move the Write Gate rules (show the diff, show the path, the exact prompt, stop, which replies unblock) into one plugin spec, e.g. `skills/shared/write-gate-spec.md` (it exists). Every migration skill reads it through `${CLAUDE_PLUGIN_ROOT}`. Drop "(CLAUDE.md §0)" | **Needed** |
| B | **Make the claims true.** Replace "hook-enforced" with "instruction-enforced" unless the ledger shows `hooks_active=true`. Make the manifest-read-guard sentence conditional the same way | **Needed** |
| C | **Routing without CLAUDE.md.** Add to each migration skill's description: "Also triggered by `UPGRADE RESUME ADO-{ID}` / `UPGRADE STATUS ADO-{ID}`" (and the same for rewrite and replatform). Give the namespaced slash command (`/ai-assisted-development:upgrade RESUME ADO-{ID}`) as the reliable fallback in every "type X in a new session" message | **Needed** |
| D1 | **Collision fix, scoped keyword.** Inside migrations, the Write Gate reply becomes `APPROVE FIX ADO-{ID}` (with `APPROVE ALL FIX ADO-{ID}`). Plain `APPROVE ADO-{ID}` stays with icea-approve | Recommended |
| D2 | **Collision fix, guard in icea-approve.** icea-approve checks whether a migration ledger for that ADO has a pending write, and if so hands back to the migration skill | Rejected: it puts migration knowledge into an unrelated skill and depends on Claude-written state |
| E | **Extend the K3 hook** so it also captures the upgrade/replatform gate replies (`INTAKE CONFIRMED`, `APPROVE REPORT`, `APPROVE DESIGN`, `APPROVE FIX`) | Optional, for the PO. Same reasoning as K3 (only a hook proves a person typed it). Upgrade edits a working app in place, and the source code it reads is not vetted |
| F | Make CLAUDE.md §0/§0a a precondition (setup) | ❌ Rejected by the PO decision of 2026-11-09 |

**Advisor recommendation: A + B + C + D1. E deferred** (decide after Point 1 has shipped and K3 is
proven in practice).

### 2.5 What we need to do

1. Make `write-gate-spec.md` complete and self-contained for migrations: the prompt, the rules, the
   `APPROVE FIX` / `APPROVE ALL FIX` / `SKIP` replies, and the boundary rule. Reference it from all three
   skills through `${CLAUDE_PLUGIN_ROOT}`.
2. Replace the "(CLAUDE.md §0)" references (`upgrade:20` and similar; grep all three skills).
3. Correct `upgrade:507`, `upgrade:534` and `replatform:348`, and grep for any other "hook-enforced" or
   "hook arms" claims.
4. Add the RESUME/STATUS triggers to the three skill descriptions. Add the slash-command fallback to every
   "type … in a new session" message (upgrade alone has at least 3).
5. Change the Write Gate reply inside migration skills to `APPROVE FIX ADO-{ID}`. Add `APPROVE FIX` to the
   keyword tables in CLAUDE.md §0a and `_project-deploy/CLAUDE.md`, so projects with setup stay consistent.

### 2.6 Can the issue remain after the fix?

Yes:
- **The gate is still only an instruction.** In a project with no setup, nothing *forces* Claude to stop
  before a source write. Accepted under the PO decision. Option E reduces this risk for approvals, but does
  not block writes.
- **Routing by description is probabilistic.** The slash command is the only route that is guaranteed.
- **Old wording lingers.** Developers used to typing `APPROVE ADO-x` in migrations may keep doing so.
  Mitigation: when a pending migration write sees a plain `APPROVE ADO-x`, answer "use `APPROVE FIX
  ADO-x`" rather than proceeding.

### 2.7 How to verify

In a scratch git repo with **no setup**, run `UPGRADE ADO-999` to the residual-fix step:
1. The `WRITE PENDING` prompt appears in the exact format from the spec, with a diff.
2. Replying `ok` does **not** write. `APPROVE FIX ADO-999` writes. Plain `APPROVE ADO-999` gets the
   redirect message and icea-approve is **not** started.
3. In a new session, `UPGRADE RESUME ADO-999` resumes from the ledger. Then repeat with the slash-command
   form.
4. A static test: no `CLAUDE.md §0` references and no unconditional "hook-enforced" phrases in the
   migration skills.

### 2.8 Security issues and risks

1. 🟠 **Approval through injected text.** Without a hook, a reply that looks like a gate approval and
   appears in **content Claude reads** (source comments, README files, web research) could be treated as
   approval. Upgrade and rewrite read source code nobody has vetted. Mitigations: option E, plus a rule in
   the spec that only the developer's own message counts and quoted or file content never does.
2. 🟠 **Wrong approval (the keyword collision).** icea-approve could mark an unrelated ICEA document
   Approved. That corrupts the governance record of a different work item.
3. 🟡 **False assurance.** "Hook-enforced" in the audit trail when nothing enforced it, which misleads
   reviewers and auditors.
4. 🟡 **A gate Claude improvises may skip the diff.** The developer would then approve code they never
   saw.

### 2.9 Design principles

- **Self-contained skills:** no hidden dependency on host configuration.
- **Truthful claims:** documentation must match enforcement.
- **Unambiguous wording:** one keyword, one meaning.
- **Do not assume:** don't assume CLAUDE.md is present.
- **Proportionate defence:** a hook only where only a hook can prove what is needed.

### 2.10 Artifacts touched or depended on

- **Skills:** `skills/upgrade/SKILL.md`, `skills/rewrite/SKILL.md`, `skills/replatform/SKILL.md` (bodies and
  frontmatter descriptions).
- **Specs:** `skills/shared/write-gate-spec.md`, `skills/shared/migration-ledger-schema.md` (Status &
  Resume).
- **icea-approve:** `skills/icea-approve/SKILL.md` (description wording, to say it does not cover
  migration write approvals).
- **CLAUDE.md files:** `CLAUDE.md` §0/§0a and `_project-deploy/CLAUDE.md` §0/§0a (the `APPROVE FIX` rows).
- **Hooks:** `_project-deploy/hooks/manifest-read-guard.cjs` (wording only, unless the PO wants it moved to
  plugin hooks as well), and `approval-capture.cjs` (only if E is chosen).
- **Tests:** the new static test.

### 2.11 Open questions (do not assume)

- **Q5:** Is the scoped keyword `APPROVE FIX ADO-{ID}` acceptable, or does the PO prefer another word?
- **Q6:** Option E: extend the K3 hook to upgrade/replatform approvals now, or defer it?
- **Q7:** `manifest-read-guard`: only correct the wording (recommended), or also ship it as a plugin hook?
  It runs on every Read, which brings the K2 cost objection.
- **Q8 (fact to check):** does `stepWireSettings` register `manifest-read-guard` in target projects? The
  sub-agent says no, and it hasn't been checked first-hand.

---

## Points 3–13: evidence captured, analysis pending

### Point 3: intake coverage and roots

- [R] `intake-verify.cjs:204-209`: with no `graph.json`, `modules=[]`, so the "full accounting" check
  (exit 7) passes with nothing checked. The skills claim full coverage anyway (`upgrade:513`,
  `rewrite:540`, `replatform:208`).
- [R] `rewrite:565` passes no `--graph`. The default is relative to the cwd, and the cwd is the target
  folder (`resolve-migration-roots.cjs:168`), so it reads the wrong graph even in a set-up project.
- [R] Upgrade calls `intake-verify` without `--settings` (`upgrade:516`) and never runs
  `resolve-migration-roots`. It hard-fails with exit 3 when `migrationRoots` is absent
  (`intake-verify.cjs:121-133`). The command the error suggests itself exits 5 when there are no settings
  (`resolve-migration-roots.cjs:102-119`).

### Point 4: standalone-mode contract (direction decided by the PO)

- [V] (parent Defect A) The rewrite Step 0 preflight (`rewrite/SKILL.md:276-301`) hard-blocks when the
  hooks are not registered. The PO says to make it advisory and record `hooks_active`.
- [V] The `$PLUGIN_DIR` fallback in all four skills is circular (see 1.6). The skills say "if
  `plugin-path.txt` is absent, use the §1a resolver from `$PLUGIN_DIR/skills/shared/plugin-path-resolution.md`"
  (`upgrade:52-57`). The resolver itself works from any cwd through
  `~/.claude/plugins/installed_plugins.json`, falls back to a glob, and returns an **empty string** when it
  finds nothing (`plugin-path-resolution.md:57-88`) [V]. The only circular part is *reaching* it by reference.

#### PO decision (2026-11-09): stop and ask when `$PLUGIN_DIR` can't be found

**Decision.** When the plugin directory can't be resolved automatically, the migration skill **stops and
asks the developer for the plugin directory**. It does not guess, crawl the disk, or carry on with
relative paths.

**Resolution order (proposed; implements the decision):**

> Revised after the PO agreed security risk 1.8 #2: the out-of-repo registry comes first, and in-repo
> sources (which can be tampered with) are only fallbacks.

| Step | Source | Notes |
|---|---|---|
| 1 | Registry resolver (§1a), reading the user-profile `installed_plugins.json` and **copied into each migration SKILL.md** rather than referenced | Outside the repo, so it can't be changed by a commit. Removes the circular reference. About 12 lines per skill. A test checks each copy matches §1a |
| 2 | `.claude/plugin-path.txt` (set-up projects only) | In-repo fallback. Validate it, then show `Using plugin dir <path> (from plugin-path.txt)` |
| 3 | Ledger `payload.plugin_dir` (resume only) | In-repo fallback. Read the JSON file directly with `node -e`, because `checkpoint-ledger.cjs` needs `$PLUGIN_DIR`. Validate it, then show the path and its source |
| 4 | **STOP and ask:** *"Plugin directory not found. Paste the path to the installed ai-assisted-development plugin (the folder containing `.claude-plugin/plugin.json`)."* | No default, no guess |

**Validation of a developer-supplied path:**
- `<path>/.claude-plugin/plugin.json` exists and its `name` is `ai-assisted-development`.
- `<path>/scripts/checkpoint-ledger.cjs` exists.
- Normalise `\` to `/`, and always use the path in double quotes.
- Reject any path containing `"`, `` ` ``, `$(` or a newline.
- On failure, show what is missing and ask again. Never proceed with an unvalidated path.

**Persistence (agreed by PO 2026-11-09, Q4):** store the validated path in the migration
ledger as `payload.plugin_dir`, **not** in `.claude/plugin-path.txt`, to keep to the "no traces in the
source repo" rule. Log a `[FINDING]` in the migration log recording that the path was supplied by the
developer.

**Open question:**
- ~~**Q4:** Should the supplied path be remembered in the ledger, or asked for again in every session?~~
  **Answered 2026-11-09: save it in the ledger** (`payload.plugin_dir`). It is re-validated and shown to the
  developer on every resume, because it is an in-repo source (security risk 1.8 #2).
- [R] `migration-source-detect.cjs:258-342` degrades gracefully when there is no state file, graph or
  architecture docs. This is a good pattern to copy elsewhere.
- [V] (parent) Without hooks, `cluster-merge` Gate 1 can never pass. The fix (port the APPROVE/SKIP CLUSTER
  handlers into `cluster-merge.cjs approve/skip`) is already designed in the parent.

### Point 5: git only; state not ignored

- [R] `cluster-merge.cjs:33` runs `git rev-parse` at module load. Rewrite worktrees go under
  `$REPO_ROOT/.claude/worktrees/` (`rewrite:1879-1899`). `upgrade-orchestrate.cjs:55-57` uses a tag and a
  branch. There is no git/TFVC preflight, and there are zero `tfvc` hits across the family.
- [R] `migration-ledger-schema.md:16-17` says the ledger is "git-ignored, never committed".
  `.claude/migration/`, `.claude/worktrees/` and `active-task.json` are not in `GITIGNORE_BASE`
  (`setup-init-bootstrap.cjs:222-255`). The PO says to warn and not auto-edit `.gitignore`.
- [R] (parent) `cluster-merge.cjs:112` runs `git add -A` and can commit `.claude/migration/*` into cluster
  branches.

### Point 6: B-series defaults off

- [R] `rewrite-bal.cjs:93` defaults `--b-series` to `false`. `rewrite:2109` names no source for the flag.
  Without `business-context.md`, the hard completion block quietly becomes a warning.

### Point 7: test-plan handoff mismatch

- [R] test-plan auto-detect looks at `.claude/migrations/{ID}/payload.*` (`test-plan/SKILL.md:83-85`), but
  the real ledger is `.claude/migration/{ADO}.checkpoint.json`.
- [R] The output path `docs/Release{R}/Sprint{S}/…` (`test-plan:65-72`) can't be resolved from a migration
  ledger. Rewrite expects `docs/migrations/{ADO}/` (`rewrite:2160`) and passes `--combine-only`, a flag
  test-plan does not define.

### Point 8: confirmed bugs

- [V] **Coupling keyword mismatch.** The gate table says `APPROVE COUPLING ADO-{ID}` (`rewrite:65`), but
  Step 1.5 waits for `COUPLING-GATE-CONFIRMED` (`rewrite:634`).
- [V] **Phantom tracker.** Replatform says "Update `migration-tracker.md`" 9 times (`:260`, `:417`, …), and
  no step creates the file. The ledger schema's resume path falls back to it
  (`migration-ledger-schema.md:160,211,231`).
- [V] **Wrong log filename.** Upgrade's final check looks for `ADO-{ADO_ID}-migration-log.md`
  (`upgrade:997`), but the log is created as `migration-log.md` (`:330`), so it always warns "Missing".
- [V] **Gate recorded too early (ordering hazard).** The `design_approved` set-gate block (`rewrite:1590-1597`)
  appears *above* the judge gate and the APPROVE DESIGN prompt (`:1605-1643`). The text says "After APPROVE
  DESIGN", but Claude reads the file in order. This is plausible, not proven.
- [R] (parent) **Cluster branch name mismatch.** Rewrite creates `cluster-{ADO}-{N}` (`rewrite:1899`), but
  `cluster-merge.cjs:106` expects `cluster/${ado}-${n}`.
- [V] (parent Defect B) **Missing `--skill` flag.** Rewrite and replatform call `intake-verify check-gate`
  without `--skill`, so it always exits 10.
- [R] **Duplicate tool check.** Upgrade checks for the tool twice: a `command -v` table (`:198-217`), then
  `upgrade-tool-preflight.cjs` (`:220-247`).
- [R] **Template headings in the skill outline.** A runbook template embedded in upgrade/SKILL.md has
  `## Step` headings (`:180-192`) that show up in the skill's heading outline.

### Point 9: duplicated preamble

[R] Blocks that are near-identical across the three skills:

| Block | upgrade | rewrite | replatform |
|---|---|---|---|
| Script preflight | 98–116 | 170–187 | 96–112 |
| Migration log + lessons init | 326–370 | 189–258 | 163–197 |
| Friction-reduction paragraph (word for word) | 130–133 | 417–420 | 146–149 |
| Roots resolution | — | 312–337 | 119–143 |
| Intake + intake-verify + payload | 510–535 | 526–590 | 205–216 |
| Context-check "Surface this and STOP" blocks | 11× | 11× | 9× |
| Test-plan handoff | 959–982 | 2137+ | 698+ |

- Candidate: move these into one `skills/shared/migration-common.md`. Saves an estimated 350–450 lines with
  no safety impact.
- Status and Resume handling is already de-duplicated into the ledger schema. That is the pattern to follow.

### Point 10: gate inflation

- [V] **Claimed gates.** Upgrade claims "3 total" (`upgrade:86`). Rewrite claims "5 on a clean run"
  (`rewrite:63`).
- [R] **Upgrade on a simple case (.NET 6→8, small app): about 7 stops.**
  1. Friction offer.
  2. Target version.
  3. INTAKE CONFIRMED.
  4. APPROVE REPORT.
  5. APPROVE DESIGN, even when the decisions doc says "No architectural decisions required"
     (`:740-764`).
  6. One APPROVE per residual fix.
  7. Developer-executed hops.
- [R] **Rewrite on a simple case (small Express→.NET app): 9+ stops.**
  1. Friction offer.
  2. Target folder.
  3. Roots.
  4. Oracle mode.
  5. Coupling.
  6. APPROVE OPTIONS.
  7. Delivery concerns.
  8. APPROVE DESIGN, after 7 docs.
  9. APPROVE CLUSTERS, once per wave.
  10. Test-plan review.
- [R] **Rewrite reply keywords.** There are about 17 distinct keywords, including
  "I ACKNOWLEDGE COUPLING JUDGE ITERATION 4" (`rewrite:634-1981`).

### Point 11: rewrite design-doc load

- [R] **Fixed doc count.** 7 design docs whatever the app size (`rewrite:1295`).
- [R] **5-file revision loop (943 lines).** design-revision, document-orchestrator, document-feedback,
  document-graph-derive and option-change all cross-reference each other. design-revision-spec is
  required up front even when no revision happens (`rewrite:1273-1278`).
- [R] **Context per run.** About 95–110K tokens of instructions in the main session. The skill itself
  estimates 80–135K (`rewrite:124-125`).
- [R] **golden-master-spec is 576 lines.** Upgrade cites it only as an optional secondary smoke test
  (`upgrade:789`).

### Point 12: upgrade research and checkpoint layering

- [R] **Four overlapping sources of breaking-change facts.**
  1. The breaking-changes agent.
  2. Cache plus WebSearch.
  3. The 3-pass intake (`:408-486`).
  4. The migration-research agent.
- [R] **Three caches.**
  1. Tier 1/2 docs (`:263-271`).
  2. `upgrade-knowledge-cache` (`:300-316`).
  3. `research-cache` (`:582-596`).
- [R] **Adapter script.** `upgrade-checkpoint.cjs` (132 LOC) is an adapter over `checkpoint-ledger.cjs`.
  Rewrite and replatform call `checkpoint-ledger --skill=` directly, and the skill's own DECISION comment
  admits the duplication (`upgrade:119-126`).
- [R] **Verify trusts Claude.** `upgrade-orchestrate verify` accepts `--hop-results=pass|fail` as reported
  by Claude (`:80`). It does not check anything independently.

### Point 13: speculative features loaded by default

- [R] **Candidates.**
  - BYO design (`rewrite:1114`, `byo-design.md`).
  - The 3-tier option-change spec (272 lines).
  - Design-revision and feedback cascades.
  - TCO inside rewrite options (mainly a hosting question).
  - Well-Architected scoring and ERL in replatform.
  - Coupling-judge iteration loops.
  - 4 oracle modes.
  - The 8-item delivery-concerns checklist.
  - The RECOVER / REAUTHOR / RETRY orphan-document protocol (`rewrite:1395-1579`, about 185 lines).
- [R] **Redirect stubs.** `upgrade/references/judge-inline.md` and `checkpoint-inline.md` are redirect stubs
  that nothing references.
- [R] **Unreferenced shared refs.** `refs/shared/clean-architecture.md` and `fullstack-integration.md` are
  reachable only from strategies, the README and the freshness manifest. No skill references them.
- Context from the parent: real use is 2 upgrade runs, **0 rewrite runs and 0 replatform runs**.

---

## Simplification candidates (from the overkill audit, not yet agreed)

| # | Cut or merge | ≈ Lines saved | Safety impact | Must keep |
|---|---|---|---|---|
| A | One `migration-common.md` for the duplicated preamble (Point 9) | 350–450 | none | Exit-code tables, fail-closed intake-verify |
| B | Replace 31 context-check blocks and 25 banners with one rule | ~250 | low | Ledger gate writes at each step |
| C | Upgrade: one tool preflight; merge intake, gap/risk and decisions into one report; auto-skip APPROVE DESIGN when there are no RED/BLOCKER items; one breaking-change source and one cache | ~200, 1–2 stops, ~10K tokens | low | Classifier router, baseline tag, commit per hop, Write Gate, VERIFIED/INFERRED tags |
| D | Rewrite: design docs scaled to app size; table-driven set-gate and failure blocks | 200–250 | low–medium | Design-judge check, PARTIAL hard block |
| E | Merge the 5-file design loop into one ~400-line spec, loaded only when a revision is triggered | ~500 | low | Option-change classification rule |
| F | Split golden-master into a ~100-line core plus an appendix | ~9K tokens (upgrade) | none | Explicit oracle choice and assurance ceiling |
| G | Fold `upgrade-checkpoint` into `checkpoint-ledger --skill=upgrade` | 132 + 157 test | none | Ledger schema |
| H | Drop the hand-maintained trackers; render resume state from the ledger | ~100 | none | Ledger as the primary resume record |
| I | Delete the redirect stubs; mark unreferenced shared refs offline-only or remove them | ~430 | none | — |
| J | Make BYO, option-change and Well-Architected opt-in | context only | none | Same critic scrutiny for BYO |

---

## Decision log

| Date | Decision | Rationale | Rejected |
|---|---|---|---|
| 2026-11-09 | Review tracked here as the detailed analysis of parent Issue 2; parent PO decision (migrations run without setup) treated as binding | Avoid duplicate tracking; keep one decision source | Folding all detail into the parent (already 554 lines) |
| 2026-11-09 | When `$PLUGIN_DIR` can't be resolved automatically, the migration skill stops and asks the developer for the plugin directory (validated before use) | PO: do not assume; a wrong or guessed path runs the wrong gate scripts | Crawling the disk for the plugin; carrying on with relative paths; copying `scripts/` into the project; making setup a precondition |
| 2026-11-09 | Point 1 security review: risk 1 (hooks fail open) and risk 3 (`normalizeAdo` copy drift) ignored; risk 2 (plugin-folder lookup tampering) agreed. Resolution order revised so the user-profile registry comes first, with in-repo sources as validated, disclosed fallbacks | PO review; rationale for ignoring risks 1 and 3 not stated | In-repo `plugin-path.txt` or ledger value as the first source |
| 2026-11-09 | Q4: a developer-supplied plugin directory is saved in the migration ledger (`payload.plugin_dir`) and re-validated and disclosed on every resume | PO: avoid asking again each session; ledger keeps the "no traces in the source repo" rule | Asking every session; saving it to `.claude/plugin-path.txt` |
| 2026-11-09 | Q2: `${CLAUDE_PLUGIN_ROOT}` substituted into SKILL.md text becomes PLUGIN_DIR resolution step 0 (documented; runtime check pending) | Documented, outside the repo, needs no setup | Env-var lookup in Bash (documented as unavailable) |
| 2026-11-10 | Q3: **K3**. Keep `approval-capture` as a plugin-shipped hook (`${CLAUDE_PLUGIN_ROOT}`); delete `migration-gate`; script fallback (`cluster-merge approve/skip`) when hooks are inactive. Accepts D5 | Only a UserPromptSubmit hook can prove a person approved (D2); merge-time gates cover most of D5; plugin hooks need no project setup | K1 delete both (loses D2/D3 protection); K2 keep both as plugin hooks (a node launch on every tool call in every project) |

## Next steps

1. Point 1 **decided** (A + D + K3 with P1–P3). Remaining before implementation: runtime-check `${CLAUDE_PLUGIN_ROOT}` substitution.
2. PO: decide Point 2 (Q5–Q7; recommendation A + B + C + D1, E deferred). Then continue with Point 3.
3. Decide whether the Point 8 bugs and parent Defects B and C ship together as one small fix under ADO-001
   (Write Gate applies).
