# Story 1 — Skill self-containment spike (ADO-4000 · child ADO-4001)

Disposable proof for **AC-F1**: one L1 content item (`icea-status`) is **consumed natively by both
harnesses**, **self-contained**, with **no runtime plugin-dir** anywhere in the exercised path. This
proves the two structural properties the L1/L2/L3 design rests on (ICEA #7). It deliberately does **NOT**
close D-4 — `icea-status` is a best-case pilot (no executable `$PLUGIN`-dir read, no `scripts/*` exec, no
sibling-skill invocation); the harder shapes are proven on Story 2's skills.

## Files
- `Shared/skills/icea-status/SKILL.md` — the L1 content, self-contained (the two prose plugin-dir
  pointers in the live skill were neutralised to reference the shared L1 content core).
- `Claude/skills/icea-status/SKILL.md` — native placement for Claude (project `.claude/skills`).
- `Copilot/skills/icea-status/SKILL.md` — native placement for Copilot (`.github/skills`; frontmatter
  `name`/`description` added for discovery).
- `check-residual-plugindir.mjs` — the AC-F1 mechanical guard.

> **`Shared/` is the SOLE authored source (L1).** The `Claude/` and `Copilot/` copies are **generated**
> from it (marked "DO NOT EDIT") and are byte-identical here because `icea-status` is pure content with no
> harness-specific L2/L3. Per-harness placement is *required* — Claude Code reads skills ONLY from
> `.claude/skills` and Copilot's discovery is scoped per-path — so a single shared file can't serve both;
> Story 2 automates the generate-from-L1 step + a CI guardrail (no projection engine/delta-map — retired #7).

## How to run the proof

### Part A — mechanical (automatable; I run this)
```
node spike/story-1/check-residual-plugindir.mjs
```
**Expect:** three `OK:` lines + `PASS — AC-F1 residual-token guard`, exit 0. This proves no runtime
plugin-dir token survives in any placed copy.

### Part B — dual-run (hands-on; you run this in a scratch repo)
1. **Claude Code:** copy `Claude/skills/icea-status/` into a project's `.claude/skills/`, open it in
   Claude Code, and run `STATUS ADO-<something>`. Expect the status report to render (skill discovered +
   executed) with no missing-file/path error.
2. **VS Code Copilot ≥1.109:** copy `Copilot/skills/icea-status/` into `.github/skills/`, trust the
   workspace, open Copilot Chat, `/skills` → confirm `icea-status` is listed, then invoke it. Expect it to
   discover + run.
3. Record the result:
```
H1 dual-run: Claude = PASS/FAIL · Copilot = PASS/FAIL — note:
```

## Pass/fail for Story 1 (AC-F1)
- **PASS** = Part A exit 0 AND Part B both harnesses run the skill with no plugin-dir/path failure.
- **PARTIAL/FAIL** = record which harness failed and how → triggers a `REVISE` on the epic if structural.

## Scope guard
This spike proves native-consumption mechanics + Copilot discovery/execution ONLY. D-4 (the
native-authoring threshold for orchestrating skills) stays gated on Story 2's harder skills
(`icea-feature`, `migration`).
