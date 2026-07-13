# 0047 — Skills adopt named Expert Personas — a role axis orthogonal to model routing
Status: Accepted · Date: 2026-07-07
Governs: `skills/shared/personas-spec.md`, all `skills/*/SKILL.md`, `commands/explain.md`,
`commands/bug.md`, `commands/checkin.md`, `commands/fix.md`, `commands/update-arch.md`,
`commands/session-start.md`, `commands/dismiss.md`

## Problem

Skills route by **model tier** (`ICEA_MODEL`/`REVIEW_MODEL`/`INFRA_MODEL`) — a *capability* axis.
But they never specify **which expert lens to reason through** — the *role* axis. A "Tech Lead
reviewing a tech spec" and a "Product Owner drafting intent" use the same model tier yet evaluate
completely different concerns. Without role priming, the model defaults to generic-competent and
misses role-specific scrutiny (e.g., a Product Owner asking "what are we NOT doing?" or a SAST
engineer asking "where does the tainted value reach?").

Additionally, several skills (dream-status §1r, plugin-readiness) used `python3` for runtime
reads. On machines without Python those calls silently returned `UNKNOWN`/`EMPTY_OR_INVALID`,
compounding the lack of useful output.

## Decision

Add **Expert Personas** — a second, independent dimension: each skill declares the expert
identity (role, priorities, signature question) the model should adopt while executing it.

### Catalog (`skills/shared/personas-spec.md`)
13 named, compact identity cards (~6 lines each): `[PO]` Priya Nair (Product Owner), `[TL]`
Marcus Reid (Tech Lead), `[SE]` Elena Fischer (Senior Software Engineer), `[QA]` Sam Okonkwo,
`[SEC]` Dana Ito (Security Engineer), `[SA]` Rafael Mendes (Solution Architect), `[EA]` Grace
Lin (Enterprise Architect), `[AIA]` Theo Brandt (AI Architect), `[TW]` Maya Torres (Technical
Writer), `[DPE]` Igor Volkov (DevOps/Platform Engineer), `[SAST]` Wen Li (Static Analysis
Engineer), `[RM]` Nadia Haddad (Release Manager), `[DL]` Tom Grady (Delivery Lead).

### Three governing constraints
1. **Stack-agnostic role lens:** a persona is a *role*, not a technology. Technical expertise
   binds to the project's actual detected stack per layer (per `architecture.md` /
   `detected_stacks`) — never a fixed technology in the card. The same `[TL]` reasons correctly
   about Angular, React, *and* ASP.NET 4.8 in one polyglot app.
2. **Governance-subordinate:** a persona changes *what to scrutinize*, never licenses assumption.
   Codebase, architecture docs, and the ICEA remain the only sources of truth; a persona's
   "experience" is never evidence. Personas are explicitly subordinate to CLAUDE.md §3 ("do not
   assume — stop and ask") and the security skill's evidence-citation rule (ADR 0045).
3. **Reasoning-only:** personas shape analysis; generated artifacts (specs, code, PRs, reports)
   never name or attribute a persona. No "Reviewed by Marcus Reid" lines.

### Tiered deployment
- **Tier 1 (judgment skills, ~17):** inline compact card + full guardrail block in `## Persona`
  section. Multi-primary skills (`icea-feature`, `critic`) add per-step `> Acting as:` markers.
- **Tier 2 (mechanical/infra skills, ~9):** one-line lens only (no card, no bio) — the rubric is
  already in the deterministic steps; a persona adds nothing.

### Single primary per step
One persona drives each step. Genuine second-opinion review routes through the `critic` skill
(a real separate pass). Secondary roles appear as "also weigh these concerns" notes.

## Rationale

- **Orthogonal to model routing:** changing the role lens doesn't change the model tier. Both
  axes are needed but neither implies the other.
- **Inline card, not reference-only:** the card must be *in context* to prime anything. A pointer
  to a shared file only works if the model opens it that run — unreliable. The spec file is the
  registry; skills copy their card.
- **Stack-agnostic is non-negotiable for polyglot apps:** a `[TL]` hardcoded to ".NET &
  distributed systems" biases reasoning against Angular or React layers. Binding to detected
  stack at runtime eliminates the bias.

## Consequences

- New `skills/shared/personas-spec.md` (13-persona registry + guardrails + per-skill assignment
  table). All 26 skills and 7 inline-logic commands carry a `## Persona` block.
- `plugin.json` `components.shared[]` gains `"personas-spec"`.
- `icea-feature` and `icea-revise` carry a disambiguation note at the user-story `Personas:`
  field (customer persona ≠ Expert Persona).

## Revisit when

A formal multi-agent harness (parallel independent passes) makes the single-primary constraint
obsolete — then genuine co-authorship between agents with different personas becomes feasible.
