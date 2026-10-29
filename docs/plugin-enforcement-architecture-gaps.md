# Plugin Enforcement Architecture — Gaps & Remediation Plan

**Date:** 2026-10-20  
**Status:** Approved for implementation  
**Priority sequence:** G5 → G2 → G3 → G1 → G6 → G4 → G7 → G8

---

## The Mental Model

The plugin has three enforcement layers:

```
Layer 1 — Rule files         → loaded into LLM context on every file edit/analysis
Layer 2 — Tech spec overlays → read once at ICEA generation time
Layer 3 — Skill logic        → executed at specific command invocations
```

A rule that lives only in Layer 2 or Layer 3 is enforced **at most once** (at generation). Every subsequent edit, review, and refactor happens without it. This is the root cause of most gaps below.

---

## Gap Summary Table

| ID | Gap | Severity | Currently mitigated? |
|---|---|---|---|
| G5 | `plugin-path.txt` staleness breaks all skill-level enforcement | Critical | Partial — CLAUDE.md fallback in `techspec-refresh` only |
| G2 | Rules deployed once; no auto-refresh signal when plugin upgrades | High | Manual `REFRESH RULES` only |
| G3 | Rule files and techspec overlays have no formal relationship; drift independently | High | Partial — pointer text in techspec |
| G1 | Rule file deployment miss is silent — no warning when stack detection fails | Medium | `near_miss` field only (misses clean misses at 0.4 confidence) |
| G6 | Rules are advisory only — no programmatic check of LLM output against rule files | Medium | `REFRESH TECHSPEC` rubric covers overlays but not rule adherence |
| G4 | `paths:` frontmatter not enforced in repo-wide mode — irrelevant rules waste context | Medium | Track A (`per_project_rules: true`) opt-in exists but off by default |
| G7 | Techspec generation doesn't cross-check deployed rule files for contradictions | Medium | No mitigation |
| G8 | No forward-link from rule files to overlays/skills/projects that use them | Low | No mitigation |

---

## Gap Details and Remediation

---

### G5 — `plugin-path.txt` Staleness

**Root cause:** `plugin-path.txt` is written by `setup-init` (`scripts/setup-init-bootstrap.cjs: stepWritePluginPath`) at install time. When the plugin upgrades to a new version directory, the file is not updated unless `setup-init` or `setup-sync` is re-run. Skills read from the wrong cache version.

**Breaking point hit:** v3.25.0 → v3.26.0 upgrade. Two overlays returned "File does not exist." Manual recovery: read CLAUDE.md `Plugin version:` line, glob for the correct cache directory.

**Remediation options:**
- **A (recommended):** At session-start (`/session-start` hook), compare `plugin-path.txt` version against CLAUDE.md `Plugin version:` line. If mismatch, auto-resolve to the correct path and log a warning: `⚠ plugin-path.txt pointed to 3.25.0; CLAUDE.md confirms 3.26.0 — updated automatically.`
- **B:** Every skill that reads `$PLUGIN_DIR` applies the fallback: if the resolved path doesn't exist, parse CLAUDE.md for the correct version and re-resolve. Harder to maintain across all skills.
- **C:** `setup-sync` documents "run after every plugin upgrade" — acceptable only as a stop-gap.

**Files to change:** `_project-deploy/commands/session-start.md`, `scripts/setup-init-bootstrap.cjs` (add version-check to `stepWritePluginPath`), and optionally `skills/shared/plugin-path-resolution.md`.

---

### G2 — Rules Deployed Once, No Staleness Signal

**Root cause:** `_deploy-manifest.json` records `plugin_version` at deploy time but nothing compares it against the current plugin version during sessions. Teams don't know their rule files are stale.

**Breaking point:** New Entra DO NOT rules added to `auth-rules.md` today. All projects that ran `setup-init` before today have the old copy. The new rules won't fire.

**Remediation options:**
- **A (recommended):** `/setup-status` (or `/session-start`) reads `_deploy-manifest.json` → `plugin_version` and compares against CLAUDE.md `Plugin version:`. If different, emit: `⚠ Rule files deployed at v3.25.0; plugin is v3.26.0 — run REFRESH RULES to update.`
- **B:** `REFRESH RULES` adds a pre-flight that always shows the version delta before prompting per-file.
- **C:** CI graph sync check (`ci_graph_sync=true`) triggers `REFRESH RULES` automatically on pipeline. Highest reliability but requires CI access.

