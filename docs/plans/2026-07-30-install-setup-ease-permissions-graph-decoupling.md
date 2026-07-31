# Plan: Install/Setup Ease + Path-Scoped Bash Permissions + Graph Decoupling

**Status:** ✅ Implemented — all phases complete (install.sh dispatcher deferred pending S10 validation)
**Created:** 2026-07-30
**Owner:** vivek.rawat@kirkland.com
**Status lifecycle:** `📋 Planned` → `🚧 In progress` → `✅ Implemented` (update this line
and the per-phase boxes in *Implementation Sequencing* as work lands).

## Context

Three areas of improvement, each driven by concrete edge-case analysis:

1. **Single install entry point** — make `install.sh` a smart dispatcher.
2. **Path-scoped bash permissions** — `stepWireLocalSettings` exists but is incomplete.
3. **Setup command UX gaps** — setup-init, setup-sync, and setup-teardown each have
   silent failure points and usability issues identified below.
4. **Decouple the graph pipeline from architect** — extract a deterministic `module-derive`
   step and split graph-create out of architect (sequential; sets up future parallelism).

`.claude/settings.local.json` is gitignored and personal — never cleaned by the plugin.

> **Note (decouple before parallelising):** verified that the graph pipeline is
> architect-*doc*-independent (module derivation always comes from the directory tree, done
> 3× today). This plan performs the **decoupling** — a new deterministic `module-derive`
> step + extracting graph-create out of architect — kept fully **sequential** (single-writer
> model preserved). The **parallelisation** layer (reusable fan-out primitive) is spun out
> to `docs/proposals/parallel-execution-primitive.md` for future refinement. See Issue 2 +
> the Deliverable section. You cannot safely parallelise what you have not first decoupled.

---

## ⚠ Critical Review Refinements (2026-07-30, iterations 1–2 — code-verified)

**These corrections SUPERSEDE conflicting details in the sections below.** Each was verified
against the actual source, not assumed.

**R1 — Installer flag translation (Part 1, CRITICAL).**
Verified: `install.sh` & `install.cjs` use `--update/--uninstall/--yes`; `install.ps1` uses
PowerShell switches `-Update/-Uninstall/-Yes` (`param([switch]$Update,[switch]$Uninstall,[switch]$Yes)`).
Forwarding raw `$@`/`%*` to `install.ps1` **silently drops** bash-style flags → a requested
`--update` runs a **fresh install**. The dispatcher (in `install.sh`) and `install.cmd` MUST
translate when delegating to PowerShell: `--update`→`-Update`, `--uninstall`→`-Uninstall`,
`--yes`→`-Yes`. bash→node forwarding is fine (identical flag style). Verify with
`install.cmd --uninstall --yes` and a delegated `bash install.sh --update`.

**R2 — WSL `bash` false-positive (Part 1 / install.cmd).**
`where bash` on Windows often resolves to `System32\bash.exe` (the WSL launcher) even when
Git Bash is absent. Running `install.sh` under WSL breaks Windows path assumptions (`%~dp0`
is `C:\...`; WSL needs `/mnt/c/...`). `install.cmd` should prefer Git Bash explicitly (e.g.
probe `C:\Program Files\Git\bin\bash.exe`) and treat a WSL-only `bash` as "not available" →
fall through to PowerShell.

**R3 — Dispatcher trigger may not catch the winpty-less mintty hang (Part 1).**
`_bash_can_prompt` (`true >/dev/tty`) can succeed-for-write in mintty even when interactive
reads misbehave, so the dispatcher may NOT fire in exactly the case the winpty block covers
when winpty is absent. Verify the probe against a real winpty-less mintty; if it misses,
key delegation on "`MINGW/MSYS` shell **and** `winpty` absent" instead of the `/dev/tty` probe.

**R4 — repo-detect writes `repo_type`, NOT `detected_repo_type` (Part 3, CRITICAL).**
Verified: architect Step 4 reads `dream-init-state.json.repo_type`; architect Step 1a writes
`repo_type`; Phase 2 & graph-sync use `detected_stacks[]`. `repo-detect.cjs` MUST write the
existing fields — `repo_type` (primary) + `detected_stacks[]` (list). Every occurrence of
`detected_repo_type` in this plan means `repo_type`.

**R5 — module-derive must NOT put skeleton nodes in graph.json with `type:"unclassified"` (Part 3, CRITICAL).**
Verified: `graph-json-schema.md:86` — `type` is **required**, enum
{service·repository·ui·datastore·external-api·shared-lib·domain}. `"unclassified"` violates
the schema and would corrupt the authoritative `graph.json`. Revised design:
- `module-derive` writes a SEPARATE, non-schema-bound artifact
  `.claude/graph/.module-skeleton.json` = `{ generatedAt, structure, modules:[{id,module,domain,paths,entryPoint}] }`.
- `graph-extract-edges.js` **stays inside graph-create** — it requires a schema-valid
  `graph.json` with nodes (verified: `process.exit(2)` if unreadable or `nodes` empty,
  lines 26–29). It reads only `nodes`/`paths`/`edges`, never `type`.
- graph-create reads the skeleton → writes schema-VALID nodes (real `type`) → runs
  graph-extract-edges → projects index + detail files.
- Benefit preserved: module list + paths derived ONCE, consumed by both architect docs and
  graph-create ⇒ boundary consistency. `graph.json` is only ever written in final valid
  form — this ALSO removes the "interrupted setup leaves an orphaned skeleton graph.json" risk.

**R6 — module-derive must NOT compute fingerprints in Node (Part 3).**
Verified: `graph-json-schema.md` + graph-sync state fingerprints come from the BASH
`graph_module_fingerprint` helper — "a Node re-hash would diverge." A Node fingerprint would
mark every module STALE on the first `/graph-sync`. Therefore `module-derive` produces module
list + paths ONLY; fingerprints stay owned by the existing bash helper, computed during
graph-create/graph-sync. (Bonus: avoids a hard bash dependency in the node-fallback environment.)

**R7 — repo-detect must reach parity with architect Step 1 (Part 3).**
Architect Step 1 detects 12 types with specific ordering (VSTO before ASPNET_FRAMEWORK; Python
priority Django→FastAPI→Flask). `repo-detect.cjs` must reproduce that full ladder + ordering;
then architect Step 1 detection is removed (single detection source → no drift). Reuse the
same ladder for architect Step 7b external-dir detection.

> Net effect on Phase C: `module-derive` is now purely "module list + paths → a private
> `.module-skeleton.json`" (no graph.json write, no fingerprints, no edge extraction). All
> graph.json construction, fingerprinting, and edge extraction stay in `graph-create`. This
> is lower-risk and keeps every existing graph contract intact.

---

## ⚠⚠ Stress-Test Refinements (2026-07-30, iteration 3 — code-verified)

