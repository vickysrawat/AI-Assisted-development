# Target Execution Profiles — the pluggable execution layer

_A stack-keyed execution-profile layer. One profile per **target** stack token. Consumed by any
migration-family skill (**Rewrite · Replatform · Upgrade**) at its code-generation and verification
points — the profile supplies the stack-specific commands/paths so the skill's own logic stays
stack-agnostic._

---

## Why this exists

Generating, building, testing, and verifying target code needs stack-specific commands and paths —
but the **orchestration** around them (clustering, gating, checkpointing, golden-master replay) is
identical regardless of stack. This layer isolates the stack-specific parts so the invoking skill's
logic stays generic, and adding a new target = writing one profile file, not re-touching the skill.

**Key design point — profiles are keyed on the TARGET only.** You build/test/run the *target*;
the source is read-only. Source×target concerns (construct parity) live in `references/mappings/`,
not here. Two-track (full-stack) migrations resolve **two** profiles — a backend (e.g. `dotnet`)
and a frontend (e.g. `angular`).

## How a skill uses a profile

At the start of its generation phase the invoking skill reads `strategies/{target_token}.md` (and
the frontend profile in two-track), then substitutes the profile's values for the literal
commands/paths in its generate/verify steps. **If no profile file exists for the resolved target
token, the skill STOPs** — it never falls back to another stack's toolchain (the same honest-refusal
rule as an unmapped source).

## The contract — every profile MUST define these tokens

The "Phase" column names the *purpose* the token serves, not any skill's step numbering — each skill
maps these phases onto its own steps.

| Token | Meaning | Phase |
|---|---|---|
| `STACK` | Display name of the target stack | banners |
| `SKELETON` | Project/solution structure the skill scaffolds | scaffold |
| `STANDARDS_EXAMPLE` | Idiom examples for the Architecture Standards block | scaffold |
| `BUILD` | Build the target (per-config: Debug cluster / Release verify / skeleton verify) | generate · verify |
| `TEST_CLUSTER` | Run a single cluster's tests by name filter | generate |
| `TEST_ALL` | Run the full test suite | verify |
| `TEST_FRAMEWORK` | The unit-test framework agents generate tests in | test-author |
| `COVERAGE` | Produce + parse a coverage report; read per-layer line coverage | coverage |
| `LAYOUT` | Paths: shared kernel, shared tests, cluster source, cluster tests, char/unit tests | scaffold · generate |
| `COMPOSITION` | Integration-layer files the skill writes (composition root + config + readme) | integration |
| `CONFIG` | Dev config file + the placeholder pre-flight before E2E | verify |
| `BUILD_UNIT` | Build/solution/project files that form each cluster's FORBIDDEN set | generate |
| `RULES` | Guardrail rule files deployed to `.claude/rules/` | scaffold |
| `PKG_ADD` | How a cluster requests a new dependency (skeleton-amendment path) | generate |
| `SERVE` | Start the app + health probe + dev-run command | verify |
| `E2E` | The end-to-end harness + how it starts against a running target | verify |
| `FITNESS` | Architecture fitness-test runner (optional; `N/A` if none) | verify |

A stub profile (target not yet implemented) sets a `STATUS: not-implemented` marker and the skill
STOPs on it with a clear message. `project-rules.md` is always deployed regardless of `RULES`.

## Adding a new target (e.g. Java Spring Boot, Python FastAPI)

1. Copy `java-spring.md` (a stub) and fill in every token above with the target's real toolchain.
2. Remove the `STATUS: not-implemented` marker.
3. Verify against a real target app end-to-end before removing the "unverified" note.
4. Ensure a matching `references/mappings/{source}-{target}.md` parity file exists — execution alone
   is not enough; feasibility needs the parity table.

## Profiles in this folder

| Profile | Status |
|---|---|
| `dotnet.md` | ✅ Implemented (primary backend target) |
| `angular.md` | ✅ Implemented (frontend track) |
| `java-spring.md` | ✅ Implemented — ⚠ unverified end-to-end (reachable via `.NET → Java`; parity in `mappings/java-dotnet.md`) |
| `python.md` | ✅ Implemented — ⚠ unverified (selectable via `nodejs → python`; parity in `mappings/nodejs-python.md`, idioms in `stacks/python.md`; java/dotnet→python not mapped) |
| `react.md` | ✅ Implemented — ⚠ unverified (frontend target; selectable via `angular → react`; parity in `mappings/angular-react.md`, idioms in `stacks/react.md`) |

Only a profile whose `STATUS` is exactly `implemented` will run; any other status
(`not-implemented`, `profile-ready`) STOPs.
