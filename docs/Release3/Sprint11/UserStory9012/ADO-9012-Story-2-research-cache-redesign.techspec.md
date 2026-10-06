# Tech Spec — Story 2: research-cache Redesign
ADO #9012 · Story 2 of 5 · Release 3 · Sprint 11
Status: DRAFT

---

## Overview

Redesigns `scripts/research-cache.cjs` to use unambiguous exit codes (0=fresh / 1=miss /
2=stale) and adds an `--extract-bundle-to=<file>` flag that writes the bundle JSON to disk
on hit. Rewrites the fragile 30-line cache-lookup shell block in both `skills/upgrade/SKILL.md`
and `skills/rewrite/SKILL.md` to 10 lines or fewer — no inline `node -e` JSON parsing, no
intermediate temp result files. Updates `tests/research-cache.test.cjs` line 99 to assert
`stale.code === 2` (was `stale.code === 0`). All other test assertions unchanged.

This story is independent of Story 1 and can ship in parallel.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F4 | research-cache.cjs lookup exits 0 (fresh ≤30d), 1 (miss), 2 (stale 30-90d) | scripts/research-cache.cjs | ✅ Covered |
| AC-F5 | --extract-bundle-to=<file> writes entry.bundle JSON on hit (exit 0 or 2); nothing on miss | scripts/research-cache.cjs | ✅ Covered |
| AC-F6 | Upgrade SKILL.md cache block ≤10 lines; no node -e; no temp result file | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F7 | Rewrite SKILL.md cache block ≤10 lines; no node -e; no temp result file; all other content unchanged | skills/rewrite/SKILL.md | ✅ Covered |
| AC-NF2 | node tests/research-cache.test.cjs passes; stale.code === 2 | tests/research-cache.test.cjs | ✅ Covered |
| AC-NF4 | npm test passes — no regressions | tests/ (all) | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| scripts/research-cache.cjs | AC-F4, AC-F5 |
| skills/upgrade/SKILL.md | AC-F6 |
| skills/rewrite/SKILL.md | AC-F7 |
| tests/research-cache.test.cjs | AC-NF2, AC-NF4 |

**Coverage result:** All 6 ACs covered. No orphaned file changes. ✅

---

## Files Changed

### `scripts/research-cache.cjs` — Modify

**Exit code contract (AC-F4):**

| Exit code | Condition | Meaning |
|---|---|---|
| 0 | Entry found; age ≤ 30 days | Fresh hit — use bundle |
| 1 | Entry not found, corrupt, or age > 90 days | Miss — reinvoke agent |
| 2 | Entry found; age 30–90 days | Stale hit — print warning, use bundle |

The prior behaviour of exiting 0 for stale hits is removed. Any caller that relied on exit 0
for stale hits must be updated (upgrade SKILL.md and rewrite SKILL.md are the only callers —
both are updated in this story).

**`--extract-bundle-to=<file>` flag (AC-F5):**

When this flag is present and the lookup hits (exit 0 or exit 2):
- Parse the cache entry
- Write `entry.bundle` (the JSON bundle object) to the specified file path
- Exit with the appropriate code (0 or 2)

When the lookup misses (exit 1):
- Do NOT write the file (leave it absent or remove any prior version)
- Exit 1

Implementation approach:
```javascript
// DECISION: How to extract the bundle without changing the lookup return contract
// Options considered:
//   A) Return bundle on stdout, caller reads stdout — rejected: stdout is currently
//      used by some callers for diagnostic messages; changing stdout format is breaking
//   B) Write to --extract-bundle-to file — chosen: additive flag, no stdout change,
//      caller reads a predictable file path, works on Windows (no /dev/stdin issues)
//   C) Add a separate 'extract' subcommand — rejected: adds CLI surface without benefit;
//      the flag-based approach is simpler and keeps the lookup as one command
const extractTo = args['--extract-bundle-to'];
if (extractTo && hit) {
  require('fs').writeFileSync(extractTo, JSON.stringify(entry.bundle, null, 2), 'utf8');
}
process.exit(hitAge <= 30 ? 0 : hitAge <= 90 ? 2 : 1);
```

**No other changes** to the script's lookup logic, cache path, entry format, or other subcommands.

---

### `skills/upgrade/SKILL.md` — Modify (cache block only)

**Current block (30 lines, fragile):** Uses a complex shell block with multiple `node -e`
inline JSON parsing calls, an intermediate temp result file, and ignores exit codes.

