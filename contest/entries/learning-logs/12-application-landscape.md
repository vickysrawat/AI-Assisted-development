# Learning Log — Entry 12: The Application Landscape (multi-root scan & blast radius)

> Judge-defense study log. Explanation + judge-ready line + summary per concept.
> Companion: entry = `../12-application-landscape.md`; source spec: `skills/shared/multi-root-scan.md`
> (+ `skills/external-dir-map/SKILL.md`, `graph-json-schema.md` sourceRoot).

**The spine:** multi-repo apps are blind across repos; this wires locally-cloned dependency repos
(`additionalDirectories`) into one shared scan-root resolver so the AI reasons about the whole
landscape and can trace **blast radius across repo boundaries**. Read-default, write-confirm.
**Boundary vs Entry 3:** Entry 3 = the graph of one repo; Entry 12 = making scans + the graph span repos.

**Concept map (6):** (1) core problem (cross-repo blindness) · (2) the shared resolver + additionalDirectories
· (3) read-default / write-confirm policy · (4) blast radius via cross-repo graph edges · (5) announce +
boundary-write protection · (6) evidence + framing.

Status: ✅ locked.

## Concept 1 — Cross-repo blindness
**Explanation:** real apps = many repos (UI + API + services). Working in one, the AI is blind to what
the others expose/expect. The cause is scoping, not the model: scanners that improvise `find .` only
see the current repo, which made dependency repos silently invisible.
**Judge line:** *"You're in the UI repo and the API repo might as well be on the moon. Rename a field,
ship it, break someone else's clients three days later. The AI never saw the contract it was calling."*
**Summary:** *Multi-repo apps are blind across repos; improvised single-root scans are why.*
Covers: #2.

## Concept 2 — The shared resolver + additionalDirectories
**Explanation:** you wire locally-cloned dependency repos into `additionalDirectories`
(`.claude/settings.local.json`); a single shared resolver (`multi-root-scan`) is the source of truth for
"which roots do I scan?"; every skill/script derives roots from it instead of hardcoding `find .`.
**Judge line:** *"One list of the repos that matter, one resolver every scanner uses, so the graph
builder, explain, security, and readiness all see the same landscape instead of each guessing."*
**Summary:** *additionalDirectories + one shared scan-root resolver used by every scanner.*
Covers: #3.

## Concept 3 — Read-default / write-confirm policy
**Explanation:** orientation skills (graph build/sync, `explain`, `icea-feature`, `update-arch`) include
dependency repos **by default** (reading is safe). Ledger-writing scanners (security, code-review,
app-readiness) include them **only on `--with-deps`** (they persist FP findings + gate checkin Check D).
Any **write** outside the repo root always confirms; `APPROVE ALL` does NOT blanket a boundary crossing.
**Judge line:** *"Reading the landscape is on by default because it's safe. Writing findings about it, or
editing another repo, takes an explicit opt-in, and a cross-repo write never gets waved through."*
**Summary:** *Read deps by default; write findings only on --with-deps; cross-repo writes always confirm.*
Covers: #4, #8.

## Concept 4 — Blast radius via cross-repo graph edges
**Explanation:** dependency modules are tagged with `sourceRoot` in `graph.json`, so the knowledge graph
spans repos and dependency edges cross repo lines. "What depends on X?" now reaches across the system,
which is exactly what a blast-radius / impact question needs.
**Judge line:** *"Because the graph carries where each module came from, 'what depends on this?' can
cross a repo boundary. Change a field here, and it names the modules in the *other* repo that just became
collateral."*
**Summary:** *Cross-repo provenance (sourceRoot) → graph spans repos → impact analysis stops at the
system boundary, not the folder.*
Covers: #5, #6.

## Concept 5 — Announce + boundary-write protection
**Explanation:** never scans a dependency silently; prints "📁 also scanning dependency: {path}" before
touching it. Any write into a resolved root outside the repo gets its own confirmation with a
"⚠ WRITE CROSSES REPO BOUNDARY" warning; `APPROVE ALL` does not blanket it. Repos are curated (only
manifest-referenced/confirmed), not a disk crawl.
**Judge line:** *"Every dependency repo is announced before it's read, and any edit that crosses into
another repo stops for a separate yes, even under approve-all."*
**Summary:** *Announced scans; cross-repo writes need explicit per-crossing approval; curated repos only.*
Covers: #4, #8.

## Concept 6 — Evidence + framing
**Explanation:** measured. The shared resolver is a real single-source-of-truth consumed by
graph-create/sync, security, code-review, app-readiness, explain, icea-feature; read-default/write-confirm
policy; announce convention; cross-repo write protection. **Not-yet-evaluated:** number of cross-repo
breakages actually prevented.
**Judge line:** *"What's real is the shared resolver and the cross-repo graph. How many outages it's
prevented, not-yet-evaluated; I won't invent a number."*
**Summary:** *Evidence = shared resolver + cross-repo graph + policy. Breakages-prevented not-yet-evaluated.*
Covers: #6, #8.

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 4 |
| #2 problem | 1 |
| #3 working today | 2, 3, 4 |
| #4 AI role | 2, 3, 5 |
| #5 flow | 4, 5 |
| #6 value + evidence | 4, 6 |
| #7 resourceful | 2 (one resolver) + 4 (blast radius) |
| #8 responsible AI | 3, 5, 6 |
| #9 demo | 4; `../../demo-scripts.md` §Entry 12 |

## The 3 lines that win Entry 12
1. **Problem:** "You're in the UI repo; the API repo might as well be on the moon, until now."
2. **Blast radius:** "Change a field here and it names the modules in the *other* repo that just became collateral."
3. **Safety:** "Every dependency repo is announced before it's read; no cross-repo write is ever silent."
