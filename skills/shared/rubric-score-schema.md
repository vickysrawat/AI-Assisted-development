# Rubric Score Schema
_Spec version: 1.0 · Created: 2026-08-31_
_Applies to: goal-loop-spec (the engine), icea-implement (Step 4b), migration (Stage 4)_

Shared by: `goal-loop-spec`, `icea-implement`, `migration`

Defines the I/O contract for the **self-scoring agent** — the one new capability
the goal-loop introduces. The scorer measures how much of a goal an in-context
artefact satisfies, against an explicit rubric, and returns a structured score
that the loop uses to decide *continue* vs *stop*.

The scorer answers **"is the work done?"** It does **not** answer "is the work
good?" — that is the critic's job (`skills/critic/SKILL.md`). The two are kept
orthogonal on purpose: a complete-but-unsound artefact must still fail the critic,
and a sound-but-incomplete artefact must still fail the score. See
`goal-loop-spec.md` for how the two compose inside one iteration.

---

## Consent and cost

The scorer is **Category C** — it reads only the in-context artefact plus the
rubric it is handed. It never reads a source file from disk, never writes
anything, assigns no fingerprints, and keeps no ledger. It is ephemeral, exactly
like the critic. Governed by `source-file-consent.md`.

---

## Inputs

The caller (the engine, on behalf of `icea-implement` or `migration`) passes:

| Input | Type | Description |
|---|---|---|
| `goal` | string | One-line statement of what "done" means. ICEA: the **Goal** one-liner. Migration: the stage objective. |
| `rubric` | array | Ordered list of criteria to score against. See below. **Must be the criteria text verbatim** — never a paraphrase (a paraphrased rubric optimises the wrong target). |
| `rubric[].id` | string | Stable criterion id. ICEA: the AC id (`AC-F1`, `AC-NF2`). Migration: a stage-rubric id (`SR-1`). |
| `rubric[].text` | string | The criterion, verbatim from its source (ICEA Acceptance section / tracker, or the stage-completion rubric). |
| `rubric[].type` | string | `functional` \| `non-functional` \| `structural`. |
| `artifact` | in-context | The current output being scored — generated code (icea-implement) or a cluster's written files + build/test result (migration). Passed in context; not a disk path. |

---

## Output (schema version 1.0)

The scorer is forced to emit exactly this structure — nothing else:

```json
{
  "_schema": "1.0",
  "goal": "Matter list is filterable by client with server-side paging",
  "scoredAt": "YYYY-MM-DDTHH:MM:SSZ",
  "criteria": [
    {
      "id": "AC-F1",
      "text": "User can filter the matter list by client id",
      "type": "functional",
      "verdict": "PASS",
      "evidence": "MatterController.Filter() applies clientId to the WHERE clause — MatterController.cs:42",
      "remaining": ""
    },
    {
      "id": "AC-F2",
      "text": "Filtering is server-side with paging",
      "type": "functional",
      "verdict": "PARTIAL",
      "evidence": "Server-side WHERE present, but no OFFSET/FETCH paging in the query",
      "remaining": "Add paging (page size + offset) to the filter query and expose page params on the endpoint"
    },
    {
      "id": "AC-F3",
      "text": "An audit row is written on each filter export",
      "type": "functional",
      "verdict": "FAIL",
      "evidence": "No audit write exists anywhere in the generated code",
      "remaining": "Write an audit-log row inside the export path"
    }
  ],
  "summary": {
    "passCount": 1,
    "partialCount": 1,
    "failCount": 1,
    "total": 3,
    "percentDone": 50,
    "blocking": ["AC-F3"]
  }
}
```

---

## Field definitions

| Field | Type | Description |
|---|---|---|
| `_schema` | string | Schema version — always `"1.0"` |
| `goal` | string | Echoed from the input |
| `scoredAt` | ISO datetime | When the score was produced |
| `criteria` | array | One entry per rubric criterion — never fewer, never merged |
| `criteria[].id` | string | Echoed from `rubric[].id` |
| `criteria[].text` | string | Echoed from `rubric[].text` (verbatim) |
| `criteria[].type` | string | Echoed from `rubric[].type` |
| `criteria[].verdict` | string | `PASS` \| `FAIL` \| `PARTIAL` — see verdict rules |
| `criteria[].evidence` | string | Concrete pointer (`file:line` or artefact ref) that justifies the verdict. **A verdict without evidence is invalid.** |
| `criteria[].remaining` | string | The concrete, actionable delta still to do. Empty **only** when `verdict == PASS`. |
| `summary.passCount` | number | Count of `PASS` criteria |
| `summary.partialCount` | number | Count of `PARTIAL` criteria |
| `summary.failCount` | number | Count of `FAIL` criteria |
| `summary.total` | number | `criteria.length` — must equal the rubric length |
| `summary.percentDone` | number | **Derived, not free-hand** — see formula |
| `summary.blocking` | array | The ids of every `FAIL` criterion. Empty ⇒ nothing blocks "done". |

---

## Verdict rules

| Verdict | Means | `remaining` |
|---|---|---|
| `PASS` | The criterion is fully and verifiably satisfied by the artefact | empty |
| `PARTIAL` | Some of the criterion is met; a concrete, bounded gap remains | the gap |
| `FAIL` | The criterion is not addressed, or is addressed incorrectly | what to do |

- Every verdict **must** cite evidence in `evidence`. "Looks done" is not evidence.
  "In my experience" is not evidence. Only the artefact and the rubric are truth
  (subordinate to `CLAUDE.md` §3 — do not assume).
- The scorer must not treat its **own prior reasoning** as evidence — only the
  current artefact and the rubric. Each score is fresh.
- When uncertain whether a criterion is met, score it `PARTIAL` or `FAIL`, never
  `PASS`. Optimism is the failure mode this contract guards against (see
  `goal-loop-spec.md` risk R1).

---

## The percentDone formula (deterministic)

`percentDone` is computed, not judged:

```
percentDone = round( 100 * (passCount + 0.5 * partialCount) / total )
```

The scorer fills in the counts by verdict and applies this formula verbatim.
It never writes a percentage that the counts do not produce. A consumer may
recompute it from the counts and treat a mismatch as an invalid score.

"Goal met" (the engine's success exit) is defined precisely:

```
percentDone == 100  AND  blocking is empty
```

Equivalently: every criterion is `PASS`. A `PARTIAL` can never reach 100%, so a
run with any `PARTIAL` or `FAIL` is not done.

---

## Hard rules

- **One criterion in, one criterion out.** `criteria.length == total == rubric.length`.
  The scorer never drops, merges, or invents criteria.
- **Evidence is mandatory.** Every verdict cites a concrete artefact reference. A
  criterion without evidence is an invalid score and the caller must re-request it.
- **`percentDone` is derived.** It is the fixed formula over the counts — never a
  free-hand number.
- **The scorer measures completion, not quality.** It never comments on style,
  simplicity, or soundness — that is the critic's domain. Keeping the two separate
  is what lets them coexist.
- **Category C always.** The scorer reads only the in-context artefact and the
  rubric. It never reads source from disk, never writes, never fingerprints.
- **Rubric text is verbatim.** The caller passes criteria exactly as written in the
  ICEA/tracker or stage rubric; the scorer echoes them unchanged.
