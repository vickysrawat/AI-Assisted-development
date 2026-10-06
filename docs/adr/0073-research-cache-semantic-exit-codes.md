# 0073 — Research cache: semantic exit codes and bundle extraction flag
Status: Accepted · Date: 2026-10-06
Governs: `scripts/research-cache.cjs`, `skills/upgrade/SKILL.md`, `skills/rewrite/SKILL.md`, `tests/research-cache.test.cjs`
Relates to: [[0070-migration-skill-continue-gate-elimination]], [[0071-upgrade-intake-skill-generated-three-pass]]

## Problem

Both `skills/upgrade/SKILL.md` and `skills/rewrite/SKILL.md` contained an identical ~30-line
shell block to read from the research cache. The block:

1. Called `research-cache.cjs lookup` and redirected stdout to a temp file.
2. Used three separate `node -e` one-liners to parse individual fields (status, staleness,
   age_days) out of that temp file.
3. Did not check `$?` after any of these calls — exit codes were ignored entirely.

The root cause: `lookup` exited `0` for both fresh and stale hits (stale is still "usable"),
so there was no exit-code signal to distinguish the three cache states (fresh hit, stale hit,
miss). The inline `node -e` parsing was the workaround for the missing signal.

This produced fragile code in two places in the plugin: any change to the JSON structure
output by `lookup` would silently break both SKILL.md cache blocks. The blocks were also
duplicated — a bug fix in one would not be applied to the other unless both were updated
manually.

## Decision

**Redesign `research-cache.cjs lookup` to use three semantic exit codes.**

| Exit code | Meaning | Bundle |
|---|---|---|
| `0` | Fresh hit (age <= 30 days) | Written to `--extract-bundle-to` file |
| `1` | Miss (not found, corrupt, or expired > 90 days) | Not written |
| `2` | Stale hit (30–90 days — usable, warn developer) | Written to `--extract-bundle-to` file |

**Add `--extract-bundle-to=<file>` flag to `lookup`.**

On a hit (exit 0 or 2), the command writes `entry.bundle` as standalone JSON to the
specified file. On a miss (exit 1), the file is not written. The caller reads the bundle
from this file; no inline JSON parsing is needed.

**SKILL.md cache block rewritten to ~8 lines (both upgrade and rewrite):**

```bash
BUNDLE_FILE="$(mktemp).json"
node "$PLUGIN_DIR/scripts/research-cache.cjs" lookup \
  --key="$CACHE_KEY" --extract-bundle-to="$BUNDLE_FILE"
CACHE_EXIT=$?
# 0=fresh hit · 1=miss · 2=stale hit
if [ $CACHE_EXIT -eq 2 ]; then
  echo "Research cache is stale — facts may have changed. Delete cache entry to refresh."
fi
if [ $CACHE_EXIT -eq 1 ]; then
  # invoke research agent, write bundle to $BUNDLE_FILE
fi
# BUNDLE_FILE now contains the bundle for all hit cases
```

**Script change surface:**

| File | Change |
|---|---|
| `scripts/research-cache.cjs` | Stale hit branch: `exit = 2` (was `exit = 0`). New `--extract-bundle-to` flag on `lookup`. |
| `tests/research-cache.test.cjs` | Line 99: `=== 0` changed to `=== 2`; stale hit description updated. New assertions for `--extract-bundle-to`. |
| `skills/upgrade/SKILL.md` | Cache block rewritten from ~30 lines to ~8 lines. |
| `skills/rewrite/SKILL.md` | Same cache block rewrite. |
| `skills/replatform/SKILL.md` | No change — replatform does not use `research-cache.cjs`. |

## Rationale

- **Exit codes are the standard Unix signal mechanism for program state.** A script that
  ignores `$?` from a cache lookup is a latent bug: if the lookup fails silently, the
  downstream skill proceeds as if it had valid data. Semantic exit codes make every state
  detectable with `$?` alone.
- **Fresh vs stale is a meaningful developer signal.** A stale cache entry (30–90 days)
  may still be accurate, but the developer should know they are working with older research.
  Exit code 2 enables the SKILL.md to show a warning without parsing the JSON — the
  decision logic is in the shell, not inside a `node -e` block.
- **`--extract-bundle-to` eliminates the inline parsing workaround.** The caller no longer
  needs three `node -e` one-liners to extract individual fields. The bundle is written to a
  file; the caller reads the file when needed. This is idiomatic and testable.
- **Single point of change.** The exit-code contract is defined once in `research-cache.cjs`
  and tested in `research-cache.test.cjs`. Both SKILL.md files consume the same interface.
  Future changes to the JSON structure inside the bundle do not require updating SKILL.md.

## Alternatives rejected

- **Keep exit code 0 for both hit cases; add a `--print-status` flag.**
  Rejected — this still requires inline parsing to distinguish fresh from stale. The goal
  is to make the state readable from `$?` without any parsing.
- **Add a dedicated `status` subcommand instead of exit codes.**
  Rejected — exit codes are the natural mechanism for "did this succeed and in what way."
  A separate status subcommand requires an additional call and additional parsing for no gain
  over a well-designed exit code set.
- **Consolidate the cache block into a shared shell script.**
  Rejected — SKILL.md blocks are Markdown instructions, not deployed shell scripts. A shared
  shell script would require the skill to call an additional file that must exist in the
  plugin. The 8-line block is simple enough to exist inline in both skills without
  duplication being a maintenance problem.

## Consequences

- Any existing code or test that expects `lookup` to return exit `0` for a stale hit must
  be updated. The test file update is in scope for this change.
- The `--extract-bundle-to` flag is additive: existing `lookup` calls without the flag
  continue to work (exit codes change, but callers that ignored `$?` are no better or worse
  off than before — and are now detectable as broken by the changed exit codes).
- Replatform skill is unaffected: it does not call `research-cache.cjs`.

## Revisit when

- If the stale window (30–90 days) proves too aggressive or too lenient for a particular
  stack's knowledge velocity, the threshold is a constant in `research-cache.cjs` and can
  be adjusted per stack or made configurable.
- If a fourth cache state is needed (e.g., "partially valid — some entries fresh, some
  stale"), the exit code set should be extended with a new code rather than overloading
  the existing ones.