**Replacement block (≤10 lines, AC-F6):**
```bash
CACHE_BUNDLE="temp/cache-bundle-<ADO-ID>.json"
node scripts/research-cache.cjs lookup \
  --stack=<STACK> --from=<FROM_VER> --to=<TO_VER> \
  --extract-bundle-to="$CACHE_BUNDLE"
CACHE_EXIT=$?
# 0=fresh, 1=miss, 2=stale
if [ "$CACHE_EXIT" -eq 2 ]; then
  echo "⚠ Research cache is stale (30-90 days). Using cached data — consider refreshing."
fi
```

On exit 0 or 2: read `$CACHE_BUNDLE` (written by the script) for the bundle.
On exit 1: `$CACHE_BUNDLE` is absent — proceed without cached data (agent reinvoke path).
No `node -e` parsing. No intermediate temp result file beyond the bundle output.

---

### `skills/rewrite/SKILL.md` — Modify (cache block only)

**Same replacement pattern as the upgrade block (AC-F7).** The rewrite skill's cache lookup
block is replaced with the identical ≤10-line pattern above. No other content in
skills/rewrite/SKILL.md is modified.

**DECISION: Rewrite skill included in this story (not a separate story)**
Options considered:
  A) Separate story — rejected: leaving rewrite on the broken pattern after script changes
     would be a broken state (exit code mismatch); the two changes are atomic from a
     correctness standpoint
  B) Same story — chosen: the block replacement is trivial and the two changes must ship
     together to avoid a window where the script exits 2 but the SKILL.md tests for 0

---

### `tests/research-cache.test.cjs` — Modify (one line)

**Line 99 only (AC-NF2):**

```javascript
// Before:
assert(stale.code === 0, 'stale hit should exit 0');
// After:
assert(stale.code === 2, 'stale hit should exit 2');
```

All other assertions in this file are unchanged. No new test cases added (the existing
structure already covers fresh hit, miss, and stale hit scenarios).

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| --extract-bundle-to path not writable | research-cache.cjs exits 1 (treat as miss); error message to stderr; upgrade skill proceeds without cached data |
| Cache entry corrupt (invalid JSON) | research-cache.cjs exits 1 (miss); existing behaviour unchanged |
| Cache entry age > 90 days | research-cache.cjs exits 1 (miss); not stale — expired; agent reinvoke path |
| CACHE_EXIT is 2, stale bundle used | Skill prints stale warning to chat; bundle is used without agent reinvoke; developer sees reason |

---

## Request Flow

```
SKILL.md Step 2 (upgrade) or equivalent step (rewrite):
  node scripts/research-cache.cjs lookup \
    --stack=X --from=Y --to=Z \
    --extract-bundle-to=temp/cache-bundle-<ADO-ID>.json
  CACHE_EXIT=$?

  [CACHE_EXIT=0]  → temp/cache-bundle-<ADO-ID>.json exists (fresh)
                    Read bundle → use data → continue
  [CACHE_EXIT=2]  → temp/cache-bundle-<ADO-ID>.json exists (stale)
                    Print stale warning → read bundle → use data → continue
  [CACHE_EXIT=1]  → temp/cache-bundle-<ADO-ID>.json absent (miss)
                    Proceed to agent reinvoke path → continue
```

---

## Rollback

Revert `scripts/research-cache.cjs` and `tests/research-cache.test.cjs` together.
Also revert the cache block in both SKILL.md files. All changes are in one commit.
Run `npm test` after revert to confirm no regressions.

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F4, AC-F5 | Modify research-cache.cjs: exit code redesign + --extract-bundle-to flag | 1 |
| AC-F6 | Replace upgrade SKILL.md cache block (≤10 lines) | 0.5 |
| AC-F7 | Replace rewrite SKILL.md cache block (≤10 lines) | 0.5 |
| AC-NF2, AC-NF4 | Update test assertion line 99; verify npm test passes | 1 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — single logical change; no child ADOs.

---

## Handover

### QA Team

**What was added:**
- research-cache.cjs now exits 0 (fresh), 1 (miss), or 2 (stale) — no other exit values
- --extract-bundle-to flag extracts bundle to a file on hit
- Both SKILL.md cache blocks are now ≤10 lines with no node -e inline parsing

**How to verify:**
1. `node tests/research-cache.test.cjs` — all tests pass, including stale.code === 2
2. `npm test` — no failures
3. Manually: run `node scripts/research-cache.cjs lookup --stack=dotnet --from=6 --to=8 --extract-bundle-to=out.json`; verify exit code and that out.json contains bundle data on hit
4. Count lines in the cache lookup block of both SKILL.md files — confirm ≤10