**Files to change:** `_project-deploy/commands/setup-status.md`, optionally `_project-deploy/commands/session-start.md`, `scripts/setup-init-bootstrap.cjs`.

---

### G3 — Rule Files and Techspec Overlays Drift Independently

**Root cause:** There is no formal link between a rule in a rule file and the corresponding DO NOT rule in a techspec overlay. They are maintained by separate processes (`REFRESH RULES` vs `REFRESH TECHSPEC`), triggered separately, and have no shared source of truth.

**Breaking point scenario:** `auth-rules.md` gains a new Entra rule. `REFRESH TECHSPEC react-fastapi` regenerates the techspec's DO NOT section from web-search + LLM pass — overwrites the pointer, contradicts the rule file.

**Remediation options:**
- **A (recommended):** Establish a convention: techspec DO NOT sections are **pointers only**, not rule definitions. Format: `> Rules enforced by rule files: see \`auth-rules.md § Microsoft Entra ID\` and \`react-ecosystem-rules.md § Out of bounds\`. Only stack-combination-specific rules not covered by any rule file appear here.` The `REFRESH TECHSPEC` judge (Step 7) gains a new check: "Does the proposed diff add a DO NOT rule that duplicates content in a deployed rule file? FAIL if yes."
- **B:** A `rule-cross-reference.json` in the plugin maps rule file sections → techspec overlay names. `REFRESH TECHSPEC` reads this and skips regenerating DO NOT sections for covered rules.

**Files to change:** `skills/icea-feature/references/techspec-react-fastapi.md` (and all overlays — pointer format), `skills/techspec-refresh/SKILL.md` (add judge check SC6: no rule file duplication).

---

### G1 — Silent Deployment Miss

**Root cause:** `stepDeployRules` in `setup-init-bootstrap.cjs` only populates `near_miss` when confidence is between `THRESHOLD - 0.1` and `THRESHOLD`. A clean miss at 0.4 confidence produces no signal.

**Breaking point:** React+FastAPI project where `react-ecosystem` scores 0.4 confidence. `react-ecosystem-rules.md` not deployed. No warning. LLM generates `React.FC` throughout.

**Remediation options:**
- **A (recommended):** Add a `deployment_gaps` array to `_deploy-manifest.json` that lists stack keys the skill detected (even at low confidence) but did NOT deploy. `/setup-status` renders these as: `ℹ Stack signals detected but below deployment threshold: react-ecosystem (0.40). Run setup-init with --threshold 0.4 to include, or add manually.`
- **B:** Lower the default threshold to 0.5. Riskier — more irrelevant rules deployed.

**Files to change:** `scripts/setup-init-bootstrap.cjs` (`stepDeployRules`), `_project-deploy/commands/setup-status.md`.

---

### G6 — Rules Advisory Only

**Root cause:** Rule files are natural language instructions to the LLM. There is no programmatic scan of generated or edited code that flags rule violations.

**Breaking point:** Under context pressure, the LLM may violate a DO NOT rule. No post-generation check catches it. The first time anyone notices is during human code review.

**Remediation options:**
- **A (recommended — scoped):** Add a `/rule-check` command that runs after `IMPLEMENT` or on demand. It reads the deployed rule files, extracts the DO NOT rules (lines starting with `- DO NOT`), and scans the changed files for violations using pattern-based LLM analysis. Reports findings in the same format as `REFRESH TECHSPEC`. Not exhaustive (LLM-based, not static analysis) but catches obvious violations.
- **B:** Extend the `REFRESH TECHSPEC` rubric to also check recently edited files against rule file DO NOTs (cross-layer check SC2 equivalent for rule files).
- **C:** Pre-commit hook that calls the LLM with rule files + changed diff and emits a warning. Requires CI integration.

**Files to change:** New skill `skills/rule-check/SKILL.md`, `CLAUDE.md` keyword handler `CHECK RULES` or `RULE CHECK ADO-{ID}`.

---

### G4 — `paths:` Frontmatter Not Enforced in Repo-Wide Mode

**Root cause:** Default `mode: "repo-wide"` in `_deploy-manifest.json` loads all deployed rules regardless of `paths:`. The `paths:` field is only respected in Track A (`per_project_rules: true`). In a 14-rule-file project, every `.py` edit loads all React, Angular, CSS, and jQuery rules — wasted context tokens.

