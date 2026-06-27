# Single-Writer Assumption
_Spec version: 1.1 · Last changed: 2026-06-03 · Applies to: code-review, security, token-analysis, dream-init_


Skills that write to persistent cache files in this plugin operate under a
**single-writer assumption**: only one Claude Code session writes to a given
cache file at a time.

## Files covered

| File | Writer(s) | Readers |
|---|---|---|
| `.claude/file-cache.json` | code-review, security | code-review, security, dream-status |
| `token-analysis/token-graph.json` | token-analysis | token-analysis, dream-status |
| `.claude/architecture/domain-map.md` | architect | icea-feature, icea-review, dream-status |
| `.claude/dream-init-state.json` | dream-init | dream-init (idempotency check on re-run) |
| `security/security-ledger.md` | security | fix, checkin, pr-create |
| `dynamic-scan/dynamic-scan-ledger.md` | dynamic-scan | fix, checkin, pr-create |
| `skills/shared/business-context-severity.md` | maintainers only | security, code-review, icea-review, checkin, pr-spec-review |
| `skills/shared/source-file-consent.md` | maintainers only | icea-review, pr-spec-review, bug, update-arch, explain, prod-readiness |

## Why this is safe today

Each developer runs their own Claude Code session against their own local
working copy. Sessions are sequential within a single developer's workflow.
Concurrent writes from two sessions on the same machine are theoretically
possible but practically rare — Claude Code handles one task at a time.

## Where this assumption breaks

This assumption **fails** if:

1. **Shared filesystem** — two developers mount the same network drive and
   run Claude Code sessions simultaneously
2. **CI/CD pipeline** — a pipeline stage runs code-review or security in
   parallel with a developer's local session
3. **Committed cache files** — if `.claude/file-cache.json` or
   `token-graph.json` were committed to the repo and multiple developers
   pulled and wrote back concurrently (this is why they are gitignored)

## Mitigation

The primary mitigation is the `.gitignore` entries for all generated cache
files. Each developer's cache is local to their working copy — there is no
shared mutable state.

**If your team runs these skills in CI:** always pass `--ci` (or `--full`)
so CI does a fresh scan rather than reading a potentially stale or missing
cache from a previous run. Do not commit the cache files from CI.

The `--ci` flag is an alias for `--full` with one additional behaviour:
if a cache file is detected on disk, the skill emits a warning before
proceeding with the full scan. The exact warning text is defined in
`skills/shared/scope-flags-spec.md` §`--ci` flag behaviour — that spec
is the single source of truth. Do not duplicate the string here.

This surfaces misconfigured pipelines that accidentally commit or restore
cache files, without failing the build.

## Last-write-wins behaviour

If concurrent writes do occur, the behaviour is last-write-wins. There is
no locking. The worst outcome is:
- One developer's cache entry for a file is overwritten by another's
- On the next run, the affected files appear as CHANGED and are re-scanned
- No data corruption — just a cache miss, not a cache poison

Skills must handle this gracefully: a cache miss is always safe; it just
means an extra file scan.

## Future: file locking

If the team adopts shared filesystem workflows, implement advisory locking:

```bash
# Acquire lock before writing
flock -x .claude/.file-cache.lock -c "node update-cache.js"
```

This is not implemented today — document here when added.
