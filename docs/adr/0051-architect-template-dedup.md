# 0051 — Architect templates: shared base + per-stack overrides (dedup)
Status: Accepted · Date: 2026-07-10
Governs: `skills/architect/templates/`, `scripts/setup-init-bootstrap.cjs`
(`stepPreCopyArchTemplates`), `skills/architect/SKILL.md`
Relates to: [[0050-architecture-doc-set-expansion]], [[0046-dream-init-bootstrap-pattern]]

## Problem

The 4→8 doc-set expansion (ADR 0050) was authored once and `cp`-distributed across all 12 stack
template folders. An md5 audit confirmed most of the added files are byte-duplicates:

- `architecture-decisions.md`, `architecture-integrations.md`, `architecture-security.md` —
  **byte-identical across 10 stacks**; only `dotnet-api` differs (it carries .NET-specific seed
  hints: Dapper/EF Core, Entra ID/KeyVault).
- `architecture-data.md` — 4 variants: backend-6 (aspnet×2, python×3, spring-boot), frontend-3
  (angular×2, react), `dotnet-api`, `js-library`.

That is ~33 redundant copies. Every edit to a "common" template had to be repeated 10× and
silently drifted when it wasn't — the exact maintenance hazard the doc-set was meant to reduce.
The genuinely per-stack files (`architecture.md`, `-deployment.md`, `-reference.md`, and the
File-2 variant `-callchains`/`-flows`/`-api`) are not duplicated and stay per-stack.

## Decision

Introduce a **two-tier template layout composed at deploy time**:

- `skills/architect/templates/_shared/` holds the stack-agnostic base
  (`architecture-decisions.md`, `-integrations.md`, `-security.md`, and the backend-6
  `-data.md` as the default).
- `skills/architect/templates/<stack>/` holds only stack-specific files **plus any per-stack
  override** of a shared file (`dotnet-api` overrides all four; the three frontend stacks and
  `js-library` override `-data.md`).

The bootstrap `stepPreCopyArchTemplates` now composes the target `.claude/architecture/` from
`union(_shared/*.md, <stack>/*.md)` keyed by filename, with the **stack file winning any
collision**. Every stack still resolves to its exact 8-file set. The `<!-- TEMPLATE -->`
marker-strip and skip-if-exists (never overwrite populated docs) behaviours are unchanged.

Templates **stay under `skills/architect/templates/`** (co-located with the `prompts/<stack>.md`
that populate them) rather than moving to `_project-deploy/`.

## Rationale

- **Single source of truth** — the common files live once; a fix to `_shared/architecture-
  security.md` reaches all 10 inheriting stacks with no fan-out. Removes ~33 duplicate files.
- **Byte-identical output** — the composed result for every stack is identical to the previous
  per-stack set (verified by md5-comparing composed output to the pre-dedup baseline). This is
  pure plumbing; populated-doc quality is unchanged.
- **Override, not genericize** — `dotnet-api`'s .NET-specific seed hints are real content, not
  cosmetic; keeping them as override files preserves seeding quality that full genericization
  (relying only on `prompts/<stack>.md`) would erode.
- **Co-located, not relocated** — the templates and the prompts that fill them are one cohesive
  unit; keeping them together outweighs the consistency of putting every deploy source under
  `_project-deploy/`.

## Alternatives rejected

- **Full genericization to one shared copy per file** — rejected; would drop `dotnet-api`'s
  detectable-choice seed hints and change .NET population quality (a behaviour change, not
  plumbing).
- **Relocate templates to `_project-deploy/architecture/`** — rejected; splits templates from
  their sibling `prompts/<stack>.md` for a consistency-only gain.
- **A third `_shared-frontend/` tier for the frontend `-data.md`** — rejected; a 2-file saving
  for extra precedence complexity. The three frontend copies stay as per-stack overrides,
  keeping the compose to exactly two tiers.

## Consequences

- **Supersedes ADR 0050's "no bootstrap change was needed"** — the bootstrap now composes two
  tiers instead of globbing a single folder. The moves and the compose rewrite ship atomically;
  moving common files to `_shared/` without the rewrite would deploy incomplete sets.
- The architect SKILL.md standalone fallback-copy path (used when Bootstrap Phase 2 didn't run)
  now composes the two tiers as well.
- `tests/validate.js` gains an architecture-templates block asserting `_shared/` contents, each
  stack's specific files, `union(_shared, stack) == 8`, override presence, and the marker;
  `tests/validate.py` gains the same compose-completeness assertion.
- Transparent to already-initialized projects: `setup-sync` re-runs the bootstrap, and
  skip-if-exists protects populated `.claude/architecture/*.md`.
- **Residual drift (accepted):** `dotnet-api`'s 4 override files can still drift from `_shared/`
  (reduced from 10 copies to 2). The validator asserts the overrides *exist*, not that they stay
  in sync.

## Revisit when

The same trigger as ADR 0050 — if typed data/authorization/dependency edges in `graph.json`
become rich enough to *project* these docs, the shared templates become moot.
