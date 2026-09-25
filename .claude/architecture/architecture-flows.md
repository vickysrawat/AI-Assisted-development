# Architecture — Execution Flows

> Load this file when tracing how a skill invocation flows through the plugin,
> or when changing behaviour that spans multiple layers.

## Flow 1 — setup-init (first-time project provisioning)

```
User: /setup-init
  → Skill tool loads skills/setup-init/SKILL.md
  → Step 0: Claude runs §1a Node.js resolver → PLUGIN_DIR resolved, plugin-path.txt written
  → Step 0.5: node scripts/repo-detect.cjs
      → reads: project root files (package.json, *.sln, angular.json, requirements.txt, etc.)
      → calls: scripts/stack-signals.cjs (canonical signal→stack_key map)
      → writes: .claude/dream-init-state.json (repo_type, detected_stacks[])
      → exit 0 (detected), 1 (already set), 2 (ambiguous), 3 (unknown)
  → Step 1: node scripts/setup-init-bootstrap.cjs --mode init
      → creates: dirs, 38 command stubs (.claude/commands/), 5 hooks (.claude/hooks/)
      → writes: .claude/settings.json (PreToolUse + UserPromptSubmit + PostToolUse hooks)
      → writes: .claude/dream-init-state.json (shell_type, git/bash paths)
      → writes: .claude/_bootstrap-manifest.json (status + needsLLMPopulation[])
      → updates: .gitignore (managed block + stack entries)
      → ERROR PATH: atomic rename may fail on OneDrive — workaround: copy .tmp → .json manually
  → Step 1.5: node scripts/module-derive.cjs
      → reads: project source tree
      → writes: .claude/graph/.module-skeleton.json
  → Step 2a: /init skill → populates CLAUDE.md Common Commands section
  → Step 3a: architect SKILL.md
      → Step 0.5: deployment questionnaire → writes .claude/architecture/architecture-deployment.md
      → Step 1c: node scripts/setup-init-bootstrap.cjs --mode post-detect --repo-type {TYPE}
          → composes 8 architecture templates from templates/_shared/ + templates/{stack}/
          → deploys rules to .claude/rules/
      → Steps 4–6: LLM populates .claude/architecture/*.md files
      → Business context: skills/shared/business-context-generation.md
  → Step 3c-i: graph-create SKILL.md
      → reads: .claude/graph/.module-skeleton.json
      → runs: node scripts/graph-extract-edges.js (EXTRACTED edges from source imports)
      → writes: .claude/graph/graph.json, .claude/graph/graph-index.md
  → Step 3c-ii: graph-sync SKILL.md → refines graph.json, re-runs graph-extract-edges.js
  → Step 4: node deletes _bootstrap-manifest.json; prints summary
```

## Flow 2 — Knowledge graph generation (graph-create → graph-sync)

```
graph-create SKILL.md:
  → reads: .claude/graph/.module-skeleton.json (from module-derive.cjs)
  → LLM: classifies each module (type, domain)
  → computes: module fingerprints (bash helper)
  → node scripts/graph-extract-edges.js
      → reads: source files listed in skeleton
      → parses: import/require statements
      → writes: EXTRACTED edges into graph.json
  → projects: .claude/graph/graph-index.md + per-module detail files

graph-sync SKILL.md (refinement pass):
  → recomputes: module-wide fingerprints
  → regenerates: only stale modules (fingerprint changed)
  → detects: new/removed/renamed modules
  → re-runs: graph-extract-edges.js for EXTRACTED edges
  → deletes: .stale flag on success
```

## Flow 3 — ICEA feature planning gate

```
User: describes a new feature OR types "build X"
  → icea-feature SKILL.md auto-triggers
  → Step 1: reads .claude/architecture/*.md for codebase context
  → Step 2: drafts ICEA (Intent · Context · Examples · Acceptance)
  → SAVE PLAN ADO-{ID}: writes plan to disk → drafts ICEA to temp/ADO-{ID}-icea.md
  → SAVE ICEA ADO-{ID}: runs critic → copies to docs/Release{R}/Sprint{S}/UserStory{ID}/
  → SAVE TECH ADO-{ID}: writes Tech Spec
  → APPROVE ADO-{ID}: runs icea-approve SKILL.md → marks Status: ✅ Approved
  → IMPLEMENT ADO-{ID}: runs icea-implement SKILL.md
      → reads approved ICEA from disk
      → generates source code diffs
      → WRITE GATE: shows diff + path, waits for APPROVE ADO-{ID} before writing
```

## Flow 4 — Upgrade skill (in-place version bump)

```
UPGRADE ADO-{ID}:
  → upgrade SKILL.md reads: .claude/architecture/*.md, dream-init-state.json
  → node scripts/upgrade-classify.cjs — validates this is a true version bump
  → node scripts/upgrade-tool-preflight.cjs — checks dotnet/npm/mvn CLI availability
  → Gap + Risk report presented, user approves
  → node scripts/upgrade-checkpoint.cjs — writes ledger entry per hop
  → node scripts/upgrade-orchestrate.cjs — drives CLI tool (dotnet upgrade, npm, etc.)
  → one git commit per hop via Bash
  → node scripts/upgrade-knowledge-cache.cjs — updates offline knowledge cache
```

## Flow 5 — Code review (cache-aware)

```
/code-review (or --changed / --pr / --full):
  → code-review SKILL.md reads: .claude/file-cache.json (fingerprints)
  → skips unchanged files (cache hit)
  → reads changed source files (Category B consent, announced to user)
  → LLM: inter-procedural static analysis against loaded checker rules
  → writes: CodeReviews/code-review-{date}.md + .html
  → updates: CodeReviews/code-review-ledger.md (FP-fingerprinted findings)
  → updates: .claude/file-cache.json (new fingerprints)
```

## Module Dependency Map

| Module | Imports / Depends On |
|---|---|
| `scripts/repo-detect.cjs` | `scripts/stack-signals.cjs` |
| `scripts/setup-init-bootstrap.cjs` | Node.js stdlib (fs, path, crypto, child_process, os) |
| `scripts/module-derive.cjs` | Node.js stdlib |
| `scripts/graph-extract-edges.js` | Node.js stdlib |
| `scripts/upgrade-orchestrate.cjs` | `scripts/upgrade-checkpoint.cjs`, `scripts/upgrade-classify.cjs` |
| `scripts/rewrite-decompose.cjs` | `scripts/rewrite-bal.cjs` |
| `scripts/plugin-state.cjs` | Node.js stdlib |
| `scripts/audit-write.cjs` | Node.js stdlib |
| `tests/jest.suite.test.cjs` | `child_process.spawnSync`, Jest |
