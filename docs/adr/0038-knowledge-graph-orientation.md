# 0038 — The knowledge graph is the single codebase-orientation layer
Status: Accepted · Date: 2026-07-02 · Supersedes: [0017](0017-domain-map.md)
Governs: `.claude/graph/`, `skills/shared/graph-index-schema.md`, `skills/shared/graph-module-schema.md`

## Problem
The plugin briefly carried **two** codebase-orientation artifacts. `domain-map.md`
([ADR 0017](0017-domain-map.md)) mapped feature areas to entry points in a single
always-loaded file. The codebase knowledge graph (v2.6.0) added `.claude/graph/` — an
index plus one ≤400-token detail file per module. Their content overlapped heavily
(both fingerprinted the same entry-point files, both detected staleness, both listed
entry point + key files), yet only domain-map was consumed: ~20 skills read it, the
graph had zero functional readers. ADR 0017 itself anticipated this — its "Revisit
when" said domain-map should get "a hierarchical split by module" once it grew
unwieldy. The graph *is* that split, but it was added *alongside* domain-map instead
of *replacing* it, and no ADR recorded why both existed. The result was duplicated
generation, duplicated staleness machinery, and drift risk.

## Decision
The **knowledge graph is the single orientation layer**; `domain-map.md` is retired
(v3.0.0). Concretely:

- **Two schemas, one system.** `graph-index-schema.md` defines the always-loaded
  breadth index (module → entry point); `graph-module-schema.md` defines the
  on-demand per-module depth file (bounded context, key files, dependencies,
  patterns), which auto-loads via `paths:` frontmatter only when work touches that area.
- **The `architect` skill generates the graph** (Step 7); `/graph-sync` refreshes it
  incrementally by per-module entry-point fingerprint; a post-merge git hook sets
  `.claude/graph/.stale`. There is no separate whole-repo fingerprint.
- **All ~20 former domain-map consumers read the graph instead** — orientation
  readers (icea-feature, icea-review, ado-tasks, pr-describe, pr-spec-review, bug,
  explain) read `graph-index.md` then the matching module file; `--area <Name>`
  resolves against the index; health checks (dream-status 1f, session-start,
  plugin-readiness) check `graph-index.md`.
- **The graph is committed and PR-reviewed — not gitignored.** As the single source
  of orientation truth it belongs in version control, reviewed like source and shared
  across the team, rather than regenerated silently per machine.
- `/update-arch` no longer touches orientation data; it refreshes the prose
  `architecture.md` and re-runs the deployment questionnaire only.

## Rationale
- **The graph is strictly richer** — it adds inter-module Dependencies and bounded
  context that domain-map lacked, and **more token-efficient** (lazy per-module load
  vs one always-loaded map).
- **One orientation system, not two** — removes duplicated generation and staleness
  machinery and the drift risk of two maps disagreeing (ADR 0003, single source of truth).
- **Manifest/committed honesty** — a tracked, reviewed graph is a better shared source
  of truth than a gitignored generated file, and audits no longer see a duplicate.

## Consequences
- Breaking (v3.0.0): projects lose `.claude/architecture/domain-map.md`. `/dream-sync`
  re-provisions — generates the graph, removes domain-map. `docs/migrations/012-3.0.0.md`
  records the sync actions.
- `domain-map-spec.md` is removed from `skills/shared/` and `components.shared`; its
  `architecture-deployment.md` refresh triggers moved into `/update-arch --deployment`.
- `validate.py` check 9 now asserts the graph schemas exist and domain-map-spec is gone.

## Revisit when
The graph index itself grows unwieldy (rare — it is one row per module), or Claude
Code gains a native codebase-index that the plugin could consume instead.
