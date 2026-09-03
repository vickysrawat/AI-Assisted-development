# 0058 — Tech-stack detection is resilient to modern/unknown packaging formats
Status: Accepted · Date: 2026-09-01
Governs: `scripts/repo-detect.cjs` · `scripts/external-stack-detection.cjs` · `skills/architect/SKILL.md` (Step 1 ladders) · `tests/repo-detect.test.cjs`

## Problem

A .NET 10 API project using the new `.slnx` (XML) solution format detected as **UNKNOWN**
(repo-detect exit-3), because the `.NET` catch-all only matched `*.sln`/`*.csproj`. Two root
causes made this a *class* of bug, not a one-off:

1. **Hard failure on the unknown.** The detector emitted UNKNOWN the moment a modern packaging
   format appeared, instead of degrading to a best guess. The next new format would fail the same.
2. **Duplicated ladders drift.** The `.sln` check is mirrored in **4 places** that must agree —
   `repo-detect.cjs`, `external-stack-detection.cjs`, and two bash ladders in architect's Step 1
   ("R7 byte-for-byte equivalent"). A format added to one is silently missed by the others.

(Also latent: `repo-detect.cjs`'s `findFirst()` matches by exact name, so its
`findFirst('.', '*.sln')` nested-solution check was dead code — a nested `.sln` never matched.)

## Decision

Make detection **extension-tolerant** and **degrade gracefully**, and guard the invariant.

1. **Extension-tolerant .NET matching** — match `.sln` **and** `.slnx` (and any `*.sln*`), plus
   `*.csproj`/`*.fsproj`/`*.vbproj`, in all 4 mirrors. Use a glob-capable recursive finder
   (`anyFileDeep`) so nested project/solution files are found (fixing the dead `findFirst` path).
2. **Graceful .NET fallback** — in `repo-detect.cjs`, before returning UNKNOWN, if any `*.cs`
   source exists, resolve to `DOTNET_API` with a stderr warning. A C# tree is unambiguously
   .NET, so a *future* unknown packaging format degrades to the right answer instead of exit-3.
3. **Regression guard** — `tests/repo-detect.test.cjs` (fixture-based: `.slnx`, nested `.csproj`,
   `.fsproj`, `.cs`-only fallback, empty→UNKNOWN) + a `validate.js` structural check asserting
   every mirror is `.slnx`-aware and the fallback is present.

## Consequences

**Positive:**
- `.slnx` and future `*.sln*`/`*.??proj` formats detect correctly across all entry points.
- The detector no longer hard-fails on an unrecognised .NET packaging format (resilience).
- The 4-way duplication now has a structural tripwire (`validate.js`) — drift is caught in CI.

**Negative / trade-offs:**
- The `.cs` fallback can, in a rare non-.NET repo containing a stray `.cs`, misclassify as
  DOTNET_API — surfaced by the warning and overridable via `dream-init-state.json`.
- The ladders remain duplicated (not unified into a single source of truth) — the structural
  guard mitigates but does not eliminate the drift hazard. Full consolidation is deferred.

## Alternatives rejected

**A) Patch only `.slnx`** — rejected: closes today's gap but not the class; the next format fails.

**B) Unify all four ladders into one callable** (architect calls `repo-detect.cjs` instead of
re-implementing the bash ladder) — the correct long-term fix, but a larger refactor of
architect's Step 1; deferred. The structural `.slnx` guard covers the interim.

## Files affected

| File | Change |
|---|---|
| `scripts/repo-detect.cjs` | `anyFileDeep` helper; `.slnx`/`*.??proj` matching; graceful `.cs` fallback; failure message updated |
| `scripts/external-stack-detection.cjs` | `.sln`/`.slnx` matching |
| `skills/architect/SKILL.md` | Both Step-1 bash ladders match `.slnx`/`.fsproj`/`.vbproj` + `.cs` fallback |
| `tests/repo-detect.test.cjs` | New — fixture regression suite |
| `tests/validate.js` | Structural `.slnx`-awareness + fallback guards (4 checks) |
| `docs/adr/README.md` | This ADR indexed |
