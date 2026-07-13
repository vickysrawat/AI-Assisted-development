# 0046 — dream-init uses a deterministic bootstrap script; LLM acts only on what needs intelligence
Status: Accepted · Date: 2026-07-07
Governs: `scripts/setup-init-bootstrap.cjs`, `commands/setup-init.md`, `skills/setup-sync/SKILL.md`

## Problem

`dream-init` set up a project by having the LLM walk through ~12 steps sequentially —
creating directories, copying 37 command stubs, deploying 5 hooks, writing gitignore entries,
seeding state files, scanning external directories, appending CLAUDE.md sections. Every
existence check, file write, and verification was a separate tool call with reasoning overhead:
30–60+ tool calls before any real LLM work began. This made plugin integration slow and
token-expensive.

A second failure mode: **rules were deployed at step 4a, before architecture docs existed.**
Stack detection used file-existence heuristics (`.csproj` found → dotnet), which misses
ecosystem-specific rules (Next.js, Prisma, Playwright) and can't distinguish a primary stack
from incidental files. The 43-file layered rule set made this even more consequential.

## Decision

Split `dream-init` into two distinct phases:

**Phase 1 — Deterministic bootstrap (`scripts/setup-init-bootstrap.cjs`):** a single Node.js
(`.cjs`) script that handles *all* mechanical work in one pass. Creates directories, deploys
stubs, deploys hooks + writes `.hashes`, wires the PreToolUse hook, seeds state files, writes
`_npm-deps.json`, runs gitignore sync, runs external-dir scan, appends CLAUDE.md managed
sections, detects git/bash paths. All operations are idempotent; the script writes a manifest
(`.claude/_bootstrap-manifest.json`) after each step so a crash leaves recoverable state.

**Phase 2 — LLM-only work, manifest-driven:** Claude reads the manifest and acts only on
`needsLLMPopulation` items in order: `/init` (CLAUDE.md content), path resolution, external-dir
verification, architect skill, graph-sync, then **rules deployment last** — after architecture
docs exist, so the LLM can read `architecture.md` + `_npm-deps.json` + rule frontmatter to make
accurate, ecosystem-aware decisions across all 43 rules including `excludeIfDependencies` logic.

**Manifest as the recovery checkpoint:** the manifest is written incrementally after every
bootstrap step. A crash leaves a `partial` manifest; re-running bootstrap resumes from the last
completed step (idempotent). Claude marks each LLM task `done` as it completes; the manifest is
deleted only when all tasks are finished, so a crashed session can resume mid-LLM-phase.

**`dream-sync` calls the same bootstrap in `--mode sync`:** overwrites plugin-managed files
(hooks, stubs) rather than skipping them, omits `needsLLMPopulation`. Single mechanical engine
for both init and sync.

## Rationale

- **Tokens where they matter:** mechanical work is O(1) node — one script call instead of 30+
  tool calls. LLM effort is concentrated on the three genuinely intelligent tasks (architecture
  docs, knowledge graph, rules selection).
- **Rules after architecture:** the architect skill + graph-sync give richer, more accurate stack
  information than file heuristics. `react-ecosystem-rules.md` with `excludeIfDependencies:
  ["next"]` can only be applied correctly when the project's actual framework is known.
- **Crash safety:** incremental manifest writes mean a power-cycle or Ctrl-C mid-run never leaves
  the project in an unknown state. Re-run; already-done steps are instant no-ops.
- **`.cjs` extension:** avoids `require` failures in target projects with `"type":"module"` in
  `package.json`, and avoids shell-escaping bugs from inline `node -e "..."`.

## Consequences

- `commands/setup-init.md` reduced from ~1259 lines to ~230 (5 steps instead of 12).
- `skills/setup-sync/SKILL.md` Steps 2–3 replaced by a single `node … --mode sync` call.
- `tests/validate.py` check 1 and check 35 updated to validate `STUB_FILES` in
  `dream-init-bootstrap.cjs` rather than the removed shell-loop deploy commands.
- The `docs/` folder, `.git/`, and `.vs/` are excluded from local-copy installs (`safe_copy`
  in `install.sh`) to prevent `.git/objects` permission errors and unnecessary copying.

## Revisit when

A CLI plugin-management command (`claude plugin init`) makes the bootstrap pattern redundant —
then delegate entirely to that command and retire the script.
