# Phase-1 Spike — scratch/reference artifacts (DISPOSABLE)

> ⚠ Disposable feasibility code — NOT plugin source. Please gitignore `spike/` (I did not auto-edit
> `.gitignore` — project rule says ask first). Protocol: `docs/plans/2026-08-14-phase1-spike.md`.

## What's settled vs what to validate
- **H3 (CI required-check = hard merge gate): ACCEPTED as known-good** (battle-tested GA GitHub feature).
  The Copilot HARD guarantee rests entirely on this. `ai-gate.yml` below is the reference workflow.
- **H1 / H2 / H4: optional client-side validation** — they only affect *authoring/review feedback
  quality*, not whether governance holds. Run them when convenient.

## Artifacts here
| Path | Serves | Type |
|---|---|---|
| `reference/ai-gate.yml` | H3 — the required-check merge gate (the Copilot hard floor) | CI workflow |
| `reference/vscode-settings.json` | Copilot scoping incl. `chat.hookFilesLocations` (F1.2) | VS Code settings |
| `skills/review-icea/SKILL.md` | H2 — critic-as-code-review-skill that loads the ICEA | Copilot skill |
| `fixtures/ADO-9999-demo.icea.md` | H2 — a 2-AC test ICEA to gate a diff against | test fixture |

## The `ai-gate` runner (drop-in — provided as a spec, not yet written as a script)
`reference/ai-gate.yml` calls `node spike/ai-gate.mjs`. When you want the runner, ask me to write it —
I'll include the mandatory 5-point script-transparency block. Reference behaviour:
1. **Reads** the PR's changed source files (from `git diff --name-only origin/BASE...HEAD`).
2. **Locates** the approved ICEA under `docs/Release*/Sprint*/UserStory*/ADO-<id>-*.icea.md`.
3. **Checks approval** — `Status: ✅ Approved` **AND** (spike stub) a matching `APPROVAL_TOKEN` env / PR
   label; real impl binds to the ADO/PR system-of-record (AC-NF1). Missing → exit 1 (fails the check).
4. **Checks basic AC-traceability presence** — each changed source file is referenced by an AC/coverage
   note; unreferenced changed file → warn (spike) / fail (enforce).
5. **Exit 0** allow · **exit 1** block. As a *required* check on a protected branch, exit 1 blocks merge.
- Touches: only reads git + the ICEA file. Does NOT: network, write files, git mutations.
- Verify: open a PR that fails #3/#4 → merge blocked; fix → merge allowed.

## Run order (human, in a scratch GitHub repo)
1. Copy `reference/ai-gate.yml` → `.github/workflows/`, add `ai-gate.mjs`, enable branch protection +
   mark "ai-gate" a **required** check. Open a failing PR → confirm merge blocked (H3 — expected PASS).
2. Copy `reference/vscode-settings.json` → `.vscode/settings.json`; in VS Code `/skills` confirm only
   `.github/` skills load and `.claude/*` don't (F1.2 / AC-F5).
3. Configure `skills/review-icea` as a Copilot code-review skill; open a PR whose diff violates
   `fixtures/ADO-9999-demo.icea.md` AC-2 → observe whether the review cites the ICEA (H2).
4. (Optional H4) try a `context: fork` skill invoking a sibling; note if it works / loses context.

Record each as PASS / PARTIAL / FAIL + one line. Those results drive the ICEA rewrite.