**Breaking point:** Context budget. In a large codebase edit session, 4–6 irrelevant rule files consume ~8–12k tokens. This leaves less room for the actual file being edited and reduces LLM attention on the relevant rules.

**Remediation options:**
- **A (recommended):** Change default `mode` to `per-project` (Track A) for new setups. `stepDeployRules` already has Track A logic — it generates scoped `paths:` by framework overlay. Make it the default, not opt-in.
- **B:** Keep repo-wide as default, but add a `SET RULES per-project` command that migrates a deployed project to Track A without re-running full `setup-init`.
- **C:** Add a `paths:` enforcement layer to the session-start hook: only load rule files whose `paths:` patterns match files changed since last commit.

**Files to change:** `scripts/setup-init-bootstrap.cjs` (change `PER_PROJECT` default), `_project-deploy/commands/setup-status.md` (surface mode), CLAUDE.md keyword handler.

---

### G7 — Techspec Generation Doesn't Cross-Check Rule Files

**Root cause:** `icea-feature` skill reads the overlay and generates code. It does not compare the generated tech spec against deployed rule files for contradictions.

**Breaking point:** `react-ecosystem-rules.md` says "No `React.FC`." A future `REFRESH TECHSPEC react-fastapi` web-search pass finds a React tutorial using `React.FC` and regenerates the techspec with it. LLM resolves the contradiction unpredictably.

**Remediation options:**
- **A (recommended):** Add a CC5 check to `REFRESH TECHSPEC` rubric: "Does any proposed code block in the overlay violate a DO NOT rule in a deployed rule file?" Judge reads both the overlay diff and the rule file DO NOT list and cross-checks. FAIL if contradiction found.
- **B:** `SAVE TECH ADO-{ID}` (tech spec write step) adds a final consistency check: scan the generated tech spec's code blocks against the deployed rule files.

**Files to change:** `skills/techspec-refresh/SKILL.md` (add CC5 to rubric), optionally `skills/icea-feature/SKILL.md`.

---

### G8 — No Forward-Link / Dependency Graph

**Root cause:** When a rule file is updated, there is no record of which overlays cite it, which skills reference it, or which projects have deployed it.

**Breaking point:** Updating `auth-rules.md` today. Which projects need `REFRESH RULES`? Which overlays have duplicate DO NOT rules that should now be removed? No answer without manual search.

**Remediation options:**
- **A (recommended — lightweight):** `_deploy-manifest.json` gains a `rule_citations` map: `{ "auth-rules.md": ["techspec-react-fastapi.md", "techspec-python-fastapi.md"] }`. Built at `setup-init` time by scanning overlays for `auth-rules.md` references. `/setup-status` renders: `auth-rules.md is cited by 2 overlays — run REFRESH TECHSPEC after REFRESH RULES.`
- **B:** A plugin-level `rule-dependency-graph.json` in `skills/shared/` that maps rule sections → overlay DO NOT rules (manually maintained by the plugin developer).

**Files to change:** `scripts/setup-init-bootstrap.cjs` (build citations map), `_project-deploy/commands/setup-status.md`.

---

## Implementation Sequence

Recommended order based on severity and dependency:

```
Phase 1 (Critical / breaking today):
  G5 — plugin-path.txt auto-heal in session-start + all skills

Phase 2 (High / silent failures):
  G2 — rule staleness signal in setup-status
  G3 — techspec DO NOT → pointer convention + REFRESH TECHSPEC judge check SC6

Phase 3 (Medium / quality):
  G1 — deployment_gaps in _deploy-manifest.json + setup-status rendering
  G6 — /rule-check command (scoped LLM scan)
  G4 — Track A as default mode

Phase 4 (Medium / consistency):
  G7 — CC5 cross-check in REFRESH TECHSPEC rubric

Phase 5 (Low / discoverability):
  G8 — rule_citations map in _deploy-manifest.json
```

---

## Immediate Actions Before Context Compact

The following 4 rule file edits were already planned in `docs/rule-file-gap-closures-entra-react19.md` and are pending approval — these close a subset of G3:

1. `react-ecosystem-rules.md` line 14 — `React.FC` flat prohibition
2. `react-ecosystem-rules.md` line 82 — strengthen Out of bounds entry
3. `react-ecosystem-rules.md` Out of bounds — add `import React` + `success: boolean` rules
4. `auth-rules.md` Entra section — add `loadingRoles` positive pattern

These 4 edits should be implemented before the context compact so the rule files are correct going into Phase 1 implementation.
