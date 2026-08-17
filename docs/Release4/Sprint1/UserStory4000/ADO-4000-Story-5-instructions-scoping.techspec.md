# Tech Spec — Story 5: CLAUDE.md per-harness note + Copilot `.vscode` scoping

ADO #4000 · Release 4 · Sprint 1 · Story 5
Status: DRAFT (revised for ASYMMETRIC model) · STORY · 3 SP

> Per-story implementation spec for the multi-harness epic (ADO-4000). This is a plugin/tooling
> story — Node.js CJS provisioner + markdown config, NOT a web app. Standard web-app template
> sections (Schema Changes, browser→API→DB flow, Azure AD/CSRF, Key Vault) are omitted or adapted
> to the plugin's real architecture. Source ICEA:
> `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md`
> (aligned to Revision Log entry "2026-08-14 #8" — the ASYMMETRIC enforcement model (#6), the
> LOCKED L1/L2/L3 structure — shared content core + native per-harness engagement/enforcement,
> NO mechanical projection (#7) — and the prompt-artifact-versioning additions (#8) — and the
> revised AC-F5).
> Epic Tech Spec: `temp/ADO-4000-tech.md`.
> **Depends on Stories 2 and 3** (Story 2: the L1 content core in `Shared/` that both harnesses
> consume, and the native emit of `.claude/` (Claude) + `.github/` (Copilot); Story 3: rules
> delivered natively to `.github/instructions`). **Story 4 is NOT a code dependency** — the
> `.vscode` scoping keys target skill/rule/hook *discovery* declaratively and do not consume the
> hook compat-shim layer. This story now closes the hook double-registration hole directly via a
> third scoping key (`chat.hookFilesLocations`), rather than deferring it to Story 4.

---

## Overview

This story closes the double-registration hole for repos provisioned with **both** harnesses, and
adds a per-harness model-routing note to the DEPLOYED instructions file. When
`provision --harness=claude,copilot` runs, each harness's engagement layer is emitted **natively**
from the single shared L1 content core — Claude-native config into `.claude/` (Claude Code) and
Copilot-native config into `.github/` (Copilot). This is native per-harness config emission, NOT a
mechanical projection of a Claude shape onto Copilot (Revision Log #7). Under VS Code >=1.109 Copilot Claude-compat,
Copilot would otherwise ALSO discover `.claude/skills`, `.claude/rules`, and `.claude/settings.json`
hooks — loading every skill, rule, and hook twice. This story makes the provisioner
**emit `.vscode/settings.json`** that scopes Copilot to `.github/` only (explicitly excluding both
project-level `.claude/` and user-level `~/.claude/` skill, instruction, AND hook locations) while
keeping `chat.useClaudeMdFile:true` so the single shared `CLAUDE.md` is still read by Copilot.

**Asymmetric-model alignment (Revision Log #6).** Under the asymmetric enforcement model, Claude is
the write-time prevention harness (unchanged) and Copilot is detection + merge-gate (CI required
status check is the hard line; the `review-icea` code-review skill is best-effort review-time
assistance). This story's job is discovery *scoping* — making `.github/` the sole Copilot source so
the best-effort client layer is not silently doubled by leaked `.claude/` registrations. Closing the
hook double-registration here (via `chat.hookFilesLocations`) directly serves that model: a Copilot
PreToolUse hook must fire at most once, from `.github/hooks`, never also from `.claude/settings.json`.

**L1/L2/L3 placement of this story's artifacts (Revision Log #7 — structure LOCKED).** The epic's
locked structure is a shared content core (L1) consumed by native per-harness engagement (L2) and
enforcement (L3) layers — L1 is never duplicated; `Claude/` and `Copilot/` CONSUME it, never
re-author it (CI-enforced). This story's outputs place cleanly:
- The emitted `.vscode/settings.json` is **Copilot-native L2/L3 config** — it is authored under the
  source `Copilot/vscode/` adapter folder (the Copilot-native settings-scoping layer) and emitted
  into the target repo's `.vscode/settings.json`. It is not a projection of any Claude artifact; the
  `.claude/`-disabling scope is a Copilot-side native config choice that exists only because Copilot
  natively discovers `.claude/` under 1.109 Claude-compat.
- The per-harness **model-routing note is a shared-instruction (L1-adjacent) edit** — it lives in the
  single shared `CLAUDE.md` instruction that BOTH harnesses read (Claude directly, Copilot via
  `chat.useClaudeMdFile:true`), so it is authored once and consumed by both, never forked per harness.
- `_project-deploy/CLAUDE.md` is the **deployed shared instruction** — the single source copied into a
  provisioned repo's root `CLAUDE.md`. It references the L1 governance content (Write Gate, keyword
  handlers, model routing) that both harnesses consume; the model note is additive to that shared
  instruction, keeping one source of truth per the epic Success Metric.

There is therefore no mechanical projection anywhere in this story: the `.vscode` emit is native
Copilot config, and the model note is a single shared-instruction edit consumed by both harnesses.

**Exact target files for the instructions change (no ambiguity).** There are two `CLAUDE.md` files
in this repo and they play different roles:

- `_project-deploy/CLAUDE.md` — the **deployment template**. It is the ONLY source copied into a
  target repo's root `CLAUDE.md` by `scripts/setup-init-bootstrap.cjs` (stepClaudeMd), and the root
  `CLAUDE.md` in a provisioned repo is what Copilot reads natively via `chat.useClaudeMdFile:true`.
  **The per-harness model-routing note MUST land here** so it reaches every deployed repo and both
  harnesses. This is the primary edit target of this story.
- Root plugin-dev `CLAUDE.md` — governs the plugin's OWN dev session only. It is not deployed and
  not read by Copilot in a target repo. This story keeps its §4 in sync as a courtesy so the two
  copies do not drift, but the load-bearing edit is the `_project-deploy/` template.

The per-harness model-routing note is **ADDITIVE** to §4 (MODEL ROUTING): it documents that Claude
routes generation/review/critic/infra via the `ICEA_MODEL`/`REVIEW_MODEL`/`CRITIC_MODEL`/`INFRA_MODEL`
env vars (a hard, deterministic route), while Copilot has no equivalent env route — the developer
selects a model in the Copilot picker and cloud/`Auto` tiers may substitute a model, so Copilot's
route is soft/advisory and its assurance level is Tier B (ties to the epic's per-artifact
assurance-level stamp; a Copilot-soft route is never counted as a Claude-hard one).

**Company-name scrub is a verified no-op.** Both `CLAUDE.md` files were inspected on 2026-08-13 and
neither contains any company or client name — the earlier "scrub" is already complete. This story
therefore does NOT strip a name; it **verifies** none is present (a regression assertion) and adds
the model note. The scope of the edit to `_project-deploy/CLAUDE.md` is strictly the §4 additive
note. The Write Gate (§0), the keyword-handler table (§0a), and the Shell & Git config (§0b) MUST be
**byte-unchanged** by this story — the diff shown under the Write Gate is expected to touch only §4.

The governing pattern is *single shared content core (L1), emitted natively per harness (L2/L3),
with the non-native harness's discovery explicitly disabled across all three artifact classes
(skills, rules, hooks)*.
This story also resolves **Decision D-3** (Copilot instructions: shared `CLAUDE.md` only vs also
emitting `.github/copilot-instructions.md`).

`chat.agentSkillsLocations`, `chat.instructionsFilesLocations`, and `chat.hookFilesLocations` are
`string→boolean` maps where a `false` value EXCLUDES a location (VS Code ships a default
`~/.claude/rules:false`). These settings are **workspace-trust-gated** (`restricted:true`), so the
scoping only takes effect after the developer grants Workspace Trust. There is a known Remote-SSH path
mis-resolution bug (microsoft/vscode#293768) that this story documents. **Both the trust-gating
dependency and the Remote-SSH bug are MANUAL-verification items** — they cannot be exercised by an
automated unit test (they depend on live VS Code trust state and a remote host) and are checked by a
human tester.

**Flags cannot be trusted alone — verify by actual load.** VS Code has known suppression bugs where
a `false` scoping entry does NOT reliably exclude the location it names (microsoft/vscode#297538 and
microsoft/vscode#299820). Consequently, correct emission of the three keys is necessary but NOT
sufficient: acceptance for this story requires confirming, by **actual observed load state**, that
`.claude/*` skills, rules, and hooks did NOT load — via the Copilot `/skills` menu (skills/rules) AND
the Copilot Hooks output channel (hooks). Passing the flag-content unit tests alone does not satisfy
AC-F5; the verify-by-actual-load step is mandatory (MANUAL).

**Hook double-load — now closed here.** Earlier drafts deferred hook double-registration to Story 4.
Under the revised AC-F5, this story emits a third scoping key, `chat.hookFilesLocations`, mapping the
default-Claude hook locations (`.claude/settings.json`, `.claude/settings.local.json`,
`~/.claude/settings.json`) to `false`, so Copilot registers hooks only from `.github/hooks`. This
closes the F1.2 double-registration hole at the `.vscode` layer. Story 4 remains the owner of the
`.github/hooks` compat-shim content (matcher-in-script + tool-name map) that those hooks run; this
story only ensures the `.claude/` hook sources are not *also* registered by Copilot. The two concerns
compose: Story 4 makes `.github/hooks` work; Story 5 makes `.github/hooks` the *sole* Copilot hook
source.

**The emitted `.vscode/settings.json` is itself committed configuration** and must be secret-scanned
like any committed config. It ties to Story 4's parameterized secret guard: the file is generated
into the target repo and checked in, so the same pre-commit / write-time secret scan that covers
`.claude/settings.json` must also cover `.vscode/settings.json`. This story emits only non-secret
scoping keys, but the file must not be exempted from the scan.

---

## Decision D-3

**Decision:** Copilot instructions source = **shared `CLAUDE.md` only** (via `chat.useClaudeMdFile:true`).
Do **not** emit `.github/copilot-instructions.md` in this story.

- Options considered:
  - A) Also emit `.github/copilot-instructions.md` — rejected for now: creates a second instructions
    artifact that must be kept in sync with `CLAUDE.md`, reintroducing the content-drift the epic
    exists to eliminate (Success Metric: 1 source of truth per artifact).
  - B) Shared `CLAUDE.md` only — chosen: `chat.useClaudeMdFile` defaults true and is verified to be
    read natively by Copilot >=1.109; parity with Claude is exact; zero drift surface. Matches the
    epic Deferred-Decision recommended default for D-3.
- Revisit trigger: if a concrete Copilot-idiomatic gap appears (a directive Copilot honours only from
  `.github/copilot-instructions.md`), add that file in a follow-on story as a thin pointer to
  `CLAUDE.md`, not a duplicate. Recorded in the Revision Log and epic Deferred Decisions (D-3, Story 5).

---

## AC Coverage Matrix

Every AC in scope for this story must be covered by at least one file change; every file change must
satisfy at least one AC. Gaps are flagged with a warning marker.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F5 (skills/rules) | Emitted `.vscode/settings.json` scopes Copilot to `.github/`, disables `.claude/` skills+rules discovery, keeps `chat.useClaudeMdFile:true` | `.vscode/settings.json` (emitted), provisioner emit logic (`scripts/provision.*`) | Covered |
| AC-F5 (hooks) | Emitted settings also disables `.claude/*` hook discovery via `chat.hookFilesLocations` → `false` (closes F1.2 double-registration) | `.vscode/settings.json` (emitted), provisioner emit logic (`scripts/provision.*`) | Covered |
| AC-F5 (verify-by-actual-load) | Confirm via `/skills` menu AND Copilot Hooks output channel that `.claude/*` skills/rules/hooks did NOT load — not the flags alone (bugs #297538, #299820) | Acceptance/QA procedure (INT-1, INT-6); no source file | Covered |
| AC-F5 (instructions) | Single shared instructions file stays readable by Copilot; per-harness model note is ADDITIVE and reaches the DEPLOYED file | `_project-deploy/CLAUDE.md` §4 (primary), root `CLAUDE.md` §4 (kept in sync) | Covered |
| AC-NF4 | Claude 3.x parity — Tier-A hard gate unchanged; scoping is Copilot-only and must not alter Claude discovery/gate; §0/§0a/§0b byte-unchanged | `.claude/` native config (untouched — parity assertion), `_project-deploy/CLAUDE.md` (only §4 changes), provisioner emit logic (Copilot-only write path) | Covered |

> D-3 resolution (shared `CLAUDE.md` only) is realised through the `chat.useClaudeMdFile:true` key in
> the emitted `.vscode/settings.json` and the per-harness model note in `_project-deploy/CLAUDE.md` §4 —
> no separate `.github/copilot-instructions.md` file is created.

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `.vscode/settings.json` (emitted by provisioner) | AC-F5 (skills+rules+hooks scoping) |
| `_project-deploy/CLAUDE.md` (ADDITIVE §4 per-harness model note; verify no company name) | AC-F5 (single shared instructions readable by Copilot in deployed repos), AC-NF4 (§0/§0a/§0b byte-unchanged; Claude reads same file) |
| root `CLAUDE.md` (kept in sync, not deployed) | AC-F5 (drift avoidance only), AC-NF4 (dev-session parity) |
| provisioner emit logic (`scripts/provision.*`) | AC-F5, AC-NF4 |

**Coverage result:** all in-scope ACs (AC-F5 delivered incl. hook scoping + verify-by-actual-load;
AC-NF4 parity-checked) are covered; no orphaned file changes.

---

## Files Changed

> Plugin story — no schema. Four change surfaces: the emitted settings file, the DEPLOYED instructions
> template, the root dev-session instructions file (sync only), and the provisioner logic that emits
> the settings file.

| Path | Change | Purpose |
|---|---|---|
| `.vscode/settings.json` | emitted (new, Copilot-native L2/L3 config from `Copilot/vscode/`) | Scopes Copilot to `.github/`; disables project-level and user-level `.claude/` skill, rule, AND hook discovery; keeps `chat.useClaudeMdFile:true`. Committed into the provisioned target repo — subject to the same secret scan as other committed config (Story 4 parameterized guard). |
| `_project-deploy/CLAUDE.md` | modified (§4 only) | ADDITIVE per-harness model-routing note (Claude env-var routing vs Copilot model-picker / soft Tier-B). This is the DEPLOYED template copied to a target repo's root `CLAUDE.md` and read by Copilot — the note MUST land here. Verify no company name remains (already true). §0/§0a/§0b byte-unchanged. |
| root `CLAUDE.md` | modified (§4 only) | Same additive note, kept in sync to avoid drift between the two copies. Not deployed; not read by Copilot in target repos. §0/§0a/§0b byte-unchanged. |
| `scripts/provision.*` (Copilot adapter emit path) | modified | Adds the emit-settings step: builds the settings block (three scoping maps + `useClaudeMdFile`), merges non-destructively into any existing `.vscode/settings.json`, and fails loudly if it cannot write. |

### Emitted `.vscode/settings.json` contract (the "API" of this story)

The provisioner emits exactly this settings block (the `false` values EXCLUDE those locations; both
project-level `.claude/` and user-level `~/.claude/` are excluded across skills, rules, AND hooks so
Copilot cannot double-load skills/rules or double-register hooks):

```json
{
  "chat.agentSkillsLocations": {
    ".github/skills": true,
    ".claude/skills": false,
    "~/.claude/skills": false
  },
  "chat.instructionsFilesLocations": {
    ".github/instructions": true,
    ".claude/rules": false,
    "~/.claude/rules": false
  },
  "chat.hookFilesLocations": {
    ".github/hooks": true,
    ".claude/settings.json": false,
    ".claude/settings.local.json": false,
    "~/.claude/settings.json": false
  },
  "chat.useClaudeMdFile": true
}
```

Contract notes:
- All three location keys are `string→boolean` maps; `true` includes a location, `false` excludes it.
  Order does not matter; presence of the `false` entries is what suppresses `.claude/` discovery on
  the Copilot side.
- `chat.hookFilesLocations` is the NEW key added under the asymmetric model (Revision Log #6). It
  maps the three default-Claude hook sources (`.claude/settings.json`, `.claude/settings.local.json`,
  `~/.claude/settings.json`) to `false`, so Copilot registers hooks only from `.github/hooks`. This
  closes the F1.2 hook double-registration hole at the `.vscode` layer — it is no longer deferred to
  Story 4. Story 4 still owns the `.github/hooks` shim content those hooks execute.
- `chat.useClaudeMdFile:true` is emitted explicitly (even though it defaults true) so the single shared
  `CLAUDE.md` is read by Copilot regardless of user-level overrides — this is the D-3 realisation.
- Both settings are `restricted:true` (workspace-trust-gated); the emit is a no-op on discovery until
  the workspace is trusted (see Error Handling; MANUAL-verification item).
- **Flags are necessary but not sufficient.** Because of known suppression bugs
  (microsoft/vscode#297538, microsoft/vscode#299820) a `false` entry may not reliably exclude its
  location. Acceptance requires verifying by **actual load** (see INT-1 and INT-6) that `.claude/*`
  skills, rules, and hooks did not load — via the `/skills` menu AND the Copilot Hooks output channel —
  not by trusting the emitted flags.
- The provisioner MUST merge these keys into an existing `.vscode/settings.json` rather than overwrite
  the whole file (the target repo may already have unrelated VS Code settings).
- The emitted file is committed config and is in scope for the repo's committed-config secret scan.

### Per-harness model note (shape emitted into `_project-deploy/CLAUDE.md` §4)

Appended to §4 (MODEL ROUTING), additive only, no existing line changed:

```text
Per-harness routing: on Claude Code these env vars select the model deterministically (a hard route).
GitHub Copilot has no equivalent env route — the developer picks a model in the Copilot model picker,
and cloud/`Auto` tiers may substitute one, so Copilot's route is soft (Tier B, advisory). A
Copilot-soft route is never counted as equal to a Claude-hard route (per-artifact assurance stamp).
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Workspace not yet trusted in VS Code (MANUAL verification) | All three location settings are `restricted:true`, so the `.claude/`-disabling scope does NOT apply until Workspace Trust is granted. The native `.github/` config still functions. The provisioner documents this in its output; scoping is never silently assumed to be active. Verified by a human granting/withholding trust. |
| Scoping flags set but location still loads (suppression bugs #297538, #299820) (MANUAL verification) | The emitted `false` entries may not reliably exclude their locations. Acceptance does NOT trust the flags: a human confirms via the `/skills` menu (skills/rules) AND the Copilot Hooks output channel (hooks) that no `.claude/*` artifact loaded. If actual load shows a `.claude/*` skill/rule/hook still active, the story fails its AC even though the flags are correct. |
| Remote-SSH path mis-resolution (microsoft/vscode#293768) (MANUAL verification) | Documented caveat: on Remote-SSH the location paths may mis-resolve, so scoping may not take effect as written. The provisioner emits a warning naming the bug ID and advising verification via the `/skills` menu + Hooks output channel on a Remote-SSH host; the Tier-C `ai-gate` remains the backstop. Verified manually on a remote host. |
| Provisioner cannot write `.vscode/settings.json` (permissions / read-only / path missing) | **Fail loudly.** Provisioning aborts with a message that names the double-registration risk (Copilot would load both `.github/` and `.claude/` skills, rules, and hooks) and does NOT proceed leaving both harnesses active. Matches ICEA Error State for AC-F5. |
| Existing `.vscode/settings.json` present with unrelated keys | Non-destructive merge: only the scoping keys + `useClaudeMdFile` are added/updated; unrelated keys are preserved. If a conflicting user value exists for one of the scoping keys, the provisioner overwrites it (scoping is required) and logs the overwrite. |
| VS Code < 1.109 (no `chat.agentSkillsLocations`/`chat.hookFilesLocations` support) | The emitted keys are simply ignored by the older client; Copilot reads native `.github/` config directly. The provisioner surfaces a minimum-version notice rather than silently mis-loading (ICEA Edge Case). |
| `_project-deploy/CLAUDE.md` edit would touch §0/§0a/§0b | Blocked. The edit is restricted to §4 (additive note). Any diff hunk outside §4 is a defect — the Write-Gate diff must show §0/§0a/§0b byte-unchanged before any write. |
| Company-name check finds a name | Does not happen on current files (verified no-op), but the check is retained as a regression assertion; if a name is ever introduced upstream, the check fails and flags it. No content is removed by this story. |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F5 (skills/rules/hooks scoping) | Provisioner emit logic for `.vscode/settings.json` (build three scoping maps incl. `chat.hookFilesLocations`, non-destructive merge, fail-loud on unwritable), plus the emitted file contract | 2 |
| AC-F5 / D-3 | `_project-deploy/CLAUDE.md` §4 additive per-harness model note (+ sync to root `CLAUDE.md`); verify no company name; D-3 resolution (shared CLAUDE.md, no copilot-instructions.md) | 0.5 |
| AC-NF4 | Parity check — Copilot-only scoping does not alter Claude `.claude/` discovery or the Tier-A hard gate; assert §0/§0a/§0b byte-unchanged | 0.5 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — a single shippable slice: after this ships, a both-harness repo no longer
double-loads `.claude/` skills+rules OR double-registers `.claude/` hooks under Copilot, and the
deployed instructions file is harness-aware. No sub-decomposition required (<=5 SP).

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] `.vscode/settings.json` emit logic added to the Copilot adapter path in `scripts/provision.*`
- [ ] Emitted block matches the contract exactly: `chat.agentSkillsLocations` excludes `.claude/skills`
      and `~/.claude/skills`; `chat.instructionsFilesLocations` excludes `.claude/rules` and
      `~/.claude/rules`; `chat.hookFilesLocations` excludes `.claude/settings.json`,
      `.claude/settings.local.json`, and `~/.claude/settings.json`; `chat.useClaudeMdFile:true` present
- [ ] Emit is a non-destructive merge into any existing `.vscode/settings.json`
- [ ] Provisioner fails loudly (non-zero exit, named double-registration risk) if it cannot write the file
- [ ] Per-harness model-routing note added to `_project-deploy/CLAUDE.md` §4 (the DEPLOYED file), and
      the same note synced to the root `CLAUDE.md` §4
- [ ] Verified no company/client name remains in either `CLAUDE.md` (already true — regression check)
- [ ] `CLAUDE.md` §0 (Write Gate), §0a (keyword handlers), §0b (shell config) are BYTE-UNCHANGED in both files
- [ ] Emitted `.vscode/settings.json` is in scope for the committed-config secret scan (Story 4 guard)
- [ ] No hardcoded secrets, connection strings, or credentials
- [ ] No `console.log` / diagnostic output in the provisioner production path (use the provisioner's logger)

**Quality**
- [ ] All positive and negative unit tests pass — see Test Cases
- [ ] Verify-by-actual-load (AC-F5, MANUAL): `/skills` in Copilot shows only `.github/` skills+rules
      AND the Copilot Hooks output channel shows only `.github/hooks` registrations after trust granted —
      NOT trusting the emitted flags alone (bugs #297538, #299820)
- [ ] Regression verified (AC-NF4): Claude Tier-A hard gate still `exit 2`-blocks an un-approved Write;
      Claude `.claude/skills` discovery unchanged

**Review readiness**
- [ ] PR title format: `[ADO-4000] Story 5 CLAUDE.md per-harness note + Copilot .vscode scoping`
- [ ] PR description maps each changed file to its ACs (reference AC Coverage Matrix)
- [ ] ICEA + this tech spec committed in the same branch
- [ ] D-3 resolution recorded in the Revision Log and the epic Deferred-Decisions table

### Reviewer Checklist
- [ ] With both harnesses provisioned and workspace trusted, Copilot does NOT double-load `.claude/`
      skills+rules (verify via `/skills` menu — only `.github/` entries) (AC-F5 / INT-1) (MANUAL)
- [ ] With both harnesses provisioned and workspace trusted, Copilot does NOT double-register `.claude/`
      hooks (verify via the Copilot Hooks output channel — only `.github/hooks`) (AC-F5 / INT-6) (MANUAL)
- [ ] Verification is by ACTUAL LOAD, not the flags — the known suppression bugs (#297538, #299820) mean
      correct flags do not prove suppression; the `/skills` menu + Hooks output channel are checked
- [ ] `chat.hookFilesLocations` present mapping `.claude/settings.json`, `.claude/settings.local.json`,
      `~/.claude/settings.json` → `false` (closes the F1.2 hook double-registration hole)
- [ ] `chat.useClaudeMdFile:true` present so `CLAUDE.md` is still read by Copilot (D-3)
- [ ] Both user-level (`~/.claude/*`) and project-level `.claude/` locations are `false` across all three
      scoping keys — not just the project-level ones
- [ ] Emit is a non-destructive merge — unrelated `.vscode/settings.json` keys are preserved
- [ ] Unwritable `.vscode/settings.json` causes a loud provisioning failure, not a silent skip
- [ ] Emitted `.vscode/settings.json` is treated as committed config for secret scanning
- [ ] Workspace-untrusted and Remote-SSH (#293768) caveats are surfaced by the provisioner and labelled
      MANUAL-verification, not assumed away
- [ ] Per-harness model note landed in `_project-deploy/CLAUDE.md` §4 (the deployed file), not only the root
- [ ] No company/client name in either `CLAUDE.md` (regression check; expected already clean)
- [ ] `CLAUDE.md` §0/§0a/§0b byte-unchanged in both files
- [ ] Claude side is untouched — no change to `.claude/` discovery or the Tier-A gate (AC-NF4 parity)

---

## Open Questions

None open. D-3 is resolved in this spec (shared `CLAUDE.md` only). No open question blocks SAVE TECH.

---

## Request Flow

Copilot skill/instruction/hook discovery with scoping applied (both-harness, trusted workspace):

```
PROVISION (application-integration time):
  provision --harness=claude,copilot
    -> emit native config from L1 core (Shared/) -> .claude/ (Claude) AND .github/ (Copilot)   [Story 2]
    -> deploy _project-deploy/CLAUDE.md -> target repo root CLAUDE.md (with per-harness §4 note)
    -> [THIS STORY] emit .vscode/settings.json:
         chat.agentSkillsLocations       { .github/skills:true, .claude/skills:false, ~/.claude/skills:false }
         chat.instructionsFilesLocations { .github/instructions:true, .claude/rules:false, ~/.claude/rules:false }
         chat.hookFilesLocations         { .github/hooks:true, .claude/settings.json:false,
                                           .claude/settings.local.json:false, ~/.claude/settings.json:false }
         chat.useClaudeMdFile:true
    -> if .vscode/settings.json unwritable -> FAIL LOUDLY (name double-registration risk); do not proceed
    -> emitted .vscode/settings.json is committed config -> covered by secret scan (Story 4 guard)

COPILOT DISCOVERY (developer opens repo in VS Code >=1.109):
  open workspace
    -> Workspace Trust prompt   [MANUAL-verification boundary]
        -> NOT trusted: settings restricted:true -> scope NOT applied yet (.github/ config still works)
        -> trusted: scope applied (subject to verify-by-actual-load below)
             -> skills discovered from .github/skills ONLY (.claude/skills excluded by false)
             -> instructions discovered from .github/instructions ONLY (.claude/rules excluded by false)
             -> hooks registered from .github/hooks ONLY (.claude/settings*.json excluded by false)
             -> CLAUDE.md read (chat.useClaudeMdFile:true) -> per-harness note visible
             -> VERIFY-BY-ACTUAL-LOAD (bugs #297538/#299820 -> flags not trusted):
                  /skills menu           -> confirm NO .claude/ skills/rules loaded
                  Copilot Hooks channel  -> confirm NO .claude/ hooks registered
             => no .claude/ skills+rules double-load; no .claude/ hook double-registration

CLAUDE DISCOVERY (unchanged — AC-NF4 parity):
  open repo in Claude Code
    -> project .claude/skills load (as in 3.x)
    -> Tier-A icea-floor hook -> Write allowed iff approved ICEA (exit 2 otherwise)
    -> CLAUDE.md §0/§0a/§0b byte-unchanged -> gate, handlers, shell config identical
    -> .vscode/settings.json is a Copilot/VS Code concern; Claude ignores it
```

---

## Rollback

Purely additive to the provisioner and config; no data migration.

- **Provisioner change:** revert the Story 5 commit range on `feature/4.x-multi-harness`. Re-provisioning
  a repo without the emit step returns to the pre-Story-5 state.
- **Emitted `.vscode/settings.json`:** this is the one change that touches a shared per-repo file
  (flagged in the ICEA Irreversibility section). Reversal = re-provision, or delete the scoping keys
  from `.vscode/settings.json`. Deleting them re-enables Copilot `.claude/` skill+rule discovery AND
  `.claude/` hook registration (i.e. returns to double-load / double-register) — so removal must be
  deliberate.
- **`_project-deploy/CLAUDE.md` / root `CLAUDE.md` §4 note:** revert via git; content is an additive note
  only, and §0/§0a/§0b were byte-unchanged, so reverting is a clean single-section undo.
- Verify after rollback: Claude Tier-A gate still blocks an un-approved Write (AC-NF4); on Copilot, the
  `/skills` menu and Hooks output channel return to their prior state.

---

## Handover

### QA Team
**What was added:** for both-harness repos, the provisioner now emits `.vscode/settings.json` that scopes
Copilot to `.github/` (excludes both project and user `.claude/` skill, rule, AND hook locations) and
keeps the shared `CLAUDE.md` readable by Copilot. The DEPLOYED instructions template
(`_project-deploy/CLAUDE.md`) gains an additive per-harness model-routing note in §4; no company name was
present or removed.

**How to test manually (MANUAL-verification items):** provision a scratch repo with both harnesses; open
in VS Code >=1.109 Copilot; grant Workspace Trust. Then **verify by actual load, not the flags**: open the
`/skills` menu and confirm only `.github/` skills+rules appear (no `.claude/` skills/rules), AND open the
Copilot Hooks output channel and confirm only `.github/hooks` are registered (no `.claude/` hooks). This
double check is required because of known suppression bugs microsoft/vscode#297538 and #299820 where a
`false` flag may not actually suppress the location. Confirm `CLAUDE.md` guidance (including the per-harness
note) is honoured. Repeat WITHOUT granting trust to confirm the documented untrusted behaviour. If a
Remote-SSH host is available, verify scoping there and note bug microsoft/vscode#293768. Trust-gating and
Remote-SSH are manual because they depend on live VS Code state.

**Regression risk (AC-NF4):** this story is Copilot-only for behaviour — Claude behaviour must be
unchanged. Run the parity check: on Claude, `.claude/skills` still load and the Tier-A hard gate still
`exit 2`-blocks a Write with no approved ICEA, pre and post this change. Confirm `CLAUDE.md`
§0/§0a/§0b are byte-identical pre/post.

**Test data:** scratch/synthetic repos only; no real privileged/PII/secret material.

### DevOps / Platform Team

| Item | Detail |
|---|---|
| `.vscode/settings.json` (committed, emitted) | Scopes Copilot skills+rules+hooks to `.github/`; `restricted:true` (workspace-trust-gated, MANUAL); verify-by-actual-load required (bugs #297538/#299820); Remote-SSH caveat microsoft/vscode#293768 (MANUAL). Committed config — include in secret scan. |
| Hook double-registration | Closed HERE via `chat.hookFilesLocations` → `.claude/settings*.json:false`. Story 4 owns the `.github/hooks` shim content those hooks run; this story makes `.github/hooks` the sole Copilot hook source. |
| Minimum VS Code version | >=1.109 for `chat.agentSkillsLocations` / `chat.instructionsFilesLocations` / `chat.hookFilesLocations`; older clients ignore the keys and read `.github/` natively |
| No new secrets | This story adds no secrets and no new env vars |
| No CI change | Tier-C `ai-gate.yml` is unaffected by this story |

### Future Developer — follow-on work
- If a Copilot-idiomatic instruction gap appears, add `.github/copilot-instructions.md` as a **thin
  pointer** to `CLAUDE.md` (never a duplicate) — this is the D-3 revisit path, tracked as a follow-on.
- The emit logic lives in the Copilot adapter path of `scripts/provision.*`; the settings contract is
  the block in Files Changed above. Keep the `false` user-level entries across all three scoping keys —
  dropping them reopens the skill+rule double-load or hook double-registration hole.
- The per-harness model note lives in `_project-deploy/CLAUDE.md` §4 (deployed) with a synced copy in the
  root `CLAUDE.md` §4. Edit the deployed template first; keep the note additive; never touch §0/§0a/§0b.
- To add a future harness, do not remove the `.claude/`-exclusion keys; add that harness's own include
  location alongside them.

---

## Test Cases

> Derived from AC-F5 (delivered — skills+rules+hooks scoping and verify-by-actual-load) and AC-NF4
> (parity). Positive, negative, integration, and manual cases.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | provisioner emit-settings | `provision --harness=claude,copilot`, no existing `.vscode/settings.json` | File written with all keys; `.claude/skills`, `~/.claude/skills`, `.claude/rules`, `~/.claude/rules` all `false`; `.github/*` `true`; `chat.useClaudeMdFile:true` | AC-F5 |
| P-U2 | provisioner emit-settings (merge) | existing `.vscode/settings.json` with unrelated key `editor.tabSize:2` | All scoping keys added; `editor.tabSize:2` preserved | AC-F5 |
| P-U3 | provisioner emit-settings (hooks key) | `provision --harness=claude,copilot` | `chat.hookFilesLocations` present with `.github/hooks:true` and `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` all `false` | AC-F5 |
| P-U4 | `_project-deploy/CLAUDE.md` §4 note | deployed template before the note is added | Output §4 contains the additive per-harness note (Claude env route vs Copilot soft picker); no existing §4 line changed; note present in the DEPLOYED file | AC-F5 |
| P-U5 | CLAUDE.md protected-section integrity | both `CLAUDE.md` files, pre vs post | §0 (Write Gate), §0a (keyword table), §0b (shell config) are byte-identical pre/post in both files | AC-NF4 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | provisioner emit-settings | `.vscode/` path is read-only / unwritable | Provisioning fails loudly (non-zero exit) with a message naming the double-registration risk (skills, rules, AND hooks); does NOT proceed with both harnesses active | AC-F5 |
| N-U2 | emitted settings content | inspect the emitted maps | No `.claude/skills:true`, no `.claude/rules:true`, and no `.claude/settings*.json:true` present (i.e. `.claude/` never re-enabled for Copilot skills/rules/hooks); user-level `~/.claude/*` entries not omitted | AC-F5 |
| N-U3 | `CLAUDE.md` §4 note | note-insertion run twice (idempotency) | Second run is a no-op; no double-inserted model note | AC-F5 |
| N-U4 | company-name regression check | scan both `CLAUDE.md` files | No company/client name present (assertion passes on current clean files; would fail if one were introduced) | AC-F5 |
| N-U5 | protected-section guard | a diff hunk that touches §0/§0a/§0b | The change is rejected/flagged — only §4 may change | AC-NF4 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Copilot shows only `.github/` skills+rules — verify by actual load (MANUAL) | Provision both harnesses; open in VS Code >=1.109 Copilot; grant Workspace Trust; open `/skills` menu | Only `.github/` skills+rules listed; NO `.claude/` skills/rules loaded — confirmed from the menu itself, not the flag (bugs #297538/#299820) | AC-F5 |
| INT-2 | `CLAUDE.md` still read under scoping (MANUAL) | Same repo, trusted; issue a request governed by `CLAUDE.md` guidance | Copilot honours `CLAUDE.md` incl. the per-harness note (chat.useClaudeMdFile:true effective) even though `.claude/` skills/rules are excluded | AC-F5 |
| INT-3 | Untrusted-workspace behaviour (MANUAL) | Provision both harnesses; open in Copilot but do NOT grant Workspace Trust | Scoping (restricted:true) not applied yet; `.github/` config still functions; provisioner-documented behaviour observed; no silent assumption of scoping | AC-F5 |
| INT-4 | Claude parity (AC-NF4) | Open the same both-harness repo in Claude Code, pre and post this story | `.claude/skills` load unchanged; Tier-A hard gate `exit 2`-blocks a Write with no approved ICEA both times; §0/§0a/§0b byte-unchanged | AC-NF4 |
| INT-5 | Remote-SSH caveat (MANUAL) | Open a both-harness repo on a Remote-SSH host in VS Code >=1.109 Copilot | Provisioner-emitted warning names microsoft/vscode#293768; scoping verified via `/skills` menu + Hooks output channel; Tier-C `ai-gate` noted as backstop | AC-F5 |
| INT-6 | Copilot registers only `.github/hooks` — verify by actual load (MANUAL) | Provision both harnesses; open in VS Code >=1.109 Copilot; grant Workspace Trust; open the Copilot Hooks output channel | Only `.github/hooks` registered; NO `.claude/settings*.json` hooks registered — confirmed from the Hooks output channel itself, not the flag (bugs #297538/#299820); closes F1.2 | AC-F5 |

> NF AC verification:
> AC-NF4 (Claude 3.x parity): verified by INT-4 and P-U5 — a Claude Write with no approved ICEA is
> blocked (`exit 2`) before and after this story, `.claude/` discovery on Claude is unchanged, and
> `CLAUDE.md` §0/§0a/§0b are byte-identical pre/post. This story writes only Copilot/VS Code config and
> an additive §4 note in the two `CLAUDE.md` files, so no Claude code path is altered.

---

### Revision Log
2026-08-13 — Story 5 tech spec drafted from the saved Epic ICEA/Tech Spec (dogfood; synthetic ADO-4000).
Scoped to AC-F5 (delivered) + AC-NF4 (parity check). Emitted `.vscode/settings.json` contract specified
(project + user `.claude/` skill/rule locations excluded; `chat.useClaudeMdFile:true` kept). Decision D-3
resolved: shared `CLAUDE.md` only — no `.github/copilot-instructions.md` emitted.
2026-08-13 (rev to match ICEA Revision Log "2026-08-13 #4" + revised AC-F5) — (1) Named exact instructions
target: `_project-deploy/CLAUDE.md` (deployed template read by Copilot) is the primary edit; root
`CLAUDE.md` kept in sync only. (2) Company-name scrub reframed as a verified no-op — ADDITIVE §4 note +
regression assertion no name remains; §0/§0a/§0b asserted byte-unchanged with a diff-under-Write-Gate
guard. (3) Stated the `.vscode` keys scope skills+rules only, NOT `.claude/settings.json` hooks — hook
double-load closed by Story 4 (`.github/hooks` sole registration); noted the emitted `.vscode/settings.json`
is committed config in scope for Story 4's secret scan. (4) Labelled workspace-trust-gating and Remote-SSH
(microsoft/vscode#293768) ACs as MANUAL-verification. (5) Reduced dependency to Stories 2,3 (dropped Story 4
as a dependency — `.vscode` scoping does not need the hook layer; kept 3 for `.github/instructions`).
(6) Aligned to revised AC-F5.
2026-08-14 (rev to match ICEA Revision Log "2026-08-14 #6" — ASYMMETRIC model) — (1) Emitted
`.vscode/settings.json` now ALSO includes `chat.hookFilesLocations` mapping `.claude/settings.json`,
`.claude/settings.local.json`, `~/.claude/settings.json` → `false`, so `.github/hooks` is the sole Copilot
hook source — closing the F1.2 hook double-registration hole HERE rather than deferring it to Story 4
(Story 4 still owns the `.github/hooks` shim content). (2) Added a verify-by-actual-load acceptance step
(INT-1 skills/rules via `/skills`; new INT-6 hooks via the Copilot Hooks output channel) because known
suppression bugs microsoft/vscode#297538 and #299820 mean a correct `false` flag does not prove the
location is suppressed — actual load must be confirmed, not the flags. (3) Kept: `_project-deploy/CLAUDE.md`
as the deployed model-note target; additive-only scrub (verified no-op); §0/§0a/§0b byte-unchanged;
dependency = Stories 2,3; trust-gating + Remote-SSH (#293768) as MANUAL-verify. (4) Aligned to the revised
AC-F5 (three scoping keys + verify-by-actual-load) and the asymmetric enforcement stance.
2026-08-14 (rev to match ICEA Revision Log "2026-08-14 #7/#8" — L1/L2/L3 structure LOCKED + prompt-artifact
versioning) — framing alignment only; no AC-scope or contract change. (1) Added the L1/L2/L3 placement of
this story's artifacts: the emitted `.vscode/settings.json` is Copilot-NATIVE L2/L3 config authored under
`Copilot/vscode/`; the per-harness model note is a single shared-instruction edit (L1-adjacent) consumed by
both harnesses; `_project-deploy/CLAUDE.md` is the DEPLOYED shared instruction that references L1. (2)
Confirmed NO projection language remains — scoping is native per-harness config emission, not a mechanical
projection of a Claude shape onto Copilot (Revision Log #7); scrubbed "projected/projection" in the header,
Overview, AC matrix, Files Changed, Error Handling, and Request Flow. (3) Kept unchanged: the three scoping
keys (agentSkills/instructions/hookFiles → `false` for `.claude/*`), `chat.useClaudeMdFile:true`,
verify-by-actual-load (#297538/#299820), additive-only scrub, Stories 2,3 dependency, and the emitted-file
contract. (4) Updated the source-ICEA pointer to Revision Log "2026-08-14 #8".
