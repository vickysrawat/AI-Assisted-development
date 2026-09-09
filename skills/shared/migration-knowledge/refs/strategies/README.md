# Target Execution Profiles — the pluggable migration strategy layer

_Loaded by migration SKILL.md at the start of Stage 4. One profile per **target** stack token._

---

## Why this exists

Stages 4 (build/merge), 5 (test/coverage/E2E) and 6 (run/verify) need stack-specific commands
and paths — but the **orchestration** around them (cluster tiers, branch-per-cluster, `--no-ff`
merge, agent spawning, gates, checkpoint, golden-master) is identical regardless of stack. This
layer isolates the stack-specific parts so the orchestration stays generic and adding a new target
= writing one profile file, not re-touching Stage 4/5/6.

**Key design point — profiles are keyed on the TARGET only.** You build/test/run the *target*;
the source is read-only. Source×target concerns (construct parity) live in `references/mappings/`,
not here. Two-track (full-stack) migrations resolve **two** profiles — a backend (e.g. `dotnet`)
and a frontend (e.g. `angular`).

## How the skill uses a profile

At Stage 4 start the skill reads `strategies/{target_token}.md` (and the frontend profile in
two-track), then substitutes the profile's values for the literal commands/paths shown in the
.NET reference examples throughout Stages 4–6. **If no profile file exists for the resolved target
token, the skill STOPs** — it never falls back to another stack's toolchain (same honest-refusal
rule as an unmapped source).

## The contract — every profile MUST define these tokens

| Token | Meaning | Used by (SKILL.md) |
|---|---|---|
| `STACK` | Display name of the target stack | banners |
| `SKELETON` | Project/solution structure the orchestrator scaffolds | Step 3.3 |
| `STANDARDS_EXAMPLE` | Idiom examples for the ~20-line Architecture Standards block | Step 3.2 §1 |
| `BUILD` | Build the target (per-config: Debug cluster / Release verify / skeleton verify) | 3.3, 4.2, 4.3, 4.5, 6.1 |
| `TEST_CLUSTER` | Run a single cluster's tests by name filter | 4.2, 4.3 |
| `TEST_ALL` | Run the full test suite | 6.1 |
| `TEST_FRAMEWORK` | The unit-test framework agents generate tests in | 5.1, 5.2 |
| `COVERAGE` | Produce + parse a coverage report; read per-layer line coverage | 5.2 |
| `LAYOUT` | Paths: shared kernel, shared tests, cluster source, cluster tests, char/unit tests | 3.2, 4.2, 4.3, 5.1 |
| `COMPOSITION` | Integration-layer files the orchestrator writes (composition root + config + readme) | 3.2 §5, 4.5 |
| `CONFIG` | Dev config file + the placeholder pre-flight before E2E | 6.2 |
| `BUILD_UNIT` | Build/solution/project files that form each cluster's FORBIDDEN set | 4.2, 4.3 |
| `RULES` | Guardrail rule files deployed to `.claude/rules/` (replaces the old inline STACK_RULE_MAP) | 3.3a |
| `PKG_ADD` | How a cluster requests a new dependency (skeleton-amendment path) | 4.x |
| `SERVE` | Start the app + health probe + dev-run command | 6.2, 6.4 |
| `E2E` | The end-to-end harness + how it starts against a running target | 5.3, 6.2 |
| `FITNESS` | Architecture fitness-test runner (optional; `N/A` if none) | 6.3 |

A stub profile (target not yet implemented) sets a `STATUS: not-implemented` marker and the skill
STOPs on it with a clear message. `project-rules.md` is always deployed regardless of `RULES`.

## Adding a new target (e.g. Java Spring Boot, Python FastAPI)

1. Copy `java-spring.md` (a stub) and fill in every token above with the target's real toolchain.
2. Remove the `STATUS: not-implemented` marker.
3. Verify against a real target app end-to-end before removing the "unverified" note.
4. Ensure a matching `references/mappings/{source}-{target}.md` parity file exists (Stage 2) —
   execution alone is not enough; feasibility needs the parity table.

## Profiles in this folder

| Profile | Status |
|---|---|
| `dotnet.md` | ✅ Implemented (primary backend target) |
| `angular.md` | ✅ Implemented (frontend track) |
| `java-spring.md` | ✅ Implemented — ⚠ unverified end-to-end (reachable via `.NET → Java`; parity in `mappings/java-dotnet.md`) |
| `python.md` | ✅ Implemented — ⚠ unverified (selectable via `nodejs → python`; parity in `mappings/nodejs-python.md`, idioms in `stacks/python.md`; java/dotnet→python not mapped) |
| `react.md` | ✅ Implemented — ⚠ unverified (frontend target; selectable via `angular → react`; parity in `mappings/angular-react.md`, idioms in `stacks/react.md`) |

Only a profile whose `STATUS` is exactly `implemented` will run in Stages 3–6; any other status
(`not-implemented`, `profile-ready`) STOPs.
