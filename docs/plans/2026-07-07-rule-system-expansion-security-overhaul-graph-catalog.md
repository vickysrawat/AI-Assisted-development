# Plan: Rule System Expansion, Security Skill Overhaul, Graph Directory Catalog

**Date:** 2026-07-07
**Branch:** feature/deterministic-graph-edges
**Status:** Implemented

---

## Overview

This session delivered four major changes to the plugin:

1. **Frontmatter-based rule deployment** — rule files are now self-describing; dream-init
   discovers and deploys them automatically without a hardcoded table.
2. **Rule file expansion** — 8 rule files grown to 43, organised as frontend ecosystem
   bundles and a layered backend hierarchy.
3. **Security skill overhaul** — 40-file budget cap removed, structural fixes, free-form
   LLM risk analysis pass added as §3.
4. **Graph directory catalog** — `directoryCatalog` added to `graph.json` so skills can
   look up directory types without a runtime `find`.

ADRs 0042–0045 document the decisions.

---

## 1. Frontmatter-based rule deployment (ADR 0042)

### Problem
`dream-init` had a hardcoded table mapping bash-detected stack flags (`HAS_DOTNET`,
`HAS_ANGULAR`, etc.) to specific rule file names. Adding any new rule file required
editing `dream-init.md` in three places. With the rule file count growing from 8 to 43,
the hardcoded table became unmaintainable. JS ecosystem rules also need dependency-based
detection (is `react` in `package.json`?) that name-based file probes cannot express.

### Solution
Each rule file declares its own activation signals via a `detect:` YAML block:

```yaml
---
paths: ["**/*.tsx"]
detect:
  always: false
  dependencies: ["react"]
  excludeIfDependencies: ["next", "@remix-run/react"]
  files: ["**/*.csproj"]
---
```

`dream-init` Step 4c now runs a discovery loop: reads all `rules/*.md` files, parses
their `detect:` blocks, deploys matching files, and writes `deployed_rules[]` to
`dream-init-state.json`. `session-start` reads this array for validation instead of a
hardcoded `STACK_RULES` map.

### Files changed
- `commands/dream-init.md` — Steps 4a (npm dep probe), 4b (stackMap trimmed to non-JS
  stacks), 4c (discovery loop replacing hardcoded deployment table)
- `commands/session-start.md` — STACK_RULES map → deployed_rules[] check + legacy fallback
- `.claude-plugin/plugin.json` — components.rules: 8 → 43 entries

---

## 2. Rule File Expansion (ADR 0043)

### Frontend ecosystem bundles (9 new or enhanced)

Each bundle is self-contained: framework + state management + unit testing + UI libraries.
Meta-frameworks use `excludeIfDependencies` to supersede their base framework.

| File | Covers |
|---|---|
| `react-ecosystem-rules.md` | React + RTK/Zustand/TanStack Query + Vitest/Testing Library + MUI/shadcn/Radix |
| `vue-ecosystem-rules.md` | Vue 3 Composition API + Pinia + Vitest |
| `svelte-ecosystem-rules.md` | Svelte/SvelteKit + Vitest |
| `solid-ecosystem-rules.md` | SolidJS signals/stores + Vitest |
| `nextjs-ecosystem-rules.md` | Next.js App Router + server/client components (excludes react-ecosystem) |
| `nuxt-ecosystem-rules.md` | Nuxt 3 + Vue + Pinia + server routes (excludes vue-ecosystem) |
| `remix-ecosystem-rules.md` | Remix loaders/actions + React patterns (excludes react-ecosystem) |
| `astro-ecosystem-rules.md` | Astro component islands + content collections |
| `angular-rules.md` | Enhanced in-place: NgRx, Angular Material, Testing Library sections added |

### Frontend cross-cutting (11 new)

`typescript-rules.md`, `tailwind-rules.md`, `css-rules.md`, `sass-rules.md`,
`css-modules-rules.md`, `graphql-client-rules.md`, `trpc-rules.md`,
`rest-client-rules.md`, `prisma-drizzle-rules.md`, `playwright-rules.md`,
`cypress-rules.md`

### Backend — four-layer hierarchy

| Layer | Files | Deployed when |
|---|---|---|
| 0 — Base | `backend-base-rules.md` | Alongside any Layer 3 file |
| 1 — Concerns | `rest-api`, `graphql-server`, `data-access`, `sql-relational`, `auth`, `api-security`, `testing-backend`, `observability`, `caching` | Alongside any Layer 3 file |
| 2 — Database | `postgresql`, `sql-server`, `nosql-document` | Driver dep detected |
| 3 — Language | `csharp-dotnet`, `nodejs-typescript`, `python` | Stack detected |
| 4 — Legacy ⚠️ | `csharp-framework48`, `wcf`, `ef6`, `ado-net-legacy` | Legacy signals |

Layer 4 files carry a **MAINTENANCE ONLY** banner and cross-reference Layer 1 where valid.

### Files replaced (old files deleted)

| Old | New |
|---|---|
| `dotnet-rules.md` | `csharp-dotnet-rules.md` |
| `dotnet-framework-rules.md` | `csharp-framework48-rules.md` |
| `nodejs-rules.md` | `nodejs-typescript-rules.md` |

### Existing files updated (detect: blocks + enhancements)
`project-rules.md`, `angular-rules.md`, `python-rules.md`, `javascript-rules.md`,
`java-rules.md`

