# Upgrade — Gap + Risk Report Schema (Workstream C, AC-F3)

> Loaded by `skills/upgrade/SKILL.md` Steps 3–4. This reference defines the **headline deliverable**:
> a decision-grade Gap + Risk report. Facts that populate it are grounded by the LLM (WebSearch) and
> cached + tagged by `scripts/upgrade-knowledge-cache.cjs`. Design of record:
> `docs/plans/migrationSkill/upgrade.md` §C. The report has value **even if the developer never
> proceeds to execution** — that is the point of the skill.

## Grounding & source verification — non-negotiable

Breaking-change / deprecation data is version-specific and post-training; it **cannot** come from
model memory. Every claim in the report carries a **source tag**:

| Tag | Meaning | How it is set |
|---|---|---|
| `VERIFIED` | Traced to an **authoritative** source (official migration guide / release notes / deprecation list), dated | `upgrade-knowledge-cache.cjs` matched the source host to the per-stack official-domain allowlist |
| `INFERRED` | No authoritative source — reasoning or a non-official source only; **confidence lowered** and capped | any other (or absent) source |

Facts are cached in two volatility layers (the cache engine, not the report):
- **Stable delta-KB** `{stack, from, to}` — immutable once the version ships → cache-once, reuse-forever.
- **Volatile tool layer** `{stack}` — "what the tool handles today" → TTL; re-fetch when stale.

The report **must** show, per item, the tag and (for `VERIFIED`) the dated source. Never present an
`INFERRED` claim as settled fact. If grounding was unreachable and the cache was empty, say so and
mark affected items `INFERRED` with lowered confidence — still emit a partial, decision-grade report.

## Feasibility spine (shared engine — GREEN / YELLOW / RED / BLOCKER)

| Verdict | Meaning for an upgrade item |
|---|---|
| 🟢 GREEN | Handled by the deterministic tool; no manual work expected |
| 🟡 YELLOW | Tool-assisted but needs bounded manual residual (review/adjust) |
| 🔴 RED | Not tool-handled; substantial manual remediation, still possible in place |
| ⛔ BLOCKER | No in-place path for this item (e.g. a dependency with no target-compatible version) |

A single ⛔ BLOCKER makes the **overall** verdict RED/BLOCKER — but the report is still produced
(graceful degradation): the developer learns *why* and *what the options are*.

## Report skeleton (emit as markdown)

```
# Upgrade Gap + Risk Report — {stack} {from} → {to}
Generated: {date} · Tool: {tool} ({coverage}) · Residual load: {residualLoad}
Coverage line: this project is on the {STRONG|WEAK} side of tool coverage for {stack}.
Version path (bisectable hops): {from} → … → {to}
Overall feasibility: {🟢|🟡|🔴|⛔} {one-line verdict}

## Breaking changes & gaps
| Item | Area | Feasibility | Source | Resolution options |
|------|------|-------------|--------|--------------------|
| {change} | {api/config/dep/syntax} | {spine} | {VERIFIED — dated url \| INFERRED} | {tool handles \| manual: …} |

## Dependency ledger
| Package | Current | Target-compatible version | Verdict |
|---------|---------|---------------------------|---------|
| {pkg}   | {v}     | {v or "none found"}       | {🟢 \| ⛔ BLOCKER — no version supports {to}} |

## What's possible / blocked / manual
- ✅ Possible (tool-handled): {…}
- ⛔ Blocked: {… + why}
- ✋ Manual residual: {… + rough size}

## Post-upgrade next steps (the ladder)
- {stay on {to}} · {consider Rewrite for {X}} · {consider Replatform for {Y}}

## Assurance & provenance
- Oracle (if the developer proceeds): pre-upgrade **baseline tag** — behavioral (BAL) net.
- Confidence: {n} VERIFIED · {m} INFERRED. Grounding: {live \| cache {date} \| unreachable}.
```

## Rules

- ALWAYS state which side of the tool-coverage line the project sits on (strong vs weak tool) — AC-F3.
- ALWAYS tag every breaking-change claim `VERIFIED` (dated authoritative source) or `INFERRED`.
- NEVER present an `INFERRED` claim as a settled fact, and NEVER fabricate a source to reach `VERIFIED`.
- A dependency with no target-compatible version is a hard ⛔ BLOCKER — never soften it to proceed.
- ALWAYS emit a decision-grade report even on a RED/BLOCKER verdict (value without execution).
