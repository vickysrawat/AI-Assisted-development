# 0059 — Scored stack-key detection & rule deployment (with runtime-generation resolution)
Status: Accepted · Date: 2026-09-01
Governs: `scripts/stack-signals.cjs` · `scripts/repo-detect.cjs` · `scripts/setup-init-bootstrap.cjs` (stepDeployRules) · `_project-deploy/rules/*.md` · `skills/setup-status`/`setup-sync` · `scripts/setup-teardown.cjs`

> **Extends ADR 0058** (modern-format detection resilience) — same "detection is one source of
> truth" theme, now generalised from repo_type to per-stack scored keys + generation.

## Problem

Rule deployment mis-fired on two axes. **Cross-stack:** a .NET 10 API received `css`/`javascript`
rules because the deploy-time glob walk didn't prune vendored/build dirs (`wwwroot/lib`, `bin`),
so bundled Bootstrap/jQuery/Swagger assets registered as first-party signals. **Intra-stack
generation:** it also received `ado-net-legacy`/`csharp-framework48` (.NET Framework rules)
because detection had no notion of runtime generation — `ado-net-legacy` keyed on `**/*.cs`
(every C# repo), `csharp-framework48` on any `**/*.csproj`. Compounding causes: detection logic
was duplicated (repo-detect ladder **and** each rule's `detect:` frontmatter, drifting);
selection was boolean (no confidence); `repo_type` was never used; `detected_stacks` was
overwritten by an 8-entry map.

## Decision

**The detector emits canonical, scored `stack_key`s; deployment is a dumb threshold + convention
lookup + hash-tracked copy + audit manifest.**

1. **Single source of truth** — `scripts/stack-signals.cjs` holds the canonical
   signal→stack_key table (files/deps/exclusions, `implies` capability keys, generation gates,
   confidence tiers) + a pure `scoreStacks()` + a pruned `gatherProjectSignals()` +
   `resolveGeneration()`. Rule files carry **no `detect:` frontmatter** (only `paths:`).
2. **Scored detection** — `repo-detect.cjs` emits a `detection` object per category with
   `{name, stack_key, confidence 0–1, evidence, generation}`. `repo_type`/`detected_stacks`
   (legacy vocabulary) are **retained** — `detected_stacks` is *derived* from detection, and the
   coarse stack feeds the **confidence score** (agreement boosts; frontend-on-backend conflict
   dampens −0.25). The threshold (default 0.6, `env.RULE_DEPLOY_THRESHOLD`) is the single
   guardrail — vendored evidence is pruned away so it never crosses; a real dep survives the
   conflict penalty (0.9−0.25=0.65).
3. **Dumb deployment** — `stepDeployRules()` reads `detection`, collects keys ≥ threshold, maps
   `${stack_key}-rules.md` by convention (project-rules.md is the baseline), and **hash-tracked
   overwrites** (mirrors skills `.hashes`: developer-edited rule → warn + skip, never clobber).
   Writes `.claude/rules/.hashes` + `_deploy-manifest.json` (audit). Keeps `deployed_rules[]` in
   state (setup-teardown `--rules` iterates it).
4. **Runtime-generation sub-stage** — manifest-first, nested under the language entry. P1 ships
   the **.NET** resolver (dotnet-framework vs dotnet-modern from TargetFramework/SDK-style/
   packages.config); generation gates replace the fragile `excludeIfFiles: net4*` hacks
   (`ado-net-legacy`/`csharp-framework48`/`ef6`/`wcf` require `dotnet-framework`; `csharp-dotnet`
   excludes it). Other languages + a consent-gated syntax fallback (in architect) are P2.

## Consequences

**Positive:** backend repos stop drawing frontend/legacy rules; fullstack repos still get
frontend rules (real dep survives); detection logic lives in one place (no drift); `detected_stacks`
integrity restored; a pre-existing setup-status bug (checked renamed-away `dotnet-rules.md`) is
fixed by driving off the manifest.

**Negative / trade-offs:** re-deploy is idempotent-**add** — it does not remove rules no longer
detected (avoids clobbering developer-edited files); stale rules on a mis-provisioned repo need
`setup-teardown --rules` + re-provision (migration 028). Ruby/PHP/Go/Rust generation resolvers
are P2 and have no rule consumers today.

## Alternatives rejected

**A) Patch the over-broad signals + prune only** — fixes today's case but keeps detection in two
drifting places and stays boolean. **B) A separate repo_type frontend-suppression net** —
redundant once confidence + pruning exist; the coarse stack feeds the score instead. **C) Keep
`detect:` in frontmatter, evaluated by the detector** — still two signal definitions. **D)
Unconditional overwrite of deployed rules** — violates the plugin's "never clobber developer
content" invariant; replaced by hash-tracking.

## Files affected

| File | Change |
|---|---|
| `scripts/stack-signals.cjs` | **New** — canonical table + scoreStacks + gather + .NET generation |
| `scripts/repo-detect.cjs` | Emit scored `detection`; derive `detected_stacks`; keep `repo_type` |
| `scripts/setup-init-bootstrap.cjs` | Rewrite `stepDeployRules` (threshold/convention/hash/manifest); delete parseRuleFrontmatter/glob helpers + STACK_SIGNALS/BACKEND_LAYER3_RULES |
| `_project-deploy/rules/*.md` (44) | Strip `detect:` frontmatter (keep `paths:`) |
| `skills/setup-status/SKILL.md` | Drive rule check off `_deploy-manifest.json`/`.hashes`; fix stale names |
| `skills/setup-sync/SKILL.md` | Re-run detection + scored deploy (not re-copy) |
| `scripts/setup-teardown.cjs` | `--rules` removes `.hashes` + `_deploy-manifest.json` |
| `tests/stack-signals.test.cjs`, `tests/rule-deploy.test.cjs`, `tests/validate.js` | Regression + structural guards |
| `docs/adr/README.md` · `docs/migrations/028-3.17.0.md` | Index + rollout |
