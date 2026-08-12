# Final Design — LLM-agnostic plugin (Claude Code + GitHub Copilot)

> **Status:** 📋 Planned · **Created:** 2026-08-12 · **Source:** planning session (plan mode)
> Lifecycle: 📋 Planned → 🚧 In progress → ✅ Implemented
>
> **Phase tracker:**
> - [ ] 0. Confirm `chat.agentSkillsLocations` disable-syntax (VS Code ≥1.109)
> - [ ] 1. Skill self-containment spike (one skill, both tools)
> - [ ] 2. Roll skill self-containment across all 28 + projection/delta-map/override loader
> - [ ] 3. Rules: `paths:` where safe, unconditional where creation-critical
> - [ ] 4. Hook compat shim + memory SessionStart/capture on both
> - [ ] 5. CLAUDE.md scrub + per-harness model note + `.vscode/settings.json` Copilot scoping
> - [ ] 6. Governance hardening (SEV-1s): ADO-bound approval · B1–B7 data-egress · memory-untrusted · pinned/hash-verified gate · warn-only+break-glass
> - [ ] 7. Behavioral eval harness + audit stamping + capability floor + cost telemetry
> - [ ] 8. Read-only gate agents (generated) + provisioning/sync/teardown + `plugin.manifest.json`

## Context

The existing Claude Code plugin (ICEA governance: no code without an approved ICEA/Tech Spec)
must also work with GitHub Copilot. Verified fact that makes this tractable: **VS Code 1.109
(Jan 2026) added deliberate "Claude compatibility"** — Copilot natively reads `CLAUDE.md`,
`.claude/rules` (with `paths:`), `.claude/agents`, `.claude/skills`, and `.claude/settings.json`
hooks. So the strategy is **convergence, not a second plugin and not a bespoke transform layer**:
organize the plugin by scope, project into each tool's native paths, and harden the governance
for AI-safety (a law-firm context with privileged data).

Decisions locked over review: converge the existing plugin · scoped `Shared/Claude/Copilot`
source · per-harness projection · shared-skills-with-override · runtime `$PLUGIN_DIR` eliminated ·
three-tier enforcement · **SEV-1 AI-safety items are first-class work-streams**.

Approaches rejected (and why): (a) *greenfield Copilot plugin* — duplicates content, second
codebase, but the portable subset is exactly what Copilot needs → superseded by convergence once
1.109 compat was verified; (b) *port via a bespoke adapter/emitter transform layer* — the
mechanical deltas are small and 1.109 reads the Claude format natively, so a transform layer is
unjustified complexity; (c) *"all 28 skills" mechanical projection with no triage* — ~11 skills
are plugin-infra and stateful skills need overrides.

---

## 1. Source structure (scoped by harness)

```
ai-assisted-dev/                      # the plugin repo
  plugin.manifest.json                # NEUTRAL registry: version · components · harnesses:[claude,copilot,…]
  Shared/                             # [neutral] single source of truth
    skills/  _shared/ + <28 skills>   #   self-contained SKILL.md, relative refs, neutral wording
    rules/   <coding standards>       #   `paths:` only where NOT creation-critical (see §4)
    instructions/workflow.md          #   body of CLAUDE.md
    hooks/   hook-input.cjs (shim) + hook logic
    gate/    ai-gate (icea-floor + secrets + doc-completeness + ADO-approval check)
    eval/    fixtures + expected-shape checks (behavioral eval)
    templates/ MEMORY.md seed · docs scaffold · graph-gen.mjs
  Claude/                             # [claude] adapter (thin)
    .claude-plugin/{plugin.json, marketplace.json} · settings.template.json · CLAUDE.bindings.md
    skills-override/<name>/           #   opt-in: replaces projection for that skill
  Copilot/                            # [copilot] adapter (thin)
    plugin.json · copilot.bindings.md · agents.gen.json · mcp.template.json · cloud-hooks/
    vscode-settings.template.json     #   scopes Copilot to .github/ (disables .claude/ discovery)
    skills-override/<name>/
  scripts/  provision.cjs · install.*
```

