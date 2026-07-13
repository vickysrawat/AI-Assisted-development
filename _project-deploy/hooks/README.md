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
| `icea-floor.sh` | (b) PreToolUse | Source-file writes blocked when no approved ICEA (or T1 auto-ICEA) exists. Coarse floor — the prompt gate provides the per-feature judgment; this guarantees code is never written with no approval at all. |
| `findings-gate-precommit.sh` | (c) git pre-commit | Open Critical/High findings block commits even when the developer bypasses /checkin and runs `git commit` directly. Override is loud: `SKIP_FINDINGS_GATE=1` with justification. |
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
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/icea-floor.sh" }] }
    ]
  }
}

# (c) git pre-commit:
cp .claude/hooks/findings-gate-precommit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# (c) CI (Azure DevOps pipeline step):
- script: python3 .claude/hooks/validate-ledgers.py
  displayName: Validate finding ledgers
```

## What this changes about the plugin's claims

Before v1.23.0, "enforced" meant "instructed, and usually followed." With hooks
installed, three rules are enforced in the mechanical sense: the ICEA floor,
the findings gate on commit, and ledger integrity in CI. The eval suite
(tests/skill-scenarios/) measures the judgment layer above the floor.
