# Shared spec: WRITE GATE — full detail

The operative rule lives in `CLAUDE.md` §0 (always-active). This spec holds the
supporting detail moved out of CLAUDE.md to keep session context lean. Skills may read
this when they need the full artefact-timing table or the edge-case list.

## Artefact write-timing table

| Artefact | When written |
|---|---|
| `temp/ADO-{ID}-icea.md` | On SAVE PLAN — draft rendering aid, deleted on SAVE ICEA |
| `temp/ADO-{ID}-tech.md` | On SAVE ICEA — draft rendering aid, deleted on SAVE TECH |
| `*.plan.md` | On SAVE PLAN ADO-{ID} |
| `*.icea.md` | On SAVE ICEA ADO-{ID} — after plan saved and ICEA reviewed in temp/ |
| `*.techspec.md` | On SAVE TECH ADO-{ID} — after ICEA saved and Tech Spec reviewed in temp/ |
| `*.epic.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `*.tracker.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `memory/` | Automatic on trigger — no gate (Dream pipeline) |
| Source code, config files | Blocked until `APPROVE ADO-{ID}` |

## The gate holds — no exceptions for source code and config files

The APPROVE requirement applies even when:
- An ICEA has been approved
- The critic has passed
- A previous step already confirmed the approach
- The developer seems impatient or in a hurry

Partial responses do not count as approval. For multiple files, all paths are listed in a
single WRITE PENDING prompt, and a single `APPROVE ADO-{ID}` releases them together.

## Rationale

The gate fires on what the model is about to **produce**, not on what the developer typed
(ADR 0002, output-gated enforcement; ADR 0028, write gate). Keeping the operative rule in
CLAUDE.md (loaded every session) — rather than in a `paths`-scoped rule — is what makes it
fire during planning, before any file is edited.

## Batch / session approval — `APPROVE ALL ADO-{ID}`

Per-file approval is the default and the safest. For a large, already-reviewed multi-file
plan, the developer may grant a **standing** Write-Gate approval for the current plan/ADO:

`APPROVE ALL ADO-{ID}` — standing approval for every source/config write in this session's
work on ADO-{ID}. The model still **streams the diff + path for each file before writing it**
(visibility is never removed) but does not stop-and-wait per file.

- **Scope:** current session + current ADO/plan only. Never persists across sessions; a new
  session starts back at per-file approval.
- **Revoke:** `REVOKE ALL ADO-{ID}` (or `STOP BATCH`) returns to per-file `APPROVE ADO-{ID}`.
- **Still shown + auditable:** each write is preceded by its diff + path and a one-line
  `✍ Writing under APPROVE ALL — {path}` marker.
- **Does NOT widen scope:** covers only files within the approved plan's Change Manifest /
  stated file set; a write outside that set falls back to a per-file WRITE PENDING prompt.

## Gate orthogonality — the gates guard different risks

Independent gates; never collapse them into one switch:

| Gate | Guards against | Skippable? |
|---|---|---|
| Feature Gate (ICEA) | building without thinking | `/skip-icea` (Feature Gate ONLY; warns once) |
| Write Gate (per-file APPROVE) | wrong path, hallucinated content, clobbering | `APPROVE ALL ADO-{ID}` removes the per-file *pause* — never the visibility |
| Secrets scan | leaking credentials | NEVER — no flag (`secrets-scan-spec.md`) |
| Findings gate | shipping known Critical/High | `--skip-security-gate` + written justification only |

`/skip-icea` never affects the Write/Secrets/Findings gates. `APPROVE ALL` never affects the
Feature/Secrets/Findings gates. Secrets is never skippable by any flag. A future "fast mode"
may compose ONLY the skippable gates, must be loudly logged, and STILL shows diffs.
Rejected: a single "no gates" flag — it conflates orthogonal risks and removes the last line
of defence before an irreversible disk write.