Add a harness later = new sibling adapter folder + one `plugin.manifest.json` line. Nothing moves.

## 2. Projection & `$PLUGIN_DIR` elimination

- **Build-time** scripts self-locate via `__dirname` (drop the `installed_plugins.json` resolver).
- **Provisioning** projects `Shared/` (+ the selected adapter) into each tool's **native paths**;
  skills become **self-contained** (relative `_shared/` reads, sibling-skill invocation) — so
  **nothing reads `$PLUGIN_DIR` at runtime.** Works in Claude (project `.claude/skills`) and
  Copilot (no plugin dir). `plugin-path.txt`/resolver retired to provenance only.
- Trade-off: skill/rule updates arrive via `setup-sync` re-projection (hash-tracked) — the model
  the plugin already uses for hooks/rules.

## 3. Provisioned project + clean separation (verified)

```
your-project/
  ── neutral ──
  CLAUDE.md                       [both]   shared instructions (Claude reads natively; Copilot via chat.useClaudeMdFile)
  memory/MEMORY.md · docs/…                workflow state (ICEA · Tech Spec · architecture · graph)
  .aidev/manifest.json                     provisioned harnesses · versions · hashes
  ── claude ──  .claude/{settings.json, skills, rules, agents, hooks}   (projected from Shared+Claude)
  ── copilot ── .github/{skills, instructions, agents, hooks, workflows/ai-gate.yml}
                .vscode/settings.json       scopes Copilot to .github/ ONLY (disables .claude/*)
                .vscode/mcp.json (optional)
  ── ci ──      .git/hooks/pre-commit → ai-gate
```

**Separation is achievable (verified):** Copilot's `.claude/` discovery is disableable via
`chat.agentSkillsLocations`/`instructionsFilesLocations` (path→false) + `chat.useClaudeMdFile:false`,
so the emitted `.vscode/settings.json` points Copilot at `.github/` only → no double-registration.

## 3a. Config vs. artifacts (what's per-harness vs. shared-once)

Two categories, handled differently:
- **Config** (the tool auto-discovers it): skills, rules, hooks, agents, instructions →
  **projected per harness** into `.claude/`/`.github/` (§4).
- **Artifacts / data** (describe the codebase/workflow, read on demand by path): architecture
  docs, knowledge graph, `memory/`, `docs/` ICEA/Tech Spec, code-review/security ledgers,
  token-graph → **generated ONCE into a neutral location, shared by both tools.** Never
  duplicated per harness (avoids drift — one graph, one architecture).
  - Relocate `.claude/architecture` + `.claude/graph` → neutral (`.aidev/graph`,
    `docs/architecture`); `memory/`, `docs/` already neutral at repo root.
  - Read by explicit path, so Copilot's `.claude/` config-scoping does NOT hide them.
  - Generated by the **shared** `architect`/`graph-*` skills — whichever tool the dev uses writes
    to the same neutral copy. `setup-init` seeds structure; population is a runtime skill action.
    `graph-stale-detect` (git-native hook) flags staleness for both.

## 4. Config surface (authored once in `Shared/`, projected)

| Artifact | Claude output | Copilot output | Notes |
|---|---|---|---|
| Instructions | `CLAUDE.md` | `CLAUDE.md` or `.github/copilot-instructions.md` | Claude ignores `AGENTS.md` → CLAUDE.md is the shared file |
| Rules | `.claude/rules/*.md` (`paths:`) | `.github/instructions/*` (`applyTo`) | **creation-critical rules stay unconditional/in CLAUDE.md** (path-scoped load on read, not on write) |
| Skills | `.claude/skills/` | `.github/skills/` | shared source + delta-map; per-skill override (§5) |
| Gate agents | (Claude uses hooks) | `.github/agents/` | generated from skill frontmatter (read-only) |
| Hooks | `.claude/settings.json` | `.github/hooks/` (+cloud) | shim: matcher-in-script + tool-name map (Preview on Copilot) |
| Memory | `memory/MEMORY.md` | same | loaded via `SessionStart`; capture via workflow + UserPromptSubmit |

