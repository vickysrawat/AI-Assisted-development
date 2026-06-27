# Phase D — Deterministic Analysis Layer — Shared Spec
_Spec version: 1.0 · Last changed: 2026-06-11 · Governed by: skills/shared/_

Defines the deterministic layer of the code-review hybrid: machines find
patterns, models find meaning — **where machines exist**. The plugin discovers
what exists per machine, runs the best of it, and is structurally incapable of
confusing "unscanned" with "clean".

**Callers:** `code-review`, `architect` (probe), `dream-status` (check 1q)

---

## 1. Capability profile — MACHINE-LOCAL, never committed

Tool availability is a per-machine fact. The profile lives in a
MACHINE-LOCAL, never-committed location (each consumer documents the concrete
path for the current tooling — see architect Step 1b and code-review Step 3a),
NEVER in any committed file such as `architecture-deployment.md`:

```json
{
  "phaseD": {
    "probedAt": "2026-06-11",
    "csharp": { "tool": "msbuild+SecurityCodeScan", "version": "5.6.7", "mode": "build-warnings" },
    "js":     { "tool": "eslint", "version": "8.44.0", "path": "node_modules/.bin/eslint" },
    "python": { "tool": null, "reason": "stack not detected" }
  }
}
```

`architecture-deployment.md` records only TEAM POLICY ("C# Phase D expected via
analyzer warnings; see machine-local profile for status") — never machine facts.

**HARD RULE: a capability claim in a committed file is a spec violation** —
Developer A's tools are not Developer B's. The validator enforces this.

## 2. Probe ladders

Heavy probe runs once at architect time (Step 4a2). Built ladders: **C# and JS**
(the detected estate). Python/Java follow the same pattern when a repo needs
them — documented here as pattern, deliberately not built (YAGNI; see ADR 0008).

**C# / .NET (incl. Framework)** — the application toolchain is axiomatic
(the developer builds this app daily):
```
1. Project-local analyzers — grep packages.config / *.csproj for:
   Microsoft.CodeAnalysis.NetAnalyzers | SecurityCodeScan | StyleCop.Analyzers
   → mode: build-warnings (capture from the build the developer already runs)
2. dotnet --version → SDK-style: "dotnet build" warning stream
3. msbuild -version → legacy /p:RunCodeAnalysis=true
4. None → mode: probabilistic-fallback (recorded, visible)
```

**JS/TS:**
```
1. node_modules/.bin/eslint --version      (project-local, team-configured)
2. package.json declares eslint → npm install via org proxy → (1)
3. eslint on PATH (version-check against project config)
4. No package.json (jQuery-era folder) → NOT-APPLICABLE — never force a
   toolchain onto legacy script folders; recorded as such, not as a gap
```

**Per-run verify (cheap):** every code-review start re-checks ONLY the versions
the profile claims (~1s). Mismatch → profile self-heals and the run proceeds
with actual capabilities. Trust the probe, verify per run.

## 3. Capture, not execution, where possible

For C# with project-local analyzers, Phase D = parse the build warning stream.
Match stable WARNING CODES only (CA\d+, SCS\d+, SA\d+) — never message text,
which localizes on non-English Windows.

Fingerprint: `FP-` + hash of `code|file|symbol` (e.g. `CA2100|UserRepo.cs|Find`).
More stable than description-based hashes — phrasing and line numbers drift,
codes and symbols don't.

Ledger entry carries the producing capability:
```
- **Source**: deterministic (SecurityCodeScan 5.6.7)
```
Model-produced findings where no tool exists: `Source: probabilistic-fallback`.

## 4. Baseline strategy — MANDATORY before any gating

First Phase D run on an existing codebase writes ALL current findings to a
`## Baseline` ledger section. **Baseline findings never gate.** Only:
- findings NEW relative to baseline, or
- baseline findings in files the developer touches (boy-scout rule; team-configurable)

enter `## Open Findings` and the checkin/pr-create gates. Without this, a
fifteen-year-old codebase floods the ledger with thousands of pre-existing
warnings, the gates block every commit on inherited debt, and the team disables
the feature within a week. The baseline burns down via deliberate periodic
review (`/code-review --baseline-review`), never by ambushing commits.

## 5. Capability-aware reconciliation — MANDATORY

Per-machine capabilities mean per-machine coverage. Without this rule, ledger
reconciliation churns: Developer B's scan "fails to re-confirm" findings that
B's machine could never have produced.

**RULE: a finding may only be marked not-re-confirmed (or transitioned on that
basis) by a scan that POSSESSED the producing capability.** The current run's
profile is compared against each finding's `Source` field; findings outside the
run's capability set are carried forward unchanged with `last-seen` untouched.

## 6. Disagreement protocol (deterministic vs probabilistic)

- The model may ANNOTATE a deterministic finding (B1–B7 severity escalation,
  probable-false-positive note with reasoning) — it may NEVER delete or
  suppress one. Suppression goes through /dismiss with a human justification.
- Deterministic findings are cheap to fix or cheap to dismiss — do not spend
  model tokens litigating a linter.
- Phase P (probabilistic) receives Phase D's findings as a compact list and
  MUST NOT re-report them — its scope is the judgment tier: ICEA/AC
  traceability, cross-file reasoning, business-context severity, intent-vs-
  implementation mismatches.

## 7. Coverage honesty

Every scope report and ledger summary states what ran:
```
Phase D coverage: .cs → SecurityCodeScan 5.6.7 ✓ · .config → webconfig-checks ✓
                  .js → NONE (no node toolchain) → probabilistic-fallback
```
"No deterministic findings" and "not deterministically scanned" must never be
confusable. dream-status check 1q reports coverage health per detected stack.

## Hard rules

- NEVER store capability claims in committed files
- NEVER gate on baseline findings
- NEVER let Phase P delete or suppress a Phase D finding
- NEVER match analyzer message text — codes only
- NEVER mark a finding not-re-confirmed without the producing capability
- NEVER assert CVE or vulnerability status from model memory (applies here and
  to SCA): no database means no matching, stated plainly in the ledger header
