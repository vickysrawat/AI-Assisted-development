# 0009 — Server-side authoritative enforcement; defaults are policy
Status: Accepted · Date: 2026-06-11

## Problem
Local hooks are bypassable: `git commit --no-verify` skips pre-commit, the
PreToolUse hook can be unwired, hooks can be deleted in one command. And hooks
offered (not installed) during setup means the floor exists only for teams that
opted in — exactly the teams least likely to need reminding.

## Decision
Two rules. (1) Defaults are policy: dream-init installs all hooks by default;
opt-out requires --no-hooks AND a recorded, attributed decline in
architecture-deployment.md. (2) The authoritative floor is server-side:
validate-ledgers.py and validate-pr-compliance.py run as required Build
Validation in the target branch policy, where no developer can reach. Local
hooks become fast feedback; CI is the guarantee. Hook integrity is monitored
(dream-status 1p: presence, executability, content hashes) and re-synced on
every version bump.

## Rationale
Enforcement ladder: prompt → local hook → server-side gate. Each rule lives at
the lowest rung that holds it. A local bypass now produces a CI failure that is
itself telemetry — gate overrides become measured, not invisible. The
per-feature semantic match (does this code implement that AC) remains in the
judgment tier by honest necessity; everything mechanical above it is enforced.

## Revisit when
ADO branch-policy capabilities change, or the team moves off ADO — the scripts
are plain git+python and port to any CI, but the policy wiring is per-platform.