Adversarial pass. **These supersede conflicting details, including R-series where noted.**

**S1 — Part 2 Change A (hook permission entries) is a FALSE PREMISE. REMOVE IT.**
Verified `setup-init-bootstrap.cjs:80`: *"hooks (which run via hook runner, not Bash tool)."*
Claude Code executes settings.json hooks via its hook subsystem, NOT the Bash tool — so a
hook command `node .claude/hooks/icea-floor.cjs` **never** triggers a `Bash(...)` permission
prompt. Gap 1 ("first Write prompts for icea-floor.cjs") does not occur. **Drop Change A**
(the `Bash(node .claude/hooks/*.cjs)` entries) — it authorises a path that is never gated.
Part 2 keeps only Change B (utilities) + Change C (stale-path guard).

**S2 — teardown CONFIRM lives in TWO places (confirms Issue 7 scope).**
Verified: `setup-teardown.cjs:421` (`ans.trim() !== 'CONFIRM'`) AND `skills/setup-teardown/SKILL.md`
Step 3. The case-insensitive fix must touch BOTH — the plan already says so. ✔

**S3 — Part 2 overclaims: `find` prompts persist.**
Verified architect uses `find` 22×; graph-sync likewise. The utility allowlist intentionally
omits `Bash(find:*)` (ADR 0054 forbids it). So `find` — the single largest prompt source in
architect/graph-sync — **still prompts** after Part 2. Reword Gap 2: Part 2 removes prompts
for `ls/grep/cp/mkdir/sed/which`, but `find` remains gated by design. If find-prompt volume is
unacceptable, that is a SEPARATE ADR-0054 revisit, not part of this plan.

**S4 — new `graph-create` skill: registration surface is larger than stated (Phase C).**
Adding `skills/graph-create/SKILL.md` also requires: entry in `.claude-plugin/plugin.json`
`components.skills`; the marketplace manifests via `scripts/sync-config.sh`;
`check-version-consistency` alignment; and a DECISION on invocation model — **internal helper**
(invoked "Read SKILL.md and execute", like architect is by setup-init — NO command stub) vs a
**user command** (needs `commands/graph-create.md` + `_project-deploy/commands/` + `STUB_FILES`
in bootstrap). Recommend **internal helper** (no stub) to minimise surface — graph-create is a
setup/graph-sync implementation detail, not a user-facing command.

