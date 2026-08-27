# Multi-Harness Convergence (v4.0)

> Consolidated from MEMORY.md auto-capture entries (2026-08-12).
> Dream run: 2026-08-25. Confidence: 0.80 (avg).

---

## Strategy

Make the plugin work with both Claude Code AND GitHub Copilot by CONVERGING the existing plugin onto the cross-tool standard. Enabled by VS Code 1.109 (Jan 2026) "Claude compatibility" — Copilot natively reads CLAUDE.md, `.claude/rules`, `.claude/agents`, `.claude/skills`, `.claude/settings.json` hooks.

Plan: `docs/plans/2026-08-12-llm-agnostic-multi-harness-convergence.md` (9-phase tracker).

## Versioning

- v3.13.0 = FROZEN git tag (permanent Claude-only fallback/rollback point)
- v4.0 convergence built on a branch while main stays 3.13 until 4.0 proves out
- Frozen fallback lifecycle for 3.x (no ongoing parallel Claude-only development)
- Marketplace can still serve v3.13.0 tag to Claude-only users

## Source Organization

`Shared/` (neutral single source: skills, rules, instructions, hooks, gates, eval) + thin `Claude/` and `Copilot/` adapters (each owns its manifest/wiring) + neutral `plugin.manifest.json`.

Provisioning PROJECTS Shared/ + adapter into each tool's NATIVE paths (`.claude/` for Claude, `.github/` for Copilot). Config projected per-harness; artifacts/data (architecture, graph, memory/, docs/) generated ONCE in neutral location and shared.

## Self-Contained Skills (eliminate $PLUGIN_DIR)

Skills stop resolving `$PLUGIN_DIR`/`plugin-path.txt` at runtime. Provisioning bundles each skill's deps into the project; skills read PROJECT-RELATIVE paths. Trade-off: updates arrive via `setup-sync` re-projection, not automatic marketplace refresh.

## 3-Tier Enforcement

- **Tier A:** Claude write-time hooks (HARD/deterministic/GA, unchanged)
- **Tier B:** Copilot read-only gate agents + PreToolUse deny (Preview, user-overridable)
- **Tier C:** git pre-commit + CI `ai-gate` (harness-INDEPENDENT universal backstop)

Claude keeps hard hooks — do NOT claim "git/CI is the only hard gate."

## AI Safety (SEV-1 work-streams)

1. Approval bound to ADO system-of-record (NOT a `Status: Approved` file grep the AI can forge)
2. Data-egress policy tied to B1-B7 severity (law-firm critical)
3. Memory/docs treated as UNTRUSTED input (prompt-injection persistence vector)
4. Behavioral eval harness in CI
5. Per-skill capability floor
6. Audit stamping (model+version+harness+skill-hash)
7. Gate pinned+hash-verified, warn-only rollout + audited break-glass

## Approaches Abandoned

- **Greenfield Copilot plugin:** duplicates content, 2nd codebase; superseded by convergence
- **Bespoke adapter/transform layer:** unnecessary once VS Code 1.109 Claude-compat verified
- `.claude/rules` with `paths:` load ON READ — coding-standard rules for code generation must be unconditional (no `paths:`)
