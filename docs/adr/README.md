# Architecture Decision Records

One short file per architectural decision: the problem, the decision, the
rationale, and what would make us revisit it. The *why* must live in the repo,
not in the maintainer's head — this directory is the bus-factor insurance.

Rules:
- Every new shared spec, gate, or enforcement mechanism gets an ADR
- ADRs are immutable once accepted; a reversal is a NEW ADR superseding the old
- Format: `NNNN-short-title.md`, ~half a page, no longer

| # | Decision | Status |
|---|---|---|
| 0001 | ICEA approval gate before code generation | Accepted |
| 0002 | Output-gated enforcement over input-triggered | Accepted |
| 0003 | Shared primitives layer as single source of truth | Accepted |
| 0004 | Dismissed findings: fourth ledger state with audit trail | Accepted |
| 0005 | Mechanical enforcement floor (hooks) beneath prompt gates | Accepted |
| 0006 | Diff-classified change tiers (T1/T2/T3) | Accepted |
| 0007 | Memory citation telemetry and audit loop | Accepted |
| 0008 | Deprecation policy: telemetry-driven removal reviews | Accepted |
| 0009 | Server-side authoritative enforcement; defaults are policy | Accepted |
| 0010 | Local-only authoritative enforcement (supersedes 0009's deployment claim) | Accepted |
| 0011 | Trust calibration loop: declared plans, measured accuracy, earned autonomy | Accepted |
| 0012 | Critic layer: second-pass review between generation and disk | Accepted |
| 0013 | Source-file consent model (Category A/B/C) | Accepted |
| 0014 | Finding-producing skill contract | Accepted |
| 0015 | Business-context severity overrides (B1–B7) | Accepted |
| 0016 | Cache-aware scanning and token efficiency | Accepted |
| 0017 | Domain-map: architecture orientation in one read | Superseded by 0038 |
| 0018 | Language-agnostic design | Accepted |
| 0019 | Code-review hybrid: deterministic + probabilistic (Phase D/P) | Accepted |
| 0020 | Baseline strategy: pre-existing findings never gate | Accepted |
| 0021 | Behavioural eval suite | Accepted |
| 0022 | Guide versioning contract | Accepted |
| 0023 | Model routing tiers | Accepted |
| 0024 | Async checkpoint queue (proposal, v0.9) | Proposal |
| 0025 | VCS-aware ignore-file selection (.gitignore / .tfignore) | Accepted |
| 0026 | Version drift detection and re-provisioning on upgrade | Accepted |
| 0027 | ICEA re-run revises (not overwrites), and re-blocks the gate | Accepted |
| 0028 | Write Gate — APPROVE ADO-{ID} required before source code and config writes; ICEA, Tech Spec, Epic doc and Tracker written immediately for review | Accepted |
| 0029 | ICEA and Tech Spec hierarchical folder structure; Epic structure added in v1.32.0 | Accepted |
| 0030 | Dedicated /icea-revise command for ICEA and Tech Spec revision | Accepted |
| 0031 | ICEA state model — disk-based, session-independent | Accepted |
| 0032 | Global keyword handlers for ICEA workflow | Accepted |
| 0033 | Single responsibility boundary between icea-feature, icea-approve, and icea-implement | Accepted |
| 0034 | Interactive draft-then-save flow for ICEA and Tech Spec | Accepted |
| 0035 | Plan phase integrated into icea-feature — plan feeds ICEA | Accepted |
| 0036 | temp/ rendering aid pattern and TEMP_WRITE_EXEMPT convention | Accepted |
| 0037 | Roadmap proposals live in docs/proposals/, outside shared specs and the manifest | Accepted |
| 0038 | Knowledge graph is the single codebase-orientation layer (supersedes 0017; domain-map retired) | Accepted |
| 0039 | graph.json sidecar — machine-readable structure of record; markdown is its projection (typed edges, confidence, module-wide fingerprints) | Accepted |
| 0040 | CLAUDE.md context budget — ≤ ~200 lines, set by instruction adherence not context-window capacity | Accepted |
| 0041 | EXTRACTED graph edges derived deterministically by a script (import parsing), not by the model | Accepted |
| 0042 | Frontmatter-based rule deployment — self-describing `detect:` blocks + dream-init discovery loop (replaces the hardcoded table) | Accepted |
| 0043 | Ecosystem and layered rule organisation — 43-file rule set, Layer 0–4 backend, meta-framework exclusion logic | Accepted |
| 0044 | directoryCatalog in graph.json — pre-built static-serving/config/test index consumed by security (with fallback) | Accepted |
| 0045 | Security skill free-form risk analysis — evidence-cited LLM pass, no CVSS, no ledger writes | Accepted |
| 0046 | dream-init bootstrap pattern — deterministic .cjs script handles all mechanical work; LLM acts only on `needsLLMPopulation`; rules deployed after architect/graph-sync; manifest is the crash-recovery checkpoint | Accepted |
| 0047 | Expert Personas — a role axis orthogonal to model routing; 13 named identity cards, stack-agnostic, governance-subordinate, reasoning-only, two tiers (judgment/mechanical) | Accepted |
| 0048 | Node-only runtime (no runtime python3 in commands/skills) + canonical `plugin-state.cjs` for version resolution — never build a plugin path from a version, never read relative plugin.json, never crawl the cache | Accepted |
| 0049 | Memory capture uses UserPromptSubmit hook with JSON `additionalContext` — Stop hooks do NOT support additionalContext (schema validation fails); guard via `dream-init-state.json` | Accepted |
| 0050 | Architecture doc set expands from 4 to 8 (data/integrations/security/decisions) + two Mermaid diagrams in architecture.md | Accepted |
| 0051 | Architect templates deduplicated — shared base (`_shared/`) + per-stack overrides, composed by the bootstrap (supersedes 0050's "no bootstrap change needed") | Accepted |
| 0052 | Critic wired into icea-feature at two planning-time gates (ICEA draft Step 5, Tech Spec draft Step 8) with bounded auto-revise; new `tech` mode; extends 0012 | Accepted |
| 0053 | Architecture-doc population uses a two-signal detector (retained `<!-- TEMPLATE -->` marker + scaffold-only body tokens); bootstrap no longer strips the marker; corrects the strip introduced with 0051 | Accepted |
