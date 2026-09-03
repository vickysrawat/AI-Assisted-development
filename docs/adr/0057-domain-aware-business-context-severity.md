# 0057 — Business-context severity is domain-aware (decoupled from the legal domain)
Status: Accepted · Date: 2026-09-01
Governs: `skills/shared/business-context-severity.md` · `skills/shared/business-context-presets.md` · `skills/shared/business-context-grounding.md` · `skills/shared/business-context-generation.md` · `agents/bc-searcher.md` · `agents/bc-synthesizer.md` · `.claude/hooks/web-grounding-guard.cjs` · ~20 review skills · `skills/migration/**`

> **Relation to ADR 0015:** ADR 0015 established *that* business context overrides technical
> severity (the "floors, not ceilings" principle). That principle is **unchanged**. ADR 0015 is
> retained unmodified (immutable historical record). This ADR changes only *where the
> domain-specific triggers come from* — from a hardcoded legal table to a per-project artifact.

## Problem

`skills/shared/business-context-severity.md` lived in `$PLUGIN_DIR` (installed once, shared
read-only across every target project) and hardcoded the **legal/immigration** domain: a fixed
`B1–B7` table naming attorney-client privilege, immigration A-Numbers, hearing dates, and pro
bono clients. Three consequences:

1. **Wrong triggers for non-legal projects.** A fintech, healthcare, or e-commerce app that
   installed the plugin inherited legal severity rules and legal example phrasing.
2. **Diffuse coupling.** The legal shape wasn't confined to one file — ~20 review skills
   referenced the fixed count `B1–B7` and ~7 hardcoded legal examples ("attorney-client",
   "A-Number", "matter data") inline.
3. **No domain identification anywhere** in setup-init or architect.

## Decision

Split the one overloaded spec into single-responsibility modules and make the domain-specific
triggers a **per-project artifact**, resolved project-local-first with a neutral fallback.

- **Trigger model:** a **variable-length B-series** referenced *generically* ("apply the
  B-series triggers from the resolved file"). The count is domain-defined — not a fixed 7.
- **`business-context-severity.md`** → domain-neutral *model* + a neutral fallback B-series +
  a project-local resolution pointer.
- **`business-context-presets.md`** → per-domain seed content. `legal` is a **verbatim-locked**
  table (reproduces the original B1–B7 byte-for-byte — regression safety for the origin
  deployment); healthcare/fintech/ecommerce/govtech/generic are **seed checklists**.
- **`business-context-generation.md`** → the single SRP owner of *produce the policy* (infer +
  confirm domain/jurisdiction → ground → synthesize → write `.claude/business-context.md` under
  the `APPROVED` gate, idempotent). architect, setup-init, the `SET DOMAIN` handler, and
  migration are **thin callers**.
- **`business-context-grounding.md`** → a bounded, goal-based web-grounding loop that grounds
  the B-series in cited regulatory frameworks (HIPAA/PCI/GDPR/…) for `{domain, jurisdiction}`.
- Domain recorded in **CLAUDE.md** (`Domain:` line) + `dream-init-state.json.domain`;
  **not** in `config.json` (no compiled script consumes it).

**No-project-data enforcement (structural, not prose).** Grounding runs in two
capability-separated subagents — `bc-searcher` (frontmatter `tools: WebSearch, WebFetch` only,
fresh isolated context seeded with `{domain, jurisdiction}` via a fixed template) and
`bc-synthesizer` (no web tool). A project-level PreToolUse hook `web-grounding-guard.cjs` is the
deterministic backstop: it denies any grounding web query that collides with a project
identifier or fails the regulatory-grammar allowlist, honours the `BUSINESS_CONTEXT_GROUNDING`
kill-switch, and audit-logs every attempt. (Verified: project-level PreToolUse hooks fire for
and can block subagent tool calls.)

## Consequences

**Positive:**
- Each project gets domain-appropriate triggers; the origin legal deployment reproduces today's
  B1–B7 exactly (verbatim-locked preset + `APPROVED` diff).
- Domain knowledge is centralized to one authority; skills are read-only consumers — pays down
  the prior scattered-legal-knowledge SRP debt.
- Migration targets inherit the source's domain (M2–M5); golden-master drift on a B-series path
  blocks MIGRATION COMPLETE.
- The plugin's first outbound network capability is bounded, kill-switchable, and structurally
  incapable of leaking project data.

**Negative / trade-offs:**
- First outbound-network capability for an otherwise offline-first plugin — mitigated by the
  guardrails + default kill-switch flag.
- Grounding is non-deterministic (web results evolve) — mitigated by citations + retrieval date
  + the human `APPROVED` gate.
- Larger blast radius: ~20 behavior-critical files (Phase 1) + a ~38-file cosmetic
  `B1–B7`→`B-series` rename (Phase 2).

## Alternatives rejected

**A) Fixed B1–B7 slots, swap content per domain** — rejected: re-embeds the legal shape;
fintech/e-commerce get empty B4/B6 slots and miss their real categories.

**B) Authoritative canned per-domain tables** — rejected: makes the plugin author a HIPAA/PCI
authority (shallow/wrong risk) + 6 tables to maintain; "other" still needs generation.

**C) Generation embedded inside architect** — rejected (SRP): gives architect two reasons to
change and forces migration to duplicate the logic. Extracted to a shared module instead.

**D) Prose-only "don't put project data in queries" guardrail** — rejected: an instruction the
LLM can ignore. Enforced structurally via capability separation + a deterministic hook.

## Files affected

| File | Change |
|---|---|
| `skills/shared/business-context-severity.md` | De-legalized → model + neutral variable-length B-series + resolution pointer |
| `skills/shared/business-context-presets.md` | New — legal (verbatim-locked) + 5 seed checklists |
| `skills/shared/business-context-grounding.md` | New — grounding loop + enforcement contract |
| `skills/shared/business-context-generation.md` | New — SRP owner (identify→ground→synthesize→write) |
| `agents/bc-searcher.md` · `agents/bc-synthesizer.md` | New — capability-separated grounding subagents |
| `.claude/hooks/web-grounding-guard.cjs` (+ `_project-deploy/`) | New — PreToolUse deny hook |
| `.claude/settings.json` · `scripts/setup-init-bootstrap.cjs` | Wire hook + `BUSINESS_CONTEXT_GROUNDING`; `HOOK_FILES` += hook |
| ~20 review skills (code-review, security, checkin, critic, app-readiness, dynamic-scan, pr-spec-review, icea-*, shared specs) | Project-local resolution + B-series wording + genericized examples |
| `skills/architect/SKILL.md` · `skills/setup-init/SKILL.md` | Thin callers of the generation module |
| `skills/migration/**` | M2–M5 domain-aware migration integration |
| `CLAUDE.md` · `_project-deploy/CLAUDE.md` | `Domain:` line + `SET DOMAIN` §0a handler |
| `skills/setup-teardown/SKILL.md` · `scripts/setup-teardown.cjs` | Never-remove `.claude/business-context.md` |
| `tests/validate.js` | B-series check count-agnostic + legal-preset regression check + shared/agents registration |
| `.claude-plugin/plugin.json` | Register 3 shared + `agents` component; version 3.16.0 |
| `docs/migrations/027-3.16.0.md` | New — setup-sync backfill via `SET DOMAIN` |
| `docs/adr/README.md` | This ADR indexed |
