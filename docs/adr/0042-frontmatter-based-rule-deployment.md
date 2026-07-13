# 0042 — Rule files declare their own deployment signals via `detect:` frontmatter
Status: Accepted · Date: 2026-07-07
Governs: `commands/dream-init.md` (Steps 4a–4c), `commands/session-start.md`, all `rules/*.md` files

## Problem
`dream-init` maintained a hardcoded table mapping bash-detected stack flags (`HAS_DOTNET`,
`HAS_ANGULAR`, etc.) to specific rule file names. Adding any new rule file required editing
`dream-init.md` in three places: the detection probe, the canonical-key map, and the
deployment table. With the transition to ecosystem-based and layered backend rules (ADR 0043),
the number of rule files grew from 8 to 36. The hardcoded table would require 28 new entries
and could not express the dependency-based detection that JS ecosystem rules need — a file
named `react-ecosystem-rules.md` cannot be activated by a filesystem probe; it requires
knowing that `react` is in the project's `package.json`.

Additionally, `session-start.md` maintained a parallel `STACK_RULES` map to validate that
deployed rule files still existed. Any rule file rename required synchronising both files.

## Decision
Each rule file declares its own activation signals in a `detect:` YAML block in the file
frontmatter, alongside the existing `paths:` block. `dream-init` discovers and deploys
rules by reading these signals rather than consulting a hardcoded table.

**`detect:` block shape:**
```yaml
---
paths: ["**/*.tsx"]
detect:
  always: false                              # true → always deploy (project-rules.md only)
  dependencies: ["react"]                   # any dep/devDep in package.json → candidate
  excludeIfDependencies: ["next"]           # any present → skip (meta-framework wins)
  files: ["**/*.csproj"]                    # glob patterns checked in project root
---
```

**Deployment decision (dream-init Step 4c — discovery loop):**
1. Locate plugin `rules/` directory via `installed_plugins.json` (existing resolver)
2. For each `*.md` file in that directory:
   - `detect.always: true` → deploy
   - `detect.files` match in project root → deploy
   - `detect.dependencies` match in `package.json` deps/devDeps AND none of
     `detect.excludeIfDependencies` present → deploy
   - File already in `.claude/rules/` → skip (idempotent)
3. Record deployed filenames in `deployed_rules[]` in `dream-init-state.json`

**Non-JS stacks** (dotnet, java, python) continue to use bash filesystem probes in
Step 4a; their canonical keys stay in `stackMap` for backward compatibility with other
skills. JS ecosystem stacks are detected entirely via frontmatter `dependencies:`.

**`session-start.md`** replaces the hardcoded `STACK_RULES` map with a
`deployed_rules[]`-based check: read the array from state, verify each file exists in
`.claude/rules/`. A legacy fallback handles states written by older dream-init versions.

## Rationale
- **Self-describing:** a rule file author adds the `detect:` block once; no plugin
  infrastructure file requires a matching edit.
- **Expressive:** dependency-based detection handles JS ecosystem rules that filesystem
  probes cannot.
- **Idempotent discovery:** the loop is safe to re-run; files already present are
  skipped, so a plugin update that adds new rule files is picked up on the next
  `dream-init` without user action.
- **Alternatives rejected:**
  - *Keep hardcoded table* — unmaintainable at 36+ files; every new rule file requires
    editing dream-init code.
  - *Central registry file* (e.g. `rules/registry.json`) — same maintenance burden as
    the hardcoded table; two artefacts to keep synchronised.

## Consequences
- All rule files must include a `detect:` block. Existing files (angular, python, java,
  javascript, project-rules) were updated; the three renamed files
  (dotnet-rules → csharp-dotnet-rules, dotnet-framework-rules → csharp-framework48-rules,
  nodejs-rules → nodejs-typescript-rules) carry the block in their replacement.
- `dream-init` Step 4c is rewritten from a bash `deploy_rule` loop to a Node.js
  frontmatter-discovery loop.
- The `angular`, `nodejs`, and `javascript` entries are removed from `stackMap`; those
  stacks are now deployed via frontmatter discovery.
- `deployed_rules[]` is written to `dream-init-state.json` on every run.

## Revisit when
Claude Code gains a native plugin-hook mechanism that lets rule files register their
activation conditions with the host directly, making the discover-and-deploy loop
unnecessary.
