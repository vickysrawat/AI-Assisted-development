# Epic Tech Spec — LLM-Agnostic Multi-Harness Convergence (Claude Code + GitHub Copilot)
ADO #4000 · Release 4 · Sprint 1
Status: ✅ APPROVED 2026-08-14 · EPIC · ~41 SP total (pre-child-split: Story 2 ~4, Story 8 6; Story 6 sub-decomposes) · synced to ICEA Revision Log #8

> Cross-cutting spec for the whole epic. Per-story implementation detail (full AC-coverage matrix, exact
> files changed, detailed test cases) lives in each per-story tech spec (ADO-4000-Story-N-...techspec.md),
> generated per story at implement time. This epic-level spec carries **rollup** versions of those
> sections (AC→story, path-level change map, cross-cutting test cases). Source ICEA:
> `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md`.
> Note: this is a **plugin/tooling** epic — standard web-app template sections (browser→API→DB flow,
> Azure AD/CSRF, schema migrations, Key Vault) are adapted to the plugin's real architecture below.

---

## Overview

This epic converges the existing Claude-only plugin (v3.13.0) into a **multi-harness** plugin that runs under both Claude Code and GitHub Copilot from a **single source of truth**, structured as an **L1/L2/L3** model (ICEA Revision Logs #6/#7/#8): a shared **content core (L1)** in `Shared/` — the ICEA + Tech-Spec method, templates and critic rubric, the coding rules and B1–B7 taxonomy, the checker knowledge, and the harness-independent `ai-gate` floor — is authored ONCE and **consumed NATIVELY** by each harness's own engagement + enforcement layers (L2/L3): `Claude/` (native, ≈ the v3.13 plugin) and `Copilot/` (native, redesigned to GitHub/Copilot strengths). There is **no mechanical projection, no delta-map, and no runtime `$PLUGIN_DIR` bridge** — all retired in #7; `Claude/` and `Copilot/` re-deliver L1, they never re-author it (a CI guardrail fails any PR that forks an L1 standard). Enforcement is **asymmetric but hard on BOTH harnesses at different gate points**: **Claude = write-time prevention** (Tier-A `icea-floor` `exit 2`, unchanged); **Copilot = merge gate** — the harness-independent CI `ai-gate` as a REQUIRED status check on a protected branch (un-bypassable at merge) plus a review-time `review-icea` code-review critic; the Copilot client hooks/skills are **best-effort** authoring/review assistance on top, never the hard line. Prompt artifacts are **versioned** (frontmatter `version:`/`consumes:` + `Shared/prompt-manifest.json`
+ a CI bump-on-change check, AC-F9). Privileged-data governance is hardened (approval bound to system-of-record, B1–B7 classify + warn/withhold + Tier-C artifact scan, memory-as-untrusted, secret exclusion, behavioural eval). **Deliberately NOT in this epic:** harnesses beyond Claude Code + Copilot, migrating existing 3.x-provisioned repos, a live production-ADO integration for the dogfood (synthetic IDs), runtime model-egress interception/DLP, changes to what skills fundamentally do, and Copilot-marketplace publication polish.

---

## Story Breakdown