## 5. Skills model

Author once in `Shared/skills/<name>` in harness-neutral language; project with a **mechanical
delta map** (frontmatter `allowed-tools`↔`tools`; tool-name tokens `Write/Edit`↔`create_file/
replace_string_in_file`; model/gate wiring in the adapter, not the body). **Per-skill override**
(`Claude|Copilot/skills-override/<name>`) replaces the projection for the rare divergent skill
(realistically the stateful `icea-feature`/`migration`, and skills that orchestrate via
Claude-only tools). Composite skill-invoking-skill (`icea→critic`) is experimental on Copilot →
those get overrides or run as user-invoked steps.

## 6. Memory & context

- **Memory:** git-committed `memory/MEMORY.md` is the source of truth (NOT Copilot's black-box
  memory). `SessionStart` hook injects it (auto `/session-start`); capture is baked into
  `critic`/`implement` steps + a `UserPromptSubmit` reminder where supported.
- **Context:** lean on Copilot-native `/compact`, auto-compaction, and the context-budget
  indicator (drop the Claude context-budget hooks); `graph.json`/`architecture.md` act as
  compaction; on-demand instruction loading keeps rules cold until needed.

## 7. Enforcement — three tiers + governance-integrity hardening

- **Tier A — Claude write-time hooks: HARD, deterministic (GA).** `icea-floor` `exit 2` blocks
  Write/Edit. Unchanged.
- **Tier B — Copilot write-time: read-only gate agents + PreToolUse deny (Preview, overridable).**
- **Tier C — git pre-commit + CI (`ai-gate`): harness-independent backstop.** The only universal
  layer (non-tool edits, teammates without the plugin, bypassed sessions).

**Governance-integrity hardening (the SEV-1/SEV-2 fixes — first-class, not afterthoughts):**
- **Approval bound to system-of-record.** `ai-gate` verifies the ADO work-item approval state /
  a signed approval via the ADO API — **not** a `Status: Approved` file grep (which the AI can
  forge). Closes self-approval.
- **Data-egress policy tied to B1–B7.** Context classified high-severity (privileged/PII) is
  gated to approved model endpoints or redacted before it reaches a model; the policy is
  harness-aware (Copilot cloud/`Auto` boundaries differ from the controlled Claude tier). No
  privileged context leaves its allowed boundary.
- **Memory/docs treated as untrusted input** (no executable authority; provenance/review on
  memory writes) + **secret context-exclusion** (`.env`, `settings.local.json`, PAT never enter
  model context). Closes the auto-loaded-memory injection vector.
- **Per-artifact assurance level** recorded (hard-gated vs soft) so a Copilot-produced approval
  isn't treated as equal to a Claude-enforced one; gate on real **ICEA↔code traceability**
  (`icea-review`), not file existence — prevents "ICEA as commit checkbox" inversion.
- **Gate safety:** vendored, **version-pinned + integrity-hashed** `ai-gate.mjs` (preferred over
  unpinned `npx`); hooks verified against `.hashes` before running; untrusted-PR hooks don't
  auto-run. **Rollout warn-only first**, with an **audited break-glass** bypass (no silent
  `--no-verify` culture).

## 8. Model routing, capability floor, audit

- Routing per harness (Claude env vars / Copilot `model:` frontmatter, fallback array,
  Kirkland-policy-gated).
- **Per-skill capability floor**: declare the minimum model tier; below it, degrade to warn/refuse
  rather than emit a shallow ICEA that gates real code.
- **Audit stamping**: every governed artifact records model+version+harness+skill-hash for
  reproducibility/attribution.

