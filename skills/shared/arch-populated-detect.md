# Architecture-Doc Populated Detection Spec
_Spec version: 1.0 · Created: 2026-07-12_
_Used by: architect, setup-status_

---

## Why this exists

The architect skill and the setup-status health check both need to answer one
question per architecture doc: **is this file real content, or is it still
unpopulated scaffolding?** The answer gates architect's expensive population pass
(Steps 3–6) and the Green/Amber status in setup-status.

The old test was a single line-1 check — `head -1 "$f" | grep -q "TEMPLATE"` — which
treated **marker-absent** as **populated**. That is wrong whenever a file loses its
`<!-- TEMPLATE -->` marker *before* real content is written. Exactly this happened:
`setup-init-bootstrap.cjs` stripped the marker on pre-copy, so architect read empty
scaffolding as populated and skipped population — the docs stayed empty forever
(fixed in v3.10.0 / ADR 0053, which also made the marker authoritative by never
stripping it at copy time).

This spec defines a single detector both skills call, so they never disagree.

---

## The detection contract

A file is **UNFILLED** (needs population) if **either** signal is present:

1. **Primary — the marker.** `<!-- TEMPLATE -->` on line 1. Authoritative: it is
   written by every template, retained through every copy path, and removed in
   exactly ONE place — architect Step 5, after a genuine population pass.
2. **Secondary — scaffold-only body tokens.** A curated set of placeholder strings
   that architect provably **replaces** during population, so they never survive into
   a populated doc. This is a defense-in-depth net for a file that lost its marker
   without being filled (a crashed run, or a project provisioned under the old
   marker-stripping bootstrap).

Otherwise the file is **FILLED**.

> **Do NOT** use `⚠ Could not determine — needs manual input` as a scaffold token.
> A *fully populated* file legitimately contains it: architect writes that marker
> into any section it could not derive from code (architect Step 5 rule 4). Using it
> here would re-flag good docs for endless re-population.

### Scaffold-only token list (maintained alongside templates)

These are verified template-only (`skills/architect/templates/**`). Match as **fixed
strings** (`grep -F`), never as a broad `\[...\]` regex — brackets appear in real
content (markdown links, `string[]`).

- `[trust-zone diagram or list]`
- `[trace here]`
- `[entry point → service → data access`
- `[per-unit injected/imported dependencies]`
- `[middleware in order]`
- `[Journey Name]`
- `[solution name]/`
- `[project root]/`
- `[package root]/`
- `[group/artifact root]/`
- `<!-- From code:`

If a template adds a new distinctive placeholder, add it here.

---

## Canonical helper

```bash
# Returns 0 (true) if the architecture doc is still unfilled scaffolding.
arch_unfilled() {   # $1 = file path
  head -1 "$1" | grep -q '<!-- TEMPLATE -->' && return 0
  grep -Fq -e '[trust-zone diagram or list]' -e '[trace here]' \
           -e '[entry point → service → data access' \
           -e '[per-unit injected/imported dependencies]' \
           -e '[middleware in order]' -e '[Journey Name]' \
           -e '[solution name]/' -e '[project root]/' \
           -e '[package root]/' -e '[group/artifact root]/' \
           -e '<!-- From code:' "$1" && return 0
  return 1
}
```

Usage:

```bash
for f in .claude/architecture/architecture.md .claude/architecture/architecture-*.md; do
  [ -f "$f" ] || { echo "$f: MISSING"; continue; }
  arch_unfilled "$f" && echo "$f: NEEDS_POPULATION" || echo "$f: POPULATED"
done
```