**S5 — removing architect Step 7 CONTRADICTS ADR 0038 (Phase C deliverable).**
Verified `docs/adr/0038-*.md:26`: *"The architect skill generates the graph (Step 7)."*
Moving graph generation to graph-create must ship with a **NEW, superseding ADR** (e.g.
`00NN-graph-create-owns-graph-generation.md`). **ADR 0038 itself is NOT modified** — ADRs are
immutable historical records; the new ADR references 0038 and records the superseding decision.
Only non-ADR prose (DEVELOPER-GUIDE / setup-init.md Step 3 that says "architect generates the
graph") is updated to point at graph-create. Add the new ADR as an explicit Phase C artefact.

**S6 — graph-sync consuming the shared skeleton is REQUIRED, not optional (upgrades earlier text).**
graph-sync Step 4 derives modules independently via its own `find`. If module-derive/graph-create
use one derivation and graph-sync uses another, the FIRST `/graph-sync` after setup sees
different boundaries ⇒ spurious rename/remove/add churn. Therefore graph-sync MUST consume the
same derivation as module-derive (shared helper), or the two derivations must be provably
identical. Change the `skills/graph-sync/SKILL.md` line from "optional" to **required**.

**S7 — orchestration/manifest ownership for detection + module-derive needs explicit design (Phase C).**
`repo-detect.cjs` cannot call the LLM, so the AMBIGUOUS→LLM-fallback loop must be driven by
`setup-init.md` (the skill), not the script. Decide + document: do `repo-detect` and
`module-derive` run as bootstrap steps (deterministic, manifest-tracked, `markStep`) or as
explicit early skill steps? They MUST run before architect. Specify the manifest step ids and
ordering so resume/idempotency behave (mirror the existing `isDone`/`markStep` pattern).

---

## ⚠⚠⚠ Stress-Test Refinements (2026-07-30, iterations 4–5 — code-verified)

Deeper adversarial pass on security, cross-doc consistency, and the dispatcher's core premise.

**S8 — README quick-start table was STALE (fixed).**
The table said `install.cmd` "Tries bash → PowerShell → Node.js", but iteration-2 reordered the
actual `install.cmd` to **Git Bash → Node.js → PowerShell** (to dodge WSL bash + the PS flag
mismatch). Table corrected. Lesson: keep the README table and the `install.cmd` body in lockstep.

**S9 — Part 2 Change B auto-allowing `Write(.claude/**)`/`Edit(.claude/**)` is a SECURITY REGRESSION (fixed).**
Those entries would let ANY write to `.claude/hooks/*.cjs` and `.claude/settings.json` proceed
**without a prompt** — i.e. silently un-gate the very hooks (icea-floor, secrets-check,
script-review) and settings that enforce this plugin. A prompt-injected instruction could
rewrite an enforcement hook unprompted. **Removed `Write(.claude/**)` and `Edit(.claude/**)`
from the managed set**; keep `Read(.claude/**)` + narrow `Edit(CLAUDE.md)`/`Edit(memory/*.md)`.
Writes under `.claude/` stay prompted (or a future scoped rule may allow only safe subtrees,
never `hooks/` or `settings*.json`).

**S10 — The dispatcher may NOT actually fix the mintty hang (Part 1, CORE-PREMISE RISK).**
The hang cause is mintty not allocating a Windows console. But `powershell.exe` and `node`
spawned from that SAME console-less mintty may ALSO fail interactive prompts (`Read-Host` /
readline can hang identically). So delegating might just relocate the hang. **Before building
the dispatcher, empirically confirm** that PowerShell/Node interactive prompts work when spawned
from a winpty-less mintty. If they don't, the correct fix is guidance ("re-run under winpty, or
use `install.cmd` from CMD"), NOT silent delegation. This gates whether Part 1's dispatcher is
worth building at all.

**S11 — MSYS path mangling when delegating (Part 1).**
`exec node "$_DISP_DIR/install.cjs"` and `-File "$_DISP_DIR/install.ps1"` pass a Git-Bash path
(`/c/Users/.../install.cjs`). MSYS may or may not convert it to `C:\...` for the native exe; an
unconverted `/c/...` fails PowerShell `-File` / node resolution. Normalise `_DISP_DIR` to a
Windows path before `exec` (reuse `install.sh`'s `to_win_path`), or set `MSYS2_ARG_CONV_EXCL`
appropriately. Verify on the real OneDrive-spaces path.

**S12 — Git Bash probe in `install.cmd` misses common install locations (Part 1).**
`%ProgramFiles%\Git\bin\bash.exe` misses: 32-bit Git on 64-bit Windows
(`%ProgramFiles(x86)%\Git`), and user-scope installs (`%LOCALAPPDATA%\Programs\Git`). Probe all
three before falling through to Node.

**S13 — `setup-status` placeholder scan will FALSE-POSITIVE (Part 3, Issue 4 fix).**
The plugin's own CLAUDE.md §2 legitimately contains `{ADO_ORG}`/`{ADO_PROJECT}`/`{ADO_URL}` as
documented template tokens. A whole-file scan for `{ADO_` flags a correctly-set-up project.
Scope the scan to the specific §2 identity LINES (Organization/Project/ADO URL values), not the
whole file, and only flag when those value fields still hold the token.

**S14 — `.claude/graph/.module-skeleton.json` must be gitignored (Part 3).**
`.claude/graph/` is COMMITTED (graph.json + index + detail files are PR-reviewed). The new
transient skeleton is a build artifact and would add PR noise + go stale vs graph.json. Add it
to `GITIGNORE_BASE` in `setup-init-bootstrap.cjs`. (Also confirm the extractor/consumers ignore
dotfiles in `.claude/graph/`.)

**S15 — Cascading edits from removing architect Step 1/Step 7 (Part 3).**
architect Step 4 guards read `repo_type` and emit "re-run Step 1a" errors; other steps reference
"Step 7". After the refactor those step references dangle. Audit architect/SKILL.md for every
"Step 1a"/"Step 7"/"Bootstrap Phase 2 (from Step 1)" reference and update guard messages, or
users get error text pointing at steps that no longer exist.

**S16 — ADR 0038 is only PARTIALLY superseded (refines S5).**
0038 = "knowledge graph is the single orientation layer" — that decision STANDS. Only the
sub-claim "the architect skill generates the graph (Step 7)" moves to graph-create. So:
- Do NOT stamp 0038 "Superseded" (it isn't); **do not modify the 0038 file at all** (per your
  directive + it's only partially affected).
- New ADR 0056 records "graph-create owns graph generation; 0038's orientation-layer decision
  unchanged," and references 0038.
- Record the linkage in `docs/adr/README.md` index only (index row is not the ADR body): note
  next to 0038 "(graph generation moved to 0056)" and add the 0056 row. Next free number = **0056**.
- Repo convention note: superseded ADRs here normally get a `Status:` line (see 0017), but since
  0038 is only partially affected AND you asked not to modify it, we deviate deliberately and
  keep the record in the new ADR + index. ⟵ confirm this is acceptable.

**S17 — Change C `managedPrefixes` filter still too broad (RESOLVE before implementing).**
The re-stamp filter drops any entry starting `Bash(node `, which would delete a developer's
legitimate custom `Bash(node /some/other/tool.cjs)`. Narrow the "managed" match to the plugin's
own scripts path prefix (and the exact utility strings), not the generic `Bash(node ` prefix.

**S18 — malformed `settings.local.json` silently discards `additionalDirectories` (Part 2).**
`stepWireLocalSettings` does `try { local = JSON.parse(...) } catch(_) {}` → on a hand-edit
syntax error, `local` resets to `{}` and the subsequent write DROPS the user's
`additionalDirectories`/`phaseD`/custom allows. On parse failure, WARN and abort the settings
write (don't silently reset) so external-repo config isn't lost.

---

## Implementation Sequencing

Ordered by risk/independence so value lands early and the risky refactor is isolated.
Each phase is independently shippable/verifiable.

**Phase A — low-risk, fully independent (do first):** 🚧 mostly done
- Part 1: `install.cmd` ✅ + README quick-start table ✅. `install.sh` dispatcher ⏸ DEFERRED
  pending S10 empirical validation (may just relocate the mintty hang — verify first).
- Part 2: extend `stepWireLocalSettings` ✅ (Change B utilities + C stale-path guard; A withdrawn
  per S1; S9 no broad Write; S17 append-only; S18 malformed-json warn).
- Part 3 text-only: ✅ setup-init resume hint (`printSummary`); ✅ setup-status scoped placeholder
  scan (1a-ii, S13); ✅ setup-sync (Step 1c prereq + Step 4 migration header + Step 7 graph-sync
  prominence); ✅ setup-teardown (case-insensitive CONFIRM in `.cjs`+skill, `--rules` empty guard,
  `--state` cross-scope warning, pre-commit `.local.bak` collision guard in bootstrap).
- Deliverable: ✅ `docs/proposals/parallel-execution-primitive.md` + README row.

  Verify before commit: `node -c` on both edited `.cjs` (done ✅); run `/setup-status` on a
  test project to see the new "CLAUDE.md identity" line; run bootstrap on a temp project to
  confirm the new utility permissions land in `settings.local.json` without a broad Write rule.

**Phase B — medium-risk (do second):** ✅ done
- `scripts/repo-detect.cjs` ✅ — 12-type ladder (R7 parity with architect Step 1), atomicWrite,
  exit codes 0/1/2/3, merges `repo_type` + initial `detected_stacks[]`, --force and --dry-run flags.
- `commands/setup-init.md` ✅ — Step 0.5 inserted between Step 0 and Step 1: resume check,
  detection run, LLM fallback on exit 2, hard-fail on exit 3. node -c passes; smoke-tested on
  .sln/React/empty/state-merge/force scenarios.

**Phase C — highest-risk graph decoupling:** ✅ done
- `scripts/module-derive.cjs` → private `.claude/graph/.module-skeleton.json` (module list +
  paths only; NO graph.json, NO fingerprints, NO edge extraction — R5/R6).
- Extract `skills/graph-create/SKILL.md` from architect Step 7 (it writes schema-valid
  graph.json, computes fingerprints via the bash helper, runs `graph-extract-edges.js`);
  remove Step 7 from `skills/architect/SKILL.md`; wire the sequential chain in
  `commands/setup-init.md`; point `skills/graph-sync/SKILL.md` at the shared skeleton.
- **Gate**: byte-equivalent `graph.json` on a fixture repo before/after (contract check).
  Do not start until Phase A/B are verified green.

Rationale: Phases A/B are self-contained and reversible; Phase C is a deep refactor of an
ADR-governed skill and should not block the quick wins.

---

## Part 1 — Unified Install Dispatcher

### `install.sh` dispatcher probe

Insert after the winpty re-exec block (after line 23), before `SCRIPT_DIR` is defined:

```bash
# ── Runtime dispatcher — Windows only ────────────────────────────────────────────────
# When bash runs but cannot open /dev/tty (required for interactive prompts),
# delegate to PowerShell or Node.js rather than hanging silently.
# Guards: [ -t 1 ] mirrors the winpty block — skip in CI/piped runs.
# WSL: uname returns "Linux", _is_windows_shell is false — stays in bash (correct).
_DISP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # SCRIPT_DIR not yet defined here

_is_windows_shell() { case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) return 0;; esac; return 1; }
_bash_can_prompt()  { { true >/dev/tty; } 2>/dev/null; }

if [ -t 1 ] && _is_windows_shell && ! _bash_can_prompt; then
  # Probe before exec — Group Policy can block -ExecutionPolicy Bypass even when
  # powershell.exe exists. Test first so we can fall through to Node.js.
  if command -v powershell.exe >/dev/null 2>&1 \
     && powershell.exe -NonInteractive -ExecutionPolicy Bypass -Command "exit 0" >/dev/null 2>&1; then
    echo "→ bash cannot open /dev/tty — delegating to PowerShell..."
    # R1: translate bash-style flags → PowerShell switches (raw pass-through drops them!)
    _ps=(); for a in "$@"; do case "$a" in
      --update)    _ps+=(-Update);;
      --uninstall) _ps+=(-Uninstall);;
      --yes)       _ps+=(-Yes);;
      *)           _ps+=("$a");;
    esac; done
    exec powershell.exe -ExecutionPolicy Bypass -File "$_DISP_DIR/install.ps1" "${_ps[@]}"
  elif command -v node >/dev/null 2>&1; then
    echo "→ PowerShell unavailable — delegating to Node.js installer..."
    exec node "$_DISP_DIR/install.cjs" "$@"   # node uses same --flags — no translation needed
  fi
  # Neither: fall through — bash fails with its own diagnostic errors, not silently
fi
```

All three original installers remain fully standalone. The dispatcher is a no-op on
Mac/Linux and on Windows Git Bash where winpty has already given /dev/tty access.

### `install.cmd` — new file for Windows CMD users

```batch
@echo off
:: Windows CMD entry point. Order: real Git Bash -> Node.js -> PowerShell.
:: Rationale (R1/R2): `where bash` may resolve to WSL's System32\bash.exe (breaks Windows
:: paths), so probe the real Git Bash path explicitly. Node uses the SAME --flags as
:: install.sh, so it is a safe, flag-compatible fallback and comes before PowerShell (whose
:: switch names differ and would need translation).

set "_GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if exist "%_GITBASH%" (
  "%_GITBASH%" "%~dp0install.sh" %*
  exit /b %errorlevel%
)

where node >nul 2>&1
if %errorlevel% == 0 (
  node "%~dp0install.cjs" %*
  exit /b %errorlevel%
)

:: PowerShell last resort — translate bash flags to switches (R1)
where powershell >nul 2>&1
if %errorlevel% == 0 (
  set "_PS="
  if /I "%~1" == "--update"    set "_PS=-Update"
  if /I "%~1" == "--uninstall" set "_PS=-Uninstall"
  if /I "%~2" == "--yes"       set "_PS=%_PS% -Yes"
  powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1" %_PS%
  exit /b %errorlevel%
)

echo ERROR: No runtime found. Install Git for Windows, Node.js, or PowerShell.
exit /b 1
```

Notes:
- Exit-code fix: separate `if` blocks with `exit /b %errorlevel%` on the next line. The
  inline `&& (cmd & exit /b %errorlevel%)` form is a CMD bug — `%errorlevel%` inside `()`
  always captures 0.
- The PowerShell flag translation above is minimal (covers `--update`/`--uninstall`/`--yes`);
  because Node runs first and is flag-compatible, PS is rarely reached. If richer arg
  passthrough is ever needed, expand the translation or drop the PS branch entirely.

### README quick-start table

```markdown
## Quick start

| Platform | Command | Notes |
|----------|---------|-------|
| Mac / Linux | `bash install.sh` | Always uses bash directly |
| Windows (Git Bash terminal) | `bash install.sh` | Auto-delegates to PowerShell or Node.js if /dev/tty blocked |
| Windows (CMD / PowerShell terminal) | `install.cmd` | Tries Git Bash → Node.js → PowerShell (S8-corrected order) |
```

Do not say "auto-detect" for Mac/Linux — it never delegates there.

---

## Part 2 — Path-Scoped Bash Permissions

### What already exists

`stepWireLocalSettings` (bootstrap.cjs line ~412) already scopes `node` to
`{pluginDir}/scripts/*.cjs` with Windows-safe double-backslash patterns. The API is
`isDone(manifest, key)` and `markStep(manifest, key, data)` — argument order is
manifest-first.

### Gaps causing silent permission prompts

**Gap 1 — ~~`.claude/hooks/*.cjs` missing~~ WITHDRAWN (see S1).**
~~Hooks are wired in `settings.json`…first Write triggers a prompt.~~ **False premise** —
verified hooks run via the hook runner, NOT the Bash tool (`bootstrap.cjs:80`), so they never
trigger a Bash permission prompt. **Change A is removed.**

**Gap 2 — Common utilities missing (partial fix — see S3)**

Skills invoke `ls`, `grep`, `cp`, `mkdir`, `chmod`, `sed`, `which`, `where.exe` via
the Bash tool. None are in the generated permissions. Every skill that uses them prompts
intermittently. **Caveat (S3):** `find` is intentionally NOT allowlisted (ADR 0054), and
architect/graph-sync use `find` heavily — those prompts persist by design.

**Gap 3 — Stale path after plugin reinstall (init mode only)**

`isDone(manifest, 'wireLocalSettings')` prevents re-running on resume. If the plugin
moves to a new cache path (version upgrade), the stale absolute path silently stays.
Sync mode resets the manifest so this only affects `init` mode re-runs.

### Fix: extend `stepWireLocalSettings` (TWO changes — Change A withdrawn per S1)

**Change A — WITHDRAWN (S1).** Hooks run via the hook runner, not the Bash tool, so hook
permission entries are inert. Do not add them.

**Change B** — Add utility entries (same pattern as existing, append only):

```js
// S9: do NOT auto-allow broad Write(.claude/**) — that would silently permit writes to the
// enforcement hooks (.claude/hooks/*.cjs) and settings.json that GATE this plugin, a
// prompt-injection foothold. Keep Read/Edit narrow; let Write stay prompted (or scope it
// to safe subtrees only, excluding hooks/ and settings*.json).
const utilityEntries = [
  'Bash(ls:*)', 'Bash(grep:*)', 'Bash(cp:*)', 'Bash(mkdir:*)',
  'Bash(chmod:*)', 'Bash(sha256sum:*)', 'Bash(sed:*)',
  'Bash(which:*)', 'Bash(where.exe:*)',
  'Read(.claude/**)',              // read is safe
  'Edit(CLAUDE.md)', 'Edit(memory/*.md)',
  // Removed (S9): 'Edit(.claude/**)', 'Write(.claude/**)' — too broad; would un-gate hooks/settings.
];
for (const e of utilityEntries) {
  if (!local.permissions.allow.includes(e)) needed.push(e);
}
```

**Change C** — Path-aware skip guard (handles stale path on re-run):

```js
function stepWireLocalSettings(manifest) {
  const currentScriptsDir = path.join(resolvePluginDir(), 'scripts');
  const prevOp = manifest?.operations?.wireLocalSettings;

  if (isDone(manifest, 'wireLocalSettings') && prevOp?.scriptsDir === currentScriptsDir) {
    console.log('  — wireLocalSettings: done (skip)');
    return;
  }
  // Falls through if: not done, OR plugin moved to different path.
  // Sync mode: manifest is always null → isDone always false → always re-runs (correct).
  ...
```

Do NOT change the existing double-backslash escaping — it is in production and working.

---

## Part 3 — Setup Command UX Gaps

### setup-init

**Clarification — Steps 2–4 are automated, not manual**

`/setup-init` drives `/init`, `/architect`, and `/graph-sync` automatically within the
same Claude session — the developer does not type these separately. The only genuine
developer-input points are questions Claude cannot answer alone: git/bash path fallback
(2b), external directory confirmation (2c/2d), and the architect deployment questionnaire
(Step 0.5 "APPROVED" reply). This is by design — these require local knowledge.

**Issue 1 — Resume after interruption is not obvious**

If the session is interrupted mid-setup (connection drop, timeout, accidentally closing
VS Code), the manifest is still on disk at `.claude/_bootstrap-manifest.json`. But the
developer doesn't know to type `/setup-init` again, or that re-running is safe. They may
instead try to manually piece together what ran.

Fix: Add a one-line resume hint to the bootstrap output header:
```
  ℹ If this session is interrupted, re-run /setup-init — it resumes from where it left off.
```
Change in `printSummary()` in `setup-init-bootstrap.cjs`.

**Issue 2 — Decouple the graph pipeline from architect (IN SCOPE: decouple, not parallelise)**

Directive: **decouple before parallelising.** This plan performs the *decoupling* (a clean,
sequential separation of concerns). The *parallelisation* layer (a reusable fan-out
primitive) is spun out into a separate proposal — see the **Deliverable** below and
`docs/proposals/parallel-execution-primitive.md`.

**Verified finding driving the decoupling:**
- Module derivation happens THREE times today (architect docs Steps 2–6, architect graph
  Step 7, graph-sync Step 4) — EACH independently from the **directory tree**. graph-sync
  Step 4 confirms modules come from `find` over the tree; `architecture.md` is only an
  *optional* disambiguation hint, never a hard input.
- This triple derivation is wasteful AND a **consistency risk** — three independent LLM
  derivations can disagree on module boundaries/names.
- `graph-extract-edges.js` needs `graph.json` **nodes** to exist (hard-fails exit 2 if
  empty), but that is a dependency *within* the graph flow, not on architect prose.

**The decoupling (all sequential — single-writer model preserved):**

```
Bootstrap Phase 1  (unchanged)
  ↓
Repo Detection  ← HARD PREREQUISITE (deterministic → LLM fallback → hard-fail)
  ↓               Writes detected_repo_type + detected_stacks[] to dream-init-state.json
Module-Derive  ← NEW deterministic Node step (no LLM)
  ↓               Walks tree → canonical module list + path globs + fingerprints;
  ↓               runs graph-extract-edges.js → EXTRACTED edges;
  ↓               writes graph.json SKELETON (nodes typed "unclassified"). SHARED ARTIFACT.
Phase 2a: Template scaffolding   (needs repo type; precedes architect)
  ↓
Phase 2b: Rules deployment       (needs repo type; independent)
  ↓
Architect (docs)     ← reads repo type + module skeleton → writes .claude/architecture/ ONLY
  ↓
Graph-Create         ← reads skeleton → node typing, INFERRED edges, hubs, projections
  ↓                    → writes .claude/graph/ ONLY   (extracted from old architect Step 7)
graph-sync           ← refresh path; also consumes the skeleton derivation
```

**Why this is the right decoupling** (and why it stops short of parallelising):
- **Disjoint outputs**: architect → `.claude/architecture/`, graph-create → `.claude/graph/`.
  Different directories ⇒ no write conflict. This is what makes later parallelisation *safe*.
- **Single derivation**: module-derive runs once; architect docs and graph-create consume
  the identical skeleton ⇒ guaranteed module-boundary consistency.
- **Still sequential**: no sub-agents, no locking needed. Parallelisation is deferred to
  the proposal precisely because it needs net-new orchestration infra.

**Component changes (this plan):**

| Component | Change |
|-----------|--------|
| `scripts/repo-detect.cjs` | **New** — deterministic detection (parity with architect Step 1, R7); signals AMBIGUOUS for LLM fallback; hard-fails if both fail; writes/merges **`repo_type`** + `detected_stacks[]` (R4). |
| `scripts/module-derive.cjs` | **New** — deterministic module list + path globs ONLY. Writes a private, non-schema artifact `.claude/graph/.module-skeleton.json` (R5). **No graph.json write, no fingerprints (R6), no edge extraction.** Uses `atomicWrite`. |
| `skills/graph-create/SKILL.md` | **New** — extracted from architect Step 7. Reads `.module-skeleton.json` → writes **schema-valid** graph.json nodes (real `type`) → computes fingerprints via bash helper → runs `graph-extract-edges.js` → projects index + detail files. Preserves ALL existing contracts (marker semantics, EXTRACTED-edge ownership, ADR 0038/0041/0053). |
| `skills/architect/SKILL.md` | Reads `detected_repo_type` + module skeleton from state instead of detecting/deriving. **Remove Step 7 entirely** (moved to graph-create). Architect now writes only `.claude/architecture/`. |
| `commands/setup-init.md` | Orchestrate the sequential chain: detection → module-derive → Phase 2 → architect → graph-create → graph-sync. Each step visible + logged. |
| `skills/graph-sync/SKILL.md` | **REQUIRED (S6)** — point its Step 4 module derivation at the shared `module-derive` logic (or prove identical), else the first sync churns (spurious renames). |

**Migration risk (flagged honestly):** extracting graph-create from architect touches
ADR-backed behaviour (`<!-- TEMPLATE -->` markers, EXTRACTED-edge ownership, graph.json as
authoritative projection source). This is the largest/riskiest change in the plan. It MUST
preserve every existing graph contract verbatim — the extraction only *moves* Step 7 into
its own skill and makes it consume a pre-built skeleton; it does not change what the graph
ends up containing. Recommend implementing behind the existing manifest/idempotency guards
and verifying graph.json byte-output is equivalent to the pre-refactor result on a fixture repo.

**Edge cases the decoupling must handle:**

- **Polyglot repo**: detection returns a PRIMARY type + `detected_stacks[]` list (existing
  STACK_SIGNALS supports multiple) — don't collapse to one. Module-derive must span all stacks.
- **LLM fallback vs weak Layer 1**: deterministic wins when confident; LLM only fills gaps —
  never silently overrides a strong deterministic match.
- **Re-run after a new stack added**: detection + module-derive MERGE into existing state /
  skeleton, not overwrite — else deployed rules and graph nodes orphan.
- **Empty / unrecognisable repo**: hard-fail with an actionable message; deploy nothing.
- **Skeleton ↔ architect consistency**: architect docs must use the SAME module list as the
  skeleton (read it, don't re-derive) — this is the whole point of the shared step.
- **Skeleton typing** (revised per R5): the skeleton is a PRIVATE `.module-skeleton.json` with
  no `type` field at all — graph.json is never written until graph-create assigns real,
  schema-valid types. No "unclassified" state ever reaches graph.json.

**Issue 3 — Bootstrap Phase 2 is invisible to the user**

Bootstrap Phase 2 (rule deployment) is triggered internally by `/architect` — the user
doesn't know it happened, and if architect fails partway through, Phase 2 may be left
incomplete with no diagnostic. `deployed_rules[]` would be empty or partial.

This issue is fully resolved by the refactor above — rules deployment is now a visible,
explicitly logged step in the orchestrator, separate from architect.

**Issue 4 — `/init` failure leaves CLAUDE.md with placeholder content**
(renumbered — Issue 3 above is resolved by the refactor)

If `/init` fails or the user skips it, CLAUDE.md still has `{ADO_ORG}`, `{ADO_PROJECT}`
placeholders. Subsequent skills that read CLAUDE.md silently get the wrong values.
`/setup-status` currently checks for Dream sections but not for unresolved placeholders.

Fix: Add a placeholder check to `/setup-status` — scan CLAUDE.md for `{ADO_`, `{COMPANY}`,
`{REPO_NAME}` patterns and flag as `⚠ CLAUDE.md has unresolved placeholders`.

### setup-sync

**Issue 4 — No prerequisite check for setup-init**

Setup-sync assumes `dream-init-state.json` exists. If run on a project where setup-init
never completed (e.g., stopped after bootstrap), it partially works — re-deploying hooks
and stubs — but `deployed_rules[]` is empty, so no rules are restored and no warning is
clearly surfaced.

Fix: At Step 1, check `dream-init-state.json` for `detected_stacks` field. If absent or
empty, print:
```
⚠ setup-init may not have completed — detected_stacks is empty.
  Rules cannot be restored (no deployment record).
  Run /setup-init to complete initial setup first, or /setup-status to diagnose.
```
Do NOT block sync — some provisioning (hooks, stubs) is still useful — but warn clearly.

**Issue 5 — Migration files are informational only with no indication**

Developers reading migration notes may not know they're purely informational and expect
automation. If they miss reading them, they skip required manual steps silently.

Fix: Add a header before each migration file display:
```
📋 Migration v{X} → v{Y} (informational — review and apply manually if needed):
```
And at the end: `If any migration requires manual action, complete it before running /setup-status.`

**Issue 6 — Graph staleness after sync with no prompt**

Sync warns "knowledge graph may be stale — run /graph-sync" but a developer in a hurry
skips it. The graph is then silently stale, causing inaccurate code-review and graph-viz
output.

Fix: Make the graph-sync suggestion more prominent — add it to the Step 7 summary box
as a separate line with a `⚠` marker, not just a note. Consider auto-running `/graph-sync`
as Step 7b (optional, but would match setup-init's completeness expectation).

### setup-teardown

**Issue 7 — CONFIRM check is case-sensitive, silently cancelling valid intent**

The current prompt: `Type CONFIRM to proceed, or anything else to cancel`
A developer who types `confirm` or `Confirm` gets silently cancelled. The intent is clear
— case sensitivity adds friction with no safety benefit.

Fix: Change the comparison in `setup-teardown.cjs` and the skill instruction to
case-insensitive — accept `confirm`, `CONFIRM`, `Confirm`, etc.:
```js
if (input.trim().toLowerCase() === 'confirm') { /* proceed */ }
```
Update prompt text to: `⚠ Type "confirm" to proceed, or anything else to cancel:`

**Issue 8 — `--rules` with empty `deployed_rules[]` is a silent no-op**

If setup-init's Phase 2 never ran (architect was skipped), `deployed_rules[]` is empty.
Running `--rules` teardown removes nothing but reports success with "0 files removed".
The developer thinks rules are gone but they're still present.

Fix: In `setup-teardown.cjs --scope rules`, if `deployed_rules[]` is empty, print:
```
⚠ No deployment record found (deployed_rules is empty).
  Rules cannot be selectively removed — use --full to remove all plugin content,
  or check /setup-status to understand the current state.
```
And exit without executing.

**Issue 9 — `--state` scope leaves orphaned hook commands in `settings.json`**

After `--state`, `dream-init-state.json` and `plugin-path.txt` are gone, but
`.claude/settings.json` still wires `node .claude/hooks/icea-floor.cjs`. If hooks were
previously removed (separate `--hooks` scope), the hook commands point to missing files.
No cross-scope validation catches this.

Fix: In `--state` dry-run output, if `.claude/hooks/` also exists and has content, add a
warning: `⚠ Note: .claude/hooks/ still contains hook files. settings.json still wires
them. If you removed hooks separately, consider --full instead.`

**Issue 10 — Pre-commit backup overwritten on re-install**

Teardown backs up `.git/hooks/pre-commit` to `.git/hooks/pre-commit.backup`. On re-
install via setup-init, if the developer added a new pre-commit hook between teardown and
re-install, the restore from `.backup` silently overwrites it.

Fix: During restore in setup-init bootstrap, if `.backup` exists, check if the current
`.git/hooks/pre-commit` differs from the backup. If so, warn:
```
⚠ .git/hooks/pre-commit differs from backed-up version — not restoring automatically.
  Back up your current hook manually, then re-run if needed.
```

---

## Files to Modify

### Part 1 — Install dispatcher
| File | Change |
|------|--------|
| `install.sh` | Insert dispatcher probe after line 23 |
| `install.cmd` | **New file** — Windows CMD entry point |
| `README.md` | Replace install section with quick-start table |

### Part 2 — Path-scoped bash permissions
| File | Change |
|------|--------|
| `scripts/setup-init-bootstrap.cjs` | Extend `stepWireLocalSettings` — Change B (utilities) + Change C (stale-path re-run guard). **Change A withdrawn (S1: hooks bypass the Bash tool).** |

### Part 3 — Setup command UX gaps
| File | Change |
|------|--------|
| `scripts/setup-init-bootstrap.cjs` | Update `printSummary()` — add resume hint |
| `scripts/repo-detect.cjs` | **New** — deterministic detection (Step 1 parity, R7); AMBIGUOUS signal for LLM fallback; hard-fails if both fail; writes/merges **`repo_type`** + `detected_stacks[]` (R4) |
| `scripts/module-derive.cjs` | **New** — module list + paths → private `.claude/graph/.module-skeleton.json` (R5); NO graph.json, NO fingerprints (R6), NO edge extraction; `atomicWrite` |
| `skills/graph-create/SKILL.md` | **New** — extracted from architect Step 7; reads skeleton → schema-valid graph.json nodes → bash-helper fingerprints → `graph-extract-edges.js` → projections; preserves ADR 0041/0053 verbatim. **Internal helper — no command stub** (S4). |
| `.claude-plugin/plugin.json` + `scripts/sync-config.sh` | **S4** — register `graph-create` in `components.skills`; re-sync marketplace manifests; align `check-version-consistency` |
| `docs/adr/0056-graph-create-owns-graph-generation.md` | **New (S5/S16)** — next free number is **0056**. Records "graph-create owns graph generation; 0038's orientation-layer decision unchanged." **ADR 0038 file NOT modified** (only partially affected + your directive). |
| `docs/adr/README.md` (index) | **S16** — add the 0056 row; annotate 0038's index row "(graph generation moved to 0056)". Index only — not the ADR body. |
| DEVELOPER-GUIDE.md / `commands/setup-init.md` prose (S15) | Update non-ADR prose that says "architect generates the graph"; audit architect/SKILL.md for dangling "Step 1a"/"Step 7" references in guards/error messages. |
| `scripts/setup-init-bootstrap.cjs` `GITIGNORE_BASE` | **S14** — add `.claude/graph/.module-skeleton.json` (transient build artifact; `.claude/graph/` is otherwise committed). |
| `skills/architect/SKILL.md` | Read `detected_repo_type` + skeleton from state; **remove Step 7** (→ graph-create); writes only `.claude/architecture/` |
| `commands/setup-init.md` | Orchestrate sequential chain: detection → module-derive → Phase 2 → architect → graph-create → graph-sync; each step visible + logged |
| `skills/graph-sync/SKILL.md` | Point module derivation at shared `module-derive` logic (or at minimum document the shared source) |
| `scripts/setup-teardown.cjs` | Add empty-`deployed_rules[]` guard for `--rules` scope; cross-scope warning for `--state`; pre-commit backup collision check |
| `skills/setup-sync/SKILL.md` | Add prerequisite check at Step 1; add migration informational header; make graph-sync suggestion prominent |
| `skills/setup-teardown/SKILL.md` **+ `scripts/setup-teardown.cjs:421`** | Make CONFIRM **case-insensitive** (accept confirm/Confirm/CONFIRM) in BOTH the skill Step 3 and the `.cjs` gate (S2 confirmed both exist) |
| `skills/setup-status/SKILL.md` | Add CLAUDE.md placeholder scan (`{ADO_`, `{COMPANY}`, `{REPO_NAME}`) |

---

## Additional Edge Cases & Failure Scenarios (Opus deep review)

### Part 1 — Install dispatcher
- **Infinite delegation loop**: if `install.ps1`/`install.cjs` ever calls back into
  `install.sh`, the dispatcher could loop. Mitigation: dispatcher only fires when bash
  can't prompt; ps1/cjs never re-invoke install.sh. Add a `_DISPATCHED` env guard mirroring
  `_WINPTY_REEXEC` for defence-in-depth.
- **Spaces in plugin path**: the repo lives under `OneDrive - Kirkland\Desktop\...` (spaces
  and a hyphen). All `exec`/`-File` paths MUST stay quoted. `%~dp0` in `install.cmd` also
  contains spaces — the `"%~dp0install.ps1"` quoting handles it, verify explicitly.
- **`install.cmd` + PowerShell arg passthrough**: `%*` forwarding of `--uninstall --yes`
  must survive; PowerShell `-File` maps `--uninstall` to a positional/param — confirm
  install.ps1 accepts the same flag names bash uses, or the dispatch silently drops flags.
- **OneDrive file locking**: OneDrive sync can transiently lock files mid-copy; `safe_copy`
  already uses Node, but a delegated run under a different runtime may hit EBUSY. Out of
  scope to fix, but note in docs.

### Part 2 — Path-scoped permissions
- **Windows path in pattern vs Git Bash invocation**: existing patterns store
  `C:\\Users\\...\\scripts\\*.cjs`, but in Git Bash node is invoked with `/c/Users/...`.
  The existing (production) code presumably relies on Claude Code's matcher normalising
  slashes. **Verify** the new hook + utility entries actually suppress prompts on THIS
  Windows+GitBash setup before assuming they work — do not ship blind.
- **Merge clobbers user entries**: Change C's `managedPrefixes` filter is broad
  (`Bash(node `, `Bash(cp:` …). A user's custom `Bash(node /some/other/tool.cjs)` would be
  treated as managed and dropped on re-run. Narrow the prefixes to plugin-scoped paths only.
- **`Bash(node -e *)` is effectively unrestricted**: inline eval can run arbitrary code.
  This is a deliberate trade-off (skills use `node -e` heavily) but it means "path-scoped"
  is aspirational — document that `node -e` remains a broad grant.

### Part 3 — Setup commands
- **repo-detect concurrent with bootstrap manifest**: since everything is sequential and
  single-writer, this is fine — but the new detect step MUST use the existing `atomicWrite`
  helper for `dream-init-state.json`, not a raw `writeFileSync`, to match the crash-safety
  contract.
- **LLM fallback in a deterministic script**: `repo-detect.cjs` is Node — it cannot itself
  call the LLM. The "Layer 2 LLM fallback" must be orchestrated by `setup-init.md` (the
  skill), which runs the script, inspects its "AMBIGUOUS" exit signal, and then does LLM
  detection inline. The script only signals; it does not invoke an LLM.
- **setup-sync `--reinstall` from wrong dir**: guarded by checking for `install.cjs`, but a
  developer running it from a nested folder would fail the check confusingly. Improve the
  error to name the expected directory.
- **teardown `--full` mid-session**: removing hooks/state while a session has them loaded
  leaves the running session with stale wiring until reload. Note in teardown output:
  "restart Claude Code after teardown".

---

## Verification

### Install
1. `bash install.sh` in Git Bash with winpty → stays in bash (probe is no-op).
2. Restricted bash (no winpty, /dev/tty blocked) → delegates to PowerShell, not hang.
3. `install.cmd --uninstall --yes` in CMD → `echo %errorlevel%` shows actual child exit code.
4. **R1 flag translation**: a delegated `bash install.sh --update` (→ PowerShell) actually
   runs an UPDATE, not a fresh install; `install.cmd --update` likewise. Confirm the
   installed version is preserved (identity not re-prompted).
5. **R2 WSL guard**: on a machine with WSL `bash` but no Git Bash, `install.cmd` routes to
   Node (not WSL bash); the Windows plugin path resolves correctly.
6. **R3 probe**: on a winpty-less mintty, confirm the dispatcher fires (or, if the `/dev/tty`
   probe proves unreliable there, that the MINGW-and-no-winpty fallback fires instead).

### Permissions
- Run skill that calls `ls`/`grep`/`cp`/`mkdir`/`sed`/`which` → no Bash permission prompt (Change B).
- Confirm `find`-based steps still prompt (S3 — expected; not regressed, not "fixed").
- Modify `wireLocalSettings.scriptsDir` in manifest → re-run bootstrap → step re-runs, updates `settings.local.json` (Change C).
- Confirm hooks fire on Write WITHOUT any Bash prompt even though no `Bash(node .claude/hooks/*)` entry exists (S1 — proves Change A was unnecessary).

### Setup-init detection + decoupling (sequential — no parallelism)
7. Empty/unrecognisable repo → detection hard-fails with actionable message, deploys nothing.
8. Layer 1 ambiguous → LLM fallback invoked; strong Layer 1 signal is NOT overridden by LLM.
9. Polyglot repo (.NET + Angular) → `detected_stacks[]` lists both, not collapsed to one.
10. Re-run after a new stack is added → `detected_stacks[]` + skeleton MERGE, nothing orphaned.
11. `module-derive` produces `.claude/graph/.module-skeleton.json` (module list + paths only, no graph.json, no fingerprints); architect docs + graph-create both consume it.
12. graph-create writes schema-valid graph.json (every `type` in the enum); byte-output equals the pre-refactor result on a fixture repo (contract-preservation check). `graph-extract-edges.js` runs inside graph-create, not module-derive.
13. Interrupt session mid-architect → re-run `/setup-init` → resume hint shown; resumes correctly.

### Setup-sync
14. Run `/setup-sync` on project with empty `detected_stacks` → warning printed, sync continues.
15. Migration file display shows informational header; end summary mentions manual action.

### Setup-teardown
16. Type `confirm` / `Confirm` / `CONFIRM` at prompt → all accepted and proceed with teardown.
17. Run `--rules` with empty `deployed_rules[]` → warning shown, zero files deleted, exits cleanly.
18. Run `--state` when `.claude/hooks/` has content → cross-scope warning appears in dry-run.
19. Teardown then add new pre-commit hook → re-run setup-init → backup collision warning shown, new hook not overwritten.

### Setup-status
20. Leave `{ADO_ORG}` in CLAUDE.md → `/setup-status` flags it as unresolved placeholder.

### Proposal deliverable
21. `docs/proposals/parallel-execution-primitive.md` exists; `docs/proposals/README.md` table links it.

---

## Deliverable — New proposal doc: `docs/proposals/parallel-execution-primitive.md`

The decoupling (module-derive + graph-create separation) is now IN SCOPE above (Part 3,
Issue 2). The **parallelisation layer** is spun out as a proposal RFC for future refinement,
following the existing `docs/proposals/` convention (see `async-checkpoint-queue.md`).

**Action items (executed on approval):**
1. Create `docs/proposals/parallel-execution-primitive.md` with the content specified below.
2. Add a row to `docs/proposals/README.md` table linking it (Status: `v0.1 — proposal, not implemented`).

**Full content to write into `docs/proposals/parallel-execution-primitive.md`:**

````markdown
# Parallel Execution Primitive — Proposal (RFC)
_Spec version: 0.1 (PROPOSAL — not implemented; refine before adopting) · Last changed: 2026-07-30_

A reusable fan-out primitive for running independent, per-module LLM work concurrently,
built on top of the decoupling shipped in the install/setup plan (deterministic
module-derive → independent consumers writing to disjoint paths).

## Premise (verified)
The graph pipeline is architect-doc-independent: module derivation happens three times
today (architect docs, architect graph Step 7, graph-sync Step 4), each from the directory
tree, never from architect prose. The install/setup plan decouples this into one
deterministic `module-derive` step consumed by architect (docs) and graph-create (graph),
which write to disjoint directories. That decoupling is the prerequisite for safe parallelism.

## The reusable asset is the decomposition, not an executor
Pattern: `deterministic shared prep → N independent consumers writing to DISJOINT paths →
single orchestrator merges + owns the manifest`. Once work has this shape, parallel
execution (via the harness Task/Agent tool) is a thin, safe layer — agents cannot conflict
because their outputs are disjoint. You cannot safely parallelise what you have not first
decoupled.

## Realistic consumer set (a family, not "everything")
Per-module FAN-OUT work is the fit:
- code-review — `docs/plans/multi-agent-code-review/` already anticipates this (second consumer)
- security scan (per-module)
- graph-create (per-module typing/edges)
- architect docs (per-module prose)

NOT a fit — cross-module REASONING that needs the whole picture at once:
- icea-feature planning, data-flow analysis, whole-repo architecture synthesis

## Hard safety contract (no file locking exists in the plugin today)
1. Deterministic, canonical shared input (sorted, fingerprinted).
2. Each parallel agent writes ONLY to a distinct, pre-assigned output path.
3. A single orchestrator owns ALL manifest/state writes and performs the final merge.
4. Sub-agents return structured results; they never write shared coordination files.
5. Failure isolation: one agent failing drops only its unit; the orchestrator records
   partial completion and supports resume (aligns with the existing manifest model).

## Open questions to refine
- How to express the fan-out contract as a shared spec skills can include (a
  `skills/shared/fan-out-spec.md`?) vs. an orchestrator command.
- Whether the harness Task/Agent tool is available in headless/cron runs, and the
  fallback when it is not.
- Concurrency cap and token-budget accounting across parallel agents.
- Merge/consolidation format for per-module results into the authoritative artifact.
- Interaction with the single-writer assumption doc — does it need amending, or is
  "disjoint paths + single merger" already compatible?

## Governing relationship
Depends on the decoupling delivered by the install/setup plan (module-derive +
graph-create). Graduates to a `skills/shared/` spec only when a first consumer
(likely graph-create or code-review) begins to use it.
````

**README table row to add:**
```
| [parallel-execution-primitive.md](parallel-execution-primitive.md) | v0.1 — proposal, not implemented | — | Reusable fan-out primitive for concurrent per-module LLM work, built on the module-derive decoupling; deterministic prep → disjoint-output consumers → orchestrator merge. |
```
