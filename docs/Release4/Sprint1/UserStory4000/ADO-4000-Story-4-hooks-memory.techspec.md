# Tech Spec — Story 4: Hook compat shim + memory on both harnesses
ADO #4000 · Release 4 · Sprint 1 · Story 4
Status: DRAFT · STORY · 5 SP

> Per-story spec under the Epic ADO-4000 (LLM-Agnostic Multi-Harness Convergence). Source ICEA:
> `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md` (revised
> 2026-08-14 #8 — ASYMMETRIC enforcement (#6) + shared L1 content core with NATIVE per-harness
> engagement/enforcement, mechanical projection RETIRED (#7) + prompt-artifact versioning (#8)).
> Epic Tech Spec: `temp/ADO-4000-tech.md`. This is a **plugin/tooling** story — Node.js CJS hook
> scripts + markdown/JSON hook manifests, NOT a web app. Standard web-app template sections (Schema
> Changes, browser->API->DB flow, Azure AD/CSRF, Key Vault) do not apply and are adapted below: "API
> Changes" becomes the hook I/O contract + tool-name map; "Auth & Security" becomes the enforcement
> model (these hooks ARE the enforcement layer).
>
> **Layering (ICEA #7 — L1/L2/L3, native per harness, NO mechanical projection).** The B1–B7
> taxonomy, the hook DECISION LOGIC as shared knowledge, and the enforcement standard are **L1
> content** and live once under `Shared/`. The hooks that ENGAGE the harness are **L2/L3** and are
> authored **NATIVELY per harness**: the Claude hooks live in `Claude/` (native, the Claude
> write-time hard gate, ≈v3.13 unchanged) and the Copilot hooks live in `Copilot/` (native,
> best-effort). They are NOT mechanically projected from a Claude shape — the delta-map / per-skill
> projection / runtime `$PLUGIN_DIR` bridge are RETIRED (#7). Both harness-native hook sets CONSUME
> the same L1 (e.g. the classifier hook reads the L1 B1–B7 taxonomy; it does not re-author it — a CI
> guardrail fails any PR that re-authors an L1 standard in `Copilot/`). Depends on Story 2 for the L1
> content core + CI guardrail (NOT a projection engine — that was retired in #7). Consumes the shared
> `artifact-paths.md` contract (co-owned with Story 3a) for every architecture/graph/memory path a
> hook references, so Story 3a's artifact relocation and this story's hook relocation cannot clobber
> each other's readers. Coordinates the `.vscode/settings.json` emission with Story 5 (Story 5 owns
> that file; this story specifies the `chat.hookFilesLocations` keys it must carry).

---

## Overview

This story makes the plugin's nine existing hooks enforce governance on **both** Claude Code and GitHub Copilot, and makes committed `memory/MEMORY.md` load at session start on both harnesses.

**Layering (L1/L2/L3 — shared content, NATIVE per-harness hooks; ICEA #7).** The governing pattern is NOT "author-once, mechanically-project-per-harness" — that projection model (the delta-map, per-skill projection, and the runtime `$PLUGIN_DIR` bridge) was **RETIRED in ICEA #7**. Instead:
- **L1 (content & standards, single source in `Shared/`)** — the hook DECISION LOGIC as shared knowledge, the B1–B7 taxonomy the classifying hook reads, the guarded-path SET rules, the compat primitives (input normaliser, tool-name map, matcher-in-script predicate), and the enforcement standard. Authored ONCE; NEVER duplicated.
- **L2/L3 (engagement + enforcement, NATIVE per harness)** — the **Claude hooks live in `Claude/`** (native, ≈v3.13 unchanged: the Claude write-time hard gate, registered in `.claude/settings.json` with declarative `matcher`), and the **Copilot hooks live in `Copilot/`** (native, best-effort: a `hooks.json` Preview manifest under `.github/hooks`). These two hook sets are AUTHORED NATIVELY to each harness's strengths — the Copilot side is NOT mechanically projected from the Claude shape.
- **Both harness-native hook sets CONSUME L1, never re-author it.** e.g. the hook that classifies context against B1–B7 reads the L1 taxonomy; the compat shim, matcher-in-script predicate, and tool-name map are L1 primitives consumed by both. A **CI guardrail** (Story 2) fails any PR that re-authors an L1 standard inside `Copilot/` (re-deliver, never re-fork).

The two harnesses have different hook models — Claude Code registers hooks in `.claude/settings.json` and supports a declarative `matcher` field with GA (generally available) write-time semantics; Copilot uses a `hooks.json` (Preview) with `SessionStart`/`UserPromptSubmit`/`PreToolUse`/`PostToolUse` events, does not apply the same `matcher` syntax (matchers are parsed-but-not-applied — web-confirmed), and uses different tool names. The **shared L1 compat primitives** reconcile this two ways so each native hook set reaches the SAME decision from the SAME L1 logic: **matcher-in-script** (the tool-match predicate that Claude expresses declaratively is instead computed inside the hook, so Copilot — which does not apply the declarative matcher — gets identical filtering) and a **tool-name map** (a small L1 table translating Copilot tool identifiers to the canonical names the shared logic expects, e.g. Copilot's edit tool -> canonical `Write`/`Edit`).

**Enforcement is ASYMMETRIC (revised ICEA #6) and this story sits squarely inside that model.** The two harnesses do NOT enforce at the same point, and this story does not pretend they do:

- **Claude = write-time PREVENTION (the CLAUDE hard gate — UNCHANGED).** Claude keeps its GA write-time hooks (`icea-floor` `exit 2`, and the other eight) byte-for-byte. These are the Claude hard line and the AC-NF4 parity contract. This story must not weaken them — including keeping `icea-floor`'s fail-OPEN-on-malformed-stdin behaviour, for AC-NF4 parity.
- **Copilot client hooks = BEST-EFFORT.** The projected `.github/hooks/hooks.json` `PreToolUse` deny *does* hard-deny (`exit 2`) **where it actually fires** — but it is Preview, its events are not guaranteed to deliver on every surface, and on timeout it **fails OPEN**. Therefore the Copilot client hooks are explicitly **NOT the Copilot hard line** — they are best-effort authoring-time assistance layered on top.
- **The Copilot HARD gate is NOT a client hook at all** — it is the harness-independent CI `ai-gate` as a **required status check on a protected branch** (un-bypassable at merge; you cannot `--no-verify` a required check). That gate is owned/built by **Story 6** (logic) and distributed by **Story 8** (provisioning + branch-protection setup) — it is out of scope for THIS story, which only produces the best-effort Copilot client layer and coordinates with the gate as the backstop.

This story does not itself relocate every hook's business logic wholesale; it establishes the shim, neutralises two Claude-only assumptions, projects the Copilot best-effort layer, and adds the memory injector + audit-stamp producer. "Runs on both harnesses" (AC-F7) is defined here as *inspects the same inputs and reaches the same decision where it fires* — not merely *fires on both*. Two 3.x hooks were audited and found to be Claude-only in a way that would silently no-op on a Copilot repo; this story neutralises both so the guarantee holds:

- **`check-settings-secrets.cjs`** hard-codes `.claude/settings.json` in its path predicate (`isSettingsJson`) and in `git show :.claude/settings.json` (`--staged`). On a Copilot repo the committed sensitive config is `.vscode/settings.json`, `.vscode/mcp.json`, and committed `.github/**` hook/workflow config — none of which the 3.x hook scans, so it *fires but inspects nothing*. This story **parameterises the guarded-path SET** so the hook inspects Claude's `.claude/settings.json` **and** the Copilot-side files, on both the write-time and staged tiers.
- **`memory-capture.cjs`** guards on `.claude/dream-init-state.json` (`if (!fs.existsSync('.claude/dream-init-state.json')) process.exit(0)`). A Copilot-only repo may not carry that Claude-specific state file, so the reminder **silently no-ops**. This story neutralises the guard to a **harness-neutral activation signal** (`.aidev/manifest.json` — the harness-neutral registry from AC-F4 — or the presence of `memory/`).

Memory has TWO distinct hook roles, deliberately kept separate:
- `memory-capture.cjs` is a **REMINDER-injector**, NOT a writer. It emits `hookSpecificOutput.additionalContext` on `UserPromptSubmit` nudging the model to write to `memory/MEMORY.md` if a trigger fired in the previous turn. It never writes memory itself. Its guard is now harness-neutral (above) so it activates on a Copilot-only repo too.
- `session-start-memory.cjs` (NEW) is the **content injector**: it reads committed `memory/MEMORY.md` and injects it as session context at `SessionStart` on both harnesses. This is correctly new — 3.x had no such injector.
- The actual memory *content* is written by the baked-in critic/implement skill steps (existing 3.x behaviour), NOT by any hook. So real capture relies on those skill-side writes plus the reminder nudge; the injector only surfaces already-written memory.

The story ships the shared L1 hook logic + compat primitives in `Shared/hooks/**`, the **native Claude hooks in `Claude/hooks/`** wired via the `.claude/settings.json` hooks block (Claude GA, the hard gate, unchanged), the **native Copilot hooks in `Copilot/hooks/`** emitted to `.github/hooks/` (+ cloud-hooks) as the best-effort Copilot manifest, a hook-input normaliser (L1), the SessionStart memory injector, the NEW `Shared/hooks/artifact-write.cjs` audit-stamp hook-in (producer for Story 7's AC-NF5), and an AC-NF4 parity check. Both native hook sets CONSUME the shared L1 logic — they are authored per harness, not projected from one to the other (#7). It also specifies the `chat.hookFilesLocations` scoping keys (emitted by Story 5) that close the `.claude/settings.json` hook double-registration on Copilot.

---

## AC Coverage Matrix

Every AC in this story's scope must be covered by at least one file change; every file change must satisfy at least one AC. Gaps are flagged.

Scope: **AC-F7** (asymmetric enforcement — this story owns the hook slice), **AC-F5** (the `chat.hookFilesLocations` hook-discovery scoping requirement — file emitted by Story 5, hook keys specified here) and **AC-NF4** (parity — co-owned with Stories 2 and 5; this story owns the hook-path slice). This story is also the **PRODUCER** of `artifact-write.cjs`, which Story 7's **AC-NF5** (audit stamping) CONSUMES — AC-NF5 is delivered by Story 7, not asserted here.

### AC -> File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F7 (asymmetric) | Claude = write-time PREVENTION (GA hooks, unchanged, hard) — the Claude hard gate. Copilot client hooks = BEST-EFFORT (`PreToolUse` `exit 2` denies WHERE it fires, but Preview + timeout-fail-open, so NOT the Copilot hard line). Copilot HARD gate = CI `ai-gate` required check (Story 6/8), out of scope here. Hooks INSPECT the same inputs on both harnesses via the compat shim. | `Shared/hooks/lib/compat-shim.cjs`, `Shared/hooks/lib/tool-name-map.cjs`, `Shared/hooks/lib/hook-input.cjs`, nine `Shared/hooks/*.cjs` logic modules, `Shared/hooks/lib/guarded-paths.cjs`, `.claude/settings.json`, `.github/hooks/hooks.json` (+ `.github/cloud-hooks/hooks.json`), `.github/agents/gate-*.agent.md` | Covered |
| AC-F5 (hook double-reg) | The `.vscode/settings.json` (emitted by Story 5) sets `chat.hookFilesLocations` for the three default-Claude paths (`.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`) to `false`, so Copilot does not ALSO register `.claude/settings.json` hooks alongside `.github/hooks`. Verified by ACTUAL load (Copilot Hooks output channel), not the flag alone. | `.vscode/settings.json` (Story 5 emits; keys specified here), `.github/hooks/hooks.json` (sole Copilot registration), `scripts/provision.cjs` | Covered |
| AC-NF4 (parity) | Claude 3.x parity — Tier-A hard gate still `exit 2`-blocks a Write with no approved ICEA, pre and post 4.x, byte-for-byte; `icea-floor` retains its 3.x fail-OPEN-on-malformed-stdin behaviour (parity, not smuggled). | `Shared/hooks/icea-floor.cjs`, projected `.claude/settings.json` hooks block, `Shared/eval/parity/claude-tier-a.test.cjs` | Covered |

### File -> AC mapping

| File | ACs satisfied |
|---|---|
| `Shared/hooks/lib/compat-shim.cjs` (harness-adapting entry wrapper) | AC-F7 |
| `Shared/hooks/lib/tool-name-map.cjs` (Copilot->canonical tool-name table) | AC-F7 |
| `Shared/hooks/lib/hook-input.cjs` (snake_case<->camelCase input normaliser) | AC-F7, AC-NF4 |
| `Shared/hooks/lib/guarded-paths.cjs` (per-harness guarded-file SET for check-settings-secrets) | AC-F7 |
| `Shared/hooks/icea-floor.cjs` (Claude Tier-A floor — hard, unchanged incl. fail-open) | AC-F7, AC-NF4 |
| `Shared/hooks/check-settings-secrets.cjs` (now scans both harnesses' committed config) | AC-F7 |
| `Shared/hooks/script-review-gate.cjs` | AC-F7 |
| `Shared/hooks/context-budget-icea-save.cjs`, `context-budget-tech-write.cjs` | AC-F7 |
| `Shared/hooks/memory-capture.cjs` (reminder-injector; harness-neutral guard) | AC-F7 |
| `Shared/hooks/memory-log.cjs` | AC-F7 |
| `Shared/hooks/findings-gate-precommit.cjs` | AC-F7 |
| `Shared/hooks/graph-stale-detect.cjs` (reads paths via artifact-paths.md contract) | AC-F7 |
| `Shared/hooks/session-start-memory.cjs` (SessionStart memory content injector) | AC-F7 |
| `Shared/hooks/artifact-write.cjs` (audit-stamp hook-in — PRODUCER; Story 7 AC-NF5 consumes) | AC-F7 (produced here) |
| `.claude/settings.json` (projected hooks block — declarative `matcher` preserved, Claude hard gate) | AC-F7, AC-NF4 |
| `.github/hooks/hooks.json` (sole Copilot registration — best-effort client layer) | AC-F7, AC-F5 |
| `.github/cloud-hooks/hooks.json` (projected cloud-surface manifest, best-effort) | AC-F7 |
| `.vscode/settings.json` `chat.hookFilesLocations` keys (Story 5 emits; specified here) | AC-F5 |
| `.github/agents/gate-icea.agent.md`, `gate-script.agent.md` (read-only gate agents, advisory) | AC-F7 |
| `Shared/eval/parity/claude-tier-a.test.cjs` (AC-NF4 parity check) | AC-NF4 |

**Coverage result:** all three in-scope ACs (AC-F7 asymmetric, AC-F5 hook scoping, AC-NF4 parity) are covered. `artifact-write.cjs` is produced here (its consuming AC-NF5 lives in Story 7) and mapped to AC-F7 as a same-story hook-in so it is not orphaned. The Copilot HARD gate (CI `ai-gate` required check) is explicitly NOT covered here by design — it is Story 6 (logic) + Story 8 (distribution + branch protection); this story produces only the Copilot best-effort client layer plus the shared `.vscode` hook-scoping key spec that Story 5 emits.

---

## Files Changed

> Plugin/tooling story — files are CJS hook scripts, shared logic modules, and harness hook manifests.
> `~` = modified/relocated from an existing 3.x file; `+` = new. There is **no Schema Changes section** —
> this story touches no database (the plugin runs in-process; hooks read stdin JSON and exit with a
> status code). The nine existing hooks currently live as `.cjs`/`.ps1` scripts referenced from
> `.claude/settings.json`.

| Path | Change | Notes |
|---|---|---|
| `Shared/hooks/lib/compat-shim.cjs` | + | Harness-adapting entry wrapper: detects harness from env/input shape, runs matcher-in-script, invokes shared logic, translates the exit contract (Claude `exit 2` hard deny vs Copilot `PreToolUse` deny — best-effort) |
| `Shared/hooks/lib/tool-name-map.cjs` | + | Static table: Copilot tool ids -> canonical `Write`/`Edit`/`Read`/`Bash`; unknown tools pass through untranslated (fail-visible) |
| `Shared/hooks/lib/hook-input.cjs` | + | Normalises stdin JSON into a canonical `{ harness, event, toolName, filePath, prompt, raw }` object. **Reconciles snake_case `tool_input.file_path` (one harness) with camelCase `filePath` (the other) — web-confirmed necessary; both shapes are observed in the wild** |
| `Shared/hooks/lib/guarded-paths.cjs` | + | Per-harness guarded-file SET consumed by check-settings-secrets: Claude -> [`.claude/settings.json`]; Copilot -> [`.vscode/settings.json`, `.vscode/mcp.json`, committed `.github/**` hook/workflow config]; both when both provisioned |
| `Shared/hooks/icea-floor.cjs` | ~ | Relocated Claude Tier-A floor logic; decision logic **unchanged — the Claude hard gate**, INCLUDING the fail-OPEN-on-malformed-stdin behaviour retained for AC-NF4 parity (see Auth & Security + N-U4). Input read moved behind `hook-input.cjs` (shape-normalisation only; no decision change) |
| `Shared/hooks/check-settings-secrets.cjs` | ~ | Relocated; guarded-path SET **parameterised** via `guarded-paths.cjs` so it INSPECTS both `.claude/settings.json` (Claude) and `.vscode/settings.json`/`.vscode/mcp.json`/committed `.github/**` config (Copilot). `--staged` iterates `git show :<path>` over the SET, not the single hard-coded path |
| `Shared/hooks/script-review-gate.cjs` | ~ | Relocated script-review gate |
| `Shared/hooks/context-budget-icea-save.cjs` | ~ | Relocated (was `.claude/hooks/context-budget-icea-save.cjs`) |
| `Shared/hooks/context-budget-tech-write.cjs` | ~ | Relocated tech-write budget/header gate |
| `Shared/hooks/memory-capture.cjs` | ~ | Relocated `.ps1`->`.cjs`; **reminder-injector only** (emits `additionalContext`, does NOT write memory). Activation guard neutralised from `.claude/dream-init-state.json` to a harness-neutral signal (`.aidev/manifest.json` OR presence of `memory/`) so it does not silently no-op on a Copilot-only repo |
| `Shared/hooks/memory-log.cjs` | ~ | Relocated from `memory-log.ps1` |
| `Shared/hooks/findings-gate-precommit.cjs` | ~ | Relocated pre-commit findings gate |
| `Shared/hooks/graph-stale-detect.cjs` | ~ | Relocated graph-stale detector; graph/arch path read via the shared `artifact-paths.md` contract (co-owned with Story 3a) rather than a hard-coded `.claude/graph` path |
| `Shared/hooks/session-start-memory.cjs` | + | SessionStart memory CONTENT injector: reads committed `memory/MEMORY.md`, emits it as session context on both harnesses (data only, no executable authority) |
| `Shared/hooks/artifact-write.cjs` | + | **NEW audit-stamp hook-in — PRODUCER for Story 7 AC-NF5.** On a governed-artifact write, computes/records the stamp fields (model+version+harness+skill-hash+gate-point). Story 4 ships the hook-in + stamp record shape; Story 7 CONSUMES it to formalise the assurance stamp |
| `Shared/hooks/lib/artifact-paths.cjs` | + | Thin reader for the shared `artifact-paths.md` contract (architecture/graph/memory locations); co-owned with Story 3a |
| `Claude/hooks/*.cjs` | ~ | **NATIVE Claude hook layer** (L2/L3, ≈v3.13 unchanged) — the Claude write-time hard gate; each hook CONSUMES the shared L1 logic in `Shared/hooks/**`. Authored natively for Claude, NOT projected (#7) |
| `Copilot/hooks/*.cjs` + `Copilot/hooks/hooks.json` | + | **NATIVE Copilot hook layer** (L2/L3, best-effort) — authored natively to Copilot's Preview `hooks.json` model; each hook CONSUMES the same shared L1 logic. NOT mechanically projected from the Claude shape (#7) |
| `.claude/settings.json` | ~ | Hooks block wired to the NATIVE `Claude/hooks/` scripts; declarative `matcher` fields preserved (GA, unchanged semantics — the Claude hard gate) |
| `.github/hooks/hooks.json` | + | Emitted from the NATIVE `Copilot/hooks/` layer — **the SOLE Copilot hook registration**, BEST-EFFORT client layer. `SessionStart`/`UserPromptSubmit`/`PreToolUse`/`PostToolUse` -> shim entry per hook |
| `.github/cloud-hooks/hooks.json` | + | Emitted from `Copilot/hooks/` — cloud-surface manifest (subset safe when `UserPromptSubmit additionalContext` is not delivered), best-effort |
| `.vscode/settings.json` | ~ (Story 5 owns) | This story SPECIFIES the `chat.hookFilesLocations` keys the file must carry: `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` -> `false`, so Copilot does not double-register `.claude` hooks. Story 5 emits the actual file (coordinated) alongside `chat.agentSkillsLocations`/`chat.instructionsFilesLocations` |
| `.github/agents/gate-icea.agent.md` | + | Read-only gate agent: surfaces the ICEA-floor verdict on Copilot (advisory, best-effort) paired with the `PreToolUse` deny |
| `.github/agents/gate-script.agent.md` | + | Read-only gate agent for the script-review gate on Copilot (advisory, best-effort) |
| `Shared/eval/parity/claude-tier-a.test.cjs` | + | AC-NF4 parity test: asserts Claude `icea-floor` still `exit 2`-blocks an un-approved Write and still fails OPEN on malformed stdin |
| `scripts/provision.cjs` | ~ | Emits the NATIVE `Claude/hooks/` layer to `.claude/settings.json` and the NATIVE `Copilot/hooks/` layer to `.github/hooks/`; on both-harness provisioning, registers Copilot hooks ONLY under `.github/hooks` and coordinates the `chat.hookFilesLocations` closure with Story 5 so Copilot does not re-register `.claude/settings.json` hooks. (Not a projection engine — #7 retired mechanical projection; this places each harness's natively-authored hook layer.) |

---

## API Changes (adapted — hook I/O contract + tool-name map)

There are no HTTP endpoints. The "API" here is the **hook input/output contract** each harness uses to invoke a hook, and the **tool-name map** the shim uses to reconcile them.

**Hook input contract (canonical, produced by `hook-input.cjs`):**

```
{ harness: "claude" | "copilot",
  event:   "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse",
  toolName: "Write" | "Edit" | "Read" | "Bash" | ... (canonical, post-map),
  filePath: string | null,
  prompt:   string | null,
  raw:      object }
```

The normaliser reconciles the two field shapes observed across harnesses — snake_case `tool_input.file_path` and camelCase `filePath` — into the single canonical `filePath` (web-confirmed necessary; different harness/versions emit different shapes). `raw` retains the original untouched.

**Hook output contract (harness-specific, produced by `compat-shim.cjs`):**

- **Claude (write-time PREVENTION, hard — the Claude hard gate):** deny = process `exit 2` with a stderr message; allow = `exit 0`. Unchanged from 3.x — the parity contract (AC-NF4).
- **Copilot (BEST-EFFORT client layer):** deny = `exit 2` with a `PreToolUse` deny JSON on stdout (`{ "decision": "deny", "reason": "..." }`) — this DOES hard-deny **where the event actually fires**; allow = `exit 0` empty. But because the event is Preview, may not deliver on every surface, and **times out fail-OPEN**, the Copilot client hook is explicitly NOT the Copilot hard line. The gate point is stamped (via `artifact-write.cjs`, formalised in Story 7 AC-NF5) so provenance records that this was a best-effort client check, and the merge-time CI `ai-gate` (Story 6/8) is the actual Copilot hard gate.

**Guarded-path SET (`guarded-paths.cjs`, consumed by `check-settings-secrets`):** returns the set of committed config files to inspect for the active harness. Claude -> `.claude/settings.json`; Copilot -> `.vscode/settings.json`, `.vscode/mcp.json`, and committed `.github/**` hook/workflow config; both -> the union. `runHook` matches a write target against the SET; `runStaged` iterates `git show :<path>` over each SET member. This makes "runs on both harnesses" mean the guard INSPECTS both, not merely fires.

**Tool-name map (`tool-name-map.cjs`):** Copilot tool identifiers are translated to canonical names the shared logic switches on. Unknown/unmapped tools pass through unchanged so a new Copilot tool cannot silently bypass a matcher (fail-visible, not fail-open). The **matcher-in-script** predicate then runs on the canonical `toolName` — needed because Copilot parses the declarative `matcher` field but does NOT apply it (web-confirmed), so filtering must be recomputed in-script.

**Event mapping per harness:**

| Canonical event | Claude source | Copilot source | Hooks using it |
|---|---|---|---|
| SessionStart | `SessionStart` | `SessionStart` (auto `/session-start`) | session-start-memory |
| UserPromptSubmit | `UserPromptSubmit` | `UserPromptSubmit` (Preview; `additionalContext` not guaranteed) | memory-capture (reminder) |
| PreToolUse | write-time hook + `matcher` (GA, hard) | `PreToolUse` + matcher-in-script + deny (Preview, best-effort) | icea-floor, check-settings-secrets, script-review-gate, context-budget-*, artifact-write |
| PostToolUse | `PostToolUse` | `PostToolUse` | memory-log, graph-stale-detect |
| (git pre-commit) | `.git/hooks/pre-commit` | `.git/hooks/pre-commit` | findings-gate-precommit, check-settings-secrets --staged |

---

## Auth & Security (adapted — the hooks ARE the enforcement layer, asymmetrically)

There is no user auth in a hook layer; the security property is **the integrity of the governance gate itself**, and per the revised ICEA (#6) the model is **asymmetric** — each harness enforces where it is strong, and this spec states honestly which layer is the hard line on each.

- **Claude = write-time PREVENTION (the Claude HARD gate — GA, unchanged):** `icea-floor` `exit 2`- blocks a Write/Edit with no approved ICEA before code is written. The other eight hooks retain their 3.x GA semantics. This story must not weaken any of them — AC-NF4 parity test guards it. This is the Claude hard line, byte-for-byte.
- **Copilot client hooks = BEST-EFFORT (NOT the Copilot hard line):** the projected `.github/hooks` `PreToolUse` deny returns `exit 2` and DOES hard-deny **where it fires**, but it is **Preview**, its events are **not guaranteed to deliver on every Copilot surface**, and it **times out fail-OPEN**. So it is explicitly best-effort authoring-time assistance, paired with read-only gate agents that surface the verdict advisorily. It is stamped as a *client best-effort* gate point (Story 7 AC-NF5) and is NEVER counted as the Copilot hard guarantee.
- **The Copilot HARD gate is the CI `ai-gate` REQUIRED status check** on a protected branch (un-bypassable at merge — you cannot `--no-verify` a required check). It is harness-independent and is built by **Story 6** (logic) + distributed with branch-protection setup by **Story 8**. It is the real Copilot backstop and is **out of scope for this story** — this story only produces the best-effort Copilot client layer and defers the hard guarantee to that gate.
- **Secret handling (now cross-harness):** `check-settings-secrets` runs on both harnesses AND inspects each harness's committed config (Claude `.claude/settings.json`; Copilot `.vscode/settings.json`, `.vscode/mcp.json`, committed `.github/**` config) via `guarded-paths.cjs`. The shim never echoes `raw` input containing `.env`/`settings.local.json`/PAT into agent-visible output. Hook scripts are hash-verified against `.hashes` before running (existing 3.x safety, preserved).
- **Memory as untrusted input:** the SessionStart injector treats `memory/MEMORY.md` as data, not instructions — it injects content for context only and grants no executable authority (full memory-untrusted hardening is Story 6; this story must not introduce an execution path from memory). `memory-capture` only emits a reminder — it neither reads nor executes memory content. The harness-neutral guard change does not alter this: it only changes *when* the reminder activates, not what it can do.
- **Hook double-registration closure (Copilot) — the F1.2 fix:** per the revised ICEA (AC-F5), Copilot under 1.109 ALSO discovers `.claude/settings.json` hooks, and the two `.vscode` scoping keys for skills/rules (`chat.agentSkillsLocations`, `chat.instructionsFilesLocations`) do NOT disable hook discovery. Left unaddressed, a both-harness Copilot session would fire every hook twice (once via `.claude/settings.json`, once via `.github/hooks`). The fix is the third scoping key, **`chat.hookFilesLocations`**, set to `false` for the three default-Claude hook paths (`.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`). Story 5 emits the `.vscode/settings.json` file; this story specifies those hook keys and coordinates so that `.github/hooks` is the **sole** Copilot registration. **Because of known suppression bugs (#297538, #299820), the closure must be verified by ACTUAL LOAD — the Copilot Hooks output channel showing hooks registered only from `.github/hooks` — not by trusting the flag alone.**

**Note — icea-floor malformed stdin, KEPT fail-OPEN (AC-NF4 parity, NOT a change):** 3.x `icea-floor.cjs` **FAILS OPEN** on malformed stdin — `catch(e){ process.exit(0); }` allows the write when the payload cannot be parsed. AC-NF4 demands byte-for-byte 3.x parity on Claude, so this behaviour is **retained exactly** — it is NOT flipped to fail-closed and is NOT smuggled under "unchanged": it is called out explicitly here as the intended, documented Claude behaviour. Rationale: flipping malformed-stdin handling would break AC-NF4 parity for a case already backstopped by the Copilot-side CI `ai-gate` at merge and irrelevant to the Claude write-time path (a malformed payload carries no write to gate). N-U4 asserts fail-OPEN (`exit 0`) as the documented, intended behaviour; the well-formed-but-unapproved block path (N-U1, `exit 2`) is the Claude hard-gate guarantee. If a future story wants fail-closed, it must be its own flagged AC.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Copilot Preview `PreToolUse` not delivered on a surface | The best-effort client hook simply does not fire; the read-only gate agent still surfaces the verdict advisorily; the Copilot HARD gate (CI `ai-gate` required check, Story 6/8) catches the write at merge. A non-firing client hook is NOT treated as a hard pass — the artifact carries a best-effort gate-point stamp so the miss is auditable. |
| Copilot `PreToolUse` fires but times out | Copilot **fails OPEN** by design (Preview behaviour) — this is precisely why the client hook is best-effort and NOT the Copilot hard line; the CI required check is the backstop. |
| Copilot `UserPromptSubmit` `additionalContext` not guaranteed (CLI/cloud) | The memory *reminder* via the event is best-effort; actual capture is done by the baked-in critic/implement skill writes regardless of the event. `session-start-memory` still injects committed `memory/MEMORY.md`. |
| Unknown/unmapped Copilot tool id reaches the shim | Passed through untranslated to the matcher (fail-visible): a matcher keyed on `Write`/`Edit` will not match, but the tool name is logged so a new Copilot tool is caught in review rather than silently bypassing the gate. |
| Hook script hash mismatch vs `.hashes` | Hook does not run; the harness is warned (existing 3.x behaviour, preserved on both). |
| `memory/MEMORY.md` missing or empty at SessionStart | Injector emits nothing and exits `0` — session proceeds; not an error. |
| Committed config file in the guarded SET absent on a given harness | `check-settings-secrets` skips that path (nothing to scan) and continues over the rest of the SET; absence is not an error. |
| Malformed stdin JSON into `icea-floor` (Claude) | **FAILS OPEN** (`exit 0`, allow) — the documented, retained 3.x parity behaviour (see Auth & Security). The unapproved-write hard block (N-U1) is unaffected. |
| Malformed stdin JSON into a non-floor hook | `hook-input.cjs` returns a safe canonical object with nulls and `raw` intact; the shim exits `0` (allow) to avoid blocking on parse failure. |
| `chat.hookFilesLocations` set but Copilot still registers `.claude` hooks (suppression bug #297538/#299820) | Detected by the actual-load verification step (Copilot Hooks output channel); provisioning surfaces a warning that the closure did not take effect rather than assuming it did. |
| Claude declarative `matcher` and Copilot matcher-in-script disagree | Treated as a defect — the parity/behavioural eval (Story 7) asserts the same tool set matches on both; divergence trips CI. |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F7 (compat shim) | compat-shim + tool-name-map + hook-input normaliser (snake_case<->camelCase); matcher-in-script for the PreToolUse hooks (Copilot parses-but-does-not-apply matchers) | 1.5 |
| AC-F7 (relocate 9 hooks + cross-harness inspection) | relocate 9 hook logics to `Shared/hooks/**`; `.ps1`->`.cjs` for memory-capture/memory-log; parameterise check-settings-secrets guarded-path SET (both harnesses); neutralise memory-capture guard; keep Claude Tier-A hooks byte-for-byte | 1.5 |
| AC-F7 + AC-F5 (Copilot best-effort projection + double-reg closure) | `.github/hooks/hooks.json` (sole Copilot registration, best-effort) + cloud-hooks + read-only gate agents + `PreToolUse` deny wiring; specify `chat.hookFilesLocations` keys for Story 5's `.vscode/settings.json`; actual-load verification step | 1 |
| AC-F7 (memory + artifact-write producer) | SessionStart memory injector on both harnesses; `artifact-write.cjs` audit-stamp hook-in (gate-point field; Story 7 consumer); artifact-paths.md contract reader | 1 |
| AC-NF4 (parity) | Claude Tier-A parity test; assert `icea-floor` `exit 2` unchanged on well-formed unapproved Write; assert malformed-stdin fail-OPEN retained | (within above) |
| **Total** | | **5** |

**Total SP: 5** **Type: STORY** — a single shippable slice (hooks + memory inspect and run on both harnesses, Claude hard + Copilot best-effort) delivering independent value; depends on Story 2's projection engine and coordinates the `.vscode` scoping with Story 5, but is testable and mergeable on its own. Does not exceed the <=5 SP shippable-slice rule, so no sub-decomposition is required. The Copilot HARD gate (CI `ai-gate` required check) is a separate slice owned by Story 6/8.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] All files in Files Changed created/relocated as specified
- [ ] No hardcoded secrets, connection strings, or credentials in any hook or shim
- [ ] No `console.log` / diagnostic output in the hook production paths (hooks emit only their contract output)
- [ ] Claude Tier-A hooks unchanged byte-for-byte from 3.x on the well-formed paths; `icea-floor` malformed-stdin fail-OPEN retained and documented (NOT flipped)
- [ ] Copilot client hooks are wired as BEST-EFFORT (Preview, timeout-fail-open) and NOT presented as the Copilot hard gate; the hard gate is deferred to the CI `ai-gate` (Story 6/8)
- [ ] `check-settings-secrets` inspects the full per-harness guarded-path SET (Claude + Copilot), not a single hard-coded path
- [ ] `memory-capture` guard is harness-neutral (`.aidev/manifest.json` or `memory/` presence), not `.claude/dream-init-state.json`
- [ ] `hook-input.cjs` reconciles snake_case `tool_input.file_path` and camelCase `filePath`
- [ ] `artifact-write.cjs` records the stamp fields Story 7's AC-NF5 consumes (incl. gate-point)
- [ ] `.github/hooks` is the sole Copilot hook registration; the `chat.hookFilesLocations` keys (`.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` -> `false`) are specified for Story 5's `.vscode/settings.json`
- [ ] Double-registration closure verified by ACTUAL LOAD (Copilot Hooks output channel), not the flag alone (known bugs #297538/#299820)
- [ ] `.ps1`->`.cjs` relocation of `memory-capture`/`memory-log` preserves existing behaviour
- [ ] Each shared hook has a `// DECISION:` comment where the harness-branch or fail-open/closed choice is non-trivial

**Quality**
- [ ] All positive and negative unit tests pass — see Test Cases
- [ ] Integration tests pass: each of the 9 hooks fires AND inspects the right inputs on both harnesses via the shim
- [ ] AC-NF4 parity test green: Claude Tier-A `exit 2`-blocks a well-formed un-approved Write, pre and post 4.x
- [ ] Regression verified: 3.x Claude hook behaviour unchanged when Copilot paths are not exercised (including malformed-stdin fail-open)
- [ ] SessionStart injects `memory/MEMORY.md` on both harnesses; missing-memory case exits `0`
- [ ] check-settings-secrets blocks a secret in a Copilot-side committed config file (negative test)
- [ ] Copilot fires each hook exactly once (no double-registration) — confirmed via the Hooks output channel

**Review readiness**
- [ ] PR title format: `[ADO-4000] Hook compat shim + memory on both harnesses — Story 4`
- [ ] PR description maps each changed file to its ACs (reference AC Coverage Matrix)
- [ ] ICEA + this tech spec committed in the same branch

### Reviewer Checklist

- [ ] `icea-floor` on Claude still fails **closed** (`exit 2`) on a well-formed un-approved Write; malformed stdin still fails **open** (`exit 0`) — the documented parity behaviour, NOT smuggled as a change (AC-NF4).
- [ ] Claude Tier-A hooks are byte-for-byte unchanged — the Claude hard gate is preserved (AC-NF4).
- [ ] Copilot client hooks are wired BEST-EFFORT and clearly NOT the Copilot hard line; the Copilot hard guarantee is the CI `ai-gate` required check (Story 6/8), referenced not re-implemented here (AC-F7).
- [ ] `check-settings-secrets` INSPECTS both `.claude/settings.json` and the Copilot-side committed config (`.vscode/settings.json`, `.vscode/mcp.json`, `.github/**`) — "runs on both" means inspects both.
- [ ] `memory-capture` activates on a Copilot-only repo (harness-neutral guard), and is confirmed a reminder-injector, NOT a memory writer.
- [ ] `hook-input.cjs` reconciles snake_case `tool_input.file_path` with camelCase `filePath` (web-confirmed necessary).
- [ ] matcher-in-script matches the **same tool set** as the Claude declarative `matcher` — needed because Copilot parses-but-does-not-apply the declarative matcher.
- [ ] Tool-name map passes unknown Copilot tools through **untranslated and logged** (fail-visible), never silently drops them.
- [ ] `.github/hooks` is the sole Copilot hook registration; the `chat.hookFilesLocations` keys are specified and the closure is verified by ACTUAL LOAD (Copilot Hooks output channel), not the flag alone (#297538/#299820).
- [ ] `artifact-write.cjs` exists and records the stamp fields Story 7 consumes, including the gate-point (producer obligation met).
- [ ] Graph/arch/memory paths are read via the shared `artifact-paths.md` contract, not hard-coded — no clobber with Story 3a.
- [ ] SessionStart injector grants `memory/MEMORY.md` **no executable authority** (data only).
- [ ] All 9 hooks' DECISION LOGIC is authored **once** as L1 in `Shared/hooks/**`; the native `Claude/hooks/` and `Copilot/hooks/` layers CONSUME it (never re-author it) — the CI guardrail (Story 2) fails a PR that re-forks an L1 standard into `Copilot/`. Hooks are native per harness (NOT mechanically projected — #7), but the logic is not duplicated.
- [ ] The B1–B7-classifying hook READS the L1 taxonomy (single canonical location) rather than bundling its own copy — consumes L1, does not re-author it.
- [ ] Hook scripts remain hash-verified against `.hashes` before running on both harnesses.

---

## Open Questions

None open. The Copilot Preview event-delivery uncertainty is a **known assumption** from the ICEA (UserPromptSubmit `additionalContext` not guaranteed on CLI/cloud; `PreToolUse` Preview + timeout-fail- open), handled by design here (Copilot client hooks are best-effort by construction, the CI `ai-gate` required check is the hard backstop, and capture falls back to the baked-in skill writes). The `chat.hookFilesLocations` suppression bugs (#297538/#299820) are handled by the actual-load verification step. Neither blocks SAVE TECH.

---

## Request Flow (hook fire path on each harness)

```
CLAUDE CODE (write-time PREVENTION — the Claude HARD gate, GA, unchanged):
  developer triggers Write/Edit
    -> .claude/settings.json hooks block, PreToolUse + declarative matcher
       -> matcher selects Write/Edit
          -> projected Shared/hooks/icea-floor.cjs (via compat-shim, harness=claude)
             -> hook-input.cjs normalises stdin (snake_case/camelCase reconciled)
             -> malformed stdin? -> exit 0 (FAIL OPEN, documented parity behaviour)
             -> shared floor logic: approved ICEA on disk?
                -> NO  -> exit 2  (WRITE BLOCKED — Claude hard line, AC-NF4)
                -> YES -> exit 0  (write proceeds)

GITHUB COPILOT (client hooks = BEST-EFFORT; NOT the Copilot hard line):
  developer triggers edit tool
    -> .github/hooks/hooks.json (SOLE Copilot registration) -> compat-shim (harness=copilot)
       -> hook-input.cjs normalises stdin; tool-name-map: copilot edit -> canonical "Write"
          -> matcher-in-script selects Write/Edit  (Copilot parses-but-does-not-apply the declarative matcher)
             -> shared floor logic: approved ICEA on disk?
                -> NO  -> exit 2 + stdout { decision: "deny", reason }  (hard-denies WHERE it fires)
                -> YES -> exit 0 (allow)
    (best-effort caveats) event may NOT deliver on some surfaces; on timeout Copilot FAILS OPEN
    (in parallel) read-only gate agent surfaces the ICEA-floor verdict as advisory context
    -> THE COPILOT HARD GATE is the CI ai-gate required status check (Story 6/8) at MERGE:
       a PR that fails ai-gate cannot merge (branch protection), independent of any client hook

SECRET GUARD (both harnesses — inspects each harness's committed config):
  write / staged commit
    -> check-settings-secrets via guarded-paths.cjs
       -> Claude:  scan .claude/settings.json
       -> Copilot: scan .vscode/settings.json + .vscode/mcp.json + committed .github/** config
       -> secret found? -> block (Claude exit 2 / staged exit 1)

SESSION START (both harnesses):
  session opens
    -> Claude SessionStart / Copilot SessionStart (auto /session-start)
       -> Shared/hooks/session-start-memory.cjs
          -> read committed memory/MEMORY.md (data only)
             -> inject as session context (both harnesses)   [empty/missing -> exit 0, no-op]

MEMORY REMINDER (both harnesses — reminder-injector, NOT a writer):
  developer prompt
    -> UserPromptSubmit -> memory-capture.cjs (harness-neutral guard)
       -> emit additionalContext nudge (Claude: reliable; Copilot: only if additionalContext delivered)
    -> actual memory CONTENT written by baked-in critic/implement skill steps (not by any hook)

DOUBLE-REGISTRATION CLOSURE (Copilot, both-harness repo):
  .vscode/settings.json (emitted by Story 5) sets
    chat.hookFilesLocations { .claude/settings.json:false, .claude/settings.local.json:false, ~/.claude/settings.json:false }
    -> Copilot registers hooks ONLY from .github/hooks (no .claude double-fire)
    -> VERIFY BY ACTUAL LOAD: Copilot Hooks output channel (not the flag alone; bugs #297538/#299820)
```

---

## Rollback

**Schema migrations:** None — this story is code/config only; `memory/` is additive and never rewritten by the injector.

**Story-level rollback procedure:**
1. This story is a shippable slice on `feature/4.x-multi-harness`; rollback = revert the story's commit range. Because `Shared/hooks/**` is the single source, the projected `.claude/settings.json` hooks block and `.github/hooks/` are regenerated by re-running provisioning against the reverted `Shared/`.
2. The frozen **`v3.13.0` git tag** remains the Claude-only fallback — the 3.x hooks in `.claude/settings.json` are recovered by re-provisioning from that tag; no data is lost (hooks are stateless).
3. Copilot-only rollback: remove `.github/hooks/`, `.github/cloud-hooks/`, and the read-only gate agents via `setup-teardown --harness=copilot`, and drop the `chat.hookFilesLocations` keys from `.vscode/settings.json` (coordinated with Story 5) — this never touches user `.github/` workflows/CODEOWNERS or `memory/`.
4. Verify after rollback: run the AC-NF4 parity test — Claude Tier-A gate still `exit 2`-blocks a well-formed un-approved Write, and malformed stdin still fails open. The Copilot HARD gate (CI `ai-gate` required check) is unaffected by this story's rollback — it lives in Story 6/8.

---

## Handover

### QA Team
**What was added:** the plugin's 9 existing hooks now run AND inspect the right inputs on **both** Claude Code and GitHub Copilot via a compat shim; on Claude they remain the GA write-time HARD gate; on Copilot the client hooks are BEST-EFFORT (Preview, timeout-fail-open) and the actual Copilot hard gate is the CI `ai-gate` required check (Story 6/8, not this story). `check-settings-secrets` now scans Copilot-side committed config too; `memory-capture` (a reminder-injector, not a writer) activates on a Copilot-only repo; and a NEW SessionStart injector loads committed `memory/MEMORY.md` on both harnesses. Entry points and negative tests are in **Test Cases**. **How to test manually:** provision a scratch repo for both harnesses; on Claude, attempt a Write with no approved ICEA (expect `exit 2` hard block); on Copilot, trigger the edit tool with no approved ICEA (expect a `PreToolUse` deny WHERE it fires + advisory gate agent — but treat a non-fire as best-effort, not a hard pass); put a fake secret in `.vscode/settings.json` and confirm the guard blocks it; open a fresh session on each and confirm `memory/MEMORY.md` content appears; open the Copilot Hooks output channel and confirm hooks register only from `.github/hooks` (no `.claude` double-registration). **Regression risk:** Claude Tier-A hard gate and the existing 9 hooks must be unchanged (including the malformed-stdin fail-open) — run the AC-NF4 parity test. **Test data:** synthetic only; a repo with and without an approved ICEA fixture, a populated vs empty `memory/MEMORY.md`, and a secret-bearing Copilot config fixture.

### DevOps / Platform Team

| Item | Detail |
|---|---|
| No new secrets | hooks use no credentials; `check-settings-secrets` now guards committed `settings.json` (Claude) AND `.vscode/settings.json`/`.vscode/mcp.json`/`.github/**` config (Copilot) |
| Generated outputs | `.claude/settings.json` hooks block, `.github/hooks/hooks.json` (sole Copilot registration, best-effort), `.github/cloud-hooks/hooks.json`, `.github/agents/gate-*.agent.md` are **emitted** by provisioning — do not hand-edit. Edit the NATIVE harness layer (`Claude/hooks/`, `Copilot/hooks/`) for harness wiring, and `Shared/hooks/**` for the shared L1 decision logic both consume |
| Double-registration | on both-harness repos, Copilot hooks fire ONLY via `.github/hooks`; the `.vscode/settings.json` `chat.hookFilesLocations` keys (emitted by Story 5) disable `.claude` hook discovery for Copilot — the skill/rule scoping keys alone do NOT do this. Verify by ACTUAL LOAD (Copilot Hooks output channel), not the flag (bugs #297538/#299820) |
| Copilot client hooks are BEST-EFFORT | `hooks.json` events are Preview; some may not deliver on CLI/cloud, and `PreToolUse` fails OPEN on timeout — by design the client layer is best-effort. **The Copilot HARD gate is the CI `ai-gate` required status check on a protected branch (Story 6/8), not these client hooks.** |
| Hook hash verification | hooks remain hash-verified against `.hashes` on both harnesses |

### Future Developer — Follow-on Work
- To add a new hook: author its DECISION LOGIC once in `Shared/hooks/` (L1), then wire it NATIVELY in each harness layer — `Claude/hooks/` (registered via `.claude/settings.json`, declarative matcher) and `Copilot/hooks/` (registered via `hooks.json`, matcher-in-script) — each CONSUMING the L1 logic. Re-run provisioning to emit `.claude/settings.json` and `.github/hooks/hooks.json`. Do NOT re-author the L1 logic inside a harness layer — the CI guardrail (Story 2) fails a PR that re-forks an L1 standard into `Copilot/`.
- If a new Copilot tool appears, add its mapping to `tool-name-map.cjs` (unknown tools pass through untranslated + logged until mapped).
- The gate-point **assurance stamp** on hook output is formalised in Story 7 (AC-NF5), which CONSUMES the `artifact-write.cjs` hook-in produced by this story.
- The Copilot HARD gate — the CI `ai-gate` required status check that is the real Copilot backstop — is built in Story 6 (logic) and distributed with branch-protection setup by Story 8; the client hooks in this story defer to it and never claim to be it.
- If a new committed config file becomes secret-bearing on either harness, add it to `guarded-paths.cjs`.

---

## Test Cases

> Every in-scope AC gets a positive and a negative unit test; integration tests cover the fire path on
> each harness end-to-end. AC-NF4 (parity) has an explicit verification method.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `hook-input.cjs` normalise (claude) | Claude PreToolUse stdin JSON, Write tool | canonical `{harness:"claude",event:"PreToolUse",toolName:"Write",...}` | AC-F7 |
| P-U2 | `tool-name-map.cjs` | Copilot edit-tool id | canonical `"Write"` | AC-F7 |
| P-U3 | `compat-shim.cjs` matcher-in-script | canonical `toolName:"Write"`, matcher = Write/Edit | matches (predicate true) | AC-F7 |
| P-U4 | `session-start-memory.cjs` | populated `memory/MEMORY.md` | injects file content as session context; `exit 0` | AC-F7 |
| P-U5 | `icea-floor.cjs` (claude) | Write with approved ICEA on disk | `exit 0` (allow) — unchanged from 3.x | AC-NF4 |
| P-U6 | `check-settings-secrets.cjs` (copilot) | write to `.vscode/settings.json`, clean content | `exit 0` (allow) — the Copilot path IS inspected | AC-F7 |
| P-U7 | `memory-capture.cjs` (copilot-only repo) | `.aidev/manifest.json` present, no `.claude/dream-init-state.json` | emits `additionalContext` reminder (does NOT no-op) | AC-F7 |
| P-U8 | `hook-input.cjs` normalise (snake_case) | stdin with `tool_input.file_path` (snake_case) | canonical `filePath` populated (reconciled from snake_case) | AC-F7 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `icea-floor.cjs` (claude) | well-formed Write, NO approved ICEA | `exit 2` (Claude hard block) | AC-NF4 |
| N-U2 | `icea-floor.cjs` (copilot, best-effort) | edit tool, NO approved ICEA, event fires | `exit 2` + stdout `{decision:"deny"}` WHERE it fires; stamped best-effort client gate-point | AC-F7 |
| N-U3 | `tool-name-map.cjs` | unknown Copilot tool id | passes through untranslated + logged (fail-visible, not dropped) | AC-F7 |
| N-U4 | `icea-floor.cjs` (claude) | malformed stdin JSON into the floor hook | **`exit 0` (FAIL OPEN)** — the documented, retained 3.x parity behaviour; NOT flipped to fail-closed (see Auth & Security callout) | AC-NF4 |
| N-U5 | `session-start-memory.cjs` | missing/empty `memory/MEMORY.md` | no output, `exit 0` (no-op, not an error) | AC-F7 |
| N-U6 | `compat-shim.cjs` matcher-in-script | canonical `toolName:"Read"`, matcher = Write/Edit | does NOT match (Read not gated) | AC-F7 |
| N-U7 | `check-settings-secrets.cjs` (copilot) | secret-shaped value in `.vscode/settings.json` (write-time) | block (`exit 2`) — the Copilot config is actually scanned, not skipped | AC-F7 |
| N-U8 | `check-settings-secrets.cjs --staged` (copilot) | secret staged in `.vscode/mcp.json` | block (`exit 1`) — `git show :<path>` iterates the guarded SET, not the single hard-coded path | AC-F7 |
| N-U9 | Copilot `PreToolUse` NOT delivered / times out | un-approved Write on a surface where the event does not fire | client hook does NOT block (best-effort, fail-open) — NOT a hard pass; the CI `ai-gate` required check (Story 6/8) is the hard backstop | AC-F7 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Each of the 9 hooks fires on Claude | Provision scratch repo (claude); trigger each hook's event | all 9 fire via the shim; behaviour matches 3.x (Claude hard gate intact) | AC-F7 |
| INT-2 | Each of the 9 hooks fires AND inspects on Copilot | Provision scratch repo (copilot); trigger each event | all 9 fire via the shim; check-settings-secrets scans Copilot config; PreToolUse hooks emit best-effort deny where they fire | AC-F7 |
| INT-3 | Tier-A parity on Claude, pre vs post 4.x | Well-formed un-approved Write on 3.x baseline, then on this story's build | both `exit 2`-block — identical; malformed stdin fails open on both | AC-NF4 |
| INT-4 | SessionStart injects memory on both | Populate `memory/MEMORY.md`; open a fresh session on each harness | file content appears as session context on both | AC-F7 |
| INT-5 | Copilot Preview event not delivered | Simulate a surface where `PreToolUse` is skipped | client hook is best-effort (no block); the CI `ai-gate` required check (Story 6/8) is the hard backstop; artifact carries best-effort gate-point stamp; no false hard-pass | AC-F7 |
| INT-6 | Memory capture fallback | UserPromptSubmit `additionalContext` not delivered on Copilot | reminder skipped; actual capture still occurs via the baked-in critic/implement skill write | AC-F7 |
| INT-7 | No double-registration on Copilot | Provision both harnesses; set `chat.hookFilesLocations` keys; trigger a Write in Copilot; open the Copilot Hooks output channel | each hook registers/fires exactly ONCE (via `.github/hooks`), not twice via `.claude/settings.json`; confirmed by ACTUAL LOAD not the flag (bugs #297538/#299820) | AC-F7, AC-F5 |

> NF AC verification:
> AC-NF4 (Claude 3.x parity): verified by `Shared/eval/parity/claude-tier-a.test.cjs` (INT-3 / N-U1) —
> asserts the Claude `icea-floor` hook `exit 2`-blocks a well-formed un-approved Write on both the frozen
> `v3.13.0` baseline and this story's build, and that malformed stdin still fails OPEN on both (the one
> deliberate, documented behaviour retained — see Auth & Security). The Claude hard gate is unchanged.
> AC-F5 (hook double-registration closure): verified by INT-7 — `chat.hookFilesLocations` keys plus
> ACTUAL-LOAD confirmation via the Copilot Hooks output channel (not the flag alone, per bugs
> #297538/#299820). The `.vscode/settings.json` file itself is emitted by Story 5.

---

### Revision Log
2026-08-13 — Story 4 tech spec drafted from the saved Epic ICEA (AC-F7 owned) + Epic Tech Spec.
2026-08-13 #2 — Re-revised to match revised ICEA (Revision Log 2026-08-13 #4; revised AC-F7/AC-NF4).
Applied: (1) `check-settings-secrets` guarded-path SET parameterised to inspect Copilot-side committed
config (`.vscode/settings.json`, `.vscode/mcp.json`, `.github/**`) via new `guarded-paths.cjs`, with a
Copilot negative test (N-U7/N-U8). (2) `memory-capture` guard neutralised to a harness-neutral signal
(P-U7). (3) Clarified `memory-capture` is a REMINDER-injector, NOT a writer; the NEW
`session-start-memory` is the content injector. (4) Called out the icea-floor malformed-stdin behaviour
and adopted KEEP fail-OPEN for AC-NF4 parity (N-U4). (5) Added NEW `artifact-write.cjs` PRODUCER for
Story 7 AC-NF5. (6) Consume the shared `artifact-paths.md` contract with Story 3a. (7) Closed the
`.claude/settings.json` hook double-registration; `.github/hooks` sole Copilot registration; added INT-7.
2026-08-14 #3 — Re-revised to the ASYMMETRIC enforcement model (ICEA Revision Log 2026-08-14 #6 —
"Enforcement model (asymmetric)" + revised AC-F7/AC-F5/AC-NF5). Applied: (1) Reframed the Copilot hook
layer as **BEST-EFFORT** — `PreToolUse` `exit 2` hard-denies WHERE it fires but is Preview + timeout-
fail-open, so explicitly NOT the Copilot hard line; stated plainly that the Copilot HARD gate is the CI
`ai-gate` required status check owned by Story 6 (logic) / Story 8 (distribution + branch protection),
out of scope here. Removed the "Tier B soft = the Copilot gate" framing throughout (Overview, Auth &
Security, API output contract, Error Handling, Request Flow, Handover). (2) Kept Claude Tier-A hooks
byte-for-byte UNCHANGED as the Claude hard gate, including `icea-floor` fail-OPEN-on-malformed-stdin for
AC-NF4 parity. (3) Added the F1.2 fix — specified the third scoping key `chat.hookFilesLocations`
(`.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` -> `false`) to close
`.claude/settings.json` hook double-registration on Copilot; `.vscode/settings.json` emitted by Story 5
(coordinated), verify-by-ACTUAL-LOAD via the Copilot Hooks output channel (bugs #297538/#299820), added
AC-F5 to scope + coverage matrix + INT-7 + N-U9. (4) Kept intact: the snake_case/camelCase hook-input
normaliser (web-confirmed necessary; added P-U8), the matcher-in-script shim (Copilot parses-but-does-
not-apply matchers — web-confirmed), the NEW `artifact-write.cjs` producer for Story 7 AC-NF5 (now
stamps gate-point per AC-NF5 asymmetric framing), and the memory SessionStart injector + neutral
memory-capture guard. (5) Aligned the AC Coverage Matrix and reviewer/DoD/handover to AC-F7 (asymmetric).
2026-08-14 #4 — Re-revised to the L1/L2/L3 shared-content / NATIVE per-harness model (ICEA Revision
Log 2026-08-14 #7 — "Repository structure & layering (L1/L2/L3)" + retired mechanical projection; #8
prompt-artifact versioning; source-ICEA pointer bumped #6->#8). Applied: (1) Reframed the governing
pattern from "author-once, mechanically-project-per-harness" to **shared L1 content core + NATIVE
per-harness hook layers** — the Claude hooks live in `Claude/hooks/` (native, the write-time hard
gate, ≈v3.13 unchanged), the Copilot hooks live in `Copilot/hooks/` (native, best-effort); the
Copilot side is AUTHORED NATIVELY, NOT mechanically projected from the Claude shape (#7 retired the
delta-map / per-skill projection / runtime `$PLUGIN_DIR` bridge). (2) Both native hook sets CONSUME
the shared L1 (hook decision logic, B1–B7 taxonomy the classifying hook reads, compat primitives —
shim / matcher-in-script / tool-name map / input normaliser); a CI guardrail (Story 2) fails any PR
that re-authors an L1 standard in `Copilot/`. (3) Re-scoped the Story-2 dependency from a "projection
engine" to the "L1 content core + CI guardrail". (4) Updated Files Changed (added native
`Claude/hooks/` + `Copilot/hooks/` rows; `.claude/settings.json`/`.github/hooks/hooks.json` reworded
as native-emitted, not projected; `provision.cjs` reworded native-emit), Future-Developer,
DevOps-handover, and reviewer checklist to the L1/native framing. (5) KEPT unchanged the asymmetric
enforcement (#6): Claude write-time hard gate incl. `icea-floor` fail-OPEN-on-malformed-stdin for
AC-NF4 parity; Copilot best-effort `PreToolUse` (`exit 2` hard-denies WHERE it fires, timeout
fail-open); `chat.hookFilesLocations` suppression + verify-by-actual-load; the snake_case/camelCase
hook-input normaliser; matcher-in-script; the `artifact-write.cjs` producer; the neutral
memory-capture guard; the SessionStart memory injector.
