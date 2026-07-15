# Architecture — Public API (Commands & Skills)

_Generated: 2026-07-13_

The plugin's public API surface is its 37 **slash commands** and 26 **skills**. Commands are stub
`.md` files deployed to `.claude/commands/` in target projects; skills are full `SKILL.md`
instruction sets loaded on invocation from the plugin installation path.

## Commands (Slash Commands)

### ICEA Workflow

| Command | Trigger keywords | What it does |
|---|---|---|
| `/icea-feature` | "build", "implement", "add feature", ADO #ID | Drafts ICEA document before any code; blocks implementation until approved |
| `/icea-approve` | `APPROVE ADO-{ID}` | Approves ICEA and Tech Spec; writes `Status: ✅ Approved` |
| `/icea-implement` | `IMPLEMENT ADO-{ID}` | Generates implementation code for approved ICEA |
| `/icea-review` | "review this PR", "ICEA compliance" | Checks PR/diff against approved ICEA |
| `/icea-revise` | `REVISE ADO-{ID}` | Revises an existing ICEA; re-gates code generation |
| `/icea-status` | `STATUS ADO-{ID}` | Shows ICEA state, open questions, tracker progress |

### Code Quality

| Command | What it does |
|---|---|
| `/code-review` | Coverity-style static analysis; writes HTML + ledger to `CodeReviews/` |
| `/security-review` | OWASP/CWE scan; writes HTML + ledger to `security/` |
| `/dynamic-scan` | DAST scan via OWASP ZAP Docker; writes report to `dynamic-scan/` |
| `/critic` | Second-pass critic in `icea`, `tech`, or `code` mode |
| `/fix FP-xxxxxxxx` | Applies a ledger finding fix directly to source |
| `/dismiss FP-xxxxxxxx` | Dismisses a finding with auditable justification |
| `/checkin` | Pre-commit gate: code-review + ICEA compliance + secrets check |

### Setup & Memory

| Command | What it does |
|---|---|
| `/setup-init` | One-time project setup: dirs, stubs, hooks, state files, gitignore, CLAUDE.md |
| `/setup-sync` | Re-provisions after plugin upgrade; applies migration notes |
| `/setup-status` | Green/amber/red health check for all plugin infrastructure |
| `/setup-teardown` | Removes plugin-managed content by scope |
| `/dream` | Memory consolidation: reads sessions, proposes ADD/UPDATE/DELETE |
| `/dream-health` | Generates `memory/health.html` dashboard |
| `/dream-audit` | Quarterly memory quality audit |
| `/dream-rollback` | Reverses a specific dream run |
| `/session-start` | Zero-cost session warm-up; loads CLAUDE.md + memory + arch context |

### Architecture & Graph

| Command | What it does |
|---|---|
| `/update-arch` | Refreshes prose architecture docs for changed areas |
| `/graph-sync` | Incremental knowledge graph refresh (fingerprint-based) |
| `/graph-viz` | Renders knowledge graph as offline HTML at `.claude/graph/graph.html` |

### PR & ADO

| Command | What it does |
|---|---|
| `/pr-describe` | Generates ICEA-compliant PR description from git diff |
| `/pr-create` | Creates PR in Azure DevOps via REST API |
| `/pr-spec-review` | Reviews PR against a functional specification |
| `/ado-tasks` | Generates ADO task breakdown from ICEA acceptance criteria |
| `/sprint-metrics` | Measures ICEA compliance rate, PR rejection rate, rework hours via ADO API |

## Skills (Internal Instruction Sets)

26 skills loaded from `skills/<name>/SKILL.md`. Key ones:

| Skill | Purpose |
|---|---|
| `architect` | Detects repo type, deploys templates, populates 8 architecture docs |
| `graph-sync` | Incremental graph refresh; calls `graph-extract-edges.js` for EXTRACTED edges |
| `icea-feature` | Full ICEA drafting gate with critic at Step 5 (icea) and Step 8 (tech) |
| `security` | SAST scan with OWASP/CWE checkers, ledger, dismiss workflow |
| `code-review` | Coverity-style analysis with ledger, cache, scope flags |
| `dream-rollback` | Reverses dream runs using audit trail in `memory/dream-log.md` |
| `plugin-readiness` | Plugin health: infra, model routing, memory, governance, skill quality |

## Gotchas

- Command stubs are deployed to the **target project's** `.claude/commands/` — they are NOT
  active in the plugin repo itself.
- Skills load from `PLUGIN_DIR` at runtime — the path must be current in `plugin-path.txt`.
- Model routing: generation → `ICEA_MODEL`, review → `REVIEW_MODEL`, infra → `INFRA_MODEL`.
  All default to `claude-sonnet-4-6`; generation defaults to `claude-opus-4-6` per `plugin.json`.
