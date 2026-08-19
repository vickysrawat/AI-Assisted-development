# ICEA — LLM-Agnostic Multi-Harness Convergence (Claude Code + GitHub Copilot)
ADO #4000 · Release 4 · Sprint 1
Status: ✅ APPROVED 2026-08-14 · EPIC · ~41 SP · asymmetric L1/L2/L3 design (ICEA #6/#7/#8)
(Feature Gate OPEN — implementation may begin; **Story 1 (self-containment spike) is the first implementation story**, whose result may trigger a REVISE. Approved on the CURRENT specs: all 9 re-cascaded to #8; the TECH-mode critic flagged the epic-spec body → re-synced → clean. Approved WITHOUT a pre-approval hands-on spike, per developer direction — the spike runs as Story 1.)

> Source plan (approved): `docs/plans/2026-08-12-llm-agnostic-multi-harness-convergence.md`
> Grounding: `.claude/architecture/architecture.md` §8 (multi-harness direction) + `.claude/graph/graph-index.md`.
> Dogfood note: this ICEA governs the plugin's OWN 4.x build. Synthetic ADO id (docs-only; no live ADO).

---

## Intent

### Problem Statement
The `ai-assisted-development` plugin (v3.13.0) is tightly coupled to Claude Code: skills resolve a runtime `$PLUGIN_DIR`, enforcement relies on Claude-only write-time hooks, and provisioning targets the Claude marketplace. Teams standardised on **GitHub Copilot** therefore cannot use the ICEA governance the firm depends on — leaving a compliance gap (ungoverned AI-assisted code in a privileged/PII law-firm context) and forcing a Claude-only tooling mandate. The cost of not solving it: either the plugin's governance does not reach Copilot users at all, or the firm maintains two divergent toolchains. Success = **the same ICEA governance and skills run under both Claude Code and GitHub Copilot from a single source, with no per-developer setup and no content drift**, and with the privileged-data safety properties strengthened, not weakened, by the second harness.

### Story
As a **plugin maintainer at a law firm with mixed Claude Code / GitHub Copilot teams**, I want to **converge the existing plugin onto the cross-tool Agent-Skills standard (one scoped source projected into each harness's native paths)**, so that **every developer — on either tool — works under the same approved-ICEA-before-code governance, from one maintained codebase, with privileged-data egress and approval-integrity controls enforced across both harnesses.**

### Success Metrics
- One relocated skill runs unmodified-in-intent in **both** Claude Code and VS Code Copilot ≥1.109 with **zero** `$PLUGIN_DIR`/dangling-reference failures (proven in Phase 1 before the full roll-out).
- After a repo is provisioned for both harnesses, a developer on **either** tool needs **0** manual setup steps (config is committed: Claude reads `.claude/`, Copilot reads `.github/` + `.vscode/`).
- **0** double-registration: with both harnesses provisioned, Copilot does not also load `.claude/` skills/rules (verified via emitted `.vscode/settings.json` scoping).
- **1** source of truth per artifact: skills/rules/hooks authored once in `Shared/`; architecture, graph, `memory/`, `docs/` generated once in neutral locations (no per-harness duplication).
- Enforcement is **asymmetric but hard on BOTH harnesses, at different gate points**: **Claude prevents at write-time** (Tier-A `icea-floor` `exit 2`); **Copilot prevents at merge-time** via the CI `ai-gate` as a **required status check on a protected branch** (un-bypassable — you cannot `--no-verify` a required check). The Copilot client layer (projected skills, the `review-icea` code-review skill, PreToolUse `exit 2` where it fires) is **best-effort authoring/review assistance on top**, not the hard line. Shared invariant: **no unapproved/untraceable code reaches the shared branch.** A poisoned `MEMORY.md` instruction is not acted on (prompt-level guard + provenance); B6/B7 context is classified + warned/withheld at assembly and caught in committed artifacts by the merge gate — runtime vendor-client egress is DLP's (see AC-NF2).
- The behavioural eval suite runs in CI against **checked-in artifacts / recorded transcripts** (expected shape + AC coverage) for each supported model+harness where a runner exists — detecting governance regression without depending on a headless Copilot skill-runner (which does not exist — see AC-NF6).

---

## Context

### Personas
**Dana — Claude Code developer:** senior engineer on a Claude-standardised team · already relies on the ICEA gate and write-time hooks · goal: nothing about her workflow regresses in 4.x · frustration: a refactor that breaks project-`.claude/skills` loading or the hard write gate · success measure: 3.x behaviour is preserved bit-for-bit on Claude after convergence.

**Cody — GitHub Copilot developer:** engineer on a Copilot-standardised team on VS Code ≥1.109 · cannot install Claude Code · goal: get ICEA governance + the skills (architecture, ICEA, critic, review) inside Copilot · frustration: having to hand-maintain a parallel Copilot config or losing the hard gate · success measure: clones a provisioned repo and the governance + skills "just work" with no setup.

**Morgan — plugin maintainer:** owns the plugin · goal: author each skill/rule ONCE and have it work on both harnesses · frustration: content drift between two copies; a fragile transform layer · success measure: adds a harness later by adding one adapter folder + one manifest line, nothing else moves.

**Priya — security / governance owner (law firm):** accountable for privileged-matter & PII handling · goal: approval integrity + no privileged data egress to unapproved models, on **both** harnesses · frustration: a Copilot cloud path that leaks B6/B7 context, or an AI that self-forges `Status: Approved` · success measure: approval bound to system-of-record; B1–B7 egress policy enforced; secrets never enter model context; every governed artifact is audit-stamped.

### System Context
| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| Source structure | `Shared/` + `Claude/` + `Copilot/` + `plugin.manifest.json` | new | scoped source; adapters thin |
| Skills | `skills/*` (32) → `Shared/skills/*` | modify | self-contained; retire `$PLUGIN_DIR`; delta-map + per-skill override |
| Rules | `.claude/rules/*` → `Shared/rules/*` | modify | `paths:` where safe; unconditional where creation-critical |
| Hooks | `.claude/hooks/*` (9) | extend | compat shim (matcher-in-script + tool-name map) for Copilot Preview hooks |
| Enforcement (Tier C) | `Shared/gate/ai-gate` + `.git/hooks/pre-commit` + CI `ai-gate.yml` | new | harness-independent backstop; ADO-bound approval |
| Provisioning | `scripts/setup-init-bootstrap.cjs`, `deploy-commands.cjs`, root `install.*`, new `provision.*` | modify/new | harness-neutral install; `--harness=` selection at integration; emits `.vscode/settings.json` |
| Copilot projection | `.github/{skills,instructions,agents,hooks,workflows}` + `.vscode/settings.json` + `.vscode/mcp.json` | new | native Copilot paths; scoping disables `.claude/` discovery |
| Config/identity | `.claude-plugin/config.json` → `plugin.manifest.json` (neutral) | modify | harness-neutral registry: version · components · harnesses[] |
| Artifacts (shared) | `.claude/architecture` + `.claude/graph` → neutral (`docs/architecture`, `.aidev/graph`) | modify | generated once, read by path, shared by both |
| Eval/observability | `Shared/eval/` + audit stamping + capability floor | new | behavioural eval per model/harness; cross-harness cost telemetry |

### Change Tier
**T2 (new capability) with significant T1 (structural) content.** The epic introduces a new capability (multi-harness support) and restructures the source tree and provisioning. Per-story tiers vary (e.g. Phase 0 = T0 verification; Phase 1 = T1 structural spike; Phase 6 = T2 governance capability). Tiers are finalised per story at Tech-Spec sizing.

### Enforcement model (asymmetric — the core design stance)
The plugin does NOT force Copilot to imitate Claude's strict write-time gate (web-verified: Copilot's write-time hooks are Preview + timeout-fail-open, and it has no native inline sibling-skill invocation). Each harness enforces where it is strong:
- **Claude = PREVENTION (shift-left):** write-time hard gate (`icea-floor` `exit 2`) + inline critic loop — governed *by construction*, before code is written. Unchanged/strict.
- **Copilot = DETECTION + MERGE-GATE (shift-right):** the hard gate is the harness-independent CI `ai-gate` as a **required status check on a protected branch** (un-bypassable at merge — known-good, GA GitHub behaviour). The critic runs at **review time** as a GA Copilot code-review skill (`review-icea`) — needing NO inline sibling-skill orchestration. Client-side skills/hooks are best-effort assistance.
- **Shared invariant:** no unapproved/untraceable code reaches the shared branch — write-time on Claude, merge-time on Copilot+GitHub; the Tier-C `ai-gate` is the common floor. Same `Shared/` source + ICEA method; only the enforcement *mechanism* differs per harness (adaptation, not content drift).
- **Trade stated honestly:** adding Copilot widens reach; authoring-time prevention is stronger on Claude, but the merge-gate makes the *code-to-shared-branch* guarantee equivalent. Requires org branch-protection — the provisioner emits the required-check workflow and warns if the branch is unprotected.

### Repository structure & layering (L1/L2/L3 — shared content, native harnesses)
The Copilot side is DESIGNED NATIVELY to its strengths, not mechanically projected from a Claude shape.
```
plugin/
  Shared/          # L1 — CONTENT & STANDARDS (single source; harness-independent) — NEVER duplicated
    icea/          #   ICEA + Tech-Spec method, templates, critic rubric
    rules/         #   coding standards, B1–B7 taxonomy, decision/consent specs
    knowledge/     #   code-review + security checker knowledge; architecture/graph generators
    gate/          #   the harness-independent ai-gate (Tier-C floor)
    guardrail/     #   CI check: the Copilot side must not RE-AUTHOR an L1 standard
  Claude/          # L2+L3 — NATIVE Claude (≈ the v3.13 plugin, unchanged): skills/ rules/ hooks/ .claude-plugin/
  Copilot/         # L2+L3 — NATIVE Copilot (redesigned to GitHub/Copilot strengths)
    skills/        #   code-review skills (review-icea), prompt files
    agents/        #   custom/coordinator agents (orchestration, Copilot-native)
    workflows/     #   ai-gate.yml required-check (the Copilot HARD gate)
    vscode/        #   settings scoping (agentSkills / instructions / hookFiles)
  <neutral artifacts>  # architecture, graph, memory/, docs/ — generated once, read by both
```
**Rule:** L1 is never duplicated — `Claude/` and `Copilot/` CONSUME it, never re-author it (CI-enforced). L2 (engagement) + L3 (enforcement) are designed **natively** per harness; there is no mechanical projection between them. Adding a harness later = a new native sibling folder consuming the same L1.

---

## Examples

### Happy Path
**Given** a repo provisioned with `provision --harness=claude,copilot` (config committed) **When** Dana opens it in Claude Code and Cody opens it in VS Code Copilot ≥1.109 **Then** both get the same skills and the same ICEA gate — Claude from project `.claude/skills` + hooks, Copilot from `.github/skills` + `.github/hooks` + the committed `.vscode/settings.json` — with no manual setup by either developer, and neither tool double-loads the other's config.

### Edge Cases
**Given** a Copilot user on **VS Code < 1.109** (no Claude-compat / no `chat.agentSkillsLocations`) **When** they open a both-harness-provisioned repo **Then** provisioning has emitted native `.github/` config that Copilot reads directly, and the tool degrades predictably (documented minimum version); the plugin surfaces a version notice rather than silently mis-loading.

**Given** a both-harness repo whose **workspace is not yet trusted** in VS Code **When** Copilot starts **Then** because `chat.agentSkillsLocations`/`instructionsFilesLocations` are `restricted:true` (workspace-trust-gated), the `.claude/`-disabling scope does not apply until trust is granted — the provisioner documents this and the projected `.github/` config still functions; no privileged scoping is silently assumed.

**Given** a stateful/orchestrating skill (`icea-feature`, `migration`, or a skill invoking a sibling skill) that does not project cleanly to Copilot **When** it is projected **Then** the per-skill **override** (`Copilot/skills-override/<name>`) supplies the divergent version, or it runs as a user-invoked step — the mechanical delta-map is not forced onto skills it cannot serve.

### Error States
**Given** a projection would write both `.claude/skills/<x>` and `.github/skills/<x>` such that Copilot could load both **When** provisioning runs for both harnesses **Then** it emits `.vscode/settings.json` scoping Copilot to `.github/` only; if that file cannot be written, provisioning **fails loudly** with a message naming the double-registration risk — it never proceeds leaving both active.

**Given** an AI-authored `Status: Approved` flag with no corresponding real approval **When** a commit/PR is attempted **Then** the Tier-C `ai-gate` blocks it (approval bound to system-of-record, not a file grep) with a message pointing to the missing approval — the self-forged flag is rejected.

**Given** a file classified B6/B7 (privileged/PII) about to enter model context on a cloud/`Auto` Copilot boundary **When** a skill would send it **Then** the classifier flags it B6/B7 and the skill **warns/withholds** it from assembly and records the decision; if it reaches a committed artifact, the **Tier-C `ai-gate`** blocks the commit. (Runtime egress inside the vendor client is NOT plugin-blockable — a workspace/DLP responsibility; see AC-NF2.)

---

## Acceptance

### Acceptance Criteria
- [ ] AC-F1: A single skill relocated to `Shared/skills` runs in **both** Claude Code and VS Code Copilot ≥1.109 with no `$PLUGIN_DIR` or dangling-relative-reference failure (Phase 1 gate).
- [ ] AC-F2 (shared content core + native per-harness — NO mechanical projection): the **content & standards (L1)** — skill *knowledge*, the ICEA method + templates + critic rubric, coding rules, the B1–B7 taxonomy — are authored ONCE in `Shared/` as the single source. Each harness's **engagement layer (L2)** is authored **natively**: Claude interactive skills in `Claude/` (as v3.13), Copilot code-review skills / custom agents / prompt files in `Copilot/`. There is **no delta-map, no per-skill mechanical projection, and no runtime `$PLUGIN_DIR` bridge** (all retired). A **CI guardrail** asserts the Copilot side never *re-authors* an L1 standard (it may re-*deliver* it) — forking a standard into two copies is a build failure. Verification: an L1 change (e.g. a new AC-template field or a coding rule) is consumed by both harnesses without editing two copies; the guardrail fails a PR that duplicates/forks an L1 standard into `Copilot/`.
- [ ] AC-F3: Rules project to both harnesses; a **creation-critical** coding rule is present when generating a new file. **Test anchor:** the *Dapper-only data-access* rule and the *no-hardcoded-secrets* rule are in effect at code-generation time on BOTH harnesses — i.e. unconditional / in `CLAUDE.md`, not path-scoped-load-on-read (verified by generating a new source file on each harness and asserting both rules are active). See D-5 for the projection mechanism. **Note (code-grounded):** on Claude, `.claude/rules/project-rules.md` already uses `detect.always:true` (loads at creation) and already carries no-hardcoded-secrets; Dapper-only lives in `CLAUDE.md` prose
      + a directory-scoped rule. So the CLAUDE.md-inline is chiefly needed for **Copilot** (no `always` equivalent). A **rule-inventory/refactor precursor** (extract the two creation-critical statements into discrete `Shared/rules/` entries; dedupe the existing copies) is in scope for Story 3.
- [ ] AC-F4: Provisioning selects harness at **application-integration** time (`provision --harness=claude,copilot` or interactive); machine install is harness-neutral; the choice is recorded in `.aidev/manifest.json`.
- [ ] AC-F5: With both harnesses selected, the emitted `.vscode/settings.json` scopes Copilot to `.github/` — disabling `.claude/` **skills, rules, AND hooks** discovery via `chat.agentSkillsLocations` + `chat.instructionsFilesLocations` + **`chat.hookFilesLocations`** (all three default-Claude paths → `false`) while keeping `chat.useClaudeMdFile:true`. Copilot does not double-load or double-register `.claude/`. Verification is by **actual load** (`/skills` menu + the Copilot Hooks output channel), not just the flag — known suppression bugs (#297538, #299820) mean the settings must be confirmed to take effect, not assumed.
- [ ] AC-F6: Architecture docs, knowledge graph, `memory/`, and `docs/` are generated **once** and read by both harnesses via explicit path (not hidden by Copilot `.claude/` scoping), with **no per-harness duplication**. *(Whether they physically relocate to neutral paths or stay under `.claude/*` read-by-path is contingent on D-2 — this AC asserts single-source + shared-read, not a specific location.)*
- [ ] AC-F7 (asymmetric enforcement): **Claude = prevention** — GA write-time hard gate (`icea-floor` `exit 2`), unchanged. **Copilot = detection + merge-gate** — the HARD guarantee is the harness-independent CI `ai-gate` as a **required status check** on a protected branch (un-bypassable at merge); the Copilot client layer (projected skills, the `review-icea` code-review skill, PreToolUse `exit 2` where it fires) is **best-effort authoring/review assistance**, NOT relied on as the hard line. Verification: on Claude a Write with no approved ICEA is blocked; on Copilot a PR that fails `ai-gate` cannot merge (branch protection), independent of any client hook.
- [ ] AC-F8a: `setup-sync` re-projects `Shared/`+adapter into native paths with **hash-tracked user-edit protection** (an edited projected file is preserved or flagged, not clobbered). Verification: edit a projected file, run `setup-sync`, confirm the edit survives/flags.
- [ ] AC-F8b: `setup-teardown` removes per-harness content **by scope** and never touches user `.github/` (workflows/CODEOWNERS) or `memory/`. Verification: teardown one harness, confirm user `.github/` and `memory/` are intact and the other harness still works.
- [ ] AC-F9 (prompt-artifact versioning): every prompt artifact (`SKILL.md`, rules, `CLAUDE.md`, ICEA/Tech-Spec templates + critic rubric, commands, agents) carries a structured **version** in frontmatter — **SemVer for L1** (where downstream branches on it: MAJOR = output-shape/behaviour, MINOR = additive, PATCH = wording) and a simple `v1/v2` + changelog for L2 — plus a `consumes:` pin of the L1 versions it depends on. A `Shared/prompt-manifest.json` records `{version, sha256, consumes}` per artifact; a **CI check fails any PR where an artifact's content changed without a version bump** (on-disk hash ≠ manifest) and also enforces the L1 re-author guardrail (AC-F2). Rollback = pin the prior L1 version (git tag). Verification: edit a prompt without bumping its version → CI fails; an L1 version bump is consumed by both harnesses without editing two copies.
- [ ] AC-NF1 (security — approval integrity, **Tier-C scope**): the **commit/CI `ai-gate`** verifies approval against the system-of-record / a signed approval, **not** a `Status: Approved` file grep; a self-flipped file status is blocked at commit. The Claude Tier-A `icea-floor` hook intentionally REMAINS a fast file-string floor (a soft pre-check, not the system-of-record) — this reconciles AC-NF1 with AC-NF4 (Tier-A unchanged): the *authoritative* approval decision moves to Tier C; Tier A is a convenience floor. **Local/no-live-ADO mode (this dogfood):** an explicit, audited config runs the gate in *advisory* mode (records + warns) rather than fail-closing every commit; the signed-token issuance flow (key custody; token binds ADO-id + approver + artifact-hash; minted by `icea-approve`) is a Story-6 deliverable. Verification: a self-approved file is rejected by the commit gate in enforce mode; advisory mode is exercised on the synthetic-id repo without blocking all commits.
- [ ] AC-NF2 (security — data classification & egress, **re-scoped to what is enforceable**): context is **classified** against the existing B1–B7 taxonomy (`business-context-severity.md`) at context- assembly time; a B6/B7 trigger causes a **skill-level warn/withhold** and is **caught in committed artifacts by the Tier-C `ai-gate`**. **Runtime egress inside the vendor client (esp. Copilot cloud/`Auto`) is NOT plugin-interceptable and is explicitly OUT OF SCOPE** — that boundary is a workspace/DLP responsibility; the plugin does not claim to block or redact what the harness sends upstream. Verification: a B7-classified fixture triggers warn/withhold at assembly and is blocked by Tier C if committed; docs state plainly that runtime cloud egress is a DLP concern. The classifier (taxonomy → trigger match) is a Story-6 deliverable; the taxonomy's single canonical location is fixed by Story 3a (not a per-skill bundled copy).
- [ ] AC-NF3 (security — injection & secrets): `memory/` and `docs/` are treated as untrusted input (no executable authority; provenance on memory writes); `.env`/`settings.local.json`/PAT never enter model context. Verification: a poisoned `MEMORY.md` instruction is not executed; a secret file never appears in context in the eval harness.
- [ ] AC-NF4 (parity/regression): 3.x Claude behaviour is preserved — the Claude Tier-A hard gate (`icea-floor`, the file-string floor per AC-NF1) still `exit 2`-blocks a Write with no approved ICEA, byte-for-byte. Any behaviour change (e.g. malformed-input fail-open→fail-closed) must be an explicit, called-out decision — NOT smuggled under "unchanged." Verification: parity test on Claude pre/post.
- [ ] AC-NF5 (assurance = *where* each harness gates, not hard-vs-soft): every governed artifact is audit-stamped (model+version+harness+skill-hash) and records its **gate point** — Claude = *prevention gate* (write-time), Copilot = *merge gate* (CI required-check). Both are hard, at different points; the stamp records which, so provenance is auditable. (Replaces the earlier "hard vs soft" framing, which wrongly implied Copilot had no hard gate.) **The stamp also records the prompt-artifact version(s) + the model *snapshot* (dated, not an alias) + key params** (AC-F9) — so any governed output is traceable to the exact prompt version and model that produced it (reproducibility).
- [ ] AC-NF6 (eval — deterministic): the eval suite validates **checked-in artifacts and/or recorded transcripts** against expected shape + AC coverage in CI, per supported model+harness **for which a runner exists** — it does NOT assume a headless Copilot skill-runner (none exists) and does NOT depend on live, paid, nondeterministic model calls in CI. Live-model eval, if run, is Claude-only, budget-gated, and best-effort. The capability-floor scoring function is defined explicitly; a deliberately degraded model trips it. Verification: eval green on fixtures per available runner.
- [ ] AC-NF7 (gate safety): the `ai-gate` is vendored, version-pinned + integrity-hashed (preferred over unpinned `npx`); hooks are verified against `.hashes` before running; rollout is warn-only first with an audited break-glass bypass (no silent `--no-verify`).

### Out of Scope
- Harnesses other than Claude Code and GitHub Copilot (Cursor, JetBrains, CLI-cloud) — the scoped adapter model must *allow* them later, but none are built or validated in this epic.
- Migrating existing target-project repos already provisioned with 3.x — a separate migration/`setup-sync` path, not part of this epic's core build.
- A live production ADO integration for the plugin's own dogfood (synthetic docs-only IDs are used here); real-ADO approval binding is *designed and built* (Phase 6) but exercised against a stub, not prod ADO.
- Changing the ICEA/Tech-Spec *content* methodology or the skill catalogue's scope — this epic changes packaging/projection/enforcement, not what a skill fundamentally does.
- Copilot "plugins" marketplace publication (`plugin.json`/`marketplace.json` for Copilot) beyond what provisioning needs — packaging polish is deferred.
- **Runtime model-egress interception / DLP** — blocking or redacting what a harness sends to its model at runtime (esp. Copilot cloud) is a workspace/vendor DLP concern, not this plugin's (see AC-NF2).
- **Headless / CI execution of skills on Copilot** — Copilot has no documented headless skill-runner; CI eval uses artifact/transcript validation, not live skill execution on Copilot (see AC-NF6).

### Assumptions
- VS Code ≥1.109 exposes `chat.agentSkillsLocations` & `chat.instructionsFilesLocations` as `string→boolean` maps where `false` excludes a (default) location — **verified** (primary source: code.visualstudio.com AI-settings reference; shipped default ships `~/.claude/rules:false`).
- Copilot natively reads `CLAUDE.md` (`chat.useClaudeMdFile`, default true), `.claude/rules` (`paths:`), `.claude/skills`, `.claude/settings.json` hooks under 1.109 Claude-compat — **verified** (docs).
- Copilot `hooks.json` supports SessionStart/UserPromptSubmit/PreToolUse/PostToolUse — **verified but Preview**; some events (e.g. UserPromptSubmit additionalContext) are not guaranteed on CLI/cloud — **partially unverified** (treat Tier B as overridable, lean on Tier C).
- Claude Code auto-loads project `.claude/skills` (monorepo parent discovery) so self-contained skills work without a plugin dir — **verified** (docs) for project scope; user-level `paths:` rules are bugged (#21858) → keep rules at project level — **verified**.
- Settings scoping is workspace-trust-gated (`restricted:true`) → applies only after trust — **verified**.
- The organization has (or will provide) an internal registry to host a **pinned** vendored `ai-gate`; if not, vendoring-in-repo is the fallback — **unverified** (pending internal-registry fact).
- Copilot skill/agent formats remain ~90% compatible with the Agent-Skills standard through the build — **unverified** (Copilot is evolving; the per-skill override + eval harness mitigate drift).
- Skill count is **32**, verified against `skills/` on 2026-08-13 — **verified**. (The source plan's "28" was an earlier approximation; AC-F2's denominator is 32.)
- Eval-harness fixtures (`Shared/eval/`) are **synthetic** and contain no real privileged/PII/secret material — **verified** (authoring constraint), so the B7/secret test corpus does not itself create an egress or secret-leak risk in the dogfood repo.
- **Runtime model-egress is NOT interceptable by the plugin** — context assembly and the model call happen inside the harness/vendor client (esp. Copilot cloud/`Auto`); no plugin hook sits between them — **verified against the architecture** (code-grounded review). Egress control = classify + warn/withhold + Tier-C artifact scan; true runtime DLP is a workspace/vendor responsibility.
- **Copilot cannot be assumed to invoke a sibling skill inline** (the `Read …/SKILL.md and execute` pattern used by `icea-feature`/`icea-implement`/`migration`) — **unverified / likely unsupported**; must be proven in the Phase-1 spike or those skills run as user-invoked steps. Governance parity on Copilot is therefore **best-effort (Tier B)**, not equal to Claude Tier A; **Tier C is the only hard cross-harness line.**
- **No SKILL.md carries `allowed-tools`/`tools` frontmatter** (only `name`+`description`; some have none) — **verified** — so the projection delta-map targets real deltas (paths, rule frontmatter, prose), not that field.
- **`$PLUGIN_DIR` footprint is large:** ~531 references across ~53 files in 4 shapes (own-`references/` reads; sibling-skill exec; `$PLUGIN_DIR/scripts/*` executions; the resolver spec doc) — **verified** — so retirement is not a 1–2 SP strip and must cover the `scripts/*` execution shape (scripts are not in `Shared/`).
- **Copilot also discovers `.claude/settings.json` hooks under 1.109** and the two scoping keys do NOT disable hook discovery — so hook double-registration must be closed by Story 4/5 (make `.github/hooks` the sole Copilot registration) — **flagged, needs handling.**

### Risks & Pre-Mortem
| Risk | Probability | Impact |
|---|---|---|
| Copilot hook events (Preview) change or under-deliver → Tier B weaker than hoped | M | M |
| Self-containment misses a hidden `$PLUGIN_DIR`/relative dep → skill silently degrades on one harness | M | H |
| `.vscode/settings.json` scoping not applied (workspace untrusted / remote-SSH bug #293768) → double-load or leak | M | H |
| ADO-bound approval fail-closes every commit on the synthetic-id/no-live-ADO repo → gate unusable locally (mitigated by advisory mode, AC-NF1) | H | H |
| Copilot cannot invoke a sibling skill → critic/orchestrating skills silently don't run (governance hole) | M | H |
| Over-claiming a runtime egress *block* gives FALSE assurance on privileged data (Copilot cloud) — mitigated by re-scope (AC-NF2) | M | H |
| Artifact relocation misses a reader → orientation/graph silently loses context for existing skills | M | H |
| Projection/override sprawl: more skills need overrides than expected → creeps toward the dual-maintenance we rejected | M | H |

**Pre-mortem:** "This shipped and failed. What went wrong?" The most likely failure is **silent partial-projection on Copilot**: a skill self-contains cleanly in the Phase-1 spike, but several tool-orchestrating skills (`icea-feature`, `migration`, critic-invoking-implement) rely on Claude-only tool semantics or sibling-skill invocation that Copilot's Preview primitives don't honour. Because Tier B is overridable and Copilot degrades quietly, developers *believe* they are governed while the gate is actually soft — and privileged code ships Copilot-side with a forged-looking-but-unenforced approval. The mitigations that must not be cut: the Phase-1 both-tools proof before rolling out; the per-artifact **assurance-level** stamp (so a soft Copilot approval is never counted as a hard one); the harness- independent **Tier C** gate as the real backstop; and the behavioural **eval harness** that fails CI when an AC stops being covered on a given harness.

### Dependencies
- Blocked by: Phase 0 verification of the settings disable-syntax — **DONE 2026-08-13** (see plan tracker
  + `.claude/architecture/architecture.md` §8 / MEMORY.md). The internal-registry decision (gate vendoring) — open, blocks only Phase 6 gate-hardening finalisation.
- Blocks: any target-project 4.x roll-out; the 3.x→4.x `setup-sync` migration path (out of scope here).

### Irreversibility Flags
- Source-tree restructure (`Shared/Claude/Copilot`) and `$PLUGIN_DIR` retirement are large but reversible via git (frozen `v3.13.0` tag + `main` untouched until 4.0 proves out — see MEMORY.md branch strategy).
- **Committed** `.vscode/settings.json` in provisioned target repos changes every developer's Copilot discovery — reversible by re-provision, but affects a shared file; flagged for explicit review.
- No irreversible data changes (no schema migrations; `memory/`, `docs/` are additive).

### D-Blocks
Open architectural decisions requiring explicit selection (finalised per story at Tech-Spec time):
- **D-1 — `ai-gate` distribution:** vendored-in-repo (pinned+hashed) **vs** internal-registry `npx`. Pending the internal-registry availability fact. Steelman both at Phase 6; default to vendored pinned if registry unavailable.
- **D-2 — Neutral artifact locations:** `docs/architecture` + `.aidev/graph` **vs** keep `.claude/*` and rely on path-reads. Trade-off: cleanliness/neutrality vs churn to existing readers. Decide at Phase 3a.
- **D-3 — Copilot instructions file:** shared `CLAUDE.md` (via `chat.useClaudeMdFile`) **vs** also emit `.github/copilot-instructions.md`. Decide at Phase 5 (parity vs Copilot-idiomatic).
- **D-4 — Skill override threshold:** (a) override any skill that invokes a sibling skill or relies on Claude-only tool semantics — safe default, more overrides to maintain; **vs** (b) override only skills the Phase-1/2 spike proves cannot project via the delta-map — fewer overrides, requires the spike first. *Choose (a) when* maintenance-review capacity is scarce; *choose (b) when* minimizing override surface matters. Recommendation: **(b)**, gated on the Phase-1 spike (repo evidence: `icea-feature` and `migration` are the known-divergent candidates). Decide after Phase 1.
- **D-5 — Rules projection for creation-critical rules:** `.github/instructions/*` with `applyTo` / `.claude/rules` with `paths:` **vs** unconditional-in-`CLAUDE.md`. Trade-off: path-scoped rules load on READ, not on file creation (verified gotcha), so creation-critical rules (Dapper-only, no-hardcoded-secrets — see AC-F3) would not be active at generation time if path-scoped. *Choose unconditional-in-CLAUDE.md when* a rule must apply at creation; *choose `applyTo`/`paths:` when* the rule is only relevant on read/edit of matching files. Recommendation: **unconditional-in-CLAUDE.md for creation-critical, `applyTo`/`paths:` for the rest.** Decide at Phase 3/5. AC-F3 depends on this.

---

## Story Breakdown

> Preliminary — logical shippable slices mapped from the plan's Phases 0–8. SP are estimates; oversized
> stories (>5 SP) sub-decompose at Tech-Spec sizing. Child ADO numbers recorded at `IMPLEMENT` time.
> All files live in `docs/Release4/Sprint1/UserStory4000/`.

**Type:** EPIC **Total SP:** ~41 (preliminary — table rows sum to 41; grows as Stories 2 & 6 sub-decompose into ≤5-SP children)

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 0 | TBD | Verify `chat.agentSkillsLocations` disable-syntax (≥1.109) | 1 | Yes (spike) | None | ✅ Done 2026-08-13 |
| 1 | TBD | Skill self-containment **spike**: relocate 1 skill + `_shared` to `Shared/`, strip resolver, project + run in BOTH tools | 3 | Yes | Story 0 | ⏳ Pending |
| 2 | TBD | Establish the shared **L1 content core** (`Shared/`: icea method+templates, rules, B1–B7 taxonomy, checker knowledge, gate) + the **CI guardrail** (Copilot must not re-author L1); retire runtime `$PLUGIN_DIR`. **No delta-map / no mechanical projection.** Carries the **prompt-version manifest + CHANGELOG + CI bump/hash check** (AC-F9). | 4 (×decompose) | Yes | Story 1 | ⏳ Pending |
| 3 | TBD | Rules: `paths:` where safe, unconditional where creation-critical; project to both | 3 | Yes | Story 2 | ⏳ Pending |
| 3a | TBD | Relocate artifacts (architecture/graph) to neutral shared locations (D-2) | 3 | Yes | Story 2 | ⏳ Pending |
| 4 | TBD | Hook compat shim + memory `SessionStart`/capture on both harnesses | 5 | Yes | Story 2 | ⏳ Pending |
| 5 | TBD | `CLAUDE.md` scrub + per-harness model note; emit `.vscode/settings.json` Copilot scoping (D-3) | 3 | Yes | Story 3,4 | ⏳ Pending |
| 6 | TBD | Governance hardening (SEV-1s): ADO-bound approval, B1–B7 egress policy, memory-as-untrusted, secret exclusion; vendored pinned+hashed gate; warn-only + break-glass (D-1) | 8 (×decompose) | Yes | Story 5 | ⏳ Pending |
| 7 | TBD | Behavioural eval harness + audit stamping + capability floor; cross-harness cost telemetry; **eval-gate-on-prompt-version-bump + provenance-stamp extension** (AC-F9/NF5) | 5 | Yes | Story 6 | ⏳ Pending |
| 8 | TBD | Read-only gate agents (generated); provisioning/sync/teardown updates; neutral `plugin.manifest.json`; harness-neutral machine install | 5 | Yes | Story 5,6 | ⏳ Pending |

> Stories are broken by logical completion (shippable slice), not by AC. Stories 2 and 6 exceed 5 SP and
> will sub-decompose into ≤5-SP child stories at Tech-Spec sizing.
>
> **Post-review dependency/producer corrections (2026-08-13):** (a) Story 6's gate modules live in
> `Shared/gate/` and need the Story-2 projection engine + Story-8 provisioning to reach a machine → Story 6
> depends on 2, 5, and 8-delivery. (b) Story 3a (artifact relocation) and Story 4 (hook relocation) both
> repoint the same graph/arch readers → they must share a single `artifact-paths.md` contract to avoid
> clobbering. (c) The audit-stamp hook `artifact-write.cjs` (AC-NF5) has no producer → **Story 4 creates
> it, Story 7 consumes it.** (d) `ai-gate.yml` is owned by **Story 6** (logic), *distributed* by Story 8 —
> single producer. (e) Story 3 gains a **rule-inventory precursor** (extract discrete creation-critical
> rules; dedupe). (f) Story 1's pilot must be a genuinely representative skill (or its claim scoped down):
> `icea-status` has no real `$PLUGIN_DIR` reads, so it **cannot close D-4** for orchestrating skills.
> (g) $PLUGIN_DIR retirement (Story 2) is under-sized — re-size for ~531 refs / 4 shapes incl. `scripts/*`.

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---
### Revision Log
2026-08-13 — Initial Epic ICEA drafted from approved plan `docs/plans/2026-08-12-llm-agnostic-multi-harness-convergence.md` (dogfood; synthetic ADO-4000).
2026-08-13 — Company/client name scrubbed (generic terms per developer constraint).
2026-08-13 — Independent critic gate (ICEA mode, [TL] lens) → PASS WITH NOTES; applied fixes: SP reconciled ~44→41; skill count 28→32 assumption added; AC-F3 test anchor (Dapper-only + no-hardcoded-secrets); AC-NF2 classification scope clarified; AC-F8 split into F8a/F8b with verification; AC-F6 softened re D-2; D-4 reframed as a real fork + D-5 (rules projection) added; eval-fixtures-synthetic assumption added.
2026-08-13 #4 — Post-adversarial-review REVISE (4 independent code-grounded reviewers). ACs re-scoped to honest, enforceable claims: **AC-NF1** approval-integrity scoped to Tier-C (Tier-A stays a soft file-string floor; local *advisory* mode + signed-token flow specified) — resolves the C1 contradiction with AC-NF4 and C2 fail-closed-locally break. **AC-NF2** egress re-scoped to classify+warn/withhold+Tier-C; runtime vendor-client egress declared OUT OF SCOPE (DLP owns it) — resolves C3 false-assurance. **AC-F2** delta-map re-derived to real deltas (paths/rule-frontmatter/prose), dropped the non-existent `allowed-tools↔tools` transform, added Copilot sibling-skill-invocation as a Phase-1 gating check — resolves F2.1/F2.2. **AC-F3** noted `detect.always:true` already loads at creation on Claude (inline mainly for Copilot) + rule-inventory precursor — resolves F3.1/F3.2. **AC-NF4** forbids smuggling behaviour changes under "unchanged". **AC-NF6** eval made deterministic (artifact/transcript validation; no headless Copilot runner; no live paid CI calls) — resolves H4. Added assumptions (egress not interceptable; Copilot sibling-skill unproven; no `allowed-tools` frontmatter; $PLUGIN_DIR ~531 refs/4 shapes; `.claude/settings.json` hook double-registration). Added Out-of-Scope (runtime egress/DLP; headless Copilot skill exec). Bumped/rewrote risks. Added Story-Breakdown producer/dependency corrections (Story 6→2/5/8; 3a↔4 artifact-paths contract; artifact-write.cjs producer=Story 4; ai-gate.yml single-owner=Story 6; Story 3 rule-inventory; Story 1 representative pilot; Story 2 re-size). **Story specs pending re-revision to match these ACs.**
2026-08-14 #5 — Post-re-verification fixes (verify-the-fix pass confirmed all Criticals RESOLVED but caught 2 NEW dependency cycles introduced by #4): broke the cycles — Story 6 depends-on 2,5,8→**2,5** (Story 8 distributes → depends on 6; no back-edge), Story 3 dropped its Story-8 dependency to a **sequencing note** (idempotent managed-block writer; avoids 3→8→6→5→3). Synced the Error-States B6/B7 prose to AC-NF2 (warn/withhold + Tier-C; runtime egress OUT OF SCOPE). Reconciled epic Story-5 depends-on (3,4→2,3) and tracker Story-8 depends-on (→2,5,6). DAG now acyclic.
2026-08-14 #6 — ASYMMETRIC ENFORCEMENT model adopted (user direction; spike-first, with the CI required status check accepted as the known-good Copilot hard gate). Claude = write-time prevention (unchanged); Copilot = merge-gate via CI required check (hard) + review-time `review-icea` code-review skill (best-effort critic, NO inline sibling-skill orchestration → dissolves F1.1/F2.1). Edits: Success Metrics (asymmetric-but-hard-on-both), new "Enforcement model" subsection, AC-F5 (+`chat.hookFilesLocations`, verify-by-actual-load — fixes F1.2), AC-F7 (Copilot hard=required-check, client=best-effort), AC-NF5 (gate-point stamp not hard-vs-soft). Story consequences to cascade: Story 2 Copilot critic → review-time skill; Story 4 Copilot de-emphasizes write-hooks + emits hookFilesLocations; Story 8 emits branch-protection/required-check setup + warns if unprotected. Spike protocol + scaffold: `docs/plans/2026-08-14-phase1-spike.md` + `spike/`. **Story specs pending re-revision to match #6.**
2026-08-14 #7 — STRUCTURE LOCKED: **shared content core (L1) + native per-harness engagement/enforcement (L2/L3)** (user direction; decide-now-spike-within). Copilot is DESIGNED NATIVELY to its strengths, NOT mechanically projected from a Claude shape → the delta-map / per-skill projection / runtime `$PLUGIN_DIR` bridge are RETIRED (deletes Story 2's projection machinery — the source of most review findings). L1 (ICEA method+templates, rules, B1–B7 taxonomy, checker knowledge, gate) is the SINGLE source both harnesses consume; a CI GUARDRAIL fails any PR that re-authors an L1 standard in `Copilot/` (re-deliver, never re-author). Structure = `Shared/`(L1) + `Claude/`(native ≈v3.13) + `Copilot/`(native) + neutral artifacts. Edits: AC-F2 rewritten (shared-core, no projection), "Repository structure & layering (L1/L2/L3)" subsection added, Story 2 transformed (projection→L1-core+guardrail). Legitimately reopens the [2026-08-12] convergence decision with NEW facts (Copilot can't imitate Claude). Spike runs WITHIN this structure. Full 9-spec re-cascade to L1/L2/L3 deferred until after spike H1/H2.
2026-08-14 #8 — Added PROMPT-ARTIFACT VERSIONING (user-endorsed; version the plugin's prompt artifacts). New **AC-F9**: frontmatter `version:`/`consumes:` (SemVer for L1, simple+changelog for L2) + `Shared/prompt-manifest.json` {version,sha256,consumes} + a CI "bump-on-change" check (changed prompt without a version bump = build fail) + the L1 re-author guardrail. Extended **AC-NF5** stamp (+ prompt-version + dated model snapshot + params → output→prompt-version provenance). **Story 7** eval gates on any version bump (deterministic + critic-as-judge + capability-floor threshold; failures feed the golden set). Folded into **Story 2** (L1 carries manifest + CHANGELOG + CI check) + **Story 7** (gate + stamp). Builds on existing conventions (SKILL.md `_Skill version_`, plugin.json version, `.claude/hooks/.hashes`). Staged: S1 files+versions+manifest+CI / S2 eval-gate+stamp / S3 external registry only if A/B needed. To cascade into the Story 2/7 specs with the rest post-spike.
2026-08-17 #9 — IMPLEMENTATION begun (APPROVED). Story 1 (child ADO-4001) built in `spike/story-1/` (icea-status → self-contained L1 in `Shared/`, generated native copies for Claude/Copilot marked "DO NOT EDIT"). **Story-1 H1 result: Claude = PASS + mechanical guard PASS; Copilot = BLOCKED (no Copilot access on the build machine) → AC-F1 is PARTIAL.** **🚧 COPILOT VALIDATION DEBT opened (HARD ROLLOUT GATE):** all Copilot-side ACs — F1(Copilot half), F5(.vscode scoping), F7(merge-gate + review-icea), AC-NF2 egress-on-Copilot, spike H2 — are DESIGNED-BUT-UNVALIDATED and MUST be empirically validated on VS Code Copilot ≥1.109 + a GitHub repo (branch protection) BEFORE any Copilot production rollout. Decision: proceed on harness-independent + Claude-testable work (Story 2 L1 core, Tier-C gate, Claude enforcement) meanwhile; carry the debt gate. Design confirmation (web-grounded): Claude Code reads skills ONLY from `.claude/skills` and Copilot discovery is scoped per-path → per-harness placement is unavoidable; the design is one authored L1 source in `Shared/` GENERATED into each harness path (not the retired projection engine), so content-skill copies being identical is expected/correct.
