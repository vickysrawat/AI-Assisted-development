# Tech Spec — Story 8: Provisioning, distribution & gate agents
ADO #4000 · Release 4 · Sprint 1 · Story 8
Status: DRAFT · STORY · 6 SP

> Per-story implementation spec for the EPIC ADO-4000 (LLM-Agnostic Multi-Harness Convergence).
> Source ICEA: `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md`
> (Revision Log 2026-08-14 #8 — L1/L2/L3 shared-content-core + native-per-harness structure; NO mechanical
> projection/delta-map (retired #7); asymmetric enforcement (#6); prompt-artifact versioning AC-F9 (#8).
> Story-8 scope ACs: AC-F4/F7/NF7 + AC-F8a/F8b + the AC-F9 CI bump-check / L1 re-author guardrail wiring).
> Epic Tech Spec: `temp/ADO-4000-tech.md`. This is a **plugin/tooling** story — Node.js CJS scripts
> plus generated markdown — so the web-app template sections (Schema Changes, browser→API→DB flow,
> Azure AD/CSRF/Key Vault) are omitted or re-cast to plugin reality as noted inline.

---

## Overview

This story makes the plugin's distribution layer **harness-neutral at machine-install time** and
**harness-selective at application-integration time**. Today the Node installer `install.cjs` is the
real machine-install path and is heavily Claude-coupled: it registers a Claude marketplace, runs
`claude plugin install`, and writes a `marketplace.json`. Story 8 splits those concerns so that
machine install copies only the tool-agnostic payload, and the Claude-marketplace registration is
**deferred to `provision --harness=claude`** — it is a Claude *integration* step, not a machine-install
step. The choice of which harness(es) a *project* is wired for (`claude`, `copilot`, or both) is made
at integration via a new `scripts/provision.cjs` CLI — either `provision --harness=claude,copilot` or
an interactive prompt — and recorded in a per-project `.aidev/manifest.json`.

**Provisioning under the L1/L2/L3 structure (ICEA #7/#8 — no mechanical projection).** The epic's locked
structure is a shared **content & standards** core (L1 = `Shared/`) that each harness's **native**
engagement + enforcement layers (L2/L3 = `Claude/` and `Copilot/`) *consume, never re-author*. There is
therefore **NO mechanical skill projection, NO delta-map, and NO runtime `$PLUGIN_DIR` bridge** — all
retired in ICEA #7. What "provisioning" means in this structure is a **file-copy composition**, not a
transform: for each selected harness, `provision.cjs` installs `Shared/` (L1) **plus that harness's own
native adapter folder** (`Claude/` or `Copilot/`) into the target repo's native paths. Claude gets the
`Claude/` adapter (≈ the v3.13 plugin, unchanged) laid into `.claude/`; Copilot gets the separately
authored `Copilot/` adapter (code-review skills, custom agents, `ai-gate.yml` required-check workflow,
`.vscode/` scoping) laid into `.github/` + `.vscode/`. No skill is transformed from a Claude shape into a
Copilot shape — the two adapters are authored independently and both point at the same L1 content.

Story 8 therefore *consumes* the L1 core + native adapters delivered by Story 2 and adds the
harness-selection CLI, manifest schemas, gate-install step, `Shared/prompt-manifest.json` install +
AC-F9 CI bump-check + L1 re-author guardrail wiring, sync mode, scoped teardown, and native-adapter agent
composition on top of them. This composition dependency (plus splitting the Claude-coupled `install.cjs`)
re-sizes AC-F4 above a `~` tweak — see Sizing.

A second, plugin-level `plugin.manifest.json` (neutral registry: `version` · `components` ·
`harnesses[]`) is introduced. It does **not silently replace** `.claude-plugin/config.json`: `config.json`
today holds org/marketplace/repo identity that `install.cjs` and `syncConfig` read, so the two coexist
during 4.x — `plugin.manifest.json` is the neutral provisioning registry (what to project, which
harnesses), while `config.json` remains the org/marketplace/repo identity source those scripts read.
The migration is explicit and staged (see "config.json → plugin.manifest.json migration" below), not a
delete-and-swap. The neutral `plugin.manifest.json` lists the supported **harnesses[]** and — because it
is the provisioning registry consuming the L1 core — the **L1 content version** it composes against (the
SemVer of the shared standards, per AC-F9), so a provision is pinned to a known L1 version, not "whatever
is on disk".

**Prompt-artifact versioning wiring (AC-F9).** The L1 core ships a `Shared/prompt-manifest.json` recording
`{version, sha256, consumes}` per prompt artifact (SKILL.md, rules, templates, critic rubric, commands,
agents). Story 2 authors that manifest and the CI logic; **Story 8 installs it into the target and wires
the two CI checks it drives into the target's CI**: (a) the AC-F9 **bump-on-change** check — a PR whose
prompt-artifact content changed without a corresponding `version:` bump (on-disk `sha256` ≠ manifest)
fails the build; and (b) the **L1 re-author guardrail** (AC-F2) — a PR that duplicates/forks an L1
standard into the `Copilot/` (or `Claude/`) adapter, rather than consuming it, fails the build. Both run
in the same CI surface `provision --harness=copilot` uses for `ai-gate.yml` (`.github/workflows/`);
provisioning copies the pinned `Shared/prompt-manifest.json` and records its SHA-256 in the manifest so a
tamper is detectable on `sync`. Like `ai-gate.yml`, the check **logic** is Story 2's; Story 8 only
distributes/wires it — it does not author the check.

Under the epic's **asymmetric enforcement model** (ICEA #6), the two harnesses gate at different points:
Claude prevents at write-time (Tier-A `icea-floor` `exit 2`, unchanged), while **Copilot's HARD gate is the
harness-independent CI `ai-gate` running as a REQUIRED status check on a protected branch** — un-bypassable
at merge, because you cannot `--no-verify` a required check. The Copilot client layer (projected skills, the
`review-icea` code-review skill, and the read-only agents this story generates) is **best-effort
authoring/review assistance**, NOT the hard line. This makes Story 8 the story that **stands up the Copilot
hard gate**: provisioning is now load-bearing for governance, not just file layout.

Concretely, provisioning must (a) distribute Story 6's `ai-gate.yml` into `.github/workflows/`, AND (b)
**emit the branch-protection setup that marks `ai-gate` a REQUIRED status check on the protected branch** —
via `gh api` branch-protection automation when a token + `gh` are available, and always as documented manual
steps as the fallback. Crucially, provisioning must **verify** that the target branch is actually protected
and the `ai-gate` check is actually required; if it is not, provisioning **WARNS loudly and refuses to claim
Copilot governance** — because without the required check, the Copilot hard gate simply does not exist and a
developer would falsely believe they are governed. This warn/refuse behaviour, and its ACs/tests, are new in
this revision (see "Copilot hard-gate setup" below).

The story also **generates the Copilot read-only gate agents** (`.github/agents/*.agent.md`) — a
**best-effort client assistance surface**, explicitly NOT the hard enforcement line (the required-check IS
the hard gate) — and extends `setup-sync` (re-project with **hash-tracked user-edit protection** so a manual
edit to a projected file is preserved or flagged, never clobbered) and teardown (remove per-harness projected
content **by scope**, never deleting user-owned `.github/` workflows/CODEOWNERS or `memory/`). The governing
pattern is *author-once, project-per-harness* with **idempotent, reversible, additive** provisioning. Gate
distribution is **vendored, pinned, and integrity-hashed** (AC-NF7 partial) — the provisioner copies the
pinned `Shared/gate/ai-gate` payload and records its SHA-256 in the manifest. Note: `ai-gate.yml` (the
CI workflow) is **created by Story 6** (single owner of gate logic); Story 8 only **distributes/projects**
the already-authored file into `.github/workflows/` — it does not author or double-create it.

**Dependencies:** Story 8 depends on **Story 2** (the L1 `Shared/` content core, the native adapters'
composition/install mechanism, `Shared/prompt-manifest.json`, and the AC-F9 bump-check + L1 re-author
guardrail CI logic), **Story 5** (Copilot scoping), and **Story 6** (gate logic + `ai-gate.yml` source).
Story 6 authors the gate; Story 2 authors the prompt-manifest + CI checks; Story 8 installs/distributes
them and stands up the required-check that turns `ai-gate` into the Copilot hard gate.

---

## AC Coverage Matrix

Every AC from this story's scope must be covered by at least one file change; every file change must
satisfy at least one AC. Gaps are flagged ⚠.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F4 | Harness selected at integration (`provision --harness=…`/interactive); machine install neutral; per selected harness compose L1 `Shared/` + that harness's NATIVE adapter (`Claude/` or `Copilot/`) into native paths (no mechanical projection); Claude-marketplace registration deferred to `provision --harness=claude`; choice recorded in `.aidev/manifest.json` | `scripts/provision.cjs`, `install.cjs`, `scripts/setup-init-bootstrap.cjs`, root `install.sh`/`install.ps1`, `.aidev/manifest.json`, `plugin.manifest.json` | ✅ Covered |
| AC-F9 (partial — install + CI wiring) | Provisioning installs `Shared/prompt-manifest.json` and wires the AC-F9 bump-on-change CI check + the L1 re-author guardrail (AC-F2) into the target's CI; manifest SHA-256 recorded for tamper-detect on `sync` (check logic authored by Story 2) | `scripts/provision.cjs` (manifest install + CI-check wiring), `Shared/prompt-manifest.json` (consumed, pinned), `.github/workflows/*` (bump-check + guardrail, distributed from Story 2), `.aidev/manifest.json` (prompt-manifest SHA-256 + L1 version) | ✅ Covered |
| AC-F8a | `setup-sync` re-projects with hash-tracked user-edit protection (edited projected file preserved/flagged, not clobbered) | `scripts/provision.cjs` (sync mode), `skills/setup-sync/SKILL.md`, `.aidev/manifest.json` (hash ledger) | ✅ Covered |
| AC-F8b | Teardown removes per-harness content by scope; DENY-LIST + hash-match guard before any `.github/` unlink; never touches user `.github/` workflows/CODEOWNERS or `memory/` | `scripts/provision.cjs` (teardown mode), `scripts/setup-teardown.cjs`, `skills/setup-teardown/SKILL.md` | ✅ Covered |
| AC-F7 (Copilot HARD gate — required-check stand-up) | Provisioning distributes `ai-gate.yml` into `.github/workflows/` AND emits the branch-protection setup that marks `ai-gate` a REQUIRED status check on the protected branch (via `gh api` automation and documented steps); provisioning WARNS and refuses to claim Copilot governance if the branch is not protected / the check is not required | `scripts/provision.cjs` (required-check + branch-protection step), `.github/workflows/ai-gate.yml` (distributed from Story 6), `.aidev/manifest.json` (protected-branch + required-check status) | ✅ Covered |
| AC-F7 (client assistance — agent composition) | Copilot read-only gate agent composed for **every** governed skill from the native `Copilot/` adapter (name derived from directory; NOT a mechanical projection of a Claude skill); a governed skill with no agent is a HARD FAILURE. Best-effort client surface, NOT the hard gate | `scripts/deploy-commands.cjs` (agent composer), generated `.github/agents/*.agent.md` | ✅ Covered |
| AC-NF7 (partial — gate distribution) | Vendored, pinned + integrity-hashed gate installed by provisioning | `scripts/provision.cjs` (gate-install step), `.aidev/manifest.json` (gate version + SHA-256), `Shared/gate/ai-gate` (consumed, pinned) | ✅ Covered |

> **L1/L2/L3 structure (ICEA #7/#8):** provisioning is a **file-copy composition** of L1 `Shared/` + the
> selected harness's NATIVE adapter (`Claude/` or `Copilot/`) — there is NO mechanical skill projection,
> delta-map, or `$PLUGIN_DIR` bridge (all retired #7). The `Copilot/` agents are composed from the native
> Copilot adapter, not transformed from Claude skills.
> **Asymmetric model (ICEA #6):** Claude prevents at write-time; **the Copilot HARD gate is the CI `ai-gate`
> as a REQUIRED status check on a protected branch** — and standing that up is THIS story's load-bearing
> AC-F7 deliverable. The generated read-only agents and any client hooks are best-effort assistance, not the
> hard line. AC-NF7 is only **partially** owned here (the gate *distribution* clause); the `ai-gate` logic,
> `ai-gate.yml` authoring, hook hash-verification-before-run, and warn-only + break-glass rollout are Story 6.
> **AC-F9 (#8)** is likewise **partial** here: the `Shared/prompt-manifest.json`, the bump-on-change CI check,
> and the L1 re-author guardrail are AUTHORED by Story 2 — Story 8 installs the manifest and wires those
> checks into the target's CI. The Claude Tier-A write-time hard gate itself (AC-F7 Claude side, AC-NF4
> parity) is Story 4 — Story 8 does not touch it.

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `scripts/provision.cjs` (new) | AC-F4, AC-F7 (required-check stand-up), AC-F8a, AC-F8b, AC-F9-partial, AC-NF7-partial |
| `install.cjs` (modify → strip Claude-marketplace registration to provision) | AC-F4 |
| `scripts/setup-init-bootstrap.cjs` (modify → harness-neutral) | AC-F4 |
| `scripts/setup-teardown.cjs` (modify → DENY-LIST + hash-match guard for `.github/`) | AC-F8b |
| `scripts/deploy-commands.cjs` (modify → compose `.github/agents/*` from the native `Copilot/` adapter, name from directory) | AC-F7 (client assistance) |
| root `install.sh` / `install.ps1` (modify → harness-neutral wrappers over `install.cjs`) | AC-F4 |
| `plugin.manifest.json` (new, neutral registry — harnesses[] + L1 content version) | AC-F4, AC-F9-partial |
| `Shared/prompt-manifest.json` (consumed, pinned — installed into target) | AC-F9-partial |
| `.aidev/manifest.json` (new, per-project record — incl. protected-branch + required-check status + prompt-manifest SHA-256) | AC-F4, AC-F7, AC-F8a, AC-F8b, AC-F9-partial, AC-NF7-partial |
| `.github/workflows/ai-gate.yml` (distributed from Story 6 — Story 8 composes into place, does not author) | AC-F7 (Copilot hard gate) |
| `.github/workflows/*` prompt-version bump-check + L1 re-author guardrail (distributed from Story 2 — Story 8 wires, does not author) | AC-F9-partial |
| generated `.github/agents/*.agent.md` (new output — best-effort client surface) | AC-F7 (client assistance) |
| `skills/setup-sync/SKILL.md` (modify) | AC-F8a |
| `skills/setup-teardown/SKILL.md` (modify) | AC-F8b |

**Coverage result:** all in-scope ACs (AC-F4, AC-F7 [Copilot hard gate + client assistance], AC-F8a, AC-F8b,
AC-F9-partial, AC-NF7-partial) covered; no orphaned file changes ✅. The required-check stand-up (AC-F7) is
the story's load-bearing enforcement deliverable — without it the Copilot hard gate does not exist; the
AC-F9 install + CI-wiring is the versioning-integrity deliverable (check logic authored by Story 2).

---

## Files Changed

> Plugin/tooling story — no schema, no DTOs. "Files Changed" is the script + manifest + generated-output
> set. `+` = new, `~` = modified. Every source/config write is Write-Gate governed (APPROVE ADO-4000).

| Path | Change | Purpose |
|---|---|---|
| `scripts/provision.cjs` | + | New CLI: `provision` / `sync` / `teardown` subcommands; `--harness=` flag + interactive fallback; per selected harness composes L1 `Shared/` + that harness's NATIVE adapter (`Claude/` or `Copilot/`) into native paths (file-copy composition — NO mechanical projection/delta-map); Claude-marketplace registration on `--harness=claude`; hash-tracked composition; scoped teardown delegating to the guarded `setup-teardown.cjs`; gate-install step; installs `Shared/prompt-manifest.json` + wires the AC-F9 bump-check + L1 re-author guardrail into the target CI; manifest read/write. **On `--harness=copilot`: distributes Story-6 `ai-gate.yml`, then stands up the Copilot HARD gate — marks `ai-gate` a REQUIRED status check on the protected branch (via `gh api` when available, else emits documented steps), VERIFIES the branch is protected + check required, and WARNS + refuses to claim Copilot governance if not.** |
| `install.cjs` | ~ | The real machine installer. Strip Claude-marketplace registration (`claude plugin install`, `marketplace.json` write) out of machine install and DEFER it to `provision --harness=claude`. Machine install copies only the harness-neutral payload. Continues to read `.claude-plugin/config.json` for org/marketplace/repo identity. |
| `scripts/setup-init-bootstrap.cjs` | ~ | Strip the Claude-only assumption: machine bootstrap copies only the harness-neutral payload; defers harness selection + projection to `provision.cjs` (Story-2 engine). |
| `scripts/setup-teardown.cjs` | ~ | Add a hard-coded protected DENY-LIST and a "plugin actually created this (hash match)" check applied BEFORE any unlink under `.github/`. Today this script never touches `.github/`; Story 8 introduces that deletion surface, so the guard is mandatory (data-loss risk). See "Gate distribution & teardown safety". |
| `scripts/deploy-commands.cjs` | ~ | Add the Copilot agent composer: for each governed skill, compose `.github/agents/<dir>.agent.md` from the **native `Copilot/` adapter** (not a mechanical projection of a Claude skill), deriving the agent name from the **directory name** (not frontmatter — most SKILL.md have no `name:`). A governed skill that fails to produce an agent is a HARD FAILURE (non-zero exit), not a warn-skip. |
| `install.sh` | ~ | Harness-neutral machine install wrapper — no `--harness`; invokes `install.cjs` bootstrap only. |
| `install.ps1` | ~ | Windows equivalent of the harness-neutral install wrapper. |
| `plugin.manifest.json` | + | Neutral plugin registry at repo root: `version`, `components[]`, `harnesses[]` (native adapter descriptors — `Claude/`, `Copilot/`), and the composed **L1 content version** (SemVer of the shared standards, AC-F9). The provisioning source of truth. Coexists with `.claude-plugin/config.json` (identity), which it does NOT replace — see migration below. |
| `Shared/prompt-manifest.json` | consumed | L1 prompt-artifact registry (`{version, sha256, consumes}` per artifact) authored by Story 2; Story 8 installs it into the target (pinned) and records its SHA-256 in `.aidev/manifest.json` for tamper-detect on `sync`. |
| `.aidev/manifest.json` | + | Per-project provisioning record: selected `harnesses[]`, projected-file **hash ledger** (path → SHA-256 at projection time), vendored gate `{version, sha256}`, plugin version stamp, and — for copilot — the **`copilotHardGate` block** recording the protected branch, whether `ai-gate` is a verified REQUIRED check, and the setup mode (`gh-api` / `manual-documented`). The teardown DENY-LIST + hash-match reads the ledger. |
| `.github/workflows/ai-gate.yml` | + (distributed) | The CI `ai-gate` workflow **authored by Story 6**; Story 8 only composes it into `.github/workflows/` (single owner — no double-create). This workflow, made a REQUIRED check, IS the Copilot hard gate. |
| `.github/workflows/*` (prompt-version bump-check + L1 re-author guardrail) | + (distributed) | The AC-F9 bump-on-change check + the AC-F2 L1 re-author guardrail, **authored by Story 2**; Story 8 only wires them into the target CI (single owner — no double-create). Fail a PR that changed a prompt artifact without a version bump, or that forks an L1 standard into an adapter. |
| `.github/agents/*.agent.md` | + (composed) | One read-only gate agent per governed skill, composed from the native `Copilot/` adapter, name = skill directory — a **best-effort Copilot client-assistance surface**, explicitly NOT the hard gate (the required-check is). |
| `skills/setup-sync/SKILL.md` | ~ | Document + drive sync mode: re-project, compare each target against its ledger hash, preserve/flag user edits. |
| `skills/setup-teardown/SKILL.md` | ~ | Document + drive scoped teardown; enumerate the never-touch protected set including the new `.github/` DENY-LIST + hash-match rule; state relationship to `provision.cjs teardown`. |

### config.json → plugin.manifest.json migration (no silent replace)

`.claude-plugin/config.json` is **not** deleted or overwritten by this story. Today `install.cjs` and
`syncConfig` read it for `{org, marketplace, repo}` identity. The migration is:

1. Story 8 adds `plugin.manifest.json` as the **neutral provisioning registry** (`version`,
   `l1ContentVersion`, `components[]`, `harnesses[]`) — which L1 content version to compose and which
   native adapters to lay down for which harnesses. It carries **no** org/repo identity.
2. `install.cjs` / `syncConfig` continue to read `config.json` for org/marketplace/repo — unchanged.
3. Where the two would overlap (`version`), `plugin.manifest.json` is authoritative for provisioning and
   `config.json`'s copy is left as-is for backward compat; a follow-on story (out of scope here) may fold
   identity into the neutral manifest once no reader depends on `config.json`.

### `plugin.manifest.json` — neutral registry shape

```json
{
  "version": "4.0.0",
  "l1ContentVersion": "1.0.0",
  "components": ["shared", "skills", "rules", "hooks", "gate", "eval", "prompt-manifest"],
  "harnesses": [
    { "id": "claude",  "adapter": "Claude",  "targets": [".claude/"] },
    { "id": "copilot", "adapter": "Copilot", "targets": [".github/", ".vscode/"] }
  ]
}
```

`l1ContentVersion` pins the composed SemVer of the shared `Shared/` (L1) standards (AC-F9); a provision
composes against a known L1 version. `harnesses[].adapter` names the NATIVE adapter folder copied
alongside L1 — the two adapters are authored independently, never projected from one another.

### `.aidev/manifest.json` — per-project record shape

```json
{
  "pluginVersion": "4.0.0",
  "l1ContentVersion": "1.0.0",
  "harnesses": ["claude", "copilot"],
  "gate": { "version": "1.4.0", "sha256": "hex-digest-of-vendored-ai-gate" },
  "promptManifest": { "version": "1.0.0", "sha256": "hex-digest-of-Shared-prompt-manifest-json" },
  "copilotHardGate": {
    "protectedBranch": "dev",
    "requiredCheckName": "ai-gate",
    "requiredCheckVerified": true,
    "setupMode": "gh-api",
    "governanceClaimed": true
  },
  "projected": [
    { "path": ".github/workflows/ai-gate.yml", "sha256": "hex", "harness": "copilot" },
    { "path": ".github/agents/icea-feature.agent.md", "sha256": "hex", "harness": "copilot" }
  ]
}
```

`copilotHardGate.governanceClaimed` is set `true` ONLY when `requiredCheckVerified` is `true` (the branch is
protected AND `ai-gate` is confirmed a required check). If verification fails, `governanceClaimed:false` is
recorded and provisioning WARNS that the Copilot hard gate is NOT in effect — it never records a Copilot
governance claim it could not verify.

---

## The provision / sync / teardown CLI (replaces "API Changes")

There is no HTTP API. The public contract is the `scripts/provision.cjs` command surface and the two
manifest schemas above.

| Command | Flags | Behaviour |
|---|---|---|
| `node scripts/provision.cjs` | `--harness=claude,copilot` (comma list) or omitted → interactive prompt; `--branch=<name>` (protected branch, default from `config.json` target branch); `--dry-run` | Compose L1 `Shared/` + the selected harness's NATIVE adapter (`Claude/` or `Copilot/`) into each harness's native paths (file-copy, NO mechanical projection); install `Shared/prompt-manifest.json` + wire the AC-F9 bump-check + L1 re-author guardrail into the target CI; on `claude`, run the deferred Claude-marketplace registration; on `copilot`, distribute Story-6 `ai-gate.yml` then **stand up the Copilot hard gate** (mark `ai-gate` a REQUIRED check on the protected branch via `gh api`, verify it, else emit documented steps + WARN); install vendored pinned+hashed gate; write `.aidev/manifest.json` (incl. `copilotHardGate`, `promptManifest`). Idempotent. |
| `node scripts/provision.cjs sync` | `--dry-run` | Re-compose using the harness set recorded in `.aidev/manifest.json`; per target, compare on-disk hash against the ledger; unchanged → re-compose; user-edited → **preserve and flag** (write `.new` alongside), never overwrite. Re-verify gate SHA-256 and `promptManifest` SHA-256 (tamper). |
| `node scripts/provision.cjs teardown` | `--harness=<id>` or `--full`; `--dry-run` (default preview) | Delegate to the guarded `setup-teardown.cjs`. Remove only plugin-projected paths recorded in the manifest for the named scope, applying the `.github/` DENY-LIST + hash-match FIRST. Never delete user-owned `.github/` workflows/CODEOWNERS or `memory/`. Requires explicit CONFIRM after dry-run. |

- **Machine install (`install.cjs` via `install.sh`/`install.ps1`) takes no `--harness`** — harness-neutral
  by contract. Harness selection and Claude-marketplace registration happen only at `provision` time (AC-F4).
- Re-integration is additive: `provision --harness=claude` then later `provision --harness=copilot` adds
  the Copilot projection and updates `.aidev/manifest.json` **without** a machine reinstall.

---

## Gate distribution & teardown safety (replaces "Auth & Security")

This is a governance plugin; "security" here is the integrity of provisioning and the safety of teardown.

- **Copilot hard-gate setup — the required status check (AC-F7, NEW load-bearing deliverable):** under the
  asymmetric model the Copilot hard gate is NOT a client hook — it is the CI `ai-gate` as a REQUIRED status
  check on a protected branch, un-bypassable at merge. `provision --harness=copilot` must therefore, after
  distributing Story-6 `ai-gate.yml` into `.github/workflows/`:
  1. **Mark `ai-gate` required.** When a token (`GH_TOKEN`/`GITHUB_TOKEN`) and the `gh` CLI are available,
     call the branch-protection API — e.g. `gh api -X PUT repos/{owner}/{repo}/branches/{branch}/protection`
     with `required_status_checks.contexts` including `ai-gate` (and `strict:true`). When no token/`gh` is
     available (common in the dogfood/local context), it **does not silently skip** — it prints the exact
     documented `gh api` command + the GitHub UI steps (Settings → Branches → Branch protection rule → Require
     status checks → select `ai-gate`) for a maintainer to apply, and records `setupMode:"manual-documented"`.
  2. **Verify.** Re-read the protection state (`gh api …/branches/{branch}/protection` when possible) and
     confirm the branch is protected AND `ai-gate` is in `required_status_checks.contexts`. Record the result
     in `.aidev/manifest.json.copilotHardGate.requiredCheckVerified`.
  3. **Warn + refuse the governance claim if unverified.** If the branch is not protected, or `ai-gate` is not
     a required check (verification failed, or manual mode with no confirmation), provisioning **WARNS loudly**
     — "Copilot HARD gate NOT in effect: `ai-gate` is not a required check on protected branch `{branch}`;
     ungoverned code can merge" — and sets `governanceClaimed:false`. It never records a Copilot governance
     claim it could not verify. This is the honest-assurance guarantee: no false "you are governed" on Copilot.
  The generated read-only agents and any projected client hooks are **best-effort assistance layered on top**
  — they do not substitute for the required check and are never treated as the hard line.

- **Vendored, pinned, integrity-hashed gate (AC-NF7 partial):** provisioning installs the gate from the
  in-repo vendored `Shared/gate/ai-gate` payload — never an unpinned `npx`. The installed version and its
  SHA-256 are recorded in `.aidev/manifest.json.gate`. `sync` re-computes the digest and reports a tamper
  mismatch. (`ai-gate.yml`, the gate's approval logic, hook hash-verify-before-run, and
  warn-only/break-glass rollout are Story 6 — Story 8 only distributes the gate + projects Story 6's
  `ai-gate.yml` into `.github/workflows/`; it does not author or double-create that workflow.)

- **Teardown DENY-LIST + hash-match before ANY `.github/` unlink (AC-F8b — data-loss guard):** the
  existing `setup-teardown.cjs` `rmSafe()` blindly unlinks whatever is queued and today **never targets
  `.github/`**. Story 8 introduces `.github/` as a deletion surface (generated agents, projected hooks,
  distributed `ai-gate.yml`), so trusting the manifest `projected[]` list alone is unsafe. Before deleting
  anything under `.github/`, teardown applies, in order:
  1. **Protected DENY-LIST (hard-coded, non-overridable):** `.github/workflows/**` authored by the user,
     `.github/CODEOWNERS`, any `.github/` path NOT recorded in `.aidev/manifest.json.projected[]`, and all
     of `memory/`. A path on the deny-list is refused even if a corrupt/forged manifest lists it.
  2. **Manifest lookup:** the path must appear in `projected[]` for the scope being torn down.
  3. **Hash-match ("did the plugin actually create this?"):** the on-disk file's SHA-256 must equal the
     ledger `sha256` recorded at projection time. If the file was hand-edited since projection (hash ≠
     ledger) it is treated as user-owned → refuse to unlink, flag it. Only a deny-list-clear, manifest-
     recorded, hash-matching `.github/` file is removable.
  Non-`.github/` scopes (`.claude/`, `.aidev/`, `temp/`) keep the existing behaviour; the new guard is
  scoped to the `.github/` deletion surface that Story 8 introduces.

- **Relationship to the existing teardown (`setup-teardown.cjs` + `skills/setup-teardown/SKILL.md`):**
  `provision.cjs teardown` does **NOT** replace `setup-teardown.cjs` — they **coexist**. `setup-teardown.cjs`
  remains the deterministic removal engine and single source of truth for `.claude/` scopes (`--full`,
  `--skills`, `--hooks`, `--rules`, `--commands`, `--state`) and gains the new `.github/` guard.
  `provision.cjs teardown --harness=<id>` is the harness-scoped front door that reads `.aidev/manifest.json`
  and delegates the actual unlink to `setup-teardown.cjs`, so the DENY-LIST + hash-match + CONFIRM flow lives
  in one place. The SKILL.md is updated to document both entry points and the new `.github/` protected set.

- **No secrets:** provisioning writes no credentials; the gate uses the existing `AZURE_DEVOPS_PAT` env
  var (never committed). `.aidev/manifest.json` contains only hashes and versions, no secret material.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Partial provisioning (write fails mid-run — e.g. `.vscode/` unwritable while `.github/` succeeded) | Fail loudly; do NOT record a half-projected harness as complete in `.aidev/manifest.json`. Report which targets were written; instruct re-run of `provision` (idempotent — re-projecting completed targets is a no-op by hash). |
| Sync clobber risk (projected file user-edited since last projection) | Hash mismatch vs ledger → **preserve** the user's file, write the fresh projection alongside as `<file>.new`, flag it. Never silently overwrite. Ledger hash is only updated for files that were unchanged and re-projected. |
| Teardown targets a `.github/` path (data-loss surface) | Apply DENY-LIST → manifest lookup → hash-match, in that order, BEFORE unlink. Any failing check refuses that path with an error naming it and why (deny-listed / not in manifest / hash mismatch = user-edited). Non-overridable. |
| Teardown over-reach (a manifest path resolves outside plugin-owned scope, or a symlink escapes) | Refuse to unlink; abort that path with an error naming it. |
| Missing adapter (manifest names a harness with no matching adapter folder / no `harnesses[]` entry) | Fail with a clear message naming the missing adapter; provision no partial harness. |
| Skill produces no agent when generating `.github/agents/*` | **HARD FAILURE** — non-zero exit naming the skill directory. A governed skill MUST have a generated agent (security intent: no ungoverned skill on Copilot). Not a warn-skip. |
| Interactive prompt in a non-TTY (CI) with no `--harness` | Fail fast with "no harness selected; pass `--harness=` in non-interactive contexts" — never default silently. |
| Gate SHA-256 mismatch on `sync` | Report tamper loudly; do not auto-overwrite the on-disk gate; instruct re-provision to restore the pinned payload. |
| Claude-marketplace registration fails during `provision --harness=claude` | Fail that harness loudly; do not record claude as provisioned; machine install stays intact (registration is a provision-time step, not install). |
| Copilot provisioned but target branch NOT protected / `ai-gate` not a required check | WARN loudly ("Copilot HARD gate NOT in effect — ungoverned code can merge on `{branch}`"); set `copilotHardGate.governanceClaimed:false`; do NOT claim Copilot governance. Provisioning of files still completes (agents/workflow projected) but the assurance state is honestly recorded as ungated. |
| No `gh` CLI / no token available to set branch protection | Do NOT silently skip. Print the exact `gh api` command + GitHub UI steps to require `ai-gate`; record `setupMode:"manual-documented"` and `requiredCheckVerified:false` until a maintainer applies + a later `sync` verifies. |
| `gh api` branch-protection call fails (permissions, 403/404) | Fail that step loudly naming the API error; fall back to documented manual steps; `governanceClaimed:false` until verified. Never assume success. |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F4 | `provision.cjs` CLI (harness flag + interactive); split Claude-marketplace registration out of `install.cjs` into `provision --harness=claude`; consume Story-2 L1 core + native-adapter composition (file-copy, no projection); neutral install split; both manifests + config.json coexistence | 3 |
| AC-F9 (partial) | install `Shared/prompt-manifest.json` (pinned, record SHA-256); wire the Story-2 bump-on-change check + L1 re-author guardrail into the target CI (`l1ContentVersion` pin) — install/wiring only, check logic is Story 2 | (folded into AC-F4 — install + CI-wiring, no net SP) |
| AC-F8a | sync mode + hash ledger + user-edit preserve/flag | 1 |
| AC-F8b | scoped teardown + `.github/` DENY-LIST + hash-match guard in `setup-teardown.cjs` | 1 |
| AC-F7 (Copilot hard gate) | distribute Story-6 `ai-gate.yml`; `gh api` branch-protection to require `ai-gate` (+ documented-steps fallback); verify protected branch + required check; WARN + refuse governance claim if unverified; record `copilotHardGate` in manifest | 1 |
| AC-NF7 (partial) + AC-F7 (client assistance) | vendored pinned+hashed gate install; `.github/agents/*` generator (name from directory, hard-fail on missing) | 1 |
| **Total** | | **6** |

**Total SP: 6** (re-sized from 5 in #2 for the `install.cjs` split + Story-2 dependency; held at 6 through
this #8 revision. The #7 L1/L2/L3 restructure REMOVES mechanical-projection complexity from AC-F4 —
composition is a simpler file-copy of L1 + a native adapter than the retired delta-map/override engine — and
that freed effort absorbs the AC-F9 prompt-manifest install + CI-check wiring folded in here. The required-
check stand-up (AC-F7) already absorbed the SP the agent line lost when agents became best-effort. Net: flat
at 6.)

**Type: STORY** — a single shippable slice (the distribution/provisioning layer that composes L1 + native
adapters and also **stands up the Copilot hard gate**). It depends on **Story 2** (L1 core + native-adapter
composition + `Shared/prompt-manifest.json` + AC-F9/guardrail CI logic), **Story 5** (scoping), and **Story
6** (gate logic + `ai-gate.yml` source) but delivers independent user value: a maintainer can provision,
re-sync, and tear down a repo for either or both harnesses, with the Copilot merge-gate actually enforced.
No sub-decomposition needed (≤6 SP, single logical slice).

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] All files changed as specified in Files Changed
- [ ] No hardcoded secrets, connection strings, or credentials in any script or manifest
- [ ] No `console.log` in production paths — provisioning output goes through a structured reporter
- [ ] `provision.cjs` is idempotent: re-running with the same harness set is a hash-level no-op
- [ ] Provisioning COMPOSES L1 `Shared/` + the selected harness's NATIVE adapter (`Claude/`/`Copilot/`) by file-copy — NO mechanical projection, delta-map, or `$PLUGIN_DIR` bridge (all retired #7)
- [ ] `Shared/prompt-manifest.json` installed (pinned); its SHA-256 recorded in `.aidev/manifest.json.promptManifest`
- [ ] The AC-F9 bump-on-change check + the AC-F2 L1 re-author guardrail (both authored by Story 2) are wired into the target CI — Story 8 does not author them
- [ ] `plugin.manifest.json` carries `l1ContentVersion`; a provision composes against that pinned L1 version
- [ ] Machine install (`install.cjs` / `install.sh` / `install.ps1`) accepts NO `--harness` flag
- [ ] Claude-marketplace registration removed from `install.cjs`; runs only in `provision --harness=claude`
- [ ] `.aidev/manifest.json` records harness set, projected-file hash ledger, and gate `{version, sha256}`
- [ ] `plugin.manifest.json` carries `version` · `l1ContentVersion` · `components` · `harnesses[]`; `config.json` untouched
- [ ] `setup-teardown.cjs` applies the `.github/` DENY-LIST + hash-match BEFORE any unlink under `.github/`
- [ ] Agent generator derives names from the skill DIRECTORY; a governed skill with no agent hard-fails
- [ ] `provision --harness=copilot` distributes Story-6 `ai-gate.yml` AND stands up `ai-gate` as a REQUIRED status check on the protected branch (via `gh api` or documented steps)
- [ ] Provisioning VERIFIES the branch is protected + `ai-gate` required; if not, it WARNS and records `copilotHardGate.governanceClaimed:false` — never a false Copilot governance claim
- [ ] Read-only agents are treated as best-effort client assistance, NOT the Copilot hard gate

**Quality**
- [ ] All positive and negative unit tests pass — see Test Cases
- [ ] All integration tests pass — see Test Cases
- [ ] Regression: existing Claude-only setup-init path still works (single-harness `provision --harness=claude`)
- [ ] Regression: existing `setup-teardown.cjs` `.claude/` scopes behave exactly as before (guard is `.github/`-only)

**Review readiness**
- [ ] PR title: `[ADO-4000] Story 8 — provisioning, distribution & gate agents`
- [ ] PR description maps each changed file to its ACs (reference AC Coverage Matrix)
- [ ] ICEA + this tech spec committed in the same branch

### Reviewer Checklist
- [ ] Machine install harness-neutral; harness + Claude-marketplace registration only at `provision` (AC-F4)
- [ ] `install.cjs` no longer registers the Claude marketplace at machine-install time (AC-F4)
- [ ] AC-F4 composes L1 `Shared/` + a NATIVE adapter (file-copy) — no mechanical projection/delta-map (retired #7); correctly depends on the Story-2 L1 core + adapter composition
- [ ] `Shared/prompt-manifest.json` installed + SHA-256 recorded; the AC-F9 bump-check + L1 re-author guardrail wired into target CI (logic authored by Story 2, not here)
- [ ] `plugin.manifest.json.l1ContentVersion` pins the composed L1 standards version (AC-F9)
- [ ] `config.json` is read (not replaced) by `install.cjs`/`syncConfig`; `plugin.manifest.json` is additive
- [ ] Sync preserves/flags a user-edited projected file — never clobbers (AC-F8a)
- [ ] Teardown applies DENY-LIST → manifest → hash-match before ANY `.github/` unlink (AC-F8b)
- [ ] A hand-edited or user-authored `.github/` file (hash ≠ ledger, or not in manifest) is NEVER removed
- [ ] Teardown never removes user `.github/` workflows/CODEOWNERS or `memory/`
- [ ] `provision.cjs teardown` delegates to `setup-teardown.cjs` (coexist, not replace)
- [ ] Gate installed from vendored pinned payload; SHA-256 recorded; no unpinned `npx` (AC-NF7 partial)
- [ ] `ai-gate.yml` is projected from Story 6's source, not authored/double-created here
- [ ] `provision --harness=copilot` marks `ai-gate` a REQUIRED status check on the protected branch (AC-F7)
- [ ] Provisioning verifies the required check + protected branch and WARNS/refuses the governance claim if not (AC-F7)
- [ ] No-token/`gh` path emits documented `gh api` + UI steps rather than silently skipping (AC-F7)
- [ ] `.github/agents/*.agent.md` generated per governed skill (name from directory); missing agent hard-fails — agents are best-effort assistance, NOT the hard gate

---

## Open Questions

None. All Story-8-relevant D-blocks resolved in the epic: D-1 (gate distribution) → vendored pinned+hashed
(this story's AC-NF7-partial); D-2 (artifact locations) is Story 3a and does not gate provisioning. The
asymmetric enforcement model (ICEA #6) fixes the Copilot hard gate as the CI `ai-gate` required status check
on a protected branch (known-good GA GitHub behaviour) — Story 8 stands it up; no open question remains.
Requires org branch-protection on the target repo (an operational prerequisite, surfaced by the WARN path,
not a design open question).

---

## Request Flow

```
MACHINE INSTALL (harness-neutral — no --harness, no Claude-marketplace registration):
  install.sh | install.ps1  ->  install.cjs
    -> copy tool-agnostic payload (Shared/, scripts/, plugin.manifest.json)
    -> read .claude-plugin/config.json for org/marketplace/repo identity (unchanged)
    -> NO harness projection, NO claude marketplace register, NO .aidev/manifest.json yet

APPLICATION INTEGRATION (provision — harness chosen here; needs Story-2 L1 core + native adapters):
  node scripts/provision.cjs --harness=claude,copilot   (or interactive)
    -> read plugin.manifest.json (l1ContentVersion + components + native harness adapters)
    -> for each selected harness: COMPOSE L1 Shared/ + that harness's NATIVE adapter into native paths
         (file-copy composition — NO mechanical projection/delta-map, retired #7)
         claude  -> Shared/ + Claude/  -> .claude/{skills,rules,hooks,settings.json} + Claude-marketplace reg
         copilot -> Shared/ + Copilot/ -> .github/{skills,instructions,agents,hooks,workflows} + .vscode/
    -> deploy-commands.cjs: compose .github/agents/<dir>.agent.md per governed skill from the Copilot adapter
                            (dir name; best-effort client assistance, NOT the hard gate)
    -> install Shared/prompt-manifest.json + WIRE the AC-F9 bump-on-change check + L1 re-author guardrail
                            into target .github/workflows/  (checks authored by Story 2; record manifest SHA-256)
    -> compose Story-6 ai-gate.yml into .github/workflows/  (distribute, not author)
    -> STAND UP THE COPILOT HARD GATE (AC-F7):
         gh api branch-protection -> require status check "ai-gate" on protected branch
           (no token/gh? -> print exact gh api cmd + GitHub UI steps; setupMode=manual-documented)
         verify: branch protected AND ai-gate in required_status_checks.contexts
         unverified -> WARN loudly + governanceClaimed=false (no false "you are governed")
    -> install vendored pinned+hashed gate (Shared/gate/ai-gate); compute SHA-256
    -> write .aidev/manifest.json { harnesses, projected[hash ledger], gate{version,sha256},
                                    copilotHardGate{branch, requiredCheckVerified, governanceClaimed} }

RE-INTEGRATION (additive, no reinstall):
  node scripts/provision.cjs --harness=copilot   (repo already had claude)
    -> project only copilot; MERGE into existing .aidev/manifest.json

SYNC (after plugin upgrade / re-projection):
  node scripts/provision.cjs sync
    -> re-project using recorded harness set
    -> per target: hash vs ledger — unchanged => re-project & refresh ledger
                                   user-edited => preserve + write <file>.new + FLAG
    -> re-verify gate SHA-256 => report tamper

TEARDOWN (scoped removal; delegates to guarded setup-teardown.cjs):
  node scripts/provision.cjs teardown --harness=copilot   (dry-run first)
    -> for each candidate .github/ path: DENY-LIST -> manifest lookup -> hash-match  (all must pass)
    -> remove only manifest projected[] paths for that harness that also hash-match
    -> require CONFIRM; leaves the OTHER harness, all user .github/ files, and memory/ intact
```

No network/DB tiers exist (in-process CLI). The only external touch is the local filesystem plus, on
`provision --harness=claude`, the Claude marketplace registration (deferred out of machine install).

---

## Rollback

**Schema migrations:** None — code/config only; `.aidev/manifest.json` and `plugin.manifest.json` are
additive JSON files; `.claude-plugin/config.json` is untouched.

**Rollback procedure:**
1. Story 8 lands on `feature/4.x-multi-harness`; revert its commit range to remove `provision.cjs`, the
   manifests, the agent generator, the `install.cjs` split, and the `setup-teardown.cjs` `.github/` guard —
   the frozen `v3.13.0` tag remains the Claude-only fallback.
2. Per provisioned repo: `provision teardown --full` removes all plugin-projected paths recorded in
   `.aidev/manifest.json` that pass the DENY-LIST + hash-match (leaving user `.github/` workflows/CODEOWNERS
   and `memory/` intact), returning the repo to a pre-provision state.
3. To roll back a *single* harness: `provision teardown --harness=copilot` — the other harness keeps
   working; verified by INT-3.
4. Verify: Claude-only provision still works (`provision --harness=claude`) and existing setup-init +
   `.claude/`-scope teardown behaviour is unchanged.

---

## Handover

### QA Team
**What was added:** a harness-neutral machine install (`install.cjs`, Claude-marketplace registration
moved to `provision --harness=claude`) plus a `provision`/`sync`/`teardown` CLI that **composes L1 `Shared/`
+ a NATIVE adapter (`Claude/`/`Copilot/`)** into a repo for Claude, Copilot, or both (file-copy, NO
mechanical projection — retired #7); a neutral `plugin.manifest.json` (`l1ContentVersion` + native
`harnesses[]`, coexisting with `config.json`); a per-project `.aidev/manifest.json` recording harness
choice, a projected-file hash ledger, the vendored gate's version+SHA-256, and the `Shared/prompt-manifest.json`
SHA-256; the installed `Shared/prompt-manifest.json` with the AC-F9 bump-on-change CI check + the L1
re-author guardrail wired into the target CI (check logic authored by Story 2); a `.github/` DENY-LIST +
hash-match guard in `setup-teardown.cjs`; and composed `.github/agents/*.agent.md` read-only gate agents
(name from directory, from the native Copilot adapter, best-effort assistance). **From the asymmetric
revision:** `provision --harness=copilot` distributes Story-6 `ai-gate.yml` and stands up `ai-gate`
as a REQUIRED status check on the protected branch — this IS the Copilot hard gate. If the branch is not
protected / the check is not required, provisioning WARNS and refuses to claim Copilot governance. Entry
points and negative tests (incl. the unprotected-branch WARN path) are in **Test Cases**.

**Regression risk:** the existing Claude-only setup path AND the existing `setup-teardown.cjs` `.claude/`
scopes must still behave exactly as before — the new guard is `.github/`-only. Provisioning must be
idempotent (re-run is a hash no-op).

**Test data:** scratch repos only. No real privileged/PII/secret material. Synthetic skill-directory
fixtures for the agent generator.

### DevOps / Platform Team

| Item | Detail |
|---|---|
| `install.cjs` | Real machine installer; harness-neutral after this story. No `--harness`; no Claude-marketplace registration at install. |
| `provision.cjs` CLI | Run at application-integration time; `--harness=` in CI (no interactive prompt); registers Claude marketplace on `--harness=claude`. |
| `.aidev/manifest.json` | Per-repo record of provisioned harnesses/versions/hashes; commit it; drives the teardown hash-match. |
| `plugin.manifest.json` | Neutral provisioning registry (`l1ContentVersion` + `harnesses[]` native adapters); coexists with `.claude-plugin/config.json` (identity). |
| `Shared/prompt-manifest.json` | L1 prompt-artifact registry (authored by Story 2); installed pinned + SHA-256 recorded. Drives the AC-F9 bump-on-change CI check + the L1 re-author guardrail, both wired into `.github/workflows/` at provision. |
| Vendored gate | Installed pinned + SHA-256-recorded; prefer internal registry later (D-1) but default vendored. |
| `ai-gate.yml` | Authored by Story 6; Story 8 only projects it into `.github/workflows/`. |
| **Copilot hard gate = required check** | `provision --harness=copilot` marks `ai-gate` a REQUIRED status check on the protected branch (via `gh api`, else documented steps). **This is the Copilot hard gate** — a target repo MUST have branch protection + this required check, or provisioning WARNS and does not claim governance. Needs a token with repo-admin (`gh api` branch-protection) in CI, or a maintainer applies the printed manual steps. |
| Protected branch | Defaults to the `config.json` target branch (`dev`); override with `--branch=`. |
| No new secrets | Gate reuses existing `AZURE_DEVOPS_PAT`; branch-protection uses `GH_TOKEN`/`GITHUB_TOKEN`; never committed. |

### Future Developer — Follow-on Work
- **Add a harness later** = add one native sibling adapter folder (e.g. `Cursor/`) that CONSUMES the same
  L1 `Shared/` (never re-authors it — CI guardrail enforces) + one `harnesses[]` entry in
  `plugin.manifest.json`. `provision.cjs` iterates `harnesses[]` and composes L1 + that adapter — no code
  change for a well-formed adapter, no projection/delta-map to extend.
- Fold org/marketplace/repo identity from `.claude-plugin/config.json` into the neutral manifest once no
  reader depends on `config.json` (deliberately deferred here to avoid a silent replace).
- Hook hash-verify-before-run + warn-only/break-glass rollout, and `ai-gate.yml` authoring, are Story 6.
- The agent generator reads only the skill directory name + SKILL.md body — extend the emitted `.agent.md`
  shape there if Copilot agent format evolves.

---

## Test Cases

> Tests derived from the in-scope ACs. Each AC gets a positive and a negative case; integration cases
> cover the deployed provisioning behaviour end-to-end.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `provision.cjs` harness parse | `--harness=claude,copilot` | both harnesses selected; `.aidev/manifest.json.harnesses = ["claude","copilot"]` | AC-F4 |
| P-U2 | `provision.cjs` manifest write | successful projection | `.aidev/manifest.json` has projected[] hash ledger + gate `{version, sha256}` | AC-F4, AC-NF7 |
| P-U3 | `install.cjs` neutral | machine install | payload copied; Claude marketplace NOT registered; no `.aidev/manifest.json` written | AC-F4 |
| P-U4 | Claude-marketplace registration | `provision --harness=claude` | marketplace registered / `claude plugin install` invoked at provision time (not install) | AC-F4 |
| P-U5 | sync hash compare | projected file unchanged vs ledger | file re-projected, ledger hash refreshed, no flag | AC-F8a |
| P-U6 | teardown scope filter | `--harness=copilot` over manifest projected[] | only copilot projected paths (deny-clear, hash-match) queued for removal | AC-F8b |
| P-U7 | agent generator | skill directory `icea-feature/SKILL.md` (no `name:` frontmatter) | emits `.github/agents/icea-feature.agent.md` (read-only, best-effort) from directory name | AC-F7 |
| P-U8 | gate install | vendored `Shared/gate/ai-gate` | gate copied; recorded SHA-256 matches recomputed digest | AC-NF7 |
| P-U9 | required-check stand-up (`gh api` path) | `provision --harness=copilot` on a protected branch with token+`gh` | `gh api` PUT called adding `ai-gate` to `required_status_checks.contexts`; verify re-read confirms; `copilotHardGate.requiredCheckVerified:true`, `governanceClaimed:true` | AC-F7 |
| P-U10 | `ai-gate.yml` distribution | Story-6 `ai-gate.yml` source present | projected into `.github/workflows/ai-gate.yml`; recorded in projected[] ledger | AC-F7 |
| P-U11 | no-token documented fallback | `provision --harness=copilot`, no `gh`/token | exact `gh api` command + GitHub UI steps printed; `setupMode:"manual-documented"`; not silently skipped | AC-F7 |
| P-U12 | native-adapter composition | `provision --harness=claude` | `Shared/`(L1) + `Claude/` adapter composed into `.claude/`; no delta-map/projection step invoked; no `$PLUGIN_DIR` written | AC-F4 |
| P-U13 | prompt-manifest install | `provision --harness=copilot` | `Shared/prompt-manifest.json` installed pinned; `.aidev/manifest.json.promptManifest.sha256` = recomputed digest; `l1ContentVersion` recorded | AC-F9 |
| P-U14 | AC-F9 CI wiring | provision | the bump-on-change check + L1 re-author guardrail (Story-2 authored) wired into target `.github/workflows/`; Story 8 does not author the check logic | AC-F9 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | machine install (`install.cjs`/`install.sh`/`install.ps1`) | `--harness=claude` passed | rejected / ignored — install is harness-neutral by contract | AC-F4 |
| N-U2 | sync clobber guard | projected file user-edited (hash ≠ ledger) | file preserved, `<file>.new` written, edit FLAGGED — not overwritten | AC-F8a |
| N-U3 | teardown DENY-LIST | `.github/workflows/ci.yml`, `.github/CODEOWNERS`, `memory/` present | none removed even if forged into manifest; deny-list refuses first | AC-F8b |
| N-U4 | teardown hash-match | `.github/agents/x.agent.md` in manifest BUT hand-edited (hash ≠ ledger) | refuse to unlink; flag as user-edited; not removed | AC-F8b |
| N-U5 | teardown unrecorded `.github/` | a `.github/` file NOT in `projected[]` | refused (not plugin-created); never removed | AC-F8b |
| N-U6 | missing adapter | manifest names `cursor`, no adapter folder | fail loudly naming missing adapter; no partial projection | AC-F4 |
| N-U7 | partial provisioning | `.vscode/` write fails mid-run | harness NOT recorded complete; loud error; re-run idempotent | AC-F4 |
| N-U8 | non-TTY interactive | CI run, no `--harness` | fail fast "no harness selected"; never default silently | AC-F4 |
| N-U9 | agent generator hard-fail | governed skill produces no agent | HARD FAILURE (non-zero exit) naming the skill directory — not a warn-skip | AC-F7 |
| N-U10 | gate tamper | on-disk gate SHA-256 ≠ manifest | sync reports tamper; does not auto-overwrite | AC-NF7 |
| N-U11 | unprotected branch — no false governance | `provision --harness=copilot` on a branch with NO protection / `ai-gate` not required | WARN loudly ("Copilot HARD gate NOT in effect — ungoverned code can merge"); `governanceClaimed:false`; never claims Copilot governance | AC-F7 |
| N-U12 | `gh api` branch-protection failure | `gh api` returns 403/404 | fail that step loudly naming the error; fall back to documented steps; `requiredCheckVerified:false`; not assumed success | AC-F7 |
| N-U13 | verify catches a lie | manifest would claim required but re-read shows `ai-gate` absent from `required_status_checks.contexts` | verification fails → `governanceClaimed:false` + WARN; the claim is refused | AC-F7 |
| N-U14 | prompt-manifest tamper on sync | on-disk `Shared/prompt-manifest.json` SHA-256 ≠ `.aidev` ledger | `sync` reports tamper loudly; does not auto-overwrite | AC-F9 |
| N-U15 | no re-authored projection | adapter folder missing but a delta-map/projection is attempted | there is NO projection path — composition fails loudly "missing native adapter", never fabricates a projected skill | AC-F4 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Provision claude-only then re-integrate +copilot with no reinstall | `provision --harness=claude` → later `provision --harness=copilot` | copilot projection added; manifest merged to both; NO machine reinstall; both harnesses then work | AC-F4 |
| INT-2 | Edit projected file → sync preserves | provision; hand-edit a projected `.github/skills/*`; `provision sync` | edit survives; `<file>.new` written; sync report flags it | AC-F8a |
| INT-3 | Teardown leaves user `.github/` + `memory` intact | provision both; add user `.github/workflows/ci.yml` + `.github/CODEOWNERS` + `memory/MEMORY.md`; `provision teardown --harness=copilot` (CONFIRM) | copilot projection removed (deny-clear, hash-match only); user `ci.yml`, CODEOWNERS, and `memory/` intact; claude harness still works | AC-F8b |
| INT-4 | Teardown refuses user-edited generated agent | provision copilot; hand-edit a generated `.github/agents/x.agent.md`; teardown | that agent refused (hash ≠ ledger) and flagged; other agents removed | AC-F8b |
| INT-5 | Gate installed pinned+hashed | fresh provision | vendored gate present; manifest gate SHA-256 matches recomputed digest | AC-NF7 |
| INT-6 | Agents generated for all governed skills | provision copilot | one `.github/agents/<dir>.agent.md` per governed skill, read-only, derived from directory; a skill missing an agent fails the run | AC-F7 |
| INT-7 | `ai-gate.yml` distributed not double-created | provision copilot after Story 6 authored `ai-gate.yml` | Story-6 `ai-gate.yml` projected into `.github/workflows/`; not re-authored/overwritten | AC-F7 |
| INT-8 | Copilot hard gate stood up end-to-end | on a protected-branch fixture repo (token+`gh`): `provision --harness=copilot` | `ai-gate.yml` present in `.github/workflows/`; `ai-gate` is a REQUIRED check on the protected branch; `copilotHardGate.governanceClaimed:true`; a PR failing `ai-gate` cannot merge | AC-F7 |
| INT-9 | Unprotected branch → honest ungated state | provision copilot on an unprotected-branch fixture | files composed but WARN emitted; `governanceClaimed:false`; no false Copilot governance claim recorded | AC-F7 |
| INT-10 | L1 composition + AC-F9 wiring end-to-end | `provision --harness=claude,copilot` on a fixture repo | `Shared/`(L1) laid down once + `Claude/`/`Copilot/` native adapters into their paths; `Shared/prompt-manifest.json` installed; bump-check + L1 re-author guardrail present in `.github/workflows/`; `l1ContentVersion` + `promptManifest.sha256` in `.aidev/manifest.json` | AC-F4, AC-F9 |
| INT-11 | Guardrail fails a forked L1 standard | provision copilot; fork an L1 rule into the `Copilot/` adapter; run the wired guardrail | the wired L1 re-author guardrail fails the PR (logic authored by Story 2; exercised via the wiring Story 8 installed) | AC-F9 |

> NF AC verification:
> AC-NF7 (partial — gate distribution): verified by INT-5 / N-U10 — vendored gate installed pinned, SHA-256
> recorded in `.aidev/manifest.json`, tamper (digest mismatch) detected on `sync`.
> AC-F7 (Copilot HARD gate = required status check): verified by P-U9/P-U10/P-U11 + N-U11/N-U12/N-U13 +
> INT-7/INT-8/INT-9 — `ai-gate` made a required check on a protected branch, verified, and the governance
> claim refused (with a loud WARN) whenever the branch is unprotected or the check is not required. The
> Claude write-time side of AC-F7 (Tier-A `icea-floor`) is Story 4; not exercised here.
> AC-F9 (partial — install + CI wiring): verified by P-U13/P-U14 + N-U14 + INT-10/INT-11 — `Shared/prompt-
> manifest.json` installed pinned + SHA-256 recorded, tamper detected on `sync`, and the bump-on-change +
> L1 re-author guardrail checks wired into the target CI. The check LOGIC (bump comparison, guardrail rule)
> is authored by Story 2; Story 8 only installs/wires it, so only the install/wiring is exercised here.

---

### Revision Log
2026-08-13 — Story 8 tech spec drafted from the saved epic ICEA + epic Tech Spec (dogfood; synthetic
ADO-4000). Web-app template sections adapted to plugin reality.
2026-08-13 #2 — REVISE to match ICEA Revision Log #4 + review findings. (1) Teardown safety: added a
hard-coded `.github/` DENY-LIST + "plugin actually created this (hash-match)" check applied BEFORE any
unlink under `.github/`; reconciled with the existing `setup-teardown.cjs` + `skills/setup-teardown/SKILL.md`
(coexist, not replace) and added `setup-teardown.cjs` to Files Changed; noted today's teardown never
touches `.github/` (new data-loss surface). (2) Machine install: added `install.cjs` (the real installer)
to Files Changed; deferred Claude-marketplace registration to `provision --harness=claude`; recorded the
Story-2 projection-engine dependency for AC-F4 and re-sized 5→6 SP. (3) Agent generation: name derived from
skill DIRECTORY (most SKILL.md lack `name:`); a governed skill with no agent is now a HARD FAILURE. (4)
Specified the `config.json` → `plugin.manifest.json` migration (coexist; install.cjs/syncConfig keep reading
config.json). (5) `ai-gate.yml` created by Story 6, only distributed here (no double-create). (6) Aligned to
revised AC-F4/F8a/F8b/NF7.
2026-08-14 #4 — REVISE to ICEA Revision Log #8 (L1/L2/L3 shared-content-core + native-per-harness; #7
retired mechanical projection; #8 prompt-artifact versioning AC-F9). Re-cast provisioning from a
"projection engine" consumer into a **file-copy composition** of L1 `Shared/` + the selected harness's
NATIVE adapter (`Claude/`/`Copilot/`) — removed all "delta-map"/"projection engine"/`$PLUGIN_DIR`-bridge
language (retired #7). Added the **AC-F9 install + CI-wiring** deliverable: `provision.cjs` installs
`Shared/prompt-manifest.json` (pinned, SHA-256 recorded) and wires the Story-2-authored bump-on-change
check + the L1 re-author guardrail (AC-F2) into the target CI; added `l1ContentVersion` to
`plugin.manifest.json` and `promptManifest`/`l1ContentVersion` to `.aidev/manifest.json`. Added an AC-F9
coverage row + File→AC entries; new DoD, Reviewer-Checklist, Sizing (folded into AC-F4, SP held at 6 — the
simpler composition offsets the added wiring), Request-Flow step, Handover rows, and tests
P-U12/P-U13/P-U14 + N-U14/N-U15 + INT-10/INT-11. Kept intact (asymmetric revision): the branch-protection
required-check Copilot hard gate, hash-verified `.github/` teardown (DENY-LIST + hash-match), `install.cjs`
split + deferred Claude-marketplace registration, directory-name agent composition with hard-fail,
config.json→plugin.manifest.json coexistence. Dependencies confirmed 2, 5, 6. Source-ICEA pointer → #8.
2026-08-14 #3 — REVISE to the ASYMMETRIC enforcement model (ICEA Revision Log #6 + AC-F4/F7/NF7). Story 8
now **owns standing up the Copilot HARD gate**: provisioning distributes Story-6 `ai-gate.yml` AND emits the
branch-protection setup that marks `ai-gate` a REQUIRED status check on the protected branch (via `gh api`
when a token/`gh` is available, else documented `gh api` + GitHub-UI steps), VERIFIES the branch is protected
+ the check required, and WARNS + refuses to claim Copilot governance (`copilotHardGate.governanceClaimed:false`)
when it is not — because without the required check the Copilot hard gate does not exist. Added `copilotHardGate`
block to `.aidev/manifest.json`, an `.github/workflows/ai-gate.yml` distribution row, a "Copilot hard-gate setup"
subsection, error-handling rows (unprotected branch / no-token fallback / `gh api` failure / verify-catches-a-lie),
DoD + Reviewer-Checklist items, and tests P-U9/P-U10/P-U11 + N-U11/N-U12/N-U13 + INT-8/INT-9. Re-cast the generated
read-only agents as **best-effort client assistance, NOT the hard line** (the required-check is). Aligned the AC
Coverage Matrix to AC-F4/F7/NF7 (asymmetric). Kept intact: hash-verified `.github/` teardown (DENY-LIST +
did-plugin-create-it), `install.cjs` split + deferred Claude-marketplace registration, directory-name agent
generation with hard-fail, config.json→plugin.manifest.json coexistence migration. Dependencies confirmed 2, 5, 6.
SP held at 6.