## 9. Evaluation & observability

- **Behavioral eval harness** (`Shared/eval/`): fixture inputs → expected artifact shape / AC
  coverage, run in CI per supported model+harness → detects quality regression on model/harness
  updates. (A governance tool must detect its own decay.)
- **Cross-harness usage/cost telemetry** replacing the dropped proactive budget signal.

## 10. Distribution & selection (two stages) + lifecycle

**Harness is selected at application-integration time (per project), NOT at machine install.**
1. **Machine install (once, harness-NEUTRAL):** makes the provisioner available — via
   `npx @org/ai-assisted-dev` / clone (so Copilot-only users need no Claude install), optionally
   also the Claude marketplace for `/setup-init` slash-command convenience. Selects no harness.
2. **Application integration (per project):** `provision --harness=claude,copilot` (or interactive
   multi-select) projects `Shared/`+adapter(s) into native paths, emits `.vscode/settings.json`
   (Copilot scoping) when both selected, installs shim'd hooks + vendored gate + `ai-gate.yml`,
   and records the choice in `.aidev/manifest.json`. **This is the selection point.**

Because the projected config (incl. the committed `.vscode/settings.json`) lives in the repo, a
repo provisioned for both harnesses **covers every developer on either tool with no per-dev
setup** — Claude reads project `.claude/skills` natively; Copilot reads committed `.github/` +
`.vscode/`. Re-selection later = re-integration (`setup-sync --harness=+copilot`), no reinstall.

`setup-sync` re-projects (hash-tracked, user-edit protection); `setup-teardown` removes
per-harness content by scope, never touching user `.github/` (workflows/CODEOWNERS) or `memory/`.
**Correction from today:** `install.cjs` is Claude-marketplace-centric → make machine install
harness-neutral and move harness selection firmly into the integration step.

## Verification

- **Cross-tool skill:** one relocated skill runs in Claude Code AND VS Code Copilot ≥1.109 with
  no `$PLUGIN_DIR`/dangling-ref failures; separation confirmed (Copilot doesn't double-load `.claude`).
- **Rules:** attach in both; a creation-critical rule is present when generating a new file.
- **Enforcement:** Tier A blocks a Claude Write with no ICEA; Tier C blocks a commit/PR whose ADO
  item is not Approved-in-ADO and blocks a self-flipped file status; committed secret blocked.
- **AI-safety:** a poisoned `MEMORY.md` instruction is NOT acted on; a B7-classified file is not
  sent to a non-approved model; a secret file never enters context.
- **Eval:** the behavioral suite passes per supported model/harness; a deliberately degraded model
  trips the capability floor.
- **Lifecycle:** `/setup-init` (each harness) projects correctly; `/setup-teardown` leaves user
  `.github/`, `memory/` intact.

---

## Verified facts (sources, Aug 2026)

- VS Code 1.109 Claude compatibility (instructions/agents/skills/hooks) — code.visualstudio.com/updates/v1_109
- Copilot custom agents (`.agent.md`), prompt files, `.claude/rules`+`paths:`, `chat.useClaudeMdFile`,
  `chat.agentSkillsLocations`/`instructionsFilesLocations` (disableable per-path) — code.visualstudio.com/docs/agent-customization/*
- Copilot hooks (`hooks.json`; SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/PreCompact/Stop;
  Preview) — code.visualstudio.com/docs/agent-customization/hooks · docs.github.com/en/copilot/reference/hooks-reference
- Claude Code project `.claude/skills/` + `.claude/rules` (`paths:`, load-on-read) — code.claude.com/docs/en/skills · /memory
- Claude does NOT read `AGENTS.md` (import via `@AGENTS.md`) — community/primary consensus
- Copilot plugin packaging (`plugin.json` + `marketplace.json`; agents/skills/hooks/mcp) — docs.github.com/en/copilot/concepts/agents/about-plugins
