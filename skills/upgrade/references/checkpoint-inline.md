# Upgrade — Checkpoint (extracted to the shared substrate)

> **Moved.** As of Story 2 (ADO-9000), the checkpoint contract is canonical in
> **`skills/shared/migration-ledger-schema.md`** (backed by `scripts/checkpoint-ledger.cjs`). This
> file is a redirect kept only so older references resolve — do not add content here (the shared
> folder is the single source of truth; skill-local copies are forbidden once promoted).

The Upgrade skill writes its checkpoint via `scripts/upgrade-checkpoint.cjs`, now a **thin adapter**
over the shared ledger — it seeds the `payload.upgrade` namespace (`hops`, `baseline_tag`,
`gate_verdicts`) and preserves the exact Story-1 CLI + on-disk shape. Core envelope, merge-write /
tolerant-reader skew-safety, and additive-only rules: see `skills/shared/migration-ledger-schema.md`.
