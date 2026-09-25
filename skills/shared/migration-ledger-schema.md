# Migration-Family Ledger Schema (Upgrade · Rewrite · Replatform)

_Spec version: 1.0 · Last changed: 2026-09-14 · Applies to: upgrade, rewrite, replatform_

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
  "source": { "stack": "dotnet", "from": "6", "to": "8", "roots": ["<repo or additionalDirectories path>"] },
  "source_context": {              // shared intake gate — source-context-intake-spec.md (additive)
    "manifest_path": "docs/migrations/<ado>/source-context-manifest.md",
    "verified": true,
    "roots_expected": ["<repo>", "<dep-A>"],
    "modules_total": 42, "modules_mapped": 39, "modules_out_of_scope": 3, // mapped+out_of_scope==total
    "verified_at": "2026-09-16",
    "summary": {                   // cached display snapshot — written at Step 1.5 PASS (additive, absent-tolerant)
      "coverage_verdict": "full",  // "full" (out_of_scope==0) | "partial"
      "modules_total": 42,         // mirrors top-level fields for ledger-only reads
      "modules_mapped": 39,
      "modules_out_of_scope": 3,
      "partial_row_count": 0       // always 0 on PASS — exit 5 catches reachable PARTIALs
    }
  },
  "stage_gates": { "intake_context": "PASS", "report": "PASS", "verify": "PASS" }, // names differ per skill, shape common
  "phase_history": [ { "phase": "report", "verdict": "PASS", "at": "2026-09-08" } ],
  "decision_log": [],             // ADR / precedent refs
  "judge_verdicts": [],           // per-gate judge output (judge.md)
  "payload": { }                  // per-skill namespaces, opaque to other skills
}
```

`source.stack`/`from`/`to` carry the detector's `SRC.primary.token`/`version` (from
`scripts/migration-source-detect.cjs`) and the chosen target version. `source.roots` (string[],
optional, absent-tolerant) records the source root(s) the detector scanned — the repo and/or
`additionalDirectories` paths (multi-root). Additive; a ledger without it is valid.

`source_context` + `stage_gates.intake_context` are the **shared source-context intake gate**
(`source-context-intake-spec.md`, backed by `scripts/intake-verify.cjs`) — written by all three
skills before options/gap-risk analysis. `intake_context: "PASS"` is set only after
`intake-verify.cjs verify` exits 0; downstream steps call `intake-verify.cjs check-gate`, which
**re-validates** `source_context` rather than trusting the flag (`modules_mapped + modules_out_of_scope
== modules_total`). Additive and absent-tolerant; a ledger without `source_context` is valid.

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

## Status & Resume — orientation + re-entry (all three skills)

`… STATUS ADO-{ID}` and `… RESUME ADO-{ID}` are the migration family's **re-entry points after a
session gap** — the analog of `icea-status`. Both are **uniform across upgrade · rewrite · replatform**
and driven by this one contract. The LEDGER is the authoritative journey record.

### Status (read-only)
`UPGRADE|REWRITE|REPLATFORM STATUS ADO-{ID}` — read-only, never guesses. Delivery-Lead lens (surface
true state + the one next step).

**Step 1 — Load context fresh (read-only).** For the invoking skill `<skill>` and the ADO:
1. Validate and read `.claude/migration/<ado>.checkpoint.json` **first** — this is the machine-written,
   script-validated **primary resume record**. It contains `stage_gates`, `phase_history`,
   `judge_verdicts`, `payload.<skill>`, and all gate verdicts written deterministically by
   `checkpoint-ledger.cjs`. Use it as the **primary orientation source**.
   Before parsing, confirm the file is readable:
   ```bash
   node scripts/checkpoint-ledger.cjs validate --skill=<skill> --ado={ADO_ID}
   ```
   Branch on `status` per the Resume section below. `"ok"` → take `source`, `stage_gates`,
   `phase_history`, `judge_verdicts`, `payload.<skill>`. Tolerate unknown/absent fields;
   missing → "none in progress".
   **The checkpoint JSON is primary. The tracker is supplementary.**
   > Read-only — do NOT use the `checkpoint-ledger.cjs` write CLI (that CLI exists for skew-safe merge
   > *writes*). Reading is a plain JSON load, exactly as `icea-status` reads its files.
2. Read `docs/migrations/<ado>/migration-tracker.md` — this is the human-readable **display artifact**.
   It contains committed artifact paths, open blockers, and a developer-facing status summary.
   Use it to **enrich the render only** (artifact paths, blockers in the render below).
   A stale tracker does not override the checkpoint — resume orientation comes from gate state, not
   tracker prose. If absent, continue from the checkpoint alone.
3. OPTIONAL enrichment (best-effort): if `payload.<skill>` records artifact PATHS (e.g. `report_path`,
   `iac_dir`, `cluster_specs[]`), read those fresh to enrich the render. NEVER guess a path or fabricate
   presence — if the payload doesn't record it, omit it. The ledger, not a filesystem scan, is the map.
4. ICEA/tracker for the ADO (if present) — governing status only.

**Step 2 — Render.**

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      {skill} status — ADO #{ado_id}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Stack:     {source.stack} {source.from} → {source.to}
      Gates:     {each stage_gates}: {name} {✅ PASS | 🔁 REVISE | ⛔ BLOCK | ⬜ unset}
      History:   {phase_history: phase@verdict@at, most recent last}
      Artifacts: {from payload paths, if recorded — else omit}
      Payload:   {one-line skill summary from payload.<skill>}
      Judge:     {last judge_verdicts entry, if any}
      ▶ Next:    {exactly one directive from Step 3}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Step 3 — Next action (derive from ledger state; show exactly one).**

| State (from the ledger) | Next action |
|---|---|
| ledger absent | start it — `UPGRADE\|REWRITE\|REPLATFORM ADO-{ID}` (the one you're doing) |
| a gate = REVISE / BLOCK | resolve it, then re-run that gate (name it) |
| a gate unset & its stage is the first unfinished | `… RESUME ADO-{ID}` — continue at {that stage} |
| generated code/IaC pending write (WRITE PENDING) | `APPROVE ADO-{ID}` — write the reviewed set |
| all gates PASS, work remains | `… RESUME ADO-{ID}` — continue at {next stage} |
| completion gate PASS | nothing — {skill} complete |

Rules: read every file **fresh**; show only fields present (omit, never "undefined"); **NEVER write**; a
skill reads ONLY its own `payload.<skill>` (other payloads opaque). Always end with **exactly one** Next action.

### Resume (`UPGRADE|REWRITE|REPLATFORM RESUME ADO-{ID}`)
Resume = **validate → orient → continue** — uniform for all three skills:

**1. Call `validate` before touching the ledger (required — do not skip).**

```bash
node scripts/checkpoint-ledger.cjs validate --skill=<upgrade|rewrite|replatform> --ado={ADO_ID}
```

Read the JSON `status` field and branch — these three cases are mutually exclusive; do not conflate them:

**(a) `status: "missing"` — ledger file absent (e.g. git-ignored and lost after context overflow)**
> ⚠ RESUME BLOCKED — `.claude/migration/{ADO_ID}.checkpoint.json` is missing.
> If `docs/migrations/{ADO_ID}/migration-tracker.md` exists: read it, orient from its "Next action".
> Recreate the checkpoint before any script call:
> `node scripts/checkpoint-ledger.cjs init --skill=<skill> --ado={ADO_ID}`
> Reply **CONFIRMED** to continue on tracker-only orientation.
> If the tracker is also absent: reply **RESTART** — the developer must run `UPGRADE|REWRITE|REPLATFORM ADO-{ID}` from the beginning.
> **Do NOT auto-recreate. Do NOT advance past this prompt without CONFIRMED or RESTART.**

**(b) `status: "corrupt"` — file present but not valid JSON (write failure / disk error)**
> ⛔ RESUME BLOCKED — `.claude/migration/{ADO_ID}.checkpoint.json` exists but failed to parse (error: `{parse_error}`).
> **Do NOT overwrite or delete the file automatically — it may contain recoverable history.**
> Show the developer the exact file path: `.claude/migration/{ADO_ID}.checkpoint.json`
> The developer must inspect the file, then either:
>   - Repair it to valid JSON and reply **CONFIRMED** (validate will be re-run)
>   - Delete it and run `init` (see status "missing" instructions above), then reply **CONFIRMED**
>   - Reply **RESTART** to discard the migration and begin fresh
> **Do NOT proceed past this point without CONFIRMED or RESTART.**

**(c) `status: "incomplete"` — valid JSON but required fields missing (partial init / version mismatch)**
> ⚠ RESUME DEGRADED — `.claude/migration/{ADO_ID}.checkpoint.json` is present but incomplete.
> Missing fields: `{missing_fields}`.
> Orientation falls back to `docs/migrations/{ADO_ID}/migration-tracker.md` for any missing state.
> Note: `checkpoint-ledger.cjs init` will NOT overwrite an existing file — it returns `exists` unchanged.
> To repair: delete `.claude/migration/{ADO_ID}.checkpoint.json`, then run `init`, then reply **CONFIRMED**.
> Reply **CONFIRMED** to continue on best-available state (tracker primary, checkpoint supplementary).

**(d) `status: "ok"` — proceed normally. No prompt needed; continue to Step 2.**

**2. Run Status** (above) — load the ledger, identify the first unfinished stage/gate.

**3. Hand to the invoking skill**, which continues at that stage per its own stage flow.

**4.** Any state change is written via `checkpoint-ledger.cjs set-gate / set-payload` (skew-safe merge-write).

Read-only orientation first; only the continuation writes. A skill continues from ONLY its own `payload.<skill>`. Other payloads are opaque.

## Governance (bundled standalone)

When a skill is bundled for standalone use, this doc + `checkpoint-ledger.cjs` are copied into the
bundle and drift-checked against canonical (`scripts/vendor-substrate.cjs` /
`scripts/substrate-drift-check.cjs`). Changing the core = bump the substrate semver → re-bundle →
drift-check → ADR → re-validate consumers. See `skills/shared/README.md`.