Foundation ordering: **Story 1 is the self-containment spike** (proves the model in both tools) and **Story 2 is the shared foundation** — it establishes the shared **content core (L1)** under `Shared/` (icea method+templates+critic rubric, coding rules, B1–B7 taxonomy, checker knowledge, the `ai-gate` scaffold), the prompt-artifact version manifest + CI bump-on-change check, and the CI re-author guardrail, and retires the runtime `$PLUGIN_DIR` — the L1 core every later story consumes NATIVELY. It is NOT a projection engine (the projection/delta-map/override machinery was retired in #7).

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 0 | Verify settings disable-syntax (≥1.109) | 1 | Yes (spike) | None | (spike — no code) | ✅ Done 2026-08-13 |
| 1 | Skill self-containment spike (1 skill, both tools) | 3 | Yes | 0 | ADO-4000-Story-1-self-containment-spike.techspec.md | ⏳ Pending |
| 2 | Shared L1 content core + prompt versioning + re-author guardrail | 4 | Yes | 1 | ADO-4000-Story-2-l1-content-core.techspec.md | ⏳ Pending |
| 3 | Rules as L1 content, native per-harness consumption | 3 | Yes | 2 | ADO-4000-Story-3-rules-l1-content.techspec.md | ⏳ Pending |
| 3a | Neutral shared artifacts (architecture/graph/memory/docs read-once) | 3 | Yes | 2 | ADO-4000-Story-3a-neutral-artifacts.techspec.md | ⏳ Pending |
| 4 | Hook compat shim + memory SessionStart/capture on both | 5 | Yes | 2 | ADO-4000-Story-4-hooks-memory.techspec.md | ⏳ Pending |
| 5 | CLAUDE.md scrub + per-harness model note; emit `.vscode/settings.json` scoping | 3 | Yes | 2,3 | ADO-4000-Story-5-instructions-scoping.techspec.md | ⏳ Pending |
| 6 | Governance hardening (approval-integrity, B1–B7 egress, memory-untrusted, secret exclusion, pinned+hashed gate, warn-only+break-glass) | 8† | Yes | 2,5 | ADO-4000-Story-6-governance-hardening.techspec.md | ⏳ Pending |
| 7 | Behavioural eval harness + audit stamping + capability floor; cross-harness cost telemetry | 5 | Yes | 6 | ADO-4000-Story-7-eval-observability.techspec.md | ⏳ Pending |
| 8 | Read-only gate agents (generated); provisioning/sync/teardown + neutral `plugin.manifest.json`; harness-neutral install; Copilot required-check stand-up | 6 | Yes | 2,5,6 | ADO-4000-Story-8-provisioning-distribution.techspec.md | ⏳ Pending |

† Story 6 (8 SP) exceeds the ≤5-SP shippable-slice rule and **sub-decomposes into ≤5-SP child stories (6a–6d) at its own tech-spec sizing**. Story 2 was re-scoped to ~4 SP under #7 (the retired projection machinery was the source of its earlier oversizing) and no longer sub-decomposes. Total ~41 SP (pre child split); it grows as Story 6 splits.

---

## AC Coverage Matrix

> Epic rollup — maps each ICEA acceptance criterion to the story that delivers it. Full file-level AC
> coverage lives in each story's own tech spec.

| AC | Summary | Owning story | Verification (epic-level) |
|---|---|---|---|
| AC-F1 | One skill runs in both tools, no `$PLUGIN_DIR`/dangling-ref | 1 | Both-tools run of the relocated skill |
| AC-F2 | Shared **L1 content core** (`Shared/`: icea method, rules, B1–B7 taxonomy, knowledge, gate) consumed NATIVELY per harness; **no delta-map / no mechanical projection / no `$PLUGIN_DIR`**; CI guardrail blocks re-authoring an L1 standard in `Copilot/` | 2 | An L1 change is consumed by both harnesses without editing two copies; guardrail fails an L1 fork |
| AC-F3 | Creation-critical rules present at generation (Dapper-only, no-secrets) | 3 | Generate a new source file on each harness; assert both rules active |
| AC-F4 | Harness selected at integration; neutral machine install; recorded in `.aidev/manifest.json` | 8 | `provision --harness=…`; inspect manifest |
| AC-F5 | `.vscode/settings.json` scopes Copilot to `.github/` — skills + rules + **hooks** (`chat.hookFilesLocations`); verify by actual load | 5 | `/skills` menu + Copilot Hooks output channel show no `.claude/*` loaded |
| AC-F6 | Artifacts single-source + shared-read, no per-harness dup (location per D-2) | 3a | Both harnesses read the one architecture/graph copy |
| AC-F7 | **Asymmetric:** Claude write-time prevention (unchanged); Copilot HARD gate = CI `ai-gate` required-check on a protected branch; `review-icea` review-time critic + client hooks = best-effort | 4,6,8 | Claude blocks un-approved Write; Copilot PR failing `ai-gate` cannot merge (branch protection) |
| AC-F8a | `setup-sync` re-projects with hash-tracked user-edit protection | 8 | Edit projected file → sync → edit survives/flags |
| AC-F8b | `setup-teardown` by scope; never touches user `.github/`/`memory/` | 8 | Teardown one harness; user files intact |
| AC-F9 | Prompt-artifact versioning: frontmatter `version:`/`consumes:` + `Shared/prompt-manifest.json` {version,sha256,consumes} + CI **bump-on-change** check + L1 re-author guardrail | 2 (manifest+CI), 7 (eval-gate+stamp) | Edit a prompt w/o a version bump → CI fails; stamp traces output→prompt-version |
| AC-NF1 | Approval integrity **at Tier-C** (commit gate = system-of-record/signed token); Tier-A `icea-floor` stays a soft file-string floor (unchanged, AC-NF4) | 6 | Self-approved file blocked by the commit gate; local advisory mode doesn't block all commits |
| AC-NF2 | B6/B7 **classify + warn/withhold at assembly + Tier-C artifact scan**; runtime vendor-client egress OUT OF SCOPE (DLP); classifier = Story-6 deliverable | 6 | B7 fixture triggers warn/withhold + blocked by Tier-C if committed |
| AC-NF3 | Memory/docs untrusted; secrets excluded from context | 6 | Poisoned `MEMORY.md` not executed; secret never in context |
| AC-NF4 | Claude 3.x parity — Tier-A hard gate unchanged | 2,4,5 | Un-approved Write blocked on Claude pre/post |
| AC-NF5 | Audit stamping: **gate-point** (Claude=prevention, Copilot=merge) + **prompt-version + dated model snapshot + params** (AC-F9) — both hard | 7 | Stamp distinguishes gate-point AND traces output→prompt-version |
| AC-NF6 | Behavioural eval per model+harness; capability floor | 7 | Eval suite green; degraded model trips floor |
| AC-NF7 | Vendored pinned+hashed gate; hooks hash-verified; warn-only + break-glass | 6,8 | Tamper test; break-glass audit entry present |

---

## Files Changed

> Epic rollup — path-level map of what each story introduces (`+`) or modifies (`~`). Exact file lists
> live in each story's tech spec.

> Structure: `Shared/` is the **L1 content core** (single source); `Claude/` and `Copilot/` are **native
> L2/L3** layers that CONSUME it (no mechanical projection). `.claude/`, `.github/`, `.vscode/` are the
> per-harness native paths a provision COMPOSES L1 + a native adapter into (file-copy, not a transform).

| Path | Change | Story |
|---|---|---|
| `Shared/icea/**` (L1: ICEA method+templates+critic rubric) | + | 2 |
| `Shared/rules/**` (L1: coding rules + B1–B7 taxonomy) | + | 2,3 |
| `Shared/knowledge/**` (L1: code-review/security checker + arch/graph generator knowledge) | + | 2 |
| `Shared/gate/**` (L1: harness-independent `ai-gate` floor + logic) | + | 2,6 |
| `Shared/guardrail/l1-standards.json` (L1 re-author guardrail registry) | + | 2 |
| `Shared/prompt-manifest.json` (`{version,sha256,consumes}` per prompt artifact, AC-F9) | + | 2 |
| `Shared/CHANGELOG.md` (L1/L2 prompt-artifact version history) | + | 2 |
| `Shared/hooks/**` (L1 hook decision logic + compat primitives) | + | 4 |
| `Shared/eval/**` (eval fixtures + parity harness) | + | 4,7 |
| `Claude/` (native L2/L3 ≈ v3.13: `skills/`, `rules/`, `hooks/`, `.claude-plugin/`) | + | 2,4,8 |
| `Copilot/` (native L2/L3: `skills/` incl. `review-icea`, `agents/`, `workflows/ai-gate.yml`, `vscode/`, `hooks/`) | + | 4,5,6,8 |
| `plugin.manifest.json` (neutral registry: `l1ContentVersion` + native `harnesses[]`) | + | 8 |
| `scripts/provision.*`, `install.cjs`, `setup-init-bootstrap.cjs`, `deploy-commands.cjs`, `setup-teardown.cjs`, root `install.*` | ~ (harness-neutral; compose L1 + native adapter) | 2,8 |
| `.claude/{skills,rules,hooks,settings.json}` (native Claude output) | ~ | 2,3,4 |
| `.github/{skills,instructions,agents,hooks,workflows/ai-gate.yml}` (native Copilot output) | + | 3,4,5,6,8 |
| `.vscode/settings.json`, `.vscode/mcp.json` (scoping output) | + | 5 |
| `CLAUDE.md` (scrub + per-harness model note; Copilot creation-critical carrier) | ~ | 3,5,6 |
| architecture/graph → neutral (`docs/architecture`, `.aidev/graph`) | ~ (per D-2) | 3a |
| `.aidev/manifest.json` (per-project record incl. `copilotHardGate`, hash ledger) | + | 8 |

---

## Test Cases

> Epic-level, cross-cutting acceptance scenarios a reviewer/QA runs at epic scope. Per-story
> unit/integration cases live in each story's tech spec.

| TC | Scenario | Expected | AC |
|---|---|---|---|
| TC-1 | Relocate one skill to `Shared/`, provision to a scratch repo, run in Claude Code AND Copilot ≥1.109 | Identical behaviour; zero `$PLUGIN_DIR`/dangling-ref errors | AC-F1 |
| TC-2 | Provision a repo for both harnesses; open `/skills` in Copilot | Only `.github/` skills listed; `.claude/` skills/rules NOT loaded; `CLAUDE.md` still read | AC-F5,F6 |
| TC-3 | On Claude, attempt a Write with no approved ICEA (pre and post 4.x) | Blocked (`exit 2`) both times — parity preserved | AC-NF4,F7 |
| TC-4 | Commit a file whose `Status: Approved` was self-flipped with no real approval | Tier-C `ai-gate` blocks the commit | AC-NF1 |
| TC-5 | A B7-classified fixture is assembled into context; and a B7 fixture is committed | Assembly warns/withholds + records; Tier-C blocks the commit. (Runtime vendor-client egress is NOT tested — out of scope, DLP) | AC-NF2 |
| TC-6 | Auto-loaded `MEMORY.md` contains an injected instruction; secret file present | Instruction not executed; secret never enters context | AC-NF3 |
| TC-7 | Run behavioural eval suite per supported model+harness; then a deliberately degraded model | Suite green on supported; degraded model trips capability floor | AC-NF6 |
| TC-8 | Edit a projected file, run `setup-sync`; then `setup-teardown --harness=copilot` | Edit preserved/flagged; teardown leaves user `.github/` + `memory/` intact | AC-F8a,F8b |
| TC-9 | Inspect a Claude-produced vs Copilot-produced governed artifact | Both carry an audit stamp; the gate-point (prevention vs merge) distinguishes them | AC-NF5 |
| TC-10 | Provision with `--harness=claude` only, then re-integrate `+copilot` | No reinstall needed; `.aidev/manifest.json` updated; both then work | AC-F4 |

---

## Governance & Security (cross-cutting — replaces "Auth & Security")

This is a governance plugin for a privileged-data (B1–B7) context; "security" here means the integrity of the governance itself and the safety of context handling across two harnesses.

**Enforcement model (asymmetric — hard on BOTH harnesses, at different gate points):**
- **Claude = prevention gate (write-time, hard, GA, unchanged):** `icea-floor` `exit 2` blocks Write/Edit without an approved ICEA, before code is written. Preserved bit-for-bit (parity AC-NF4).
- **Copilot = merge gate (hard):** the harness-independent CI `ai-gate` as a REQUIRED status check on a protected branch — un-bypassable at merge (you cannot `--no-verify` a required check). The required-check IS the Copilot hard gate; a review-time `review-icea` code-review critic gates the PR diff for AC-traceability alongside it.
- **Client layer (best-effort, both harnesses):** Copilot client hooks (`PreToolUse` deny where it fires — Preview, timeout-fail-open), the read-only gate agents, and the `review-icea` critic are best-effort authoring/review assistance layered on top — never counted as the hard line.
- **Common floor:** the same `ai-gate` also runs at git pre-commit as a harness-independent backstop for non-tool edits, teammates without the plugin, and bypassed sessions.

The load-bearing condition for the Copilot gate: `ai-gate` is hard ONLY once branch protection makes it a required check. Story 6 owns the gate logic + `ai-gate.yml`; Story 8 distributes it AND stands up the required-check / branch-protection setup, WARNING loudly and refusing to claim Copilot governance if the branch is unprotected.

**Cross-cutting security concerns:**

| Concern | Mitigation | Story |
|---|---|---|
| Self-forged approval (AI writes `Status: Approved`) | Commit/CI `ai-gate` binds approval to system-of-record/signed token (AC-NF1); Claude Tier-A `icea-floor` stays a fast file-string floor (unchanged) | 6 |
| Privileged/PII in committed artifacts | B1–B7 classify + warn/withhold at assembly + committed-artifact scan by the `ai-gate` (AC-NF2); runtime vendor egress is DLP's job, not the plugin's | 6 |
| Prompt-injection via auto-loaded `MEMORY.md`/docs | Treat memory/docs as untrusted — no executable authority; provenance on writes (AC-NF3) | 6 |
| Secret leakage into model context | Exclude `.env`/`settings.local.json`/PAT; never in committed `settings.json` (AC-NF3) | 6 |
| Gate tampering / supply chain | Vendored pinned + integrity-hashed `ai-gate`; hooks hash-verified; untrusted-PR hooks don't auto-run (AC-NF7) | 6,8 |
| Silent bypass culture | Warn-only rollout; audited break-glass; no silent `--no-verify` (AC-NF7) | 6 |
| Double-registration exposure (Copilot loads `.claude/` too) | Emitted `.vscode/settings.json` scopes Copilot to `.github/` (skills+rules+`chat.hookFilesLocations` hooks); fails loudly if unwritable; verify by actual load (AC-F5) | 4,5 |

**Assurance stamping (AC-NF5):** every governed artifact records model+version+harness+skill-hash, the **gate point** it passed (Claude = prevention gate at write-time; Copilot = merge gate at the required check — both hard, at different points), and the **prompt-artifact version(s)** + dated model snapshot (AC-F9), so provenance traces which gate governed it and which exact prompt version produced it — not a hard-vs-soft tier.

---

## Overall Flow (cross-cutting — replaces "Request Flow")

```
PROVISIONING (application-integration time — file-copy composition, NO mechanical projection):
  provision --harness=claude,copilot
    -> [Story 8] for each harness: COMPOSE L1 Shared/ + that harness's NATIVE adapter into native paths
        -> Shared/ + Claude/  -> .claude/{skills,rules,hooks,settings.json}     (Claude)
        -> Shared/ + Copilot/ -> .github/{skills,instructions,agents,hooks,workflows/ai-gate.yml} (Copilot)
    -> [Story 5] emit .vscode/settings.json (scope Copilot to .github/: skills+rules+hookFilesLocations, keep useClaudeMdFile)
    -> [Story 3a] seed neutral shared artifacts (architecture/graph/memory/docs)
    -> [Story 8] distribute Story-6 ai-gate.yml + STAND UP the required-check on the protected branch
                 (WARN + refuse governance claim if the branch is unprotected)
    -> [Story 8] record harness choice + copilotHardGate status in .aidev/manifest.json

RUNTIME ENFORCEMENT (developer writes code):
  Dana (Claude)  -> native .claude/skills load -> icea-floor hook -> write allowed iff approved ICEA  (PREVENTION GATE, hard)
  Cody (Copilot) -> native .github/skills + read-only gate agent + PreToolUse deny where it fires  (BEST-EFFORT client)
  BOTH -> git commit -> pre-commit ai-gate (approval + secrets + findings)
  Cody (Copilot) -> open PR -> CI ai-gate.yml as a REQUIRED status check on a protected branch  (MERGE GATE, hard)
                            + review-icea review-time critic (best-effort)
```

No network/DB tiers exist (plugin runs in-process); the only external calls are ADO REST (approval binding, Story 6) and the model endpoints (egress policy, Story 6).

---

## Rollback

**Schema migrations:** None — the epic is code/config only; `memory/`, `docs/`, artifacts are additive.

**Epic-level rollback procedure:**
1. The frozen **`v3.13.0` git tag** is the permanent Claude-only fallback; `main` stays on 3.13 until 4.0 proves out. Rollback = `git switch main` (or re-install the `v3.13.0` tag) — instant, no data loss.
2. Per provisioned target repo: `setup-sync --harness=<prev>` re-projects the previous harness set; `setup-teardown --harness=copilot` removes the Copilot projection by scope (never touches user `.github/` workflows/CODEOWNERS or `memory/`).
3. Verify: Claude Tier-A gate still blocks an un-approved Write (parity AC-NF4); eval suite green.

**Per-story rollback:** each story is a shippable slice on `feature/4.x-multi-harness`; revert its commit range. Story 5's committed `.vscode/settings.json` is the only change touching a shared per-repo file — flagged in the ICEA Irreversibility section; reversible by re-provision.

---

## Handover

### QA Team
**What was added:** the same skills + ICEA governance now run under GitHub Copilot as well as Claude Code, from one source; plus hardened approval/egress/secret controls and a behavioural eval harness. Entry points and negative tests are enumerated in **Test Cases** (TC-1…TC-10) above.

**Regression risk:** Claude 3.x behaviour — Tier-A hard gate, project `.claude/skills` loading, existing hooks — must be unchanged. Run TC-3 (parity) after Stories 2, 4, 5.

**Test data:** synthetic eval fixtures only (`Shared/eval/`) — **no real privileged/PII/secret material** (ICEA assumption). Scratch repos for provisioning tests.

### DevOps / Platform Team

| Item | Story | Detail |
|---|---|---|
| CI workflow `ai-gate.yml` (GitHub Actions) | 8 | harness-independent Tier-C gate; mirrored for ADO pipelines |
| `.vscode/settings.json` (committed) | 5 | scopes Copilot to `.github/`; workspace-trust-gated; Remote-SSH caveat (vscode#293768) |
| Vendored `ai-gate` (pinned + integrity-hashed) | 6,8 | prefer internal registry if available (D-1); else vendor-in-repo |
| No new secrets | all | approval binding uses existing `AZURE_DEVOPS_PAT` env var; never committed |
| `.aidev/manifest.json` | 8 | records provisioned harnesses/versions/hashes |
| Harness-neutral machine install | 8 | harness selected at integration, not install |

### Future Developer — Follow-on Work
- **Add a harness later** = add one native sibling adapter folder (e.g. `Cursor/`) that CONSUMES the same L1 `Shared/` content + one entry in `plugin.manifest.json.harnesses[]`; nothing in `Shared/` moves and there is no transform to author. Primary extension point.
- The shared **content core (L1)** lives in `Shared/` (Story 2); each harness re-delivers it natively in `Claude/`/`Copilot/` (never re-authors it — a CI guardrail fails a fork). Provisioning composes L1 + a native adapter by file-copy in `scripts/provision.*` (Story 8) — there is NO projection engine, delta-map, or override loader (all retired in #7).
- Known gaps carried as **Deferred Decisions** below.

---

## Definition of Done — Epic

**Delivery**
- [ ] All story tech specs generated and saved (tracker all ✅); Story 6 sub-decomposed to ≤5 SP (Story 2 re-scoped to ~4 SP under #7, no longer sub-decomposes).
- [ ] All stories implemented, reviewed, merged to `feature/4.x-multi-harness`; child ADO #s recorded.
- [ ] `main` fast-forwarded to 4.0 only after both-tools verification (TC-1, TC-2, TC-3) passes.

**Quality**
- [ ] TC-1 passes: one skill proven in BOTH tools, zero `$PLUGIN_DIR`/dangling-ref failures.
- [ ] TC-7 passes: eval suite green per supported model+harness; floor trips on a degraded model.
- [ ] TC-3 passes: Claude Tier-A hard gate still `exit 2`-blocks an un-approved Write.
- [ ] No hardcoded secrets in any story; secret-exclusion + settings-secret guard verified (TC-6).

**Review**
- [ ] Epic tech spec reviewed; each story PR maps changed files → ACs.
- [ ] All governance negative-tests (TC-4, TC-5, TC-6) pass in CI.
- [ ] ICEA + all story tech specs committed on the feature branch.

---

## Reviewer Checklist (cross-cutting)
- [ ] No skill reads a runtime `$PLUGIN_DIR`/`plugin-path.txt`/`installed_plugins.json` after Story 2.
- [ ] Creation-critical rules (Dapper-only, no-hardcoded-secrets) unconditional/in `CLAUDE.md`, NOT path-scoped (load-on-read gotcha) — both harnesses (AC-F3 / D-5).
- [ ] With both harnesses provisioned, Copilot does not double-load `.claude/` (AC-F5 / TC-2).
- [ ] Every governed artifact carries a **gate-point** stamp (Claude=prevention, Copilot=merge) — both hard, distinguishable (AC-NF5).
- [ ] Shared artifacts single-source + read-by-path, not duplicated per harness (AC-F6).
- [ ] `setup-teardown` never removes user `.github/` (workflows/CODEOWNERS) or `memory/` (AC-F8b).
- [ ] No story exceeds ≤5 SP after sub-decomposition; dependency order matches implementation order.

---

## Deferred Decisions (story-owned — with recommendation)

> These are the ICEA's D-blocks + the AC-NF2 scope call. **None blocks the Phase 0/1 foundation**, so they
> are recorded as decisions owned by a later story with a recommended default, resolved (and recorded) in
> that story's tech spec before it implements. **D-4 (skill-override threshold) is dissolved** — the
> per-skill override / projection machinery it governed was retired in ICEA #7 (native per-harness
> consumption, no delta-map), so there is no override threshold to decide.

| # | Decision | Owning story | Recommended default |
|---|---|---|---|
| D-1 | `ai-gate` distribution: vendored-pinned vs internal-registry `npx` | 6/8 | **Vendored pinned+hashed** — registry availability unknown as of 2026-08-13 → default to vendored; adopt registry-`npx` only if an internal registry is confirmed at Story 6 |
| D-2 | Neutral artifact locations vs keep `.claude/*` read-by-path | 3a | Relocate to neutral (`docs/architecture`, `.aidev/graph`) |
| D-3 | Copilot instructions: shared `CLAUDE.md` only vs also `.github/copilot-instructions.md` | 5 | Shared `CLAUDE.md`; add copilot-instructions only if gaps appear |
| D-5 | Rules projection for creation-critical rules | 3/5 | Unconditional-in-`CLAUDE.md` for creation-critical; `applyTo`/`paths:` for the rest |
| AC-NF2 | B6/B7 classifier = dependency vs deliverable | 6 | Deliverable of Story 6 (taxonomy `business-context-severity.md` is the existing input) |

---

## Open Questions

None open. (The former ❓[1] — internal registry for the pinned `ai-gate` — was resolved 2026-08-13 to "unknown → default to vendored-pinned+hashed" and reframed into Deferred Decision **D-1**, owned by Story 6. All remaining forks are story-owned Deferred Decisions with recommended defaults, so no open question blocks SAVE TECH.)

---

## Dogfood findings (tooling issues surfaced by running the flow on the plugin itself)
1. **Critic ↔ template drift:** critic SKILL.md ICEA-mode rubric references fields (Business Impact, Open Questions, Constraint Context table, Given/When/Then table) not in `icea-template.md` v2.4.1.
2. **`context-budget-tech-write` hook ↔ epic template mismatch:** the hook (Rule 1) hard-requires the exact headers `## Overview`, `## AC Coverage Matrix`, `## Files Changed`, `## Test Cases` — but the **epic-level** template (`techspec-epic-level.md`) deliberately omits the latter three (they belong in per-story specs). An epic-level spec therefore cannot pass the hook without adding those sections. Worked around here by adding epic-level rollup versions with the exact headers; candidate real fix (Story 4/8 hook work): make the hook recognise the epic-level shape, or add rollup sections to the epic template itself.

---

## Revision Log
2026-08-13 — Epic tech spec drafted from the saved ICEA (dogfood; synthetic ADO-4000). Web-app template
sections adapted to the plugin's architecture; added epic-level rollup AC Coverage Matrix / Files Changed /
Test Cases (exact headers, also to satisfy the `context-budget-tech-write` hook); D-blocks recorded as
story-owned deferred decisions; one epic-scoped Open Question (❓[1] internal registry) flagged before SAVE TECH.
2026-08-13 #2 — Synced to ICEA Revision Log #4 after the 4-reviewer adversarial review: AC-NF1 → Tier-C
scope (Tier-A soft floor); AC-NF2 → classify+warn/withhold+Tier-C, runtime egress OUT OF SCOPE; TC-5 rewritten;
SP totals ~41→~44 (Story 2 ~7, Story 8 ~6). All 9 per-story specs re-revised to match; cross-story producer
contracts made consistent (artifact-paths.md 3a→4/6; artifact-write.cjs 4→7).
2026-08-13 — ❓[1] resolved (registry availability unknown → default vendored-pinned) and reframed into D-1; Open Questions now empty → epic Tech Spec is SAVE-TECH-ready.
2026-08-14 #3 — Body re-synced to ICEA Revision Logs #6/#7/#8 (the AC Coverage Matrix + Test Cases were
already correct; the prose body was stale). Rewrote Overview, Story Breakdown, Files Changed, Governance &
Security, Overall Flow, Handover Future-Developer, and the header to the LOCKED **L1/L2/L3 model** — a
shared **content core (L1)** in `Shared/` consumed NATIVELY by each harness (retired the mechanical
projection / delta-map / per-skill override loader / runtime `$PLUGIN_DIR` bridge, #7) — and to
**ASYMMETRIC enforcement** (#6): Claude = write-time prevention gate (hard); Copilot = merge gate (hard) =
CI `ai-gate` REQUIRED status check on a protected branch + review-time `review-icea` critic; client
hooks/skills/agents = best-effort. Governance & Security dropped the three-tier / Tier-B-soft /
hard-vs-soft framing for the gate-point framing; the assurance stamp now records gate-point +
prompt-artifact version (AC-F9/NF5), not a hard/soft tier. Files Changed rebuilt to `Shared/` (L1) +
`Claude/`/`Copilot/` (native L2/L3) + neutral artifacts (removed the "relocated/projected" Shared/skills
row). Story Breakdown retitled Story 2 (Shared L1 content core + prompt versioning + re-author guardrail,
~4 SP, no sub-decompose) and Story 3 (rules as L1 content, native consumption); fixed the
foundation-ordering paragraph (Story 2 = L1 core, not a projection engine); updated referenced tech-spec
filenames. Header status → synced to #8; SP: Story 2 ~4, Story 8 6, total ~41 (pre child-split; Story 6
sub-decomposes). Removed D-4 (skill-override threshold — dissolved by the #7 retirement of the override
machinery). KEPT intact (already correct): the AC Coverage Matrix, Test Cases, Rollback, Handover
(QA/DevOps), Definition of Done, Reviewer Checklist, and Dogfood findings.