**Regression risk:** Rewrite skill cache lookup is changed — run a rewrite skill dry-run to
confirm it correctly handles exit codes 0, 1, and 2.

### DevOps / Platform Team

No infrastructure changes.

### Future Developer

The `--extract-bundle-to` flag is the prescribed way to read the cache bundle in SKILL.md
files. Never parse the bundle inline with `node -e` — the flag writes structured JSON to a
predictable path that can be read with `cat` or `node -e "JSON.parse(require('fs').readFileSync('path','utf8'))"` in a separate step.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | research-cache.cjs lookup | Fresh cache entry (age ≤30d) | Exit 0; bundle written to --extract-bundle-to file | AC-F4, AC-F5 |
| P-U2 | research-cache.cjs lookup | Stale cache entry (30-90d) | Exit 2; bundle written to --extract-bundle-to file; stale warning on stderr | AC-F4, AC-F5 |
| P-U3 | research-cache.cjs lookup | No cache entry | Exit 1; no file written | AC-F4, AC-F5 |
| P-U4 | upgrade SKILL.md cache block | Line count | ≤10 lines; zero node -e occurrences in block | AC-F6 |
| P-U5 | rewrite SKILL.md cache block | Line count | ≤10 lines; zero node -e occurrences in block | AC-F7 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | research-cache.cjs lookup | Corrupt cache entry | Exit 1 (miss); no bundle written | AC-F4 |
| N-U2 | research-cache.cjs lookup | Cache entry age > 90d | Exit 1 (miss); not exit 2 | AC-F4 |
| N-U3 | research-cache.cjs lookup | --extract-bundle-to unwritable path | Exit 1; error to stderr | AC-F5 |
| N-U4 | tests/research-cache.test.cjs | stale hit | stale.code === 2 (not 0) | AC-NF2 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | npm test full suite | Run `npm test` after all Story 2 changes | All tests pass; no regressions | AC-NF4 |
| INT-2 | Upgrade skill cache path (stale) | Run upgrade skill with stale cache entry | Stale warning printed; bundle used; skill continues | AC-F4, AC-F6 |

> AC-NF2 verification: `node tests/research-cache.test.cjs` — all assertions pass; confirm line 99 asserts `stale.code === 2`.
> AC-NF4 verification: `npm test` — zero failures across all test files.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] `scripts/research-cache.cjs` modified: exit 0 (fresh ≤30d), 1 (miss), 2 (stale 30-90d)
- [ ] `scripts/research-cache.cjs` modified: `--extract-bundle-to=<file>` flag writes bundle on hit; nothing on miss
- [ ] `skills/upgrade/SKILL.md` modified: cache lookup block ≤10 lines, zero `node -e` calls
- [ ] `skills/rewrite/SKILL.md` modified: cache lookup block ≤10 lines, zero `node -e` calls
- [ ] `tests/research-cache.test.cjs` modified: line 99 asserts `stale.code === 2`

**Quality**
- [ ] `node tests/research-cache.test.cjs` — all tests pass
- [ ] `npm test` — all tests pass, no regressions
- [ ] Cache block line count verified: ≤10 lines in both SKILL.md files
- [ ] Exit code verified: fresh=0, miss=1, stale=2 (manual invocation with test cache entries)
- [ ] `--extract-bundle-to` verified: bundle file written on hit, absent on miss

**Review readiness**
- [ ] PR title: `[ADO-9012] research-cache Redesign — exit codes 0/1/2, --extract-bundle-to flag`
- [ ] PR description maps each changed file to its ACs (AC-F4 through AC-F7, AC-NF2, AC-NF4)
- [ ] ICEA committed in the same branch

### Reviewer Checklist

- [ ] Confirm research-cache.cjs exits 0, 1, or 2 only (no other exit paths)
- [ ] Confirm stale boundary is strictly 30d < age ≤ 90d for exit 2 (not ≤90d)
- [ ] Confirm expired (>90d) exits 1 (miss), not 2
- [ ] Confirm no stdout format changes in research-cache.cjs (only file write added)
- [ ] Confirm rewrite SKILL.md has no other content changes (cache block only)

---

## Open Questions

None.

---

## Revision Log

2026-10-03 — Story 2 tech spec drafted. Added Definition of Done (critic REVISE → auto-revised).
