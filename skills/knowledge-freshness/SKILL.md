---
name: knowledge-freshness
description: >
  Validate and refresh the migration family's offline knowledge tier
  (skills/shared/migration-knowledge/refs). `check` classifies every manifest ref
  FRESH / STALE-BY-AGE / STALE-BY-VERSION / UNKNOWN deterministically with no network.
  `refresh` (Story 2) web-grounds a stale ref, shows a diff, runs a higher-tier judge,
  and updates it under the Write Gate. Plugin-maintainer tool — operates on the plugin's
  own bundled knowledge refs, not target-project source.
---

# knowledge-freshness Skill

_Skill version: 1.1 · Last changed: 2026-09-10 · Consent: C_

## Purpose
Keep the migration family's offline INFERRED knowledge tier trustworthy. The offline refs under
`skills/shared/migration-knowledge/refs/` decay silently as frameworks move; this skill surfaces
staleness (`check`) and refreshes it under human approval (`refresh`, Story 2).

Category C (source-file-consent): reads only the plugin's own knowledge files (the manifest + refs)
and architecture-independent JSON. Never reads target-project source. The only writes (Story 2
`refresh`) go through the Write Gate.

## Resolve PLUGIN_DIR — do this first
Read `.claude/plugin-path.txt` to get PLUGIN_DIR. If absent or empty, use the Node.js resolver from
`skills/shared/plugin-path-resolution.md §1a`. All paths below use `$PLUGIN_DIR`.

## Model routing
`check` is deterministic and needs no model. The `refresh` judge (Story 2) uses the review tier —
`CRITIC_MODEL` (falls back to `REVIEW_MODEL`, default `claude-sonnet-4-6`). See
`$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

---

## Command: `check` (Story 1)

Classifies every ref in the freshness manifest. Two independent axes:
- **STALE-BY-AGE** — pure offline math (`last_verified` + TTL vs today). Needs no web.
- **STALE-BY-VERSION** — compares each ref's anchor (`versions` for stacks/strategies, `target` for
  mappings/shared) against an LLM-supplied `--latest` value. Refs absent from `--latest` → UNKNOWN.

Steps:
1. **(Optional) web-ground current versions.** If the developer wants the version axis evaluated,
   use WebSearch to learn the current version for the stacks in the manifest, and write a small
   `--latest` JSON keyed by ref `path` → current version string (e.g.
   `{ "refs/stacks/dotnet.md": ".NET 10" }`). Skip this to run an age-only check.
2. **Run the detector** (the script performs NO network I/O — it only compares):
   ```bash
   node "$PLUGIN_DIR/scripts/knowledge-freshness.cjs" check \
     --manifest="$PLUGIN_DIR/skills/shared/migration-knowledge/freshness-manifest.json" \
     [--latest=<path/to/latest.json>] [--now=YYYY-MM-DD] [--json]
   ```
   Exit codes: `0` none stale · `9` ≥1 ref STALE · `1` usage/read/parse error.
3. **Render the staleness table** to the developer (path · status · anchor→latest for version-stale).
   If any ref is STALE, point the developer at `refresh` (Story 2) for each stale ref.

`check` is strictly read-only — it never writes any ref or the manifest.

---

## Command: `refresh <ref-path>` (Story 2)

Refreshes ONE stale ref with web-grounded facts under human approval. Never auto-runs; never writes
without `APPROVE ADO-9004`.

1. **Confirm it's stale.** Run `check` for this ref. If FRESH, decline: "ref is not stale — nothing
   to refresh."
2. **Web-ground current facts.** Use WebSearch to gather the ref's current facts. Record each source
   URL and its host — the host drives authority tagging (step 6c).
3. **Compose + diff.** Compose the proposed ref content and show a **unified diff** (changed lines +
   3 lines context) against the current `refs/<path>.md`. Never dump the full file.
4. **Judge (higher tier).** Run an inline LLM-as-judge on `CRITIC_MODEL` (falls back to
   `REVIEW_MODEL`). PASS/FAIL against this rubric — **uncertain ⇒ FAIL**:
   | Check | FAIL when |
   |---|---|
   | Source authority | the change would be tagged VERIFIED but every grounding host is non-authoritative (per `scripts/lib/source-classifier.cjs`) |
   | Diff ↔ grounding fidelity | the diff asserts version/API claims the grounded material does not support |
   | Real version movement | the proposed anchor does not actually differ from the current one |
   | Scope | the diff edits parts of the ref unrelated to the staleness being fixed |
   On **FAIL**: stop, report reasons, present NO write.
5. **Write Gate.** On judge PASS, present the diff + target path and the WRITE PENDING prompt; wait
   for `APPROVE ADO-9004`. On SKIP / anything else: write nothing.
6. **On `APPROVE ADO-9004`:**
   a. Write the updated `refs/<path>.md`.
   b. Bump the manifest date deterministically:
      ```bash
      node "$PLUGIN_DIR/scripts/knowledge-freshness.cjs" restamp \
        --manifest="$PLUGIN_DIR/skills/shared/migration-knowledge/freshness-manifest.json" \
        --path="refs/<path>.md" --now=<today>
      ```
      Exit: 0 stamped · 10 path-not-in-manifest · 1 error.
   c. Re-tag authority via `scripts/lib/source-classifier.cjs` → `classifySource(stack, bestSourceUrl)`;
      record VERIFIED/INFERRED (a non-authoritative host can only ever be INFERRED).
7. Confirm what changed: ref updated · `last_verified` bumped · authority tag.

---

## Hard Rules
- NEVER make the detector perform network I/O — the LLM web-grounds; the script only compares.
- NEVER report a version-UNKNOWN ref as FRESH — absence from `--latest` is UNKNOWN.
- NEVER write a ref or the manifest without `APPROVE ADO-9004` (Story 2 only; Write Gate).
- `check` is read-only in all paths.
