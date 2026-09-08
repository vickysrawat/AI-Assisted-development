# Migration-Family Ledger Schema (Upgrade · Rewrite · Replatform)

_Spec version: 1.0 · Last changed: 2026-09-08 · Applies to: upgrade, rewrite, replatform_

> **Not the same as `checkpoint-schema.md`.** That file is the brownfield **scan-resume** checkpoint
> for `code-review` / `security` (ephemeral, three-pass, delete-on-completion). This file is the
> persistent **migration journey ledger** — one per ADO, a hand-off contract across the migration
> family. Backed by `scripts/checkpoint-ledger.cjs`. Origin: extracted from Story-1's inline
> `skills/upgrade/references/checkpoint-inline.md` at the second consumer (rule-of-three).
> Design of record: `docs/plans/migrationSkill/README.md` "Shared checkpoint schema".

## One ledger per ADO

There is a **single** ledger per project/ADO — the record of the whole migration journey
(`upgrade → hand-off → rewrite → …`). A single active writer is assumed
(`single-writer-assumption.md`). Location: `.claude/migration/<ado>.checkpoint.json` (override with
`--file`). This is runtime state — **git-ignored, never committed**.

## Envelope + core / payload split

**Shared CORE** — the hand-off contract. **Versioned, additive-only, drift-checked.** Never remove or
repurpose a core field; only add.

```jsonc
{
  "schema_version": "1.0",
  "skill": "upgrade",              // discriminator — which skill last wrote
  "ado_id": "9000",
  "created_at": "2026-09-08",
  "updated_at": "2026-09-08",
  "source": { "stack": "dotnet", "from": "6", "to": "8" },
  "stage_gates": { "report": "PASS", "verify": "PASS" },   // names differ per skill, shape common
  "phase_history": [ { "phase": "report", "verdict": "PASS", "at": "2026-09-08" } ],
  "decision_log": [],             // ADR / precedent refs
  "judge_verdicts": [],           // per-gate judge output (judge.md)
  "payload": { }                  // per-skill namespaces, opaque to other skills
}
```

**Skill-owned PAYLOAD** — each skill owns `payload.<skill>`, versioned by that skill, NOT part of the
shared contract and opaque to the others:

```jsonc
"payload": {
  "upgrade":    { "hops": ["7","8"], "baseline_tag": "pre-upgrade/dotnet-6", "gate_verdicts": {} },
  "rewrite":    { "clusters": [], "BAL": {}, "ERL": null, "DAG": [], "posture": "port" },
  "replatform": { "resources": [], "IaC": [], "NFR": {} }
}
```

## Merge-write / tolerant reader — the skew-safety rule

`checkpoint-ledger.cjs` **never rebuilds the file**. Every write:
1. reads the whole ledger,
2. normalizes only the substructures the writer owns (ensures they exist — never overwrites data),
3. changes only the owned keys (`stage_gates`, `phase_history`, `payload.<skill>`, timestamps),
4. writes it back **preserving every other field** — including keys this version does not recognise.

This keeps the ledger **skew-safe**: `upgrade@2.0` and `rewrite@2.1` can share one ledger without
clobbering each other. The core is **additive-only**.

## Operations (`scripts/checkpoint-ledger.cjs`)

Library API (`require`): `coreEnvelope`, `load`, `save`, `normalize`, `ensurePayload`, `setGate`,
`setPayload`. Generic CLI:

| Op | Effect |
|---|---|
| `init --skill --ado` | create the ledger if absent (idempotent) |
| `get --skill --ado` | read it (exit 7 if absent) |
| `set-gate --skill --gate --verdict` | record a stage-gate verdict + append `phase_history` (merge-write) |
| `set-payload --skill --key/--value \| --payload-json` | merge into `payload.<skill>` (merge-write) |

A skill MAY wrap the generic CLI with a skill-specific adapter that seeds its payload skeleton and maps
its own flags — e.g. `scripts/upgrade-checkpoint.cjs` (preserves the Story-1 upgrade CLI + on-disk
shape). Adapters MUST NOT change the core shape.

## Governance (vendored standalone)

When a skill is vendored for standalone use, this doc + `checkpoint-ledger.cjs` are copied into the
bundle and drift-checked against canonical (`scripts/vendor-substrate.cjs` /
`scripts/substrate-drift-check.cjs`). Changing the core = bump the substrate semver → re-vendor →
drift-check → ADR → re-validate consumers. See `skills/shared/README.md`.
