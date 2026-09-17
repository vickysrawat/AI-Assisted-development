# ADR 0064 — business-context.md is mandatory; setup-sync actively prompts to generate it

Date: 2026-09-16 · Status: Accepted · Extends ADR 0057 (domain-aware B-series)

## Context

ADR 0057 introduced `.claude/business-context.md` as the project-local B-series severity
policy, generated once during `setup-init` via the architect skill. Every review skill
(security, code-review, checkin, critic, app-readiness, go-live) consumes it; when absent
they fall back silently to the neutral six-trigger B-series.

Two gaps emerged:

1. **`setup-sync` never creates the file.** A project provisioned before 0057 (or on an
   older plugin version) that runs `/setup-sync` to upgrade gets all hooks, rules, and stubs
   refreshed — but no business-context.md. All reviews silently degrade to the neutral
   fallback with no warning. The developer has no prompt to act.

2. **`setup-status` treated absence as Amber.** A missing business-context.md was surfaced
   as a warning, not a failure. Given that every review skill depends on it for domain-aware
   severity, absence is a configuration gap that blocks correct governance, not a soft advisory.

## Decision

- **`setup-status` check 1v** — classified as ❌ Red (not ⚠️ Amber) when
  `.claude/business-context.md` is missing or is an unpopulated stub (first line contains
  `⚠ Not yet generated`). A missing file rolls up to "❌ Needs initialisation" in the
  overall health verdict. Provides the exact remediation: `SET DOMAIN` (with the
  prerequisite to run `/architect` first if `architecture-data.md` is not populated).

- **`setup-sync` Step 6b** — after the mechanical re-provisioning steps complete, check
  whether `.claude/business-context.md` exists and is populated. If absent or stub: detect
  whether `architecture-data.md` is populated (using the two-signal test from
  `arch-populated-detect.md`), then ask one `AskUserQuestion` prompt offering to generate
  the policy immediately (or, if arch-data is missing, to run `/architect` first). On Yes,
  invoke `business-context-generation.md` directly (or `/architect` → generation). On No,
  the Step 7 summary shows a brief reminder line. This converts a passive reminder into an
  active, in-flow offer at exactly the moment the developer is already attending to project
  health.

## Consequences

- Projects upgrading via `setup-sync` that lack a business-context.md are now prompted
  to generate one immediately, rather than discovering the gap through stale reviews.
- `setup-status` accurately reflects that missing domain-aware severity is a blocking
  gap, not a minor advisory. This aligns 1v with the severity of the actual impact
  (all reviews degrade silently).
- The APPROVED gate in `business-context-generation.md` is unchanged — the developer
  still owns the final write decision.
- Rollback: remove Step 6b from setup-sync; revert 1v to Amber. No data is lost.

## Alternatives rejected

- Keep 1v as Amber — understates the impact; a team running `setup-status` to verify a
  healthy setup would miss a gap that silently degrades every review.
- Auto-generate without prompting in setup-sync — business-context requires domain +
  jurisdiction confirmation and an APPROVED gate; silent generation violates the human
  checkpoint principle from ADR 0057.
