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
| 0017 | Domain-map: architecture orientation in one read | Accepted |
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
