# Phase-1 Spike — Validate the asymmetric multi-harness model (ADO-4000)

_Status: 📋 Planned · Created 2026-08-14 · Precedes the ICEA rewrite (do NOT rewrite ADO-4000 specs until this returns results)._

## Purpose
Empirically test the load-bearing assumptions behind the **asymmetric enforcement** design
(**Claude = write-time prevention** / **Copilot = detection + merge-gate**) BEFORE investing in the
ICEA/spec rewrite. Cheap (~3 SP) and it resolves the biggest unknowns (F1.1, F2.1, F2.3, F1.6, and the
3 caveats on the reframe) with evidence instead of paper.

> Constraint: steps marked **[human]** must be run by a developer in real VS Code 1.110+ Copilot and a
> real GitHub repo — they cannot be automated from the plugin session. Steps marked **[scriptable]** can
> be scaffolded by the plugin. Run everything in a **throwaway scratch repo / branch** — this is
> disposable feasibility code, not plugin source; nothing here goes through the ICEA/APPROVE gate.

---

## Hypotheses & binary pass/fail

### H1 — Self-containment + dual-run (mechanics)
**Claim:** a skill relocated to a single `Shared/skills/` layout, made self-contained (project-relative
reads, no `$PLUGIN_DIR`), and projected to `.claude/skills` + `.github/skills`, runs in BOTH Claude Code
and VS Code Copilot with no dangling-reference failure.
- Pilot skill: a small read-only one (e.g. `icea-status`) — mechanics only, deliberately not an orchestrator.
- **[scriptable]** relocate + strip resolver + projection script.
- **[human]** invoke it in Claude Code; invoke it in VS Code Copilot (`/skills` shows it; run it).
- **PASS:** identical behaviour, no `$PLUGIN_DIR`/missing-file error in either tool.
- **FAIL:** either tool errors on a path/reference.
- **Implies:** PASS → the projection + self-containment mechanic (Story 1/2 core) is sound.

### H2 — Critic-as-code-review-skill loads the ICEA and gates a diff  ⭐ (the linchpin of the reframe)
**Claim:** a GA Copilot **code-review** agent skill can auto-load an approved ICEA/Tech Spec from the repo
and flag a PR whose diff violates an acceptance criterion — i.e. the critic works at *review time* with no
inline sibling-skill invocation.
- **[scriptable]** a minimal `review-icea` skill + a test ICEA fixture (1–2 ACs) + a deliberately
  non-compliant code change.
- **[human]** configure the code-review skill for the scratch repo; open a PR with the non-compliant diff;
  observe whether Copilot code review cites the ICEA and flags the violation.
- **PASS:** the review comment references the ICEA AC and flags the violation.
- **PARTIAL:** it reviews but can't/doesn't load the repo ICEA (needs MCP or a different load path).
- **FAIL:** no ICEA-aware review possible.
- **Implies:** PASS → the asymmetric model holds; the critic moves to review-time (dissolves F1.1/F2.1).
  PARTIAL/FAIL → the reframe needs a different critic vehicle (coordinator agent, or MCP-fed context).

### H3 — GitHub required status check is the un-bypassable merge gate
**Claim:** the harness-independent `ai-gate` as a **required status check** on a protected branch blocks a
merge when approval isn't real — a harder, un-bypassable gate than a client hook.
- **[scriptable]** a minimal `ai-gate` CI workflow (`.github/workflows/ai-gate.yml`) that fails when the
  PR's approval condition isn't met.
- **[human]** enable branch protection + mark the check required; open a PR that fails the gate; confirm
  **Merge is blocked**; then satisfy the condition and confirm merge unblocks.
- **PASS:** merge blocked when gate fails, allowed when it passes; `--no-verify` cannot bypass it.
- **FAIL:** merge possible despite a failing required check (config error) — re-check protection setup.
- **Implies:** PASS → Copilot's "weak write-time" is a non-issue; the hard gate lives at merge (Tier-C).
- **Caveat under test:** this depends on org branch-protection being enabled (reframe caveat #1).

### H4 — Sibling-skill invocation reality on Copilot (informational)
**Claim (to falsify):** Copilot has no reliable native skill→skill invocation; the only substitute
(forked-context, experimental) returns only a final result and runs isolated.
- **[human]** try a skill with `context: fork` frontmatter (enable `github.copilot.chat.skillTool.enabled`)
  invoking a second skill; observe whether it works and whether intermediate context is lost.
- **PASS(=confirms our design):** no clean inline sibling-invoke; fork is isolated/experimental →
  confirms we must NOT rely on inline orchestration on Copilot (validates moving the critic to H2's
  review-time path).
- **Implies:** informational — locks the decision to route orchestration to review-time / coordinator agents.

---

## What each result changes in the ICEA rewrite
| Result | ICEA/spec consequence |
|---|---|
| H1 PASS | Keep Story 1/2 projection mechanic; proceed. |
| H2 PASS | Adopt asymmetric model fully: critic = Copilot code-review skill; rewrite Stories 4/6/7; largely delete Story 2's sibling-skill sub-work. |
| H2 PARTIAL | Add an MCP/coordinator-agent path to feed the ICEA to the reviewer; re-scope Story 8 (agents). |
| H3 PASS | Make "required check + branch protection" the documented Copilot hard gate (Story 8 setup step + provisioning warning if branch unprotected). |
| H3 FAIL/blocked | Escalate: the merge-gate premise needs another mechanism before the reframe is safe. |
| H4 as expected | Lock "no inline orchestration on Copilot" into the ICEA assumptions; retire the sibling-skill gating debate. |

## Exit criteria
Spike is done when H1–H4 each have a recorded PASS/PARTIAL/FAIL + one-line evidence. Those results — not
further paper analysis — drive the ICEA rewrite for the asymmetric model.

## Open sub-questions the spike should answer
- Exact config location + mechanism for a Copilot **code-review** agent skill (repo `.github/`? repo
  settings? org policy?) and whether it can read a repo file (the ICEA) as review context or needs MCP.
- Whether `chat.hookFilesLocations` reliably suppresses `.claude/settings.json` hooks in 1.110 (F1.2),
  given the known suppression bugs (#297538) — quick to check in the same scratch repo.
