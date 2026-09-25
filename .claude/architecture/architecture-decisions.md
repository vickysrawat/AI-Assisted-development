# Architecture — Decision Log

> Load this file to understand *why* the architecture is the way it is, before changing a
> long-standing pattern. **Append-only and PR-reviewed** — add a new `AD-NNN` entry when a
> significant architectural decision is made.

---

## AD-001 — Skills as Markdown, not compiled code

**Decision:** Plugin skills are plain Markdown files (SKILL.md) read by Claude at runtime, not compiled Node.js or TypeScript modules.

**Rationale:** > ⚠ Could not determine — needs manual input

**Alternatives rejected:**
- TypeScript skill modules — would require compilation, versioning of skill APIs, and a runtime loader
- JSON-based skill descriptors — insufficient expressiveness for multi-step orchestration

**Date:** unknown
**Status:** Accepted

---

## AD-002 — Atomic writes via rename (with OneDrive workaround)

**Decision:** All state file writes use a `.tmp` → `fs.rename()` pattern for crash-safety. When rename fails (EPERM on OneDrive/network drives), the workaround is `writeFileSync` + `unlinkSync`.

**Rationale:** > ⚠ Could not determine — needs manual input

**Alternatives rejected:**
- Direct `writeFileSync` — not crash-safe (partial write leaves corrupt state)
- Exclusive locking — complex, platform-dependent

**Date:** unknown
**Status:** Accepted

---

## AD-003 — Deterministic edge extraction (ADR 0041)

**Decision:** Knowledge graph `EXTRACTED` dependency edges are derived from source imports by `scripts/graph-extract-edges.js` (a deterministic script), not by LLM inference.

**Rationale:** > ⚠ Could not determine — needs manual input

**Alternatives rejected:**
- LLM-inferred edges only — non-deterministic, expensive, not reproducible

**Date:** unknown
**Status:** Accepted

---

## AD-004 — Single-source plugin version in `.claude-plugin/plugin.json`

**Decision:** Plugin version is single-sourced in `.claude-plugin/plugin.json`. `plugin-manifest.json`, git tags, and CLAUDE.md references must all match — enforced by `check-version-consistency.js` in CI.

**Rationale:** > ⚠ Could not determine — needs manual input

**Alternatives rejected:**
- Version in `package.json` — would require keeping two files in sync manually

**Date:** unknown
**Status:** Accepted

---

## AD-005 — Jest wrapper that spawns test files as subprocesses

**Decision:** Raw `*.test.cjs` files use `process.exit()` for their own pass/fail reporting. They are run as subprocess children of `tests/jest.suite.test.cjs` rather than directly under Jest to prevent the exit calls from killing the Jest runner.

**Rationale:** > ⚠ Could not determine — needs manual input

**Alternatives rejected:**
- Rewrite all test files to use Jest assertions — high migration cost for existing suite

**Date:** unknown
**Status:** Accepted
