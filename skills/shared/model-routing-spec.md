# Model Routing Specification
_Spec version: 1.4 · Last changed: 2026-08-21 · Applies to all generation, review, and infrastructure skills_

This file is the single source of truth for model routing across the plugin.
Skills read environment variables first, then fall back to the defaults defined here.

---

## Routing tiers

### Generation tier — `ICEA_MODEL`

**Default:** `claude-opus-4-8`

Used by skills that create new content: specs, code, documentation, task breakdowns.
These tasks are consequential — a poor ICEA causes rework, bad code blocks the PR gate.
Opus is used here because quality at generation time reduces cost downstream.

Skills in this tier:
- `icea-feature` — ICEA planning and code generation
- `ado-tasks` — ADO task breakdown from approved ICEA
- `pr-describe` — PR description generation
- `product-docs` — Product Detail Document and User Guide generation

### Review tier — `REVIEW_MODEL`

**Default:** `claude-sonnet-4-6`

Used by skills that analyse existing content: checking compliance, finding
vulnerabilities, validating PRs against specs. These are analytical pattern-matching
tasks — Sonnet is fully capable and 5× faster than Opus, reducing timeout risk on
long scans.

Skills in this tier:
- `icea-review` — ICEA compliance checking against PR diff
- `code-review` — static analysis and fingerprint tracking
- `security` — OWASP/CVSS/CWE security scanning
- `pr-spec-review` — PR vs spec traceability review
- `pr-create` (icea-review gate) — auto-compliance check before PR submission
- `dynamic-scan` — DAST runtime security scanning with OWASP ZAP
- `critic` — second-pass critique of ICEA drafts and generated code (uses `CRITIC_MODEL`, which falls back to `REVIEW_MODEL`)
- goal-loop **self-score** (the `rubric-score-schema` scorer run by `goal-loop-spec`, called from icea-implement Step 4b and migration Stage 4) — measuring artefact completion against a rubric is analytical, not generation, so the scorer runs in the review tier. The loop's *regeneration* step uses the **parent skill's generation tier** (icea-implement / migration code-gen), not this tier.

#### `CRITIC_MODEL` — critic override (review sub-tier)

The `critic` skill reads `CRITIC_MODEL` first and falls back to `REVIEW_MODEL`
when it is unset, then to `claude-sonnet-4-6`. This lets a team tune the critic
independently of the broader review tier — for example, running the critic on
Opus for higher-quality code critique while leaving the rest of the review tier
on Sonnet:

```json
{ "env": { "CRITIC_MODEL": "claude-opus-4-8" } }
```

Resolution order: `CRITIC_MODEL` → `REVIEW_MODEL` → `claude-sonnet-4-6`.

### Infrastructure tier — `INFRA_MODEL`

**Default:** `claude-sonnet-4-6`

Used by skills that manage plugin state, session memory, architecture documentation,
and operational reporting. These tasks do not require the full generative capability
of Opus — Sonnet handles them reliably and at lower cost. However, teams running
very large codebases or needing higher-quality architecture summaries can upgrade
this tier independently of the generation and review tiers.

Skills in this tier:
- `dream` — memory consolidation (6-phase session analysis)
- `architect` — knowledge graph and architecture doc generation
- `setup-status` — health check (read-only, Haiku would suffice)
- `dream-rollback` — memory revert from audit trail
- `dream-health` — health dashboard generation
- `graph-sync` — knowledge graph staleness detection and module regeneration
- `sprint-metrics` — ADO KPI reporting via REST API
- `token-analysis` — token consumption analysis and graphing
- `session-start` — session context warm-up
- `update-arch` — targeted architecture doc refresh
- `checkin` — pre-commit gate (shared context coordination)
- `explain` — codebase Q&A from architecture docs
- `fix` — apply ledger finding to source
- `prod-readiness` — production readiness assessment
- `app-readiness` — enterprise/solution architect readiness assessment
- `plugin-readiness` — AI architect plugin health assessment
- `bug` — lightweight bug fix flow (inline command)
- `goal-loop` — cradle-to-grave orchestrator (sequences icea-feature → icea-approve → icea-implement); owns no generation of its own, so it runs in the infrastructure tier while each sequenced skill routes its own tier

---

## How skills read the routing

Every generation-tier skill must check `ICEA_MODEL` at the start:

```bash
# Read model preference — fall back to Opus if not set
MODEL=${ICEA_MODEL:-claude-opus-4-8}
# The tool resolves the env var at session start (see user guide for wiring)
# Skills document this in their Step 0 as a note to the developer
```

Every review-tier skill must check `REVIEW_MODEL` at the start:

```bash
MODEL=${REVIEW_MODEL:-claude-sonnet-4-6}
```

Every infrastructure-tier skill must check `INFRA_MODEL` at the start:

```bash
MODEL=${INFRA_MODEL:-claude-sonnet-4-6}
```

The `critic` skill checks `CRITIC_MODEL` first, then `REVIEW_MODEL`:

```bash
MODEL=${CRITIC_MODEL:-${REVIEW_MODEL:-claude-sonnet-4-6}}
```

In practice, Claude Code respects the model set in the session context. The skill
documents the expected model so developers can verify the routing is correct.

---

## Configuring overrides

Routing is controlled by three environment variables — `ICEA_MODEL`,
`REVIEW_MODEL`, `INFRA_MODEL`. This spec defines the contract only: each
variable names the model string for its tier, and a project-level setting
takes priority over a machine-level environment variable.

**Tool wiring is deliberately not documented here** — this spec stays
tool-agnostic (validator check 26). For how to set these variables in the
current tooling, see the "Model routing" chapter of `user-guide.html` or
the hooks/installation section of `README.md`.

---

## Changing the routing

To upgrade the review tier to Opus for a specific project:
```json
{ "env": { "REVIEW_MODEL": "claude-opus-4-8" } }
```

To upgrade infrastructure to Opus (e.g. large codebase, higher-quality architecture docs):
```json
{ "env": { "INFRA_MODEL": "claude-opus-4-8" } }
```

To downgrade infrastructure to Haiku for cost optimisation:
```json
{ "env": { "INFRA_MODEL": "claude-haiku-4-5-20251001" } }
```

To test a new model on generation only:
```json
{ "env": { "ICEA_MODEL": "claude-opus-4-7" } }
```

To reset to defaults: unset the env var in your tool configuration (see user guide).

---

## Effort defaults by skill category

Effort controls how much extended thinking a skill uses. Setting it globally is
dangerous — a global `low` degrades ICEA and code-review quality. These are
per-category defaults; individual skills document their own default and accept
an `--effort` override flag.

| Category | Default effort | Rationale |
|----------|---------------|-----------|
| Generation (ICEA, tech spec, code generation) | `high` | Run once per feature; quality errors cause rework |
| Review (icea-review, code-review, security, critic) | `medium` | Analysis needed; exhaustive thinking rarely adds value |
| Infrastructure (graph-sync, setup-status, setup-init, session-start, token-analysis) | `low` | Deterministic structure; extended thinking wastes tokens |
| Knowledge graph (graph-sync) | `low` | File fingerprinting and template filling; no reasoning required |

Skills that accept `--effort`:

```bash
/code-review --effort high      # bump for large, ambiguous diffs
/graph-sync --effort medium     # bump if module structure is unusual
```

A skill that does not accept `--effort` uses its hardcoded category default.
Never pass `--effort` globally — always scope it to the specific invocation.
