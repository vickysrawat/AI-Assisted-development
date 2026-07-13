# 0053 — Architecture-doc population uses a two-signal detector; the TEMPLATE marker is never stripped at copy time
Status: Accepted · Date: 2026-07-12
Governs: `scripts/setup-init-bootstrap.cjs`, `skills/architect/SKILL.md`,
`skills/setup-status/SKILL.md`, `skills/shared/arch-populated-detect.md`
Relates to: [[0050-architecture-doc-set-8]], [[0051-architect-template-dedup]],
[[0046-dream-init-bootstrap-pattern]]

## Problem

The architect skill and the setup-status health check both decide whether each of the 8
architecture docs is real content or still unpopulated scaffolding. The test was a single
line-1 check — `head -1 "$f" | grep -q "TEMPLATE"` — which treated **marker-absent** as
**populated**.

But the `<!-- TEMPLATE -->` marker is a *pristine-template* flag, not a *has-content* flag,
and it was **stripped at deploy time**. Bootstrap Phase 2 (`stepPreCopyArchTemplates`,
added alongside ADR 0051's template dedup) composed the templates and stripped the marker on
copy, with the explicit intent "architect sees the file as populated and skips the expensive
bash detection." Phase 2 only lays down empty scaffolding (`[trust-zone diagram or list]`,
empty tables, `⚠ Could not determine`), so architect read boilerplate as `POPULATED`, skipped
its population pass (Steps 3–6), and the docs stayed empty forever.

Two writers disagreed on what marker-absence meant: bootstrap stripped it *to signal
populated*; architect strips it *only after a genuine population pass* (Step 5). The
"skip-if-populated" optimization silently assumed `deployed == populated`.

## Decision

**The marker is authoritative and is never stripped at copy/deploy time.**

1. **Retain the marker on every copy path.** Bootstrap pre-copies templates verbatim; architect's
   Step 3 fallback copy also retains the marker. The marker is removed in exactly **one** place —
   architect Step 5, after a real population pass.
2. **Two-signal detector** (new shared spec `skills/shared/arch-populated-detect.md`, `arch_unfilled`,
   used by both `architect` and `setup-status`). A file is unfilled if **either**:
   - the `<!-- TEMPLATE -->` marker is on line 1 (primary), **or**
   - the body still contains a **population-proof** scaffold-only token — a curated set of
     placeholders architect provably replaces (`[trust-zone diagram or list]`, `[trace here]`,
     `<!-- From code:`, …), matched as fixed strings.

## Rationale

- **One writer, one meaning.** Making the marker's removal the sole responsibility of the
  population step removes the bootstrap/architect disagreement at the root.
- **The scaffold-token net is defense-in-depth**, not the primary signal — it catches a file that
  lost its marker without being filled (a crashed run, or a project provisioned under the old
  stripping bootstrap). It also doubles as the upgrade path: such files still carry the tokens, so
  they re-flag as unfilled with no data migration.
- **`⚠ Could not determine — needs manual input` is deliberately excluded** as a scaffold token: a
  *fully populated* file legitimately contains it (architect Step 5 rule 4 writes it into any
  section it could not derive from code). Using it would re-flag good docs forever.

## Alternatives rejected

- **Content-only detection (drop the marker entirely).** Rejected — no single body token is
  universal across all 8 files × 11 stacks, and the only near-universal candidate
  (`⚠ Could not determine`) is present in populated files. The marker is the reliable signal;
  the token check only supplements it.
- **Keep stripping the marker but record populated files in a state file.** Rejected — adds an
  out-of-band source of truth that architect must keep in sync; the in-band marker already carries
  the fact and travels with the file.
- **Fix only the bootstrap strip, keep the bare line-1 check.** Rejected per the approved plan —
  it leaves the same class of bug (any future marker-free-but-empty file) undetected; the user
  chose belt-and-suspenders.

## Consequences

- Adds `skills/shared/arch-populated-detect.md`; `architect` and `setup-status` reference it instead
  of inlining divergent `grep TEMPLATE` snippets. Registered in `plugin.json` `components.shared`.
- Projects provisioned under the old bootstrap have marker-free-but-empty docs; the secondary token
  check flags them `NEEDS_POPULATION` on the next architect / setup-status run — surfaced via a
  v3.10.0 migration entry, no data migration required.
- The scaffold-token list is maintained alongside the templates: a new distinctive placeholder must
  be added to the spec.

## Revisit when

If the templates evolve so that no stable, population-proof scaffold token exists per file, or if
the token list proves high-maintenance, reconsider replacing the secondary net with an explicit
second sentinel line that architect removes on population.
