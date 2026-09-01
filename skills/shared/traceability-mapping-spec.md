# Diff ↔ Requirement Traceability Mapping — Shared Specification
_Spec version: 1.0 · Last changed: 2026-08-28 · Applies to: pr-describe, pr-spec-review
(and checkin Check B transitively via pr-spec-review)_

Single source of truth for mapping a code diff to a requirement set (ICEA Acceptance
Criteria or a functional-spec requirement list). `pr-describe` uses it to attribute each
change to an AC and flag scope creep; `pr-spec-review` uses it to build Part 1 (Spec
Compliance) and Part 3 (Traceability Matrix). Both delegate here so the mapping rules,
status vocabulary, and evidence discipline live in one place.

The mapping is **bidirectional** — the two directions catch different defects:

| Direction | Question | Defect it surfaces |
|---|---|---|
| Requirement → code | Does each AC/REQ have implementing code in the diff? | **Missing** implementation |
| Code → requirement | Does each changed file trace to an AC/REQ? | **Scope creep** |

---

## Inputs (caller-supplied)

1. **Requirement list** — a numbered set of IDs. If the source already has IDs
   (`AC-F1`, `FR-001`, `AC-3`) use them verbatim; otherwise assign `REQ-001`, `REQ-002`, …
   in reading order.
2. **Diff** — changed files + hunks (`git diff <base>..HEAD`), optionally with full source
   context when consent was granted.

---

## Status vocabulary (use these icons + labels exactly)

| Icon | Label | Meaning |
|---|---|---|
| ✅ | IMPLEMENTED | Correctly and completely addressed in the diff |
| ⚠️ | PARTIAL | Partially addressed — state precisely what is still missing |
| ❌ | MISSING | No code in the diff addresses this requirement |
| ❓ | UNCLEAR | Requirement is ambiguous, OR it is runtime behaviour unverifiable from the diff |

A changed file that maps to **no** requirement is **SCOPE CREEP** (not a status above — it is
the code→requirement failure; report it separately per the caller's format).

---

## Evidence rules (mandatory)

- **Every** requirement row and every mapped change carries a `file:line` reference
  (e.g. `src/auth/login.ts:42-67`). Multiple locations comma-separated.
- A requirement with no implementing code → file column is `—` and status is ❌ MISSING
  (or ❓ UNCLEAR if it is unverifiable rather than absent).
- Never mark a requirement IMPLEMENTED without a concrete `file:line` — an untraceable
  claim is treated as ⚠️ PARTIAL at best.
- Never invent behaviour not present in the diff; if the diff shows it but no requirement
  covers it, that is scope creep, not an implemented requirement.

---

## Canonical matrix row

Callers that render a table use this column order:

```
| Req ID | Requirement Title | File(s) + Lines | Status | Risk |
```

`Risk` ∈ Low / Med / High / Critical, reflecting business risk of the gap (not code style).
`pr-describe` may omit the `Risk` column; `pr-spec-review` requires it.

---

## Scope-creep output

A changed file tracing to no requirement:

```
⚠️ SCOPE CREEP — not covered by any Acceptance Criterion:
  {file}: {what it does that no AC/REQ describes}
  Action: add an AC to cover it, or remove the change from this branch.
```

If every change maps to a requirement:

```
✅ Scope check passed — all changes trace to a requirement.
```

---

## Per-caller usage

| Caller | Consumes the mapping as |
|---|---|
| `pr-describe` | Step 3 (attribute each file to an AC) + Step 5 (scope-creep callout). Narrative prose, `Risk` column optional. |
| `pr-spec-review` | Part 1 (per-requirement compliance entries) + Part 3 (full matrix, `Risk` required). Parts 2 (line-level divergences) and 4 (gaps/risks) are review-specific extensions built ON TOP of this mapping, not part of it. |
| `checkin` Check B | Transitive — invokes `pr-spec-review --icea-only`, which uses this mapping. |

---

## Rules

- NEVER skip a requirement silently — an unverifiable one is ❓ UNCLEAR with a reason, never omitted.
- ALWAYS run BOTH directions — coverage alone misses scope creep; scope alone misses gaps.
- `file:line` evidence is mandatory on every implemented/partial row; `—` only for MISSING/UNCLEAR.
- Status icons/labels are fixed by this spec — callers must not invent new ones.
- The mapping is a primitive: it produces the requirement↔code correspondence. Severity of
  divergences, gap/risk analysis, and merge verdicts are the caller's responsibility.
