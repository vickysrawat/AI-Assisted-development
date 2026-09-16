# Rewrite — Target Options across Assurance × Effort × TCO (AC-F4)

> Loaded by `skills/rewrite/SKILL.md` Step 2. Present 2–3 target options so the developer chooses with
> eyes open — the tradeoff is three-dimensional, not "which stack is nicest". Design of record:
> `docs/plans/migrationSkill/rewrite.md` T1–T2.

## The three axes (always all three)

| Axis | What it captures |
|---|---|
| **Assurance ceiling** | The best Behavioral Assurance Level this option can reach (see `bal.md`). A source with **no runnable oracle** caps affected clusters at **BAL C/D** — state this up front. |
| **Effort** | One-time build effort — cluster count, re-architecture depth, residual risk. |
| **TCO** | Onboarding cost + **recurring run-cost**, web-grounded and **dated**. Every price is cited to an authoritative source with a retrieval date (volatile cache layer). |

## Presentation format (per option)

```
### Option {n}: {target stack + posture}
- Assurance ceiling: {BAL A|B|C|D} — {why (oracle availability, test surface)}
- DAG shape:         {cluster count · N waves} — basis: INFERRED (target-space projection)
- Effort:            {S/M/L} — {cluster count, re-arch depth, key residual risks}
- TCO:               onboarding {…} · run-cost {$/mo, cited + dated} (source: {url}, {date})
- Pros:  {…}
- Cons:  {…}
```

## Per-option DAG (target-space projection)

There is **no target application yet** at the options phase, so the DAG shown per option is an
**inferred projection** of the source module graph through *that option's* decisions — never the raw
source DAG shown identically for every option (that would erase the very differences the options exist
to expose). Project, then feed the projection to `rewrite-decompose.cjs decompose … --space=target`:

| Posture (from `posture`) | How the source graph projects into target space |
|---|---|
| `port` (same lang + same fw) | Structure-preserving — target ≈ source seams; reusing the source graph is legitimate **here and only here**. |
| `re-architecture` (any lang/fw change) | Reshape per the keep-vs-redesign answers — merge/split modules, add/remove layers, change bounded contexts. Cluster count + waves genuinely differ. |
| `rewrite-from-spec` (no runnable oracle) | Project from the inventory/spec, not the source graph; DAG is coarse and INFERRED. |

The projection is a **design judgment** (the LLM's), fed as `--modules/--edges` (coarse) or a small
per-option graph file to the pure topo-sorter. Its **basis is INFERRED** at this phase per
`options-insight-spec.md`; it is re-derived and promoted to `computed` after `APPROVE DESIGN`, once
`target-component-architecture.md` is authored (SKILL Step 2.5, step 5).

## Grounding rules (run-cost)

- Recurring run-cost is version-/provider-specific and post-training — it **must** be web-grounded, not
  from model memory. Cite the source URL + retrieval date; store it in the **volatile** cache layer
  (`upgrade-knowledge-cache.cjs` volatile layer / migration-knowledge cache), re-fetch when stale.
- If a price cannot be grounded, mark it `INFERRED` and lower confidence — never present it as firm.

## Rules

- ALWAYS show the **assurance ceiling before commit** — the developer must know the best achievable BAL
  for each option, especially when no runnable oracle exists (C/D cap).
- ALWAYS project a **target-space DAG per option** (basis INFERRED); NEVER decompose the source graph
  identically across options — only a `port` posture may reuse the source structure.
- NEVER present a run-cost figure as firm without a dated, authoritative citation.
- Record the chosen option + its ceiling in the shared ledger `payload.rewrite`.
- A BYO design is an alternative to these options — held to the **same** scrutiny (`byo-design.md`).
