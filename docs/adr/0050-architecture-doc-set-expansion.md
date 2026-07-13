# 0050 — Architecture doc set expands from 4 to 8; two Mermaid diagrams in architecture.md
Status: Accepted · Date: 2026-07-10
Governs: `skills/architect/`, `commands/update-arch.md`, and the architecture-doc consumers
(`security`, `icea-feature`, `icea-review`, `app-readiness`)

## Problem

The `architect` skill generated a 4-file set per stack (`architecture.md`,
`architecture-{callchains|flows|api}.md`, `architecture-reference.md`,
`architecture-deployment.md`). Inspection of all 11 stack templates confirmed an **identical
structural blind spot in every stack**: the set captures *what* the system is and *how*
requests flow, but never:

- **Data model / schema** — no entities, relationships, or data ownership (deployment.md's
  Database row was engine/migration/backup/RTO/RPO only).
- **Decision rationale** — zero record of *why* any choice was made.
- **Business authorization model** — only auth *mechanics* (Entra config, per-endpoint Auth
  column); never roles, permissions, or which rules gate which actions.
- **External dependency behavior** — external systems appeared only as bare class names; no
  contract, timeout, retry, circuit breaker, or failure behavior.
- **Non-functional requirements** — performance targets, scaling limits, compliance existed
  only as fragments in app-readiness scoring and ICEA AC-NF templates, never a design-time doc.

There was also no whole-system or layered *diagram* a reader could open to orient quickly —
only a crude, per-stack ASCII "Layer Dependency Diagram".

## Decision

Expand the per-stack set to **8 documents** and add two Mermaid diagrams to `architecture.md`:

- **`architecture-data.md`** (NEW, code-populated) — entities/tables, relationships, data
  ownership, key aggregates, access patterns. Stack-adaptive: backend = DB schema; frontend =
  client state model + API DTO shapes; library = exported data types.
- **`architecture-integrations.md`** (NEW, hybrid) — external dependencies with contract,
  timeout/retry/circuit-breaker (from code), failure behavior + SLA/ownership (flagged).
- **`architecture-security.md`** (NEW, hybrid) — trust boundaries and the **authorization
  model** (Action → Role/Policy → Enforced-at), business rules gating actions, sensitive-data
  handling. Consumed by the `security` skill.
- **`architecture-decisions.md`** (NEW, seed-only, append-only) — an `AD-NNN` log seeded from
  detectable choices; the **rationale is human** and never auto-invented.
- **`architecture-deployment.md`** gains a **Non-Functional Requirements & Constraints** section.
- **`architecture.md`** gains **End-to-End** (`flowchart LR`) and **Layered View**
  (`flowchart TB`) Mermaid diagrams, replacing the ASCII layer diagram.

Population follows the existing copy-then-populate path (File 4–7 prompts, same as File 1–3);
`/update-arch` gains `--data` / `--integrations` / `--security` (refresh one doc) and
`--decisions` (append a new entry). Consumers are wired in the same change to prevent orphans.

## Rationale

- **Completeness of the operable picture** — a reader now gets what the data is, who we depend
  on and what happens when they fail, who may do what, the non-functional envelope, and *why*.
- **Hybrid populate (extract + flag)** — matches the existing convention: fill what code proves,
  mark gaps with `⚠ Could not determine — needs manual input`; never invent authz rules, SLAs,
  timeouts, or decision rationale.
- **Mermaid over ASCII / graph-viz** — text-based (PR-diffable), renders offline in VS Code /
  Azure DevOps / GitHub, committed with the doc. graph-viz stays the *interactive* view; these
  are the *committed* views.
- **Decisions as a single evolving file** — lighter than a target-repo `docs/adr/` folder and
  distinct from session memory (which is not committed/PR-reviewed).

## Alternatives rejected

- **Five separate files (incl. a standalone NFR file)** — rejected; NFR folds into deployment.md
  where the questionnaire already lives, keeping the set at 8.
- **Target-repo `docs/adr/` folder for decisions** — heavier process; rejected for a single
  evolving `architecture-decisions.md`.
- **Reuse session memory for decisions** — rejected; memory is session-scoped, not committed
  architecture documentation.
- **Extend existing files with new sections instead of new files** — rejected; bloats
  architecture.md and mixes code-derived with human-knowledge content.

## Consequences

- Each stack template folder grows from 4 to 8 files; the bootstrap already deploys by globbing
  `*.md`, so no bootstrap change was needed. *(Superseded by [[0051-architect-template-dedup]]:
  the near-identical new files were later deduplicated into a `_shared/` base + per-stack
  overrides, and the bootstrap now composes the two tiers.)*
- The `security` skill now reads `architecture-security.md`/`-integrations.md` as review context
  (with an explicit staleness caveat — docs map where to look, source remains the evidence).
- `icea-feature` seeds `AC-NF` criteria from the NFR section; `app-readiness` feeds NFR/security
  into resilience/observability/scalability/security scoring.
- Mermaid rendering in plain VS Code requires the Markdown Preview Mermaid extension; the prompts
  constrain diagrams to valid, simple syntax and keep the `⚠` marker when a graph isn't derivable.

## Revisit when

The knowledge graph (`graph.json`) gains typed data/authorization/dependency edges rich enough
that `architecture-data.md` / `-security.md` / `-integrations.md` could be *projected* from it
rather than separately populated — at which point consolidate to avoid double maintenance.
