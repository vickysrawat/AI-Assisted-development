# ADR 0062 — Migration family owns its source/target mode on the ledger (de-couple from checkpoint-schema)

Date: 2026-09-14 · Status: Accepted · Completes the ADR 0061 family split; narrows ADR 0060's detector-output home

## Context
When the monolithic `migration` skill was split into the Upgrade · Rewrite · Replatform family
(ADR 0061), the family got its own persistent journey ledger (`migration-ledger-schema.md`,
`.claude/migration/<ado>.checkpoint.json`). But two blocks describing the retired skill's single
`.claude/migration-checkpoint.json` were left behind in `checkpoint-schema.md` — the scan-resume
checkpoint whose real owners are `code-review` and `security`:

1. The **`mode` block** (`schema_version 1.11`: `source_token`/`source_version`/`target_version`/
   `target_token`/`graph`/`track`/`source_roots`). Its stack+version fields duplicate the ledger's
   CORE `source: {stack, from, to}`. The family SKILLs never read this block; only `feasibility-spec.md`
   still used the `mode.*` vocabulary and `validate.js` asserted the file contains `source_roots`.
2. The **`goalLoop` block** — whose only cross-turn writer was the retired skill's Stage 4.
   `code-review`/`security` run no goal loop and `icea-implement` explicitly does not persist it,
   so the block had no live writer.

The result was a phantom dependency: the migration family appeared to depend on `checkpoint-schema.md`
purely through leftover documentation and one mis-pointed test assertion.

## Decision
Make the migration family fully self-contained on its own ledger and strip the retired-skill residue
from `checkpoint-schema.md`:
- Add `source.roots` (string[], optional, absent-tolerant) to the ledger CORE `source` object —
  additive-only, no `schema_version` bump. This is the one `mode` field with no existing ledger home.
- Realign the two remaining `mode.*` consumers to the ledger vocabulary: `feasibility-spec.md`
  (`mode.source_version`/`target_version` → `source.from`/`source.to`) and the
  `migration-source-detect.cjs` header comment.
- Repoint the `validate.js` multi-root assertion from `checkpoint-schema.md` to
  `migration-ledger-schema.md` (assert `source.roots`).
- Remove both orphaned blocks (`mode` + `goalLoop`) from `checkpoint-schema.md`, leaving it purely the
  `code-review`/`security` scan-resume spec; realign the `goal-loop-spec.md` cross-drop guidance to the
  parent's own checkpoint/ledger rather than the deleted block.
- Re-vendor the changed governed substrate and record this ADR.

## Consequences
- `checkpoint-schema.md` regains a single responsibility (scan-resume for code-review/security);
  the migration family no longer references it at all.
- No behavioural change: `source_token`/`source_version`/`target_version` were already carried by the
  ledger `source` object; `source_roots` moves rather than disappears; `graph`/`track`/`target_token`
  were unreferenced dead fields.
- `validate.js` keeps enforcing multi-root documentation, now against the correct file.
- Governed substrate (`migration-ledger-schema.md`, and the globbed `checkpoint-schema.md`) must be
  re-vendored; the migration-ledger CORE change is additive, honouring its additive-only rule.
- Rollback: revert this change set; the fields return to `checkpoint-schema.md`.

## Alternatives rejected
- Keep the `mode` block in `checkpoint-schema.md` — perpetuates a cross-purpose dependency the
  family never reads; contradicts ADR 0061's "family owns its ledger".
- Move the whole `mode` block verbatim into the ledger — re-imports dead fields (`graph`/`track`/
  `target_token`) and a duplicate of `source`; only `source_roots` lacks a home.
- Delete `source_roots` outright — loses multi-root scan documentation that `validate.js` guards.
