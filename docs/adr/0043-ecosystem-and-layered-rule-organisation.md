# 0043 — Frontend rules as ecosystem bundles; backend rules in a four-layer hierarchy
Status: Accepted · Date: 2026-07-07 · Related: [0042](0042-frontmatter-based-rule-deployment.md)
Governs: `rules/` directory structure and all rule files

## Problem
Expanding rule coverage to modern frontend frameworks, backend runtimes, state managers,
testing tools, and styling systems produced two competing designs:

**Option A — one file per technology (39 files):** A React project would need
`react-rules.md` + `zustand-rules.md` + `tanstack-query-rules.md` + `vitest-rules.md`
+ `testing-library-rules.md` + `shadcn-rules.md` + `typescript-rules.md` — seven files
to get complete coverage. Developers working on that project would need to know which
combination to deploy. Cross-file consistency (e.g. "use Testing Library queries in
priority order") would need repeating or be missed.

**Option B — one file per category (10 files):** A broad `testing-rules.md` covering
Vitest, Jest, Playwright, Cypress, and Testing Library is too thin on each to be useful
and mixes E2E and unit testing concerns.

For the backend, the existing `dotnet-rules.md` conflated language rules, data-access
rules, HTTP conventions, and authentication patterns. Adding support for NestJS, Fastify,
legacy ASP.NET Framework, WCF, and EF6 alongside modern .NET had no clear boundary model:
which rules are universal vs stack-specific vs legacy-only?

## Decision

### Frontend — ecosystem bundles
Each bundle covers one framework plus its typical state management, unit testing, and
UI library choices. One file gives a developer complete coverage for their stack.

- `react-ecosystem-rules.md` — React + RTK/Zustand/TanStack Query + Vitest/Testing
  Library + MUI/shadcn/Radix UI
- `vue-ecosystem-rules.md` — Vue 3 Composition API + Pinia + Vitest/Testing Library
- `svelte-ecosystem-rules.md`, `solid-ecosystem-rules.md` — similarly self-contained
- `nextjs-ecosystem-rules.md`, `nuxt-ecosystem-rules.md`, `remix-ecosystem-rules.md`,
  `astro-ecosystem-rules.md` — meta-frameworks; each is self-contained and **excludes**
  its base framework bundle (Next.js excludes react-ecosystem via
  `excludeIfDependencies`, since Next.js rules are a superset of React rules).

Cross-cutting tools (TypeScript, Tailwind, CSS, Sass, GraphQL client, tRPC, Prisma/
Drizzle, Playwright, Cypress) remain as separate files deployed alongside ecosystem
bundles when their deps are detected.

### Backend — four-layer hierarchy

| Layer | Files | Deployed when |
|---|---|---|
| 0 — Base | `backend-base-rules.md` | Always, alongside any Layer 3 file |
| 1 — Concerns (language-agnostic) | `rest-api`, `graphql-server`, `data-access`, `sql-relational`, `auth`, `api-security`, `testing-backend`, `observability`, `caching` | Always, alongside any Layer 3 file (some also detect specific deps) |
| 2 — Database-specific | `postgresql`, `sql-server`, `nosql-document` | Driver dep detected |
| 3 — Language/runtime | `csharp-dotnet`, `nodejs-typescript`, `python` | Stack detected |
| 4 — Legacy (maintenance-only) | `csharp-framework48`, `wcf`, `ef6`, `ado-net-legacy` | Legacy-specific signals |

**Layer 4 files carry a top-of-file banner:**
```
⚠️ LEGACY — MAINTENANCE ONLY. Do not use these patterns for new features.
For new work, follow the Layer 1 concern files where applicable.
The sections below override Layer 1 only where legacy constraints diverge.
```
Legacy files cross-reference Layer 1 where the rule still applies and override only
where the legacy API or constraint genuinely diverges.

## Rationale
- **Ecosystem bundles** — a developer on a React project gets one file with complete,
  consistent coverage instead of constructing a combination from N files. Rules that
  need to agree (Testing Library query priority, hooks lint rules, state management
  choice) live in one place and cannot drift.
- **Meta-framework exclusion** — Next.js rules are a superset of React rules; deploying
  both would be redundant and potentially contradictory. Exclusion via
  `excludeIfDependencies` ensures the most specific applicable file wins.
- **Layered backend** — separates what is genuinely universal (auth, security, logging
  principles) from what is language-specific (xUnit patterns for C#, pytest for Python).
  Layer 1 concerns are authored once and apply to all three runtimes.
- **Legacy layer** — keeps maintenance codebases covered without mixing legacy patterns
  into modern rule files. The explicit banner makes the maintenance-only status
  undeniable; the cross-reference to Layer 1 ensures security and data-access principles
  still apply where the legacy API allows.

## Consequences
- 36 rule files (up from 8). Three old files replaced by renamed equivalents.
- Meta-framework and base framework never co-deploy (exclusion is automatic via
  frontmatter, enforced by the discovery loop in ADR 0042).
- Backend Layer 0 and Layer 1 files deploy automatically whenever a Layer 3 file
  deploys — the dream-init discovery loop has a special rule for this.
- Custom static-serving directories (configured in app code rather than by name) are
  not covered — a limitation of name-based detection, not a regression.

## Revisit when
A target project uses multiple frontend frameworks (micro-frontend monorepo) where
meta-framework exclusion is too restrictive. At that point, allow multiple ecosystem
files and add cross-file consistency checks rather than exclusion.
