# Migration Family Review Tracker — Silent Failures & Long-Context Risks

_Created: 2026-09-21 · Source: architecture review of Upgrade · Rewrite · Replatform skills + shared substrate_
_Process: one item at a time — issue → impact if unresolved → tradeoffs → options → residual risk → verification → decision → fix_

Status legend: 🔴 Open · 🟡 In discussion · 🟢 Resolved · ⬜ Deferred

---

## P0 — Silent failure risk (state/persistence)

| # | Item | File(s) | Status | Decision | PR/Commit |
|---|---|---|---|---|---|
| 1 | `coreEnvelope()` never persists `source.roots` despite ledger schema documenting it | `scripts/checkpoint-ledger.cjs` · `skills/shared/migration-ledger-schema.md` | 🔴 | — | — |
| 2 | `upgrade-checkpoint.cjs` silently drops undocumented flags (`--report-path`, `--proceed-after-report`) | `scripts/upgrade-checkpoint.cjs` · `skills/upgrade/SKILL.md` | 🔴 | — | — |
| 3 | Replatform skill uses unsupported ledger CLI flags (`--namespace`, `--payload`) — NFR report path never recorded | `skills/replatform/SKILL.md` · `scripts/checkpoint-ledger.cjs` | 🔴 | — | — |
| 4 | `check-gate` re-validates only a subset of what `verify` checks — stale/edited manifests can still pass | `scripts/intake-verify.cjs` | 🔴 | — | — |
| 5 | `source_context.skill` is never stored, so `check-gate`'s deep-scan branch (rewrite/replatform) may be silently skipped on revalidation | `scripts/intake-verify.cjs` · `skills/rewrite/SKILL.md` · `skills/replatform/SKILL.md` | 🔴 | — | — |
| 6 | Ledger writes are not atomic/locked/revisioned — concurrent subagent writes can corrupt or clobber state | `scripts/checkpoint-ledger.cjs` | 🔴 | — | — |
| 7 | Arbitrary gate names/verdicts accepted by ledger + Upgrade adapter — no state-machine validation | `scripts/checkpoint-ledger.cjs` · `scripts/upgrade-checkpoint.cjs` | 🔴 | — | — |

## P1 — Silent failure risk (intake / detection accuracy)

| # | Item | File(s) | Status | Decision | PR/Commit |
|---|---|---|---|---|---|
| 8 | Missing `additionalDirectories` roots are silently skipped instead of failing closed | `scripts/intake-verify.cjs` (`scanRoots`) | 🔴 | — | — |
| 9 | Root coverage check uses loose substring matching — generic folder names can satisfy coverage accidentally | `scripts/intake-verify.cjs` | 🔴 | — | — |
| 10 | Glob citations (`src/**/*.cs#L999999`) accepted without resolving or line-checking | `scripts/intake-verify.cjs` (`resolveCitation`) | 🔴 | — | — |
| 11 | Module accounting (`mapped`/`out-of-scope` counts) can be inflated by header/summary rows, not a strict module-ID table | `scripts/intake-verify.cjs` | 🔴 | — | — |
| 12 | Source detector's scan limits (file count/size/depth caps) are not surfaced — truncated scans look like complete ones | `scripts/migration-source-detect.cjs` | 🔴 | — | — |

## P0/P1 — Long-context risk

| # | Item | File(s) | Status | Decision | PR/Commit |
|---|---|---|---|---|---|
| 13 | Rewrite's own token-budget estimates contradict each other across sections (10–15K vs 25–40K; 80K stop rule vs 60–100K step cost) | `skills/rewrite/SKILL.md` | 🔴 | — | — |
| 14 | `migration-log.md` is "never truncated" and is loaded whole on resume — unbounded growth becomes the resume cost itself | `skills/rewrite/SKILL.md` · `skills/shared/migration-log-spec.md` | 🔴 | — | — |
| 15 | Step 2.5 (7 design docs) is documented as "cannot be split mid-document" with no per-document resumable state | `skills/rewrite/SKILL.md` | 🔴 | — | — |
| 16 | Full 8-step cluster subagent instructions + multiple spec paths are copied into every subagent prompt (repeated, driftable) | `skills/rewrite/SKILL.md` | 🔴 | — | — |
| 17 | Cluster subagent results passed as inline JSON strings (`checkpoint_payload_json`) — fragile to shell quoting/size | `skills/rewrite/SKILL.md` | 🔴 | — | — |

## P1 — Family consistency

| # | Item | File(s) | Status | Decision | PR/Commit |
|---|---|---|---|---|---|
| 18 | Upgrade lacks Rewrite/Replatform's Step 0 (log + tracker + ledger init) before analysis begins | `skills/upgrade/SKILL.md` | 🔴 | — | — |
| 19 | Test-plan generation failure is a warn-and-continue in all three skills — completion can be reported without a test plan | `skills/upgrade/SKILL.md` · `skills/rewrite/SKILL.md` · `skills/replatform/SKILL.md` | 🔴 | — | — |
| 20 | Command docs (`/rewrite`, `/replatform`) assume a specific CWD (empty target folder / infra folder) but detection scripts operate on `process.cwd()` + configured roots — ambiguous which root is source vs target | `commands/rewrite.md` · `commands/replatform.md` · `scripts/migration-source-detect.cjs` | 🔴 | — | — |

---

## Working notes

- Items are numbered for reference in discussion, not strict priority order within a tier.
- Each item, once discussed and approved, gets: Status → 🟢, Decision column filled with the agreed fix summary, PR/Commit column filled with the link.
- If an item is deferred (not worth fixing now), mark ⬜ and record why in Decision.
