# Architecture — Decision Log

> Append-only and PR-reviewed. Add a new `AD-NNN` entry when a non-obvious design choice is made.
> Never modify existing entries — they are a historical record.
> The full ADR library is in `docs/adr/` (ADR 0001–0053+).

---

## AD-001

**Decision:** Plugin manifest (`plugin.json`) is the single source of truth for version, commands, skills, and rules.

**Rationale:** > ⚠ Could not determine — needs manual input

**Alternatives rejected:** Embedding version in CLAUDE.md (fragile, duplicates state); per-skill versioning (fan-out complexity).

**Date:** unknown  
**Status:** Accepted

---

## AD-002

**Decision:** Bootstrap (`setup-init-bootstrap.cjs`) handles all mechanical setup work; Claude handles only LLM tasks.

**Rationale:** > ⚠ Could not determine — needs manual input (see ADR 0046 in `docs/adr/`)

**Alternatives rejected:** Fully LLM-driven setup (unpredictable, slow); fully scripted setup (can't handle repo type detection, ambiguous structures).

**Date:** unknown  
**Status:** Accepted

---

## AD-003

**Decision:** `graph.json` is authoritative; `graph-index.md` and per-module `<module>.md` files are projections from it.

**Rationale:** > ⚠ Could not determine — needs manual input (see ADR 0038, ADR 0039, ADR 0041)

**Alternatives rejected:** `domain-map.md` (retired v3.0.0 — not machine-readable, no typed edges).

**Date:** unknown  
**Status:** Accepted

---

## AD-004

**Decision:** `EXTRACTED` dependency edges in `graph.json` are derived deterministically by `graph-extract-edges.js`, not by the LLM.

**Rationale:** > ⚠ Could not determine — needs manual input (see ADR 0041)

**Alternatives rejected:** LLM-inferred edges (non-deterministic, vary between runs, hard to review in PRs).

**Date:** unknown  
**Status:** Accepted

---

## AD-005

**Decision:** `autoMemoryEnabled: false` set in `settings.json` by bootstrap to prevent Claude Code's built-in auto-memory from diverting Dream captures to the per-machine profile directory.

**Rationale:** Two live "write your memory" targets → model followed the built-in one (re-injected each turn), diverting captures off-repo. Single target (repo-relative `memory/MEMORY.md`) is required for Dream to function. (See ADR in `docs/adr/` and CHANGELOG 3.11.0.)

**Alternatives rejected:** Strengthening Dream wording only (fragile — two targets still live); leaving both on (split-brain memory).

**Date:** 2026-07-12  
**Status:** Accepted
