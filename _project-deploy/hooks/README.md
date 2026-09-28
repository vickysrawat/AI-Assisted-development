# hooks/ — Mechanical enforcement layer

_Added in v1.23.0. Principle: **prompts propose, hooks dispose.**_

The plugin's skills and commands are model instructions — rich judgment,
probabilistic enforcement. This directory holds the deterministic floor beneath
them. Each hard rule lives at the lowest tier that can hold it:

| Tier | Mechanism | Guarantees |
|---|---|---|
| (a) Model instructions | CLAUDE.md rules, skills, commands | Rich judgment; probabilistic |
| (b) Tool hooks | Claude Code PreToolUse hooks | Deterministic, per-tool-call |
| (c) External gates | git hooks, CI scripts | Deterministic, survive any client |

## Contents

| File | Tier | Rule enforced |
|---|---|---|
| `icea-floor.sh` | (b) PreToolUse | Source-file writes blocked when no approved ICEA (or T1 bug spec) exists. Coarse floor — the prompt gate provides the per-feature judgment; this guarantees code is never written with no approval at all. Override is loud and session-wide: `SKIP_ICEA_FLOOR=1` with `ICEA_FLOOR_JUSTIFICATION`, logged to the audit trail. |
| `findings-gate-precommit.sh` | (c) git pre-commit (auto-installed) | Open Critical/High findings block commits even when the developer bypasses /checkin and runs `git commit` directly. Override is loud: `SKIP_FINDINGS_GATE=1` with justification. |
| `governance-gate-precommit.cjs` | (c) git pre-commit (manual chain) | ICEA gate + secrets check at commit time via `scripts/validate-governance.cjs`. Complements `findings-gate-precommit` — that gate checks open findings; this gate checks ICEA compliance. Deployed to `.claude/hooks/` by `setup-init` but not auto-installed. Teams that want both gates chain them in a custom `.git/hooks/pre-commit` wrapper that calls both scripts sequentially. |
| `validate-ledgers.py` | (c) CI | Ledger invariants: no empty dismissal justifications, valid reason categories, no FP collisions, summary counts match sections. Fails the pipeline on violation. |
| `validate-pr-compliance.py` | (c) CI **required check** | Server-side ICEA floor per PR (approved ICEA matching the branch ADO ID must exist) + T1 bound re-verification as pure diff math. Runs as required Build Validation — unbypassable. A failure when local gates "passed" is bypass telemetry (ADR 0009). |

## Installation

`setup-init` installs all hooks **by default** (ADR 0009 — defaults are policy); opt-out via `--no-hooks` is recorded and attributed in architecture-deployment.md. Manual installation:

```bash
# (b) PreToolUse hook — add to .claude/settings.json:
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "powershell.exe -NonInteractive -File .claude/hooks/dispatch.ps1 icea-floor" }] }
    ]
  }
}
# dispatch.ps1 auto-detects bash availability and falls back to .ps1 equivalents
# when bash is restricted. The .sh files are kept unchanged as the primary implementation.

# (c) git pre-commit — findings gate only (auto-installed by setup-init):
cp .claude/hooks/findings-gate-precommit.cjs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit    # Linux/macOS only

# (c) git pre-commit — FULL CHAIN (findings-gate + governance-gate, recommended):
#   Gate 1: open Critical/High findings + settings.json secrets  (fast — ledger scan)
#   Gate 2: ICEA compliance + staged-file secrets + env-file block (per-file analysis)
cp .claude/hooks/pre-commit-full.cjs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit    # Linux/macOS only
#
# To revert to findings-gate only:
#   cp .claude/hooks/findings-gate-precommit.cjs .git/hooks/pre-commit

# (c) CI (Azure DevOps pipeline step):
- script: python3 .claude/hooks/validate-ledgers.py
  displayName: Validate finding ledgers
```

## What this changes about the plugin's claims

Before v1.23.0, "enforced" meant "instructed, and usually followed." With hooks
installed, three rules are enforced in the mechanical sense: the ICEA floor,
the findings gate on commit, and ledger integrity in CI. The eval suite
(tests/skill-scenarios/) measures the judgment layer above the floor.