---

## 3. Security Skill Overhaul

### Scope flag behavior
- `--pr` / `--changed` → git diff (only changed files in the branch/working tree)
- `--full` → full working-tree scan, cache ignored, no file limit
- Default → cache-aware full-project scan, no file limit

### 40-file budget cap removed
Step 0b2 (FILE_BUDGET = 40) deleted. All stale budget references cleaned from Step 0c2
header and Step 0e scope report.

### Structural fixes
- Double HR separators removed (two locations)
- Model routing block moved to top of file
- Sections 2, 3, 4 (redundant "Load X now" — duplicated Step 0e) removed; §5 → §2, §6 → §3, §7 → §4
- Step 0e scope report: hardcoded language names → `{detected languages}`
- §0.5 scope-independence note: static dir enumeration always runs full `find` regardless
  of `--pr`/`--changed` scope flag (a data file in `public/` is a breach regardless of what
  changed in the current diff)

### §3 Free-form Risk Analysis (ADR 0045)

Final LLM pass after structured SAST. Key constraints:

| Constraint | Rationale |
|---|---|
| Evidence citation required | Prevents hallucination — must cite file/function/pattern |
| Up to 7 risks; "report fewer if fewer found" | Prevents padding |
| No CVSS scores | Qualitative only — avoids false comparability with structured CVSS |
| No repeat of ledger findings | Duplicate = same file + same vulnerability class |
| Scope limited to files in scan | Prevents reasoning about unread code on `--pr` scans |
| Labelled "LLM-inferred risk hypotheses" | Sets correct epistemic status |

Output appended to HTML report as a separate section. NOT added to security ledger —
no FP fingerprints, no `/fix` support. Developers validate and promote manually.

---

## 4. directoryCatalog in graph.json (ADR 0044)

### Problem
Security skill §0.5 runs `find . -type d -name "public" ...` on every scan to locate
static-serving directories. This check must run regardless of scope flag. Directory type
information was not captured anywhere in the plugin, so every skill had to discover it
independently.

### Solution — schema extension

New optional top-level key in `graph.json`:

```json
"directoryCatalog": {
  "generatedAt": "2026-07-07",
  "staticServing": ["src/app/public", "wwwroot"],
  "config": ["environments", ".github/workflows"],
  "test": ["test", "__tests__", "e2e"]
}
```

### Generation — graph-sync Step 8d (pre-write, in-memory)

`find` commands run **before** Step 8a writes `graph.json`. Results added to in-memory
graph object `g`. Step 8a writes the full graph (including catalog) in one shot.
`graph-extract-edges.js` (runs after Step 8a) only touches `edges[]` — catalog untouched.
No read-modify-write; no risk of the script overwriting the catalog.

### Consumption — security skill §0.5

Trust the catalog only when all three conditions hold:
1. `.claude/graph/graph.json` is readable
2. `.claude/graph/.stale` is absent
3. Every path in `staticServing` exists on disk

If any condition fails → full `find` fallback. The path-existence check catches renamed
or deleted directories that would not trigger the `.stale` flag.

### Files changed
- `skills/shared/graph-json-schema.md` — directoryCatalog section + consumer contract
- `skills/graph-sync/SKILL.md` — Step 8d added (pre-write find commands)
- `skills/security/SKILL.md` — §0.5 rewritten with catalog lookup + fallback

---

## 5. ADR links removed from skill files

### Problem
Skill files contained `[ADR XXXX](../../docs/adr/XXXX-*.md)` links. Claude follows these
paths to load the referenced files, pulling irrelevant plugin-internal documentation into
context when working on target applications.

### Fix
- Created `.ignore` at repo root containing `docs/` — Claude Code always respects `.ignore`
  files. (`ignorePatterns` in `settings.json` is not a valid schema field.)
- Replaced all `[ADR XXXX](path)` with plain `ADR XXXX` text across 8 files (11 replacements).

---

## 6. ADRs authored (0042–0045)

| ADR | File | Decision |
|---|---|---|
| 0042 | `0042-frontmatter-based-rule-deployment.md` | detect: blocks; discovery loop; why hardcoded table rejected |
| 0043 | `0043-ecosystem-and-layered-rule-organisation.md` | Ecosystem bundles; Layer 0-4 backend; meta-framework exclusion |
| 0044 | `0044-directory-catalog-in-graph-json.md` | directoryCatalog schema; in-memory pre-write; three-condition consumer contract |
| 0045 | `0045-security-skill-free-form-risk-analysis.md` | Free-form pass constraints and per-constraint rationale |

---

## Known gaps / open items

- Custom static-serving directories (configured via app code rather than by directory name)
  are not detected by name-based `find` — same limitation as before, not a regression.
- The `dream-init-bootstrap.cjs` script (separate plan — see
  `.claude/plans/i-think-we-should-keen-firefly.md` for the current content of that plan)
  is still pending. It handles mechanical dream-init work in a single deterministic Node.js
  script, reducing LLM tool-call overhead during project setup.

## Closed in follow-up

- `architect` skill updated to generate `directoryCatalog` in Step 7-2 (same in-memory
  pattern as graph-sync Step 8d — find commands run before graph.json write).
- `plugin.json` bumped from 3.5.0 → 3.6.0.
- Migration `docs/migrations/015-3.6.0.md` created — documents rule renames,
  `deployed_rules[]` addition, and `directoryCatalog` rollout.
